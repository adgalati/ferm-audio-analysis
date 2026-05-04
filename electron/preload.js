const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // File selection
  selectFile: (options) => ipcRenderer.invoke('select-audio-file', options),

  // Analysis operations
  runAnalysis: (options) => ipcRenderer.invoke('run-analysis', options),
  runFullAnalysis: (audioPath) => ipcRenderer.invoke('run-full-analysis', { audioPath }),
  cancelAnalysis: () => ipcRenderer.invoke('cancel-analysis'),

  // Progress updates
  onProgress: (callback) => {
    ipcRenderer.on('analysis-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('analysis-progress');
  },

  // Auto-watch events
  onFileDetected: (callback) => {
    ipcRenderer.on('file-detected', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('file-detected');
  },
  startAutoAnalysis: (filePath) => ipcRenderer.invoke('start-auto-analysis', { filePath }),

  // Export operations
  exportJson: (data) => ipcRenderer.invoke('export-json', data),
  exportVisualization: (data, filename) => ipcRenderer.invoke('export-visualization', { data, filename }),

  // Configuration check
  checkConfig: () => ipcRenderer.invoke('check-config'),

  // Genre explainer
  explainGenre: (payload) => ipcRenderer.invoke('genre-explainer:explain', payload),

  // File reading (supports audio and images)
  readAudioAsDataUrl: (filePath) => ipcRenderer.invoke('read-audio-as-dataurl', filePath),
  readFileAsDataUrl: (filePath) => ipcRenderer.invoke('read-audio-as-dataurl', filePath),

  // MongoDB operations
  mongodb: (handler, data) => ipcRenderer.invoke(handler, data),

  // App info
  getVersion: () => ipcRenderer.invoke('get-version'),

  // Settings
  getWatchPath: () => ipcRenderer.invoke('settings:get-watch-path'),
  setWatchPath: (watchPath) => ipcRenderer.invoke('settings:set-watch-path', { watchPath }),
  selectWatchFolder: () => ipcRenderer.invoke('settings:select-folder'),

  // Settings events
  onWatchPathChanged: (callback) => {
    ipcRenderer.on('watch-path-changed', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('watch-path-changed');
  },

  // Training
  training: (handler, data) => ipcRenderer.invoke(handler, data),
  onTrainingLog: (callback) => {
    ipcRenderer.on('training-log', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('training-log');
  },

  // Report / Infographic generation
  report: (handler, data) => ipcRenderer.invoke(handler, data),

  // Search / FAISS operations
  search: (handler, data) => ipcRenderer.invoke(handler, data),

  // UMAP progress events
  onUmapProgress: (callback) => {
    ipcRenderer.on('umap-progress', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('umap-progress');
  },

  // Genre Pie Chart Overlay
  openOverlay: (sessionData) => ipcRenderer.invoke('overlay:open', { sessionData }),
  closeOverlay: () => ipcRenderer.invoke('overlay:close'),
  updateOverlayData: (sessionData) => ipcRenderer.invoke('overlay:update-data', sessionData),
  onOverlayClosed: (callback) => {
    ipcRenderer.on('overlay:closed', () => callback());
    return () => ipcRenderer.removeAllListeners('overlay:closed');
  },
  onOverlayRequestData: (callback) => {
    ipcRenderer.on('overlay:request-data', () => callback());
    return () => ipcRenderer.removeAllListeners('overlay:request-data');
  },
});
