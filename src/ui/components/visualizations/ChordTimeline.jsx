import React, { useState, useEffect } from 'react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { Music } from 'lucide-react';

function ChordTimeline({ chords = [], keyAnalysis = null }) {
  const { currentTime, duration, isInitialized } = useAudioPlayer();
  const [currentChordIndex, setCurrentChordIndex] = useState(-1);

  if (!Array.isArray(chords) || chords.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[ChordTimeline] No chord data. chords type/len:', typeof chords, Array.isArray(chords) ? chords.length : 0);
    return (
      <div className="text-gray-400 text-center py-12">
        No chord data available
      </div>
    );
  }

  // Guard invalid rows
  const safe = chords.filter(c => typeof c?.start === 'number' && typeof c?.end === 'number' && c?.label);

  // Find current chord based on playback time
  useEffect(() => {
    if (!safe || safe.length === 0 || !isInitialized) return;
    
    // Find the chord that contains the current time
    const currentIndex = safe.findIndex(chord => 
      currentTime >= chord.start && currentTime <= chord.end
    );
    
    // If no chord contains the current time, find the closest upcoming chord
    if (currentIndex === -1) {
      const upcomingIndex = safe.findIndex(chord => chord.start > currentTime);
      setCurrentChordIndex(upcomingIndex !== -1 ? upcomingIndex : -1);
    } else {
      setCurrentChordIndex(currentIndex);
    }
  }, [currentTime, safe, isInitialized]);
  if (safe.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[ChordTimeline] All chords invalid. Sample of original:', chords.slice(0, 3));
    return (
      <div className="text-gray-400 text-center py-12">
        No chord data available
      </div>
    );
  }
  const maxTime = Math.max(...safe.map(c => c.end));
  
  // Color mapping for chord roots
  const colorMap = {
    'C': 'bg-red-500',
    'D': 'bg-orange-500',
    'E': 'bg-yellow-500',
    'F': 'bg-green-500',
    'G': 'bg-blue-500',
    'A': 'bg-purple-500',
    'B': 'bg-pink-500',
  };

  const getChordColor = (label) => {
    const root = label.split(':')[0].replace(/[#b]/g, '');
    return colorMap[root] || 'bg-gray-500';
  };

  return (
    <div>
      {/* Key Signature Display */}
      {keyAnalysis && keyAnalysis.detectedKey && (
        <div className="mb-6 bg-gray-800 rounded-lg p-4 border border-gray-700">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Music className="w-5 h-5 text-primary-400" />
              <span className="text-gray-400 text-sm">Detected Key:</span>
              <span className="text-xl font-bold text-white">
                {keyAnalysis.detectedKey} {keyAnalysis.mode || ''}
              </span>
            </div>
            {keyAnalysis.scaleNotes && keyAnalysis.scaleNotes.length > 0 && (
              <div className="flex items-center gap-2 ml-4 border-l border-gray-600 pl-4">
                <span className="text-gray-400 text-sm">Scale Notes:</span>
                <div className="flex gap-1">
                  {keyAnalysis.scaleNotes.map((note, idx) => (
                    <span 
                      key={idx} 
                      className="px-2 py-0.5 bg-gray-700 rounded text-xs text-gray-200"
                    >
                      {note}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <h3 className="text-lg font-semibold mb-4">Chord Timeline</h3>
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="space-y-2">
          {safe.slice(0, 50).map((chord, idx) => {
            const widthPercent = ((chord.end - chord.start) / maxTime) * 100;
            const leftPercent = (chord.start / maxTime) * 100;
            const isCurrentChord = idx === currentChordIndex;
            
            return (
              <div key={idx} className="relative h-12">
                <div
                  className={`absolute h-full rounded ${getChordColor(chord.label)} flex items-center justify-center text-white text-sm font-medium shadow-lg transition-all duration-200 hover:scale-105 cursor-pointer ${
                    isCurrentChord ? 'ring-4 ring-yellow-400 ring-opacity-75 scale-105' : ''
                  }`}
                  style={{
                    left: `${leftPercent}%`,
                    width: `${widthPercent}%`,
                    minWidth: '60px'
                  }}
                  title={`${chord.label} (${chord.start.toFixed(2)}s - ${chord.end.toFixed(2)}s)${isCurrentChord ? ' - CURRENT' : ''}`}
                  onClick={() => {
                    // Seek to chord start when clicked
                    window.dispatchEvent(new CustomEvent('seek-audio', { detail: { time: chord.start } }));
                  }}
                >
                  {chord.label}
                </div>
              </div>
            );
          })}
        </div>
        
        {chords.length > 50 && (
          <p className="text-xs text-gray-500 mt-4 text-center">
            Showing first 50 of {chords.length} chords
          </p>
        )}
      </div>
    </div>
  );
}

export default ChordTimeline;
