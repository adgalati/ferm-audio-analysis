import React, { useState, useEffect } from 'react';
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, Headphones } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

function VocalStemPlaybackControls({ className = '', vocalStemPath = null, stemsUsed = false, fullMixPath = null }) {
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

  const [isVocalStemMode, setIsVocalStemMode] = useState(false);

  useEffect(() => {
    if (audioFile?.path) {
      if (audioFile.path === vocalStemPath) setIsVocalStemMode(true);
      else if (audioFile.path === fullMixPath) setIsVocalStemMode(false);
    }
  }, [audioFile, vocalStemPath, fullMixPath]);

  const formatTime = (time) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleStemToggle = async () => {
    if (!vocalStemPath) return;

    if (isVocalStemMode) {
      // Switch back to full mix
      setIsVocalStemMode(false);
      try {
        const targetPath = fullMixPath;
        if (targetPath) {
          await loadAudio({ path: targetPath, name: 'Full Mix' });
        }
      } catch (error) {
        console.error('[VocalStemPlayback] Failed to load full mix:', error);
        setIsVocalStemMode(true);
      }
    } else {
      // Switch to vocal stem
      setIsVocalStemMode(true);
      try {
        await loadAudio({ path: vocalStemPath, name: 'Vocal Stem' });
      } catch (error) {
        console.error('[VocalStemPlayback] Failed to load vocal stem:', error);
        setIsVocalStemMode(false);
      }
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

  return (
    <div className={`bg-gray-800 rounded-lg p-4 border border-gray-700 ${className}`}>
      {/* Stem Mode Toggle */}
      {stemsUsed && vocalStemPath && (
        <div className="mb-4 flex items-center justify-center">
          <button
            onClick={handleStemToggle}
            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors flex items-center gap-2 ${
              isVocalStemMode
                ? 'bg-blue-600 text-white hover:bg-blue-700'
                : 'bg-gray-600 text-gray-300 hover:bg-gray-500'
            }`}
            disabled={isLoading}
          >
            <Headphones size={16} />
            {isVocalStemMode ? 'Vocal Stem' : 'Full Mix'}
          </button>
          <span className="ml-3 text-xs text-gray-400">
            {isVocalStemMode ? 'Playing isolated vocals' : 'Playing full mix'}
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

export default VocalStemPlaybackControls;
