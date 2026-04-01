import React, { useState } from 'react';
import { Tag, Copy, Check, BarChart3, Activity, Zap, Info, AlertTriangle, Crosshair, X, RotateCcw } from 'lucide-react';
import GenreExplainModal from '../GenreExplainModal';
import { getGenreColor } from '../../utils/genreColors';
import GenreDNA from './GenreDNA';
import GenreWaveformOverlay from './GenreWaveformOverlay';

/** Genre confidence gate — tracks below this threshold are categorized as "Other" */
const GENRE_CONFIDENCE_THRESHOLD = 0.10;

function AutoTagDisplay({ autotagging, audioFile }) {
  const [copied, setCopied] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState('list');
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState('');
  const [explainData, setExplainData] = useState(null);

  // Genre override mode state
  const [overrideMode, setOverrideMode] = useState(false);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideIndex, setOverrideIndex] = useState(null); // which tag is currently the override (null = auto)
  const [overrideFeedback, setOverrideFeedback] = useState(null); // { type: 'success'|'error', message }

  if (!autotagging || !autotagging.tags || autotagging.tags.length === 0) {
    return (
      <div className="text-gray-400 text-center py-12">
        <Tag className="w-12 h-12 mx-auto mb-4 text-gray-500" />
        <p>No genre tags available</p>
        <p className="text-sm mt-2">Enable "Auto-Tagging" analysis to see genre classification</p>
      </div>
    );
  }

  const { model, tags } = autotagging;
  const topScoreBelowThreshold = tags.length > 0 && tags[0].score < GENRE_CONFIDENCE_THRESHOLD;

  const handleCopyTopTag = () => {
    const topTag = tags[0];
    const tagText = topTag.subgenre ? `${topTag.genre} - ${topTag.subgenre}` : topTag.genre;
    navigator.clipboard.writeText(tagText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleExplain = async (genre, subgenre) => {
    try {
      setExplainOpen(true);
      setExplainLoading(true);
      setExplainError('');
      setExplainData(null);
      const res = await window.electronAPI.explainGenre({ genre, subgenre });
      if (!res?.success) throw new Error(res?.error || 'Failed');
      setExplainData(res.data);
    } catch (e) {
      setExplainError(e.message);
    } finally {
      setExplainLoading(false);
    }
  };

  const handleOverrideSelect = async (tagIndex) => {
    if (!audioFile?.name) {
      setOverrideFeedback({ type: 'error', message: 'No clip name available' });
      return;
    }

    setOverrideSaving(true);
    setOverrideFeedback(null);
    try {
      const result = await window.electronAPI.mongodb('mongodb:update-genre-override', {
        clipName: audioFile.name,
        tagIndex
      });

      if (result.success) {
        setOverrideIndex(tagIndex);
        const tag = tags[tagIndex];
        const label = tag.subgenre ? `${tag.genre} - ${tag.subgenre}` : tag.genre;
        setOverrideFeedback({
          type: 'success',
          message: `Official genre set to "${label}"`
        });
        // Exit override mode after a short delay
        setTimeout(() => {
          setOverrideMode(false);
          setOverrideFeedback(null);
        }, 2000);
      } else {
        setOverrideFeedback({ type: 'error', message: result.error || 'Failed to save override' });
      }
    } catch (e) {
      setOverrideFeedback({ type: 'error', message: e.message });
    } finally {
      setOverrideSaving(false);
    }
  };

  const handleClearOverride = async () => {
    if (!audioFile?.name) return;

    setOverrideSaving(true);
    setOverrideFeedback(null);
    try {
      const result = await window.electronAPI.mongodb('mongodb:update-genre-override', {
        clipName: audioFile.name,
        tagIndex: -1
      });

      if (result.success) {
        setOverrideIndex(null);
        setOverrideFeedback({
          type: 'success',
          message: `Reverted to auto-detected genre "${result.topGenre}"`
        });
        setTimeout(() => {
          setOverrideMode(false);
          setOverrideFeedback(null);
        }, 2000);
      } else {
        setOverrideFeedback({ type: 'error', message: result.error || 'Failed to clear override' });
      }
    } catch (e) {
      setOverrideFeedback({ type: 'error', message: e.message });
    } finally {
      setOverrideSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="w-5 h-5 text-purple-400" />
          Genre Classification
        </h3>
        <div className="text-xs text-gray-500">
          Model: {model ? model.split('/').pop() : 'Archived Record'}
        </div>
      </div>

      {/* Visualization Mode Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setVisualizationMode('list')}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${visualizationMode === 'list'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <BarChart3 className="w-4 h-4" />
          List View
        </button>
        <button
          onClick={() => setVisualizationMode('dna')}
          className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${visualizationMode === 'dna'
            ? 'bg-purple-600 text-white'
            : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
            }`}
        >
          <Zap className="w-4 h-4" />
          DNA View
        </button>
        {audioFile && (
          <button
            onClick={() => setVisualizationMode('waveform')}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${visualizationMode === 'waveform'
              ? 'bg-purple-600 text-white'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
          >
            <Activity className="w-4 h-4" />
            Waveform View
          </button>
        )}
      </div>

      {/* Conditional Rendering Based on Mode */}
      {visualizationMode === 'list' && (
        <>
          {/* Top Result - Enhanced for Live Stream Visibility */}
          {tags.length > 0 && (
            <div className="bg-gradient-to-br from-fuchsia-900/40 to-pink-900/20 backdrop-blur-md rounded-2xl p-8 border border-pink-500/30 shadow-[0_0_20px_rgba(236,72,153,0.15)] transition-all duration-300 hover:shadow-[0_0_30px_rgba(236,72,153,0.25)] hover:border-pink-500/50">
              <div className="text-center mb-6">
                <h4 className="text-base font-semibold text-pink-300 mb-3 uppercase tracking-widest drop-shadow-sm">Top Prediction</h4>
                <div className="text-4xl md:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-fuchsia-100 mb-4 leading-tight drop-shadow-md">
                  {tags[0].subgenre ? `${tags[0].genre} - ${tags[0].subgenre}` : tags[0].genre}
                </div>
                <div className="flex items-center justify-center gap-3">
                  <span className="text-5xl md:text-6xl font-black text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 drop-shadow-lg">
                    {Math.round(tags[0].score * 100)}%
                  </span>
                  <span className="text-lg text-pink-200/50 font-medium uppercase tracking-wider">Confidence</span>
                </div>
              </div>

              <div className="w-full max-w-md mx-auto bg-gray-800/60 rounded-full h-3 mb-6 overflow-hidden ring-1 ring-gray-700">
                <div
                  className="bg-gradient-to-r from-pink-500 to-purple-500 h-3 rounded-full transition-all duration-500 shadow-[0_0_10px_rgba(236,72,153,0.8)]"
                  style={{ width: `${tags[0].score * 100}%` }}
                />
              </div>

              <div className="flex justify-center">
                <button
                  onClick={handleCopyTopTag}
                  className="btn-secondary flex items-center gap-2 text-base px-5 py-2.5"
                >
                  {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                  {copied ? 'Copied!' : 'Copy Tag'}
                </button>
              </div>
            </div>
          )}

          {/* "Other" Classification Banner — shown when top confidence is below threshold */}
          {topScoreBelowThreshold && (
            <div className="bg-gradient-to-r from-amber-900/40 to-orange-900/40 rounded-xl p-5 border border-amber-500/50 shadow-md">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-amber-600/30 flex items-center justify-center flex-shrink-0">
                  <AlertTriangle className="w-5 h-5 text-amber-400" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-amber-300 uppercase tracking-wide">Official Category: Other</div>
                  <div className="text-xs text-gray-400 mt-0.5">
                    Top prediction confidence ({Math.round(tags[0].score * 100)}%) is below the {Math.round(GENRE_CONFIDENCE_THRESHOLD * 100)}% threshold.
                    This track is categorized as <span className="font-semibold text-amber-300">"Other"</span> for reporting and trend analysis.
                    All predictions above are preserved.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Override Feedback Banner */}
          {overrideFeedback && (
            <div className={`rounded-lg p-3 text-sm font-medium text-center transition-opacity ${overrideFeedback.type === 'success'
                ? 'bg-green-900/40 text-green-300 border border-green-600/40'
                : 'bg-red-900/40 text-red-300 border border-red-600/40'
              }`}>
              {overrideFeedback.message}
            </div>
          )}

          {/* All Results with Override Mode */}
          <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-6 border border-gray-700/50 shadow-lg shadow-black/20 mt-6">
            <div className="flex items-center justify-between mb-6">
              <h4 className="text-lg font-semibold text-gray-200 flex items-center gap-3">
                <BarChart3 className="w-6 h-6 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.5)]" />
                All Predictions ({tags.length})
              </h4>

              {/* Override Mode Toggle — inconspicuous by default */}
              {audioFile && (
                <button
                  onClick={() => {
                    setOverrideMode(!overrideMode);
                    if (overrideMode) setOverrideFeedback(null);
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${overrideMode
                      ? 'bg-cyan-600/80 text-white border border-cyan-400/60 shadow-sm shadow-cyan-900/30'
                      : 'bg-gray-700/60 text-gray-500 hover:text-gray-300 hover:bg-gray-700 border border-transparent'
                    }`}
                  title="Override the official genre label used in reports"
                >
                  {overrideMode ? <X className="w-3.5 h-3.5" /> : <Crosshair className="w-3.5 h-3.5" />}
                  {overrideMode ? 'Cancel' : 'Override'}
                </button>
              )}
            </div>

            {/* Override Mode Instructions */}
            {overrideMode && (
              <div className="bg-cyan-900/20 rounded-lg px-4 py-3 mb-4 border border-cyan-700/40 flex items-center justify-between">
                <div className="text-xs text-cyan-300">
                  <span className="font-semibold">Override Mode:</span> Click on a prediction below to set it as the official genre label for reports and trends.
                </div>
                {overrideIndex !== null && (
                  <button
                    onClick={handleClearOverride}
                    disabled={overrideSaving}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white transition-colors border border-gray-600 disabled:opacity-50"
                  >
                    <RotateCcw className="w-3 h-3" />
                    Reset to Auto
                  </button>
                )}
              </div>
            )}

            <div className="space-y-4">
              {tags.map((tag, index) => {
                const isOverridden = overrideIndex === index;
                return (
                  <div
                    key={index}
                    onClick={overrideMode && !overrideSaving ? () => handleOverrideSelect(index) : undefined}
                    className={`flex items-center justify-between p-5 rounded-xl backdrop-blur-md border transition-all duration-300 ${overrideMode
                        ? `cursor-pointer ${isOverridden
                          ? 'bg-cyan-900/30 border-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.3)] ring-1 ring-cyan-500/30'
                          : 'bg-gray-800/60 border-gray-600/50 hover:border-cyan-500/50 hover:bg-gray-700/80 hover:shadow-[0_0_15px_rgba(34,211,238,0.15)]'
                        }`
                        : `bg-gray-800/60 border-gray-600/50 hover:border-pink-500/50 hover:shadow-[0_0_15px_rgba(236,72,153,0.15)] hover:bg-gray-800/80`
                      } ${overrideSaving ? 'opacity-50 pointer-events-none' : ''}`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-5 h-5 rounded-full ${getGenreColor(tag.genre)} shadow-lg`} />
                      <div>
                        <div className="text-xl md:text-2xl font-bold text-white leading-tight flex items-center gap-2">
                          {tag.subgenre ? `${tag.genre} - ${tag.subgenre}` : tag.genre}
                          {isOverridden && !overrideMode && (
                            <span className="text-xs font-semibold bg-cyan-800/60 text-cyan-300 px-2 py-0.5 rounded-full uppercase tracking-wide">
                              Official
                            </span>
                          )}
                        </div>
                        <div className="text-base text-gray-400 mt-1 font-medium">
                          #{index + 1} • {tag.genre}
                          {overrideMode && isOverridden && (
                            <span className="ml-2 text-cyan-400 text-sm">✓ Currently selected</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="text-right flex items-center gap-4">
                      <div>
                        <div className="text-2xl md:text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-fuchsia-300 drop-shadow-sm">
                          {Math.round(tag.score * 100)}%
                        </div>
                        <div className="w-24 bg-gray-800 rounded-full h-2.5 mt-2 overflow-hidden ring-1 ring-gray-700">
                          <div
                            className={`h-2.5 rounded-full ${getGenreColor(tag.genre)} shadow-[0_0_8px_currentColor]`}
                            style={{ width: `${tag.score * 100}%` }}
                          />
                        </div>
                      </div>
                      {/* Only show Explain button when NOT in override mode */}
                      {!overrideMode && (
                        <button
                          onClick={() => handleExplain(tag.genre, tag.subgenre)}
                          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-base text-gray-200 border border-gray-600 hover:border-purple-500/50 transition-colors"
                        >
                          <Info className="w-5 h-5" /> Explain
                        </button>
                      )}
                      {/* Override mode: show selection hint */}
                      {overrideMode && (
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all ${isOverridden
                            ? 'border-cyan-400 bg-cyan-500/20'
                            : 'border-gray-600 bg-gray-800/50 group-hover:border-cyan-500/40'
                          }`}>
                          {isOverridden
                            ? <Check className="w-5 h-5 text-cyan-400" />
                            : <Crosshair className="w-4 h-4 text-gray-500" />
                          }
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Hip-Hop Substyle Section */}
          {autotagging.hiphop_substyle?.enabled && (
            <div className="bg-gradient-to-br from-fuchsia-900/30 to-purple-900/20 backdrop-blur-md rounded-xl p-6 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.1)] hover:shadow-[0_0_20px_rgba(168,85,247,0.2)] transition-all duration-300 mt-6">
              <h4 className="text-sm font-medium text-purple-100/80 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
                Hip-Hop Substyle Classification
              </h4>

              <div className="space-y-3">
                {autotagging.hiphop_substyle.top_substyles
                  .filter(substyle => substyle.prob >= 0.01)
                  .map((substyle, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 rounded-full bg-purple-500" />
                        <div>
                          <div className="text-sm font-medium text-white">
                            {substyle.label.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
                          </div>
                          <div className="text-xs text-gray-400">
                            #{index + 1} Substyle
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-sm font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-fuchsia-100 drop-shadow-sm">
                          {Math.round(substyle.prob * 100)}%
                        </div>
                        <div className="w-16 bg-gray-800 rounded-full h-1.5 mt-1 overflow-hidden ring-1 ring-gray-700">
                          <div
                            className="h-1.5 rounded-full bg-purple-500 shadow-[0_0_8px_currentColor]"
                            style={{ width: `${substyle.prob * 100}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {/* Genre Distribution */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h4 className="text-sm font-medium text-gray-300 mb-4">Genre Distribution</h4>

            <div className="space-y-2">
              {Object.entries(
                tags.reduce((acc, tag) => {
                  acc[tag.genre] = (acc[tag.genre] || 0) + tag.score;
                  return acc;
                }, {})
              )
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([genre, totalScore]) => (
                  <div key={genre} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${getGenreColor(genre)}`} />
                      <span className="text-sm text-gray-300">{genre}</span>
                    </div>
                    <div className="text-sm text-gray-400">
                      {Math.round(totalScore * 100)}%
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}

      {visualizationMode === 'dna' && (
        <GenreDNA tags={(() => {
          // Merge substyles into tags for DNA view
          if (!autotagging.hiphop_substyle?.enabled || !autotagging.hiphop_substyle.top_substyles) {
            return tags;
          }

          // Find existing Hip-Hop genre name from original tags to ensure exact match
          const existingHipHopTag = tags.find(tag =>
            tag.genre.toLowerCase().includes('hip') && tag.genre.toLowerCase().includes('hop')
          );
          const hipHopGenreName = existingHipHopTag ? existingHipHopTag.genre : 'Hip-Hop';

          // Convert substyles to tag format as subgenres of Hip-Hop (filter >= 1%)
          const substyleTags = autotagging.hiphop_substyle.top_substyles
            .filter(substyle => substyle.prob >= 0.01)
            .map(substyle => ({
              genre: hipHopGenreName,  // Use same genre name as existing tags
              subgenre: substyle.label.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
              score: substyle.prob
            }));

          // Merge with existing tags
          return [...tags, ...substyleTags];
        })()} />
      )}

      {visualizationMode === 'waveform' && audioFile && (
        <GenreWaveformOverlay audioFile={audioFile} tags={tags} />
      )}

      <GenreExplainModal
        open={explainOpen}
        onClose={() => setExplainOpen(false)}
        loading={explainLoading}
        error={explainError}
        data={explainData}
      />
    </div>
  );
}

export default AutoTagDisplay;
