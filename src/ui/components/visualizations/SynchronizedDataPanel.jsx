import React, { useState, useEffect, useMemo } from 'react';
import { Clock, Music, Mic2, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

function SynchronizedDataPanel({ 
  currentTime = 0, 
  analysisData = {},
  isPlaying = false 
}) {
  const [highlightedIssues, setHighlightedIssues] = useState([]);

  // Extract analysis data
  const { 
    rhythm = {}, 
    melody = {}, 
    harmony = {}, 
    scores = {},
    loudness = {},
    smile = {}
  } = analysisData;

  const beats = rhythm.beats || [];
  const downbeats = rhythm.downbeats || [];
  const onsets = analysisData.onsets || [];
  const chords = harmony.chords || [];
  const melodyData = melody.f0_hz || [];
  const melodyTimes = melody.times || [];
  const melodyConfidence = melody.confidence || [];
  const timingData = scores.timing || {};
  const vocalScores = smile?.egemaps?.scores || {};

  // Find current context data
  const currentContext = useMemo(() => {
    const context = {
      currentBeat: null,
      currentDownbeat: null,
      currentOnset: null,
      currentChord: null,
      currentMelody: null,
      timingIssues: [],
      keyIssues: [],
      vocalIssues: []
    };

    // Find current beat
    for (let i = 0; i < beats.length; i++) {
      if (beats[i] <= currentTime && (i === beats.length - 1 || beats[i + 1] > currentTime)) {
        context.currentBeat = beats[i];
        break;
      }
    }

    // Find current downbeat
    for (let i = 0; i < downbeats.length; i++) {
      if (downbeats[i] <= currentTime && (i === downbeats.length - 1 || downbeats[i + 1] > currentTime)) {
        context.currentDownbeat = downbeats[i];
        break;
      }
    }

    // Find current onset
    for (let i = 0; i < onsets.length; i++) {
      if (onsets[i] <= currentTime && (i === onsets.length - 1 || onsets[i + 1] > currentTime)) {
        context.currentOnset = onsets[i];
        break;
      }
    }

    // Find current chord
    for (let i = 0; i < chords.length; i++) {
      const chord = chords[i];
      if (chord.start <= currentTime && (chord.end || chord.start + 1) > currentTime) {
        context.currentChord = chord;
        break;
      }
    }

    // Find current melody point
    for (let i = 0; i < melodyTimes.length; i++) {
      if (melodyTimes[i] <= currentTime && (i === melodyTimes.length - 1 || melodyTimes[i + 1] > currentTime)) {
        if (melodyData[i] > 0) {
          context.currentMelody = {
            frequency: melodyData[i],
            confidence: melodyConfidence[i] || 0,
            time: melodyTimes[i]
          };
        }
        break;
      }
    }

    // Check for timing issues near current time
    if (timingData.devs_ms) {
      const deviations = timingData.devs_ms;
      for (let i = 0; i < onsets.length; i++) {
        const onset = onsets[i];
        if (Math.abs(onset - currentTime) < 0.5 && i < deviations.length) {
          const deviation = Math.abs(deviations[i]);
          if (deviation > 50) {
            context.timingIssues.push({
              type: 'timing',
              severity: deviation > 100 ? 'high' : 'medium',
              message: `${deviation.toFixed(1)}ms deviation`,
              time: onset
            });
          }
        }
      }
    }

    // Check for key issues (simplified - would need more sophisticated analysis)
    if (context.currentMelody && context.currentChord) {
      // Simple key check - in a real implementation, this would be more sophisticated
      const melodyFreq = context.currentMelody.frequency;
      const chordRoot = context.currentChord.label; // This would need parsing
      
      // Placeholder for key analysis
      if (context.currentMelody.confidence < 0.3) {
        context.keyIssues.push({
          type: 'key',
          severity: 'medium',
          message: 'Low pitch confidence',
          time: currentTime
        });
      }
    }

    // Check for vocal quality issues
    if (vocalScores.pitch_stability !== null && vocalScores.pitch_stability < 40) {
      context.vocalIssues.push({
        type: 'vocal',
        severity: 'medium',
        message: 'Poor pitch stability',
        metric: 'pitch_stability',
        score: vocalScores.pitch_stability
      });
    }

    if (vocalScores.dynamic_control !== null && vocalScores.dynamic_control < 40) {
      context.vocalIssues.push({
        type: 'vocal',
        severity: 'medium',
        message: 'Poor dynamic control',
        metric: 'dynamic_control',
        score: vocalScores.dynamic_control
      });
    }

    return context;
  }, [currentTime, beats, downbeats, onsets, chords, melodyData, melodyTimes, melodyConfidence, timingData, vocalScores]);

  // Update highlighted issues when context changes
  useEffect(() => {
    const issues = [
      ...currentContext.timingIssues,
      ...currentContext.keyIssues,
      ...currentContext.vocalIssues
    ];
    setHighlightedIssues(issues);
  }, [currentContext]);

  const formatFrequency = (freq) => {
    if (freq < 1000) {
      return `${freq.toFixed(1)} Hz`;
    }
    return `${(freq / 1000).toFixed(1)} kHz`;
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-400';
      case 'medium': return 'text-yellow-400';
      case 'low': return 'text-blue-400';
      default: return 'text-gray-400';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return <XCircle className="w-4 h-4" />;
      case 'medium': return <AlertTriangle className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <Clock className="w-4 h-4" />;
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Live Analysis Data</h3>
        <div className={`px-2 py-1 rounded text-xs ${isPlaying ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
          {isPlaying ? 'Playing' : 'Paused'}
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
        {/* Current Context */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Rhythm Context
            </h4>
            <div className="text-xs space-y-1">
              {currentContext.currentBeat !== null && (
                <div className="text-gray-400">
                  Beat: {currentContext.currentBeat.toFixed(2)}s
                </div>
              )}
              {currentContext.currentDownbeat !== null && (
                <div className="text-gray-400">
                  Downbeat: {currentContext.currentDownbeat.toFixed(2)}s
                </div>
              )}
              {currentContext.currentOnset !== null && (
                <div className="text-gray-400">
                  Onset: {currentContext.currentOnset.toFixed(2)}s
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Music className="w-4 h-4" />
              Musical Context
            </h4>
            <div className="text-xs space-y-1">
              {currentContext.currentChord && (
                <div className="text-gray-400">
                  Chord: {currentContext.currentChord.label}
                </div>
              )}
              {currentContext.currentMelody && (
                <div className="text-gray-400">
                  Melody: {formatFrequency(currentContext.currentMelody.frequency)}
                </div>
              )}
              {currentContext.currentMelody && (
                <div className="text-gray-400">
                  Confidence: {(currentContext.currentMelody.confidence * 100).toFixed(1)}%
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Issues Panel */}
        {highlightedIssues.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Current Issues
            </h4>
            <div className="space-y-2">
              {highlightedIssues.map((issue, index) => (
                <div
                  key={index}
                  className={`flex items-center gap-2 p-2 rounded text-xs ${getSeverityColor(issue.severity)} bg-gray-700/50`}
                >
                  {getSeverityIcon(issue.severity)}
                  <span>{issue.message}</span>
                  {issue.score !== undefined && (
                    <span className="text-gray-500">({issue.score})</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Performance Metrics */}
        <div className="space-y-2">
          <h4 className="text-sm font-medium text-gray-300 flex items-center gap-2">
            <Mic2 className="w-4 h-4" />
            Performance Metrics
          </h4>
          <div className="grid grid-cols-2 gap-4 text-xs">
            {timingData.mate_ms !== undefined && (
              <div className="space-y-1">
                <div className="text-gray-400">Timing Accuracy</div>
                <div className={`font-medium ${timingData.mate_ms < 50 ? 'text-green-400' : timingData.mate_ms < 100 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {timingData.mate_ms.toFixed(1)}ms
                </div>
              </div>
            )}
            
            {timingData.bias_ms !== undefined && (
              <div className="space-y-1">
                <div className="text-gray-400">Timing Bias</div>
                <div className={`font-medium ${Math.abs(timingData.bias_ms) < 20 ? 'text-green-400' : Math.abs(timingData.bias_ms) < 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {timingData.bias_ms > 0 ? '+' : ''}{timingData.bias_ms.toFixed(1)}ms
                </div>
              </div>
            )}

            {vocalScores.pitch_stability !== null && (
              <div className="space-y-1">
                <div className="text-gray-400">Pitch Stability</div>
                <div className={`font-medium ${vocalScores.pitch_stability >= 80 ? 'text-green-400' : vocalScores.pitch_stability >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {vocalScores.pitch_stability}
                </div>
              </div>
            )}

            {vocalScores.dynamic_control !== null && (
              <div className="space-y-1">
                <div className="text-gray-400">Dynamic Control</div>
                <div className={`font-medium ${vocalScores.dynamic_control >= 80 ? 'text-green-400' : vocalScores.dynamic_control >= 60 ? 'text-yellow-400' : 'text-red-400'}`}>
                  {vocalScores.dynamic_control}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tempo Information */}
        {rhythm.tempo_bpm && (
          <div className="space-y-2">
            <h4 className="text-sm font-medium text-gray-300">Tempo</h4>
            <div className="text-xs text-gray-400">
              {rhythm.tempo_bpm.toFixed(1)} BPM
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default SynchronizedDataPanel;
