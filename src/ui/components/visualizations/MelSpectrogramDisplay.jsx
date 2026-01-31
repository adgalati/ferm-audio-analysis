import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, Play, Pause, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';

/**
 * MelSpectrogramDisplay - Displays a mel-spectrogram image with playback controls and zoom.
 * 
 * @param {Object} props
 * @param {Object} props.melSpectrogram - Object containing imagePath from analysis results
 * @param {Object} props.audioFile - Audio file object with path and name
 */
function MelSpectrogramDisplay({ melSpectrogram, audioFile }) {
    const [imageDataUrl, setImageDataUrl] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [zoomLevel, setZoomLevel] = useState(1);
    const [panOffset, setPanOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, offset: 0 });
    const [displayTime, setDisplayTime] = useState(0);

    const containerRef = useRef(null);
    const imageRef = useRef(null);
    const cursorRef = useRef(null);
    const animationFrameRef = useRef(null);

    const {
        currentTime,
        duration,
        isPlaying,
        playPause,
        seekTo,
        isInitialized,
        wavesurfer
    } = useAudioPlayer();

    // Load the spectrogram image
    useEffect(() => {
        if (!melSpectrogram?.imagePath) {
            setLoading(false);
            setError('No mel-spectrogram available');
            return;
        }

        const loadImage = async () => {
            try {
                setLoading(true);
                setError(null);

                const result = await window.electronAPI.readFileAsDataUrl(melSpectrogram.imagePath);

                if (result?.success && result?.dataUrl) {
                    setImageDataUrl(result.dataUrl);
                } else {
                    setError('Failed to load mel-spectrogram image');
                }
            } catch (err) {
                console.error('[MelSpectrogramDisplay] Error loading image:', err);
                setError('Error loading mel-spectrogram');
            } finally {
                setLoading(false);
            }
        };

        loadImage();
    }, [melSpectrogram?.imagePath]);

    // Reset zoom and pan when image changes
    useEffect(() => {
        setZoomLevel(1);
        setPanOffset(0);
    }, [melSpectrogram?.imagePath]);

    // Smooth cursor animation using requestAnimationFrame
    useEffect(() => {
        const updateCursor = () => {
            if (cursorRef.current && wavesurfer && duration > 0) {
                // Get current time directly from wavesurfer for real-time accuracy
                let time;
                try {
                    time = wavesurfer.getCurrentTime ? wavesurfer.getCurrentTime() : currentTime;
                } catch {
                    time = currentTime;
                }

                const percent = Math.max(0, Math.min(100, (time / duration) * 100));
                cursorRef.current.style.left = `${percent}%`;
                setDisplayTime(time);
            }

            if (isPlaying) {
                animationFrameRef.current = requestAnimationFrame(updateCursor);
            }
        };

        if (isPlaying && isInitialized) {
            animationFrameRef.current = requestAnimationFrame(updateCursor);
        } else {
            // When paused, update once to sync position
            if (cursorRef.current && duration > 0) {
                const percent = Math.max(0, Math.min(100, (currentTime / duration) * 100));
                cursorRef.current.style.left = `${percent}%`;
                setDisplayTime(currentTime);
            }
        }

        return () => {
            if (animationFrameRef.current) {
                cancelAnimationFrame(animationFrameRef.current);
            }
        };
    }, [isPlaying, isInitialized, wavesurfer, duration, currentTime]);

    // Zoom controls
    const handleZoomIn = useCallback(() => {
        setZoomLevel(prev => Math.min(prev * 1.5, 5));
    }, []);

    const handleZoomOut = useCallback(() => {
        setZoomLevel(prev => {
            const newZoom = Math.max(prev / 1.5, 1);
            if (newZoom === 1) setPanOffset(0);
            return newZoom;
        });
    }, []);

    const handleResetZoom = useCallback(() => {
        setZoomLevel(1);
        setPanOffset(0);
    }, []);

    // Mouse wheel zoom
    const handleWheel = useCallback((e) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            if (e.deltaY < 0) {
                handleZoomIn();
            } else {
                handleZoomOut();
            }
        }
    }, [handleZoomIn, handleZoomOut]);

    // Pan handling for zoomed view
    const handleMouseDown = useCallback((e) => {
        if (zoomLevel > 1 && e.button === 0) {
            setIsDragging(true);
            setDragStart({ x: e.clientX, offset: panOffset });
        }
    }, [zoomLevel, panOffset]);

    const handleMouseMove = useCallback((e) => {
        if (isDragging && containerRef.current) {
            const containerWidth = containerRef.current.offsetWidth;
            const scaledWidth = containerWidth * zoomLevel;
            const maxPan = Math.max(0, (scaledWidth - containerWidth) / 2);

            const delta = e.clientX - dragStart.x;
            const newOffset = Math.max(-maxPan, Math.min(maxPan, dragStart.offset + delta));
            setPanOffset(newOffset);
        }
    }, [isDragging, dragStart, zoomLevel]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Click to seek (when not dragging)
    const handleClick = useCallback((e) => {
        if (isDragging || !containerRef.current || !duration) return;

        const rect = containerRef.current.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const containerWidth = rect.width;

        // Account for zoom and pan
        const scaledWidth = containerWidth * zoomLevel;
        const visibleStart = (scaledWidth - containerWidth) / 2 - panOffset;
        const actualX = visibleStart + clickX;
        const percent = actualX / scaledWidth;

        if (percent >= 0 && percent <= 1) {
            const seekTime = percent * duration;
            seekTo(seekTime);

            // Immediately update cursor position
            if (cursorRef.current) {
                cursorRef.current.style.left = `${percent * 100}%`;
            }
        }
    }, [isDragging, duration, zoomLevel, panOffset, seekTo]);

    // Add global mouse event listeners for drag
    useEffect(() => {
        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    if (!melSpectrogram?.imagePath) {
        return null;
    }

    return (
        <div>
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary-400" />
                Mel-Spectrogram
            </h3>
            <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                {loading && (
                    <div className="flex items-center justify-center h-32">
                        <div className="animate-pulse text-gray-400">Loading spectrogram...</div>
                    </div>
                )}

                {error && !loading && (
                    <div className="flex items-center justify-center h-32 text-gray-500">
                        {error}
                    </div>
                )}

                {imageDataUrl && !loading && !error && (
                    <>
                        {/* Spectrogram with playback line */}
                        <div
                            ref={containerRef}
                            className="relative overflow-hidden rounded mb-4"
                            style={{
                                cursor: zoomLevel > 1 ? (isDragging ? 'grabbing' : 'grab') : 'pointer',
                                userSelect: 'none'
                            }}
                            onWheel={handleWheel}
                            onMouseDown={handleMouseDown}
                            onClick={handleClick}
                        >
                            <div
                                style={{
                                    transform: `scaleX(${zoomLevel}) translateX(${panOffset / zoomLevel}px)`,
                                    transformOrigin: 'center',
                                    transition: isDragging ? 'none' : 'transform 0.2s ease-out'
                                }}
                            >
                                <img
                                    ref={imageRef}
                                    src={imageDataUrl}
                                    alt="Mel-Spectrogram visualization"
                                    className="w-full h-auto"
                                    style={{ maxHeight: '300px', objectFit: 'contain' }}
                                    draggable={false}
                                />
                            </div>

                            {/* Playback tracking line - uses ref for smooth RAF updates */}
                            {isInitialized && duration > 0 && (
                                <div
                                    ref={cursorRef}
                                    className="absolute top-0 bottom-0 w-0.5 bg-yellow-400 pointer-events-none z-10"
                                    style={{
                                        left: '0%',
                                        boxShadow: '0 0 4px rgba(234, 179, 8, 0.8)',
                                        willChange: 'left'
                                    }}
                                />
                            )}

                            {/* Zoom indicator */}
                            {zoomLevel > 1 && (
                                <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                                    {zoomLevel.toFixed(1)}x
                                </div>
                            )}
                        </div>

                        {/* Controls */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                {/* Play/Pause button */}
                                <button
                                    onClick={playPause}
                                    disabled={!audioFile}
                                    className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={audioFile ? (isPlaying ? 'Pause' : 'Play') : 'No audio loaded'}
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

                                {/* Time display */}
                                {duration > 0 && (
                                    <span className="text-sm text-gray-400 ml-2 font-mono">
                                        {formatTime(displayTime)} / {formatTime(duration)}
                                    </span>
                                )}
                            </div>

                            {/* Zoom controls */}
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={handleZoomOut}
                                    disabled={zoomLevel <= 1}
                                    className="p-2 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Zoom out"
                                >
                                    <ZoomOut className="w-4 h-4 text-gray-400" />
                                </button>
                                <button
                                    onClick={handleResetZoom}
                                    disabled={zoomLevel === 1}
                                    className="p-2 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Reset zoom"
                                >
                                    <RotateCcw className="w-4 h-4 text-gray-400" />
                                </button>
                                <button
                                    onClick={handleZoomIn}
                                    disabled={zoomLevel >= 5}
                                    className="p-2 rounded hover:bg-gray-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                    title="Zoom in"
                                >
                                    <ZoomIn className="w-4 h-4 text-gray-400" />
                                </button>
                                <span className="text-xs text-gray-500 ml-2">Ctrl+Scroll to zoom</span>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

// Helper to format time as mm:ss
function formatTime(seconds) {
    if (!isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export default MelSpectrogramDisplay;
