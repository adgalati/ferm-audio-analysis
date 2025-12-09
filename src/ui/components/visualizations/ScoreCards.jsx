import React from 'react';
import { TrendingUp, Target, Clock, Mic2, Volume2, Sparkles, BarChart3 } from 'lucide-react';
import { timingScore } from '../../../utils/timing.js';
import { getScoreBadgeClass } from '../../../utils/vocal-scoring.js';

function ScoreCards({ results }) {
  const isNumber = (v) => typeof v === 'number' && Number.isFinite(v);

  const hasTiming = isNumber(results?.scores?.timing?.mate_ms);
  const timingScoreValue = hasTiming ? timingScore(results.scores.timing.mate_ms) : null;

  // key_fit is already 0-100 from backend; avoid double scaling
  const rawKeyFit = results?.scores?.key_fit;
  const keyFitScore = isNumber(rawKeyFit) ? Math.round(rawKeyFit) : null;

  const bias = results?.scores?.timing?.bias_ms;
  const hasBias = isNumber(bias) && bias !== 0;
  const biasLabel = (bias || 0) > 0 ? 'Late' : (bias || 0) < 0 ? 'Early' : 'On Time';

  // Vocal quality scores
  const vocalScores = results?.smile?.egemaps?.scores;
  const pitchStabilityScore = vocalScores?.pitch_stability;
  const dynamicControlScore = vocalScores?.dynamic_control;
  // const voiceQualityScore = vocalScores?.voice_quality;

  // Loudness scores
  const loudnessData = results?.loudness;
  const globalLufs = loudnessData?.global?.input_i;
  const stemDelta = loudnessData?.stem_delta;

  const spectralFit = results?.spectral?.genreFit;
  const activeSpectralGenre = spectralFit?.selectedGenre || spectralFit?.detectedGenre || spectralFit?.bestMatch;
  const spectralScore = isNumber(spectralFit?.scores?.[activeSpectralGenre])
    ? Math.round(spectralFit.scores[activeSpectralGenre])
    : null;

  return (
    <div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {/* Top Genre Tag (if available) */}
        {results?.autotagging?.tags?.[0] && (
          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-lg p-5 border border-purple-700/50 min-h-[180px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-6 h-6 text-purple-400" />
              <h4 className="text-sm font-medium text-gray-300">Top Genre Tag</h4>
            </div>
            <div className="font-bold text-purple-300 mb-2 break-words leading-tight text-xl">
              {results.autotagging.tags[0].subgenre
                ? `${results.autotagging.tags[0].genre} - ${results.autotagging.tags[0].subgenre}`
                : results.autotagging.tags[0].genre}
            </div>
            <p className="text-sm text-gray-400">
              Confidence: {Math.round(results.autotagging.tags[0].score * 100)}%
            </p>
          </div>
        )}
        {spectralFit && spectralScore !== null && (
          <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 rounded-lg p-5 border border-indigo-700/50 min-h-[180px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-6 h-6 text-indigo-300" />
              <h4 className="text-sm font-medium text-gray-300 uppercase tracking-wide">Spectral Genre Fit</h4>
            </div>
            <div>
              <div className="font-bold text-indigo-100 mb-2 leading-tight text-5xl">
                {spectralScore}
                <span className="text-2xl text-indigo-200/80 ml-1">/100</span>
              </div>
              <div className="text-base text-indigo-200/70 font-medium">
                {activeSpectralGenre ? `${activeSpectralGenre}` : 'Reference'} match
              </div>
            </div>
            <p className="text-sm text-indigo-200/60">
              Best match: {spectralFit.bestMatch} • Confidence {formatConfidence(spectralFit.detectedConfidence)}
            </p>
          </div>
        )}

        {/* Key Fit - Moved to Melody tab */}
        {/* {keyFitScore !== null && (
          <div className="bg-gradient-to-br from-primary-900/50 to-primary-800/30 rounded-lg p-4 border border-primary-700/50 min-h-[140px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Target className="w-5 h-5 text-primary-400" />
              <h4 className="text-xs font-medium text-gray-300">Key Fit</h4>
            </div>
            <div className="font-bold text-primary-300 mb-1 leading-tight text-3xl">
              {keyFitScore}
              <span className="text-lg text-gray-400">/100</span>
            </div>
            <p className="text-xs text-gray-500">How in-key the melody is</p>
          </div>
        )} */}

        {/* Timing Tightness - Moved to Rhythm tab */}
        {/* {timingScoreValue !== null && (
          <div className="bg-gradient-to-br from-green-900/50 to-green-800/30 rounded-lg p-4 border border-green-700/50 min-h-[140px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp className="w-5 h-5 text-green-400" />
              <h4 className="text-xs font-medium text-gray-300">Timing Tightness</h4>
            </div>
            <div className="font-bold text-green-300 mb-1 leading-tight text-3xl">
              {Math.round(timingScoreValue)}
              <span className="text-lg text-gray-400">/100</span>
            </div>
            <p className="text-xs text-gray-500">
              MATE: {results.scores.timing.mate_ms.toFixed(1)}ms
              {results.scores.timing.subdivision && (
                <span> • {results.scores.timing.subdivision.n === 2 ? '8ths' : 
                         results.scores.timing.subdivision.n === 3 ? 'triplets' : '16ths'}</span>
              )}
            </p>
          </div>
        )} */}

        {/* Timing Bias - Moved to Rhythm tab */}
        {/* {hasBias && (
          <div className="bg-gradient-to-br from-blue-900/50 to-blue-800/30 rounded-lg p-4 border border-blue-700/50 min-h-[140px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-5 h-5 text-blue-400" />
              <h4 className="text-xs font-medium text-gray-300">Timing Bias</h4>
            </div>
            <div className="font-bold text-blue-300 mb-1 leading-tight text-3xl">
              {Math.abs(bias).toFixed(0)}
              <span className="text-lg text-gray-400">ms</span>
            </div>
            <p className="text-xs text-gray-500">{biasLabel}</p>
          </div>
        )} */}

        {/* Vocal Quality Score Cards */}
        {isNumber(pitchStabilityScore) && (
          <div className="bg-gradient-to-br from-purple-900/50 to-purple-800/30 rounded-lg p-4 border border-purple-700/50 min-h-[140px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Mic2 className="w-5 h-5 text-purple-400" />
              <h4 className="text-xs font-medium text-gray-300">Pitch Stability</h4>
            </div>
            <div className="font-bold text-purple-300 mb-1 leading-tight text-3xl">
              {pitchStabilityScore}
              <span className="text-lg text-gray-400">/100</span>
            </div>
            <p className="text-xs text-gray-500">
              CV: {results.smile?.egemaps?.features?.pitch?.coefficient_of_variation ?
                (results.smile.egemaps.features.pitch.coefficient_of_variation * 100).toFixed(1) + '%' : 'N/A'}
            </p>
          </div>
        )}

        {isNumber(dynamicControlScore) && (
          <div className="bg-gradient-to-br from-indigo-900/50 to-indigo-800/30 rounded-lg p-4 border border-indigo-700/50 min-h-[140px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-5 h-5 text-indigo-400" />
              <h4 className="text-xs font-medium text-gray-300">Dynamic Control</h4>
            </div>
            <div className="font-bold text-indigo-300 mb-1 leading-tight text-3xl">
              {dynamicControlScore}
              <span className="text-lg text-gray-400">/100</span>
            </div>
            <p className="text-xs text-gray-500">
              Range: {results.smile?.egemaps?.features?.dynamics?.range_db ?
                results.smile.egemaps.features.dynamics.range_db.toFixed(1) + ' dB' : 'N/A'}
            </p>
          </div>
        )}


        {/* Loudness Score Cards */}
        {isNumber(globalLufs) && (
          <div className="bg-gradient-to-br from-orange-900/50 to-orange-800/30 rounded-lg p-5 border border-orange-700/50 min-h-[180px] flex flex-col justify-between">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-6 h-6 text-orange-400" />
              <h4 className="text-sm font-medium text-gray-300">Loudness</h4>
            </div>
            <div className="font-bold text-orange-300 mb-2 leading-tight text-4xl">
              {globalLufs?.toFixed(1) || 'N/A'}
              <span className="text-xl text-gray-400 ml-1">LUFS</span>
            </div>
            <p className="text-sm text-gray-400">
              LRA: {loudnessData?.global?.input_lra?.toFixed(1) || 'N/A'} •
              TP: {loudnessData?.global?.input_tp?.toFixed(1) || 'N/A'} dBTP
            </p>
          </div>
        )}

        {stemDelta && isNumber(stemDelta?.lufs_delta) && stemDelta?.staging_assessment && (
          <div className={`bg-gradient-to-br rounded-lg p-5 border min-h-[180px] flex flex-col justify-between ${stemDelta.staging_assessment === 'balanced'
            ? 'from-green-900/50 to-green-800/30 border-green-700/50'
            : stemDelta.staging_assessment === 'vocals_hot'
              ? 'from-red-900/50 to-red-800/30 border-red-700/50'
              : 'from-blue-900/50 to-blue-800/30 border-blue-700/50'
            }`}>
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className={`w-6 h-6 ${stemDelta.staging_assessment === 'balanced'
                ? 'text-green-400'
                : stemDelta.staging_assessment === 'vocals_hot'
                  ? 'text-red-400'
                  : 'text-blue-400'
                }`} />
              <h4 className="text-sm font-medium text-gray-300">Gain Staging</h4>
            </div>
            <div className={`font-bold mb-2 leading-tight text-4xl ${stemDelta.staging_assessment === 'balanced'
              ? 'text-green-300'
              : stemDelta.staging_assessment === 'vocals_hot'
                ? 'text-red-300'
                : 'text-blue-300'
              }`}>
              {stemDelta.lufs_delta > 0 ? '+' : ''}{stemDelta.lufs_delta?.toFixed(1) || 'N/A'}
              <span className="text-xl text-gray-400 ml-1">ΔLUFS</span>
            </div>
            <p className="text-sm text-gray-400">
              {stemDelta.staging_assessment === 'balanced' ? 'Balanced' :
                stemDelta.staging_assessment === 'vocals_hot' ? 'Vocals Hot' : 'Vocals Soft'}
            </p>
          </div>
        )}
      </div>

      {/* Badge text for streaming */}
      {(keyFitScore !== null || timingScoreValue !== null || pitchStabilityScore !== null || dynamicControlScore !== null || globalLufs !== null) && (
        <div className="mt-6 p-4 bg-gray-800 rounded-lg border border-gray-700">
          <p className="text-xs text-gray-500 mb-2">Stream Overlay Badge:</p>
          <code className="text-sm text-primary-300 font-mono break-words whitespace-normal">
            {keyFitScore !== null && `In-Key ${keyFitScore}`}
            {keyFitScore !== null && timingScoreValue !== null && ' • '}
            {timingScoreValue !== null && `Timing ${Math.round(timingScoreValue)}`}
            {bias !== 0 && ` • ${biasLabel} bias ${Math.abs(bias).toFixed(0)} ms`}
            {pitchStabilityScore !== null && ` • Pitch ${pitchStabilityScore}`}
            {dynamicControlScore !== null && ` • Dynamics ${dynamicControlScore}`}
            {globalLufs !== null && ` • ${globalLufs?.toFixed(1) || 'N/A'} LUFS`}
            {stemDelta && stemDelta.lufs_delta !== null && ` • ${stemDelta.lufs_delta > 0 ? '+' : ''}${stemDelta.lufs_delta?.toFixed(1) || 'N/A'}Δ`}
          </code>
        </div>
      )}
    </div>
  );
}

function formatConfidence(value) {
  if (!Number.isFinite(value)) {
    return '—';
  }
  return `${Math.round(value * 100)}%`;
}

export default ScoreCards;
