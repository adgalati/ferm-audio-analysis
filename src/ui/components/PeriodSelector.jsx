import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, Clock } from 'lucide-react';

function PeriodSelector({ selectedPeriod, onPeriodChange, periods = [], isLoading = false }) {
  const [isOpen, setIsOpen] = useState(false);

  const handlePeriodSelect = (period) => {
    onPeriodChange(period);
    setIsOpen(false);
  };

  const formatPeriodDisplay = (period) => {
    if (!period) return 'All Time';
    return period;
  };

  const getPeriodCount = (period) => {
    // This would ideally come from props or be calculated
    // For now, return a placeholder
    return period ? '•' : '';
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-gray-300 rounded border border-gray-600 transition-colors min-w-[200px]"
      >
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className="flex-1 text-left truncate">
          {formatPeriodDisplay(selectedPeriod)}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-gray-800 border border-gray-600 rounded shadow-lg z-50 max-h-64 overflow-y-auto">
          {/* All Time Option */}
          <button
            onClick={() => handlePeriodSelect(null)}
            className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 ${
              !selectedPeriod ? 'bg-blue-600 text-white' : 'text-gray-300'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>All Time</span>
            <span className="ml-auto text-xs text-gray-500">
              {periods.length > 0 ? `${periods.length} periods` : ''}
            </span>
          </button>

          {/* Divider */}
          {periods.length > 0 && (
            <div className="border-t border-gray-600 my-1" />
          )}

          {/* Period Options */}
          {periods.map((period, index) => (
            <button
              key={period || `period-${index}`}
              onClick={() => handlePeriodSelect(period)}
              className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-700 transition-colors flex items-center gap-2 ${
                selectedPeriod === period ? 'bg-blue-600 text-white' : 'text-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4 text-gray-400" />
              <span className="flex-1 truncate">{period}</span>
              <span className="text-xs text-gray-500">{getPeriodCount(period)}</span>
            </button>
          ))}

          {/* Empty State */}
          {periods.length === 0 && !isLoading && (
            <div className="px-3 py-4 text-center text-gray-500 text-sm">
              No periods available
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="px-3 py-4 text-center text-gray-400 text-sm">
              Loading periods...
            </div>
          )}
        </div>
      )}

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}

export default PeriodSelector;

