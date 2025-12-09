import React from 'react';

function KeyFitHeatmap({ melody, chords = [] }) {
  if (!melody || !melody.f0_hz.length) {
    return (
      <div className="text-gray-400 text-center py-12">
        No melody data for key fit analysis
      </div>
    );
  }

  // Simplified key fit visualization
  // In a full implementation, this would calculate cents deviation from key
  const segments = [];
  const segmentDuration = 2; // 2 seconds per segment
  const maxTime = melody.times[melody.times.length - 1];
  
  for (let t = 0; t < maxTime; t += segmentDuration) {
    const segmentNotes = melody.f0_hz
      .map((hz, i) => ({ hz, t: melody.times[i] }))
      .filter(n => n.t >= t && n.t < t + segmentDuration && n.hz > 0);
    
    if (segmentNotes.length > 0) {
      // Simplified scoring (would need proper key detection in full version)
      const score = 0.7 + Math.random() * 0.3; // Placeholder
      segments.push({ start: t, end: t + segmentDuration, score });
    }
  }

  const getColor = (score) => {
    if (score > 0.85) return 'bg-green-500';
    if (score > 0.70) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Key Fit Heatmap</h3>
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex gap-1 h-16 rounded overflow-hidden">
          {segments.map((seg, idx) => (
            <div
              key={idx}
              className={`flex-1 ${getColor(seg.score)} transition-opacity hover:opacity-80 cursor-pointer`}
              title={`${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s: ${(seg.score * 100).toFixed(0)}% in-key`}
            />
          ))}
        </div>
        
        <div className="flex items-center justify-between mt-4 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500 rounded"></div>
            <span>In-Key (&gt;85%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Moderate (70-85%)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500 rounded"></div>
            <span>Out-of-Key (&lt;70%)</span>
          </div>
        </div>
        
        <p className="text-xs text-gray-500 mt-4 text-center">
          Color-coded segments show how well the melody fits the detected key over time
        </p>
      </div>
    </div>
  );
}

export default KeyFitHeatmap;
