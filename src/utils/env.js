
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the project root directory.
 * Uses FERM_REPO_PATH env var if set (for installed builds), otherwise falls back to __dirname relative.
 * @returns {string} - Absolute path to project root
 */
export function getProjectRoot() {
  const repoPath = process.env.FERM_REPO_PATH;
  if (repoPath && fs.existsSync(repoPath)) {
    return repoPath;
  }
  return path.resolve(__dirname, '../..');
}

export function loadWindowsEnv() {
  // Use FERM_REPO_PATH if set, otherwise resolve relative to current working directory
  const projectRoot = getProjectRoot();
  const p = path.join(projectRoot, 'config/windows.env');
  if (!fs.existsSync(p)) {
    console.warn('config/windows.env not found at:', p, 'Using process.env only.');
    return process.env;
  }
  const lines = fs.readFileSync(p, 'utf-8').split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const k = line.slice(0, idx).trim();
    const v = line.slice(idx + 1).trim();
    process.env[k] = v;
  }
  return process.env;
}
