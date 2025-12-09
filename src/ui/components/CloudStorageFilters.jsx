import React, { useState } from 'react';
import { X, Calendar, Filter, Star, Award } from 'lucide-react';

function CloudStorageFilters({
  genres = [],
  periods = [],
  onFilter,
  isLoading = false
}) {
  const [clipNameSearch, setClipNameSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [fermScoreMin, setFermScoreMin] = useState(0);
  const [fermScoreMax, setFermScoreMax] = useState(100);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [timePeriod, setTimePeriod] = useState('');
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [hasFermScore, setHasFermScore] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [sourceType, setSourceType] = useState('');

  const handleApplyFilters = () => {
    onFilter({
      clipNameSearch: clipNameSearch || null,
      genreFilter: genreFilter || null,
      fermScoreMin: fermScoreMin !== 0 ? fermScoreMin : null,
      fermScoreMax: fermScoreMax !== 100 ? fermScoreMax : null,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      timePeriod: timePeriod || null,
      isFavorite: favoritesOnly ? true : null,
      hasFermScore: hasFermScore ? true : null,
      sourceType: sourceType || null
    });
  };

  const handleReset = () => {
    setClipNameSearch('');
    setGenreFilter('');
    setFermScoreMin(0);
    setFermScoreMax(100);
    setDateFrom('');
    setDateTo('');
    setTimePeriod('');
    setFavoritesOnly(false);
    setHasFermScore(false);
    setSourceType('');
    onFilter({
      clipNameSearch: null,
      genreFilter: null,
      fermScoreMin: null,
      fermScoreMax: null,
      dateFrom: null,
      dateTo: null,
      timePeriod: null,
      isFavorite: null,
      hasFermScore: null,
      sourceType: null
    });
  };

  const handleDatePreset = (preset) => {
    const now = new Date();
    const from = new Date();

    switch (preset) {
      case 'today':
        from.setHours(0, 0, 0, 0);
        break;
      case 'week':
        from.setDate(from.getDate() - 7);
        break;
      case 'month':
        from.setDate(from.getDate() - 30);
        break;
      case 'year':
        from.setFullYear(from.getFullYear() - 1);
        break;
      default:
        return;
    }

    setDateFrom(from.toISOString().split('T')[0]);
    setDateTo(now.toISOString().split('T')[0]);
  };

  return (
    <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold flex items-center gap-2 text-gray-200">
          <Filter className="w-4 h-4" />
          Filters
        </h3>
        {(clipNameSearch || genreFilter || dateFrom || dateTo || fermScoreMin !== 0 || fermScoreMax !== 100 || timePeriod || favoritesOnly || hasFermScore || sourceType) && (
          <button
            onClick={handleReset}
            className="text-xs text-blue-400 hover:text-blue-300"
          >
            Reset
          </button>
        )}
      </div>

      {/* Favorites and FERM score quick toggles */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={favoritesOnly}
            onChange={(e) => setFavoritesOnly(e.target.checked)}
            className="rounded"
          />
          <Star className={`w-3 h-3 ${favoritesOnly ? 'text-yellow-400' : 'text-gray-400'}`} />
          Favorites Only
        </label>
        <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer">
          <input
            type="checkbox"
            checked={hasFermScore}
            onChange={(e) => setHasFermScore(e.target.checked)}
            className="rounded"
          />
          <Award className={`w-3 h-3 ${hasFermScore ? 'text-blue-400' : 'text-gray-400'}`} />
          Has FERM Score
        </label>
      </div>

      {/* Clip Name Search */}
      <div>
        <label className="text-xs font-medium text-gray-300 mb-1 block">
          Clip Name
        </label>
        <input
          type="text"
          value={clipNameSearch}
          onChange={(e) => setClipNameSearch(e.target.value)}
          placeholder="Search..."
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-blue-500"
        />
      </div>

      {/* Period Filter */}
      {periods.length > 0 && (
        <div>
          <label className="text-xs font-medium text-gray-300 mb-1 block">
            Time Period
          </label>
          <select
            value={timePeriod}
            onChange={(e) => setTimePeriod(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Periods</option>
            {periods.map(p => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Genre Filter */}
      {genres.length > 0 && (
        <div>
          <label className="text-xs font-medium text-gray-300 mb-1 block">
            Top Genre
          </label>
          <select
            value={genreFilter}
            onChange={(e) => setGenreFilter(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
          >
            <option value="">All Genres</option>
            {genres.map(genre => (
              <option key={genre} value={genre}>
                {genre}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Source Type Filter */}
      <div>
        <label className="text-xs font-medium text-gray-300 mb-1 block">
          Track Type
        </label>
        <select
          value={sourceType}
          onChange={(e) => setSourceType(e.target.value)}
          className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100 focus:outline-none focus:border-blue-500"
        >
          <option value="">All Types</option>
          <option value="independent">Independent</option>
          <option value="mainstream">Mainstream</option>
        </select>
      </div>

      {/* FERM Score Range */}
      <div>
        <label className="text-xs font-medium text-gray-300 mb-2 block">
          FERM Factor
        </label>
        <div className="space-y-2">
          <div className="flex gap-2">
            <input
              type="number"
              min="0"
              max="100"
              value={fermScoreMin}
              onChange={(e) => setFermScoreMin(Math.min(Number(e.target.value), fermScoreMax))}
              placeholder="Min"
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100"
            />
            <input
              type="number"
              min="0"
              max="100"
              value={fermScoreMax}
              onChange={(e) => setFermScoreMax(Math.max(Number(e.target.value), fermScoreMin))}
              placeholder="Max"
              className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100"
            />
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={fermScoreMin}
            onChange={(e) => setFermScoreMin(Math.min(Number(e.target.value), fermScoreMax))}
            className="w-full"
          />
          <input
            type="range"
            min="0"
            max="100"
            value={fermScoreMax}
            onChange={(e) => setFermScoreMax(Math.max(Number(e.target.value), fermScoreMin))}
            className="w-full"
          />
        </div>
      </div>

      {/* Date Presets */}
      <div>
        <label className="text-xs font-medium text-gray-300 mb-2 flex items-center gap-1">
          <Calendar className="w-3 h-3" />
          Quick Date
        </label>
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'Today', value: 'today' },
            { label: 'This Week', value: 'week' },
            { label: 'This Month', value: 'month' },
            { label: 'This Year', value: 'year' }
          ].map(preset => (
            <button
              key={preset.value}
              onClick={() => handleDatePreset(preset.value)}
              className="px-2 py-1 text-xs bg-gray-700 hover:bg-gray-600 rounded text-gray-300 transition-colors"
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>

      {/* Manual Date Range */}
      <div className="border-t border-gray-700 pt-3">
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-blue-400 hover:text-blue-300 mb-2"
        >
          {showAdvanced ? 'Hide' : 'Show'} Custom Dates
        </button>

        {showAdvanced && (
          <div className="space-y-2">
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">
                From
              </label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-300 block mb-1">
                To
              </label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-full px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm text-gray-100"
              />
            </div>
          </div>
        )}
      </div>

      {/* Apply Button */}
      <button
        onClick={handleApplyFilters}
        disabled={isLoading}
        className="w-full px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white text-sm font-medium rounded transition-colors"
      >
        {isLoading ? 'Loading...' : 'Apply Filters'}
      </button>
    </div>
  );
}

export default CloudStorageFilters;
