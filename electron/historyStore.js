import fs from 'node:fs/promises';
import path from 'node:path';

export class HistoryStore {
  constructor(baseDir) {
    this.baseDir = baseDir;
    this.indexPath = path.join(baseDir, 'index.json');
  }

  async init() {
    await fs.mkdir(this.baseDir, { recursive: true });
    try {
      await fs.access(this.indexPath);
    } catch {
      await fs.writeFile(this.indexPath, JSON.stringify([], null, 2), 'utf-8');
    }
  }

  async _readIndex() {
    try {
      const raw = await fs.readFile(this.indexPath, 'utf-8');
      const arr = JSON.parse(raw);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }

  async _writeIndex(items) {
    await fs.writeFile(this.indexPath, JSON.stringify(items, null, 2), 'utf-8');
  }

  async list() {
    return await this._readIndex();
  }

  async add({ fileInfo, results, autoDetected = false }) {
    const items = await this._readIndex();
    const id = Date.now();
    const resultsPath = path.join(this.baseDir, `${id}.json`);
    const entry = {
      id,
      fileName: fileInfo?.name || (fileInfo?.path ? path.basename(fileInfo.path) : ''),
      filePath: fileInfo?.path || '',
      timestamp: id,
      autoDetected: !!autoDetected,
      resultsPath,
      ferm: null
    };
    await fs.writeFile(resultsPath, JSON.stringify(results, null, 2), 'utf-8');
    const next = [entry, ...items];
    await this._writeIndex(next);
    return entry;
  }

  async getResults(id) {
    const items = await this._readIndex();
    const entry = items.find(it => it.id === id);
    if (!entry || !entry.resultsPath) return null;
    try {
      const raw = await fs.readFile(entry.resultsPath, 'utf-8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async attachFerm(id, fermPayload) {
    const items = await this._readIndex();
    const idx = items.findIndex(it => it.id === id);
    if (idx === -1) return false;
    items[idx].ferm = {
      ...fermPayload,
      timestamp: Date.now()
    };
    await this._writeIndex(items);
    return true;
  }

  async remove(id) {
    const items = await this._readIndex();
    const idx = items.findIndex(it => it.id === id);
    if (idx === -1) return false;
    const entry = items[idx];
    const next = items.filter(it => it.id !== id);
    await this._writeIndex(next);
    try { if (entry.resultsPath) await fs.unlink(entry.resultsPath); } catch {}
    return true;
  }

  async clear() {
    const items = await this._readIndex();
    for (const it of items) {
      try { if (it.resultsPath) await fs.unlink(it.resultsPath); } catch {}
    }
    await this._writeIndex([]);
  }
}


