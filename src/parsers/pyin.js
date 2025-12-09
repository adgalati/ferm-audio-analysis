import { parse } from 'csv-parse/sync';

/**
 * Parse pYIN smoothed pitch track CSV output.
 * Supports common Vamp CSV layouts:
 * - [time, value]
 * - [time, duration, value]
 * - [time, frequency, voicedProb]
 */
export function parsePyinPitchCsv(csvText) {
  let text = (csvText || '').trim();
  if (!text) return { times: [], f0_hz: [], voicedProb: [] };

  if (text.indexOf(',') === -1 && text.indexOf(';') !== -1) {
    text = text.replace(/;/g, ',');
  }

  const rows = parse(text, { relaxColumnCount: true });

  const times = [];
  const f0_hz = [];
  const voicedProb = [];

  for (const r of rows) {
    if (!r || r.length === 0) continue;

    // Skip header-ish rows
    const head = String(r[0] ?? '').toLowerCase();
    if (head.includes('time') || head.includes('timestamp')) continue;

    let t = Number.NaN, f = Number.NaN, v = Number.NaN;

    // Handle pYIN format: [filename, timestamp, frequency] or [, timestamp, frequency]
    if (r.length >= 3) {
      // Check if first column is filename (quoted) or empty
      const firstCol = String(r[0] || '').trim();
      if (firstCol.startsWith('"') || firstCol === '') {
        // pYIN format: [filename, timestamp, frequency] or [, timestamp, frequency]
        t = parseFloat(r[1]);
        f = parseFloat(r[2]);
        v = (f > 0 ? 1 : 0);
      } else {
        // Try other formats: [time, frequency, voicedProb] or [time, duration, value]
        t = parseFloat(r[0]);
        const second = parseFloat(r[1]);
        const third = parseFloat(r[2]);

        if (!Number.isNaN(third) && third >= 0 && third <= 1) {
          // Looks like voicedProb
          f = second;
          v = third;
        } else {
          // Assume [time, duration, value]
          f = third;
          v = (f > 0 ? 1 : 0);
        }
      }
    } else if (r.length === 2) {
      t = parseFloat(r[0]);
      f = parseFloat(r[1]);
      v = (f > 0 ? 1 : 0);
    } else {
      continue;
    }

    if (Number.isNaN(t) || Number.isNaN(f)) continue;

    times.push(t);
    f0_hz.push(f > 0 ? f : 0);
    voicedProb.push(!Number.isNaN(v) ? Math.max(0, Math.min(1, v)) : (f > 0 ? 1 : 0));
  }

  console.log('[pYIN Parser] Parsed pitch track:', {
    frames: times.length,
    voicedFrames: voicedProb.filter(x => x >= 0.5).length,
    nonZeroF0: f0_hz.filter(x => x > 0).length
  });

  return { times, f0_hz, voicedProb };
}

/**
 * Parse pYIN notes CSV output.
 * Supports:
 * - [time, duration, midi]
 * - [time, duration, midi, frequency]
 * - [time, duration, midi, frequency, confidence]
 */
export function parsePyinNotesCsv(csvText) {
  let text = (csvText || '').trim();
  if (!text) return [];

  if (text.indexOf(',') === -1 && text.indexOf(';') !== -1) {
    text = text.replace(/;/g, ',');
  }

  const rows = parse(text, { relaxColumnCount: true });

  const notes = [];

  for (const r of rows) {
    if (!r || r.length < 2) continue;

    const head = String(r[0] ?? '').toLowerCase();
    if (head.includes('time') || head.includes('timestamp')) continue;

    let time, duration, frequency, confidence = 0.5;

    // Handle pYIN notes format: [filename, start, duration, frequency] or [, start, duration, frequency]
    if (r.length >= 4) {
      const firstCol = String(r[0] || '').trim();
      if (firstCol.startsWith('"') || firstCol === '') {
        // pYIN format: [filename, start, duration, frequency] or [, start, duration, frequency]
        time = parseFloat(r[1]);
        duration = parseFloat(r[2]);
        frequency = parseFloat(r[3]);
      } else {
        // Try other formats: [time, duration, midi, frequency, confidence]
        time = parseFloat(r[0]);
        duration = parseFloat(r[1]);
        frequency = parseFloat(r[3] || r[2]); // Use 4th column if available, else 3rd
        confidence = parseFloat(r[4] || 0.5);
      }
    } else if (r.length >= 3) {
      // Fallback: [time, duration, frequency]
      time = parseFloat(r[0]);
      duration = parseFloat(r[1]);
      frequency = parseFloat(r[2]);
    } else {
      continue;
    }

    if (Number.isNaN(time) || Number.isNaN(duration) || Number.isNaN(frequency) || frequency <= 0) {
      continue;
    }

    const midi = hzToMidi(frequency);

    notes.push({
      start: time,
      end: time + duration,
      midi: Math.round(midi),
      f0_hz: frequency,
      confidence: Math.max(0, Math.min(1, confidence))
    });
  }

  console.log('[pYIN Parser] Parsed notes:', {
    noteCount: notes.length,
    totalDuration: notes.length > 0 ? (Math.max(...notes.map(n => n.end)) - Math.min(...notes.map(n => n.start))).toFixed(2) : 'N/A',
    midiRange: notes.length > 0 ? `${Math.min(...notes.map(n => n.midi))}-${Math.max(...notes.map(n => n.midi))}` : 'N/A'
  });

  return notes;
}

export function midiToHz(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

export function hzToMidi(freq) {
  if (freq <= 0) return 0;
  return 69 + 12 * Math.log2(freq / 440);
}
