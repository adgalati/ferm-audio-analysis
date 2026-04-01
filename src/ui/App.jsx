import React, { useState } from 'react';
import FileUpload from './components/FileUpload';
import AnalysisControls from './components/AnalysisControls';
import ProgressPanel from './components/ProgressPanel';
import ResultsView from './components/ResultsView';
import FERMFactor from './components/FERMFactor.jsx';
import AnalysisHistory from './components/AnalysisHistory.jsx';
import CloudStoragePanel from './components/CloudStoragePanel.jsx';
import FERMFavesTab from './components/FERMFavesTab.jsx';
import WatchStatusIndicator from './components/WatchStatusIndicator.jsx';
import Settings from './components/Settings.jsx';
import TrainingView from './components/TrainingView.jsx';
import ReportGeneratorPanel from './components/ReportGeneratorPanel.jsx';
import { AudioPlayerProvider } from './contexts/AudioPlayerContext';
import { getHistory, addHistoryItem } from './stores/analysisHistory.js';
import { transformResultsToRecord, reconstructResultsFromRecord } from '../utils/mongodb-schema.js';

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [progress, setProgress] = useState({ percent: 0, message: '' });
  const [error, setError] = useState(null);
  const [activeMode, setActiveMode] = useState('analysis'); // 'analysis' | 'ferm' | 'cloud' | 'faves' | 'settings' | 'reports'
  const [watchPath, setWatchPath] = useState('');
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [availability, setAvailability] = useState([]);
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [historyRefreshToken, setHistoryRefreshToken] = useState(0);
  const [recordToScore, setRecordToScore] = useState(null);
  const [shouldSwitchToLeaderboard, setShouldSwitchToLeaderboard] = useState(false);
  const [appVersion, setAppVersion] = useState('');
  const [isMainstream, setIsMainstream] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const handleFileSelect = React.useCallback((file) => {
    console.log('[App] File selected:', file);
    setSelectedFile(file);
    setAnalysisResults(null); // Clear previous results
    setError(null); // Clear previous errors
    setActiveHistoryId(null);
  }, []);

  const handleAnalysisStart = React.useCallback(() => {
    console.log('[App] Analysis starting');
    setIsAnalyzing(true);
    setError(null);
    setProgress({ percent: 0, message: 'Starting analysis...' });
  }, []);

  const handleAnalysisComplete = React.useCallback((results, fileInfo, options = {}) => {
    console.log('[App] Analysis complete:', results);
    console.log('[App] File info for history:', fileInfo);
    console.log('[App] Analysis options:', options);
    setAnalysisResults(results);
    setIsAnalyzing(false);
    setProgress({ percent: 100, message: 'Analysis complete!' });

    // Save to history with the file info passed in
    if (fileInfo) {
      const entry = addHistoryItem(fileInfo, results, { autoDetected: !!fileInfo.autoDetected });
      console.log('[App] Added to history:', entry);
      setActiveHistoryId(entry.id);
      setHistoryRefreshToken(t => t + 1);
      try { sessionStorage.setItem('activeHistoryId', String(entry.id)); } catch (_) { }

      // Queue for MongoDB cloud storage
      saveToMongoDB(fileInfo, results, options);
    }
  }, []);

  const saveToMongoDB = async (fileInfo, results, options = {}) => {
    console.log('[App] saveToMongoDB called with options:', options);
    try {
      const clipName = fileInfo?.name || (fileInfo?.path ? fileInfo.path.split(/[/\\]/).pop() : 'unknown');
      const record = transformResultsToRecord(clipName, results, {
        sourceType: options.sourceType || 'independent'
      });
      console.log('[App] MongoDB record sourceType:', record.sourceType);

      // Try to save to MongoDB
      const saveResult = await window.electronAPI.mongodb('mongodb:save-analysis', record);

      if (saveResult.success) {
        console.log('[App] Successfully saved to MongoDB:', saveResult.id);

        // Auto-add to FAISS index if embedding exists
        const embeddingPath = results?.autotagging?.embeddingPath || record.embeddingPath;
        if (embeddingPath && saveResult.id) {
          try {
            const indexResult = await window.electronAPI.search('search:add-to-index', {
              mongoId: saveResult.id,
              embeddingPath,
              sourceType: record.sourceType,
              clipName,
              topGenre: record.topGenre
            });
            if (indexResult.success) {
              console.log('[App] Auto-added to FAISS index. Size:', indexResult.index_size);
              // Recompute UMAP in background so the map is ready when the user views it
              window.electronAPI.search('search:compute-umap', {}).then(umapResult => {
                if (umapResult.success) {
                  console.log('[App] UMAP recomputed after index update');
                } else {
                  console.warn('[App] UMAP recompute failed:', umapResult.error);
                }
              }).catch(umapErr => {
                console.warn('[App] UMAP recompute error:', umapErr);
              });
            } else {
              console.warn('[App] Failed to add to index:', indexResult.error);
            }
          } catch (indexErr) {
            console.warn('[App] Index add error:', indexErr);
          }
        }
      } else if (saveResult.queued) {
        console.log('[App] Record queued for sync:', saveResult.error);
      } else {
        console.log('[App] MongoDB save failed:', saveResult.error);
      }
    } catch (err) {
      console.error('[App] MongoDB save error:', err);
    }
  };

  const handleAnalysisError = React.useCallback((error) => {
    console.error('[App] Analysis error:', error);
    setIsAnalyzing(false);
    if (String(error?.message || '').toLowerCase().includes('canceled') || error?.name === 'AbortError') {
      // Treat cancellation as non-error
      setError(null);
      setProgress({ percent: 0, message: '' });
    } else {
      setError(error.message || 'Unknown error occurred');
      setProgress({ percent: 0, message: '' });
    }
    setProgress({ percent: 0, message: '' });
  }, []);

  // Wire watch path broadcast
  React.useEffect(() => {
    const handler = (e) => setWatchPath(e.detail?.watchPath || '');
    window.addEventListener('watch-path', handler);

    // Also listen for watch path changes from settings
    const removeListener = window.electronAPI?.onWatchPathChanged?.((data) => {
      if (data.watchPath) {
        setWatchPath(data.watchPath);
        // Also dispatch custom event for other components
        const evt = new CustomEvent('watch-path', { detail: { watchPath: data.watchPath } });
        window.dispatchEvent(evt);
      }
    });

    return () => {
      window.removeEventListener('watch-path', handler);
      if (typeof removeListener === 'function') removeListener();
    };
  }, []);

  // Capture initial availability broadcast from AnalysisControls mount (or main)
  React.useEffect(() => {
    const handler = (e) => setAvailability(e.detail?.availability || []);
    window.addEventListener('analysis-availability', handler);
    return () => window.removeEventListener('analysis-availability', handler);
  }, []);

  // Clear UI instantly on cancel broadcast
  React.useEffect(() => {
    const onCancelled = () => {
      setIsAnalyzing(false);
      setProgress({ percent: 0, message: '' });
    };
    window.addEventListener('analysis-cancelled', onCancelled);
    return () => window.removeEventListener('analysis-cancelled', onCancelled);
  }, []);

  // Ensure capability checks run on first render regardless of file selector
  React.useEffect(() => {
    if (!window?.electronAPI?.checkConfig) return;
    window.electronAPI.checkConfig().then(config => {
      // Surface watch path
      if (config.watchPath) {
        const evt = new CustomEvent('watch-path', { detail: { watchPath: config.watchPath } });
        window.dispatchEvent(evt);
      }
      const avail = [];
      if (config.hasOpenSmile) avail.push('Timbre (openSMILE)');
      if (config.hasFFmpeg) avail.push('Loudness (FFmpeg)');
      if (config.hasMAEST) avail.push('Auto-Tagging (MAEST)');
      setAvailability(avail);
    }).catch(() => { });
  }, []);

  // Auto-initialize MongoDB on app startup
  React.useEffect(() => {
    const initMongoDB = async () => {
      try {
        const result = await window.electronAPI.mongodb('mongodb:initialize', {});
        if (result.success) {
          console.log('[App] MongoDB initialized on startup');
        } else {
          console.warn('[App] MongoDB initialization failed:', result.message);
        }
      } catch (err) {
        console.error('[App] Error initializing MongoDB:', err);
      }
    };
    initMongoDB();
  }, []);

  // Fetch app version on startup
  React.useEffect(() => {
    const fetchVersion = async () => {
      try {
        const version = await window.electronAPI.getVersion();
        setAppVersion(version);
      } catch (err) {
        console.error('[App] Error fetching version:', err);
      }
    };
    fetchVersion();
  }, []);

  // Auto-watch: when file detected, start analysis if idle
  React.useEffect(() => {
    const removeDetected = window.electronAPI.onFileDetected(async (fileInfo) => {
      try {
        // Show that we picked up the file
        const fileWithAutoFlag = { ...fileInfo, autoDetected: true };
        setSelectedFile(fileWithAutoFlag);
        setError(null);
        setAnalysisResults(null);
        // Trigger auto analysis if not currently analyzing
        if (!isAnalyzing) {
          setIsAnalyzing(true);
          setProgress({ percent: 0, message: 'Starting analysis...' });

          // Set up progress listener for auto-analysis
          const removeProgressListener = window.electronAPI.onProgress((progressData) => {
            console.log('[App] Auto-analysis progress:', progressData);
            setProgress(progressData);
          });

          const result = await window.electronAPI.startAutoAnalysis(fileInfo.path);
          removeProgressListener();

          if (result?.success) {
            handleAnalysisComplete(result.data, fileWithAutoFlag, {
              sourceType: isMainstream ? 'mainstream' : 'independent'
            });
          } else if (result?.canceled) {
            // Cancelled gracefully
            setIsAnalyzing(false);
            setProgress({ percent: 0, message: '' });
          } else {
            handleAnalysisError(new Error(result?.error || 'Auto-analysis failed'));
          }
        }
      } catch (err) {
        handleAnalysisError(err);
      }
    });
    return () => {
      if (typeof removeDetected === 'function') removeDetected();
    };
  }, [isAnalyzing, isMainstream, handleAnalysisComplete, handleAnalysisError]);

  const handleScoreRecord = (record) => {
    console.log('[App] Scoring record:', record);
    setRecordToScore(record);
    setActiveMode('ferm');
  };

  const handleScoreComplete = (updatedRecord) => {
    console.log('[App] Score complete:', updatedRecord);
    setRecordToScore(null);
    // Switch back to FERM Faves tab and auto-switch to leaderboard
    setShouldSwitchToLeaderboard(true);
    setActiveMode('faves');
  };

  const handleBackToQueue = () => {
    console.log('[App] Back to queue');
    setRecordToScore(null);
    setActiveMode('faves');
  };

  return (
    <AudioPlayerProvider>
      <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-gray-800 via-gray-900 to-black text-gray-100">
        <div className="w-full mx-auto px-6 lg:px-12 py-8 max-w-[96%] xl:max-w-[1800px]">
          <header className="mb-8">
            <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-500 to-cyan-400 drop-shadow-md mb-2 flex items-center gap-3">
              FERM Audio Analysis
              {appVersion && (
                <span className="text-sm font-normal text-gray-500 bg-gray-800 px-2 py-1 rounded">
                  v{appVersion}
                </span>
              )}
            </h1>
            <p className="text-gray-400">
              Analyze musicality, audio features, and genre classification with stem separation
            </p>
            <div className="mt-2">
              <WatchStatusIndicator watchPath={watchPath} />
            </div>
          </header>

          {/* Top-level mode tabs */}
          <div className="mb-6 border-b border-gray-700">
            <div className="flex gap-2 relative">
              <button
                onClick={() => setActiveMode('analysis')}
                className={`px-4 py-2 text-sm border-b-2 transition-all duration-300 hover:text-white ${activeMode === 'analysis' ? 'border-cyan-400 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
              >
                Analysis
              </button>
              <button
                onClick={() => setActiveMode('cloud')}
                className={`px-4 py-2 text-sm border-b-2 transition-all duration-300 hover:text-white ${activeMode === 'cloud' ? 'border-cyan-400 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
              >
                Cloud Storage
              </button>
              <button
                onClick={() => setActiveMode('reports')}
                className={`px-4 py-2 text-sm border-b-2 transition-all duration-300 hover:text-white ${activeMode === 'reports' ? 'border-cyan-400 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
              >
                Reports
              </button>
              <button
                onClick={() => setActiveMode('training')}
                className={`px-4 py-2 text-sm border-b-2 transition-all duration-300 hover:text-white ${activeMode === 'training' ? 'border-cyan-400 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'border-transparent text-gray-400 hover:text-gray-300'
                  }`}
              >
                AI Training
              </button>

              {/* More Tab */}
              <div className="relative">
                <button
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  className={`px-4 py-2 text-sm border-b-2 transition-all duration-300 hover:text-white flex items-center gap-1 ${['ferm', 'faves', 'settings'].includes(activeMode)
                    ? 'border-cyan-400 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                >
                  More
                  <svg className={`w-4 h-4 transition-transform ${showMoreMenu ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showMoreMenu && (
                  <div className="absolute top-full left-0 mt-1 w-48 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1">
                    <button
                      onClick={() => {
                        setActiveMode('ferm');
                        setShowMoreMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 ${activeMode === 'ferm' ? 'text-primary-400' : 'text-gray-300'}`}
                    >
                      FERM Factor
                    </button>
                    <button
                      onClick={() => {
                        setActiveMode('faves');
                        setShowMoreMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 ${activeMode === 'faves' ? 'text-primary-400' : 'text-gray-300'}`}
                    >
                      FERM Faves
                    </button>
                    <div className="border-t border-gray-700 my-1"></div>
                    <button
                      onClick={() => {
                        setActiveMode('settings');
                        setShowMoreMenu(false);
                      }}
                      className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-700 ${activeMode === 'settings' ? 'text-primary-400' : 'text-gray-300'}`}
                    >
                      Settings
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {activeMode === 'cloud' ? (
            <div className="space-y-6">
              <CloudStoragePanel
                onSelectItem={(record) => {
                  const results = reconstructResultsFromRecord(record);
                  setSelectedFile({ path: '', name: record.clipName });
                  setAnalysisResults(results);
                  setActiveMode('analysis');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
              />
            </div>
          ) : activeMode === 'faves' ? (
            <div className="space-y-6">
              <FERMFavesTab
                onScoreRecord={handleScoreRecord}
                autoSwitchToLeaderboard={shouldSwitchToLeaderboard}
                onSwitchComplete={() => setShouldSwitchToLeaderboard(false)}
              />
            </div>
          ) : activeMode === 'reports' ? (
            <div className="space-y-6">
              <ReportGeneratorPanel />
            </div>
          ) : activeMode === 'settings' ? (
            <div className="space-y-6">
              <Settings />
            </div>
          ) : activeMode === 'training' ? (
            <div className="space-y-6">
              <TrainingView />
            </div>
          ) : (
            <div className="space-y-6">
              {activeMode === 'analysis' && (
                <>
                  {/* Awaiting file header and toggle */}
                  <div className="bg-gray-800/60 backdrop-blur-md rounded-2xl p-6 border border-gray-600/50 shadow-[0_0_15px_rgba(56,189,248,0.15)] ring-1 ring-white/5 transition-all hover:border-cyan-500/50 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-gray-400">Awaiting file at</div>
                        <div className="text-gray-200 text-sm truncate max-w-xl" title={watchPath || 'Not set'}>
                          {watchPath || '—'}
                        </div>
                        {availability.length > 0 && (
                          <div className="text-xs text-gray-500 mt-2">
                            Checks complete: {availability.join(', ')}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setShowHistory(true)}
                          className="text-sm text-primary-400 hover:text-primary-300 flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          History
                        </button>
                        <label className="flex items-center gap-3 cursor-pointer">
                          <span className="text-sm text-gray-300">Select File</span>
                          <input
                            type="checkbox"
                            checked={showFileSelector}
                            onChange={() => setShowFileSelector(v => !v)}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
                          />
                        </label>
                      </div>
                    </div>
                    <div className="mt-4 p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg">
                      <label className="flex items-center gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isMainstream}
                          onChange={() => setIsMainstream(!isMainstream)}
                          disabled={isAnalyzing}
                          className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-amber-600 focus:ring-2 focus:ring-amber-500"
                        />
                        <div>
                          <span className="text-sm font-medium text-amber-300">Mainstream / Reference Track</span>
                          <p className="text-xs text-gray-400 mt-1">
                            Mark the next analyzed track as mainstream/reference. Default is independent.
                          </p>
                        </div>
                      </label>
                    </div>
                  </div>

                  {showFileSelector && (
                    <FileUpload
                      onFileSelect={handleFileSelect}
                      disabled={isAnalyzing}
                    />
                  )}

                  {error && (
                    <div className="card bg-red-900/20 border-red-500">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg className="w-6 h-6 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-lg font-semibold text-red-400 mb-2">Analysis Error</h3>
                          <p className="text-red-200 mb-4">{error}</p>
                          <details className="text-sm">
                            <summary className="cursor-pointer text-red-300 hover:text-red-200">Troubleshooting Tips</summary>
                            <div className="mt-2 space-y-2 text-gray-300">
                              <p>• Make sure Sonic Annotator and Vamp plugins are installed</p>
                              <p>• Check that config/windows.env has correct paths</p>
                              <p>• Verify VAMP_PATH environment variable is set</p>
                              <p>• See README.md for installation instructions</p>
                            </div>
                          </details>
                        </div>
                        <button
                          onClick={() => setError(null)}
                          className="flex-shrink-0 text-gray-400 hover:text-gray-300"
                        >
                          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {showFileSelector && selectedFile && (
                    <>
                      <AnalysisControls
                        audioFile={selectedFile}
                        disabled={isAnalyzing}
                        onAnalysisStart={handleAnalysisStart}
                        onAnalysisComplete={handleAnalysisComplete}
                        onAnalysisError={handleAnalysisError}
                        onProgressUpdate={setProgress}
                        isMainstream={isMainstream}
                      />
                    </>
                  )}

                  {/* Always show progress if analyzing, regardless of Select File toggle */}
                  {isAnalyzing && (
                    <ProgressPanel progress={progress} />
                  )}

                  {/* Show results whenever available, even if Select File is off (e.g., from History) */}
                  {analysisResults && !isAnalyzing && (
                    <ResultsView results={analysisResults} audioFile={selectedFile} />
                  )}
                  {/* History Modal */}
                  {showHistory && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                      <div className="bg-gray-800 rounded-xl shadow-2xl border border-gray-700 w-full max-w-md max-h-[80vh] flex flex-col">
                        <div className="flex items-center justify-between p-4 border-b border-gray-700">
                          <h3 className="text-lg font-bold text-gray-100">Analysis History</h3>
                          <button
                            onClick={() => setShowHistory(false)}
                            className="text-gray-400 hover:text-gray-200"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                        <div className="flex-1 overflow-y-auto p-4">
                          <AnalysisHistory
                            activeId={activeHistoryId}
                            refreshToken={historyRefreshToken}
                            onSelectItem={(item) => {
                              setSelectedFile({ path: item.filePath, name: item.fileName });
                              setAnalysisResults(item.results);
                              setActiveHistoryId(item.id);
                              try { sessionStorage.setItem('activeHistoryId', String(item.id)); } catch (_) { }
                              setActiveMode('analysis');
                              setShowHistory(false);
                            }}
                            onExportItem={async (item) => {
                              await window.electronAPI.exportJson(item.results);
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {activeMode === 'ferm' && (
                <FERMFactor
                  recordToScore={recordToScore}
                  onScoreComplete={handleScoreComplete}
                  onBackToQueue={handleBackToQueue}
                />
              )}
            </div>
          )}
        </div>
      </div>
    </AudioPlayerProvider>
  );
}

export default App;
