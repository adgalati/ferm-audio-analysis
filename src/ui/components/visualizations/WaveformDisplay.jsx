import React, { useEffect, useRef } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

function WaveformDisplay({ audioFile, beats = [], downbeats = [] }) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = React.useState(false);
  const [dataUrl, setDataUrl] = React.useState(null);
  const cursorRef = useRef(null);
  const { currentTime } = useAudioPlayer();

  useEffect(() => {
    if (!audioFile || !waveformRef.current) return;

    // Initialize WaveSurfer
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
    });

    const load = async () => {
      try {
        const res = await window.electronAPI.readAudioAsDataUrl(audioFile.path);
        if (res?.success) {
          setDataUrl(res.dataUrl);
          wavesurfer.load(res.dataUrl);
        } else {
          // Fallback to direct path if data URL fails
          wavesurfer.load(audioFile.path);
        }
      } catch (_) {
        wavesurfer.load(audioFile.path);
      }
    };

    load();

    wavesurfer.on('play', () => setIsPlaying(true));
    wavesurfer.on('pause', () => setIsPlaying(false));
    
    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioFile]);

  // Helper to draw beat/downbeat markers when duration is known
  useEffect(() => {
    const drawMarkers = () => {
      if (!wavesurferRef.current || !waveformRef.current) return;
      const duration = wavesurferRef.current.getDuration();
      if (!duration || !isFinite(duration) || duration <= 0) return;

      const container = waveformRef.current;
      const existingMarkers = container.querySelectorAll('.beat-marker');
      existingMarkers.forEach(m => m.remove());

      beats.forEach(time => {
        const percent = Math.max(0, Math.min(100, (time / duration) * 100));
        const marker = document.createElement('div');
        marker.className = 'beat-marker';
        marker.style.cssText = `
          position: absolute;
          left: ${percent}%;
          top: 0;
          bottom: 0;
          width: 1px;
          background: rgba(139, 92, 246, 0.3);
          pointer-events: none;
        `;
        container.appendChild(marker);
      });

      downbeats.forEach(time => {
        const percent = Math.max(0, Math.min(100, (time / duration) * 100));
        const marker = document.createElement('div');
        marker.className = 'beat-marker';
        marker.style.cssText = `
          position: absolute;
          left: ${percent}%;
          top: 0;
          bottom: 0;
          width: 2px;
          background: rgba(139, 92, 246, 0.6);
          pointer-events: none;
        `;
        container.appendChild(marker);
      });
    };

    if (wavesurferRef.current) {
      const ws = wavesurferRef.current;
      if (ws.getDuration()) {
        drawMarkers();
      } else {
        const onReady = () => drawMarkers();
        ws.on('ready', onReady);
        return () => ws.un('ready', onReady);
      }
    }
  }, [beats, downbeats]);

  // Playback cursor synced to global player time
  useEffect(() => {
    if (!wavesurferRef.current || !cursorRef.current) return;
    const duration = wavesurferRef.current.getDuration();
    if (!duration || duration <= 0) return;
    const percent = Math.max(0, Math.min(100, (currentTime / duration) * 100));
    cursorRef.current.style.left = percent + '%';
  }, [currentTime]);

  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Audio Waveform with Beat Grid</h3>
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
        <div ref={waveformRef} className="relative mb-4">
          {/* playback cursor */}
          <div
            ref={cursorRef}
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              width: '2px',
              background: 'rgba(234, 179, 8, 0.9)',
              pointerEvents: 'none',
              left: '0%'
            }}
          />
        </div>
        
        <div className="flex items-center gap-4">
          <button
            onClick={handlePlayPause}
            className="btn-primary flex items-center gap-2"
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
          
          <div className="flex items-center gap-4 text-sm text-gray-400">
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-primary-400/30" />
              <span>Beats</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-0.5 bg-primary-400/60" />
              <span>Downbeats</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default WaveformDisplay;
