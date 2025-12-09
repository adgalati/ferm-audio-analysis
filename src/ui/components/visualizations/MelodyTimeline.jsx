import React, { useState, useEffect } from 'react';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { frequencyToNote } from '../../../utils/key-analysis.js';

function MelodyTimeline({ melody, keyAnalysis }) {
  const { currentTime, duration, isInitialized } = useAudioPlayer();
  const [currentNoteIndex, setCurrentNoteIndex] = useState(-1);
  const [processedNotes, setProcessedNotes] = useState([]);

  // Process melody data into note segments with smart merging
  useEffect(() => {
    if (!melody || !melody.times || !melody.f0_hz || melody.times.length === 0) {
      setProcessedNotes([]);
      return;
    }

    console.log('[MelodyTimeline] Processing melody with keyAnalysis:', keyAnalysis);

    const notes = [];
    let currentNote = null;
    let noteStartTime = null;
    let noteFrequencies = []; // Track frequencies for averaging

    for (let i = 0; i < melody.times.length; i++) {
      const time = melody.times[i];
      const frequency = melody.f0_hz[i];
      const confidence = melody.confidence?.[i] || 0;

      if (frequency > 0 && confidence > 0.4) { // Higher confidence threshold
        const noteInfo = frequencyToNote(frequency);
        if (!noteInfo) continue;

        const noteName = `${noteInfo.note}${noteInfo.octave}`;
        
        if (currentNote === noteName) {
          // Continue current note - add frequency for averaging
          noteFrequencies.push(frequency);
          continue;
        } else {
          // End previous note if exists
          if (currentNote && noteStartTime !== null) {
            const avgFrequency = noteFrequencies.length > 0 
              ? noteFrequencies.reduce((sum, f) => sum + f, 0) / noteFrequencies.length
              : frequency;
            
            // Determine if note is in key based on note name and detected scale
            const noteName = currentNote.replace(/\d+/, ''); // Remove octave number
            const isInKey = keyAnalysis?.scaleNotes?.includes(noteName) || false;
            
            notes.push({
              start: noteStartTime,
              end: time,
              note: currentNote,
              frequency: avgFrequency,
              confidence: confidence,
              isInKey: isInKey
            });
          }

          // Start new note
          currentNote = noteName;
          noteStartTime = time;
          noteFrequencies = [frequency];
        }
      } else {
        // End current note if we hit an unvoiced frame
        if (currentNote && noteStartTime !== null) {
          const avgFrequency = noteFrequencies.length > 0 
            ? noteFrequencies.reduce((sum, f) => sum + f, 0) / noteFrequencies.length
            : frequency;
            
          // Determine if note is in key based on note name and detected scale
          const noteName = currentNote.replace(/\d+/, ''); // Remove octave number
          const isInKey = keyAnalysis?.scaleNotes?.includes(noteName) || false;
          
          notes.push({
            start: noteStartTime,
            end: time,
            note: currentNote,
            frequency: avgFrequency,
            confidence: confidence,
            isInKey: isInKey
          });
          currentNote = null;
          noteStartTime = null;
          noteFrequencies = [];
        }
      }
    }

    // Handle final note if it extends to the end
    if (currentNote && noteStartTime !== null) {
      const lastTime = melody.times[melody.times.length - 1];
      const avgFrequency = noteFrequencies.length > 0 
        ? noteFrequencies.reduce((sum, f) => sum + f, 0) / noteFrequencies.length
        : melody.f0_hz[melody.f0_hz.length - 1];
        
      // Determine if note is in key based on note name and detected scale
      const noteName = currentNote.replace(/\d+/, ''); // Remove octave number
      const isInKey = keyAnalysis?.scaleNotes?.includes(noteName) || false;
      
      notes.push({
        start: noteStartTime,
        end: lastTime,
        note: currentNote,
        frequency: avgFrequency,
        confidence: melody.confidence?.[melody.confidence.length - 1] || 0,
        isInKey: isInKey
      });
    }

    // Filter out very short notes (less than 0.1 seconds) to reduce noise
    const filteredNotes = notes.filter(note => (note.end - note.start) >= 0.1);
    
    setProcessedNotes(filteredNotes);
  }, [melody, keyAnalysis]);

  // Find current note based on playback time
  useEffect(() => {
    if (!processedNotes || processedNotes.length === 0 || !isInitialized) return;
    
    // Find the note that contains the current time
    const currentIndex = processedNotes.findIndex(note => 
      currentTime >= note.start && currentTime <= note.end
    );
    
    // If no note contains the current time, find the closest upcoming note
    if (currentIndex === -1) {
      const upcomingIndex = processedNotes.findIndex(note => note.start > currentTime);
      setCurrentNoteIndex(upcomingIndex !== -1 ? upcomingIndex : -1);
    } else {
      setCurrentNoteIndex(currentIndex);
    }
  }, [currentTime, processedNotes, isInitialized]);

  if (!melody || !Array.isArray(melody.f0_hz) || melody.f0_hz.length === 0) {
    return (
      <div className="text-gray-400 text-center py-12">
        No melody data available
      </div>
    );
  }

  if (processedNotes.length === 0) {
    return (
      <div className="text-gray-400 text-center py-12">
        No confident melody notes detected
      </div>
    );
  }

  const handleNoteClick = (note) => {
    // Seek to the start of the note
    window.dispatchEvent(new CustomEvent('seek-audio', { detail: { time: note.start } }));
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Melody Notes Timeline</h3>
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex flex-wrap gap-2">
          {processedNotes.map((note, index) => {
            const isCurrentNote = index === currentNoteIndex;
            const duration = note.end - note.start;
            
            return (
              <div
                key={index}
                className={`relative h-16 rounded-lg border-2 cursor-pointer transition-all duration-200 ${
                  isCurrentNote
                    ? 'bg-yellow-900/30 border-yellow-400 scale-105 shadow-lg'
                    : note.isInKey
                    ? 'bg-green-900/20 border-green-400 hover:bg-green-900/30'
                    : 'bg-red-900/20 border-red-400 hover:bg-red-900/30'
                }`}
                onClick={() => handleNoteClick(note)}
                style={{
                  width: `${Math.max(80, Math.min(200, duration * 100))}px` // Fixed width based on duration
                }}
              >
                <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
                  <div className={`text-lg font-bold ${
                    isCurrentNote ? 'text-yellow-300' : note.isInKey ? 'text-green-300' : 'text-red-300'
                  }`}>
                    {note.note}
                  </div>
                  <div className="text-xs text-gray-400">
                    {note.frequency.toFixed(0)} Hz
                  </div>
                </div>
                
                {/* In-key indicator */}
                <div className={`absolute top-1 right-1 w-2 h-2 rounded-full ${
                  note.isInKey ? 'bg-green-400' : 'bg-red-400'
                }`} title={note.isInKey ? 'In Key' : 'Out of Key'} />
              </div>
            );
          })}
        </div>
        
        {/* Legend */}
        <div className="mt-4 flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-400 rounded-full"></div>
            <span>In Key</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-400 rounded-full"></div>
            <span>Out of Key</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-400 rounded-full"></div>
            <span>Currently Playing</span>
          </div>
        </div>
        
        {/* Summary */}
        <div className="mt-4 text-sm text-gray-400">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <strong>Total Notes:</strong> {processedNotes.length}
            </div>
            <div>
              <strong>In Key:</strong> {processedNotes.filter(n => n.isInKey).length}
            </div>
            <div>
              <strong>Out of Key:</strong> {processedNotes.filter(n => !n.isInKey).length}
            </div>
            <div>
              <strong>Avg Duration:</strong> {(processedNotes.reduce((sum, n) => sum + (n.end - n.start), 0) / processedNotes.length).toFixed(2)}s
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MelodyTimeline;
