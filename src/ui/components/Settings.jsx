import React, { useState, useEffect } from 'react';
import { FolderOpen, Save, AlertCircle, CheckCircle2 } from 'lucide-react';

function Settings() {
  const [watchPath, setWatchPath] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    loadWatchPath();
  }, []);

  const loadWatchPath = async () => {
    try {
      setIsLoading(true);
      const result = await window.electronAPI.getWatchPath();
      if (result.success) {
        setWatchPath(result.watchPath || '');
      } else {
        setMessage({ type: 'error', text: 'Failed to load watch path: ' + result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error loading settings: ' + error.message });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await window.electronAPI.selectWatchFolder();
      if (result.success && result.folderPath) {
        setWatchPath(result.folderPath);
        setMessage({ type: '', text: '' });
      } else if (!result.canceled) {
        setMessage({ type: 'error', text: 'Failed to select folder: ' + (result.error || 'Unknown error') });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error selecting folder: ' + error.message });
    }
  };

  const handleSave = async () => {
    if (!watchPath.trim()) {
      setMessage({ type: 'error', text: 'Please select a folder to watch' });
      return;
    }

    try {
      setIsSaving(true);
      setMessage({ type: '', text: '' });
      const result = await window.electronAPI.setWatchPath(watchPath.trim());
      if (result.success) {
        setMessage({ type: 'success', text: 'Settings saved successfully! File watcher has been updated.' });
        // Clear message after 3 seconds
        setTimeout(() => setMessage({ type: '', text: '' }), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to save settings: ' + result.error });
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Error saving settings: ' + error.message });
    } finally {
      setIsSaving(false);
    }
  };

  // Listen for watch path changes from main process
  useEffect(() => {
    const removeListener = window.electronAPI.onWatchPathChanged((data) => {
      if (data.watchPath) {
        setWatchPath(data.watchPath);
      }
    });
    return removeListener;
  }, []);

  return (
    <div className="space-y-6">
      <div className="card">
        <h2 className="text-2xl font-bold text-primary-400 mb-6">Settings</h2>

        {/* Watch Folder Setting */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Watch Folder for Auto-Analysis
            </label>
            <p className="text-xs text-gray-500 mb-4">
              Select the folder where audio files will be automatically detected and analyzed when added.
            </p>
            
            <div className="flex gap-2">
              <input
                type="text"
                value={watchPath}
                onChange={(e) => setWatchPath(e.target.value)}
                placeholder="F:\FERM\FERM-FACTOR-Clips"
                disabled={isLoading}
                className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed"
              />
              <button
                onClick={handleSelectFolder}
                disabled={isLoading}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-200 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FolderOpen className="w-4 h-4" />
                Browse
              </button>
            </div>
          </div>

          {/* Message Display */}
          {message.text && (
            <div className={`flex items-start gap-3 p-4 rounded-lg ${
              message.type === 'error' 
                ? 'bg-red-900/20 border border-red-500/50' 
                : 'bg-green-900/20 border border-green-500/50'
            }`}>
              {message.type === 'error' ? (
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
              )}
              <p className={`text-sm ${
                message.type === 'error' ? 'text-red-200' : 'text-green-200'
              }`}>
                {message.text}
              </p>
            </div>
          )}

          {/* Save Button */}
          <div className="flex justify-end">
            <button
              onClick={handleSave}
              disabled={isLoading || isSaving}
              className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </div>
      </div>

      {/* Info Card */}
      <div className="card bg-blue-900/20 border-blue-500/50">
        <h3 className="text-lg font-semibold text-blue-400 mb-2">About Auto-Analysis</h3>
        <p className="text-sm text-blue-200">
          When audio files are added to the watch folder, they will be automatically detected and analyzed.
          The file watcher monitors the folder for new files and triggers analysis when:
        </p>
        <ul className="text-sm text-blue-200 mt-2 list-disc list-inside space-y-1">
          <li>No analysis is currently running</li>
          <li>The file is a supported audio format (WAV, MP3, FLAC, OGG, M4A, AAC)</li>
          <li>The file has finished being written (1.5 second stability threshold)</li>
        </ul>
      </div>
    </div>
  );
}

export default Settings;

