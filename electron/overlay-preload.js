const { contextBridge, ipcRenderer } = require('electron');

/**
 * Minimal preload for the Genre Pie Chart overlay window.
 * Exposes only what the overlay needs: receiving session data updates.
 */
contextBridge.exposeInMainWorld('overlayAPI', {
  // Called by the overlay to receive session data pushes from the main window
  onSessionUpdate: (callback) => {
    ipcRenderer.on('overlay:session-update', (event, data) => callback(data));
    return () => ipcRenderer.removeAllListeners('overlay:session-update');
  },

  // Request current data on mount (in case overlay opened after data exists)
  requestData: () => ipcRenderer.send('overlay:request-data'),
});
