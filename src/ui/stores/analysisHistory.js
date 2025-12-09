const STORE_KEY = 'analysis-history-v1';
const MAX_ITEMS = 50;

function readStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeStore(items) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(items));
  } catch {}
}

export function getHistory() {
  return readStore();
}

export function addHistoryItem(fileInfo, results, { autoDetected = false } = {}) {
  const items = readStore();
  const id = Date.now();
  const entry = {
    id,
    fileName: fileInfo?.name || (fileInfo?.path ? fileInfo.path.split(/[/\\]/).pop() : ''),
    filePath: fileInfo?.path || '',
    timestamp: id,
    autoDetected: !!autoDetected,
    results,
    ferm: null
  };
  const next = [entry, ...items].slice(0, MAX_ITEMS);
  writeStore(next);
  return entry;
}

export function removeHistoryItem(id) {
  const items = readStore().filter(it => it.id !== id);
  writeStore(items);
}

export function clearHistory() {
  writeStore([]);
}

export function attachFermToHistory(id, fermPayload) {
  const items = readStore();
  const idx = items.findIndex(it => it.id === id);
  if (idx === -1) return false;
  items[idx] = {
    ...items[idx],
    ferm: {
      ...fermPayload,
      timestamp: Date.now()
    }
  };
  writeStore(items);
  return true;
}


