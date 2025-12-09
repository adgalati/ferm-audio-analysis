import React, { useEffect, useRef, useState } from 'react';
import { initSubjective, injectSubjectiveStyles, getCurrentState, saveState } from './subjective.js';
import { attachFermToHistory, getHistory } from '../stores/analysisHistory.js';
import { ArrowLeft, Save, RotateCcw } from 'lucide-react';

function FERMFactor({ recordToScore, onScoreComplete, onBackToQueue }) {
  const [activeHistoryId, setActiveHistoryId] = useState(null);
  const [currentRecord, setCurrentRecord] = useState(recordToScore);
  const [isSaving, setIsSaving] = useState(false);
  const currentStateRef = useRef(null);

  // Update current record when prop changes
  useEffect(() => {
    if (recordToScore) {
      setCurrentRecord(recordToScore);
    }
  }, [recordToScore]);

  // Monitor activeHistoryId changes
  useEffect(() => {
    const checkActiveId = () => {
      const idStr = sessionStorage.getItem('activeHistoryId');
      const id = idStr ? Number(idStr) : null;
      if (id !== activeHistoryId) {
        setActiveHistoryId(id);
      }
    };
    
    // Check immediately
    checkActiveId();
    
    // Set up interval to check for changes
    const interval = setInterval(checkActiveId, 100);
    
    return () => clearInterval(interval);
  }, [activeHistoryId]);

  const initializeFERM = () => {
    try {
      injectSubjectiveStyles();
    } catch (_) {}
    
    // Preload state from current record if available; otherwise clear to defaults
    try {
      if (currentRecord && currentRecord.fermFactor !== null) {
        // If record already has a FERM Factor, load it
        const existingState = {
          overall: currentRecord.fermFactor,
          // You might want to store more detailed breakdown in the record
        };
        localStorage.setItem('ferm-factor-v3', JSON.stringify(existingState));
      } else {
        localStorage.removeItem('ferm-factor-v3');
      }
    } catch (_) {}

    // Initialize the subjective scoring UI into the container (loads from localStorage if present)
    initSubjective();
    
    // Store reference to current state for save operations
    currentStateRef.current = getCurrentState();

    // Intercept Save to save to MongoDB and notify parent
    const btn = document.getElementById('btn-save');
    const original = btn && btn.onclick;
    if (btn) {
      btn.onclick = async () => {
        try {
          setIsSaving(true);
          
          // Get current state from the UI instead of localStorage
          const currentState = getCurrentState();
          if (!currentState) return;
          
          // Save to localStorage first
          saveState(currentState);
          
          // Save to MongoDB if we have a current record
          if (currentRecord && currentRecord._id) {
            const result = await window.electronAPI.mongodb('mongodb:update-ferm-factor', {
              id: currentRecord._id,
              fermFactor: currentState.overall
            });
            
            if (result.success) {
              console.log('[FERM] Successfully saved FERM Factor to MongoDB');
              // Notify parent component that scoring is complete
              if (onScoreComplete) {
                onScoreComplete({
                  ...currentRecord,
                  fermFactor: currentState.overall
                });
              }
            } else {
              console.error('[FERM] Failed to save to MongoDB:', result.error);
            }
          }
          
          // Flash saved indicator
          if (typeof original === 'function') original();
        } catch (e) {
          console.error('[FERM] Save failed:', e);
        } finally {
          setIsSaving(false);
        }
      };
    }
  };

  // Reinitialize whenever activeHistoryId or currentRecord changes
  useEffect(() => {
    initializeFERM();
  }, [activeHistoryId, currentRecord]);

  const handleBackToQueue = () => {
    if (onBackToQueue) {
      onBackToQueue();
    }
  };

  const handleResetScore = () => {
    if (currentRecord && currentRecord._id) {
      // Reset the FERM Factor in MongoDB
      window.electronAPI.mongodb('mongodb:update-ferm-factor', {
        id: currentRecord._id,
        fermFactor: null
      }).then(result => {
        if (result.success) {
          console.log('[FERM] Reset FERM Factor');
          // Clear localStorage
          localStorage.removeItem('ferm-factor-v3');
          // Reinitialize to show empty state
          initializeFERM();
          // Notify parent to refresh data
          if (onScoreComplete) {
            onScoreComplete({
              ...currentRecord,
              fermFactor: null
            });
          }
        }
      });
    }
  };

  return (
    <div className="space-y-6">
      {/* Header with record info */}
      {currentRecord && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <button
                onClick={handleBackToQueue}
                className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white rounded transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Queue
              </button>
              <div>
                <h2 className="text-2xl font-semibold">FERM Factor Scoring</h2>
                <p className="text-sm text-gray-400">
                  Scoring: <span className="text-white font-medium">{currentRecord.clipName}</span>
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetScore}
                className="flex items-center gap-2 px-3 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded transition-colors"
                title="Reset score and send back to queue"
              >
                <RotateCcw className="w-4 h-4" />
                Reset Score
              </button>
            </div>
          </div>
          
          {/* Record details */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500">Genre</div>
              <div className="text-gray-200">
                {currentRecord.topGenreWithStyle || currentRecord.topGenre || 'Unknown'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Key</div>
              <div className="text-gray-200">
                {currentRecord.keyFit?.key || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Timing</div>
              <div className="text-gray-200">
                {currentRecord.timingTightness?.toFixed(1) || 'N/A'}
              </div>
            </div>
            <div>
              <div className="text-gray-500">Key Fit</div>
              <div className="text-gray-200">
                {currentRecord.keyFit?.score?.toFixed(1) || 'N/A'}%
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Scoring interface */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold">Subjective Scoring</h3>
          <div className="flex items-center gap-2">
            <button 
              id="btn-save" 
              className={`btn-primary flex items-center gap-2 ${isSaving ? 'opacity-50 cursor-not-allowed' : ''}`}
              disabled={isSaving}
            >
              <Save className="w-4 h-4" />
              {isSaving ? 'Saving...' : 'Save Score'}
            </button>
            <button id="btn-export" className="btn-secondary">Export</button>
            <button id="btn-reset" className="btn-secondary">Reset</button>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-sm text-gray-400">Overall Score</div>
          <div id="ferm-score" className="text-3xl font-bold text-primary-300">—/100</div>
        </div>

        <div id="ferm-sliders" />
      </div>

      {/* Instructions */}
      {!currentRecord && (
        <div className="card">
          <div className="text-center py-8">
            <div className="text-gray-400 mb-4">
              <svg className="w-16 h-16 mx-auto mb-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-300 mb-2">No Record Selected</h3>
            <p className="text-gray-400 mb-4">
              Select a record from the Favorites Queue to begin scoring.
            </p>
            <p className="text-sm text-gray-500">
              Go to the FERM Faves tab and click on a favorited submission to score it.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

export default FERMFactor;


