import React, { useState, useEffect, useMemo } from 'react';
import { FileBarChart, Download, Loader2, AlertCircle, Calendar, CheckSquare, Square, Image as ImageIcon, RectangleHorizontal, MessageSquare, Filter, History, Save, Trash2 } from 'lucide-react';

// Aspect ratio options (per Gemini docs)
const ASPECT_RATIOS = [
    { value: '9:16', label: '9:16', desc: 'Portrait (Story)' },
    { value: '3:4', label: '3:4', desc: 'Portrait' },
    { value: '1:1', label: '1:1', desc: 'Square' },
    { value: '4:3', label: '4:3', desc: 'Landscape' },
    { value: '16:9', label: '16:9', desc: 'Widescreen' },
    { value: '21:9', label: '21:9', desc: 'Ultrawide' },
];

// Data categories available for report generation
const DATA_CATEGORIES = [
    { key: 'genre', label: 'Genre & Style', icon: '🎵', description: 'Top genres, styles, and distribution' },
    { key: 'key', label: 'Key Signature', icon: '🎹', description: 'Most common keys, modes, key fit scores' },
    { key: 'loudness', label: 'Loudness', icon: '🔊', description: 'LUFS, LRA, True Peak averages' },
    { key: 'gainStaging', label: 'Gain Staging', icon: '🎛️', description: 'Quality distribution and delta LUFS' },
    { key: 'timing', label: 'Timing', icon: '⏱️', description: 'Timing tightness analysis' },
    { key: 'hiphopSubstyle', label: 'Hip-Hop Substyles', icon: '🎤', description: 'Substyle classification breakdown' },
    { key: 'fermFactor', label: 'FERM Factor', icon: '⭐', description: 'Average, min, max scores' },
    { key: 'favorites', label: 'Favorites', icon: '❤️', description: 'Favorited tracks count and notes' },
    { key: 'spectral', label: 'Spectral Analysis', icon: '📊', description: 'Genre fit, brightness, warmth' }
];

// Date preset helpers
function getDatePreset(preset) {
    const now = new Date();
    const to = now.toISOString().split('T')[0];
    let from;

    switch (preset) {
        case '7d': {
            const d = new Date(now);
            d.setDate(d.getDate() - 7);
            from = d.toISOString().split('T')[0];
            break;
        }
        case '30d': {
            const d = new Date(now);
            d.setDate(d.getDate() - 30);
            from = d.toISOString().split('T')[0];
            break;
        }
        case 'month': {
            from = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
            break;
        }
        case 'all':
        default:
            from = '';
            break;
    }

    return { from, to: preset === 'all' ? '' : to };
}

function ReportGeneratorPanel() {
    // Date range
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    // Selected categories
    const [selectedCategories, setSelectedCategories] = useState(
        new Set(['genre', 'key', 'loudness', 'gainStaging', 'spectral'])
    );

    // Aspect ratio
    const [aspectRatio, setAspectRatio] = useState('9:16');

    // Source type filter
    const [sourceType, setSourceType] = useState('all'); // 'all' | 'independent' | 'mainstream'

    // User prompt
    const [userPrompt, setUserPrompt] = useState('');

    // Selected model
    const [selectedModel, setSelectedModel] = useState('gemini'); // 'gemini' | 'gpt'

    // Library State
    const [viewMode, setViewMode] = useState('generator'); // 'generator' | 'library'
    const [savedReports, setSavedReports] = useState([]);
    const [isLibraryLoading, setIsLibraryLoading] = useState(false);

    // Generation state
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState(null);
    const [generatedImage, setGeneratedImage] = useState(null); // { base64, mimeType }
    const [insights, setInsights] = useState(null);

    const hasCategories = selectedCategories.size > 0;

    const toggleCategory = (key) => {
        setSelectedCategories(prev => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const selectAll = () => setSelectedCategories(new Set(DATA_CATEGORIES.map(c => c.key)));
    const deselectAll = () => setSelectedCategories(new Set());

    const applyPreset = (preset) => {
        const { from, to } = getDatePreset(preset);
        setDateFrom(from);
        setDateTo(to);
    };

    const handleGenerate = async () => {
        setIsGenerating(true);
        setError(null);
        setGeneratedImage(null);
        setInsights(null);

        try {
            const result = await window.electronAPI.report('report:generate-infographic', {
                dateFrom: dateFrom || null,
                dateTo: dateTo || null,
                categories: Array.from(selectedCategories),
                aspectRatio,
                sourceType: sourceType === 'all' ? null : sourceType,
                userPrompt: userPrompt.trim() || null,
                model: selectedModel
            });

            if (result.success) {
                setGeneratedImage({ base64: result.imageBase64, mimeType: result.mimeType });
                setInsights(result.insights);
            } else {
                setError(result.error || 'Failed to generate infographic');
            }
        } catch (err) {
            setError(err.message || 'Unexpected error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSave = async () => {
        if (!generatedImage) return;
        try {
            const dateStr = new Date().toISOString().split('T')[0];
            await window.electronAPI.report('report:save-infographic', {
                imageBase64: generatedImage.base64,
                filename: `ferm-report-${dateStr}.png`
            });
        } catch (err) {
            console.error('Save error:', err);
        }
    };

    const handleSaveToLibrary = async () => {
        if (!generatedImage || !insights) return;
        try {
            const metadata = {
                insights,
                options: {
                    dateFrom, dateTo,
                    categories: Array.from(selectedCategories),
                    aspectRatio,
                    sourceType,
                    userPrompt,
                    model: selectedModel
                }
            };

            const result = await window.electronAPI.report('report:save-to-library', {
                imageBase64: generatedImage.base64,
                metadata
            });

            if (result.success) {
                // visual confirmation could go here
                alert('Report saved to library!');
            } else {
                alert(`Failed to save: ${result.error}`);
            }
        } catch (err) {
            console.error('Library save error:', err);
        }
    };

    const fetchLibrary = async () => {
        setIsLibraryLoading(true);
        try {
            const list = await window.electronAPI.report('report:list-library') || [];
            if (list.error) {
                console.error('List error:', list.error);
                setSavedReports([]);
            } else {
                setSavedReports(list);
            }
        } catch (err) {
            console.error('Fetch library error:', err);
        } finally {
            setIsLibraryLoading(false);
        }
    };

    const handleDeleteReport = async (id, e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this report?')) return;

        try {
            await window.electronAPI.report('report:delete-library-item', { id });
            setSavedReports(prev => prev.filter(r => r.id !== id));
        } catch (err) {
            console.error('Delete error:', err);
        }
    };

    const handleLoadReport = async (report) => {
        // Load image and switch to generator view (populated)
        try {
            const { imageBase64 } = await window.electronAPI.report('report:load-library-image', { id: report.id });
            if (imageBase64) {
                setGeneratedImage({ base64: imageBase64, mimeType: 'image/png' });
                setInsights(report.insights);

                // Restore state from options so UI matches the report
                if (report.options) {
                    setDateFrom(report.options.dateFrom || '');
                    setDateTo(report.options.dateTo || '');

                    if (report.options.categories) {
                        setSelectedCategories(new Set(report.options.categories));
                    }
                    if (report.options.aspectRatio) setAspectRatio(report.options.aspectRatio);
                    if (report.options.sourceType) setSourceType(report.options.sourceType);
                    setUserPrompt(report.options.userPrompt || '');
                    if (report.options.model) setSelectedModel(report.options.model);
                }

                setViewMode('generator');
            }
        } catch (err) {
            console.error('Load report error:', err);
        }
    };

    // Load library when switching to library mode
    useEffect(() => {
        if (viewMode === 'library') {
            fetchLibrary();
        }
    }, [viewMode]);

    // Summary line
    const summaryText = useMemo(() => {
        if (!insights) return null;
        const parts = [`${insights.totalTracks} tracks analyzed`];
        if (insights.dateRange?.earliest && insights.dateRange?.latest) {
            parts.push(`${new Date(insights.dateRange.earliest).toLocaleDateString()} — ${new Date(insights.dateRange.latest).toLocaleDateString()}`);
        }
        return parts.join(' • ');
    }, [insights]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="card">
                <div className="flex items-center justify-between mb-2">
                    <div>
                        <h2 className="text-2xl font-semibold flex items-center gap-2">
                            <FileBarChart className="w-6 h-6 text-cyan-400" />
                            Report Generator
                        </h2>
                        <p className="text-sm text-gray-400 mt-1">
                            Generate AI-powered infographic reports from your analysis data
                        </p>
                    </div>

                    <div className="flex gap-2">
                        <div className="flex bg-gray-800 rounded-lg p-1 mr-4">
                            <button
                                onClick={() => setViewMode('generator')}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === 'generator' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                Generate New
                            </button>
                            <button
                                onClick={() => setViewMode('library')}
                                className={`px-4 py-1.5 text-xs font-medium rounded-md transition-all flex items-center gap-2 ${viewMode === 'library' ? 'bg-gray-600 text-white shadow-sm' : 'text-gray-400 hover:text-gray-200'
                                    }`}
                            >
                                <History className="w-3.5 h-3.5" />
                                Saved Reports
                            </button>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-gray-500 self-center">
                            <ImageIcon className="w-4 h-4" />
                            Powered by {selectedModel === 'gpt' ? 'OpenAI GPT' : 'Gemini AI'}
                        </div>
                    </div>
                </div>
            </div>

            {viewMode === 'library' ? (
                /* LIBRARY VIEW */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {isLibraryLoading ? (
                        <div className="col-span-full py-12 flex justify-center">
                            <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                        </div>
                    ) : savedReports.length === 0 ? (
                        <div className="col-span-full py-16 text-center text-gray-500">
                            <History className="w-12 h-12 mx-auto mb-3 opacity-20" />
                            No saved reports found.
                        </div>
                    ) : (
                        savedReports.map(report => (
                            <div
                                key={report.id}
                                onClick={() => handleLoadReport(report)}
                                className="card p-0 overflow-hidden hover:ring-2 ring-cyan-500/50 cursor-pointer transition-all group group-hover:bg-gray-800"
                            >
                                <div className="aspect-[9/16] bg-gray-900 relative">
                                    {/* Placeholder if we don't load thumbnail immediately. 
                                        Since we load on click, maybe just show metadata for now 
                                        or we'd need a thumbnail API. For now, just metadata card. 
                                    */}
                                    <div className="absolute inset-0 flex items-center justify-center text-gray-700 group-hover:text-gray-500">
                                        <ImageIcon className="w-12 h-12" />
                                    </div>
                                    <div className="absolute bottom-0 left-0 right-0 p-3 bg-gradient-to-t from-black/90 to-transparent">
                                        <div className="text-xs font-medium text-white">
                                            {new Date(report.savedAt).toLocaleDateString()}
                                        </div>
                                        <div className="text-[10px] text-gray-400">
                                            {new Date(report.savedAt).toLocaleTimeString()}
                                        </div>
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteReport(report.id, e)}
                                        className="absolute top-2 right-2 p-1.5 bg-black/50 hover:bg-red-900/80 text-gray-400 hover:text-red-200 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                                <div className="p-3">
                                    <div className="text-xs text-gray-300 line-clamp-2 mb-2">
                                        {report.insights?.totalTracks} tracks • {report.options?.aspectRatio}
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                        {report.options?.categories?.slice(0, 3).map(c => (
                                            <span key={c} className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400">
                                                {c}
                                            </span>
                                        ))}
                                        {(report.options?.categories?.length || 0) > 3 && (
                                            <span className="px-1.5 py-0.5 bg-gray-700 rounded text-[10px] text-gray-400">
                                                +{report.options.categories.length - 3}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                /* GENERATOR VIEW */
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Left: Configuration */}
                    <div className="lg:col-span-1 space-y-4">
                        {/* Date Range */}
                        <div className="card">
                            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                                <Calendar className="w-4 h-4 text-blue-400" />
                                Time Frame
                            </h3>

                            <div className="space-y-3">
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">From</label>
                                    <input
                                        type="date"
                                        value={dateFrom}
                                        onChange={(e) => setDateFrom(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs text-gray-400 mb-1">To</label>
                                    <input
                                        type="date"
                                        value={dateTo}
                                        onChange={(e) => setDateTo(e.target.value)}
                                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
                                    />
                                </div>

                                <div className="flex flex-wrap gap-1.5">
                                    {[
                                        { key: '7d', label: 'Last 7 days' },
                                        { key: '30d', label: 'Last 30 days' },
                                        { key: 'month', label: 'This month' },
                                        { key: 'all', label: 'All time' }
                                    ].map(p => (
                                        <button
                                            key={p.key}
                                            onClick={() => applyPreset(p.key)}
                                            className="px-2.5 py-1 text-xs bg-gray-700 hover:bg-gray-600 text-gray-300 rounded transition-colors"
                                        >
                                            {p.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Aspect Ratio */}
                        <div className="card">
                            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                                <RectangleHorizontal className="w-4 h-4 text-purple-400" />
                                Aspect Ratio
                            </h3>
                            <div className="grid grid-cols-3 gap-1.5">
                                {ASPECT_RATIOS.map(ar => (
                                    <button
                                        key={ar.value}
                                        onClick={() => setAspectRatio(ar.value)}
                                        className={`px-2 py-2 rounded text-center transition-all text-xs ${aspectRatio === ar.value
                                            ? 'bg-purple-900/40 border border-purple-600/60 text-purple-200'
                                            : 'bg-gray-800/50 border border-gray-700/30 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                                            }`}
                                    >
                                        <div className="font-semibold">{ar.label}</div>
                                        <div className="text-[10px] text-gray-500 mt-0.5">{ar.desc}</div>
                                    </button>
                                ))}
                            </div>
                            <p className="text-[10px] text-gray-600 mt-2">Resolution: 2K</p>
                        </div>

                        {/* Data Categories */}
                        <div className="card">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-semibold text-gray-200">Data Categories</h3>
                                <div className="flex gap-2">
                                    <button onClick={selectAll} className="text-xs text-blue-400 hover:text-blue-300">All</button>
                                    <span className="text-gray-600">|</span>
                                    <button onClick={deselectAll} className="text-xs text-gray-400 hover:text-gray-300">None</button>
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                {DATA_CATEGORIES.map(cat => {
                                    const isSelected = selectedCategories.has(cat.key);
                                    return (
                                        <button
                                            key={cat.key}
                                            onClick={() => toggleCategory(cat.key)}
                                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded text-left transition-all text-sm ${isSelected
                                                ? 'bg-blue-900/30 border border-blue-700/50 text-gray-100'
                                                : 'bg-gray-800/50 border border-gray-700/30 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                                                }`}
                                        >
                                            {isSelected
                                                ? <CheckSquare className="w-4 h-4 text-blue-400 flex-shrink-0" />
                                                : <Square className="w-4 h-4 text-gray-600 flex-shrink-0" />
                                            }
                                            <span className="flex-shrink-0">{cat.icon}</span>
                                            <div className="min-w-0">
                                                <div className="font-medium truncate">{cat.label}</div>
                                                <div className="text-xs text-gray-500 truncate">{cat.description}</div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Source Type Filter */}
                        <div className="card">
                            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                                <Filter className="w-4 h-4 text-green-400" />
                                Source Type
                            </h3>
                            <div className="grid grid-cols-3 gap-1.5">
                                {[
                                    { value: 'all', label: 'Both' },
                                    { value: 'independent', label: 'Independent' },
                                    { value: 'mainstream', label: 'Mainstream' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSourceType(opt.value)}
                                        className={`px-2 py-2 rounded text-center transition-all text-xs font-medium ${sourceType === opt.value
                                            ? 'bg-green-900/40 border border-green-600/60 text-green-200'
                                            : 'bg-gray-800/50 border border-gray-700/30 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* User Prompt */}
                        <div className="card">
                            <h3 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4 text-yellow-400" />
                                Custom Instructions
                                <span className="text-[10px] text-gray-500 font-normal">(optional)</span>
                            </h3>
                            <textarea
                                value={userPrompt}
                                onChange={(e) => setUserPrompt(e.target.value)}
                                placeholder="e.g. Use a horizontal bar chart for genres, put the key signature in a circle of fifths diagram…"
                                rows={3}
                                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-yellow-500 resize-none mb-4"
                            />

                            <h3 className="text-sm font-semibold text-gray-200 mb-3 mt-4 flex items-center gap-2">
                                <ImageIcon className="w-4 h-4 text-pink-400" />
                                Image Model
                            </h3>
                            <div className="grid grid-cols-2 gap-1.5">
                                {[
                                    { value: 'gemini', label: 'Gemini (Nano Banana Pro)' },
                                    { value: 'gpt', label: 'OpenAI (GPT Image 2)' },
                                ].map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setSelectedModel(opt.value)}
                                        className={`px-2 py-2 rounded text-center transition-all text-xs font-medium ${selectedModel === opt.value
                                            ? 'bg-pink-900/40 border border-pink-600/60 text-pink-200'
                                            : 'bg-gray-800/50 border border-gray-700/30 text-gray-400 hover:text-gray-300 hover:bg-gray-700/50'
                                            }`}
                                    >
                                        {opt.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Generate Button */}
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating || !hasCategories}
                            className={`w-full py-3 px-4 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all ${isGenerating
                                ? 'bg-gray-700 text-gray-400 cursor-wait'
                                : !hasCategories
                                    ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white shadow-lg shadow-cyan-900/30'
                                }`}
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Generating Infographic…
                                </>
                            ) : (
                                <>
                                    <FileBarChart className="w-5 h-5" />
                                    Generate Infographic
                                </>
                            )}
                        </button>
                    </div>

                    {/* Right: Results */}
                    <div className="lg:col-span-2">
                        {/* Loading State */}
                        {isGenerating && (
                            <div className="card flex flex-col items-center justify-center py-16">
                                <Loader2 className="w-12 h-12 text-cyan-400 animate-spin mb-4" />
                                <p className="text-gray-300 font-medium">Generating infographic with Gemini AI…</p>
                                <p className="text-sm text-gray-500 mt-1">This may take 15–30 seconds</p>
                            </div>
                        )}

                        {/* Error State */}
                        {error && !isGenerating && (
                            <div className="card bg-red-900/20 border border-red-700/50">
                                <div className="flex items-start gap-3">
                                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <h3 className="text-sm font-semibold text-red-400 mb-1">Generation Failed</h3>
                                        <p className="text-sm text-red-200">{error}</p>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Generated Image */}
                        {generatedImage && !isGenerating && (
                            <div className="space-y-4">
                                <div className="card p-2">
                                    <img
                                        src={`data:${generatedImage.mimeType};base64,${generatedImage.base64}`}
                                        alt="FERM Analysis Infographic"
                                        className="w-full rounded-lg"
                                    />
                                </div>

                                {/* Summary + Download */}
                                <div className="card">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            {summaryText && (
                                                <p className="text-sm text-gray-300">{summaryText}</p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-1">
                                                Categories: {Array.from(selectedCategories).map(k =>
                                                    DATA_CATEGORIES.find(c => c.key === k)?.label
                                                ).filter(Boolean).join(', ')}
                                            </p>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={handleSave}
                                                className="px-4 py-2 bg-green-600 hover:bg-green-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                                            >
                                                <Download className="w-4 h-4" />
                                                Download
                                            </button>
                                            <button
                                                onClick={handleSaveToLibrary}
                                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors shadow-lg"
                                            >
                                                <Save className="w-4 h-4" />
                                                Save to Library
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Empty State */}
                        {!isGenerating && !error && !generatedImage && (
                            <div className="card flex flex-col items-center justify-center py-16 text-center">
                                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center mb-4">
                                    <FileBarChart className="w-8 h-8 text-gray-600" />
                                </div>
                                <h3 className="text-gray-300 font-medium mb-2">No Report Generated Yet</h3>
                                <p className="text-sm text-gray-500 max-w-sm">
                                    Select a time frame and data categories, then click <strong className="text-gray-400">Generate Infographic</strong> to create a visual report from your analysis data.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ReportGeneratorPanel;
