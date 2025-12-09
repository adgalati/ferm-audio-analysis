import { app } from 'electron';
import { promises as fs } from 'fs';
import path from 'path';

const SETTINGS_FILE = 'settings.json';
const DEFAULT_WATCH_PATH = 'F:\\FERM\\FERM-FACTOR-Clips';

let settingsCache = null;

function getSettingsPath() {
  return path.join(app.getPath('userData'), SETTINGS_FILE);
}

async function loadSettings() {
  if (settingsCache !== null) {
    return settingsCache;
  }

  try {
    const settingsPath = getSettingsPath();
    const data = await fs.readFile(settingsPath, 'utf-8');
    settingsCache = JSON.parse(data);
    return settingsCache;
  } catch (error) {
    // File doesn't exist or is invalid, return defaults
    settingsCache = {
      watchPath: DEFAULT_WATCH_PATH
    };
    return settingsCache;
  }
}

async function saveSettings(settings) {
  try {
    const settingsPath = getSettingsPath();
    settingsCache = { ...settingsCache, ...settings };
    await fs.writeFile(settingsPath, JSON.stringify(settingsCache, null, 2), 'utf-8');
    return true;
  } catch (error) {
    console.error('[Settings Store] Failed to save settings:', error);
    return false;
  }
}

export async function getWatchPath() {
  const settings = await loadSettings();
  return settings.watchPath || DEFAULT_WATCH_PATH;
}

export async function setWatchPath(watchPath) {
  return await saveSettings({ watchPath });
}

export async function getAllSettings() {
  return await loadSettings();
}

