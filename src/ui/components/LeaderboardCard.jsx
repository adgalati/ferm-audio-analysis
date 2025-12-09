import React from 'react';
import { Eye, Star, Music, Clock, Award, Edit3, RotateCcw } from 'lucide-react';
import FavoriteToggleButton from './FavoriteToggleButton.jsx';

function LeaderboardCard({ 
  record, 
  rank, 
  onViewDetails, 
  onFavoriteToggled,
  onScoreRecord,
  onResetScore,
  showFavoriteToggle = true,
  showScoreButton = false,
  showResetButton = false
}) {
  const getRankBadge = (rank) => {
    const baseClasses = "flex items-center justify-center w-8 h-8 rounded-full text-sm font-bold";
    
    switch (rank) {
      case 1:
        return `${baseClasses} bg-gradient-to-br from-yellow-400 to-yellow-600 text-yellow-900 border-2 border-yellow-300`;
      case 2:
        return `${baseClasses} bg-gradient-to-br from-gray-300 to-gray-500 text-gray-900 border-2 border-gray-200`;
      case 3:
        return `${baseClasses} bg-gradient-to-br from-orange-400 to-orange-600 text-orange-900 border-2 border-orange-300`;
      default:
        return `${baseClasses} bg-gray-600 text-gray-200 border border-gray-500`;
    }
  };

  const getRankEmoji = (rank) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return null;
    }
  };

  const formatKey = (keyData) => {
    if (!keyData || !keyData.key) return 'N/A';
    return `${keyData.key} ${keyData.mode || 'major'}`;
  };

  const formatGenre = (record) => {
    if (record.topGenreWithStyle) {
      return record.topGenreWithStyle;
    }
    if (record.topGenre) {
      return record.topGenre;
    }
    return 'Unknown';
  };

  return (
    <div className={`bg-gray-800 rounded-lg border transition-all hover:shadow-lg ${
      rank <= 3 ? 'border-yellow-500/30 shadow-yellow-500/10' : 'border-gray-700 hover:border-gray-600'
    }`}>
      <div className="p-4">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className={getRankBadge(rank)}>
              {getRankEmoji(rank)}
              <span className="ml-1">{rank}</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-gray-100 truncate" title={record.clipName}>
                {record.clipName}
              </h3>
              <div className="text-xs text-gray-400 mt-0.5">
                {new Date(record.date).toLocaleDateString()}
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            {showFavoriteToggle && (
              <FavoriteToggleButton
                recordId={record._id}
                clipName={record.clipName}
                isFavorite={record.isFavorite}
                onToggled={onFavoriteToggled}
                size={18}
              />
            )}
            {showScoreButton && (
              <button
                onClick={() => onScoreRecord && onScoreRecord(record)}
                className="p-1.5 hover:bg-blue-700 rounded text-blue-400 hover:text-white transition-colors"
                title="Score FERM Factor"
              >
                <Edit3 className="w-4 h-4" />
              </button>
            )}
            {showResetButton && (
              <button
                onClick={() => onResetScore && onResetScore(record)}
                className="p-1.5 hover:bg-orange-700 rounded text-orange-400 hover:text-white transition-colors"
                title="Reset Score & Send Back to Queue"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={() => onViewDetails && onViewDetails(record)}
              className="p-1.5 hover:bg-gray-700 rounded text-gray-400 hover:text-gray-200 transition-colors"
              title="View Details"
            >
              <Eye className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* FERM Factor Display */}
        <div className="mb-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-400">FERM Factor</span>
            <div className="text-2xl font-bold text-blue-400">
              {record.fermFactor?.toFixed(2) || 'N/A'}
            </div>
          </div>
          {rank <= 3 && (
            <div className="flex justify-end mt-1">
              <Award className="w-4 h-4 text-yellow-400" />
            </div>
          )}
        </div>

        {/* Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          {/* Genre */}
          <div className="flex items-center gap-2">
            <Music className="w-3 h-3 text-gray-400" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">Genre</div>
              <div className="text-gray-200 truncate" title={formatGenre(record)}>
                {formatGenre(record)}
              </div>
            </div>
          </div>

          {/* Key */}
          <div className="flex items-center gap-2">
            <Music className="w-3 h-3 text-gray-400" />
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">Key</div>
              <div className="text-gray-200 truncate">
                {formatKey(record.keyFit)}
              </div>
            </div>
          </div>

          {/* Timing */}
          {record.timingTightness !== null && (
            <div className="flex items-center gap-2">
              <Clock className="w-3 h-3 text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500">Timing</div>
                <div className="text-gray-200">
                  {record.timingTightness.toFixed(1)}
                </div>
              </div>
            </div>
          )}

          {/* Key Fit */}
          {record.keyFit?.score !== null && (
            <div className="flex items-center gap-2">
              <Music className="w-3 h-3 text-gray-400" />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-gray-500">Key Fit</div>
                <div className="text-gray-200">
                  {record.keyFit.score.toFixed(1)}%
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Favorite Notes */}
        {record.favoriteNotes && (
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="text-xs text-gray-500 mb-1">Notes</div>
            <div className="text-sm text-gray-300 italic">
              "{record.favoriteNotes}"
            </div>
          </div>
        )}

        {/* Time Period Badge */}
        {record.timePeriod && (
          <div className="mt-3 flex justify-end">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-700 text-gray-300 text-xs rounded">
              <Clock className="w-3 h-3" />
              {record.timePeriod}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default LeaderboardCard;

