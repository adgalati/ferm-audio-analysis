import React, { createContext, useContext, useRef, useState, useEffect } from 'react';
import WaveSurfer from 'wavesurfer.js';

const AudioPlayerContext = createContext();

export function AudioPlayerProvider({ children }) {
  const wavesurferRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [audioFile, setAudioFile] = useState(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Initialize WaveSurfer lazily when needed
  const initializeWaveSurfer = async () => {
    if (wavesurferRef.current) return wavesurferRef.current;

    // Create a temporary container for WaveSurfer
    const tempContainer = document.createElement('div');
    tempContainer.style.display = 'none';
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    document.body.appendChild(tempContainer);

    const wavesurfer = WaveSurfer.create({
      container: tempContainer,
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
      responsive: true,
      interact: false // Disable interaction since we're using custom controls
    });

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

    wavesurfer.on('ready', () => {
      setDuration(wavesurfer.getDuration());
      setIsInitialized(true);
      setIsLoading(false);
    });

    wavesurfer.on('error', (err) => {
      console.error('[AudioPlayer] WaveSurfer error:', err);
      setIsInitialized(false);
      setIsLoading(false);
    });

    wavesurfer.on('seek', (time) => {
      setCurrentTime(time);
    });

    wavesurferRef.current = wavesurfer;
    return wavesurfer;
  };

  // Load audio file
  const loadAudio = React.useCallback(async (file) => {
    if (!file) return;

    setIsLoading(true);
    setIsInitialized(false);
    setAudioFile(file);
    
    try {
      // Initialize WaveSurfer if not already done
      const wavesurfer = await initializeWaveSurfer();
      
      // Stop any current playback
      if (wavesurfer.isPlaying()) {
        wavesurfer.pause();
      }
      
      try {
        const res = await window.electronAPI.readAudioAsDataUrl(file.path);
        if (res?.success) {
          // Do not await; rely on 'ready'/'error' events to flip loading state
          wavesurfer.load(res.dataUrl);
        } else {
          wavesurfer.load(file.path);
        }
      } catch (loadError) {
        console.warn('[AudioPlayer] Failed to load audio via data URL, falling back to path:', loadError);
        wavesurfer.load(file.path);
      }
    } catch (error) {
      console.error('[AudioPlayer] Error loading audio:', error);
      setIsLoading(false);
    }
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
    };
  }, []);

  // Control functions
  const playPause = React.useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.playPause();
    }
  }, []);

  const seekTo = React.useCallback((time) => {
    if (wavesurferRef.current && duration > 0) {
      wavesurferRef.current.seekTo(time / duration);
    }
  }, [duration]);

  const skipBack = React.useCallback(() => {
    if (wavesurferRef.current) {
      const newTime = Math.max(0, currentTime - 5);
      seekTo(newTime);
    }
  }, [currentTime, seekTo]);

  const skipForward = React.useCallback(() => {
    if (wavesurferRef.current) {
      const newTime = Math.min(duration, currentTime + 5);
      seekTo(newTime);
    }
  }, [currentTime, duration, seekTo]);

  const setVolumeLevel = React.useCallback((newVolume) => {
    setVolume(newVolume);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? 0 : newVolume);
    }
  }, [isMuted]);

  const toggleMute = React.useCallback(() => {
    setIsMuted(!isMuted);
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(isMuted ? volume : 0);
    }
  }, [isMuted, volume]);

  const stop = React.useCallback(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.pause();
      wavesurferRef.current.seekTo(0);
    }
  }, []);

  const value = {
    // State
    isPlaying,
    currentTime,
    duration,
    volume,
    isMuted,
    audioFile,
    isInitialized,
    isLoading,
    
    // Actions
    loadAudio,
    playPause,
    seekTo,
    skipBack,
    skipForward,
    setVolumeLevel,
    toggleMute,
    stop,
    
    // WaveSurfer instance (for advanced usage)
    wavesurfer: wavesurferRef.current
  };

  return (
    <AudioPlayerContext.Provider value={value}>
      {children}
    </AudioPlayerContext.Provider>
  );
}

export function useAudioPlayer() {
  const context = useContext(AudioPlayerContext);
  if (!context) {
    throw new Error('useAudioPlayer must be used within an AudioPlayerProvider');
  }
  return context;
}
