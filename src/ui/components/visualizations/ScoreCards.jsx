import React from 'react';
import { TrendingUp, Target, Clock, Mic2, Volume2, Sparkles, BarChart3 } from 'lucide-react';
import { timingScore } from '../../../utils/timing.js';
import { getScoreBadgeClass } from '../../../utils/vocal-scoring.js';

const GENRE_CONFIDENCE_THRESHOLD = 0.10;

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
          <div className="bg-gradient-to-br from-pink-900/40 to-fuchsia-900/20 backdrop-blur-md rounded-xl p-5 border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.15)] min-h-[180px] flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_25px_rgba(236,72,153,0.25)] hover:border-pink-500/50">
            <div className="flex items-center gap-2 mb-3">
              <Target className="w-6 h-6 text-pink-400 drop-shadow-[0_0_8px_rgba(236,72,153,0.6)]" />
              <h4 className="text-sm font-medium text-pink-100/70 uppercase tracking-widest">Top Genre Tag</h4>
            </div>
            <div className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-pink-300 to-fuchsia-100 drop-shadow-md mb-2 break-words leading-tight text-3xl flex items-center flex-wrap gap-2">
              <span>
                {results.autotagging.tags[0].subgenre
                  ? `${results.autotagging.tags[0].genre} - ${results.autotagging.tags[0].subgenre}`
                  : results.autotagging.tags[0].genre}
              </span>
              {results.autotagging.tags[0].score < GENRE_CONFIDENCE_THRESHOLD && (
                <span className="text-xs font-semibold bg-amber-900/40 text-amber-300 border border-amber-600/40 px-2 py-0.5 rounded-full uppercase tracking-wide whitespace-nowrap">
                  Other
                </span>
              )}
            </div>
            <p className="text-sm text-pink-200/50">
              Confidence: {Math.round(results.autotagging.tags[0].score * 100)}%
            </p>
          </div>
        )}
        {spectralFit && spectralScore !== null && (
          <div className="bg-gradient-to-br from-cyan-900/40 to-blue-900/20 backdrop-blur-md rounded-xl p-5 border border-cyan-500/30 shadow-[0_0_15px_rgba(34,211,238,0.15)] min-h-[180px] flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_25px_rgba(34,211,238,0.25)] hover:border-cyan-500/50">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-6 h-6 text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]" />
              <h4 className="text-sm font-medium text-cyan-100/70 uppercase tracking-widest">Spectral Genre Fit</h4>
            </div>
            <div>
              <div className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-300 to-blue-100 drop-shadow-md mb-2 leading-tight text-3xl">
                {getSpectralLabel(spectralScore)}
              </div>
              <div className="text-base text-cyan-200/70 font-medium">
                {activeSpectralGenre ? `${activeSpectralGenre}` : 'Reference'} match
              </div>
            </div>
            <p className="text-sm text-cyan-200/50">
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
          <div className="bg-gradient-to-br from-purple-900/40 to-fuchsia-900/20 backdrop-blur-md rounded-xl p-4 border border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] min-h-[140px] flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_25px_rgba(168,85,247,0.25)] hover:border-purple-500/50">
            <div className="flex items-center gap-2 mb-2">
              <Mic2 className="w-5 h-5 text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]" />
              <h4 className="text-xs font-medium text-purple-100/70 uppercase tracking-widest">Pitch Stability</h4>
            </div>
            <div className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-fuchsia-100 drop-shadow-md mb-1 leading-tight text-3xl">
              {pitchStabilityScore}
              <span className="text-lg text-purple-300/50 mix-blend-screen ml-1">/100</span>
            </div>
            <p className="text-xs text-purple-200/50">
              CV: {results.smile?.egemaps?.features?.pitch?.coefficient_of_variation ?
                (results.smile.egemaps.features.pitch.coefficient_of_variation * 100).toFixed(1) + '%' : 'N/A'}
            </p>
          </div>
        )}

        {isNumber(dynamicControlScore) && (
          <div className="bg-gradient-to-br from-indigo-900/40 to-blue-900/20 backdrop-blur-md rounded-xl p-4 border border-indigo-500/30 shadow-[0_0_15px_rgba(99,102,241,0.15)] min-h-[140px] flex flex-col justify-between transition-all duration-300 hover:shadow-[0_0_25px_rgba(99,102,241,0.25)] hover:border-indigo-500/50">
            <div className="flex items-center gap-2 mb-2">
              <Volume2 className="w-5 h-5 text-indigo-400 drop-shadow-[0_0_8px_rgba(99,102,241,0.6)]" />
              <h4 className="text-xs font-medium text-indigo-100/70 uppercase tracking-widest">Dynamic Control</h4>
            </div>
            <div className="font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-300 to-blue-100 drop-shadow-md mb-1 leading-tight text-3xl">
              {dynamicControlScore}
              <span className="text-lg text-indigo-300/50 mix-blend-screen ml-1">/100</span>
            </div>
            <p className="text-xs text-indigo-200/50">
              Range: {results.smile?.egemaps?.features?.dynamics?.range_db ?
                results.smile.egemaps.features.dynamics.range_db.toFixed(1) + ' dB' : 'N/A'}
            </p>
          </div>
        )}


        {/* Loudness Score Cards */}
        {isNumber(globalLufs) && (() => {
          const colors = getLoudnessColors(globalLufs);
          const label = getLoudnessLabel(globalLufs);
          return (
            <div className={`bg-gradient-to-br backdrop-blur-md rounded-xl p-5 border min-h-[180px] flex flex-col justify-between transition-all duration-300 ${colors.cardClass}`}>
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className={`w-6 h-6 ${colors.iconClass}`} />
                <h4 className={`text-sm font-medium uppercase tracking-widest ${colors.headerClass}`}>Loudness</h4>
              </div>
              <div>
                <div className={`font-semibold text-2xl mb-1 ${colors.textClass}`}>
                  {label}
                </div>
                <div className={`font-extrabold leading-tight text-4xl ${colors.valueClass}`}>
                  {globalLufs?.toFixed(1) || 'N/A'}
                  <span className="text-xl text-white/40 mix-blend-screen ml-1">LUFS</span>
                </div>
              </div>
              <p className={`text-sm ${colors.headerClass} opacity-70`}>
                LRA: {loudnessData?.global?.input_lra?.toFixed(1) || 'N/A'} •
                TP: {loudnessData?.global?.input_tp?.toFixed(1) || 'N/A'} dBTP
              </p>
            </div>
          );
        })()}

        {stemDelta && isNumber(stemDelta?.lufs_delta) && stemDelta?.staging_assessment && (
          <div className={`bg-gradient-to-br backdrop-blur-md rounded-xl p-5 border min-h-[180px] flex flex-col justify-between transition-all duration-300 ${
            stemDelta.staging_assessment === 'balanced'
            ? 'from-green-900/40 to-emerald-900/20 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_25px_rgba(34,197,94,0.25)] hover:border-green-500/50'
            : stemDelta.staging_assessment === 'vocals_hot'
              ? 'from-red-900/40 to-rose-900/20 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:shadow-[0_0_25px_rgba(239,68,68,0.25)] hover:border-red-500/50'
              : 'from-blue-900/40 to-cyan-900/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] hover:border-blue-500/50'
            }`}>
            <div className="flex items-center gap-2 mb-3">
              <Volume2 className={`w-6 h-6 drop-shadow-[0_0_8px_currentColor] ${
                stemDelta.staging_assessment === 'balanced' ? 'text-green-400' :
                stemDelta.staging_assessment === 'vocals_hot' ? 'text-red-400' : 'text-blue-400'
              }`} />
              <h4 className={`text-sm font-medium uppercase tracking-widest ${
                stemDelta.staging_assessment === 'balanced' ? 'text-green-100/70' :
                stemDelta.staging_assessment === 'vocals_hot' ? 'text-red-100/70' : 'text-blue-100/70'
              }`}>Gain Staging</h4>
            </div>
            <div>
              <div className={`font-semibold text-2xl mb-1 drop-shadow-sm ${
                stemDelta.staging_assessment === 'balanced' ? 'text-green-300' :
                stemDelta.staging_assessment === 'vocals_hot' ? 'text-red-300' : 'text-blue-300'
              }`}>
                {stemDelta.staging_assessment === 'balanced' ? 'Balanced' :
                  stemDelta.staging_assessment === 'vocals_hot' ? 'Vocals Hot' : 'Vocals Soft'}
              </div>
              <div className={`font-extrabold text-transparent bg-clip-text drop-shadow-md leading-tight text-4xl ${
                stemDelta.staging_assessment === 'balanced' ? 'bg-gradient-to-r from-green-300 to-emerald-100' :
                stemDelta.staging_assessment === 'vocals_hot' ? 'bg-gradient-to-r from-red-300 to-rose-100' :
                'bg-gradient-to-r from-blue-300 to-cyan-100'
              }`}>
                {stemDelta.lufs_delta > 0 ? '+' : ''}{stemDelta.lufs_delta?.toFixed(1) || 'N/A'}
                <span className="text-xl text-white/40 mix-blend-screen ml-1">ΔLUFS</span>
              </div>
            </div>
            <p className={`text-sm mt-2 opacity-70 ${
                stemDelta.staging_assessment === 'balanced' ? 'text-green-100' :
                stemDelta.staging_assessment === 'vocals_hot' ? 'text-red-100' : 'text-blue-100'
            }`}>
              Vocals {stemDelta.lufs_delta > 0 ? 'louder' : 'softer'} than instrumental by {Math.abs(stemDelta.lufs_delta).toFixed(1)} LUFS
            </p>
          </div>
        )}
      </div>

      {/* Badge text for streaming */}
      {(keyFitScore !== null || timingScoreValue !== null || pitchStabilityScore !== null || dynamicControlScore !== null || globalLufs !== null) && (
        <div className="mt-6 p-4 bg-gray-800/50 backdrop-blur-md rounded-xl border border-gray-700/50 shadow-inner">
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

function getSpectralLabel(score) {
  if (!Number.isFinite(score)) {
    return 'Unknown';
  }
  if (score >= 70) return 'Well-Balanced';
  if (score >= 60) return 'Balanced';
  if (score >= 50) return 'Unbalanced';
  return 'Very Unbalanced';
}

function getLoudnessLabel(lufs) {
  if (!Number.isFinite(lufs)) {
    return 'Unknown';
  }
  if (lufs > -6) return 'Very Loud';
  if (lufs > -10) return 'Loud';
  if (lufs > -14) return 'Standard';
  if (lufs > -18) return 'Quiet';
  return 'Very Quiet';
}

function getLoudnessColors(lufs) {
  if (!Number.isFinite(lufs)) {
    return {
      cardClass: 'from-gray-900/40 to-gray-800/20 border-gray-600/30 shadow-[0_0_15px_rgba(156,163,175,0.1)] hover:shadow-[0_0_25px_rgba(156,163,175,0.2)] hover:border-gray-500/50',
      iconClass: 'text-gray-400',
      textClass: 'text-gray-300 drop-shadow-sm',
      valueClass: 'text-gray-200 drop-shadow-md',
      headerClass: 'text-gray-100/70'
    };
  }
  if (lufs > -6) {
    return {
      cardClass: 'from-red-900/40 to-rose-900/20 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.15)] hover:shadow-[0_0_25px_rgba(239,68,68,0.25)] hover:border-red-500/50',
      iconClass: 'text-red-400 drop-shadow-[0_0_8px_rgba(239,68,68,0.6)]',
      textClass: 'text-red-300 drop-shadow-sm',
      valueClass: 'text-transparent bg-clip-text bg-gradient-to-r from-red-300 to-rose-100 drop-shadow-md',
      headerClass: 'text-red-100/70'
    };
  }
  if (lufs > -10) {
    return {
      cardClass: 'from-orange-900/40 to-amber-900/20 border-orange-500/30 shadow-[0_0_15px_rgba(249,115,22,0.15)] hover:shadow-[0_0_25px_rgba(249,115,22,0.25)] hover:border-orange-500/50',
      iconClass: 'text-orange-400 drop-shadow-[0_0_8px_rgba(249,115,22,0.6)]',
      textClass: 'text-orange-300 drop-shadow-sm',
      valueClass: 'text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-amber-100 drop-shadow-md',
      headerClass: 'text-orange-100/70'
    };
  }
  if (lufs > -14) {
    return {
      cardClass: 'from-green-900/40 to-emerald-900/20 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.15)] hover:shadow-[0_0_25px_rgba(34,197,94,0.25)] hover:border-green-500/50',
      iconClass: 'text-green-400 drop-shadow-[0_0_8px_rgba(34,197,94,0.6)]',
      textClass: 'text-green-300 drop-shadow-sm',
      valueClass: 'text-transparent bg-clip-text bg-gradient-to-r from-green-300 to-emerald-100 drop-shadow-md',
      headerClass: 'text-green-100/70'
    };
  }
  if (lufs > -18) {
    return {
      cardClass: 'from-blue-900/40 to-cyan-900/20 border-blue-500/30 shadow-[0_0_15px_rgba(59,130,246,0.15)] hover:shadow-[0_0_25px_rgba(59,130,246,0.25)] hover:border-blue-500/50',
      iconClass: 'text-blue-400 drop-shadow-[0_0_8px_rgba(59,130,246,0.6)]',
      textClass: 'text-blue-300 drop-shadow-sm',
      valueClass: 'text-transparent bg-clip-text bg-gradient-to-r from-blue-300 to-cyan-100 drop-shadow-md',
      headerClass: 'text-blue-100/70'
    };
  }
  return {
    cardClass: 'from-purple-900/40 to-fuchsia-900/20 border-purple-500/30 shadow-[0_0_15px_rgba(168,85,247,0.15)] hover:shadow-[0_0_25px_rgba(168,85,247,0.25)] hover:border-purple-500/50',
    iconClass: 'text-purple-400 drop-shadow-[0_0_8px_rgba(168,85,247,0.6)]',
    textClass: 'text-purple-300 drop-shadow-sm',
    valueClass: 'text-transparent bg-clip-text bg-gradient-to-r from-purple-300 to-fuchsia-100 drop-shadow-md',
    headerClass: 'text-purple-100/70'
  };
}

export default ScoreCards;
