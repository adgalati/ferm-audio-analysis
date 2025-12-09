import React, { useState, useEffect } from 'react';
import { Upload, Play, Save, RefreshCw, Database, Tag, LayoutList, Layers, Music } from 'lucide-react';
import TrainingDatasetView from './TrainingDatasetView';

const GENRES = [
    { id: 'hiphop', label: 'Hip-Hop' },
    { id: 'pop', label: 'Pop' },
    { id: 'rock', label: 'Rock' },
    { id: 'electronic', label: 'Electronic' },
];

const LABELS = {
    hiphop: [
        { id: 'mainstream_trap', label: 'Mainstream Trap' },
        { id: 'melodic_emo_trap', label: 'Melodic / Emo Trap' },
        { id: 'drill', label: 'Drill' },
        { id: 'rage_hypertrap', label: 'Rage / Hypertrap' },
        { id: 'lofi_chill_rap', label: 'Lo-fi / Chill Rap' },
        { id: 'phonk', label: 'Phonk' },
        { id: 'alt_experimental', label: 'Alt / Experimental' },
    ],
    pop: [
        { id: 'label1', label: 'Label 1' },
        { id: 'label2', label: 'Label 2' },
        { id: 'label3', label: 'Label 3' },
    ],
    rock: [
        { id: 'label1', label: 'Label 1' },
        { id: 'label2', label: 'Label 2' },
        { id: 'label3', label: 'Label 3' },
    ],
    electronic: [
        { id: 'label1', label: 'Label 1' },
        { id: 'label2', label: 'Label 2' },
        { id: 'label3', label: 'Label 3' },
    ],
};

export default function TrainingView() {
    const [activeTab, setActiveTab] = useState('labeling'); // 'labeling' or 'dataset'
    const [activeGenre, setActiveGenre] = useState('hiphop');
    const [selectedFiles, setSelectedFiles] = useState([]);
    const [selectedLabel, setSelectedLabel] = useState('');
    const [stats, setStats] = useState({ total: 0, perLabel: {} });
    const [isBuilding, setIsBuilding] = useState(false);
    const [logs, setLogs] = useState([]);
    const [trackId, setTrackId] = useState('');
    const [lastAnalysis, setLastAnalysis] = useState(null);

    useEffect(() => {
        fetchStats();

        const removeListener = window.electronAPI.onTrainingLog((log) => {
            setLogs(prev => [...prev.slice(-99), log.message]);
        });

        return () => {
            if (removeListener) removeListener();
        };
    }, [activeGenre]); // Re-fetch when genre changes

    const fetchStats = async () => {
        try {
            const result = await window.electronAPI.training('training:getLabelStats', { genre: activeGenre });
            if (result.success) {
                setStats(result.stats);
            }
        } catch (err) {
            console.error('Failed to fetch stats:', err);
        }
    };

    const handleFileSelect = async () => {
        try {
            const results = await window.electronAPI.selectFile({ multiple: true });
            if (results && results.length > 0) {
                setSelectedFiles(results);
                // Auto-assign next track IDs
                const startId = stats.nextTrackId || 1;
                if (results.length === 1) {
                    setTrackId(String(startId).padStart(4, '0'));
                } else {
                    const endId = startId + results.length - 1;
                    setTrackId(`${String(startId).padStart(4, '0')} - ${String(endId).padStart(4, '0')}`);
                }
                setLastAnalysis(null); // Reset analysis display for new file
            }
        } catch (err) {
            console.error('File selection failed:', err);
        }
    };

    const handleSaveLabel = async () => {
        if (selectedFiles.length === 0 || !selectedLabel) return;

        try {
            let currentId = stats.nextTrackId || 1;
            let successCount = 0;
            let failCount = 0;

            for (const file of selectedFiles) {
                const trackIdStr = String(currentId).padStart(4, '0');
                const result = await window.electronAPI.training('training:addLabel', {
                    trackId: trackIdStr,
                    audioPath: file.path,
                    label: selectedLabel,
                    genre: activeGenre
                });

                if (result.success) {
                    successCount++;
                    currentId++;
                } else {
                    failCount++;
                    console.error(`Failed to save label for ${file.name}:`, result.error);
                }
            }

            if (successCount > 0) {
                fetchStats();
                setSelectedFiles([]);
                setSelectedLabel('');
                setTrackId('');
                alert(`Successfully labeled ${successCount} tracks!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
            } else if (failCount > 0) {
                alert(`Failed to save labels. Check console for details.`);
            }
        } catch (err) {
            console.error('Save label error:', err);
            alert('Error saving labels');
        }
    };

    const handleBuildEmbeddings = async () => {
        setIsBuilding(true);
        setLogs(['Starting build process...']);
        setLastAnalysis(null);
        try {
            const result = await window.electronAPI.training('training:buildEmbeddings', { genre: activeGenre });
            if (result.success) {
                setLogs(prev => [...prev, 'Build complete!']);
                // Fetch the latest analysis to show immediate feedback
                fetchLatestAnalysis();
            } else {
                setLogs(prev => [...prev, 'Build failed: ' + result.error]);
            }
        } catch (err) {
            setLogs(prev => [...prev, 'Error: ' + err.message]);
        } finally {
            setIsBuilding(false);
        }
    };

    const fetchLatestAnalysis = async () => {
        try {
            const result = await window.electronAPI.training('training:getTrainingAnalysis', { genre: activeGenre });
            if (result.success && result.analysis) {
                // Find the analysis for the most recently added track (highest ID)
                const ids = Object.keys(result.analysis).sort();
                if (ids.length > 0) {
                    const lastId = ids[ids.length - 1];
                    setLastAnalysis(result.analysis[lastId]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch latest analysis:', err);
        }
    };

    const handleTrainClassifier = async () => {
        setLogs(prev => [...prev, `Starting ${activeGenre} classifier training...`]);
        try {
            const result = await window.electronAPI.training('training:trainClassifier', { genre: activeGenre });
            if (result.success) {
                setLogs(prev => [...prev, 'Training complete!', result.output]);
            } else {
                setLogs(prev => [...prev, 'Training failed: ' + result.error]);
            }
        } catch (err) {
            setLogs(prev => [...prev, 'Error: ' + err.message]);
        }
    };

    return (
        <div className="space-y-6">
            {/* Genre Selection Tabs */}
            <div className="flex gap-2 border-b border-gray-700 pb-2 overflow-x-auto">
                {GENRES.map(genre => (
                    <button
                        key={genre.id}
                        onClick={() => setActiveGenre(genre.id)}
                        className={`px-4 py-2 rounded-lg flex items-center gap-2 transition-colors whitespace-nowrap ${activeGenre === genre.id
                            ? 'bg-primary-600 text-white shadow-lg shadow-primary-900/50'
                            : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-gray-200'
                            }`}
                    >
                        <Music className="w-4 h-4" />
                        {genre.label}
                    </button>
                ))}
            </div>

            {/* Mode Navigation */}
            <div className="flex gap-4 border-b border-gray-700 pb-2">
                <button
                    onClick={() => setActiveTab('labeling')}
                    className={`px-4 py-2 rounded-t-lg flex items-center gap-2 transition-colors ${activeTab === 'labeling'
                        ? 'bg-gray-800 text-primary-400 border-b-2 border-primary-500'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                        }`}
                >
                    <Tag className="w-4 h-4" />
                    Labeling & Training
                </button>
                <button
                    onClick={() => setActiveTab('dataset')}
                    className={`px-4 py-2 rounded-t-lg flex items-center gap-2 transition-colors ${activeTab === 'dataset'
                        ? 'bg-gray-800 text-primary-400 border-b-2 border-primary-500'
                        : 'text-gray-400 hover:text-gray-200 hover:bg-gray-800/50'
                        }`}
                >
                    <Database className="w-4 h-4" />
                    Dataset View
                </button>
            </div>

            {activeTab === 'dataset' ? (
                <TrainingDatasetView genre={activeGenre} />
            ) : (
                <>
                    {/* Labeling Panel */}
                    <div className="card p-6 bg-gray-800 rounded-lg border border-gray-700">
                        <h2 className="text-xl font-bold text-primary-400 mb-4 flex items-center gap-2">
                            <Tag className="w-5 h-5" />
                            Label Track ({GENRES.find(g => g.id === activeGenre)?.label})
                        </h2>

                        <div className="space-y-4">
                            {/* File Selection */}
                            <div className="flex gap-4 items-end">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Audio Files</label>
                                    <div className="flex gap-2">
                                        <div className="flex-1 bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap flex items-center">
                                            {selectedFiles.length === 0
                                                ? <span className="text-gray-500">Select tracks...</span>
                                                : selectedFiles.length === 1
                                                    ? selectedFiles[0].path
                                                    : `${selectedFiles.length} files selected`
                                            }
                                        </div>
                                        <button
                                            onClick={handleFileSelect}
                                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center gap-2"
                                        >
                                            <Upload className="w-4 h-4" />
                                            Select
                                        </button>
                                    </div>
                                    {selectedFiles.length > 1 && (
                                        <div className="mt-2 max-h-32 overflow-y-auto bg-gray-900/50 rounded p-2 text-xs text-gray-400 border border-gray-800 custom-scrollbar">
                                            {selectedFiles.map((f, i) => (
                                                <div key={i} className="truncate py-0.5 border-b border-gray-800/50 last:border-0">
                                                    {f.name}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Track ID */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Track ID</label>
                                <input
                                    type="text"
                                    value={trackId}
                                    readOnly
                                    className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-gray-500 cursor-not-allowed"
                                    placeholder="Auto-generated ID"
                                />
                            </div>

                            {/* Label Selection */}
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Genre Label</label>
                                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                    {LABELS[activeGenre].map((l) => (
                                        <button
                                            key={l.id}
                                            onClick={() => setSelectedLabel(l.id)}
                                            className={`px-3 py-2 rounded text-sm text-left transition-colors ${selectedLabel === l.id
                                                ? 'bg-primary-600 text-white ring-2 ring-primary-400'
                                                : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                                                }`}
                                        >
                                            {l.label}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Save Button */}
                            <div className="pt-2">
                                <button
                                    onClick={handleSaveLabel}
                                    disabled={selectedFiles.length === 0 || !selectedLabel}
                                    className="px-6 py-2 bg-primary-600 hover:bg-primary-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded font-medium flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    Save Label
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Dataset Status Panel */}
                        <div className="card p-6 bg-gray-800 rounded-lg border border-gray-700">
                            <h2 className="text-xl font-bold text-primary-400 mb-4 flex items-center gap-2">
                                <Database className="w-5 h-5" />
                                Dataset Status
                            </h2>

                            <div className="space-y-4">
                                <div className="text-3xl font-bold text-white">
                                    {stats.total} <span className="text-lg text-gray-400 font-normal">labeled tracks</span>
                                </div>

                                <div className="space-y-2">
                                    {LABELS[activeGenre].map(l => {
                                        const count = stats.perLabel[l.id] || 0;
                                        const percent = stats.total > 0 ? (count / stats.total) * 100 : 0;
                                        return (
                                            <div key={l.id} className="space-y-1">
                                                <div className="flex justify-between text-sm">
                                                    <span className="text-gray-300">{l.label}</span>
                                                    <span className="text-gray-400">{count}</span>
                                                </div>
                                                <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-primary-500 transition-all duration-500"
                                                        style={{ width: `${percent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Actions Panel (Embeddings & Training) */}
                        <div className="card p-6 bg-gray-800 rounded-lg border border-gray-700">
                            <h2 className="text-xl font-bold text-primary-400 mb-4 flex items-center gap-2">
                                <RefreshCw className={`w-5 h-5 ${isBuilding ? 'animate-spin' : ''}`} />
                                Actions
                            </h2>

                            <div className="space-y-6">
                                {/* Generate Embeddings */}
                                <div className="space-y-2">
                                    <h3 className="text-sm font-medium text-gray-300">1. Generate Embeddings</h3>
                                    <p className="text-xs text-gray-400">
                                        Extract embeddings for any new labeled tracks. This runs locally and saves .npy files.
                                    </p>
                                    <button
                                        onClick={handleBuildEmbeddings}
                                        disabled={isBuilding}
                                        className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:opacity-50 text-white rounded flex items-center justify-center gap-2"
                                    >
                                        {isBuilding ? 'Building...' : 'Generate Embeddings'}
                                    </button>
                                </div>

                                {/* Last Analysis Result */}
                                {lastAnalysis && (
                                    <div className="bg-gray-900/50 p-4 rounded border border-gray-700 animate-in fade-in slide-in-from-top-2">
                                        <h4 className="text-sm font-bold text-primary-300 mb-2 flex items-center gap-2">
                                            <Layers className="w-4 h-4" />
                                            Last Analysis Results
                                        </h4>
                                        <div className="text-xs text-gray-400 mb-2 truncate" title={lastAnalysis.audio_path}>
                                            {lastAnalysis.audio_path.split(/[\\/]/).pop()}
                                        </div>
                                        <div className="space-y-1">
                                            {lastAnalysis.results.slice(0, 7).map((tag, i) => (
                                                <div key={i} className="flex justify-between text-xs">
                                                    <span className="text-gray-300">{tag.genre} {tag.subgenre ? `- ${tag.subgenre}` : ''}</span>
                                                    <span className="text-gray-500 font-mono">{(tag.score * 100).toFixed(0)}%</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Train Classifier */}
                                <div className="space-y-2 border-t border-gray-700 pt-4">
                                    <h3 className="text-sm font-medium text-gray-300">2. Train Classifier</h3>
                                    <p className="text-xs text-gray-400">
                                        Train a new classifier model using the generated embeddings.
                                    </p>
                                    <button
                                        onClick={handleTrainClassifier}
                                        className="w-full px-4 py-2 bg-primary-600 hover:bg-primary-500 text-white rounded flex items-center justify-center gap-2"
                                    >
                                        Train Classifier
                                    </button>
                                </div>

                                {/* Logs */}
                                <div className="mt-4 bg-gray-900 rounded p-3 h-48 overflow-y-auto font-mono text-xs text-gray-400">
                                    {logs.length === 0 ? (
                                        <span className="italic opacity-50">Ready...</span>
                                    ) : (
                                        logs.map((log, i) => (
                                            <div key={i} className="whitespace-pre-wrap border-b border-gray-800 pb-1 mb-1 last:border-0">
                                                {log}
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
