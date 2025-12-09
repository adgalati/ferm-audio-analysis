import chokidar from 'chokidar';
import path from 'node:path';

const AUDIO_EXTS = new Set(['.wav', '.mp3', '.flac', '.ogg', '.m4a', '.aac']);

/**
 * Create a file watcher that emits when new audio files are added
 * @param {string} watchPath - Directory to watch
 * @param {(filePath: string) => void} onFileAdded - Callback when a new file is detected
 * @param {(error: Error) => void} onError - Error callback
 * @returns {{ close: () => Promise<void> }} watcher handle
 */
export function createFileWatcher(watchPath, onFileAdded, onError) {
  const watcher = chokidar.watch(watchPath, {
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 1500,
      pollInterval: 250,
    },
    depth: 0,
    ignored: (p) => {
      const base = path.basename(p);
      if (!base) return true;
      // ignore temp/hidden
      if (base.startsWith('.') || base.startsWith('~') || base.endsWith('.tmp')) return true;
      return false;
    },
  });

  watcher.on('add', (fp) => {
    try {
      const ext = path.extname(fp).toLowerCase();
      if (!AUDIO_EXTS.has(ext)) return;
      onFileAdded && onFileAdded(fp);
    } catch (err) {
      onError && onError(err);
    }
  });

  watcher.on('error', (err) => {
    onError && onError(err);
  });

  return {
    close: async () => {
      try { await watcher.close(); } catch (_) {}
    }
  };
}


