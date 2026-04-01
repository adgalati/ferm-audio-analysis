import React, { useRef, useEffect, useState, useCallback, useMemo } from 'react';
import { Chart } from 'chart.js/auto';
import zoomPlugin from 'chartjs-plugin-zoom';
import { Map, Loader2, Filter, RefreshCw, AlertCircle, ZoomIn, ZoomOut, Crosshair, Maximize2 } from 'lucide-react';

// Register the zoom plugin globally
Chart.register(zoomPlugin);

/**
 * Genre color palette – 12 visually distinct colors for the most common genres.
 * Tracks with genres not in this list get the 'Other' color.
 */
const GENRE_COLORS = {
    'Hip-Hop': '#6366f1',       // Indigo
    'Electronic': '#06b6d4',    // Cyan
    'Rock': '#ef4444',          // Red
    'Pop': '#f472b6',           // Pink
    'Jazz': '#f59e0b',          // Amber
    'R&B': '#8b5cf6',           // Violet
    'Classical': '#14b8a6',     // Teal
    'Metal': '#78716c',         // Stone
    'Country': '#d97706',       // Warm amber
    'Blues': '#3b82f6',          // Blue
    'Reggae': '#22c55e',        // Green
    'Latin': '#e11d48',         // Rose
};
const OTHER_COLOR = '#64748b';       // Slate for uncategorized
const HIGHLIGHT_COLOR = '#ffffff';   // White for current track
const HIGHLIGHT_BORDER = '#6366f1';  // Indigo border for contrast
const HIGHLIGHT_RADIUS = 12;
const DEFAULT_RADIUS = 4;
const ZOOM_PADDING = 3; // padding around highlighted point when centering

/**
 * UmapScatterPlot – 2D scatter visualization of the MAEST embedding space.
 *
 * Props:
 *   highlightId      (string)   – Mongo _id or clipName of the "current" track to emphasize
 *   onTrackClick     (function) – callback(mongoId) when a dot is clicked
 *   sourceTypeFilter (string)   – 'all' | 'mainstream' | 'independent' (controlled externally)
 *   compact          (boolean)  – if true, hides the legend and uses shorter header
 */
function UmapScatterPlot({ highlightId, onTrackClick, sourceTypeFilter = 'all', compact = false }) {
    const canvasRef = useRef(null);
    const chartRef = useRef(null);

    const [points, setPoints] = useState(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isComputing, setIsComputing] = useState(false);
    const [computeProgress, setComputeProgress] = useState(null);
    const [error, setError] = useState(null);
    const [info, setInfo] = useState(null); // { total, capped }

    // -------------------------------------------------------
    // Data fetching
    // -------------------------------------------------------
    const loadData = useCallback(async () => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await window.electronAPI.search('search:get-umap-data', {
                sourceTypeFilter: sourceTypeFilter !== 'all' ? sourceTypeFilter : null
            });
            if (result.success) {
                setPoints(result.points);
                setInfo({ total: result.total, capped: result.capped });
            } else {
                setError(result.error);
                setPoints(null);
            }
        } catch (err) {
            setError(err.message);
            setPoints(null);
        } finally {
            setIsLoading(false);
        }
    }, [sourceTypeFilter]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // -------------------------------------------------------
    // Recompute UMAP (shells out to Python script)
    // -------------------------------------------------------
    const handleComputeUmap = useCallback(async () => {
        setIsComputing(true);
        setComputeProgress({ percent: 5, message: 'Initiating UMAP computation…' });
        setError(null);

        // Listen for progress events
        const cleanup = window.electronAPI.onUmapProgress?.((data) => {
            setComputeProgress(data);
        });

        try {
            const result = await window.electronAPI.search('search:compute-umap', {});
            if (result.success) {
                setComputeProgress({ percent: 100, message: 'UMAP complete! Reloading…' });
                await loadData();
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setIsComputing(false);
            setComputeProgress(null);
            cleanup?.();
        }
    }, [loadData]);

    // -------------------------------------------------------
    // Resolve genre → color (with useMemo for the legend)
    // -------------------------------------------------------
    const genreColorMap = useMemo(() => {
        if (!points) return {};
        const genres = [...new Set(points.map(p => p.topGenre).filter(Boolean))];
        const map = {};
        for (const g of genres) {
            // Try exact match first, then the first word (e.g. "Hip-Hop---Rap" -> "Hip-Hop")
            map[g] = GENRE_COLORS[g] || GENRE_COLORS[g.split('---')[0]] || OTHER_COLOR;
        }
        return map;
    }, [points]);

    const getColor = useCallback((genre) => genreColorMap[genre] || OTHER_COLOR, [genreColorMap]);

    // -------------------------------------------------------
    // Compute global and highlight-centered scale limits
    // -------------------------------------------------------
    const scaleLimits = useMemo(() => {
        if (!points || points.length === 0) return null;

        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        const xMin = Math.min(...xs);
        const xMax = Math.max(...xs);
        const yMin = Math.min(...ys);
        const yMax = Math.max(...ys);
        const pad = Math.max(xMax - xMin, yMax - yMin) * 0.05;

        const global = {
            xMin: xMin - pad,
            xMax: xMax + pad,
            yMin: yMin - pad,
            yMax: yMax + pad,
        };

        // If a highlight exists, compute a centered view around it
        let focused = null;
        if (highlightId) {
            const hp = points.find(p => p.id === highlightId || p.clipName === highlightId);
            if (hp) {
                focused = {
                    xMin: hp.x - ZOOM_PADDING,
                    xMax: hp.x + ZOOM_PADDING,
                    yMin: hp.y - ZOOM_PADDING,
                    yMax: hp.y + ZOOM_PADDING,
                };
            }
        }

        return { global, focused };
    }, [points, highlightId]);

    // -------------------------------------------------------
    // Zoom / Pan helpers
    // -------------------------------------------------------
    const handleZoomIn = useCallback(() => {
        if (chartRef.current) {
            chartRef.current.zoom(1.4);
        }
    }, []);

    const handleZoomOut = useCallback(() => {
        if (chartRef.current) {
            chartRef.current.zoom(0.7);
        }
    }, []);

    const handleResetZoom = useCallback(() => {
        if (chartRef.current) {
            chartRef.current.resetZoom();
        }
    }, []);

    const handleCenterOnHighlight = useCallback(() => {
        if (!chartRef.current || !scaleLimits?.focused) return;
        const { focused } = scaleLimits;
        chartRef.current.options.scales.x.min = focused.xMin;
        chartRef.current.options.scales.x.max = focused.xMax;
        chartRef.current.options.scales.y.min = focused.yMin;
        chartRef.current.options.scales.y.max = focused.yMax;
        chartRef.current.update('none');
    }, [scaleLimits]);

    // -------------------------------------------------------
    // Chart.js rendering
    // -------------------------------------------------------
    useEffect(() => {
        if (!points || points.length === 0 || !canvasRef.current || !scaleLimits) return;

        // Destroy previous chart instance
        if (chartRef.current) {
            chartRef.current.destroy();
            chartRef.current = null;
        }

        // Separate the highlighted point from the rest
        const normalPoints = [];
        let highlightPoint = null;

        for (const p of points) {
            const isHighlighted = highlightId && (p.id === highlightId || p.clipName === highlightId);
            if (isHighlighted) {
                highlightPoint = p;
            } else {
                normalPoints.push(p);
            }
        }

        const datasets = [];

        // Group normal points by genre for coloring
        const byGenre = {};
        for (const p of normalPoints) {
            const genre = p.topGenre || 'Other';
            if (!byGenre[genre]) byGenre[genre] = [];
            byGenre[genre].push(p);
        }

        for (const [genre, pts] of Object.entries(byGenre)) {
            datasets.push({
                label: genre,
                data: pts.map(p => ({ x: p.x, y: p.y, _meta: p })),
                backgroundColor: getColor(genre),
                borderColor: 'rgba(0,0,0,0.3)',
                borderWidth: 0.5,
                pointRadius: DEFAULT_RADIUS,
                pointHoverRadius: DEFAULT_RADIUS + 3,
                pointHitRadius: 8,
            });
        }

        // Highlighted track on top
        if (highlightPoint) {
            datasets.push({
                label: `★ ${highlightPoint.clipName}`,
                data: [{ x: highlightPoint.x, y: highlightPoint.y, _meta: highlightPoint }],
                backgroundColor: HIGHLIGHT_COLOR,
                borderColor: HIGHLIGHT_BORDER,
                borderWidth: 3,
                pointRadius: HIGHLIGHT_RADIUS,
                pointHoverRadius: HIGHLIGHT_RADIUS + 4,
                pointStyle: 'star',
                pointHitRadius: 14,
            });
        }

        // Determine initial view: centered on highlight if available, else global
        const initView = (highlightId && scaleLimits.focused) ? scaleLimits.focused : scaleLimits.global;

        const ctx = canvasRef.current.getContext('2d');
        chartRef.current = new Chart(ctx, {
            type: 'scatter',
            data: { datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600 },
                scales: {
                    x: {
                        display: false,
                        grid: { display: false },
                        min: initView.xMin,
                        max: initView.xMax,
                    },
                    y: {
                        display: false,
                        grid: { display: false },
                        min: initView.yMin,
                        max: initView.yMax,
                    },
                },
                plugins: {
                    legend: {
                        display: !compact,
                        position: 'right',
                        labels: {
                            color: '#d1d5db',
                            font: { size: 11 },
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 10,
                            filter: (item) => !item.text.startsWith('★'),
                        },
                    },
                    tooltip: {
                        backgroundColor: 'rgba(17,24,39,0.95)',
                        titleFont: { size: 13, weight: 'bold' },
                        bodyFont: { size: 12 },
                        borderColor: 'rgba(99,102,241,0.4)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            title: (items) => {
                                const meta = items[0]?.raw?._meta;
                                return meta?.clipName || 'Unknown';
                            },
                            label: (item) => {
                                const meta = item.raw?._meta;
                                if (!meta) return '';
                                const lines = [];
                                if (meta.topGenre) lines.push(`Genre: ${meta.topGenre}`);
                                if (meta.sourceType) lines.push(`Type: ${meta.sourceType}`);
                                return lines;
                            },
                        },
                    },
                    zoom: {
                        pan: {
                            enabled: true,
                            mode: 'xy',
                            modifierKey: null,
                        },
                        zoom: {
                            wheel: {
                                enabled: true,
                                speed: 0.08,
                            },
                            pinch: {
                                enabled: true,
                            },
                            mode: 'xy',
                        },
                        limits: {
                            x: {
                                min: scaleLimits.global.xMin - 5,
                                max: scaleLimits.global.xMax + 5,
                            },
                            y: {
                                min: scaleLimits.global.yMin - 5,
                                max: scaleLimits.global.yMax + 5,
                            },
                        },
                    },
                },
                onClick: (event, elements) => {
                    if (elements.length > 0 && onTrackClick) {
                        const el = elements[0];
                        const meta = chartRef.current.data.datasets[el.datasetIndex].data[el.index]?._meta;
                        if (meta?.id) {
                            onTrackClick(meta.id);
                        }
                    }
                },
            },
        });

        return () => {
            if (chartRef.current) {
                chartRef.current.destroy();
                chartRef.current = null;
            }
        };
    }, [points, highlightId, compact, getColor, onTrackClick, scaleLimits]);

    // -------------------------------------------------------
    // Render
    // -------------------------------------------------------
    if (isLoading && !points) {
        return (
            <div className="flex items-center justify-center py-12 text-gray-400">
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Loading UMAP data…
            </div>
        );
    }

    if (error && !points) {
        return (
            <div className="space-y-4 py-6">
                <div className="flex items-start gap-3 text-yellow-400">
                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-sm">{error}</p>
                        <p className="text-xs text-gray-500 mt-1">
                            You may need to compute the UMAP projection first.
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleComputeUmap}
                    disabled={isComputing}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors flex items-center gap-2"
                >
                    {isComputing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <Map className="w-4 h-4" />
                    )}
                    {isComputing ? 'Computing…' : 'Compute UMAP Map'}
                </button>
                {computeProgress && (
                    <div className="space-y-1">
                        <div className="w-full bg-gray-700 rounded-full h-2">
                            <div
                                className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                                style={{ width: `${computeProgress.percent || 0}%` }}
                            />
                        </div>
                        <p className="text-xs text-gray-400">{computeProgress.message}</p>
                    </div>
                )}
            </div>
        );
    }

    if (!points || points.length === 0) {
        return (
            <div className="text-center py-8 text-gray-500 text-sm">
                <Map className="w-8 h-8 mx-auto mb-3 opacity-40" />
                <p>No UMAP data available.</p>
                <button
                    onClick={handleComputeUmap}
                    disabled={isComputing}
                    className="mt-3 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors flex items-center gap-2 mx-auto"
                >
                    {isComputing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Map className="w-4 h-4" />}
                    {isComputing ? 'Computing…' : 'Compute UMAP Map'}
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {/* Toolbar */}
            <div className="flex items-center justify-between">
                <div className="text-xs text-gray-400">
                    {info?.total || points.length} tracks mapped
                    {info?.capped && <span className="text-yellow-500 ml-1">(capped at {points.length})</span>}
                    {highlightId && <span className="text-indigo-400 ml-2">• Centered on current track</span>}
                </div>
                <div className="flex items-center gap-1">
                    {/* Zoom controls */}
                    <button
                        onClick={handleZoomIn}
                        className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        title="Zoom In"
                    >
                        <ZoomIn className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={handleZoomOut}
                        className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        title="Zoom Out"
                    >
                        <ZoomOut className="w-3.5 h-3.5" />
                    </button>
                    {highlightId && scaleLimits?.focused && (
                        <button
                            onClick={handleCenterOnHighlight}
                            className="p-1.5 bg-indigo-700 hover:bg-indigo-600 text-indigo-200 rounded transition-colors"
                            title="Center on current track"
                        >
                            <Crosshair className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        onClick={handleResetZoom}
                        className="p-1.5 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                        title="Reset zoom (show all)"
                    >
                        <Maximize2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="w-px h-5 bg-gray-600 mx-1" />
                    <button
                        onClick={handleComputeUmap}
                        disabled={isComputing}
                        className="px-2 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 text-xs rounded flex items-center gap-1 transition-colors"
                        title="Recompute UMAP projection"
                    >
                        {isComputing ? (
                            <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                            <RefreshCw className="w-3 h-3" />
                        )}
                        Recompute
                    </button>
                </div>
            </div>

            {/* Progress bar */}
            {isComputing && computeProgress && (
                <div className="space-y-1">
                    <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                            className="bg-indigo-500 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${computeProgress.percent || 0}%` }}
                        />
                    </div>
                    <p className="text-xs text-gray-400">{computeProgress.message}</p>
                </div>
            )}

            {/* Chart */}
            <div className="relative bg-gray-900/50 rounded-lg border border-gray-700 p-2" style={{ height: compact ? 550 : 750 }}>
                <canvas ref={canvasRef} />
                {/* Zoom hint overlay */}
                <div className="absolute bottom-3 left-3 text-[10px] text-gray-500 pointer-events-none">
                    Scroll to zoom • Drag to pan
                </div>
            </div>
        </div>
    );
}

export default UmapScatterPlot;
