import React, { useState } from 'react';
import { Search, Compass, Sparkles, Loader2, ExternalLink, Filter, Map } from 'lucide-react';
import UmapScatterPlot from './UmapScatterPlot';

/**
 * SearchTab - FAISS semantic search UI component
 * 
 * Displays buttons to find similar tracks and compute novelty score.
 * Requires embeddingPath to be available in results.
 */
function SearchTab({ results, clipName }) {
    const [isSearching, setIsSearching] = useState(false);
    const [isComputingNovelty, setIsComputingNovelty] = useState(false);
    const [similarTracks, setSimilarTracks] = useState(null);
    const [noveltyResult, setNoveltyResult] = useState(null);
    const [error, setError] = useState(null);
    const [sourceTypeFilter, setSourceTypeFilter] = useState('all');
    const [showMap, setShowMap] = useState(false);

    // Get embedding path from results
    const embeddingPath = results?.autotagging?.embeddingPath || results?.embeddingPath;
    const hasEmbedding = !!embeddingPath;

    const handleFindSimilar = async () => {
        if (!embeddingPath) return;

        setIsSearching(true);
        setError(null);
        setSimilarTracks(null);

        try {
            const result = await window.electronAPI.search('search:find-similar', {
                mongoId: clipName, // Using clipName as reference
                embeddingPath,
                k: 5,
                sourceTypeFilter: sourceTypeFilter === 'all' ? null : sourceTypeFilter
            });

            if (result.success) {
                setSimilarTracks(result.results);
            } else {
                setError(result.error || 'Search failed');
            }
        } catch (err) {
            setError(err.message || 'Search error');
        } finally {
            setIsSearching(false);
        }
    };

    const handleComputeNovelty = async () => {
        if (!embeddingPath) return;

        setIsComputingNovelty(true);
        setError(null);
        setNoveltyResult(null);

        try {
            const result = await window.electronAPI.search('search:compute-novelty', {
                mongoId: clipName,
                embeddingPath,
                k: 10,
                sourceTypeFilter: sourceTypeFilter === 'all' ? null : sourceTypeFilter
            });

            if (result.success) {
                setNoveltyResult(result);
            } else {
                setError(result.error || 'Novelty computation failed');
            }
        } catch (err) {
            setError(err.message || 'Novelty error');
        } finally {
            setIsComputingNovelty(false);
        }
    };

    // Get novelty label
    const getNoveltyLabel = (score) => {
        if (score >= 0.7) return { text: 'Very Unique', color: 'text-purple-400' };
        if (score >= 0.5) return { text: 'Fairly Unique', color: 'text-blue-400' };
        if (score >= 0.3) return { text: 'Moderate', color: 'text-yellow-400' };
        return { text: 'Common Style', color: 'text-green-400' };
    };

    if (!hasEmbedding) {
        return (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                <div className="text-center text-gray-400">
                    <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p className="text-lg font-medium mb-2">No Embedding Available</p>
                    <p className="text-sm">
                        Run analysis with Genre Tags (MAEST) enabled to extract the audio embedding.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Filter Dropdown */}
            <div className="flex items-center justify-between bg-gray-800/50 rounded-lg p-4 border border-gray-700">
                <div className="flex items-center gap-3">
                    <Filter className="w-5 h-5 text-gray-400" />
                    <span className="text-gray-300 font-medium">Compare Against</span>
                </div>
                <select
                    value={sourceTypeFilter}
                    onChange={(e) => setSourceTypeFilter(e.target.value)}
                    className="bg-gray-700 border border-gray-600 rounded-lg px-4 py-2 text-white
                               focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
                               cursor-pointer"
                >
                    <option value="all">All Indexed Tracks</option>
                    <option value="mainstream">Mainstream Only</option>
                    <option value="independent">Independent Only</option>
                </select>
            </div>

            {/* Action Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Find Similar Button */}
                <button
                    onClick={handleFindSimilar}
                    disabled={isSearching}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     rounded-lg p-6 text-left transition-all duration-200
                     border border-blue-500/30 hover:border-blue-400/50"
                >
                    <div className="flex items-center gap-4">
                        {isSearching ? (
                            <Loader2 className="w-8 h-8 text-blue-300 animate-spin" />
                        ) : (
                            <Compass className="w-8 h-8 text-blue-300" />
                        )}
                        <div>
                            <div className="text-lg font-semibold text-white">
                                {isSearching ? 'Searching...' : 'Find Similar Tracks'}
                            </div>
                            <div className="text-sm text-blue-200/70">
                                Search the index for nearest neighbors
                            </div>
                        </div>
                    </div>
                </button>

                {/* Compute Novelty Button */}
                <button
                    onClick={handleComputeNovelty}
                    disabled={isComputingNovelty}
                    className="bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-500 hover:to-purple-600 
                     disabled:opacity-50 disabled:cursor-not-allowed
                     rounded-lg p-6 text-left transition-all duration-200
                     border border-purple-500/30 hover:border-purple-400/50"
                >
                    <div className="flex items-center gap-4">
                        {isComputingNovelty ? (
                            <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
                        ) : (
                            <Sparkles className="w-8 h-8 text-purple-300" />
                        )}
                        <div>
                            <div className="text-lg font-semibold text-white">
                                {isComputingNovelty ? 'Computing...' : 'Compute Novelty Score'}
                            </div>
                            <div className="text-sm text-purple-200/70">
                                How unique is this track in the collection?
                            </div>
                        </div>
                    </div>
                </button>
            </div>

            {/* View on Map Button */}
            <button
                onClick={() => setShowMap(!showMap)}
                className={`w-full rounded-lg p-4 text-left transition-all duration-200 border ${showMap
                        ? 'bg-indigo-700/30 border-indigo-500/50'
                        : 'bg-gray-800/50 hover:bg-gray-700/50 border-gray-700 hover:border-indigo-500/30'
                    }`}
            >
                <div className="flex items-center gap-3">
                    <Map className={`w-5 h-5 ${showMap ? 'text-indigo-400' : 'text-gray-400'}`} />
                    <div>
                        <div className="font-medium text-white text-sm">
                            {showMap ? 'Hide Map' : 'View on Map'}
                        </div>
                        <div className="text-xs text-gray-400">
                            See this track in the UMAP embedding space
                        </div>
                    </div>
                </div>
            </button>

            {/* UMAP Scatter Plot */}
            {showMap && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                    <h3 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                        <Map className="w-4 h-4 text-indigo-400" />
                        UMAP Embedding Map
                    </h3>
                    <UmapScatterPlot
                        highlightId={clipName}
                        sourceTypeFilter={sourceTypeFilter}
                        compact={true}
                    />
                </div>
            )}

            {/* Error Display */}
            {error && (
                <div className="bg-red-900/30 border border-red-500/50 rounded-lg p-4">
                    <p className="text-red-400">{error}</p>
                </div>
            )}

            {/* Novelty Result */}
            {noveltyResult && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-400" />
                        Novelty Score
                    </h3>
                    <div className="flex items-center gap-6">
                        <div className="text-5xl font-bold text-white">
                            {(noveltyResult.novelty_score * 100).toFixed(1)}%
                        </div>
                        <div>
                            <div className={`text-xl font-medium ${getNoveltyLabel(noveltyResult.novelty_score).color}`}>
                                {getNoveltyLabel(noveltyResult.novelty_score).text}
                            </div>
                            <div className="text-sm text-gray-400 mt-1">
                                Avg similarity to {noveltyResult.neighbors_found} neighbors: {(noveltyResult.avg_similarity * 100).toFixed(1)}%
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Similar Tracks Results */}
            {similarTracks && similarTracks.length > 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Compass className="w-5 h-5 text-blue-400" />
                        Similar Tracks ({similarTracks.length})
                    </h3>
                    <div className="space-y-3">
                        {similarTracks.map((track, index) => (
                            <div
                                key={track.mongo_id || index}
                                className="bg-gray-900/50 rounded-lg p-4 border border-gray-700/50
                           hover:border-gray-600 transition-colors"
                            >
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-8 h-8 rounded-full bg-blue-600/20 flex items-center justify-center
                                    text-blue-400 font-semibold text-sm">
                                            {track.rank}
                                        </div>
                                        <div>
                                            <div className="font-medium text-white">
                                                {track.clipName || 'Unknown Track'}
                                            </div>
                                            <div className="text-sm text-gray-400 flex items-center gap-2">
                                                {track.topGenre && (
                                                    <span className="bg-gray-700 px-2 py-0.5 rounded text-xs">
                                                        {track.topGenre}
                                                    </span>
                                                )}
                                                {track.sourceType && (
                                                    <span className={`px-2 py-0.5 rounded text-xs ${track.sourceType === 'mainstream'
                                                        ? 'bg-amber-900/50 text-amber-400'
                                                        : 'bg-emerald-900/50 text-emerald-400'
                                                        }`}>
                                                        {track.sourceType}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-semibold text-blue-400">
                                            {(track.score * 100).toFixed(1)}%
                                        </div>
                                        <div className="text-xs text-gray-500">similarity</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {similarTracks && similarTracks.length === 0 && (
                <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 text-center text-gray-400">
                    No similar tracks found. The index may be empty.
                </div>
            )}

            {/* Index Info */}
            <div className="text-sm text-gray-500 text-center">
                Embedding: {embeddingPath?.split(/[/\\]/).pop() || 'Unknown'}
            </div>
        </div>
    );
}

export default SearchTab;
