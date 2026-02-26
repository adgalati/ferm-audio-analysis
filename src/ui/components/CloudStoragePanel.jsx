import React, { useState, useEffect } from 'react';
import { Cloud, Download, Trash2, Database, RefreshCw, AlertCircle, Eye, X, Calendar, ExternalLink, ArrowLeftRight, Map, List } from 'lucide-react';
import CloudStorageFilters from './CloudStorageFilters';
import FavoriteToggleButton from './FavoriteToggleButton.jsx';
import UmapScatterPlot from './visualizations/UmapScatterPlot';

// Detail Modal Component
function RecordDetailModal({ record, onClose, onFavoriteToggled, onOpenAnalysis }) {
  const [notes, setNotes] = useState(record?.favoriteNotes || '');

  const handleSaveNotes = async () => {
    try {
      if (!record) return;
      await window.electronAPI.mongodb('mongodb:update-favorite-status', {
        id: record._id,
        isFavorite: record.isFavorite,
        notes
      });
    } catch (e) {
      console.error('Save notes error:', e);
    }
  };

  if (!record) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-800 rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto border border-gray-700 shadow-lg">
        <div className="sticky top-0 flex items-center justify-between p-4 bg-gray-900 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <FavoriteToggleButton
              recordId={record._id}
              clipName={record.clipName}
              isFavorite={record.isFavorite}
              onToggled={(fav) => onFavoriteToggled && onFavoriteToggled(fav)}
            />
            <h3 className="text-lg font-semibold">{record.clipName}</h3>
          </div>
          <div className="flex items-center gap-2">
            {onOpenAnalysis && (
              <button
                onClick={() => {
                  onOpenAnalysis(record);
                  onClose();
                }}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded flex items-center gap-2"
              >
                <Eye className="w-4 h-4" />
                Open Analysis
              </button>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Basic Info */}
          <div>
            <h4 className="font-semibold text-gray-200 mb-3">Basic Information</h4>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-gray-500">Date</div>
                <div className="text-gray-100">{new Date(record.date).toLocaleString()}</div>
              </div>
              <div>
                <div className="text-gray-500">Time Period</div>
                <div className="inline-flex items-center gap-2 text-gray-100">
                  <Calendar className="w-3 h-3 text-gray-400" />
                  {record.timePeriod || '—'}
                </div>
              </div>
              <div className="col-span-2">
                <div className="text-gray-500">Record ID</div>
                <div className="text-gray-300 font-mono text-xs break-all">{record._id}</div>
              </div>
            </div>
          </div>

          {/* FERM Factor */}
          {record.fermFactor !== null && (
            <div className="bg-blue-900/20 rounded p-4 border border-blue-700/30">
              <div className="text-gray-400 text-sm mb-1">FERM Factor</div>
              <div className="text-3xl font-bold text-blue-300">{record.fermFactor.toFixed(2)}</div>
            </div>
          )}

          {/* Key Analysis */}
          <div>
            <h4 className="font-semibold text-gray-200 mb-3">Key Analysis</h4>
            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-700/30 rounded p-3">
              <div>
                <div className="text-gray-500">Detected Key</div>
                <div className="text-gray-100">{record.keyFit?.key || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">Mode</div>
                <div className="text-gray-100">{record.keyFit?.mode || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">Key Fit Score</div>
                <div className="text-gray-100">{record.keyFit?.score?.toFixed(2) || 'N/A'}%</div>
              </div>
              <div>
                <div className="text-gray-500">In-Key Percentage</div>
                <div className="text-gray-100">{record.inKeyPercentage?.toFixed(1) || 'N/A'}%</div>
              </div>
            </div>
          </div>

          {/* Timing */}
          {record.timingTightness !== null && (
            <div>
              <h4 className="font-semibold text-gray-200 mb-3">Timing Analysis</h4>
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-700/30 rounded p-3">
                <div>
                  <div className="text-gray-500">Timing Tightness</div>
                  <div className="text-gray-100">{record.timingTightness.toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {/* Loudness Metrics */}
          <div>
            <h4 className="font-semibold text-gray-200 mb-3">Loudness Metrics</h4>
            <div className="grid grid-cols-3 gap-3 text-sm bg-gray-700/30 rounded p-3">
              <div>
                <div className="text-gray-500">LUFS</div>
                <div className="text-gray-100 font-mono">{record.loudness?.LUFS?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">LRA (LU)</div>
                <div className="text-gray-100 font-mono">{record.loudness?.LRA?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">TP (dBFS)</div>
                <div className="text-gray-100 font-mono">{record.loudness?.TP?.toFixed(2) || 'N/A'}</div>
              </div>
            </div>
          </div>

          {/* Gain Staging */}
          <div>
            <h4 className="font-semibold text-gray-200 mb-3">Gain Staging</h4>
            <div className="grid grid-cols-2 gap-4 text-sm bg-gray-700/30 rounded p-3">
              <div>
                <div className="text-gray-500">Delta LUFS</div>
                <div className="text-gray-100 font-mono">{record.gainStaging?.deltaLufs?.toFixed(2) || 'N/A'}</div>
              </div>
              <div>
                <div className="text-gray-500">Quality</div>
                <div className="text-gray-100 capitalize">
                  {record.gainStaging?.quality ? record.gainStaging.quality.replace(/-/g, ' ') : 'N/A'}
                </div>
              </div>
            </div>
          </div>

          {/* Spectral Analysis */}
          {record.spectral && (
            <div>
              <h4 className="font-semibold text-gray-200 mb-3">Spectral Analysis</h4>
              <div className="grid grid-cols-2 gap-4 text-sm bg-gray-700/30 rounded p-3">
                <div>
                  <div className="text-gray-500">Genre Fit</div>
                  <div className="text-gray-100">
                    {record.spectral.genreFit?.bestMatch || 'N/A'}
                    <span className="text-gray-400 text-xs ml-1">
                      ({record.spectral.genreFit?.bestScore?.toFixed(1)}%)
                    </span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500">Tonal Balance</div>
                  <div className="text-gray-100 text-xs flex gap-2">
                    <span>Bright: {record.spectral.snapshot?.tonal_balance?.brightness?.toFixed(2) || '-'}</span>
                    <span>Warm: {record.spectral.snapshot?.tonal_balance?.warmth?.toFixed(2) || '-'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Genre Tags */}
          <div>
            <h4 className="font-semibold text-gray-200 mb-3">Genre Tags (Top 7)</h4>
            <div className="space-y-2">
              {record.genreTags && record.genreTags.length > 0 ? (
                record.genreTags.map((tag, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-gray-700/30 rounded text-sm">
                    <div>
                      <div className="font-medium text-gray-100">
                        {tag.subgenre ? `${tag.genre} - ${tag.subgenre}` : tag.genre}
                      </div>
                      <div className="text-xs text-gray-500">#{idx + 1}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-gray-300">{(tag.score * 100).toFixed(1)}%</div>
                      <div className="w-24 bg-gray-600 rounded-full h-1 mt-1">
                        <div
                          className="bg-blue-500 h-1 rounded-full"
                          style={{ width: `${tag.score * 100}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-gray-500 text-sm">No genre data available</div>
              )}
            </div>
          </div>

          {/* Hip-Hop Substyles */}
          {record.hiphop_substyle?.enabled && record.hiphop_substyle.top_substyles?.length > 0 && (
            <div>
              <h4 className="font-semibold text-gray-200 mb-3">Hip-Hop Substyles</h4>
              <div className="space-y-2">
                {record.hiphop_substyle.top_substyles.map((sub, idx) => (
                  <div key={idx} className="flex items-center justify-between p-2 bg-purple-900/20 border border-purple-700/30 rounded text-sm">
                    <div className="font-medium text-purple-200">
                      {sub.label.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-purple-300">{(sub.prob * 100).toFixed(1)}%</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Favorite Notes */}
          <div>
            <h4 className="font-semibold text-gray-200 mb-3">Favorite Notes</h4>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Why is this a fave?"
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleSaveNotes}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded"
              >
                Save Notes
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CloudStoragePanel({ onSelectItem }) {
  const [records, setRecords] = useState([]);
  const [genres, setGenres] = useState([]);
  const [periods, setPeriods] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const [stats, setStats] = useState(null);
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 20
  });
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState(-1);
  const [filters, setFilters] = useState({});
  const [selectedRecords, setSelectedRecords] = useState(new Set());
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list' or 'map'

  // Initialize connection on mount
  useEffect(() => {
    initializeConnection();
  }, []);

  // Load data when connected
  useEffect(() => {
    if (isConnected) {
      loadData();
    }
  }, [isConnected]);

  // Auto-reload data when sort/filters change
  useEffect(() => {
    if (isConnected && !isLoading) {
      loadRecords();
    }
  }, [sortBy, sortOrder, filters]);

  // Reload when pagination page changes
  useEffect(() => {
    if (isConnected && pagination.page > 0) {
      loadRecords();
    }
  }, [pagination.page, pagination.limit]);

  const initializeConnection = async () => {
    try {
      const result = await window.electronAPI.mongodb('mongodb:initialize', {});
      if (result.success) {
        setIsConnected(true);
        setConnectionError(null);
      } else {
        setIsConnected(false);
        setConnectionError(result.error || result.message);
      }
    } catch (error) {
      setIsConnected(false);
      setConnectionError(error.message);
    }
  };

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load genres
      const genresResult = await window.electronAPI.mongodb('mongodb:get-unique-genres', {});
      if (genresResult.success) {
        setGenres(genresResult.genres || []);
      }

      // Load periods list
      const periodsResult = await window.electronAPI.mongodb('mongodb:get-periods-list', {});
      if (periodsResult.success) {
        setPeriods(periodsResult.periods || []);
      }

      // Load statistics
      const statsResult = await window.electronAPI.mongodb('mongodb:get-statistics', {});
      if (statsResult.success) {
        setStats(statsResult.stats);
      }

      // Load records with current filters and sort
      await loadRecords();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadRecords = async () => {
    setIsLoading(true);
    try {
      const queryOptions = {
        ...filters,
        sortBy,
        sortOrder,
        limit: pagination.limit,
        skip: (pagination.page - 1) * pagination.limit
      };

      const result = await window.electronAPI.mongodb('mongodb:query-records', queryOptions);

      if (result.success) {
        setRecords(result.records || []);
        setPagination(prev => ({
          ...prev,
          total: result.total || 0
        }));
        setSelectedRecords(new Set());
      } else {
        console.error('Query error:', result.error);
      }
    } catch (error) {
      console.error('Error loading records:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFilter = (newFilters) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, page: 1 }));
  };

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 1 ? -1 : 1);
    } else {
      setSortBy(field);
      setSortOrder(-1);
    }
  };

  const handleDeleteRecord = async (id) => {
    if (!window.confirm('Are you sure you want to delete this record?')) return;

    try {
      const result = await window.electronAPI.mongodb('mongodb:delete-record', id);
      if (result.success) {
        await loadRecords();
      } else {
        alert(`Error deleting record: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleToggleSourceType = async (id, currentSourceType) => {
    try {
      const newSourceType = currentSourceType === 'mainstream' ? 'independent' : 'mainstream';
      const result = await window.electronAPI.mongodb('mongodb:update-source-type', {
        id,
        sourceType: newSourceType
      });

      if (result.success) {
        await loadRecords();
      } else {
        alert(`Error toggling source type: ${result.error}`);
      }
    } catch (error) {
      alert(`Error: ${error.message}`);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedRecords.size === 0) return;
    if (!window.confirm(`Delete ${selectedRecords.size} record(s)?`)) return;

    setIsLoading(true);
    try {
      for (const id of selectedRecords) {
        await window.electronAPI.mongodb('mongodb:delete-record', id);
      }
      await loadRecords();
    } catch (error) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      const result = await window.electronAPI.mongodb('mongodb:export-records', filters);
      if (result.success && result.records && result.records.length > 0) {
        const csv = convertToCSV(result.records);
        downloadCSV(csv, `cloud-storage-export-${Date.now()}.csv`);
      } else {
        alert('No records to export');
      }
    } catch (error) {
      alert(`Export error: ${error.message}`);
    }
  };

  const convertToCSV = (records) => {
    const headers = [
      'Clip Name',
      'Date',
      'Time Period',
      'FERM Factor',
      'Key Detected',
      'Key Mode',
      'Key Fit Score (%)',
      'In-Key Percentage (%)',
      'Timing Tightness',
      'Loudness (LUFS)',
      'Loudness Range (LU)',
      'True Peak (dBFS)',
      'Gain Staging Delta (LUFS)',
      'Gain Quality',
      'Top Genre',
      'Top Genre With Style',
      'All Genres',
      'Is Favorite',
      'Favorite Notes'
    ];

    const rows = records.map(r => [
      r.clipName,
      new Date(r.date).toLocaleString(),
      r.timePeriod || '',
      r.fermFactor?.toFixed(2) || '',
      r.keyFit?.key || '',
      r.keyFit?.mode || '',
      r.keyFit?.score?.toFixed(2) || '',
      r.inKeyPercentage?.toFixed(1) || '',
      r.timingTightness?.toFixed(2) || '',
      r.loudness?.LUFS?.toFixed(2) || '',
      r.loudness?.LRA?.toFixed(2) || '',
      r.loudness?.TP?.toFixed(2) || '',
      r.gainStaging?.deltaLufs?.toFixed(2) || '',
      r.gainStaging?.quality || '',
      r.topGenre || '',
      r.topGenreWithStyle || '',
      r.genreTags.map(t => `${t.genre}${t.subgenre ? ` - ${t.subgenre}` : ''}(${(t.score * 100).toFixed(0)}%)`).join('; '),
      r.isFavorite ? 'Yes' : 'No',
      r.favoriteNotes || ''
    ]);

    return [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');
  };

  const downloadCSV = (csv, filename) => {
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const totalPages = Math.ceil(pagination.total / pagination.limit);

  if (!isConnected) {
    return (
      <div className="card space-y-4">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-lg font-semibold text-yellow-400 mb-2">Cloud Connection Required</h3>
            <p className="text-gray-300 mb-4">
              {connectionError || 'MongoDB is not connected. Your analysis data will be saved locally, and will sync to the cloud when connection is established.'}
            </p>
            <button
              onClick={initializeConnection}
              disabled={isLoading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              {isLoading ? 'Connecting...' : 'Retry Connection'}
            </button>
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
              <Cloud className="w-6 h-6 text-blue-400" />
              Cloud Storage
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Long-term data storage and retrieval from MongoDB
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-400">
              {pagination.total}
            </div>
            <div className="text-xs text-gray-400">Total Records</div>
          </div>
        </div>

        {/* Statistics */}
        {stats && (
          <div className="grid grid-cols-3 gap-4 mb-6 p-4 bg-gray-700 rounded">
            <div>
              <div className="text-xs text-gray-400">Avg FERM Factor</div>
              <div className="text-xl font-bold text-gray-100">
                {stats.averageFermFactor?.toFixed(2) || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Earliest Record</div>
              <div className="text-xs text-gray-200">
                {stats.dateRange?.earliest ? new Date(stats.dateRange.earliest).toLocaleDateString() : 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-xs text-gray-400">Latest Record</div>
              <div className="text-xs text-gray-200">
                {stats.dateRange?.latest ? new Date(stats.dateRange.latest).toLocaleDateString() : 'N/A'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Filters and Content */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Filters */}
        <div className="lg:col-span-1">
          <CloudStorageFilters
            genres={genres}
            periods={periods}
            onFilter={handleFilter}
            isLoading={isLoading}
          />
        </div>

        {/* Main Content */}
        <div className="lg:col-span-3 space-y-4">
          {/* Toolbar */}
          <div className="flex justify-between items-center">
            <div className="text-sm text-gray-400">
              Showing {records.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0}
              {' '}to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)}
              {' '}of {pagination.total} records
            </div>
            <div className="flex gap-2">
              {selectedRecords.size > 0 && (
                <button
                  onClick={handleBulkDelete}
                  className="px-3 py-1 bg-red-600 hover:bg-red-700 text-white text-sm rounded flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete ({selectedRecords.size})
                </button>
              )}
              <button
                onClick={handleExport}
                disabled={records.length === 0}
                className="px-3 py-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white text-sm rounded flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export CSV
              </button>
              <button
                onClick={() => loadRecords()}
                disabled={isLoading}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm rounded flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <div className="flex bg-gray-700 rounded overflow-hidden ml-2">
                <button
                  onClick={() => setViewMode('list')}
                  className={`px-3 py-1 text-sm flex items-center gap-1 transition-colors ${viewMode === 'list' ? 'bg-blue-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                    }`}
                  title="List View"
                >
                  <List className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('map')}
                  className={`px-3 py-1 text-sm flex items-center gap-1 transition-colors ${viewMode === 'map' ? 'bg-indigo-600 text-white' : 'text-gray-300 hover:bg-gray-600'
                    }`}
                  title="Map View"
                >
                  <Map className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Map View */}
          {viewMode === 'map' && (
            <div className="card p-4">
              <UmapScatterPlot />
            </div>
          )}

          {/* Table (List View) */}
          {viewMode === 'list' && (
            <div className="card overflow-hidden">
              {isLoading && records.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <div className="inline-block animate-spin mb-3">
                    <RefreshCw className="w-6 h-6" />
                  </div>
                  <p>Loading records...</p>
                </div>
              ) : records.length === 0 ? (
                <div className="p-8 text-center text-gray-400">
                  <Database className="w-8 h-8 mx-auto mb-3 opacity-50" />
                  <p>No records found</p>
                </div>
              ) : (
                <>
                  {/* Top scroll bar */}
                  <div className="overflow-x-auto" onScroll={(e) => {
                    const bottomScroll = e.currentTarget.parentElement.querySelector('.table-scroll-bottom');
                    if (bottomScroll) bottomScroll.scrollLeft = e.currentTarget.scrollLeft;
                  }}>
                    <div style={{ height: '1px', width: 'max-content', minWidth: '100%' }}>
                      <table className="w-full text-sm" style={{ visibility: 'hidden', height: 0 }}>
                        <thead>
                          <tr>
                            <th className="px-4 py-3">Select</th>
                            <th className="px-4 py-3">Fav</th>
                            <th className="px-4 py-3">Clip Name</th>
                            <th className="px-4 py-3">Date</th>
                            <th className="px-4 py-3">FERM</th>
                            <th className="px-4 py-3">Key</th>
                            <th className="px-4 py-3">Top Genre</th>
                            <th className="px-4 py-3">Details</th>
                            <th className="px-4 py-3">Actions</th>
                          </tr>
                        </thead>
                      </table>
                    </div>
                  </div>
                  {/* Main table with bottom scroll */}
                  <div className="overflow-x-auto table-scroll-bottom" onScroll={(e) => {
                    const topScroll = e.currentTarget.parentElement.querySelector('.overflow-x-auto');
                    if (topScroll && topScroll !== e.currentTarget) topScroll.scrollLeft = e.currentTarget.scrollLeft;
                  }}>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-700 border-b border-gray-600">
                        <tr>
                          <th className="px-4 py-3 text-left">
                            <input
                              type="checkbox"
                              checked={selectedRecords.size === records.length && records.length > 0}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedRecords(new Set(records.map(r => r._id)));
                                } else {
                                  setSelectedRecords(new Set());
                                }
                              }}
                              className="rounded"
                            />
                          </th>
                          <th className="px-4 py-3 text-center font-semibold">Fav</th>
                          <th
                            onClick={() => handleSort('clipName')}
                            className="px-4 py-3 text-left cursor-pointer hover:bg-gray-600 transition-colors font-semibold"
                          >
                            Clip Name {sortBy === 'clipName' && (sortOrder === -1 ? '↓' : '↑')}
                          </th>
                          <th
                            onClick={() => handleSort('date')}
                            className="px-4 py-3 text-left cursor-pointer hover:bg-gray-600 transition-colors font-semibold"
                          >
                            Date {sortBy === 'date' && (sortOrder === -1 ? '↓' : '↑')}
                          </th>
                          <th
                            onClick={() => handleSort('fermFactor')}
                            className="px-4 py-3 text-center cursor-pointer hover:bg-gray-600 transition-colors font-semibold"
                          >
                            FERM {sortBy === 'fermFactor' && (sortOrder === -1 ? '↓' : '↑')}
                          </th>
                          <th className="px-4 py-3 text-center font-semibold">Key</th>
                          <th
                            onClick={() => handleSort('topGenre')}
                            className="px-4 py-3 text-left cursor-pointer hover:bg-gray-600 transition-colors font-semibold"
                          >
                            Top Genre {sortBy === 'topGenre' && (sortOrder === -1 ? '↓' : '↑')}
                          </th>
                          <th className="px-4 py-3 text-center font-semibold">Details</th>
                          <th className="px-4 py-3 text-right font-semibold">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record, idx) => (
                          <tr key={record._id} className="border-b border-gray-700 hover:bg-gray-700/50 transition-colors">
                            <td className="px-4 py-3">
                              <input
                                type="checkbox"
                                checked={selectedRecords.has(record._id)}
                                onChange={(e) => {
                                  const newSelected = new Set(selectedRecords);
                                  if (e.target.checked) {
                                    newSelected.add(record._id);
                                  } else {
                                    newSelected.delete(record._id);
                                  }
                                  setSelectedRecords(newSelected);
                                }}
                                className="rounded"
                              />
                            </td>
                            <td className="px-4 py-3 text-center">
                              <FavoriteToggleButton
                                recordId={record._id}
                                clipName={record.clipName}
                                isFavorite={record.isFavorite}
                                onToggled={(fav) => {
                                  const next = [...records];
                                  next[idx] = { ...record, isFavorite: fav };
                                  setRecords(next);
                                }}
                              />
                            </td>
                            <td className="px-4 py-3 truncate max-w-xs" title={record.clipName}>
                              {onSelectItem ? (
                                <button
                                  onClick={() => onSelectItem(record)}
                                  className="text-blue-400 hover:text-blue-300 hover:underline text-left truncate w-full"
                                >
                                  {record.clipName}
                                </button>
                              ) : (
                                record.clipName
                              )}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap text-xs text-gray-400">
                              <div>{new Date(record.date).toLocaleString()}</div>
                              <div className="text-[10px] text-gray-500 mt-0.5 inline-flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {record.timePeriod || '—'}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center font-semibold text-blue-300">
                              {record.fermFactor?.toFixed(2) || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-center font-medium">
                              {record.keyFit?.key || 'N/A'}
                            </td>
                            <td className="px-4 py-3 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="inline-block bg-purple-900/50 px-2 py-1 rounded text-purple-300 max-w-xs truncate">
                                  {record.topGenreWithStyle || record.topGenre || 'Unknown'}
                                </span>
                                {record.sourceType === 'mainstream' && (
                                  <span className="inline-block bg-amber-900/50 px-2 py-1 rounded text-amber-300 text-xs font-semibold">
                                    Mainstream
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-center">
                              <button
                                onClick={() => setSelectedRecord(record)}
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-gray-100 transition-colors text-xs"
                              >
                                <Eye className="w-3 h-3" />
                                View
                              </button>
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex items-center justify-end gap-2">
                                {onSelectItem && (
                                  <button
                                    onClick={() => onSelectItem(record)}
                                    className="p-1 hover:bg-blue-600/30 rounded text-blue-400 hover:text-blue-300 transition-colors"
                                    title="Open Analysis"
                                  >
                                    <ExternalLink className="w-4 h-4" />
                                  </button>
                                )}
                                <button
                                  onClick={() => handleToggleSourceType(record._id, record.sourceType || 'independent')}
                                  className="p-1 hover:bg-amber-600/30 rounded text-amber-400 hover:text-amber-300 transition-colors"
                                  title={`Toggle: ${record.sourceType === 'mainstream' ? 'Set to Independent' : 'Set to Mainstream'}`}
                                >
                                  <ArrowLeftRight className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteRecord(record._id)}
                                  className="p-1 hover:bg-red-600/30 rounded text-red-400 hover:text-red-300 transition-colors"
                                  title="Delete record"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center gap-2">
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.max(1, prev.page - 1) }))}
                disabled={pagination.page === 1 || isLoading}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 rounded text-sm"
              >
                Previous
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - pagination.page) <= 1)
                .map((p, idx, arr) => (
                  <React.Fragment key={p}>
                    {idx > 0 && arr[idx - 1] !== p - 1 && <span className="px-2 text-gray-500">...</span>}
                    <button
                      onClick={() => setPagination(prev => ({ ...prev, page: p }))}
                      disabled={isLoading}
                      className={`px-3 py-1 rounded text-sm transition-colors ${pagination.page === p
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                        }`}
                    >
                      {p}
                    </button>
                  </React.Fragment>
                ))}
              <button
                onClick={() => setPagination(prev => ({ ...prev, page: Math.min(totalPages, prev.page + 1) }))}
                disabled={pagination.page === totalPages || isLoading}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 rounded text-sm"
              >
                Next
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {
        selectedRecord && (
          <RecordDetailModal
            record={selectedRecord}
            onClose={() => setSelectedRecord(null)}
            onFavoriteToggled={(fav) => setSelectedRecord(sr => ({ ...sr, isFavorite: fav }))}
            onOpenAnalysis={onSelectItem}
          />
        )
      }
    </div >
  );
}

export default CloudStoragePanel;
