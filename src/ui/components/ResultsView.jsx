import React, { useState } from 'react';
import { BarChart3, Music, Activity, Sparkles, Download, Volume2, Tag, Gauge, Star, Waves, Search } from 'lucide-react';
import ScoreCards from './visualizations/ScoreCards';
import WaveformDisplay from './visualizations/WaveformDisplay';
import EnhancedWaveformDisplay from './visualizations/EnhancedWaveformDisplay';
import SynchronizedDataPanel from './visualizations/SynchronizedDataPanel';
import PlaybackControls from './visualizations/PlaybackControls';
import VocalStemPlaybackControls from './visualizations/VocalStemPlaybackControls';
import StemPlaybackControls from './visualizations/StemPlaybackControls';
import ChordTimeline from './visualizations/ChordTimeline';
import MelodyPlot from './visualizations/MelodyPlot';
import MelodyTimeline from './visualizations/MelodyTimeline';
import OnsetScatter from './visualizations/OnsetScatter';
import KeyFitHeatmap from './visualizations/KeyFitHeatmap';
import VocalQuality from './visualizations/VocalQuality';
import { LoudnessDisplay } from './visualizations/LoudnessDisplay';
import AutoTagDisplay from './visualizations/AutoTagDisplay';
import SpectralDisplay from './visualizations/SpectralDisplay.jsx';
import StereoAnalysis from './visualizations/StereoAnalysis.jsx';
import SearchTab from './visualizations/SearchTab.jsx';
import ExportMenu from './ExportMenu';
import FERMFactor from './FERMFactor.jsx';
import FavoriteToggleButton from './FavoriteToggleButton.jsx';
import { useAudioPlayer } from '../contexts/AudioPlayerContext';

function ResultsView({ results, audioFile }) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isFavorite, setIsFavorite] = useState(false);
  const [isMarkingFavorite, setIsMarkingFavorite] = useState(false);
  const { loadAudio, seekTo } = useAudioPlayer();

  // Load audio when component mounts or audioFile changes
  React.useEffect(() => {
    if (audioFile) {
      // Add a small delay to prevent rapid successive loads
      const timeoutId = setTimeout(() => {
        loadAudio(audioFile);
      }, 100);

      return () => clearTimeout(timeoutId);
    }
  }, [audioFile]); // Remove loadAudio from dependencies to prevent infinite loop

  // Listen for seek events from visualizations
  React.useEffect(() => {
    const handleSeek = (event) => {
      seekTo(event.detail.time);
    };

    window.addEventListener('seek-audio', handleSeek);
    return () => window.removeEventListener('seek-audio', handleSeek);
  }, [seekTo]);

  // Debug: summarize incoming results (only log once per results change)
  React.useEffect(() => {
    if (results) {
      // eslint-disable-next-line no-console
      console.log('[ResultsView] results summary:', {
        hasRhythm: !!results?.rhythm,
        beats: results?.rhythm?.beats?.length || 0,
        downbeats: results?.rhythm?.downbeats?.length || 0,
        hasHarmony: !!results?.harmony,
        chords: results?.harmony?.chords?.length || 0,
        hasMelody: !!results?.melody,
        f0: results?.melody?.f0_hz?.length || 0,
        stemsUsed: results?.stemsUsed || false
      });
    }
  }, [results]); // Only log when results actually change

  // Check if this clip is already marked as favorite
  React.useEffect(() => {
    if (results && audioFile) {
      checkFavoriteStatus();
    }
  }, [results, audioFile]);

  const checkFavoriteStatus = async () => {
    if (!audioFile) return;

    try {
      const clipName = audioFile.name;
      const result = await window.electronAPI.mongodb('mongodb:query-records', {
        clipNameSearch: clipName,
        limit: 1
      });

      if (result.success && result.records.length > 0) {
        setIsFavorite(result.records[0].isFavorite || false);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const handleMarkAsFavorite = async () => {
    if (!audioFile || !results) return;

    setIsMarkingFavorite(true);
    try {
      const clipName = audioFile.name;
      const newFavoriteStatus = !isFavorite;

      // First, try to find existing record
      const queryResult = await window.electronAPI.mongodb('mongodb:query-records', {
        clipNameSearch: clipName,
        limit: 1
      });

      if (queryResult.success && queryResult.records.length > 0) {
        // Update existing record
        const record = queryResult.records[0];
        const updateResult = await window.electronAPI.mongodb('mongodb:update-favorite-status', {
          id: record._id,
          isFavorite: newFavoriteStatus,
          notes: record.favoriteNotes
        });

        if (updateResult.success) {
          setIsFavorite(newFavoriteStatus);
        }
      } else {
        // Create new record with favorite status
        const record = {
          clipName,
          date: new Date(),
          timestamp: Date.now(),
          fermFactor: results?.fermFactor || null,
          keyFit: {
            score: results?.scores?.key_fit || results?.keyAnalysis?.inKeyPercentage || null,
            key: results?.keyAnalysis?.detectedKey || null,
            mode: results?.keyAnalysis?.mode || null
          },
          timingTightness: results?.scores?.timing_tightness || null,
          loudness: {
            LUFS: results?.loudness?.LUFS || results?.loudness?.global_lufs || null,
            LRA: results?.loudness?.LRA || results?.loudness?.global_lra || null,
            TP: results?.loudness?.TP || results?.loudness?.global_tp || null
          },
          gainStaging: {
            deltaLufs: results?.gainStaging?.deltaLufs || results?.gainStaging?.stem_delta || null,
            quality: results?.gainStaging?.quality || results?.gainStaging?.staging || null
          },
          genreTags: results?.autotagging?.genreTags || [],
          hiphopSubstyle: results?.autotagging?.hiphop_substyle || null,
          timingMetrics: results?.rhythm?.timing || null,
          inKeyPercentage: results?.keyAnalysis?.inKeyPercentage || null,
          topGenre: results?.autotagging?.genreTags?.[0]?.genre || null,
          topGenreWithStyle: results?.autotagging?.genreTags?.[0]
            ? (results.autotagging.genreTags[0].subgenre
              ? `${results.autotagging.genreTags[0].genre} - ${results.autotagging.genreTags[0].subgenre}`
              : results.autotagging.genreTags[0].genre)
            : null,
          analysisVersion: '1.0',
          isFavorite: newFavoriteStatus,
          favoriteMarkedAt: newFavoriteStatus ? new Date() : null,
          favoriteNotes: null,
          timePeriod: null,
          periodStart: null,
          periodEnd: null,
          periodType: null
        };

        const saveResult = await window.electronAPI.mongodb('mongodb:save-analysis', record);

        if (saveResult.success) {
          setIsFavorite(newFavoriteStatus);
        }
      }
    } catch (error) {
      console.error('Error marking as favorite:', error);
    } finally {
      setIsMarkingFavorite(false);
    }
  };

  const tabs = [
    { id: 'overview', name: 'Overview', icon: BarChart3 },
    { id: 'rhythm', name: 'Rhythm', icon: Activity, available: results?.rhythm },
    { id: 'harmony', name: 'Harmony', icon: Music, available: results?.harmony },
    { id: 'melody', name: 'Melody', icon: Music, available: results?.melody },
    { id: 'spectral', name: 'Spectral Balance', icon: BarChart3, available: results?.spectral },
    { id: 'timbre', name: 'Vocal Quality', icon: Sparkles, available: results?.smile },
    { id: 'loudness', name: 'Loudness', icon: Volume2, available: results?.loudness },
    { id: 'spatial', name: 'Stereo Field', icon: Waves, available: results?.spatial },
    { id: 'autotagging', name: 'Genre Tags', icon: Tag, available: results?.autotagging },
    { id: 'search', name: 'Search', icon: Search, available: results?.autotagging?.embeddingPath || results?.embeddingPath },
    { id: 'ferm', name: 'FERM Factor', icon: Gauge, available: true },
  ].filter(tab => tab.id === 'overview' || tab.available);

  return (
    <div className="space-y-6">
      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-semibold">Analysis Results</h2>
            {results?.stemsUsed && (
              <p className="text-sm text-blue-400 mt-1">
                ✓ Using stem separation: Instrumental for rhythm/harmony, Vocals for melody/onsets
              </p>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleMarkAsFavorite}
              disabled={isMarkingFavorite}
              className={`px-4 py-2 rounded text-sm font-medium transition-colors flex items-center gap-2 ${isFavorite
                ? 'bg-yellow-600 hover:bg-yellow-700 text-white'
                : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                } ${isMarkingFavorite ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <Star className={`w-4 h-4 ${isFavorite ? 'fill-current' : ''}`} />
              {isMarkingFavorite ? 'Marking...' : (isFavorite ? 'Marked as Favorite' : 'Mark as Favorite')}
            </button>
            <ExportMenu results={results} />
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-700 mb-6">
          <div className="flex gap-2 overflow-x-auto">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-4 py-3 font-medium text-sm border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap ${activeTab === tab.id
                    ? 'border-primary-500 text-primary-400'
                    : 'border-transparent text-gray-400 hover:text-gray-300'
                    }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && (
            <div className="space-y-6">
              <ScoreCards results={results} />
              {results.rhythm && results.rhythm.beats?.length > 0 && (
                <WaveformDisplay audioFile={audioFile} beats={results.rhythm.beats} downbeats={results.rhythm.downbeats} />
              )}
            </div>
          )}


          {activeTab === 'rhythm' && results.rhythm && (
            <div className="space-y-6">
              <StemPlaybackControls
                vocalStemPath={results.vocalPath}
                instrumentalStemPath={results.instrumentalPath}
                stemsUsed={results.stemsUsed}
                fullMixPath={audioFile?.path || results.file}
              />

              {/* Tempo Display */}
              {results.rhythm.tempo_bpm && (
                <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-primary-600/20 flex items-center justify-center">
                        <Activity className="w-6 h-6 text-primary-400" />
                      </div>
                      <div>
                        <div className="text-sm text-gray-400">Detected Tempo</div>
                        <div className="text-3xl font-bold text-white">
                          {results.rhythm.tempo_bpm.toFixed(1)} <span className="text-lg text-gray-400">BPM</span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm text-gray-400">Beat Count</div>
                      <div className="text-xl font-semibold text-gray-200">
                        {results.rhythm.beats?.length || 0} beats
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <WaveformDisplay audioFile={audioFile} beats={results.rhythm.beats} downbeats={results.rhythm.downbeats} />
              {results.onsets && results.rhythm.beats && (
                <OnsetScatter
                  onsets={results.onsets}
                  beats={results.rhythm.beats}
                  subdivision={results.scores?.timing?.subdivision}
                  // gridMode can be 'auto' | 'quarter' | 'eighth' | 'triplet' | 'sixteenth'
                  gridMode={'auto'}
                />
              )}
            </div>
          )}

          {activeTab === 'harmony' && results.harmony && (
            <div className="space-y-6">
              <StemPlaybackControls
                vocalStemPath={results.vocalPath}
                instrumentalStemPath={results.instrumentalPath}
                stemsUsed={results.stemsUsed}
                fullMixPath={audioFile?.path || results.file}
              />
              <ChordTimeline chords={results.harmony.chords} keyAnalysis={results.keyAnalysis} />
            </div>
          )}

          {activeTab === 'melody' && results.melody && (
            <div className="space-y-6">
              <StemPlaybackControls
                vocalStemPath={results.vocalPath}
                instrumentalStemPath={results.instrumentalPath}
                stemsUsed={results.stemsUsed}
                fullMixPath={audioFile?.path || results.file}
              />
              <MelodyPlot melody={results.melody} keyAnalysis={results.keyAnalysis} />
              <MelodyTimeline melody={results.melody} keyAnalysis={results.keyAnalysis} />
              {results.harmony && (
                <KeyFitHeatmap melody={results.melody} chords={results.harmony.chords} />
              )}
            </div>
          )}

          {activeTab === 'timbre' && results.smile && (
            <VocalQuality smileData={results.smile} />
          )}

          {activeTab === 'loudness' && results.loudness && (
            <LoudnessDisplay loudness={results.loudness} />
          )}

          {activeTab === 'spatial' && results.spatial && (
            <StereoAnalysis spatialData={results.spatial} />
          )}

          {activeTab === 'spectral' && results.spectral && (
            <SpectralDisplay
              spectralData={results.spectral}
              detectedGenre={results.autotagging?.tags?.[0]?.genre}
            />
          )}

          {activeTab === 'autotagging' && results.autotagging && (
            <AutoTagDisplay autotagging={results.autotagging} audioFile={audioFile} />
          )}

          {activeTab === 'search' && (
            <SearchTab results={results} clipName={audioFile?.name} />
          )}

          {activeTab === 'ferm' && (
            <FERMFactor />
          )}
        </div>
      </div>
    </div>
  );
}

export default ResultsView;
