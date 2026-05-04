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
      <div className="bg-gray-900/70 border border-gray-800/60 rounded-xl p-6 shadow-inner">
        <h3 className="text-xl font-semibold text-slate-100 mb-2">Loudness Analysis</h3>
        <p className="text-slate-400">No loudness data available</p>
      </div>
    );
  }

  const { global, stems, stem_delta, timeline } = loudness;

  return (
    <div className="space-y-6">
      <section className="bg-gray-900/70 border border-gray-800/60 rounded-xl p-6 shadow-inner">
        <h3 className="text-xl font-semibold text-slate-100 mb-6">Loudness Analysis</h3>
        
        {/* Global Stats */}
        {global && (
          <div className="mb-8">
            <h4 className="text-md font-semibold text-slate-300 mb-3">Global Loudness</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-950/40 border border-blue-500/20 rounded-lg p-4">
                <div className="text-sm text-blue-400 font-medium">Integrated LUFS</div>
                <div className="text-2xl font-bold text-blue-200 mt-1">{global.input_i?.toFixed(1) ?? 'N/A'}</div>
                <div className="text-xs text-blue-400/70 mt-1">Target: -14 LUFS</div>
              </div>
              <div className="bg-gray-950/40 border border-emerald-500/20 rounded-lg p-4">
                <div className="text-sm text-emerald-400 font-medium">Loudness Range</div>
                <div className="text-2xl font-bold text-emerald-200 mt-1">{global.input_lra?.toFixed(1) ?? 'N/A'}</div>
                <div className="text-xs text-emerald-400/70 mt-1">EBU LRA</div>
              </div>
              <div className="bg-gray-950/40 border border-purple-500/20 rounded-lg p-4">
                <div className="text-sm text-purple-400 font-medium">True Peak</div>
                <div className="text-2xl font-bold text-purple-200 mt-1">{global.input_tp?.toFixed(1) ?? 'N/A'}</div>
                <div className="text-xs text-purple-400/70 mt-1">dBTP</div>
              </div>
            </div>
          </div>
        )}

        {/* Stem Analysis */}
        {stems && stem_delta && (
          <div className="mb-8">
            <h4 className="text-md font-semibold text-slate-300 mb-3">Stem Analysis</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-gray-950/40 border border-pink-500/20 rounded-lg p-4">
                <div className="text-sm text-pink-400 font-medium">Vocals</div>
                <div className="text-xl font-bold text-pink-200 mt-1">{stems.vocals.input_i.toFixed(1)} LUFS</div>
                <div className="text-xs text-pink-400/70 mt-1">LRA: {stems.vocals.input_lra.toFixed(1)}</div>
              </div>
              <div className="bg-gray-950/40 border border-indigo-500/20 rounded-lg p-4">
                <div className="text-sm text-indigo-400 font-medium">Instrumental</div>
                <div className="text-xl font-bold text-indigo-200 mt-1">{stems.instrumental.input_i.toFixed(1)} LUFS</div>
                <div className="text-xs text-indigo-400/70 mt-1">LRA: {stems.instrumental.input_lra.toFixed(1)}</div>
              </div>
              {/* Stem Delta as 3rd card */}
              <div className="bg-gray-950/40 border border-gray-700/50 rounded-lg p-4 flex flex-col justify-between">
                <div>
                  <div className="text-sm text-gray-400 font-medium">Vocal-Instrumental Delta</div>
                  <div className="text-xl font-bold text-slate-200 mt-1">{stem_delta.lufs_delta.toFixed(1)} LUFS</div>
                </div>
                <div className="mt-2 flex items-center justify-start">
                  <div className={`px-2 py-0.5 rounded text-xs font-medium border inline-block ${
                    stem_delta.staging_assessment === 'balanced' 
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                      : stem_delta.staging_assessment === 'vocals_hot'
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/30'
                      : 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30'
                  }`}>
                    {stem_delta.staging_assessment === 'balanced' ? 'Balanced' : 
                     stem_delta.staging_assessment === 'vocals_hot' ? 'Vocals Hot' : 'Vocals Soft'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Timeline Stats */}
        {timeline && timeline.stats && (
          <div className="mb-2">
            <h4 className="text-md font-semibold text-slate-300 mb-3">Timeline Statistics</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-950/40 border border-amber-500/20 rounded-lg p-4">
                <div className="text-sm text-amber-400 font-medium">Momentary Range</div>
                <div className="text-lg font-bold text-amber-200 mt-1">
                  {timeline.stats.momentary.min.toFixed(1)} to {timeline.stats.momentary.max.toFixed(1)} LUFS
                </div>
                <div className="text-xs text-amber-400/70 mt-1">Mean: {timeline.stats.momentary.mean.toFixed(1)}</div>
              </div>
              <div className="bg-gray-950/40 border border-teal-500/20 rounded-lg p-4">
                <div className="text-sm text-teal-400 font-medium">Short-term Range</div>
                <div className="text-lg font-bold text-teal-200 mt-1">
                  {timeline.stats.short_term.min.toFixed(1)} to {timeline.stats.short_term.max.toFixed(1)} LUFS
                </div>
                <div className="text-xs text-teal-400/70 mt-1">Mean: {timeline.stats.short_term.mean.toFixed(1)}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Timeline Visualization */}
      {timeline && timeline.data && timeline.data.length > 0 && (
        <div>
          <LoudnessTimeline timelineData={timeline.data} />
        </div>
      )}
    </div>
  );
}

