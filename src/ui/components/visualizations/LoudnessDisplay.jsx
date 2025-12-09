import React from 'react';
import LoudnessTimeline from './LoudnessTimeline';

/**
 * LoudnessDisplay component for showing FFmpeg loudness analysis results
 * @param {Object} props - Component props
 * @param {Object} props.loudness - Loudness analysis data
 * @param {Object} props.loudness.global - Global loudness stats
 * @param {Object} props.loudness.stems - Stem-specific loudness data
 * @param {Object} props.loudness.stem_delta - Delta between stems
 * @param {Object} props.loudness.timeline - Timeline data and stats
 */
export function LoudnessDisplay({ loudness }) {
  if (!loudness) {
    return (
      <div className="bg-gray-50 rounded-lg p-4">
        <h3 className="text-lg font-semibold text-gray-700 mb-2">Loudness Analysis</h3>
        <p className="text-gray-500">No loudness data available</p>
      </div>
    );
  }

  const { global, stems, stem_delta, timeline } = loudness;

  return (
    <div className="bg-white rounded-lg p-6 shadow-sm border">
      <h3 className="text-xl font-semibold text-gray-800 mb-4">Loudness Analysis</h3>
      
      {/* Global Stats */}
      {global && (
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-700 mb-3">Global Loudness</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-sm text-blue-600 font-medium">Integrated LUFS</div>
              <div className="text-2xl font-bold text-blue-800">{global.input_i.toFixed(1)}</div>
              <div className="text-xs text-blue-500">Target: -14 LUFS</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-sm text-green-600 font-medium">Loudness Range</div>
              <div className="text-2xl font-bold text-green-800">{global.input_lra.toFixed(1)}</div>
              <div className="text-xs text-green-500">EBU LRA</div>
            </div>
            <div className="bg-purple-50 rounded-lg p-4">
              <div className="text-sm text-purple-600 font-medium">True Peak</div>
              <div className="text-2xl font-bold text-purple-800">{global.input_tp.toFixed(1)}</div>
              <div className="text-xs text-purple-500">dBTP</div>
            </div>
          </div>
        </div>
      )}

      {/* Stem Analysis */}
      {stems && stem_delta && (
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-700 mb-3">Stem Analysis</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="bg-pink-50 rounded-lg p-4">
              <div className="text-sm text-pink-600 font-medium">Vocals</div>
              <div className="text-xl font-bold text-pink-800">{stems.vocals.input_i.toFixed(1)} LUFS</div>
              <div className="text-xs text-pink-500">LRA: {stems.vocals.input_lra.toFixed(1)}</div>
            </div>
            <div className="bg-indigo-50 rounded-lg p-4">
              <div className="text-sm text-indigo-600 font-medium">Instrumental</div>
              <div className="text-xl font-bold text-indigo-800">{stems.instrumental.input_i.toFixed(1)} LUFS</div>
              <div className="text-xs text-indigo-500">LRA: {stems.instrumental.input_lra.toFixed(1)}</div>
            </div>
          </div>
          
          {/* Stem Delta */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-gray-600 font-medium">Vocal-Instrumental Delta</div>
                <div className="text-lg font-bold text-gray-800">{stem_delta.lufs_delta.toFixed(1)} LUFS</div>
              </div>
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                stem_delta.staging_assessment === 'balanced' 
                  ? 'bg-green-100 text-green-800' 
                  : stem_delta.staging_assessment === 'vocals_hot'
                  ? 'bg-orange-100 text-orange-800'
                  : 'bg-blue-100 text-blue-800'
              }`}>
                {stem_delta.staging_assessment === 'balanced' ? 'Balanced' : 
                 stem_delta.staging_assessment === 'vocals_hot' ? 'Vocals Hot' : 'Vocals Soft'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Stats */}
      {timeline && timeline.stats && (
        <div className="mb-6">
          <h4 className="text-lg font-medium text-gray-700 mb-3">Timeline Statistics</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-yellow-50 rounded-lg p-4">
              <div className="text-sm text-yellow-600 font-medium">Momentary Range</div>
              <div className="text-lg font-bold text-yellow-800">
                {timeline.stats.momentary.min.toFixed(1)} to {timeline.stats.momentary.max.toFixed(1)} LUFS
              </div>
              <div className="text-xs text-yellow-500">Mean: {timeline.stats.momentary.mean.toFixed(1)}</div>
            </div>
            <div className="bg-teal-50 rounded-lg p-4">
              <div className="text-sm text-teal-600 font-medium">Short-term Range</div>
              <div className="text-lg font-bold text-teal-800">
                {timeline.stats.short_term.min.toFixed(1)} to {timeline.stats.short_term.max.toFixed(1)} LUFS
              </div>
              <div className="text-xs text-teal-500">Mean: {timeline.stats.short_term.mean.toFixed(1)}</div>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Visualization */}
      {timeline && timeline.data && timeline.data.length > 0 && (
        <div>
          <LoudnessTimeline timelineData={timeline.data} />
        </div>
      )}
    </div>
  );
}

