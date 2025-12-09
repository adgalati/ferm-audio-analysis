import { loadWindowsEnv } from '../utils/env.js';
import fs from 'node:fs';
import path from 'node:path';

// Extract the first top-level JSON object substring from a text
function extractFirstJsonObjectString(text) {
  if (!text || typeof text !== 'string') return null;
  let start = -1;
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) depth -= 1;
      if (depth === 0 && start !== -1) {
        return text.slice(start, i + 1);
      }
    }
  }
  return null;
}

// Extract JSON from a ```json ... ``` or ``` ... ``` fenced block
function extractJsonFromCodeFence(text) {
  if (!text || typeof text !== 'string') return null;
  const fenceRegex = /```(?:json)?\s*([\s\S]*?)```/i;
  const m = text.match(fenceRegex);
  if (!m) return null;
  const inner = m[1] || '';
  const jsonStr = extractFirstJsonObjectString(inner) || inner.trim();
  return jsonStr || null;
}

// Simple in-memory cache (process-lifetime). Disk persistence handled by historyStore if needed.
const memoryCache = new Map();

function cacheKey(genre, subgenre) {
  return `${(genre||'').trim().toLowerCase()}|${(subgenre||'').trim().toLowerCase()}`;
}

export async function explainGenre({ genre, subgenre }) {
  if (!genre && !subgenre) throw new Error('Missing genre/subgenre');
  const key = cacheKey(genre, subgenre);
  if (memoryCache.has(key)) return memoryCache.get(key);

  // Debug: verify env file presence and API key availability
  try {
    const envPath = path.resolve('config/windows.env');
    const hasEnvFile = fs.existsSync(envPath);
    // eslint-disable-next-line no-console
    console.debug(`[GenreExplainer] windows.env present: ${hasEnvFile} at ${envPath}`);
  } catch (_) {}

  const env = loadWindowsEnv();
  const apiKey = env.OPENAI_API_KEY;
  // eslint-disable-next-line no-console
  console.debug(`[GenreExplainer] OPENAI_API_KEY present: ${Boolean(apiKey)}`);
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const title = subgenre ? `${genre} - ${subgenre}` : genre;

  // Build prompt
  const system = 'You are a music analysis expert for a live stream. Be concise and practical.';
  const exampleTitle = JSON.stringify(title);
  const user = `Explain the musical characteristics typically associated with ${title}.
Include textures, instruments, rhythm/harmony patterns, production traits, and notable artist or band examples associated with ${title}.
Return ONLY strict JSON (no backticks, no extra commentary) with fields: {"title": ${exampleTitle}, "bullets": ["..."], "summary": "..."}. Max 7 bullets, avoid fluff.`;

  const body = {
    model: 'gpt-5-mini',
    instructions: system,
    input: user,
    max_output_tokens: 1024, // Start with sufficient tokens to avoid retries
    reasoning: { effort: 'low' }, // Reduce reasoning overhead
    text: { 
      format: { type: 'json_object' },
      verbosity: 'low' // Reduce verbosity to save tokens
    }
  };

  // Use the Responses API per latest docs
  const url = 'https://api.openai.com/v1/responses';

  // eslint-disable-next-line no-console
  console.debug(`[GenreExplainer] Sending request to OpenAI: model=${body.model}, title=${title}, max_output_tokens=${body.max_output_tokens}, text.format.type=${body.text?.format?.type}`);

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    });
  } catch (networkErr) {
    // eslint-disable-next-line no-console
    console.error('[GenreExplainer] Network error calling OpenAI:', networkErr);
    throw new Error(`OpenAI network error: ${networkErr.message}`);
  }

  // eslint-disable-next-line no-console
  console.debug(`[GenreExplainer] OpenAI response status: ${res.status}`);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    // eslint-disable-next-line no-console
    console.error('[GenreExplainer] OpenAI error response:', text);
    throw new Error(`OpenAI error ${res.status}: ${text}`);
  }

  const json = await res.json();
  // Debug: dump a compact snapshot of the raw response for diagnostics
  try {
    const dump = JSON.stringify(json);
    const snippet = dump.length > 1200 ? dump.slice(0, 1200) + '…' : dump;
    // eslint-disable-next-line no-console
    console.debug('[GenreExplainer] OpenAI raw response (truncated):', snippet);
  } catch (_) {}

  // Prepare variables for content extraction across branches
  let content = '';
  let contentSource = '';

  // Check for incomplete responses and log warning (no retry needed with proper token budget)
  if (json?.status && json.status !== 'completed') {
    // eslint-disable-next-line no-console
    console.warn(`[GenreExplainer] Response status not completed: ${json.status}; reason=${json?.incomplete_details?.reason || 'unknown'}`);
  }

  // Extract content using robust parsing function
  // eslint-disable-next-line no-inner-declarations
  function pickContent(j) {
    // Check multiple possible locations for text content in Responses API
    if (typeof j?.output_text === 'string' && j.output_text.trim()) return { content: j.output_text, source: 'output_text' };
    if (typeof j?.content?.[0]?.text === 'string' && j.content[0].text.trim()) return { content: j.content[0].text, source: 'content[0].text' };
    if (typeof j?.output?.[0]?.content?.[0]?.text === 'string' && j.output[0].content[0].text.trim()) return { content: j.output[0].content[0].text, source: 'output[0].content[0].text' };
    
    // Check for output array with message type content (most common for Responses API)
    if (Array.isArray(j?.output)) {
      for (const outputItem of j.output) {
        if (outputItem?.type === 'message' && Array.isArray(outputItem?.content)) {
          for (const contentItem of outputItem.content) {
            if (contentItem?.type === 'output_text' && typeof contentItem?.text === 'string' && contentItem.text.trim()) {
              return { content: contentItem.text, source: 'output[].content[].text' };
            }
          }
        }
      }
    }
    
    return { content: '', source: '' };
  }
  
  const picked = pickContent(json);
  content = picked.content;
  contentSource = picked.source;

  // eslint-disable-next-line no-console
  console.debug(`[GenreExplainer] Extracted content source: ${contentSource || 'none'}, length=${content?.length || 0}`);
  if (!content) {
    // eslint-disable-next-line no-console
    console.warn('[GenreExplainer] No text content found in response; cannot parse output.');
  } else {
    const preview = content.length > 400 ? content.slice(0, 400) + '…' : content;
    // eslint-disable-next-line no-console
    console.debug('[GenreExplainer] Content preview:', preview);
  }

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch (_) {
    // Try to extract a JSON object substring from content
    let jsonSubstring = extractFirstJsonObjectString(content);
    if (!jsonSubstring) {
      // Try code-fence extraction if present
      const fenced = extractJsonFromCodeFence(content);
      if (fenced) jsonSubstring = extractFirstJsonObjectString(fenced) || fenced;
    }
    if (jsonSubstring) {
      try {
        parsed = JSON.parse(jsonSubstring);
      } catch (e2) {
        // eslint-disable-next-line no-console
        console.warn('[GenreExplainer] Failed to parse extracted JSON substring:', e2?.message);
      }
    }

    if (!parsed) {
      // eslint-disable-next-line no-console
      console.warn('[GenreExplainer] JSON.parse failed on model output; falling back to heuristic parsing');
      // Fallback: convert lines to bullets and summary
      const lines = content.split('\n').map(s => s.trim()).filter(Boolean);
      parsed = {
        title,
        bullets: lines.slice(0, 7),
        summary: lines.slice(0, 2).join(' ')
      };
    }
  }

  // Minimal normalization
  const result = {
    title: parsed.title || title,
    bullets: Array.isArray(parsed.bullets) ? parsed.bullets.slice(0, 7) : [],
    summary: parsed.summary || ''
  };

  memoryCache.set(key, result);
  return result;
}


