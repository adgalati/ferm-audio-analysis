import React, { useEffect, useRef, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import { getGenreColorHex, getGenreColorWithAlpha } from '../../utils/genreColors';

function GenreWaveformOverlay({ audioFile, tags = [], duration = 0 }) {
  const waveformRef = useRef(null);
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);

  if (!tags || tags.length === 0) {
    return (
      <div className="text-gray-400 text-center py-12">
        <div className="w-32 h-16 mx-auto mb-4 bg-gray-700 rounded flex items-center justify-center">
          <span className="text-gray-500 text-sm">No waveform</span>
        </div>
        <p>No genre tags available for waveform visualization</p>
      </div>
    );
  }

  // Filter and normalize tags for overlay
  const filteredTags = tags
    .filter(tag => tag.score > 0.05) // Filter low-confidence genres (< 5%)
    .slice(0, 5) // Limit to top 5 genres for overlay
    .map(tag => ({
      ...tag,
      percentage: Math.round(tag.score * 100)
    }));

  // Sort by score for consistent ordering
  filteredTags.sort((a, b) => b.score - a.score);

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
    });

    wavesurfer.on('pause', () => {
      setIsPlaying(false);
    });

    wavesurfer.on('timeupdate', (time) => {
      setCurrentTime(time);
    });

    wavesurfer.on('seek', (time) => {
      setCurrentTime(time);
    });

    wavesurferRef.current = wavesurfer;

    return () => {
      wavesurfer.destroy();
    };
  }, [audioFile]);

  // Update volume
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? 0 : volume);
    }
  }, [volume, isMuted]);

  // Render genre bands overlay
  useEffect(() => {
    if (!wavesurferRef.current || !waveformRef.current || !duration) return;

    // Clear existing overlays
    const existingOverlays = waveformRef.current.querySelectorAll('.genre-overlay');
    existingOverlays.forEach(overlay => overlay.remove());

    // Add genre bands
    filteredTags.forEach((tag, index) => {
      const bandHeight = (tag.percentage / 100) * 64; // Max height of 64px (half of waveform)
      const bandTop = index * 12; // Stack bands vertically with 12px spacing
      
      const band = document.createElement('div');
      band.className = 'genre-overlay';
      band.style.cssText = `
        position: absolute;
        top: ${bandTop}px;
        left: 0;
        right: 0;
        height: ${bandHeight}px;
        background: ${getGenreColorWithAlpha(tag.genre, 0.4)};
        border-bottom: 1px solid ${getGenreColorHex(tag.genre)};
        pointer-events: none;
        z-index: 5;
        transition: opacity 0.2s ease;
      `;
      band.title = `${tag.genre}${tag.subgenre ? ` - ${tag.subgenre}` : ''}: ${tag.percentage}%`;
      waveformRef.current.appendChild(band);
    });

  }, [filteredTags, duration]);

  // Control functions
  const handlePlayPause = () => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  };

  const handleSeek = (time) => {
    if (wavesurferRef.current) {
      wavesurferRef.current.seekTo(time / duration);
    }
  };

  const handleSkipBack = () => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, currentTime - 5);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  const handleSkipForward = () => {
    if (wavesurferRef.current) {
      const newTime = Math.min(duration, currentTime + 5);
      wavesurferRef.current.seekTo(newTime / duration);
    }
  };

  const handleVolumeChange = (e) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
  };

  const handleMuteToggle = () => {
    setIsMuted(!isMuted);
  };

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-400 to-blue-400" />
          Genre Waveform
        </h3>
        <div className="text-xs text-gray-500">
          {filteredTags.length} genres overlaid
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
        <div className="mt-4 flex items-center gap-4 text-xs text-gray-400">
          <span>Genre bands:</span>
          {filteredTags.map((tag, index) => (
            <div key={index} className="flex items-center gap-1">
              <div
                className="w-3 h-1.5 rounded"
                style={{ backgroundColor: getGenreColorHex(tag.genre) }}
              />
              <span>{tag.genre}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GenreWaveformOverlay;

