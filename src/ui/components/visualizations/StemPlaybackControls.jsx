import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Headphones, Music, Disc3 } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

/**
 * Playback controls with stem toggle functionality
 * Supports switching between Full Mix, Vocal Stem, and Instrumental Stem
 */
function StemPlaybackControls({ 
  className = '', 
  vocalStemPath = null, 
  instrumentalStemPath = null,
  stemsUsed = false, 
  fullMixPath = null 
}) {
  const {
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    isInitialized,
    isLoading,
    audioFile,
    playPause,
    skipBack,
    skipForward,
    setVolumeLevel,
    toggleMute,
    loadAudio
  } = useAudioPlayer();

  // 'full' | 'vocals' | 'instrumental'
  const [activeMode, setActiveMode] = useState('full');

  useEffect(() => {
    if (audioFile?.path) {
      if (audioFile.path === fullMixPath) setActiveMode('full');
      else if (audioFile.path === vocalStemPath) setActiveMode('vocals');
      else if (audioFile.path === instrumentalStemPath) setActiveMode('instrumental');
    }
  }, [audioFile, fullMixPath, vocalStemPath, instrumentalStemPath]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleModeChange = async (newMode) => {
    if (newMode === activeMode) return;

    let targetPath = null;
    let targetName = '';

    switch (newMode) {
      case 'full':
        targetPath = fullMixPath;
        targetName = 'Full Mix';
        break;
      case 'vocals':
        targetPath = vocalStemPath;
        targetName = 'Vocal Stem';
        break;
      case 'instrumental':
        targetPath = instrumentalStemPath;
        targetName = 'Instrumental Stem';
        break;
      default:
        return;
    }

    if (!targetPath) {
      console.warn(`[StemPlayback] No path available for mode: ${newMode}`);
      return;
    }

    try {
      setActiveMode(newMode);
      await loadAudio({ path: targetPath, name: targetName });
    } catch (error) {
      console.error(`[StemPlayback] Failed to load ${targetName}:`, error);
      // Revert to previous mode on error
      setActiveMode(activeMode);
    }
  };

  const getModeLabel = () => {
    switch (activeMode) {
      case 'vocals': return 'Playing isolated vocals';
      case 'instrumental': return 'Playing instrumental only';
      default: return 'Playing full mix';
    }
  };

  if (!isInitialized || isLoading) {
    return (
      <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
        <div className="text-center text-gray-400 py-8">
          <p>{isLoading ? 'Loading audio...' : 'Audio player will be available after loading an audio file'}</p>
        </div>
      </div>
    );
  }

  const hasStems = stemsUsed && (vocalStemPath || instrumentalStemPath);

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      {/* Stem Mode Toggle */}
      {hasStems && (
        <div className="mb-4 flex items-center justify-center gap-2">
          {/* Full Mix Button */}
          <button
            onClick={() => handleModeChange('full')}
            className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              activeMode === 'full'
                ? 'bg-primary-600 text-white'
                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
            disabled={isLoading || !fullMixPath}
            title="Play full mix"
          >
            <Disc3 size={16} />
            Full Mix
          </button>

          {/* Vocals Button */}
          {vocalStemPath && (
            <button
              onClick={() => handleModeChange('vocals')}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeMode === 'vocals'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              disabled={isLoading}
              title="Play vocal stem only"
            >
              <Headphones size={16} />
              Vocals
            </button>
          )}

          {/* Instrumental Button */}
          {instrumentalStemPath && (
            <button
              onClick={() => handleModeChange('instrumental')}
              className={`px-3 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
                activeMode === 'instrumental'
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
              disabled={isLoading}
              title="Play instrumental stem only"
            >
              <Music size={16} />
              Instrumental
            </button>
          )}

          <span className="ml-3 text-xs text-gray-400">
            {getModeLabel()}
          </span>
        </div>
      )}

      {/* Progress bar */}
      <div className="mb-4">
        <input
          type="range"
          min="0"
          max={duration || 100}
          value={currentTime}
          onChange={(e) => {
            const newTime = parseFloat(e.target.value);
            window.dispatchEvent(new CustomEvent('seek-audio', { detail: { time: newTime } }));
          }}
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
            onClick={skipBack}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors"
            aria-label="Skip back 5 seconds"
          >
            <SkipBack size={20} />
          </button>
          <button
            onClick={playPause}
            className="p-3 rounded-full bg-primary-500 hover:bg-primary-600 transition-colors text-white"
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? <Pause size={24} /> : <Play size={24} />}
          </button>
          <button
            onClick={skipForward}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors"
            aria-label="Skip forward 5 seconds"
          >
            <SkipForward size={20} />
          </button>
        </div>

        <div className="text-sm text-gray-300 font-mono">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className="p-2 rounded-full hover:bg-gray-700 transition-colors"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={volume}
            onChange={(e) => setVolumeLevel(parseFloat(e.target.value))}
            className="w-24 h-2 bg-gray-600 rounded-lg appearance-none cursor-pointer slider"
            aria-label="Volume control"
            style={{
              background: `linear-gradient(to right, #8b5cf6 0%, #8b5cf6 ${(volume) * 100}%, #4b5563 ${(volume) * 100}%, #4b5563 100%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default StemPlaybackControls;

