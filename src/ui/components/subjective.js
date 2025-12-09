/* subjective.js — FERM Factor (Subjective) v3
   - Six primary factors with primary weights (clearly editable)
   - Composites: Replay, Cohesion, Originality, Memorability (with sub-factor sliders + includes)
   - Singles: Emotional Impact (with mood tags), Authenticity
   - Per-factor "Include" switches; per-sub-factor includes for composites
   - Each primary factor shows a green bar-fill (0–100) for the computed score
   - Weights renormalize automatically when factors/sub-factors are omitted
   - LocalStorage with version key; safe load/sanitize
*/

const STORE_KEY = 'ferm-factor-v3';

/* ===========================
   EDITABLE WEIGHTS (Top-level)
   ===========================
   PRIMARY_WEIGHTS must sum to 1.0 (we auto-renormalize for omitted factors at runtime).
*/
const PRIMARY_WEIGHTS = {
  emotional_impact: 0.25,
  replay_value: 0.20,
  aesthetic_cohesion: 0.15,
  originality: 0.15,
  memorability: 0.15,
  authenticity: 0.10,
};

/* =========================================
   EDITABLE SUB-WEIGHTS (for composite factors)
   =========================================
   Each inner object should sum to 1.0. If you omit subs at runtime, we renormalize.
*/
const SUB_WEIGHTS = {
  replay_value: {
    narrative_depth: 0.35,
    sonic_depth: 0.35,
    enjoyment: 0.30,
  },
  aesthetic_cohesion: {
    transitions: 0.30,
    thematic_focus: 0.30,
    mix_consistency: 0.20,
    structural_payoff: 0.20,
  },
  originality: {
    lyric_choice: 0.20,
    topic_novelty: 0.15,                // intentionally lighter
    sonic_aesthetic_novelty: 0.25,
    composition_innovation: 0.20,
    instrumentation_innovation: 0.20,
  },
  memorability: {
    hook_salience: 0.35,
    lyric_quotability: 0.25,
    motif_recall: 0.20,
    unique_timbre: 0.20,
  },
};

/* ===========================
   RUBRIC / UI DEFINITIONS
   =========================== */

const FACTORS = [
  {
    key: 'emotional_impact',
    label: 'Emotional Impact',
    type: 'single',
    anchors: ['flat', 'goosebumps'],
    hint: 'How much did it move you overall?',
    tooltip: 'Did the track create a visceral response (chills, excitement, deep calm)?',
    moods: ['sad','bittersweet','happy','intense','aggressive','serene','nostalgic','triumphant'],
  },
  {
    key: 'replay_value',
    label: 'Replay Value',
    type: 'composite',
    hint: 'Why you’d play it again: message depth, sonic depth, pure enjoyment.',
    tooltip: 'Narrative depth (lyrical/messaging layers), sonic depth (ear-candy/layers), and pure enjoyment.',
    subs: [
      {
        key: 'narrative_depth',
        label: 'Narrative depth',
        anchors: ['surface-level', 'compelling mystery'],
        tooltip: 'Messaging/literary layers invite another listen.',
      },
      {
        key: 'sonic_depth',
        label: 'Sonic depth',
        anchors: ['flat', 'rich & revealing'],
        tooltip: 'Layers, ear-candy, space; reveals more on repeats.',
      },
      {
        key: 'enjoyment',
        label: 'Enjoyment',
        anchors: ['no desire', 'replay now'],
        tooltip: 'Pure pleasure/earworm pull to hear it again.',
      },
    ],
  },
  {
    key: 'aesthetic_cohesion',
    label: 'Aesthetic Cohesion',
    type: 'composite',
    hint: 'Do the artistic choices hang together—even with switch-ups?',
    tooltip: 'Transitions, thematic focus, palette consistency, and structural payoff.',
    subs: [
      {
        key: 'transitions',
        label: 'Transitions',
        anchors: ['jarring', 'effortless'],
        tooltip: 'Section changes feel natural and purposeful.',
      },
      {
        key: 'thematic_focus',
        label: 'Thematic focus',
        anchors: ['muddled', 'one clear world'],
        tooltip: 'Lyrical/sonic ideas feel like a unified intent.',
      },
      {
        key: 'mix_consistency',
        label: 'Mix palette',
        anchors: ['clashing', 'cohesive'],
        tooltip: 'Timbres/space belong together; shared palette.',
      },
      {
        key: 'structural_payoff',
        label: 'Structural payoff',
        anchors: ['no payoff', 'great arcs'],
        tooltip: 'Build/release and form choices feel earned.',
      },
    ],
  },
  {
    key: 'originality',
    label: 'Originality',
    type: 'composite',
    hint: 'Freshness of lyrics/topics, sonic aesthetic, composition/arrangement, instrumentation.',
    tooltip: 'Novelty across writing and sound; not just “weird,” but meaningfully new.',
    subs: [
      {
        key: 'lyric_choice',
        label: 'Lyric choice',
        anchors: ['stock phrasing', 'consistently novel'],
        tooltip: 'Phrasing/wording originality.',
      },
      {
        key: 'topic_novelty',
        label: 'Topic novelty',
        anchors: ['common', 'rarely explored'],
        tooltip: 'Subject matter/angle uniqueness.',
      },
      {
        key: 'sonic_aesthetic_novelty',
        label: 'Sonic/genre novelty',
        anchors: ['standard toolkit', 'distinct aesthetic'],
        tooltip: 'Overall sound/genre palette feels new.',
      },
      {
        key: 'composition_innovation',
        label: 'Composition/arrangement',
        anchors: ['cookie-cutter', 'inventive craft'],
        tooltip: 'Form, harmonic turns, arrangement moves.',
      },
      {
        key: 'instrumentation_innovation',
        label: 'Instrumentation/sound design',
        anchors: ['familiar', 'truly innovative'],
        tooltip: 'New textures or novel combos of sounds.',
      },
    ],
  },
  {
    key: 'memorability',
    label: 'Memorability',
    type: 'composite',
    hint: 'What sticks after listening: hook, quotable line, motif recall, unique timbre.',
    tooltip: 'What your brain retains minutes/hours later; not just instant catchiness.',
    subs: [
      {
        key: 'hook_salience',
        label: 'Hook salience',
        anchors: ['weak', 'unmissable'],
        tooltip: 'The hook’s presence/strength in memory.',
      },
      {
        key: 'lyric_quotability',
        label: 'Lyric quotability',
        anchors: ['forgettable', 'quotable'],
        tooltip: 'A line/phrase you want to repeat/share.',
      },
      {
        key: 'motif_recall',
        label: 'Motif recall',
        anchors: ['can’t recall', 'sticks easily'],
        tooltip: 'Melodic/rhythmic motif recall ability.',
      },
      {
        key: 'unique_timbre',
        label: 'Unique timbre',
        anchors: ['generic', 'instantly identifiable'],
        tooltip: 'A sound color you remember distinctly.',
      },
    ],
  },
  {
    key: 'authenticity',
    label: 'Authenticity',
    type: 'single',
    anchors: ['put-on', 'raw & true'],
    hint: 'How honest/convincing did the expression feel?',
    tooltip: 'Believability/vulnerability of the performance.',
  },
];

/* ===========================
   STATE / STORAGE
   =========================== */

const DEFAULT_VALUE = 5;
let currentState = null; // Track current state for external access

function defaultState() {
  const state = {};
  for (const f of FACTORS) {
    if (f.type === 'single') {
      state[f.key] = {
        include: true,
        value: DEFAULT_VALUE,
        tags: f.moods ? [] : undefined, // only for Emotional Impact
      };
    } else {
      // composite
      const subs = {};
      for (const s of f.subs) subs[s.key] = { include: true, value: DEFAULT_VALUE };
      state[f.key] = { include: true, subs };
    }
  }
  return state;
}

function sanitizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object') return base;

  for (const f of FACTORS) {
    const entry = raw[f.key];
    if (!entry || typeof entry !== 'object') continue;
    base[f.key].include = typeof entry.include === 'boolean' ? entry.include : true;

    if (f.type === 'single') {
      const v = Number(entry.value);
      if (Number.isFinite(v)) base[f.key].value = clamp(v, 0, 10);
      if (f.moods) {
        const arr = Array.isArray(entry.tags) ? entry.tags.filter(t => f.moods.includes(t)) : [];
        base[f.key].tags = arr;
      }
    } else {
      // composite subs
      for (const s of f.subs) {
        const sub = entry.subs?.[s.key];
        if (!sub) continue;
        base[f.key].subs[s.key].include = typeof sub.include === 'boolean' ? sub.include : true;
        const sv = Number(sub.value);
        if (Number.isFinite(sv)) base[f.key].subs[s.key].value = clamp(sv, 0, 10);
      }
    }
  }
  return base;
}

function save(state) { 
  localStorage.setItem(STORE_KEY, JSON.stringify(state)); 
  currentState = state; // Update current state reference
}
function load() { 
  try { 
    const loaded = JSON.parse(localStorage.getItem(STORE_KEY)); 
    currentState = loaded;
    return loaded;
  } catch { 
    currentState = null;
    return null; 
  } 
}

// Export functions for external access
export function getCurrentState() { return currentState; }
export function saveState(state) { save(state); }

/* ===========================
   MATH / COMPUTE
   =========================== */

function clamp(x, lo = 0, hi = 10) { return Math.max(lo, Math.min(hi, x)); }
function clamp01(x) { return Math.max(0, Math.min(1, x)); }

function computePrimaryScore01(key, entry) {
  // Returns score in [0..1] for a primary factor
  const factor = FACTORS.find(f => f.key === key);
  if (!factor || entry?.include === false) return null;

  if (factor.type === 'single') {
    return clamp01((entry.value ?? DEFAULT_VALUE) / 10);
  }

  // composite
  const weights = SUB_WEIGHTS[key] || {};
  let num = 0, den = 0;
  for (const s of factor.subs) {
    const sub = entry.subs?.[s.key];
    if (!sub || sub.include === false) continue;
    const w = weights[s.key] ?? 0;
    if (w <= 0) continue;
    num += w * clamp01((sub.value ?? DEFAULT_VALUE) / 10);
    den += w;
  }
  if (den === 0) {
    // fallback to equal weighting over included subs, if all weights were 0/undefined
    let count = 0, acc = 0;
    for (const s of factor.subs) {
      const sub = entry.subs?.[s.key];
      if (!sub || sub.include === false) continue;
      count += 1; acc += clamp01((sub.value ?? DEFAULT_VALUE) / 10);
    }
    return count ? (acc / count) : null;
  }
  return num / den;
}

function computeAllPrimaryScores(state) {
  const scores = {}; // key -> 0..100
  for (const f of FACTORS) {
    if (!state[f.key]?.include) continue;
    const s01 = computePrimaryScore01(f.key, state[f.key]);
    if (s01 === null) continue;
    scores[f.key] = Math.round(s01 * 100);
  }
  return scores;
}

function computeFinalFERM(state) {
  const activeKeys = FACTORS.map(f => f.key).filter(k => state[k]?.include);
  if (!activeKeys.length) return null;

  // renormalize primary weights to included set
  let wsum = 0;
  for (const k of activeKeys) wsum += (PRIMARY_WEIGHTS[k] ?? 0);
  const scores = computeAllPrimaryScores(state);
  if (Object.keys(scores).length === 0) return null;

  let total = 0;
  for (const k of Object.keys(scores)) {
    const w = wsum > 0 ? (PRIMARY_WEIGHTS[k] ?? 0) / wsum : (1 / activeKeys.length);
    total += w * scores[k];
  }
  return Math.round(total * 10) / 10; // one decimal 0..100
}

/* ===========================
   DOM HELPERS
   =========================== */

function el(html) { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstElementChild; }
function byId(id) { return document.getElementById(id); }

/* ===========================
   UI BUILD
   =========================== */

export function initSubjective() {
  injectStyles();

  const container = byId('ferm-sliders');
  if (!container) {
    console.warn('[FERM] Missing #ferm-sliders container.');
    return;
  }
  container.innerHTML = '';

  const state = sanitizeState(load());
  currentState = state; // Set current state reference

  for (const f of FACTORS) {
    const entry = state[f.key];
    const block = el(`
      <div class="ferm-block mb-4 p-3 rounded-lg border">
        <div class="flex items-center justify-between gap-3">
          <div class="flex items-center gap-2">
            <div class="font-semibold">${f.label}</div>
            <label class="ferm-switch flex items-center gap-2 text-sm cursor-pointer">
              <span>Include</span>
              <input type="checkbox" class="ferm-include" ${entry.include ? 'checked' : ''}/>
            </label>
          </div>
          <div class="flex items-center gap-2">
            ${primaryWeightBadge(f.key)}
            <button class="ferm-tooltip-btn" aria-label="Help" title="${f.tooltip}">?</button>
          </div>
        </div>

        ${f.type === 'single' ? singleBodyHTML(f, entry) : compositeBodyHTML(f, entry)}

        <div class="ferm-bar-wrap mt-3" aria-hidden="true">
          <div class="ferm-bar">
            <div class="ferm-bar-fill" style="width:0%"></div>
          </div>
          <div class="ferm-bar-val text-xs mt-1 opacity-80">0/100</div>
        </div>
      </div>
    `);

    container.appendChild(block);

    // wiring
    const includeChk = block.querySelector('.ferm-include');
    includeChk.addEventListener('change', () => {
      entry.include = !!includeChk.checked;
      block.classList.toggle('ferm-disabled', !entry.include);
      updateBlockBar(block, state, f.key);
      updateFinalScore(state);
    });

    if (f.type === 'single') {
      const slider = block.querySelector('.ferm-slider');
      const valEl = block.querySelector('.ferm-value');
      slider.addEventListener('input', () => {
        const v = clamp(Number(slider.value));
        entry.value = v;
        valEl.textContent = v;
        updateBlockBar(block, state, f.key);
        updateFinalScore(state);
      });

      if (f.moods && Array.isArray(f.moods)) {
        const tagsWrap = block.querySelector('.ferm-tags');
        tagsWrap.addEventListener('click', (e) => {
          const btn = e.target.closest('button[data-tag]');
          if (!btn) return;
          const tag = btn.getAttribute('data-tag');
          const arr = entry.tags || [];
          const idx = arr.indexOf(tag);
          if (idx >= 0) { arr.splice(idx, 1); btn.classList.remove('active'); }
          else { arr.push(tag); btn.classList.add('active'); }
          entry.tags = arr;
        });
        // initialize selected classes
        const buttons = tagsWrap.querySelectorAll('button[data-tag]');
        buttons.forEach(b => {
          if (entry.tags?.includes(b.getAttribute('data-tag'))) b.classList.add('active');
        });
      }

    } else {
      // composite: wire each sub slider and include
      for (const s of f.subs) {
        const subRow = block.querySelector(`.ferm-sub[data-sub="${s.key}"]`);
        const sInclude = subRow.querySelector('.ferm-sub-include');
        const sSlider = subRow.querySelector('.ferm-sub-slider');
        const sVal = subRow.querySelector('.ferm-sub-value');

        sInclude.addEventListener('change', () => {
          entry.subs[s.key].include = !!sInclude.checked;
          subRow.classList.toggle('ferm-disabled', !sInclude.checked);
          updateBlockBar(block, state, f.key);
          updateFinalScore(state);
        });

        sSlider.addEventListener('input', () => {
          const v = clamp(Number(sSlider.value));
          entry.subs[s.key].value = v;
          sVal.textContent = v;
          updateBlockBar(block, state, f.key);
          updateFinalScore(state);
        });
      }
    }

    // initial paint for this factor
    block.classList.toggle('ferm-disabled', !entry.include);
    updateBlockBar(block, state, f.key);
  }

  // buttons
  const saveBtn = byId('btn-save');
  const loadBtn = byId('btn-load');
  const exportBtn = byId('btn-export');
  const resetBtn = byId('btn-reset');

  if (saveBtn) saveBtn.onclick = () => { save(state); flashSaved(saveBtn); };
  if (loadBtn) loadBtn.onclick = () => { const s = sanitizeState(load()); Object.assign(state, s); refreshUIFromState(state); };
  if (exportBtn) exportBtn.onclick = () => exportScores(state);
  if (resetBtn) resetBtn.onclick = () => { const fresh = defaultState(); Object.assign(state, fresh); refreshUIFromState(state); };

  // initial final score
  updateFinalScore(state);
}

/* ===========================
   HTML FRAGMENTS
   =========================== */

function primaryWeightBadge(key) {
  const w = (PRIMARY_WEIGHTS[key] ?? 0) * 100;
  return `<span class="ferm-weight text-xs px-2 py-1 rounded" title="Primary weight">${w.toFixed(0)}%</span>`;
}

function singleBodyHTML(f, entry) {
  return `
    <div class="mt-2">
      <input type="range" min="0" max="10" step="1" value="${entry.value}" class="ferm-slider w-full"/>
      <div class="flex items-center justify-between text-xs opacity-70 mt-1">
        <span>${f.anchors?.[0] ?? ''}</span>
        <span class="ferm-value font-semibold">${entry.value}</span>
        <span>${f.anchors?.[1] ?? ''}</span>
      </div>
      ${f.moods ? moodTagsHTML(f.moods) : ''}
      <div class="text-xs opacity-80 mt-2">${f.hint}</div>
    </div>
  `;
}

function moodTagsHTML(tags) {
  const chips = tags.map(t => `<button type="button" class="ferm-tag" data-tag="${t}">${t}</button>`).join('');
  return `<div class="ferm-tags flex flex-wrap gap-1 mt-2">${chips}</div>`;
}

function compositeBodyHTML(f, entry) {
  const rows = f.subs.map(s => `
    <div class="ferm-sub flex items-center justify-between gap-3 py-2" data-sub="${s.key}">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2">
          <div class="font-medium">${s.label}</div>
          <button class="ferm-tooltip-btn" aria-label="Help" title="${s.tooltip}">?</button>
          <label class="ferm-switch flex items-center gap-2 text-xs cursor-pointer">
            <span>Include</span>
            <input type="checkbox" class="ferm-sub-include" ${entry.subs[s.key].include ? 'checked' : ''}/>
          </label>
        </div>
        <input type="range" min="0" max="10" step="1" value="${entry.subs[s.key].value}" class="ferm-sub-slider w-full mt-1"/>
        <div class="flex items-center justify-between text-[11px] opacity-70 mt-1">
          <span>${s.anchors?.[0] ?? ''}</span>
          <span class="ferm-sub-value font-semibold">${entry.subs[s.key].value}</span>
          <span>${s.anchors?.[1] ?? ''}</span>
        </div>
      </div>
    </div>
  `).join('');

  return `
    <div class="mt-2">
      ${rows}
      <div class="text-xs opacity-80 mt-1">${f.hint}</div>
    </div>
  `;
}

/* ===========================
   UI UPDATES
   =========================== */

function updateBlockBar(block, state, key) {
  const entry = state[key];
  const s01 = computePrimaryScore01(key, entry);
  const pct = s01 === null ? 0 : Math.round(s01 * 100);
  const bar = block.querySelector('.ferm-bar-fill');
  const val = block.querySelector('.ferm-bar-val');
  if (bar) bar.style.width = `${pct}%`;
  if (val) val.textContent = `${pct}/100`;
}

function updateFinalScore(state) {
  const final = computeFinalFERM(state);
  const el = byId('ferm-score');
  if (el) el.textContent = final == null ? '—/100' : `${final}/100`;
}

function refreshUIFromState(state) {
  const blocks = Array.from(document.querySelectorAll('#ferm-sliders .ferm-block'));
  blocks.forEach((block, idx) => {
    const f = FACTORS[idx];
    const entry = state[f.key];
    // include toggle
    const includeChk = block.querySelector('.ferm-include');
    includeChk.checked = !!entry.include;
    block.classList.toggle('ferm-disabled', !entry.include);

    if (f.type === 'single') {
      const slider = block.querySelector('.ferm-slider');
      const valEl = block.querySelector('.ferm-value');
      slider.value = entry.value;
      valEl.textContent = entry.value;

      if (f.moods) {
        const buttons = block.querySelectorAll('.ferm-tag');
        buttons.forEach(b => {
          const tag = b.getAttribute('data-tag');
          if (entry.tags?.includes(tag)) b.classList.add('active');
          else b.classList.remove('active');
        });
      }

    } else {
      // composite subs
      for (const s of f.subs) {
        const row = block.querySelector(`.ferm-sub[data-sub="${s.key}"]`);
        const sInclude = row.querySelector('.ferm-sub-include');
        const sSlider = row.querySelector('.ferm-sub-slider');
        const sVal = row.querySelector('.ferm-sub-value');
        const sub = entry.subs[s.key];

        sInclude.checked = !!sub.include;
        row.classList.toggle('ferm-disabled', !sub.include);
        sSlider.value = sub.value;
        sVal.textContent = sub.value;
      }
    }
    updateBlockBar(block, state, f.key);
  });
  updateFinalScore(state);
}

/* ===========================
   EXPORT
   =========================== */

function exportScores(state) {
  const payload = {
    rubric_version: 'v3',
    primary_weights: PRIMARY_WEIGHTS,
    sub_weights: SUB_WEIGHTS,
    factors: state,
    factor_scores_out_of_100: computeAllPrimaryScores(state),
    ferm_factor_out_of_100: computeFinalFERM(state),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'ferm-factor.json'; a.click();
  URL.revokeObjectURL(url);
}

/* ===========================
   MISC
   =========================== */

function flashSaved(btn) {
  const old = btn.textContent;
  btn.textContent = 'Saved ✓';
  setTimeout(() => (btn.textContent = old), 800);
}

/* ===========================
   STYLES
   =========================== */

function injectStyles() {
  const css = `
    .ferm-block { border: 2px solid #2ee6a6; background: rgba(46,230,166,0.05); }
    .ferm-block.ferm-disabled { opacity: .65; filter: grayscale(25%); border-color: rgba(46,230,166,0.35); }
    .ferm-switch input { accent-color: currentColor; margin: 0; }
    .ferm-tooltip-btn {
      width: 18px; height: 18px; line-height: 16px; text-align: center;
      border-radius: 9999px; border: 1px solid rgba(0,0,0,0.25);
      font-weight: 700; font-size: 11px; opacity: .75; background: transparent; cursor: help;
    }
    .ferm-tooltip-btn:hover { opacity: 1; }

    /* Sliders */
    .ferm-slider, .ferm-sub-slider { cursor: pointer; }

    /* Bar fill (read-only) */
    .ferm-bar { width: 100%; height: 8px; background: rgba(46,230,166,0.18); border-radius: 6px; overflow: hidden; }
    .ferm-bar-fill { height: 100%; background: #22c55e; transition: width .18s ease; } /* green-500 */

    /* Mood tags */
    .ferm-tags .ferm-tag {
      padding: 2px 8px; border: 1px solid rgba(0,0,0,0.25); border-radius: 9999px; font-size: 12px;
      background: rgba(255,255,255,0.6); cursor: pointer; opacity: .85;
    }
    .ferm-tags .ferm-tag.active { background: #22c55e; border-color: #16a34a; color: white; opacity: 1; }

    /* Weight badge */
    .ferm-weight { background: rgba(46,230,166,0.12); border: 1px solid rgba(46,230,166,0.35); border-radius: 9999px; }

    /* Disabled sub row */
    .ferm-sub.ferm-disabled { opacity: .65; filter: grayscale(25%); }
  `;
  const tag = document.createElement('style');
  tag.textContent = css;
  document.head.appendChild(tag);
}

/* ===========================
   OPTIONAL PUBLIC HELPERS
   =========================== */

export function injectSubjectiveStyles() { injectStyles(); } // backward compatibility

// Hook up buttons if present
export function wireSubjectiveButtons() {
  const saveBtn = byId('btn-save');
  const loadBtn = byId('btn-load');
  const exportBtn = byId('btn-export');
  const resetBtn = byId('btn-reset');

  if (saveBtn) saveBtn.onclick = () => { const st = sanitizeState(load()); save(st); flashSaved(saveBtn); };
  if (loadBtn) loadBtn.onclick = () => { const s = sanitizeState(load()); refreshUIFromState(s); };
  if (exportBtn) exportBtn.onclick = () => exportScores(sanitizeState(load()));
  if (resetBtn) resetBtn.onclick = () => refreshUIFromState(defaultState());
}
