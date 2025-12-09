
import { parse } from 'csv-parse/sync';

// Chordino outputs may be either [start, end, label] or [start, label]
// We handle both and, if end is missing, infer it from the next start; last gets +1s minimum
export function parseChordsCsv(csvText) {
  let text = csvText.trim();
  if (!text) return [];
  if (text.indexOf(',') === -1 && text.indexOf(';') !== -1) {
    text = text.replace(/;/g, ',');
  }
  
  const rows = parse(text, { relaxColumnCount: true });
  
  const events = [];
  const isNum = v => v !== '' && !Number.isNaN(parseFloat(v));
  
  for (const r of rows) {
    if (!r || r.length === 0) continue;
    
    // Accept: [start,end,label], [filename,start,end,label], [start,label]
    let start = null, end = null, label = '';
    
    if (r.length >= 4 && isNum(r[1]) && isNum(r[2])) {
      // filename,start,end,label
      start = parseFloat(r[1]);
      end = parseFloat(r[2]);
      label = String(r[3] || '').trim();
    } else if (r.length >= 3 && isNum(r[0]) && isNum(r[1])) {
      // start,end,label
      start = parseFloat(r[0]);
      end = parseFloat(r[1]);
      label = String(r[2] || '').trim();
    } else if (r.length >= 2 && isNum(r[0])) {
      // start,label (fallback for current format)
      start = parseFloat(r[0]);
      label = String(r[1] || '').trim();
    } else if (r.length >= 3) {
      // Handle current Chordino format: [filename, timestamp, label] or [, timestamp, label]
      if (r[0] === '' || r[0].trim() === '') {
        start = parseFloat(r[1]);
        label = (r[2] || '').toString().trim();
      } else {
        start = parseFloat(r[1]);
        label = (r[2] || '').toString().trim();
      }
    }
    
    if (start != null && label) {
      events.push({ start, end, label });
    }
  }
  
  // Infer ends only when missing
  for (let i = 0; i < events.length; i++) {
    if (events[i].end == null) {
      const next = events[i + 1];
      events[i].end = next ? next.start : events[i].start + 1; // 1s minimum span
    }
  }
  
  return events;
}
