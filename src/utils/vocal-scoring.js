/**
 * Vocal scoring algorithms for OpenSMILE eGeMAPS features
 * 
 * Provides scores (0-100) for:
 * - Pitch stability: based on F0 coefficient of variation
 * - Dynamic control: based on loudness range and variance
 * - Voice quality: combined metric from jitter, shimmer, and HNR
 */

/**
 * Calculate pitch stability score (0-100)
 * Lower coefficient of variation = higher score
 * 
 * @param {Object} pitchFeatures - Parsed pitch features from smile parser
 * @returns {number} Score from 0-100
 */
export function calculatePitchStabilityScore(pitchFeatures) {
  if (!pitchFeatures || pitchFeatures.coefficient_of_variation === undefined) {
    return null;
  }

  const cv = pitchFeatures.coefficient_of_variation;
  
  // Convert coefficient of variation to percentage
  const cvPercent = cv * 100;
  
  // Score based on CV thresholds:
  // 0-5%: Excellent (90-100)
  // 5-10%: Good (70-89)
  // 10-20%: Fair (50-69)
  // 20-30%: Poor (30-49)
  // 30%+: Very poor (0-29)
  
  let score;
  if (cvPercent <= 5) {
    score = 90 + (5 - cvPercent) * 2; // 90-100
  } else if (cvPercent <= 10) {
    score = 70 + (10 - cvPercent) * 4; // 70-89
  } else if (cvPercent <= 20) {
    score = 50 + (20 - cvPercent) * 2; // 50-69
  } else if (cvPercent <= 30) {
    score = 30 + (30 - cvPercent) * 2; // 30-49
  } else {
    score = Math.max(0, 30 - (cvPercent - 30) * 1.5); // 0-29
  }
  
  return Math.round(Math.max(0, Math.min(100, score)));
}

/**
 * Calculate dynamic control score (0-100)
 * Based on loudness range and variance - appropriate dynamics = higher score
 * 
 * @param {Object} dynamicsFeatures - Parsed dynamics features from smile parser
 * @returns {number} Score from 0-100
 */
export function calculateDynamicControlScore(dynamicsFeatures) {
  console.log('[Vocal Scoring] Dynamic Control input:', dynamicsFeatures);
  if (!dynamicsFeatures || dynamicsFeatures.range_db === undefined) {
    console.log('[Vocal Scoring] Dynamic Control returning null - missing range_db');
    return null;
  }

  const range = dynamicsFeatures.range_db;
  const stddev = dynamicsFeatures.stddev_db || 0;
  
  // Ideal dynamic range for vocals: 15-35 dB
  // Too little range (< 10 dB): boring, low score
  // Too much range (> 40 dB): inconsistent, low score
  // Good range (15-30 dB): high score
  
  let rangeScore;
  if (range < 10) {
    rangeScore = Math.max(20, range * 2); // 0-20
  } else if (range <= 15) {
    rangeScore = 20 + (range - 10) * 4; // 20-40
  } else if (range <= 30) {
    rangeScore = 40 + (range - 15) * 3; // 40-85
  } else if (range <= 40) {
    rangeScore = 85 - (range - 30) * 2; // 65-85
  } else {
    rangeScore = Math.max(0, 65 - (range - 40) * 1.5); // 0-65
  }
  
  // Penalty for excessive variance (inconsistent dynamics)
  const variancePenalty = Math.min(20, stddev * 10);
  
  const finalScore = Math.max(0, rangeScore - variancePenalty);
  return Math.round(Math.min(100, finalScore));
}

/**
 * Calculate voice quality score (0-100)
 * Combined metric from jitter, shimmer, and HNR
 * Lower jitter/shimmer + higher HNR = higher score
 * 
 * @param {Object} qualityFeatures - Parsed quality features from smile parser
 * @returns {number} Score from 0-100
 */
export function calculateVoiceQualityScore(qualityFeatures) {
  if (!qualityFeatures) {
    return null;
  }

  let hnrScore = 50; // Default neutral score
  let jitterScore = 50;
  let shimmerScore = 50;
  
  // HNR scoring (higher is better)
  if (qualityFeatures.hnr_db !== undefined) {
    const hnr = qualityFeatures.hnr_db;
    // Good HNR: 15-25 dB
    if (hnr >= 20) {
      hnrScore = 80 + Math.min(20, (hnr - 20) * 2); // 80-100
    } else if (hnr >= 15) {
      hnrScore = 60 + (hnr - 15) * 4; // 60-80
    } else if (hnr >= 10) {
      hnrScore = 40 + (hnr - 10) * 4; // 40-60
    } else {
      hnrScore = Math.max(0, 40 - (10 - hnr) * 4); // 0-40
    }
  }
  
  // Jitter scoring (lower is better)
  if (qualityFeatures.jitter_local !== undefined) {
    const jitter = qualityFeatures.jitter_local * 100; // Convert to percentage
    // Good jitter: < 1%
    if (jitter <= 0.5) {
      jitterScore = 90 + (0.5 - jitter) * 20; // 90-100
    } else if (jitter <= 1.0) {
      jitterScore = 70 + (1.0 - jitter) * 40; // 70-90
    } else if (jitter <= 2.0) {
      jitterScore = 50 + (2.0 - jitter) * 20; // 50-70
    } else if (jitter <= 3.0) {
      jitterScore = 30 + (3.0 - jitter) * 20; // 30-50
    } else {
      jitterScore = Math.max(0, 30 - (jitter - 3.0) * 10); // 0-30
    }
  }
  
  // Shimmer scoring (lower is better)
  if (qualityFeatures.shimmer_local_db !== undefined) {
    const shimmer = qualityFeatures.shimmer_local_db;
    // Good shimmer: < 0.5 dB
    if (shimmer <= 0.3) {
      shimmerScore = 90 + (0.3 - shimmer) * 33; // 90-100
    } else if (shimmer <= 0.5) {
      shimmerScore = 70 + (0.5 - shimmer) * 100; // 70-90
    } else if (shimmer <= 1.0) {
      shimmerScore = 50 + (1.0 - shimmer) * 40; // 50-70
    } else if (shimmer <= 1.5) {
      shimmerScore = 30 + (1.5 - shimmer) * 40; // 30-50
    } else {
      shimmerScore = Math.max(0, 30 - (shimmer - 1.5) * 20); // 0-30
    }
  }
  
  // Weighted average: HNR 50%, jitter 25%, shimmer 25%
  const finalScore = (hnrScore * 0.5) + (jitterScore * 0.25) + (shimmerScore * 0.25);
  
  return Math.round(Math.max(0, Math.min(100, finalScore)));
}

/**
 * Calculate all vocal scores from parsed OpenSMILE features
 * 
 * @param {Object} vocalFeatures - Parsed vocal features from smile parser
 * @returns {Object} Object with pitch stability, dynamic control, and voice quality scores
 */
export function calculateVocalScores(vocalFeatures) {
  if (!vocalFeatures) {
    return null;
  }

  const scores = {
    pitch_stability: calculatePitchStabilityScore(vocalFeatures.pitch),
    dynamic_control: calculateDynamicControlScore(vocalFeatures.dynamics),
    voice_quality: calculateVoiceQualityScore(vocalFeatures.quality)
  };

  // Calculate overall vocal score as average of available scores
  // Note: Voice Quality (timbre-related) is intentionally excluded from the overall
  // to avoid penalising unique vocal textures. Overall focuses on stability and control.
  const overallCandidates = [scores.pitch_stability, scores.dynamic_control].filter(s => s !== null);
  const availableScores = Object.values(scores).filter(score => score !== null);
  if (availableScores.length > 0) {
    scores.overall = overallCandidates.length > 0
      ? Math.round(overallCandidates.reduce((sum, score) => sum + score, 0) / overallCandidates.length)
      : null;
  } else {
    scores.overall = null;
  }

  return scores;
}

/**
 * Get score color class for UI styling
 * 
 * @param {number} score - Score from 0-100
 * @returns {string} Tailwind color class
 */
export function getScoreColorClass(score) {
  if (score === null || score === undefined) {
    return 'text-gray-500';
  }
  
  if (score >= 80) {
    return 'text-green-600';
  } else if (score >= 60) {
    return 'text-yellow-600';
  } else if (score >= 40) {
    return 'text-orange-600';
  } else {
    return 'text-red-600';
  }
}

/**
 * Get score badge color class for UI styling
 * 
 * @param {number} score - Score from 0-100
 * @returns {string} Tailwind badge color class
 */
export function getScoreBadgeClass(score) {
  if (score === null || score === undefined) {
    return 'bg-gray-100 text-gray-600';
  }
  
  if (score >= 80) {
    return 'bg-green-100 text-green-800';
  } else if (score >= 60) {
    return 'bg-yellow-100 text-yellow-800';
  } else if (score >= 40) {
    return 'bg-orange-100 text-orange-800';
  } else {
    return 'bg-red-100 text-red-800';
  }
}
