
import fs from 'node:fs';
import path from 'node:path';

export function loadWindowsEnv() {
  const p = path.resolve('config/windows.env');
  if (!fs.existsSync(p)) {
    console.warn('config/windows.env not found. Using process.env only.');
    return process.env;
  }
  const lines = fs.readFileSync(p, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx+1).trim();
    process.env[k] = v;
  }
  return process.env;
}
