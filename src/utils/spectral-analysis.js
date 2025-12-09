const EPSILON = 1e-6;

import { FREQUENCY_BANDS, GENRE_SPECTRAL_PROFILES } from './genre-spectral-profiles.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
const roundTo = (value, decimals = 2) => Number.parseFloat(value.toFixed(decimals));

function toDecibels(value, reference) {
  const ref = reference ?? 1;
  if (Math.abs(ref) < EPSILON) {
    return 0;
  }
  const safeValue = Math.max(Math.abs(value), EPSILON);
  return 20 * Math.log10(safeValue / ref);
}

export function calculateFrequencyBands({ raw_data, snapshot } = {}) {
  // 1) Prefer LTAS if present
  const ltas = snapshot?.ltas_bands || raw_data?.ltas;

  if (ltas) {
    // Support both shapes:
    //  - { abs_db: {...}, rel_db: {...} }
    //  - { subBass: ..., bass: ... } (flat dict)
    const absBands = ltas.abs_db || ltas;

    // Mid-band anchor: lowMid, mid, highMid (matches ltas.py)
    const midIds = ['lowMid', 'mid', 'highMid'];
    const midValues = midIds
      .map(id => absBands[id])
      .filter(v => Number.isFinite(v));

    const anchor = midValues.length
      ? midValues.reduce((a, b) => a + b, 0) / midValues.length
      : 0;

    return FREQUENCY_BANDS.reduce((acc, band) => {
      const raw = absBands[band.id];
      const rel = Number.isFinite(raw) ? raw - anchor : 0;
      acc[band.id] = roundTo(rel, 2);
      return acc;
    }, {});
  }

  const contrastBands = raw_data?.contrast?.bandAverages || snapshot?.bandAverages;
  if (contrastBands && contrastBands.length > 0) {
    const interpolateBand = (bandIndex) => {
      if (contrastBands.length === 1 || FREQUENCY_BANDS.length === 1) {
        return contrastBands[0];
      }
      const t = bandIndex / Math.max(FREQUENCY_BANDS.length - 1, 1);
      const position = t * (contrastBands.length - 1);
      const lower = Math.floor(position);
      const upper = Math.min(lower + 1, contrastBands.length - 1);
      const weight = position - lower;
      const a = contrastBands[lower];
      const b = contrastBands[upper];
      return a + (b - a) * weight;
    };

    const magnitudes = FREQUENCY_BANDS.map((_, index) => {
      const value = interpolateBand(index);
      return Math.max(Math.abs(value), EPSILON);
    });

    const logMagnitudes = magnitudes.map(val => 20 * Math.log10(val));
    const mean = logMagnitudes.reduce((sum, value) => sum + value, 0) / logMagnitudes.length;
    const centered = logMagnitudes.map(value => value - mean);
    const maxAbs = Math.max(...centered.map(value => Math.abs(value)), 1e-6);
    const scale = 6 / maxAbs;

    return FREQUENCY_BANDS.reduce((acc, band, index) => {
      acc[band.id] = roundTo(centered[index] * scale, 2);
      return acc;
    }, {});
  }

  const tonalBalance = snapshot?.tonal_balance || {};
  const brightness = tonalBalance.brightness ?? 0;
  const warmth = tonalBalance.warmth ?? 0;
  const bassContent = tonalBalance.bass_content ?? 0;

  const mapped = {
    subBass: bassContent,
    bass: bassContent * 0.9,
    lowMid: -warmth * 0.7,
    mid: -warmth * 0.85,
    highMid: brightness * 0.7,
    presence: brightness,
    brilliance: brightness * 1.1
  };

  const values = Object.values(mapped).map(val => Math.max(Math.abs(val), EPSILON));
  const reference = Math.max(...values);

  if (reference <= EPSILON) {
    return buildEmptyBandObject();
  }

  return FREQUENCY_BANDS.reduce((acc, band) => {
    const raw = mapped[band.id] ?? EPSILON;
    acc[band.id] = roundTo(toDecibels(raw, reference));
    return acc;
  }, {});
}

export function normalizeSpectralData(rawData = {}) {
  const normalizeSeries = (series) => {
    if (!series?.bandValues || series.bandValues.length === 0) {
      return null;
    }

    const flattened = series.bandValues.flat().map(val => Math.abs(val));
    const max = Math.max(...flattened, EPSILON);
    return series.bandValues.map((band) => band.map(val => clamp(val / max, 0, 1)));
  };

  return {
    contrastBands: normalizeSeries(rawData.contrast),
    fluxValues: rawData.flux?.values || [],
    fluxTimes: rawData.flux?.times || [],
    energyValues: rawData.energy?.values || [],
    energyTimes: rawData.energy?.times || []
  };
}

/**
 * Calculate band-level fit score using tolerance-based approach
 * 
 * NEW SCORING METHODOLOGY (Tolerance Band Focused):
 * =====================================================
 * 
 * The scoring prioritizes staying within tolerance bands rather than exact curve matching.
 * 
 * For points WITHIN tolerance (lower ≤ actual ≤ upper):
 *   - Base score: 95% (0.95)
 *   - Distance penalty: lose up to 10% based on distance from exact target
 *   - Minimum score: 85% if within tolerance
 *   - This means most well-mixed tracks score 85-95 per band
 * 
 * For points OUTSIDE tolerance:
 *   - Exponential penalty based on how far outside
 *   - Small overshoot: ~60-70%
 *   - Medium overshoot: ~30-50%
 *   - Large overshoot: approaches 0%
 *   - Formula: exp(-normalizedOvershoot * 1.5) * 0.7
 * 
 * Final score bonuses:
 *   - All bands (100%) in tolerance: +3% bonus (capped at 98%)
 *   - Most bands (≥85%) in tolerance: +1% bonus (capped at 95%)
 * 
 * This approach ensures:
 *   - Tracks fully within tolerance score 88-95+ (much higher than before)
 *   - Tracks with slight overshoots still score 50-80 (more forgiving)
 *   - Tracks with major issues score <50 (appropriate penalty)
 *   - Score diversity reflects actual mix quality, not just curve similarity
 * 
 * @param {Object} bandEntries - Array of band comparison data
 * @param {number} alignmentOffset - Vertical alignment offset
 * @returns {Object} { weightedSum, totalWeight, bandsInTolerance, totalBands }
 */
function calculateBandScore(bandEntries, alignmentOffset) {
  let weightedSum = 0;
  let totalWeight = 0;
  let bandsInTolerance = 0;

  for (const entry of bandEntries) {
    const adjustedActual = entry.actual - alignmentOffset;
    const { target, lower, upper, weight } = entry;

    let bandScore = 0;

    // Check if within tolerance band (lower to upper)
    if (adjustedActual >= lower && adjustedActual <= upper) {
      // Within tolerance: reward being close to target
      bandsInTolerance++;

      const rangeSize = upper - lower;
      const distanceFromTarget = Math.abs(adjustedActual - target);
      const normalizedDistance = distanceFromTarget / (rangeSize / 2); // 0 at target, 1 at boundary

      // Quadratic penalty: being closer to target is much more valuable
      // Start at 90, lose up to 40 points based on distance from target
      const distancePenalty = normalizedDistance * normalizedDistance * 0.40;
      bandScore = 0.90 - distancePenalty;
      bandScore = Math.max(bandScore, 0.50); // Minimum 50% if within tolerance (was 75%)
    } else {
      // Outside tolerance: steep penalty
      const distanceOutside = adjustedActual < lower
        ? (lower - adjustedActual)
        : (adjustedActual - upper);

      const rangeSize = upper - lower;
      const normalizedOvershoot = distanceOutside / rangeSize;

      // Much steeper exponential penalty
      // Small overshoots (~0.5x range): ~30%
      // Medium overshoots (~1x range): ~10%
      // Large overshoots (>1.5x range): <5%
      bandScore = Math.exp(-normalizedOvershoot * 3.0) * 0.45; // was 2.0 * 0.65
      bandScore = Math.max(bandScore, 0); // Floor at 0
    }

    weightedSum += bandScore * weight;
    totalWeight += weight;
  }

  return { weightedSum, totalWeight, bandsInTolerance, totalBands: bandEntries.length };
}

/**
 * Calculate spectral feature scores (contrast, flux)
 * @param {Object} snapshot - Spectral snapshot data
 * @param {Object} genreProfile - Genre profile with spectral targets
 * @returns {Object} { weightedSum, totalWeight }
 */
function calculateSpectralFeatureScore(snapshot, genreProfile) {
  let weightedSum = 0;
  let totalWeight = 0;

  const contrastMetrics = {
    mean: snapshot?.avg_contrast,
    flux: snapshot?.avg_flux
  };

  // Spectral contrast scoring
  const contrastProfile = genreProfile.spectralContrast;
  if (contrastProfile?.mean !== undefined && contrastMetrics.mean !== undefined) {
    const target = contrastProfile.mean.target;
    const tolerance = Math.max(contrastProfile.mean.tolerance ?? 0.15, EPSILON);
    const lower = target - tolerance;
    const upper = target + tolerance;
    const actual = contrastMetrics.mean;

    let score = 0;
    if (actual >= lower && actual <= upper) {
      const distanceFromTarget = Math.abs(actual - target);
      const normalizedDistance = distanceFromTarget / tolerance;
      score = 0.95 - (normalizedDistance * 0.10);
    } else {
      const distanceOutside = actual < lower ? (lower - actual) : (actual - upper);
      const normalizedOvershoot = distanceOutside / tolerance;
      score = Math.exp(-normalizedOvershoot * 1.5) * 0.7;
    }

    weightedSum += score * 0.15;
    totalWeight += 0.15;
  }

  // Spectral flux scoring
  const fluxProfile = genreProfile.spectralFlux;
  if (fluxProfile && contrastMetrics.flux !== undefined) {
    const target = fluxProfile.target;
    const tolerance = Math.max(fluxProfile.tolerance ?? 0.1, EPSILON);
    const lower = target - tolerance;
    const upper = target + tolerance;
    const actual = contrastMetrics.flux;

    let score = 0;
    if (actual >= lower && actual <= upper) {
      const distanceFromTarget = Math.abs(actual - target);
      const normalizedDistance = distanceFromTarget / tolerance;
      score = 0.95 - (normalizedDistance * 0.10);
    } else {
      const distanceOutside = actual < lower ? (lower - actual) : (actual - upper);
      const normalizedOvershoot = distanceOutside / tolerance;
      score = Math.exp(-normalizedOvershoot * 1.5) * 0.7;
    }

    weightedSum += score * 0.1;
    totalWeight += 0.1;
  }

  return { weightedSum, totalWeight };
}

/**
 * Calculate genre fit score with improved tolerance-based methodology
 * 
 * @param {Object} data - Input data
 * @param {Object} data.frequencyBands - Frequency band levels (dB)
 * @param {Object} data.snapshot - Spectral snapshot with contrast/flux metrics
 * @param {Object} genreProfile - Genre profile with targets and tolerance bands
 * @param {Object} options - Options
 * @param {boolean} options.returnDetails - Return detailed breakdown
 * @param {boolean} options.debug - Enable debug logging
 * @returns {number|Object} Score (0-100) or detailed result object
 * 
 * SCORING EXAMPLES (for reference):
 * ---------------------------------
 * Perfect fit (all bands on target): ~98-100
 * Excellent fit (all within tolerance, near target): ~90-95
 * Good fit (all within tolerance, some distance from target): ~85-90
 * Decent fit (most within tolerance, 1-2 slight overshoots): ~70-85
 * Mediocre fit (half within tolerance, moderate overshoots): ~50-70
 * Poor fit (few within tolerance, large deviations): ~30-50
 * Very poor fit (mostly outside tolerance): <30
 */
export function calculateGenreFitScore({ frequencyBands, snapshot } = {}, genreProfile, options = {}) {
  if (!genreProfile) {
    return options?.returnDetails ? { score: 0, alignmentOffset: 0, details: {} } : 0;
  }

  const bands = frequencyBands || buildEmptyBandObject();
  const targets = genreProfile.frequencyTargets || {};
  const energyWeights = genreProfile.energyDistribution || {};

  const bandEntries = FREQUENCY_BANDS
    .map((band) => {
      const actual = bands[band.id];
      const targetInfo = targets[band.id];
      if (actual === undefined || !targetInfo) {
        return null;
      }
      const weight = energyWeights[band.id] ?? (1 / FREQUENCY_BANDS.length);
      return {
        band,
        actual,
        target: targetInfo.target,
        lower: targetInfo.lower ?? (targetInfo.target - targetInfo.tolerance),
        upper: targetInfo.upper ?? (targetInfo.target + targetInfo.tolerance),
        tolerance: targetInfo.tolerance,
        weight
      };
    })
    .filter(Boolean);

  if (bandEntries.length === 0) {
    return options?.returnDetails ? { score: 0, alignmentOffset: 0, details: {} } : 0;
  }

  // Calculate alignment offset (average difference between actual and target)
  const alignmentOffset = bandEntries.reduce((sum, entry) => sum + (entry.actual - entry.target), 0) / bandEntries.length;

  // Calculate band-level score
  const bandResult = calculateBandScore(bandEntries, alignmentOffset);

  // Calculate spectral feature scores (contrast, flux)
  const featureResult = calculateSpectralFeatureScore(snapshot, genreProfile);

  // Combine all scores
  const totalWeightedSum = bandResult.weightedSum + featureResult.weightedSum;
  const totalWeight = bandResult.totalWeight + featureResult.totalWeight;

  if (totalWeight <= 0) {
    return options?.returnDetails ? { score: 0, alignmentOffset, details: {} } : 0;
  }

  // Calculate base score (0-1 range)
  let baseScore = totalWeightedSum / totalWeight;

  // No bonuses - use raw score for maximum discrimination
  const toleranceFitRatio = bandResult.bandsInTolerance / bandResult.totalBands;

  // Convert to 0-100 scale
  const finalScore = clamp(baseScore * 100, 0, 100);

  // Optional logging for debugging
  if (options?.debug) {
    console.log('[Spectral Scoring] Genre fit calculation:', {
      finalScore: finalScore.toFixed(1),
      bandsInTolerance: `${bandResult.bandsInTolerance}/${bandResult.totalBands}`,
      toleranceFitRatio: (toleranceFitRatio * 100).toFixed(1) + '%',
      bandScore: ((bandResult.weightedSum / bandResult.totalWeight) * 100).toFixed(1),
      featureScore: featureResult.totalWeight > 0
        ? ((featureResult.weightedSum / featureResult.totalWeight) * 100).toFixed(1)
        : 'N/A',
      alignmentOffset: alignmentOffset.toFixed(2) + ' dB'
    });
  }

  if (options?.returnDetails) {
    return {
      score: finalScore,
      alignmentOffset,
      details: {
        bandsInTolerance: bandResult.bandsInTolerance,
        totalBands: bandResult.totalBands,
        toleranceFitRatio,
        bandScore: (bandResult.weightedSum / bandResult.totalWeight) * 100,
        featureScore: featureResult.totalWeight > 0
          ? (featureResult.weightedSum / featureResult.totalWeight) * 100
          : null
      }
    };
  }

  return finalScore;
}

export function getBestMatchingGenre({ frequencyBands, snapshot } = {}, profiles = GENRE_SPECTRAL_PROFILES) {
  const scores = {};
  const alignmentOffsets = {};

  for (const [genreKey, profile] of Object.entries(profiles)) {
    const { score, alignmentOffset } = calculateGenreFitScore({ frequencyBands, snapshot }, profile, { returnDetails: true });
    scores[genreKey] = score;
    alignmentOffsets[genreKey] = alignmentOffset;
  }

  let bestMatch = null;
  let bestScore = -Infinity;

  for (const [genre, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestMatch = genre;
      bestScore = score;
    }
  }

  return {
    scores,
    alignmentOffsets,
    bestMatch,
    bestScore
  };
}

export function resolveGenreKey(name) {
  if (!name) {
    return null;
  }

  const lower = name.toLowerCase();
  const sanitized = lower.replace(/&/g, 'and');

  const aliasChecks = [
    { match: 'edm', target: 'Electronic' },
    { match: 'electronic dance', target: 'Electronic' },
    { match: 'electronic', target: 'Electronic' },
    { match: 'orchestral', target: 'Classical' },
    { match: 'orchestra', target: 'Classical' },
    { match: 'classical', target: 'Classical' },
    { match: 'classical/jazz', target: 'Classical' },
    { match: 'jazz/classical', target: 'Jazz' },
    { match: 'jazz', target: 'Jazz' },
    { match: 'funk/soul', target: 'Funk/Soul' },
    { match: 'funk soul', target: 'Funk/Soul' },
    { match: 'funk', target: 'Funk/Soul' },
    { match: 'soul', target: 'Funk/Soul' },
    { match: 'rnb soul', target: 'Funk/Soul' },
    { match: 'rnbsoul', target: 'Funk/Soul' },
    { match: 'randb', target: 'Funk/Soul' },
    { match: 'soulandfunk', target: 'Funk/Soul' }
  ];

  for (const { match, target } of aliasChecks) {
    if (sanitized.includes(match)) {
      if (GENRE_SPECTRAL_PROFILES[target]) {
        return target;
      }
    }
  }

  const tokenSeparators = /[\/|,]+|\s+/;
  const tokens = sanitized.split(tokenSeparators).map(token => token.trim()).filter(Boolean);
  for (const token of tokens) {
    const maybeAlias = aliasChecks.find(({ match }) => match === token);
    if (maybeAlias && GENRE_SPECTRAL_PROFILES[maybeAlias.target]) {
      return maybeAlias.target;
    }
  }

  let exactMatch = null;

  for (const key of Object.keys(GENRE_SPECTRAL_PROFILES)) {
    if (key.toLowerCase() === lower) {
      exactMatch = key;
      break;
    }
  }

  if (exactMatch) {
    return exactMatch;
  }

  for (const key of Object.keys(GENRE_SPECTRAL_PROFILES)) {
    const keyLower = key.toLowerCase();
    if (lower.includes(keyLower) || keyLower.includes(lower)) {
      return key;
    }
  }

  return null;
}

export { FREQUENCY_BANDS, GENRE_SPECTRAL_PROFILES };

function buildEmptyBandObject() {
  return FREQUENCY_BANDS.reduce((acc, band) => {
    acc[band.id] = 0;
    return acc;
  }, {});
}
