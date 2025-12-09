import React from 'react';
import { Clock, Download, History, Radio } from 'lucide-react';
import { getHistory, clearHistory, removeHistoryItem } from '../stores/analysisHistory.js';

function AnalysisHistory({ onSelectItem, onExportItem, activeId, refreshToken }) {
  const [items, setItems] = React.useState(() => getHistory());

  React.useEffect(() => {
    const handler = () => setItems(getHistory());
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);

  React.useEffect(() => {
    // Refresh when parent indicates history changed
    setItems(getHistory());
  }, [refreshToken]);

  const handleClear = () => {
    clearHistory();
    setItems(getHistory());
  };

  const handleRemove = (id) => {
    removeHistoryItem(id);
    setItems(getHistory());
  };

  if (!items.length) {
    return (
      <div className="card">
        <div className="flex items-center gap-2 mb-2">
          <History className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold">History</h3>
        </div>
        <p className="text-sm text-gray-500">No previous analyses yet.</p>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-gray-400" />
          <h3 className="text-lg font-semibold">History</h3>
        </div>
        <button className="btn-secondary" onClick={handleClear}>Clear</button>
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {items.map(item => (
          <div key={item.id} className={`p-3 rounded-lg border ${activeId === item.id ? 'border-primary-600 bg-primary-600/10' : 'border-gray-700 bg-gray-800/60'}`}>
            {/* File info row */}
            <div className="mb-3">
              <div className="font-medium text-gray-100 truncate">{item.fileName}</div>
              <div className="text-xs text-gray-400 flex items-center gap-2 mt-1">
                <Clock className="w-3 h-3" />
                {new Date(item.timestamp).toLocaleString()}
                {item.autoDetected && (
                  <span className="ml-2 inline-flex items-center gap-1 text-green-400">
                    <Radio className="w-3 h-3" /> Auto
                  </span>
                )}
              </div>
            </div>
            {/* Action buttons row */}
            <div className="flex items-center gap-2">
              <button className="btn-secondary flex-1 text-xs py-1.5" onClick={() => onSelectItem(item)}>
                Open
              </button>
              <button className="btn-secondary px-2 py-1.5" title="Export JSON" onClick={() => onExportItem(item)}>
                <Download className="w-3 h-3" />
              </button>
              <button className="btn-secondary px-2 py-1.5" title="Remove" onClick={() => handleRemove(item.id)}>
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default AnalysisHistory;


