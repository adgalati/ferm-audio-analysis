import React, { useState, useEffect } from 'react';
import { Star, Trophy, Calendar, Download, RefreshCw, Filter, Award, BarChart3, Plus, Clock } from 'lucide-react';
import PeriodSelector from './PeriodSelector.jsx';
import LeaderboardCard from './LeaderboardCard.jsx';

function FERMFavesTab({ onScoreRecord, autoSwitchToLeaderboard = false, onSwitchComplete }) {
  const [periods, setPeriods] = useState([]);
  const [selectedPeriod, setSelectedPeriod] = useState(null);
  const [leaderboard, setLeaderboard] = useState([]);
  const [favoritesQueue, setFavoritesQueue] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(true); // Default to favorites queue
  const [stats, setStats] = useState(null);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [viewMode, setViewMode] = useState('queue'); // 'queue' | 'leaderboard'
  const [currentPeriod, setCurrentPeriod] = useState(null);
  const [isEndingPeriod, setIsEndingPeriod] = useState(false);

  // Initialize MongoDB connection on mount
  useEffect(() => {
    initializeConnection();
  }, []);

  // Load periods when connected
  useEffect(() => {
    if (isConnected) {
      loadPeriods();
    }
  }, [isConnected]);

  // Load data when period or filter changes
  useEffect(() => {
    if (selectedPeriod !== undefined && isConnected) {
      if (viewMode === 'queue') {
        loadFavoritesQueue();
      } else {
        loadLeaderboard();
      }
    }
  }, [selectedPeriod, showFavoritesOnly, isConnected, viewMode]);

  // Auto-switch to leaderboard when returning from scoring
  useEffect(() => {
    if (autoSwitchToLeaderboard && viewMode === 'queue') {
      setViewMode('leaderboard');
      // Notify parent that switch is complete
      if (onSwitchComplete) {
        onSwitchComplete();
      }
    }
  }, [autoSwitchToLeaderboard, viewMode, onSwitchComplete]);

  const initializeConnection = async () => {
    try {
      const result = await window.electronAPI.mongodb('mongodb:initialize', {});
      if (result.success) {
        setIsConnected(true);
      } else {
        setIsConnected(false);
        console.error('MongoDB connection failed:', result.error);
      }
    } catch (error) {
      setIsConnected(false);
      console.error('MongoDB connection error:', error);
    }
  };

  const loadPeriods = async () => {
    try {
      const result = await window.electronAPI.mongodb('mongodb:get-periods-list', {});
      if (result.success) {
        const periodsList = result.periods || [];
        setPeriods(periodsList);
        
        // Set current period (most recent)
        if (periodsList.length > 0) {
          const latestPeriod = periodsList[periodsList.length - 1];
          setCurrentPeriod(latestPeriod);
          setSelectedPeriod(latestPeriod);
        } else {
          // No periods exist, create the first one
          await createNewPeriod();
        }
      }
    } catch (error) {
      console.error('Error loading periods:', error);
    }
  };

  const createNewPeriod = async () => {
    try {
      // Calculate current period
      const now = new Date();
      const { calculatePeriod } = await import('../../utils/period-calculator.js');
      const { period, periodStart, periodEnd } = calculatePeriod(now, 'weekly', 1);
      
      console.log('[FERM Faves] Calculated period:', { period, periodStart, periodEnd });
      
      // Create period entry in MongoDB
      const result = await window.electronAPI.mongodb('mongodb:create-period-entry', {
        period,
        periodStart,
        periodEnd,
        periodType: 'weekly'
      });
      
      if (result.success) {
        console.log('[FERM Faves] Created period entry:', result.id);
        setCurrentPeriod(period);
        setSelectedPeriod(period);
        
        // Refresh periods list
        await loadPeriods();
        
        console.log('[FERM Faves] Created new period:', period);
      } else {
        console.error('[FERM Faves] Failed to create period entry:', result.error);
      }
    } catch (error) {
      console.error('Error creating new period:', error);
    }
  };

  const endCurrentPeriod = async () => {
    try {
      setIsEndingPeriod(true);
      
      // Create a new period for future submissions
      await createNewPeriod();
      
      console.log('[FERM Faves] Ended current period, started new one');
      
      // Refresh data
      await loadPeriods();
      
    } catch (error) {
      console.error('Error ending period:', error);
    } finally {
      setIsEndingPeriod(false);
    }
  };

  const loadFavoritesQueue = async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.mongodb('mongodb:query-records', {
        isFavorite: true,
        timePeriod: selectedPeriod || null,
        sortBy: 'date',
        sortOrder: -1,
        limit: 100
      });

      if (result.success) {
        const favorites = result.records || [];
        setFavoritesQueue(favorites);
        calculateStats(favorites);
      } else {
        console.error('Error loading favorites queue:', result.error);
        setFavoritesQueue([]);
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading favorites queue:', error);
      setFavoritesQueue([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  const loadLeaderboard = async () => {
    if (!selectedPeriod) {
      setLeaderboard([]);
      setStats(null);
      return;
    }

    setIsLoading(true);
    try {
      const result = await window.electronAPI.mongodb('mongodb:get-top-by-period', {
        timePeriod: selectedPeriod,
        limit: 10,
        favoritesOnly: showFavoritesOnly
      });

      if (result.success) {
        setLeaderboard(result.records || []);
        calculateStats(result.records || []);
      } else {
        console.error('Error loading leaderboard:', result.error);
        setLeaderboard([]);
        setStats(null);
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
      setLeaderboard([]);
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateStats = (records) => {
    if (records.length === 0) {
      setStats(null);
      return;
    }

    const fermScores = records.map(r => r.fermFactor).filter(f => f !== null);
    const avgFerm = fermScores.length > 0 
      ? fermScores.reduce((sum, score) => sum + score, 0) / fermScores.length 
      : 0;

    const genreCounts = {};
    records.forEach(record => {
      const genre = record.topGenre || 'Unknown';
      genreCounts[genre] = (genreCounts[genre] || 0) + 1;
    });

    const topGenres = Object.entries(genreCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3);

    setStats({
      totalRecords: records.length,
      averageFerm: avgFerm,
      topGenres,
      recordsWithFerm: fermScores.length
    });
  };

  const handleFavoriteToggled = async (record, isFavorite) => {
    try {
      const result = await window.electronAPI.mongodb('mongodb:update-favorite-status', {
        id: record._id,
        isFavorite,
        notes: record.favoriteNotes
      });

      if (result.success) {
        // Update the record in both leaderboard and queue
        setLeaderboard(prev => 
          prev.map(r => 
            r._id === record._id 
              ? { ...r, isFavorite, favoriteMarkedAt: isFavorite ? new Date() : null }
              : r
          )
        );
        
        setFavoritesQueue(prev => 
          prev.map(r => 
            r._id === record._id 
              ? { ...r, isFavorite, favoriteMarkedAt: isFavorite ? new Date() : null }
              : r
          )
        );

        // If unfavorited, remove from queue
        if (!isFavorite && viewMode === 'queue') {
          setFavoritesQueue(prev => prev.filter(r => r._id !== record._id));
        }
      }
    } catch (error) {
      console.error('Error updating favorite status:', error);
    }
  };

  const handleResetScore = async (record) => {
    try {
      const result = await window.electronAPI.mongodb('mongodb:update-ferm-factor', {
        id: record._id,
        fermFactor: null
      });

      if (result.success) {
        console.log('[FERM Faves] Score reset successfully');
        
        // Update the record in both leaderboard and queue
        const updatedRecord = { ...record, fermFactor: null };
        
        setLeaderboard(prev => 
          prev.map(r => 
            r._id === record._id ? updatedRecord : r
          )
        );
        
        setFavoritesQueue(prev => 
          prev.map(r => 
            r._id === record._id ? updatedRecord : r
          )
        );

        // If in leaderboard view and this was the only scored record, switch to queue
        if (viewMode === 'leaderboard' && showFavoritesOnly) {
          const remainingScoredRecords = leaderboard.filter(r => r._id !== record._id && r.fermFactor !== null);
          if (remainingScoredRecords.length === 0) {
            setViewMode('queue');
          }
        }
      }
    } catch (error) {
      console.error('Error resetting score:', error);
    }
  };

  const handleExportLeaderboard = () => {
    if (leaderboard.length === 0) return;

    const csv = [
      ['Rank', 'Clip Name', 'FERM Factor', 'Genre', 'Key', 'Timing', 'Key Fit', 'Date', 'Favorite Notes'].join(','),
      ...leaderboard.map((record, index) => [
        index + 1,
        `"${record.clipName}"`,
        record.fermFactor?.toFixed(2) || 'N/A',
        `"${record.topGenreWithStyle || record.topGenre || 'Unknown'}"`,
        `"${record.keyFit?.key || 'N/A'}"`,
        record.timingTightness?.toFixed(2) || 'N/A',
        record.keyFit?.score?.toFixed(1) || 'N/A',
        new Date(record.date).toLocaleDateString(),
        `"${record.favoriteNotes || ''}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `ferm-faves-${selectedPeriod || 'all-time'}-${Date.now()}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const getPeriodDisplayName = (period) => {
    if (!period) return 'All Time';
    return period;
  };

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="card">
          <div className="flex items-center gap-3">
            <div className="w-5 h-5 bg-yellow-400 rounded-full animate-pulse"></div>
            <div>
              <h3 className="text-lg font-semibold text-yellow-400 mb-2">Connecting to MongoDB...</h3>
              <p className="text-gray-300">
                Please wait while we establish connection to the cloud database.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Trophy className="w-6 h-6 text-yellow-400" />
              FERM Faves
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {viewMode === 'queue' 
                ? 'Queue of favorited submissions awaiting FERM Factor scores'
                : 'Top submissions ranked by FERM Factor score'
              }
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleExportLeaderboard}
              disabled={leaderboard.length === 0}
              className="px-3 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <button
              onClick={loadLeaderboard}
              disabled={isLoading}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* View Mode Toggle */}
        <div className="flex items-center gap-2 mb-4">
          <span className="text-sm text-gray-300">View:</span>
          <div className="flex bg-gray-700 rounded-lg p-1">
            <button
              onClick={() => setViewMode('queue')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'queue'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Favorites Queue
            </button>
            <button
              onClick={() => setViewMode('leaderboard')}
              className={`px-3 py-1 text-sm rounded transition-colors ${
                viewMode === 'leaderboard'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              Leaderboard
            </button>
          </div>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-400" />
            <span className="text-sm text-gray-300">Period:</span>
            <PeriodSelector
              selectedPeriod={selectedPeriod}
              onPeriodChange={setSelectedPeriod}
              periods={periods}
              isLoading={isLoading}
            />
          </div>

          {/* Current Period Info */}
          {currentPeriod && (
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-900/20 border border-blue-700/30 rounded-lg">
              <Clock className="w-4 h-4 text-blue-400" />
              <span className="text-sm text-blue-300">Current: {currentPeriod}</span>
            </div>
          )}

          {/* End Period Button */}
          <button
            onClick={endCurrentPeriod}
            disabled={isEndingPeriod}
            className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-600 text-white text-sm rounded transition-colors"
          >
            <Plus className={`w-4 h-4 ${isEndingPeriod ? 'animate-spin' : ''}`} />
            {isEndingPeriod ? 'Ending...' : 'End Period'}
          </button>

          {viewMode === 'leaderboard' && (
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input
                  type="checkbox"
                  checked={showFavoritesOnly}
                  onChange={(e) => setShowFavoritesOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-blue-600 focus:ring-2 focus:ring-blue-500"
                />
                Show Favorites Only
              </label>
            </div>
          )}
        </div>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="card">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-5 h-5 text-blue-400" />
            <h3 className="text-lg font-semibold">Period Statistics</h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-400">{stats.totalRecords}</div>
              <div className="text-xs text-gray-400">Total Records</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">
                {stats.averageFerm.toFixed(2)}
              </div>
              <div className="text-xs text-gray-400">Avg FERM Factor</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-400">{stats.recordsWithFerm}</div>
              <div className="text-xs text-gray-400">With FERM Score</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-yellow-400">
                {stats.topGenres.length > 0 ? stats.topGenres[0][0] : 'N/A'}
              </div>
              <div className="text-xs text-gray-400">Top Genre</div>
            </div>
          </div>

          {/* Top Genres */}
          {stats.topGenres.length > 0 && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <div className="text-sm text-gray-400 mb-2">Top Genres</div>
              <div className="flex flex-wrap gap-2">
                {stats.topGenres.map(([genre, count], index) => (
                  <span
                    key={genre}
                    className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded"
                  >
                    <span className="text-gray-500">#{index + 1}</span>
                    {genre}
                    <span className="text-gray-500">({count})</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Main Content */}
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            {viewMode === 'queue' ? 'Favorites Queue' : 'Leaderboard'}
          </h3>
          <div className="text-sm text-gray-400">
            {getPeriodDisplayName(selectedPeriod)}
            {viewMode === 'queue' 
              ? (favoritesQueue.length > 0 && ` • ${favoritesQueue.length} favorites`)
              : (leaderboard.length > 0 && ` • ${leaderboard.length} records`)
            }
          </div>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="inline-block animate-spin mb-3">
              <RefreshCw className="w-6 h-6 text-gray-400" />
            </div>
            <p className="text-gray-400">Loading {viewMode === 'queue' ? 'favorites queue' : 'leaderboard'}...</p>
          </div>
        ) : viewMode === 'queue' ? (
          favoritesQueue.length === 0 ? (
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-2">
                No favorites found
                {selectedPeriod && ` for ${getPeriodDisplayName(selectedPeriod)}`}
              </p>
              <p className="text-sm text-gray-500">
                Mark submissions as favorites in the Analysis or Cloud Storage tabs to see them here
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Queue Instructions */}
              <div className="bg-blue-900/20 border border-blue-700/30 rounded-lg p-4 mb-6">
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-semibold text-blue-300 mb-2">Favorites Queue</h4>
                    <p className="text-sm text-blue-200 mb-3">
                      These are your favorited submissions awaiting FERM Factor scores. 
                      Assign scores in the FERM Factor tab, then switch to Leaderboard view to see rankings.
                    </p>
                    <div className="flex items-center gap-4 text-xs text-blue-300">
                      <span>📊 {favoritesQueue.filter(r => r.fermFactor !== null).length} with FERM scores</span>
                      <span>⭐ {favoritesQueue.filter(r => r.fermFactor === null).length} awaiting scores</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Queue Items */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {favoritesQueue.map((record, index) => (
                  <LeaderboardCard
                    key={record._id}
                    record={record}
                    rank={index + 1}
                    onViewDetails={setSelectedRecord}
                    onFavoriteToggled={(isFavorite) => handleFavoriteToggled(record, isFavorite)}
                    onScoreRecord={onScoreRecord}
                    onResetScore={handleResetScore}
                    showFavoriteToggle={true}
                    showScoreButton={true}
                    showResetButton={false}
                  />
                ))}
              </div>
            </div>
          )
        ) : (
          leaderboard.length === 0 ? (
            <div className="text-center py-8">
              <Trophy className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 mb-2">
                {selectedPeriod 
                  ? `No records found for ${getPeriodDisplayName(selectedPeriod)}`
                  : 'Select a period to view the leaderboard'
                }
              </p>
              {showFavoritesOnly && (
                <p className="text-sm text-gray-500">
                  Try unchecking "Show Favorites Only" to see all records
                </p>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaderboard.map((record, index) => (
                <LeaderboardCard
                  key={record._id}
                  record={record}
                  rank={index + 1}
                  onViewDetails={setSelectedRecord}
                  onFavoriteToggled={(isFavorite) => handleFavoriteToggled(record, isFavorite)}
                  onScoreRecord={onScoreRecord}
                  onResetScore={handleResetScore}
                  showFavoriteToggle={true}
                  showScoreButton={true}
                  showResetButton={true}
                />
              ))}
            </div>
          )
        )}
      </div>

      {/* Detail Modal */}
      {selectedRecord && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-gray-800 rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-lg">
            <div className="sticky top-0 flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
              <h3 className="text-lg font-semibold">{selectedRecord.clipName}</h3>
              <button
                onClick={() => setSelectedRecord(null)}
                className="text-gray-400 hover:text-gray-300"
              >
                ×
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">FERM Factor</div>
                  <div className="text-2xl font-bold text-blue-400">
                    {selectedRecord.fermFactor?.toFixed(2) || 'N/A'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Date</div>
                  <div className="text-gray-200">
                    {new Date(selectedRecord.date).toLocaleString()}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-gray-500">Genre</div>
                  <div className="text-gray-200">
                    {selectedRecord.topGenreWithStyle || selectedRecord.topGenre || 'Unknown'}
                  </div>
                </div>
                <div>
                  <div className="text-sm text-gray-500">Key</div>
                  <div className="text-gray-200">
                    {selectedRecord.keyFit?.key || 'N/A'}
                  </div>
                </div>
              </div>
              {selectedRecord.favoriteNotes && (
                <div>
                  <div className="text-sm text-gray-500 mb-1">Notes</div>
                  <div className="text-gray-200 italic">
                    "{selectedRecord.favoriteNotes}"
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FERMFavesTab;
