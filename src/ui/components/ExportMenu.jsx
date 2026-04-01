import React, { useState, useRef, useEffect } from 'react';
import { Download, FileJson, Copy, Check, Star, Settings, ChevronDown } from 'lucide-react';

function ExportMenu({ results, isFavorite, isMarkingFavorite, onMarkFavorite }) {
  const [copied, setCopied] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuRef]);

  const handleExportJson = async () => {
    const result = await window.electronAPI.exportJson(results);
    if (result.success) {
      console.log('Exported to:', result.path);
    }
    setIsOpen(false);
  };

  const handleCopyBadgeText = () => {
    const { scores } = results || {};
    const badgeText = `In-Key ${Math.round((scores?.key_fit || 0) * 100)} • Timing ${Math.round(100 - (scores?.timing?.mate_ms || 0))} • ${scores?.timing?.bias_ms > 0 ? 'Late' : 'Early'} bias ${Math.abs(scores?.timing?.bias_ms || 0).toFixed(0)} ms`;
    
    navigator.clipboard.writeText(badgeText);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
      setIsOpen(false);
    }, 1500);
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 text-gray-200"
      >
        <Settings className="w-4 h-4" />
        Actions
        <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-2 w-56 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-50 py-1 overflow-hidden">
          <button
            onClick={() => {
              onMarkFavorite();
              setIsOpen(false);
            }}
            disabled={isMarkingFavorite}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-3 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Star className={`w-4 h-4 ${isFavorite ? 'fill-yellow-500 text-yellow-500' : 'text-gray-400'}`} />
            {isMarkingFavorite ? 'Marking...' : (isFavorite ? 'Remove Favorite' : 'Mark as Favorite')}
          </button>
          
          <div className="border-t border-gray-700"></div>
          
          <button
            onClick={handleExportJson}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-3 transition-colors text-gray-300"
          >
            <FileJson className="w-4 h-4 text-gray-400" />
            Export JSON
          </button>
          
          <button
            onClick={handleCopyBadgeText}
            className="w-full text-left px-4 py-3 text-sm hover:bg-gray-700 flex items-center gap-3 transition-colors text-gray-300"
          >
            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
            {copied ? 'Copied!' : 'Copy Badge'}
          </button>
        </div>
      )}
    </div>
  );
}

export default ExportMenu;
