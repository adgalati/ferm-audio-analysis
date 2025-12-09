const FREQUENCY_BANDS = [
  { id: 'subBass', label: 'Sub-Bass', range: [20, 60] },
  { id: 'bass', label: 'Bass', range: [60, 250] },
  { id: 'lowMid', label: 'Low Mid', range: [250, 500] },
  { id: 'mid', label: 'Mid', range: [500, 2000] },
  { id: 'highMid', label: 'High Mid', range: [2000, 4000] },
  { id: 'presence', label: 'Presence', range: [4000, 8000] },
  { id: 'brilliance', label: 'Brilliance', range: [8000, 20000] }
];

import { LOADED_TONAL_PROFILES } from './tonal-profile-loader.js';

const TARGET_POINT_COUNT = 60;
const FREQ_MIN = 25;
const FREQ_MAX = 16000;
const EPSILON = 1e-6;

const TARGET_CENTERS_HZ = Array.from({ length: TARGET_POINT_COUNT }, (_, i) => {
  const t = i / (TARGET_POINT_COUNT - 1);
  return FREQ_MIN * Math.pow(FREQ_MAX / FREQ_MIN, t);
});

const round = (value, decimals = 2) => Number.parseFloat(value.toFixed(decimals));

// --- Resampling & Anchoring Helpers ---

function sampleAtFrequency(frequencies, values, targetFreq) {
  // Find closest indices
  let lowerIdx = 0;
  let upperIdx = frequencies.length - 1;

  // Binary search or linear scan (linear is fine for this size)
  for (let i = 0; i < frequencies.length - 1; i++) {
    if (frequencies[i] <= targetFreq && frequencies[i + 1] >= targetFreq) {
      lowerIdx = i;
      upperIdx = i + 1;
      break;
    }
  }

  const f1 = frequencies[lowerIdx];
  const f2 = frequencies[upperIdx];
  const v1 = values[lowerIdx];
  const v2 = values[upperIdx];

  if (Math.abs(f2 - f1) < EPSILON) return v1;

  const t = (targetFreq - f1) / (f2 - f1);
  return v1 + t * (v2 - v1);
}

function processProfile(rawProfile) {
  const { frequencies, low, high } = rawProfile;

  // 1. Resample at TARGET_CENTERS_HZ
  const lowResampled = TARGET_CENTERS_HZ.map(f => sampleAtFrequency(frequencies, low, f));
  const highResampled = TARGET_CENTERS_HZ.map(f => sampleAtFrequency(frequencies, high, f));
  const medianResampled = lowResampled.map((l, i) => (l + highResampled[i]) * 0.5);

  // 2. Calculate Anchor (Mean of Mid Frequencies 200-6000Hz)
  const midIndices = [];
  for (let i = 0; i < TARGET_CENTERS_HZ.length; i++) {
    const f = TARGET_CENTERS_HZ[i];
    if (f >= 200 && f <= 6000) {
      midIndices.push(i);
    }
  }

  const midMean = midIndices.length > 0
    ? midIndices.reduce((sum, idx) => sum + medianResampled[idx], 0) / midIndices.length
    : 0;

  // 3. Anchor the resampled curves
  const medianDb = medianResampled.map(v => v - midMean);
  const p10Db = lowResampled.map(v => v - midMean);
  const p90Db = highResampled.map(v => v - midMean);

  // 4. Anchor the high-res curves (for UI)
  const highResLow = low.map(v => v - midMean);
  const highResHigh = high.map(v => v - midMean);

  return {
    curve: { medianDb, p10Db, p90Db },
    highResCurve: {
      frequencies: frequencies,
      low: highResLow,
      high: highResHigh
    }
  };
}

const findIndicesForRange = ([low, high]) => {
  const indices = [];
  for (let i = 0; i < TARGET_CENTERS_HZ.length; i += 1) {
    const frequency = TARGET_CENTERS_HZ[i];
    if (frequency >= low && frequency <= high) {
      indices.push(i);
    }
  }
  return indices;
};

const nearestFrequencyIndex = (frequency) => {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < TARGET_CENTERS_HZ.length; i += 1) {
    const distance = Math.abs(TARGET_CENTERS_HZ[i] - frequency);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
};

const deriveBandTargets = (curve) => {
  const { medianDb, p10Db, p90Db } = curve;
  return FREQUENCY_BANDS.reduce((acc, band) => {
    const indices = findIndicesForRange(band.range);
    let medianSum = 0;
    let p10Sum = 0;
    let p90Sum = 0;
    let count = 0;

    if (indices.length > 0) {
      indices.forEach((idx) => {
        medianSum += medianDb[idx];
        p10Sum += p10Db[idx];
        p90Sum += p90Db[idx];
        count += 1;
      });
    }

    if (count === 0) {
      const center = (band.range[0] + band.range[1]) / 2;
      const idx = nearestFrequencyIndex(center);
      medianSum += medianDb[idx];
      p10Sum += p10Db[idx];
      p90Sum += p90Db[idx];
      count = 1;
    }

    const median = medianSum / count;
    const p10 = p10Sum / count;
    const p90 = p90Sum / count;
    const tolerance = Math.max((p90 - p10) / 2, 0.8);

    acc[band.id] = {
      target: round(median, 1),
      tolerance: round(tolerance, 1),
      lower: round(p10, 1),
      upper: round(p90, 1)
    };
    return acc;
  }, {});
};

const deriveEnergyDistribution = (curve) => {
  const { medianDb } = curve;

  const bandEnergy = FREQUENCY_BANDS.map((band) => {
    const indices = findIndicesForRange(band.range);
    if (indices.length === 0) {
      const idx = nearestFrequencyIndex((band.range[0] + band.range[1]) / 2);
      const linear = Math.pow(10, medianDb[idx] / 20);
      return linear;
    }
    const linearValues = indices.map(idx => Math.pow(10, medianDb[idx] / 20));
    const averageLinear = linearValues.reduce((sum, val) => sum + val, 0) / linearValues.length;
    return averageLinear;
  });

  const totalEnergy = bandEnergy.reduce((sum, value) => sum + value, 0) || 1;

  return FREQUENCY_BANDS.reduce((acc, band, index) => {
    acc[band.id] = round(bandEnergy[index] / totalEnergy, 3);
    return acc;
  }, {});
};

const GENRE_METADATA = {
  Pop: {
    description: 'Balanced tilt with a bass crest near 100 Hz, vocal presence lift, and a gentle top roll-off.',
    spectralContrast: { mean: { target: 0.38, tolerance: 0.12 }, peaks: { target: 0.54, tolerance: 0.14 }, valleys: { target: 0.25, tolerance: 0.11 } },
    spectralFlux: { target: 0.25, tolerance: 0.09 }
  },
  Electronic: {
    description: 'Lifted sub and air with a slightly scooped midrange; modern, bright EDM curve.',
    spectralContrast: { mean: { target: 0.48, tolerance: 0.15 }, peaks: { target: 0.62, tolerance: 0.18 }, valleys: { target: 0.34, tolerance: 0.15 } },
    spectralFlux: { target: 0.32, tolerance: 0.12 }
  },
  Rock: {
    description: 'Punchy low end, pronounced 2–3 kHz presence, and restrained cymbal air.',
    spectralContrast: { mean: { target: 0.42, tolerance: 0.12 }, peaks: { target: 0.58, tolerance: 0.15 }, valleys: { target: 0.28, tolerance: 0.12 } },
    spectralFlux: { target: 0.28, tolerance: 0.1 }
  },
  'Hip-Hop': {
    description: 'Very strong sub-bass and thump, slightly recessed mids, and smooth top.',
    spectralContrast: { mean: { target: 0.45, tolerance: 0.14 }, peaks: { target: 0.6, tolerance: 0.17 }, valleys: { target: 0.3, tolerance: 0.14 } },
    spectralFlux: { target: 0.3, tolerance: 0.11 }
  },
  Jazz: {
    description: 'Warm low-mid emphasis with smooth, natural high end.',
    spectralContrast: { mean: { target: 0.35, tolerance: 0.1 }, peaks: { target: 0.5, tolerance: 0.12 }, valleys: { target: 0.22, tolerance: 0.1 } },
    spectralFlux: { target: 0.22, tolerance: 0.08 }
  },
  Classical: {
    description: 'Natural orchestral balance: restrained subs, full low-mids, relaxed top.',
    spectralContrast: { mean: { target: 0.32, tolerance: 0.12 }, peaks: { target: 0.48, tolerance: 0.14 }, valleys: { target: 0.2, tolerance: 0.12 } },
    spectralFlux: { target: 0.2, tolerance: 0.08 }
  },
  Folk: {
    description: 'Acoustic-forward: restrained subs, articulate mids, gentle highs.',
    spectralContrast: { mean: { target: 0.34, tolerance: 0.1 }, peaks: { target: 0.5, tolerance: 0.12 }, valleys: { target: 0.22, tolerance: 0.1 } },
    spectralFlux: { target: 0.21, tolerance: 0.08 }
  },
  'Funk/Soul': {
    description: 'Thick low end with smooth mids and darker highs typical of RnB/Soul.',
    spectralContrast: { mean: { target: 0.4, tolerance: 0.12 }, peaks: { target: 0.56, tolerance: 0.15 }, valleys: { target: 0.26, tolerance: 0.11 } },
    spectralFlux: { target: 0.26, tolerance: 0.09 }
  },
  'Bass Heavy': {
    description: 'Extreme low-end emphasis for bass music and dubstep.',
    spectralContrast: { mean: { target: 0.5, tolerance: 0.15 }, peaks: { target: 0.65, tolerance: 0.18 }, valleys: { target: 0.35, tolerance: 0.15 } },
    spectralFlux: { target: 0.35, tolerance: 0.12 }
  },
  Country: {
    description: 'Balanced, natural tone with clear vocals and acoustic instrumentation.',
    spectralContrast: { mean: { target: 0.36, tolerance: 0.11 }, peaks: { target: 0.52, tolerance: 0.13 }, valleys: { target: 0.24, tolerance: 0.11 } },
    spectralFlux: { target: 0.23, tolerance: 0.09 }
  },
  Modern: {
    description: 'Bright, high-definition sound with extended highs and tight lows.',
    spectralContrast: { mean: { target: 0.44, tolerance: 0.13 }, peaks: { target: 0.60, tolerance: 0.16 }, valleys: { target: 0.30, tolerance: 0.13 } },
    spectralFlux: { target: 0.30, tolerance: 0.11 }
  },
  Reggae: {
    description: 'Deep, heavy bass foundation with sharp off-beat accents.',
    spectralContrast: { mean: { target: 0.41, tolerance: 0.13 }, peaks: { target: 0.57, tolerance: 0.15 }, valleys: { target: 0.27, tolerance: 0.12 } },
    spectralFlux: { target: 0.27, tolerance: 0.10 }
  }
};

const GENRE_SPECTRAL_PROFILES = Object.entries(LOADED_TONAL_PROFILES).reduce((acc, [key, rawProfile]) => {
  const metadata = GENRE_METADATA[key] || {
    description: 'Genre target curve.',
    spectralContrast: { mean: { target: 0.4, tolerance: 0.15 }, peaks: { target: 0.55, tolerance: 0.15 }, valleys: { target: 0.25, tolerance: 0.15 } },
    spectralFlux: { target: 0.25, tolerance: 0.1 }
  };

  const { curve, highResCurve } = processProfile(rawProfile);

  acc[key] = {
    id: key,
    description: metadata.description,
    curve,
    highResCurve,
    frequencyTargets: deriveBandTargets(curve),
    spectralContrast: metadata.spectralContrast,
    spectralFlux: metadata.spectralFlux,
    energyDistribution: deriveEnergyDistribution(curve)
  };
  return acc;
}, {});

export { FREQUENCY_BANDS, TARGET_CENTERS_HZ, GENRE_SPECTRAL_PROFILES };
