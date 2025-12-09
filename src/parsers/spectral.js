/**
 * Parse spectral analysis data from BBC Vamp plugins
 * Handles spectral contrast, flux, and energy features
 */

import { parse } from 'csv-parse/sync';

/**
 * Parse BBC spectral contrast CSV output
 * Format: [timestamp, spectral_contrast_value]
 * @param {string} csvText - CSV output from BBC spectral contrast plugin
 * @returns {Object} Parsed spectral contrast data
 */
export function parseSpectralContrastCsv(csvText) {
  return parseSpectralCsv(csvText, 'spectral_contrast');
}

/**
 * Parse BBC spectral flux CSV output
 * Format: [timestamp, spectral_flux_value]
 * @param {string} csvText - CSV output from BBC spectral flux plugin
 * @returns {Object} Parsed spectral flux data
 */
export function parseSpectralFluxCsv(csvText) {
  return parseSpectralCsv(csvText, 'spectral_flux');
}

/**
 * Parse BBC energy CSV output
 * Format: [timestamp, rms_energy_value]
 * @param {string} csvText - CSV output from BBC energy plugin
 * @returns {Object} Parsed energy data
 */
export function parseEnergyCsv(csvText) {
  return parseSpectralCsv(csvText, 'rms_energy');
}

/**
 * Generic spectral CSV parser
 * @param {string} csvText - CSV text from Vamp plugin
 * @param {string} featureName - Name of the feature for logging
 * @returns {Object} Parsed data with times and values arrays
 */
function parseSpectralCsv(csvText, featureName = 'spectral') {
  let text = csvText.trim();
  if (!text) {
    console.log(`[${featureName} Parser] Empty CSV input`);
    return { times: [], values: [], bandValues: [], bandAverages: [] };
  }

  if (text.indexOf(',') === -1 && text.indexOf(';') !== -1) {
    text = text.replace(/;/g, ',');
  }

  const rows = parse(text, { relaxColumnCount: true });
  const times = [];
  const values = [];
  const bandValues = [];

  for (const row of rows) {
    if (!row || row.length < 2) continue;

    let timestamp = null;
    const numericColumns = [];

    for (let col = 0; col < row.length; col++) {
      const value = parseFloat(row[col]);
      if (Number.isNaN(value)) {
        continue;
      }

      if (timestamp === null) {
        timestamp = value;
        continue;
      }

      if (Math.abs(value) > 1000) {
        console.log(`[${featureName} Parser] Filtering outlier value: ${value} at time ${timestamp}`);
        continue;
      }

      const bandIndex = numericColumns.length;
      numericColumns.push(value);
      if (!bandValues[bandIndex]) {
        bandValues[bandIndex] = [];
      }
      bandValues[bandIndex].push(value);
    }

    if (timestamp === null || numericColumns.length === 0) {
      continue;
    }

    const rowAverage = numericColumns.reduce((sum, val) => sum + val, 0) / numericColumns.length;
    times.push(timestamp);
    values.push(rowAverage);
  }

  const bandAverages = bandValues.map(avgArray => (
    avgArray.length > 0
      ? avgArray.reduce((sum, val) => sum + val, 0) / avgArray.length
      : 0
  ));

  console.log(`[${featureName} Parser] Parsed ${times.length} frames across ${bandValues.length || 1} band(s)`);

  return { times, values, bandValues, bandAverages };
}

/**
 * Compute spectral snapshot averages for tonal balance
 * @param {Object} contrastData - Spectral contrast data
 * @param {Object} fluxData - Spectral flux data
 * @param {Object} energyData - RMS energy data
 * @returns {Object} Averaged spectral features
 */
export function computeSpectralSnapshot(contrastData, fluxData, energyData) {
  const result = {};

  // Compute averages
  if (contrastData?.values?.length > 0) {
    result.avg_contrast = average(contrastData.values);
    result.contrast_std = standardDeviation(contrastData.values);
  }

  if (contrastData?.bandAverages?.length > 0) {
    result.bandAverages = contrastData.bandAverages;
    result.bandStdDev = contrastData.bandValues?.map(arr => standardDeviation(arr));
  }

  if (fluxData?.values?.length > 0) {
    result.avg_flux = average(fluxData.values);
    result.flux_std = standardDeviation(fluxData.values);
  }

  if (energyData?.values?.length > 0) {
    result.avg_energy = average(energyData.values);
    result.energy_std = standardDeviation(energyData.values);
  }

  // Compute tonal balance metrics
  result.tonal_balance = computeTonalBalance(result);

  console.log('[Spectral Parser] Computed spectral snapshot:', result);

  return result;
}

/**
 * Compute tonal balance from spectral features
 * @param {Object} spectralFeatures - Averaged spectral features
 * @returns {Object} Tonal balance metrics
 */
function computeTonalBalance(spectralFeatures) {
  const balance = {
    brightness: 0, // High frequency content (contrast + flux)
    warmth: 0,     // Mid frequency balance
    bass_content: 0, // Low frequency content (energy)
    spectral_density: 0 // Overall spectral richness
  };

  // Brightness: combination of spectral contrast and flux (high frequency activity)
  if (spectralFeatures.avg_contrast !== undefined && spectralFeatures.avg_flux !== undefined) {
    balance.brightness = (spectralFeatures.avg_contrast * 0.6) + (spectralFeatures.avg_flux * 0.4);
  }

  // Warmth: balance between contrast and energy (mid-range presence)
  if (spectralFeatures.avg_contrast !== undefined && spectralFeatures.avg_energy !== undefined) {
    balance.warmth = Math.abs(spectralFeatures.avg_contrast - spectralFeatures.avg_energy);
  }

  // Bass content: primarily from RMS energy levels
  if (spectralFeatures.avg_energy !== undefined) {
    balance.bass_content = spectralFeatures.avg_energy;
  }

  // Spectral density: overall spectral activity
  const features = [spectralFeatures.avg_contrast, spectralFeatures.avg_flux, spectralFeatures.avg_energy]
    .filter(v => v !== undefined);

  if (features.length > 0) {
    balance.spectral_density = average(features);
  }

  return balance;
}

/**
 * Calculate average of array
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Average value
 */
function average(arr) {
  if (!arr || arr.length === 0) return 0;
  return arr.reduce((sum, val) => sum + val, 0) / arr.length;
}

/**
 * Calculate standard deviation of array
 * @param {Array<number>} arr - Array of numbers
 * @returns {number} Standard deviation
 */
function standardDeviation(arr) {
  if (!arr || arr.length === 0) return 0;
  const avg = average(arr);
  const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

