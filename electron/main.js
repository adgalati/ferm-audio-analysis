import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs/promises';
import fsSync from 'fs';
import { spawn } from 'child_process';
import { parse } from 'csv-parse';
import { stringify } from 'csv-stringify/sync';
import { analyzeAudio } from '../src/api/analysis-service.js';
import { loadWindowsEnv } from '../src/utils/env.js';
import { createFileWatcher } from '../src/services/file-watcher.js';
import { explainGenre } from '../src/api/genre-explainer.js';
import { getWatchPath, setWatchPath as saveWatchPath, getAllSettings } from './settings-store.js';
import { addToIndex, findSimilar, computeNovelty, getIndexStatus } from '../src/services/search-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let mainWindow;
let currentAnalysis = null;
let currentAbortController = null;
let fileWatcher = null;
let mongodbService = null;

async function initializeFileWatcher() {
  try {
    // Close existing watcher if any
    if (fileWatcher) {
      try {
        await fileWatcher.close();
      } catch (_) { }
      fileWatcher = null;
    }

    // Get watch path from settings store (falls back to env or default)
    const env = loadWindowsEnv();
    const storedPath = await getWatchPath();
    const watchPath = storedPath || env.FERM_WATCH_PATH || 'F:\\FERM\\FERM-FACTOR-Clips';

    if (!watchPath) {
      console.warn('[Electron Main] Watch path not configured; skipping file watcher');
      return;
    }

    fileWatcher = createFileWatcher(
      watchPath,
      (filePath) => {
        try {
          if (!mainWindow) return;
          if (currentAnalysis) {
            console.log('[Electron Main] File detected but analysis in progress; ignoring:', filePath);
            return; // ignore while analyzing
          }
          console.log('[Electron Main] File detected for auto-analysis:', filePath);
          mainWindow.webContents.send('file-detected', {
            path: filePath,
            name: path.basename(filePath)
          });
        } catch (err) {
          console.error('[Electron Main] Error handling file-detected:', err);
        }
      },
      (err) => {
        console.error('[Electron Main] File watcher error:', err);
      }
    );

    console.log('[Electron Main] File watcher initialized at:', watchPath);
  } catch (err) {
    console.error('[Electron Main] Failed to initialize file watcher:', err);
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1024,
    minHeight: 768,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    backgroundColor: '#111827',
    show: false,
  });

  // Load the app
  if (process.env.NODE_ENV === 'development' || !app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// IPC Handlers
ipcMain.handle('select-audio-file', async (event, options = {}) => {
  const properties = ['openFile'];
  if (options.multiple) {
    properties.push('multiSelections');
  }

  const result = await dialog.showOpenDialog(mainWindow, {
    properties,
    filters: [
      { name: 'Audio Files', extensions: ['wav', 'mp3', 'flac', 'ogg', 'm4a', 'aac'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  });

  if (result.canceled) {
    return null;
  }

  if (options.multiple) {
    return result.filePaths.map(p => ({
      path: p,
      name: path.basename(p)
    }));
  }

  return {
    path: result.filePaths[0],
    name: path.basename(result.filePaths[0])
  };
});

ipcMain.handle('read-audio-as-dataurl', async (event, filePath) => {
  try {
    const fs = await import('fs/promises');
    const data = await fs.readFile(filePath);
    // Best-effort mime detection by extension
    const ext = path.extname(filePath).toLowerCase();
    const mime = ext === '.wav' ? 'audio/wav' : ext === '.mp3' ? 'audio/mpeg' : 'application/octet-stream';
    const b64 = data.toString('base64');
    return { success: true, dataUrl: `data:${mime};base64,${b64}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('run-analysis', async (event, options) => {
  console.log('[Electron Main] run-analysis called with options:', options);

  try {
    if (currentAnalysis) {
      return { success: false, error: 'Analysis already running' };
    }
    const { audioPath, analyses, enableSmile, useStems } = options;

    console.log('[Electron Main] Starting analysis service...');

    // Progress callback
    const onProgress = (progressData) => {
      console.log('[Electron Main] Progress:', progressData);
      event.sender.send('analysis-progress', progressData);
    };

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    currentAnalysis = analyzeAudio({
      audioPath,
      analyses,
      enableSmile,
      useStems,
      onProgress,
      signal
    });

    console.log('[Electron Main] Waiting for analysis results...');
    const results = await currentAnalysis;
    currentAnalysis = null;
    currentAbortController = null;

    console.log('[Electron Main] Analysis complete:', Object.keys(results));
    return { success: true, data: results };
  } catch (error) {
    console.error('[Electron Main] Analysis error:', error);
    console.error('[Electron Main] Error stack:', error.stack);
    const wasAborted = error?.name === 'AbortError' || (error?.message || '').toLowerCase().includes('aborted');
    currentAnalysis = null;
    currentAbortController = null;
    if (wasAborted) {
      return { success: false, canceled: true };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('start-auto-analysis', async (event, { filePath }) => {
  try {
    if (currentAnalysis) {
      return { success: false, error: 'Analysis already running' };
    }

    // Auto-analysis (watcher) default: exclude timbre (openSMILE) and melody for performance
    // Users can still run these in custom analysis via the UI
    const analyses = ['rhythm', 'harmony', 'spectral', 'loudness', 'autotagging', 'spatial'];
    const enableSmile = false;
    const useStems = true;

    const onProgress = (progressData) => {
      if (mainWindow) mainWindow.webContents.send('analysis-progress', progressData);
    };

    currentAbortController = new AbortController();
    const signal = currentAbortController.signal;

    currentAnalysis = analyzeAudio({
      audioPath: filePath,
      analyses,
      enableSmile,
      useStems,
      onProgress,
      signal
    });

    const results = await currentAnalysis;
    currentAnalysis = null;
    currentAbortController = null;
    return { success: true, data: results };
  } catch (error) {
    console.error('[Electron Main] Auto-analysis error:', error);
    const wasAborted = error?.name === 'AbortError' || (error?.message || '').toLowerCase().includes('aborted');
    currentAnalysis = null;
    currentAbortController = null;
    if (wasAborted) {
      return { success: false, canceled: true };
    }
    return { success: false, error: error.message };
  }
});

ipcMain.handle('cancel-analysis', async () => {
  try {
    console.log('[Electron Main] cancel-analysis requested', {
      hasAbortController: !!currentAbortController,
      hasCurrentAnalysis: !!currentAnalysis
    });
    if (currentAbortController) {
      currentAbortController.abort();
      currentAbortController = null;
      console.log('[Electron Main] AbortController signaled');
    }
    if (currentAnalysis && currentAnalysis.cancel) {
      currentAnalysis.cancel();
      currentAnalysis = null;
      console.log('[Electron Main] currentAnalysis.cancel() called');
    }
    if (mainWindow) {
      mainWindow.webContents.send('analysis-progress', { percent: 0, message: 'Cancelled' });
    }
    return { success: true };
  } catch (_) {
    return { success: false, message: 'No analysis running' };
  }
});

ipcMain.handle('export-json', async (event, data) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: 'analysis-results.json',
    filters: [
      { name: 'JSON Files', extensions: ['json'] }
    ]
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  try {
    const fs = await import('fs/promises');
    await fs.writeFile(result.filePath, JSON.stringify(data, null, 2), 'utf-8');
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('export-visualization', async (event, { data, filename }) => {
  const result = await dialog.showSaveDialog(mainWindow, {
    defaultPath: filename,
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'SVG Image', extensions: ['svg'] }
    ]
  });

  if (result.canceled) {
    return { success: false, canceled: true };
  }

  try {
    const fs = await import('fs/promises');
    const buffer = Buffer.from(data.split(',')[1], 'base64');
    await fs.writeFile(result.filePath, buffer);
    return { success: true, path: result.filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// MongoDB IPC Handlers
ipcMain.handle('mongodb:initialize', async (event) => {
  try {
    if (!mongodbService) {
      const srv = await import('../src/services/mongodb-service.js');
      mongodbService = srv;
    }

    const env = loadWindowsEnv();
    const uri = env.DATABASE_URI;

    if (!uri) {
      return { success: false, error: 'DATABASE_URI not configured' };
    }

    const result = await mongodbService.initializeConnection(uri);
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] Initialize error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mongodb:check-connection', async (event) => {
  try {
    if (!mongodbService) {
      const srv = await import('../src/services/mongodb-service.js');
      mongodbService = srv;
    }

    const isConnected = mongodbService.isConnected();
    if (!isConnected) {
      return { success: false, message: 'Not connected to MongoDB' };
    }

    const result = await mongodbService.testConnection();
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] Check connection error:', error);
    return { success: false, message: error.message };
  }
});

ipcMain.handle('mongodb:save-analysis', async (event, record) => {
  try {
    if (!mongodbService) {
      const srv = await import('../src/services/mongodb-service.js');
      mongodbService = srv;
    }

    if (!mongodbService.isConnected()) {
      // If not connected, queue the record
      return { success: false, queued: true, error: 'Not connected to MongoDB, record queued' };
    }

    const result = await mongodbService.insertRecord(record);
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] Save analysis error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mongodb:query-records', async (event, options) => {
  try {
    if (!mongodbService) {
      const srv = await import('../src/services/mongodb-service.js');
      mongodbService = srv;
    }

    if (!mongodbService.isConnected()) {
      return { success: false, records: [], error: 'Not connected to MongoDB' };
    }

    const result = await mongodbService.queryRecords(options);
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] Query records error:', error);
    return { success: false, records: [], error: error.message };
  }
});

ipcMain.handle('mongodb:get-unique-genres', async (event) => {
  try {
    if (!mongodbService) {
      const srv = await import('../src/services/mongodb-service.js');
      mongodbService = srv;
    }

    if (!mongodbService.isConnected()) {
      return { success: false, genres: [] };
    }

    const result = await mongodbService.getUniqueGenres();
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] Get unique genres error:', error);
    return { success: false, genres: [] };
  }
});

ipcMain.handle('mongodb:get-statistics', async (event) => {
  try {
    if (!mongodbService) {
      const srv = await import('../src/services/mongodb-service.js');
      mongodbService = srv;
    }

    if (!mongodbService.isConnected()) {
      return { success: false, stats: null };
    }

    const result = await mongodbService.getStatistics();
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] Get statistics error:', error);
    return { success: false, stats: null };
  }
});

ipcMain.handle('mongodb:delete-record', async (event, id) => {
  try {
    if (!mongodbService) {
      const srv = await import('../src/services/mongodb-service.js');
      mongodbService = srv;
    }

    if (!mongodbService.isConnected()) {
      return { success: false, error: 'Not connected to MongoDB' };
    }

    const result = await mongodbService.deleteRecord(id);
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] Delete record error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mongodb:export-records', async (event, filters) => {
  try {
    if (!mongodbService) {
      const srv = await import('../src/services/mongodb-service.js');
      mongodbService = srv;
    }

    if (!mongodbService.isConnected()) {
      return { success: false, records: [] };
    }

    const result = await mongodbService.exportRecords(filters);
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] Export records error:', error);
    return { success: false, records: [] };
  }
});

// New: Favorites & Period IPC
ipcMain.handle('mongodb:update-favorite-status', async (event, payload) => {
  try {
    if (!mongodbService) mongodbService = await import('../src/services/mongodb-service.js');
    if (!mongodbService.isConnected()) return { success: false, error: 'Not connected to MongoDB' };
    return await mongodbService.updateFavoriteStatus(payload);
  } catch (error) {
    console.error('[MongoDB IPC] update-favorite-status error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mongodb:get-periods-list', async () => {
  try {
    if (!mongodbService) mongodbService = await import('../src/services/mongodb-service.js');
    if (!mongodbService.isConnected()) return { success: false, periods: [] };
    const result = await mongodbService.getPeriodsList();
    return result;
  } catch (error) {
    console.error('[MongoDB IPC] get-periods-list error:', error);
    return { success: false, periods: [], error: error.message };
  }
});

ipcMain.handle('mongodb:get-period-records', async (event, payload) => {
  try {
    if (!mongodbService) mongodbService = await import('../src/services/mongodb-service.js');
    if (!mongodbService.isConnected()) return { success: false, records: [] };
    return await mongodbService.getRecordsByPeriod(payload);
  } catch (error) {
    console.error('[MongoDB IPC] get-period-records error:', error);
    return { success: false, records: [], error: error.message };
  }
});

ipcMain.handle('mongodb:get-top-by-period', async (event, payload) => {
  try {
    if (!mongodbService) mongodbService = await import('../src/services/mongodb-service.js');
    if (!mongodbService.isConnected()) return { success: false, records: [] };
    return await mongodbService.getTopRecordsForPeriod(payload);
  } catch (error) {
    console.error('[MongoDB IPC] get-top-by-period error:', error);
    return { success: false, records: [], error: error.message };
  }
});

ipcMain.handle('mongodb:update-ferm-factor', async (event, payload) => {
  try {
    if (!mongodbService) mongodbService = await import('../src/services/mongodb-service.js');
    if (!mongodbService.isConnected()) return { success: false, error: 'Not connected to MongoDB' };
    return await mongodbService.updateRecordFermFactor(payload.id, payload.fermFactor);
  } catch (error) {
    console.error('[MongoDB IPC] update-ferm-factor error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mongodb:create-period-entry', async (event, payload) => {
  try {
    if (!mongodbService) mongodbService = await import('../src/services/mongodb-service.js');
    if (!mongodbService.isConnected()) return { success: false, error: 'Not connected to MongoDB' };
    return await mongodbService.createPeriodEntry(payload.period, payload.periodStart, payload.periodEnd, payload.periodType);
  } catch (error) {
    console.error('[MongoDB IPC] create-period-entry error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mongodb:update-period', async (event, payload) => {
  try {
    if (!mongodbService) mongodbService = await import('../src/services/mongodb-service.js');
    if (!mongodbService.isConnected()) return { success: false, error: 'Not connected to MongoDB' };
    return await mongodbService.updatePeriod(payload);
  } catch (error) {
    console.error('[MongoDB IPC] update-period error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('mongodb:update-source-type', async (event, payload) => {
  try {
    if (!mongodbService) mongodbService = await import('../src/services/mongodb-service.js');
    if (!mongodbService.isConnected()) return { success: false, error: 'Not connected to MongoDB' };
    return await mongodbService.updateSourceType(payload.id, payload.sourceType);
  } catch (error) {
    console.error('[MongoDB IPC] update-source-type error:', error);
    return { success: false, error: error.message };
  }
});

// Genre explainer (OpenAI GPT-5 mini)
ipcMain.handle('genre-explainer:explain', async (event, { genre, subgenre }) => {
  try {
    const result = await explainGenre({ genre, subgenre });
    return { success: true, data: result };
  } catch (error) {
    console.error('[Electron Main] genre-explainer error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('check-config', async () => {
  try {
    const { checkDemucsAvailability } = await import('../src/runners/demucs.js');
    const { checkFFmpegAvailability } = await import('../src/runners/ffmpeg.js');
    const { checkMAESTAvailability } = await import('../src/runners/maest.js');
    const path = await import('path');
    const env = loadWindowsEnv();

    // Check Demucs availability
    const hasDemucs = env.DEMUCS_CMD ? await checkDemucsAvailability(env.DEMUCS_CMD) : false;

    // Check FFmpeg availability
    let hasFFmpeg = false;
    if (env.FFMPEG_PATH) {
      const ffmpegExe = path.join(env.FFMPEG_PATH, 'ffmpeg.exe');
      hasFFmpeg = await checkFFmpegAvailability(ffmpegExe);
    }

    // Check MAEST availability
    let hasMAEST = false;
    if (env.MAEST_PYTHON_PATH && env.MAEST_CLI_PATH) {
      hasMAEST = await checkMAESTAvailability(env.MAEST_PYTHON_PATH, env.MAEST_CLI_PATH);
    }

    return {
      hasConfig: !!env.SONIC_ANNOTATOR_EXE,
      sonicAnnotatorPath: env.SONIC_ANNOTATOR_EXE,
      vampPath: env.VAMP_PATH,
      hasOpenSmile: !!env.OPENSMILE_EXE,
      openSmilePath: env.OPENSMILE_EXE,
      hasDemucs,
      demucsCmd: env.DEMUCS_CMD,
      demucsArgs: env.DEMUCS_ARGS,
      demucsDevice: env.DEMUCS_DEVICE,
      demucsOutDir: env.DEMUCS_OUTDIR,
      hasFFmpeg,
      ffmpegPath: env.FFMPEG_PATH,
      hasMAEST,
      maestPythonPath: env.MAEST_PYTHON_PATH,
      maestCliPath: env.MAEST_CLI_PATH,
      maestTopK: env.MAEST_TOP_K,
      watchPath: await getWatchPath()
    };
  } catch (error) {
    return {
      hasConfig: false,
      error: error.message
    };
  }
});

ipcMain.handle('get-version', async () => {
  return app.getVersion();
});

// Settings IPC Handlers
ipcMain.handle('settings:get-watch-path', async () => {
  try {
    const watchPath = await getWatchPath();
    return { success: true, watchPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:set-watch-path', async (event, { watchPath }) => {
  try {
    const success = await saveWatchPath(watchPath);
    if (success) {
      // Reinitialize file watcher with new path
      await initializeFileWatcher();
      // Notify renderer that watch path changed
      if (mainWindow) {
        mainWindow.webContents.send('watch-path-changed', { watchPath });
      }
      return { success: true };
    }
    return { success: false, error: 'Failed to save settings' };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:select-folder', async () => {
  try {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory'],
      title: 'Select folder to watch for audio files'
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return { success: true, folderPath: result.filePaths[0] };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// --- Training Mode IPC ---
ipcMain.handle('training:addLabel', async (event, data) => {
  try {
    const { trackId, audioPath, label, genre = 'hiphop' } = data;
    if (!trackId || !audioPath || !label) {
      return { success: false, error: 'Missing required fields' };
    }

    const csvFilename = `${genre}_labels.csv`;
    const csvPath = path.join(__dirname, `../training/metadata/${csvFilename}`);

    // Ensure directory exists
    await fs.mkdir(path.dirname(csvPath), { recursive: true });

    // Check if file exists to determine if we need headers
    let fileExists = false;
    try {
      await fs.access(csvPath);
      fileExists = true;
    } catch { }

    // Read existing to check for duplicates or updates
    let rows = [];
    if (fileExists) {
      const content = await fs.readFile(csvPath, 'utf-8');
      rows = await new Promise((resolve, reject) => {
        parse(content, { columns: true }, (err, records) => {
          if (err) reject(err);
          else resolve(records);
        });
      });
    }

    // Check if trackId already exists
    const existingIndex = rows.findIndex(r => r.track_id === trackId);
    const newRow = {
      track_id: trackId,
      audio_path: audioPath,
      label: label,
      embedding_path: existingIndex >= 0 ? rows[existingIndex].embedding_path : ''
    };

    if (existingIndex >= 0) {
      rows[existingIndex] = newRow;
    } else {
      rows.push(newRow);
    }

    // Write back to CSV
    const output = stringify(rows, { header: true });
    await fs.writeFile(csvPath, output);

    return { success: true };
  } catch (err) {
    console.error('Error adding label:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('training:getLabelStats', async (event, data = {}) => {
  try {
    const { genre = 'hiphop' } = data;
    const csvFilename = `${genre}_labels.csv`;
    const csvPath = path.join(__dirname, `../training/metadata/${csvFilename}`);
    try {
      await fs.access(csvPath);
    } catch {
      return { success: true, stats: { total: 0, perLabel: {} } };
    }

    const content = await fs.readFile(csvPath, 'utf-8');
    const rows = await new Promise((resolve, reject) => {
      parse(content, { columns: true }, (err, records) => {
        if (err) reject(err);
        else resolve(records);
      });
    });

    const stats = {
      total: rows.length,
      perLabel: {},
      nextTrackId: 1
    };

    let maxId = 0;
    rows.forEach(row => {
      if (row.label) {
        stats.perLabel[row.label] = (stats.perLabel[row.label] || 0) + 1;
      }
      // Try to parse track_id as integer to find the max
      const id = parseInt(row.track_id, 10);
      if (!isNaN(id) && id > maxId) {
        maxId = id;
      }
    });
    stats.nextTrackId = maxId + 1;

    return { success: true, stats };
  } catch (err) {
    console.error('Error getting stats:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('training:getTrainingAnalysis', async (event, data = {}) => {
  try {
    const analysisPath = path.join(__dirname, '../training/metadata/training_analysis.json');
    try {
      await fs.access(analysisPath);
    } catch {
      return { success: true, analysis: {} };
    }

    const content = await fs.readFile(analysisPath, 'utf-8');
    const analysis = JSON.parse(content);
    return { success: true, analysis };
  } catch (err) {
    console.error('Error getting training analysis:', err);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('training:buildEmbeddings', async (event, data = {}) => {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../training/build_embeddings.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    // Use the same python environment logic as MAEST if possible, but for now assume system python or venv
    // Ideally we should use the venv python if it exists
    let pythonPath = pythonCmd;
    const venvPython = path.join(__dirname, '../.venv/Scripts/python.exe');
    if (process.platform === 'win32' && fsSync.existsSync(venvPython)) {
      pythonPath = venvPython;
    }

    const child = spawn(pythonPath, [scriptPath], {
      cwd: path.join(__dirname, '..')
    });

    child.stdout.on('data', (data) => {
      const message = data.toString().trim();
      console.log('[Training] ' + message);
      // Send log back to renderer
      event.sender.send('training-log', { message });
    });

    child.stderr.on('data', (data) => {
      const message = data.toString().trim();
      console.error('[Training Error] ' + message);
      event.sender.send('training-log', { message: 'ERROR: ' + message });
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true });
      } else {
        resolve({ success: false, error: `Process exited with code ${code}` });
      }
    });
  });
});

ipcMain.handle('training:trainClassifier', async (event, data = {}) => {
  const { genre = 'hiphop' } = data;
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, '../training/train_classifier.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';

    // Use venv python if available
    let pythonPath = pythonCmd;
    const venvPython = path.join(__dirname, '../.venv/Scripts/python.exe');
    if (process.platform === 'win32' && fsSync.existsSync(venvPython)) {
      pythonPath = venvPython;
    }

    const args = [scriptPath, '--genre', genre];
    const child = spawn(pythonPath, args, {
      cwd: path.join(__dirname, '..')
    });

    let output = "";

    child.stdout.on('data', (data) => {
      const message = data.toString().trim();
      output += message + "\n";
      console.log('[Classifier Training] ' + message);
      event.sender.send('training-log', { message });
    });

    child.stderr.on('data', (data) => {
      const message = data.toString().trim();
      console.error('[Classifier Training Error] ' + message);
      event.sender.send('training-log', { message: 'ERROR: ' + message });
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve({ success: true, output });
      } else {
        resolve({ success: false, error: `Training exited with code ${code}` });
      }
    });
  });
});

// App lifecycle
app.whenReady().then(async () => {
  createWindow();
  await initializeFileWatcher();
}).catch(err => {
  console.error('Failed to create window:', err);
  process.exit(1);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', async () => {
  if (fileWatcher) {
    try { await fileWatcher.close(); } catch (_) { }
    fileWatcher = null;
  }
});

// Search Service IPC Handlers
ipcMain.handle('search:find-similar', async (event, { mongoId, embeddingPath, k, sourceTypeFilter }) => {
  try {
    const result = await findSimilar({ mongoId, embeddingPath, k, sourceTypeFilter });
    return result;
  } catch (error) {
    console.error('[Search IPC] find-similar error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search:compute-novelty', async (event, { mongoId, embeddingPath, k, sourceTypeFilter }) => {
  try {
    const result = await computeNovelty({ mongoId, embeddingPath, k, sourceTypeFilter });
    return result;
  } catch (error) {
    console.error('[Search IPC] compute-novelty error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search:add-to-index', async (event, { mongoId, embeddingPath, sourceType, clipName, topGenre }) => {
  try {
    const result = await addToIndex({ mongoId, embeddingPath, sourceType, clipName, topGenre });
    return result;
  } catch (error) {
    console.error('[Search IPC] add-to-index error:', error);
    return { success: false, error: error.message };
  }
});

ipcMain.handle('search:status', async () => {
  try {
    const result = await getIndexStatus();
    return result;
  } catch (error) {
    console.error('[Search IPC] status error:', error);
    return { success: false, error: error.message };
  }
});

// Handle unhandled errors
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
