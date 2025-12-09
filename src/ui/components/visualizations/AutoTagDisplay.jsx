import React, { useState } from 'react';
import { Tag, Copy, Check, BarChart3, Activity, Zap, Info } from 'lucide-react';
import GenreExplainModal from '../GenreExplainModal';
import { getGenreColor } from '../../utils/genreColors';
import GenreDNA from './GenreDNA';
import GenreWaveformOverlay from './GenreWaveformOverlay';

function AutoTagDisplay({ autotagging, audioFile }) {
  const [copied, setCopied] = useState(false);
  const [visualizationMode, setVisualizationMode] = useState('list');
  const [explainOpen, setExplainOpen] = useState(false);
  const [explainLoading, setExplainLoading] = useState(false);
  const [explainError, setExplainError] = useState('');
  const [explainData, setExplainData] = useState(null);

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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Tag className="w-5 h-5 text-purple-400" />
          Genre Classification
        </h3>
        <div className="text-xs text-gray-500">
          Model: {model.split('/').pop()}
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
          {/* Top Result */}
          {tags.length > 0 && (
            <div className="bg-gradient-to-r from-purple-900/30 to-blue-900/30 rounded-lg p-6 border border-purple-700/50">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-300 mb-1">Top Prediction</h4>
                  <div className="text-2xl font-bold text-white">
                    {tags[0].subgenre ? `${tags[0].genre} - ${tags[0].subgenre}` : tags[0].genre}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-3xl font-bold text-purple-300">
                    {Math.round(tags[0].score * 100)}
                    <span className="text-lg text-gray-400">%</span>
                  </div>
                  <div className="text-xs text-gray-500">Confidence</div>
                </div>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-2 mb-4">
                <div
                  className="bg-purple-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${tags[0].score * 100}%` }}
                />
              </div>

              <button
                onClick={handleCopyTopTag}
                className="btn-secondary flex items-center gap-2 text-sm"
              >
                {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy Tag'}
              </button>
            </div>
          )}

          {/* All Results */}
          <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
            <h4 className="text-base font-medium text-gray-300 mb-5 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" />
              All Predictions ({tags.length})
            </h4>

            <div className="space-y-4">
              {tags.map((tag, index) => (
                <div key={index} className="flex items-center justify-between p-4 bg-gray-700/50 rounded-lg">
                  <div className="flex items-center gap-4">
                    <div className={`w-4 h-4 rounded-full ${getGenreColor(tag.genre)}`} />
                    <div>
                      <div className="text-base font-semibold text-white">
                        {tag.subgenre ? `${tag.genre} - ${tag.subgenre}` : tag.genre}
                      </div>
                      <div className="text-sm text-gray-400 mt-0.5">
                        #{index + 1} • {tag.genre}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-lg font-bold text-gray-200 mb-1">
                      {Math.round(tag.score * 100)}%
                    </div>
                    <div className="w-20 bg-gray-600 rounded-full h-2 mt-1">
                      <div
                        className={`h-2 rounded-full ${getGenreColor(tag.genre)}`}
                        style={{ width: `${tag.score * 100}%` }}
                      />
                    </div>
                    <button
                      onClick={() => handleExplain(tag.genre, tag.subgenre)}
                      className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 text-sm text-gray-200"
                    >
                      <Info className="w-4 h-4" /> Explain
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Hip-Hop Substyle Section */}
          {autotagging.hiphop_substyle?.enabled && (
            <div className="bg-gradient-to-r from-purple-900/30 to-pink-900/30 rounded-lg p-6 border border-purple-700/50">
              <h4 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400" />
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
                        <div className="text-sm font-bold text-gray-200">
                          {Math.round(substyle.prob * 100)}%
                        </div>
                        <div className="w-16 bg-gray-600 rounded-full h-1.5 mt-1">
                          <div
                            className="h-1.5 rounded-full bg-purple-500"
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
