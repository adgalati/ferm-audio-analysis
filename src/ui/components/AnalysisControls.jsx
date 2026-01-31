import React, { useState, useEffect } from 'react';
import { Play, Activity, Music2, AudioWaveform, Sparkles, BarChart3, Waves, FileText } from 'lucide-react';

function AnalysisControls({
  audioFile,
  disabled,
  onAnalysisStart,
  onAnalysisComplete,
  onAnalysisError,
  onProgressUpdate,
  isMainstream = false
}) {
  const [selectedAnalyses, setSelectedAnalyses] = useState({
    rhythm: true,
    harmony: true,
    melody: true,
    spectral: true,
    spatial: true,
    timbre: false,
    autotagging: false,
    loudness: false,
  });
  const [hasOpenSmile, setHasOpenSmile] = useState(false);
  const [useStems, setUseStems] = useState(false);
  const [hasDemucs, setHasDemucs] = useState(false);
  const [hasFFmpeg, setHasFFmpeg] = useState(false);
  const [hasMAEST, setHasMAEST] = useState(false);

  useEffect(() => {
    // Check if openSMILE, Demucs, FFmpeg, and MAEST are configured on mount
    window.electronAPI.checkConfig().then(config => {
      setHasOpenSmile(!!config.hasOpenSmile);
      setHasDemucs(!!config.hasDemucs);
      setHasFFmpeg(!!config.hasFFmpeg);
      setHasMAEST(!!config.hasMAEST);
      // Surface watch path to header via custom event
      if (config.watchPath) {
        const evt = new CustomEvent('watch-path', { detail: { watchPath: config.watchPath } });
        window.dispatchEvent(evt);
      }
      // Emit an initial progress/check state so UI can show availability before file selection
      const availability = [];
      if (config.hasOpenSmile) availability.push('Timbre (openSMILE)');
      if (config.hasFFmpeg) availability.push('Loudness (FFmpeg)');
      if (config.hasMAEST) availability.push('Auto-Tagging (MAEST)');
      window.dispatchEvent(new CustomEvent('analysis-availability', { detail: { availability } }));
    });
  }, []);

  const runAnalysis = async (analyses) => {
    console.log('[AnalysisControls] Starting analysis:', { audioFile, analyses });

    if (!audioFile) {
      console.error('[AnalysisControls] No audio file selected');
      return;
    }

    onAnalysisStart();

    // Listen for progress updates
    const removeListener = window.electronAPI.onProgress((progress) => {
      console.log('[AnalysisControls] Progress update:', progress);
      onProgressUpdate(progress);
    });

    try {
      console.log('[AnalysisControls] Calling electronAPI.runAnalysis...');
      const result = await window.electronAPI.runAnalysis({
        audioPath: audioFile.path,
        analyses,
        enableSmile: analyses.includes('timbre'),
        useStems,
      });

      console.log('[AnalysisControls] Analysis result:', result);
      removeListener();

      if (result.success) {
        console.log('[AnalysisControls] Analysis successful!');
        onAnalysisComplete(result.data, audioFile, {
          sourceType: isMainstream ? 'mainstream' : 'independent'
        });
      } else if (result.canceled) {
        console.log('[AnalysisControls] Analysis was cancelled by user');
        onProgressUpdate({ percent: 0, message: '' });
        // Let App handle clearing UI state via onAnalysisError with AbortError-like message
        onAnalysisError(Object.assign(new Error('Analysis canceled'), { name: 'AbortError' }));
      } else {
        console.error('[AnalysisControls] Analysis failed:', result.error);
        onAnalysisError(new Error(result.error));
      }
    } catch (error) {
      console.error('[AnalysisControls] Analysis error:', error);
      removeListener();
      onAnalysisError(error);
    }
  };

  const handleAnalyzeAll = () => {
    // Note: 'melody' excluded from Analyze All for performance - available via manual selection
    const allAnalyses = ['rhythm', 'harmony', 'spectral'];
    if (hasOpenSmile) allAnalyses.push('timbre');
    if (hasMAEST) allAnalyses.push('autotagging');
    if (hasFFmpeg) {
      allAnalyses.push('loudness');
      allAnalyses.push('spatial');
    }
    runAnalysis(allAnalyses);
  };

  const handleFullAnalysis = async () => {
    console.log('[AnalysisControls] Starting Full Analysis & Report...');

    // If no audio file is loaded, prompt user to select one
    let targetFile = audioFile;
    if (!targetFile) {
      const selected = await window.electronAPI.selectFile();
      if (!selected) {
        console.log('[AnalysisControls] File selection cancelled');
        return;
      }
      targetFile = selected;
    }

    onAnalysisStart();

    // Listen for progress updates
    const removeListener = window.electronAPI.onProgress((progress) => {
      console.log('[AnalysisControls] Progress update:', progress);
      onProgressUpdate(progress);
    });

    try {
      console.log('[AnalysisControls] Calling electronAPI.runFullAnalysis...');
      const result = await window.electronAPI.runFullAnalysis(targetFile.path);

      console.log('[AnalysisControls] Full analysis result:', result);
      removeListener();

      if (result.success) {
        console.log('[AnalysisControls] Full analysis successful!');
        console.log('[AnalysisControls] Report saved to:', result.report?.path);
        onAnalysisComplete(result.data, targetFile, {
          sourceType: isMainstream ? 'mainstream' : 'independent',
          reportPath: result.report?.path
        });
      } else if (result.canceled) {
        console.log('[AnalysisControls] Full analysis was cancelled by user');
        onProgressUpdate({ percent: 0, message: '' });
        onAnalysisError(Object.assign(new Error('Analysis canceled'), { name: 'AbortError' }));
      } else {
        console.error('[AnalysisControls] Full analysis failed:', result.error);
        onAnalysisError(new Error(result.error));
      }
    } catch (error) {
      console.error('[AnalysisControls] Full analysis error:', error);
      removeListener();
      onAnalysisError(error);
    }
  };

  const handleIndividualAnalysis = (type) => {
    runAnalysis([type]);
  };

  const handleRunSelected = () => {
    const analyses = Object.entries(selectedAnalyses)
      .filter(([_, enabled]) => enabled)
      .map(([type, _]) => type);

    if (analyses.length > 0) {
      runAnalysis(analyses);
    }
  };

  const toggleAnalysis = (type) => {
    setSelectedAnalyses(prev => ({
      ...prev,
      [type]: !prev[type]
    }));
  };

  return (
    <div className="card">
      <h2 className="text-2xl font-semibold mb-6">Analysis Options</h2>

      {/* Full Analysis & Report Button */}
      <div className="mb-6">
        <button
          className="btn-primary w-full py-4 text-lg flex items-center justify-center gap-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500"
          onClick={handleFullAnalysis}
          disabled={disabled}
        >
          <FileText className="w-6 h-6" />
          Full Analysis & Report
        </button>
        <p className="text-xs text-gray-500 mt-2 text-center">
          Comprehensive analysis with all tools (Rhythm, Harmony, Melody, Spectral, Timbre, Loudness, Spatial, Auto-Tagging).
          Generates a structured JSON report for LLM mixing advice.
        </p>
      </div>

      <div className="border-t border-gray-700 pt-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Individual Analysis</h3>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <button
            className="btn-secondary py-3 flex items-center justify-center gap-2"
            onClick={() => handleIndividualAnalysis('rhythm')}
            disabled={disabled}
          >
            <Activity className="w-5 h-5" />
            Rhythm
          </button>

          <button
            className="btn-secondary py-3 flex items-center justify-center gap-2"
            onClick={() => handleIndividualAnalysis('harmony')}
            disabled={disabled}
          >
            <Music2 className="w-5 h-5" />
            Harmony
          </button>

          <button
            className="btn-secondary py-3 flex items-center justify-center gap-2"
            onClick={() => handleIndividualAnalysis('melody')}
            disabled={disabled}
          >
            <AudioWaveform className="w-5 h-5" />
            Melody
          </button>

          <button
            className="btn-secondary py-3 flex items-center justify-center gap-2"
            onClick={() => handleIndividualAnalysis('spectral')}
            disabled={disabled}
          >
            <BarChart3 className="w-5 h-5" />
            Spectral
          </button>

          {hasFFmpeg && (
            <button
              className="btn-secondary py-3 flex items-center justify-center gap-2"
              onClick={() => handleIndividualAnalysis('spatial')}
              disabled={disabled}
            >
              <Waves className="w-5 h-5" />
              Spatial
            </button>
          )}

          {hasOpenSmile && (
            <button
              className="btn-secondary py-3 flex items-center justify-center gap-2"
              onClick={() => handleIndividualAnalysis('timbre')}
              disabled={disabled}
            >
              <Sparkles className="w-5 h-5" />
              Timbre
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-gray-700 pt-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">Custom Selection</h3>

        {hasDemucs && (
          <div className="mb-4 p-4 bg-blue-900/20 border border-blue-700/50 rounded-lg">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={useStems}
                onChange={() => setUseStems(!useStems)}
                disabled={disabled}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
              />
              <div>
                <span className="text-sm font-medium text-blue-300">Use Demucs stem separation</span>
                <p className="text-xs text-gray-400 mt-1">
                  Separate vocals/instrumental for more accurate analysis. Uses instrumental for rhythm/harmony, vocals for melody/onsets.
                </p>
              </div>
            </label>
          </div>
        )}

        <div className="space-y-3 mb-4">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAnalyses.rhythm}
              onChange={() => toggleAnalysis('rhythm')}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm">Rhythm Analysis (beats, tempo, onsets)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAnalyses.harmony}
              onChange={() => toggleAnalysis('harmony')}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm">Harmony Analysis (chords, key)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAnalyses.melody}
              onChange={() => toggleAnalysis('melody')}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm">Melody Analysis (pitch contour)</span>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={selectedAnalyses.spectral}
              onChange={() => toggleAnalysis('spectral')}
              disabled={disabled}
              className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
            />
            <span className="text-sm">Spectral Balance (tonal fit & genre targets)</span>
          </label>

          {hasFFmpeg && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAnalyses.spatial}
                onChange={() => toggleAnalysis('spatial')}
                disabled={disabled}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm">Spatial Analysis (stereo width & phase)</span>
            </label>
          )}

          {hasOpenSmile && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAnalyses.timbre}
                onChange={() => toggleAnalysis('timbre')}
                disabled={disabled}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm">Timbral Analysis (openSMILE eGeMAPS)</span>
            </label>
          )}

          {hasMAEST && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAnalyses.autotagging}
                onChange={() => toggleAnalysis('autotagging')}
                disabled={disabled}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm">Auto-Tagging (MAEST genre/style classification)</span>
            </label>
          )}

          {hasFFmpeg && (
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedAnalyses.loudness}
                onChange={() => toggleAnalysis('loudness')}
                disabled={disabled}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-600 focus:ring-2 focus:ring-primary-500"
              />
              <span className="text-sm">Loudness Analysis (FFmpeg EBU R128)</span>
            </label>
          )}
        </div>

        <button
          className="btn-primary w-full py-3"
          onClick={handleRunSelected}
          disabled={disabled || !Object.values(selectedAnalyses).some(v => v)}
        >
          Run Selected Analyses
        </button>
      </div>
    </div>
  );
}

export default AnalysisControls;
