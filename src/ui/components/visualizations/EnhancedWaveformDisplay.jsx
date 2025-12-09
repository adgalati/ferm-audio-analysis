import React, { useEffect, useRef, useState, useCallback } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';

function EnhancedWaveformDisplay({ 
  audioFile, 
  analysisData = {},
  onTimeUpdate = () => {},
  onPlaybackStateChange = () => {}
}) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [showOverlays, setShowOverlays] = useState({
    beats: true,
    melody: true,
    onsets: true,
    chords: true,
    timingIssues: true
  });

  // Extract analysis data
  const { 
    rhythm = {}, 
    melody = {}, 
    harmony = {}, 
    scores = {},
    loudness = {}
  } = analysisData;

  const beats = rhythm.beats || [];
  const downbeats = rhythm.downbeats || [];
  const onsets = analysisData.onsets || [];
  const chords = harmony.chords || [];
  const melodyData = melody.f0_hz || [];
  const melodyTimes = melody.times || [];
  const timingData = scores.timing || {};

  // Initialize WaveSurfer
  useEffect(() => {
    if (!audioFile || !waveformRef.current) return;

    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: '#4b5563',
      progressColor: '#8b5cf6',
      cursorColor: '#a78bfa',
      barWidth: 2,
      barRadius: 3,
      cursorWidth: 2,
      height: 128,
      barGap: 2,
      backend: 'WebAudio',
      normalize: true,
      responsive: true
    });

    const load = async () => {
      try {
        const res = await window.electronAPI.readAudioAsDataUrl(audioFile.path);
        if (res?.success) {
          wavesurfer.load(res.dataUrl);
        } else {
          wavesurfer.load(audioFile.path);
        }
      } catch (_) {
        wavesurfer.load(audioFile.path);
      }
    };

    load();

    // Event listeners
    wavesurfer.on('play', () => {
      setIsPlaying(true);
      onPlaybackStateChange({ isPlaying: true });
    });

    wavesurfer.on('pause', () => {
      setIsPlaying(false);
      onPlaybackStateChange({ isPlaying: false });
    });

    wavesurfer.on('timeupdate', (time) => {
      setCurrentTime(time);
      onTimeUpdate(time);
    });

    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
    });

    wavesurfer.on('seek', (time) => {
      setCurrentTime(time);
      onTimeUpdate(time);
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioFile, onTimeUpdate, onPlaybackStateChange]);

  // Update volume
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Render overlays
  useEffect(() => {
    if (!wavesurferRef.current || !waveformRef.current || !duration) return;

    // Clear existing overlays
    const existingOverlays = waveformRef.current.querySelectorAll('.analysis-overlay');
    existingOverlays.forEach(overlay => overlay.remove());

    // Add beat markers
    if (showOverlays.beats) {
      beats.forEach(time => {
        const percent = (time / duration) * 100;
        const marker = document.createElement('div');
        marker.className = 'analysis-overlay beat-marker';
        marker.style.cssText = `
          position: absolute;
          left: ${percent}%;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(139, 92, 246, 0.3);
          pointer-events: none;
          z-index: 10;
        `;
        waveformRef.current.appendChild(marker);
      });

      // Add downbeat markers
      downbeats.forEach(time => {
        const percent = (time / duration) * 100;
        const marker = document.createElement('div');
        marker.className = 'analysis-overlay downbeat-marker';
        marker.style.cssText = `
          position: absolute;
          left: ${percent}%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(139, 92, 246, 0.6);
          pointer-events: none;
          z-index: 10;
        `;
        waveformRef.current.appendChild(marker);
      });
    }

    // Add onset markers
    if (showOverlays.onsets) {
      onsets.forEach(time => {
        const percent = (time / duration) * 100;
        const marker = document.createElement('div');
        marker.className = 'analysis-overlay onset-marker';
        marker.style.cssText = `
          position: absolute;
          left: ${percent}%;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(34, 197, 94, 0.4);
          pointer-events: none;
          z-index: 10;
        `;
        waveformRef.current.appendChild(marker);
      });
    }

    // Add chord markers
    if (showOverlays.chords && chords.length > 0) {
      chords.forEach(chord => {
        const startPercent = (chord.start / duration) * 100;
        const endPercent = ((chord.end || chord.start + 1) / duration) * 100;
        const width = endPercent - startPercent;
        
        const marker = document.createElement('div');
        marker.className = 'analysis-overlay chord-marker';
        marker.style.cssText = `
          position: absolute;
          left: ${startPercent}%;
          top: 0;
          bottom: 0;
          width: ${width}%;
          background: rgba(59, 130, 246, 0.1);
          border-left: 2px solid rgba(59, 130, 246, 0.6);
          pointer-events: none;
          z-index: 5;
        `;
        marker.title = `${chord.label} (${chord.start.toFixed(1)}s - ${(chord.end || chord.start + 1).toFixed(1)}s)`;
        waveformRef.current.appendChild(marker);
      });
    }

    // Add melody overlay
    if (showOverlays.melody && melodyData.length > 0) {
      const melodyOverlay = document.createElement('div');
      melodyOverlay.className = 'analysis-overlay melody-overlay';
      melodyOverlay.style.cssText = `
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        pointer-events: none;
        z-index: 8;
      `;

      // Create SVG for melody line
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.style.cssText = 'width: 100%; height: 100%; position: absolute; top: 0; left: 0;';
      
      // Filter voiced segments and create path
      const voicedPoints = [];
      for (let i = 0; i < melodyTimes.length; i++) {
        if (melodyData[i] > 0) {
          const x = (melodyTimes[i] / duration) * 100;
          const y = 50 + (Math.log2(melodyData[i] / 440) * 10); // Convert to semitones from A4
          voicedPoints.push(`${x},${y}`);
        }
      }

      if (voicedPoints.length > 0) {
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('d', `M ${voicedPoints.join(' L ')}`);
        path.setAttribute('stroke', 'rgba(251, 191, 36, 0.8)');
        path.setAttribute('stroke-width', '2');
        path.setAttribute('fill', 'none');
        svg.appendChild(path);
      }

      melodyOverlay.appendChild(svg);
      waveformRef.current.appendChild(melodyOverlay);
    }

    // Add timing issue indicators
    if (showOverlays.timingIssues && timingData.devs_ms) {
      const deviations = timingData.devs_ms || [];
      onsets.forEach((onset, index) => {
        if (index < deviations.length) {
          const deviation = Math.abs(deviations[index]);
          if (deviation > 50) { // Highlight significant timing issues
            const percent = (onset / duration) * 100;
            const marker = document.createElement('div');
            marker.className = 'analysis-overlay timing-issue-marker';
            marker.style.cssText = `
              position: absolute;
              left: ${percent}%;
              top: 0;
              bottom: 0;
              width: 3px;
              background: ${deviation > 100 ? 'rgba(239, 68, 68, 0.6)' : 'rgba(245, 158, 11, 0.6)'};
              pointer-events: none;
              z-index: 15;
            `;
            marker.title = `Timing issue: ${deviation.toFixed(1)}ms deviation`;
            waveformRef.current.appendChild(marker);
          }
        }
      });
    }

  }, [beats, downbeats, onsets, chords, melodyData, melodyTimes, duration, showOverlays, timingData]);

  // Control functions
  const handlePlayPause = useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  const handleSeek = useCallback((time) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(time / duration);
    }
  }, [duration]);

  const handleSkipBack = useCallback(() => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, currentTime - 5);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  }, [currentTime, duration]);

  const handleSkipForward = useCallback(() => {
    if (wavesurferRef.current) {
      const newTime = Math.min(duration, currentTime + 5);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  }, [currentTime, duration]);

  const handleVolumeChange = useCallback((e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted(!isMuted);
  }, [isMuted]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Enhanced Audio Playback</h3>
        <div className="flex items-center gap-2 text-sm">
          <button
            onClick={() => setShowOverlays(prev => ({ ...prev, beats: !prev.beats }))}
            className={`px-2 py-1 rounded text-xs ${showOverlays.beats ? 'bg-purple-100 text-purple-800' : 'bg-gray-100 text-gray-600'}`}
          >
            Beats
          </button>
          <button
            onClick={() => setShowOverlays(prev => ({ ...prev, melody: !prev.melody }))}
            className={`px-2 py-1 rounded text-xs ${showOverlays.melody ? 'bg-yellow-100 text-yellow-800' : 'bg-gray-100 text-gray-600'}`}
          >
            Melody
          </button>
          <button
            onClick={() => setShowOverlays(prev => ({ ...prev, onsets: !prev.onsets }))}
            className={`px-2 py-1 rounded text-xs ${showOverlays.onsets ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
          >
            Onsets
          </button>
          <button
            onClick={() => setShowOverlays(prev => ({ ...prev, chords: !prev.chords }))}
            className={`px-2 py-1 rounded text-xs ${showOverlays.chords ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-600'}`}
          >
            Chords
          </button>
          <button
            onClick={() => setShowOverlays(prev => ({ ...prev, timingIssues: !prev.timingIssues }))}
            className={`px-2 py-1 rounded text-xs ${showOverlays.timingIssues ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-600'}`}
          >
            Issues
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div ref={waveformRef} className="relative mb-4" />
        
        {/* Progress bar */}
        <div className="mb-4">
          <input
            type="range"
            min="0"
            max={duration || 100}
            value={currentTime}
            onChange={(e) => handleSeek(parseFloat(e.target.value))}
            className="w-full h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(currentTime / duration) * 100}%, #4b5563 ${(currentTime / duration) * 100}%, #4b5563 100%)`
            }}
          />
        </div>

        {/* Controls */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={handleSkipBack}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <SkipBack className="w-5 h-5" />
            </button>
            
            <button
              onClick={handlePlayPause}
              className="btn-primary flex items-center gap-2 px-4 py-2"
            >
              {isPlaying ? (
                <>
                  <Pause className="w-4 h-4" />
                  Pause
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Play
                </>
              )}
            </button>
            
            <button
              onClick={handleSkipForward}
              className="p-2 text-gray-400 hover:text-white transition-colors"
            >
              <SkipForward className="w-5 h-5" />
            </button>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <button
                onClick={handleMuteToggle}
                className="p-1 text-gray-400 hover:text-white transition-colors"
              >
                {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                className="w-20 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
              />
            </div>
            
            <div className="text-sm text-gray-400">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex items-center gap-6 text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-purple-400/30" />
            <span>Beats</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-purple-400/60" />
            <span>Downbeats</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-green-400/40" />
            <span>Onsets</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-blue-400/60" />
            <span>Chords</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-yellow-400/80" />
            <span>Melody</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-0.5 bg-red-400/60" />
            <span>Timing Issues</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default EnhancedWaveformDisplay;
