
import { parse } from 'csv-parse/sync';

// Many Vamp CSVs start with a filename column or an empty first field (",...").
// We scan each row and take the first numeric token as the time (seconds).
export function parseTimesCsv(csvText) {
  let text = csvText.trim();
  if (!text) return [];
  if (text.indexOf(',') === -1 && text.indexOf(';') !== -1) {
    text = text.replace(/;/g, ',');
  }
  const rows = parse(text, { relaxColumnCount: true });
  const times = [];
  for (const r of rows) {
    if (!r) continue;
    for (let i = 0; i < r.length; i++) {
      const v = parseFloat(r[i]);
      if (!Number.isNaN(v)) {
        times.push(v);
        break;
      }
    }
  }
  return times;
}
