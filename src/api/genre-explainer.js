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
  return `${(genre || '').trim().toLowerCase()}|${(subgenre || '').trim().toLowerCase()}`;
}

export async function explainGenre({ genre, subgenre }) {
  if (!genre && !subgenre) throw new Error('Missing genre/subgenre');
  const key = cacheKey(genre, subgenre);
  // Cache disabled during testing — re-enable when responses are stable
  // if (memoryCache.has(key)) return memoryCache.get(key);

  // Debug: verify env file presence and API key availability
  try {
    const envPath = path.resolve('config/windows.env');
    const hasEnvFile = fs.existsSync(envPath);
    // eslint-disable-next-line no-console
    console.debug(`[GenreExplainer] windows.env present: ${hasEnvFile} at ${envPath}`);
  } catch (_) { }

  const env = loadWindowsEnv();
  const apiKey = env.OPENAI_API_KEY;
  // eslint-disable-next-line no-console
  console.debug(`[GenreExplainer] OPENAI_API_KEY present: ${Boolean(apiKey)}`);
  if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

  const title = subgenre ? `${genre} - ${subgenre}` : genre;

  // Build prompt — outcome-first style per GPT-5.5 guidance
  const system = 'You are a concise music analysis expert. Respond only with the requested JSON. No preamble, no markdown fences.';
  const exampleTitle = JSON.stringify(title);
  const user = `Write exactly 3 short paragraphs about the musical style "${title}".

Paragraph 1: Describe the characteristic sounds, textures, and instruments used in this style.
Paragraph 2: Describe the production and audio-engineering techniques that define this style.
Paragraph 3: Give a brief history of the style and list the most prominent artists or bands associated with it.

If the style includes an abbreviation, make sure to include the full name of the style in the first paragraph spelled out; ex. "EDM" = "Electronic Dance Music".
Each paragraph must be 2-4 sentences. No bullet points, no headers.
Return ONLY strict JSON with fields: {"title": ${exampleTitle}, "paragraphs": ["...", "...", "..."], "summary": "one-sentence summary"}.`;

  const body = {
    model: 'gpt-5.5',
    instructions: system,
    input: user,
    max_output_tokens: 1500,
    reasoning: { effort: 'medium' }, // GPT-5.5 recommended default
    text: {
      format: { type: 'json_object' },
      verbosity: 'low'
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
  } catch (_) { }

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
      // Fallback: split content into paragraph-like chunks
      const lines = content.split('\n').map(s => s.trim()).filter(Boolean);
      parsed = {
        title,
        paragraphs: lines.slice(0, 3),
        summary: lines[0] || ''
      };
    }
  }

  // Minimal normalization
  const result = {
    title: parsed.title || title,
    paragraphs: Array.isArray(parsed.paragraphs) ? parsed.paragraphs.slice(0, 3) : [],
    summary: parsed.summary || ''
  };

  // Cache disabled during testing — re-enable when responses are stable
  // memoryCache.set(key, result);
  return result;
}


