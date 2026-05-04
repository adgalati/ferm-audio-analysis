import { calculatePeriod } from './period-calculator.js';
/**
 * MongoDB Schema and Validation Helpers
 * Defines the structure for storing analysis records in MongoDB
 */

/**
 * Genre confidence threshold (10%).
 * If the top genre tag's score falls below this, the track's official
 * topGenre is set to "Other" — the raw genreTags array is never altered.
 */
export const GENRE_CONFIDENCE_THRESHOLD = 0.10;

/**
 * Transform analysis results into a record for MongoDB storage
 * @param {string} clipName - Name of the audio clip
 * @param {Object} results - Full analysis results object
 * @param {Object} [options]
 * @param {('weekly'|'biweekly')} [options.periodType]
 * @param {number} [options.startDayOfWeek]
 * @returns {Object} Formatted record for MongoDB
 */
export function transformResultsToRecord(clipName, results, options = {}) {
  const { periodType = 'weekly', startDayOfWeek = 1, sourceType = 'independent' } = options;
  console.log('[MongoDB Schema] sourceType:', sourceType);

  // Extract top 7 genre tags
  const genreTags = results?.autotagging?.tags
    ? results.autotagging.tags.slice(0, 7).map(tag => ({
      genre: tag.genre || '',
      subgenre: tag.subgenre || null,
      score: tag.score || 0
    }))
    : [];

  // Extract loudness data
  const loudnessData = results?.loudness || {};

  // Extract gain staging data
  const gainStagingData = results?.gainStaging || {};

  // Extract key analysis data - FIXED: use detectedKey from keyAnalysis
  const keyAnalysisData = results?.keyAnalysis || {};

  // Period calculation based on current time
  const now = new Date();
  const { period, periodStart, periodEnd } = calculatePeriod(now, periodType, startDayOfWeek);

  return {
    clipName,
    date: now,
    timestamp: Date.now(),

    // FERM Factor score
    fermFactor: results?.fermFactor || null,

    // Key analysis - FIXED to use correct field names
    keyFit: {
      score: results?.scores?.key_fit || keyAnalysisData?.inKeyPercentage || null,
      key: keyAnalysisData?.detectedKey || null,
      mode: keyAnalysisData?.mode || null
    },

    // Timing tightness
    timingTightness: results?.scores?.timing?.mate_ms || results?.scores?.timing_tightness || null,

    // Tempo (BPM)
    tempo_bpm: results?.rhythm?.tempo_bpm || null,

    // Loudness measurements
    loudness: {
      LUFS: loudnessData?.global?.input_i || loudnessData?.LUFS || loudnessData?.global_lufs || null,
      LRA: loudnessData?.global?.input_lra || loudnessData?.LRA || loudnessData?.global_lra || null,
      TP: loudnessData?.global?.input_tp || loudnessData?.TP || loudnessData?.global_tp || null
    },

    // Gain staging
    gainStaging: {
      deltaLufs: loudnessData?.stem_delta?.lufs_delta || gainStagingData?.deltaLufs || gainStagingData?.stem_delta || null,
      quality: loudnessData?.stem_delta?.staging_assessment || gainStagingData?.quality || gainStagingData?.staging || null // 'balanced', 'vocals-hot', 'vocals-quiet'
    },

    // Genre tags (top 7)
    genreTags,

    // Spectral Analysis Data
    spectral: results?.spectral ? {
      frequencyBands: results.spectral.frequencyBands || null,
      snapshot: results.spectral.snapshot || null,
      genreFit: results.spectral.genreFit || null,
      normalized: results.spectral.normalized || null
    } : null,

    // Spatial Analysis Data
    spatial: results?.spatial ? {
      phaseCorrelation: results.spatial.phaseCorrelation || 0,
      sideLoudness: results.spatial.sideLoudness || -99,
      midLoudness: results.spatial.midLoudness || -99,
      widthScore: results.spatial.widthScore || 0,
      widthDescription: results.spatial.widthDescription || 'Unknown'
    } : null,

    // Additional metrics
    timingMetrics: results?.rhythm?.timing || null,
    inKeyPercentage: keyAnalysisData?.inKeyPercentage || null,

    // Favorites (default)
    isFavorite: false,
    favoriteMarkedAt: null,
    favoriteNotes: null,

    // Period
    timePeriod: period,
    periodStart,
    periodEnd,
    periodType,

    // Metadata — genre confidence gating
    //   If the top tag's score is below the threshold the track is
    //   categorized as "Other" for trend analysis. The full genreTags
    //   array is always preserved unmodified.
    topGenre: genreTags.length > 0
      ? (genreTags[0].score >= GENRE_CONFIDENCE_THRESHOLD ? genreTags[0].genre : 'Other')
      : null,
    topGenreWithStyle: genreTags.length > 0
      ? (genreTags[0].score >= GENRE_CONFIDENCE_THRESHOLD
        ? (genreTags[0].subgenre ? `${genreTags[0].genre} - ${genreTags[0].subgenre}` : genreTags[0].genre)
        : 'Other')
      : null,
    topGenreConfidence: genreTags.length > 0 ? genreTags[0].score : null,
    embeddingPath: results?.autotagging?.embeddingPath || null,
    hiphop_substyle: results?.autotagging?.hiphop_substyle || null,
    analysisVersion: '1.1',
    sourceType
  };
}

/**
 * Reconstruct an analysis results object from a stored MongoDB record
 * This allows the UI to visualize the data as if it were just analyzed.
 * Note: Some large time-series data (like full pitch tracks) may be missing if not stored.
 * @param {Object} record - The stored MongoDB record
 * @returns {Object} A results object compatible with the ResultsView
 */
export function reconstructResultsFromRecord(record) {
  if (!record) return null;

  return {
    file: record.clipName, // Placeholder
    timestamp: record.timestamp,

    // Reconstructed Spectral Data
    spectral: record.spectral || null,

    // Reconstructed Spatial Data
    spatial: record.spatial || null,

    // Reconstructed Loudness
    loudness: {
      global: {
        input_i: record.loudness?.LUFS,
        input_lra: record.loudness?.LRA,
        input_tp: record.loudness?.TP
      },
      stem_delta: {
        lufs_delta: record.gainStaging?.deltaLufs,
        staging_assessment: record.gainStaging?.quality
      },
      timeline: null // Not currently stored
    },

    // Reconstructed Key Analysis
    keyAnalysis: {
      detectedKey: record.keyFit?.key,
      mode: record.keyFit?.mode,
      inKeyPercentage: record.inKeyPercentage || record.keyFit?.score,
      scaleNotes: [], // Not stored
      noteAnalysis: [] // Not stored
    },

    // Reconstructed Rhythm/Timing
    rhythm: {
      beats: [], // Not stored
      downbeats: [], // Not stored
      tempo_bpm: record.tempo_bpm || null,
      vocalBeats: []
    },
    onsets: [], // Not stored

    // Reconstructed Harmony
    harmony: {
      chords: [] // Not stored
    },

    // Reconstructed Auto-tagging
    autotagging: {
      tags: record.genreTags || [],
      embeddingPath: record.embeddingPath || null,
      hiphop_substyle: record.hiphop_substyle || null
    },

    // Reconstructed Scores
    scores: {
      key_fit: record.keyFit?.score,
      timing: record.timingMetrics ? {
        mate_ms: record.timingTightness,
        ...record.timingMetrics
      } : { mate_ms: record.timingTightness },
      vocalTiming: null // Not stored
    },

    // FERM Factor
    fermFactor: record.fermFactor
  };
}

/**
 * Validate a record before saving to MongoDB
 * @param {Object} record - Record to validate
 * @returns {Object} { valid: boolean, errors: string[] }
 */
export function validateRecord(record) {
  const errors = [];

  if (!record.clipName || typeof record.clipName !== 'string') {
    errors.push('clipName is required and must be a string');
  }

  if (!record.date || !(record.date instanceof Date)) {
    errors.push('date is required and must be a Date');
  }

  if (record.fermFactor !== null && typeof record.fermFactor !== 'number') {
    errors.push('fermFactor must be a number or null');
  }

  if (record.keyFit) {
    if (record.keyFit.score !== null && typeof record.keyFit.score !== 'number') {
      errors.push('keyFit.score must be a number or null');
    }
    if (record.keyFit.key !== null && typeof record.keyFit.key !== 'string') {
      errors.push('keyFit.key must be a string or null');
    }
  }

  if (record.timingTightness !== null && typeof record.timingTightness !== 'number') {
    errors.push('timingTightness must be a number or null');
  }

  if (record.loudness) {
    if (record.loudness.LUFS !== null && typeof record.loudness.LUFS !== 'number') {
      errors.push('loudness.LUFS must be a number or null');
    }
    if (record.loudness.LRA !== null && typeof record.loudness.LRA !== 'number') {
      errors.push('loudness.LRA must be a number or null');
    }
    if (record.loudness.TP !== null && typeof record.loudness.TP !== 'number') {
      errors.push('loudness.TP must be a number or null');
    }
  }

  if (record.gainStaging) {
    if (record.gainStaging.deltaLufs !== null && typeof record.gainStaging.deltaLufs !== 'number') {
      errors.push('gainStaging.deltaLufs must be a number or null');
    }
    if (record.gainStaging.quality !== null && typeof record.gainStaging.quality !== 'string') {
      errors.push('gainStaging.quality must be a string or null');
    }
  }

  if (!Array.isArray(record.genreTags)) {
    errors.push('genreTags must be an array');
  } else {
    record.genreTags.forEach((tag, idx) => {
      if (!tag.genre || typeof tag.genre !== 'string') {
        errors.push(`genreTags[${idx}].genre is required and must be a string`);
      }
      if (typeof tag.score !== 'number' || tag.score < 0 || tag.score > 1) {
        errors.push(`genreTags[${idx}].score must be a number between 0 and 1`);
      }
    });
  }

  if (typeof record.isFavorite !== 'boolean') {
    errors.push('isFavorite must be a boolean');
  }
  if (record.favoriteMarkedAt !== null && !(record.favoriteMarkedAt instanceof Date)) {
    errors.push('favoriteMarkedAt must be a Date or null');
  }
  if (record.favoriteNotes !== null && typeof record.favoriteNotes !== 'string') {
    errors.push('favoriteNotes must be a string or null');
  }

  if (record.spectral) {
    if (typeof record.spectral !== 'object') {
      errors.push('spectral must be an object');
    }
    // Optional: Add deeper validation for spectral fields if strictness is required
  }

  if (record.spatial) {
    if (typeof record.spatial !== 'object') {
      errors.push('spatial must be an object');
    }
  }

  if (!record.timePeriod || typeof record.timePeriod !== 'string') {
    errors.push('timePeriod is required and must be a string');
  }
  if (!(record.periodStart instanceof Date)) {
    errors.push('periodStart must be a Date');
  }
  if (!(record.periodEnd instanceof Date)) {
    errors.push('periodEnd must be a Date');
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * MongoDB collection indexes to ensure good query performance
 */
export const COLLECTION_INDEXES = [
  { key: { timestamp: -1 } },  // For sorting by date
  { key: { date: -1 } },
  { key: { clipName: 1 } },    // For searching by name
  { key: { topGenre: 1 } },    // For genre filtering
  { key: { fermFactor: 1 } },  // For FERM score range queries
  { key: { 'genreTags.genre': 1 } },  // For genre tag queries
  { key: { isFavorite: 1 } },
  { key: { timePeriod: 1 } },
  { key: { periodStart: -1 } },
  { key: { sourceType: 1 } },
  { key: { affinityLabel: 1 } },       // For affinity training label filtering
  { key: { aiGeneratedLabel: 1 } }     // For AI-detection training label filtering
];
