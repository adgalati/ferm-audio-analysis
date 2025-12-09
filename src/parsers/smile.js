/**
 * Parse OpenSMILE eGeMAPS CSV output into structured vocal features
 * 
 * eGeMAPS v02 CSV format:
 * - Row 1: Feature names (headers)
 * - Row 2+: Feature values (usually just one row for functionals)
 * 
 * Key features for vocal analysis:
 * - F0 (pitch): F0semitoneFrom27.5Hz statistics
 * - Loudness: loudness statistics  
 * - Voice quality: jitterLocal, shimmerLocaldB, HNRdBACF
 * - Formants: F1/F2/F3frequency (optional)
 */

export function parseSmileCsv(csvContent) {
  if (!csvContent || csvContent.trim().length === 0) {
    throw new Error('Empty CSV content');
  }

  const lines = csvContent.trim().split(/\r?\n/);
  
  // Check if this is ARFF format (starts with @relation)
  if (lines[0].startsWith('@relation')) {
    return parseSmileArff(csvContent);
  }
  
  // Original CSV parsing
  if (lines.length < 2) {
    throw new Error('CSV must have at least header and one data row');
  }

  // Detect delimiter and parse headers/values
  const delim = lines[0].includes(';') ? ';' : ',';
  const headers = lines[0].split(delim).map(h => h.trim().replace(/^"|"$/g, ''));
  const values = lines[1].split(delim).map(v => v.trim().replace(/^"|"$/g, ''));

  if (headers.length !== values.length) {
    throw new Error(`Header count (${headers.length}) doesn't match value count (${values.length})`);
  }

  // Create feature map
  const features = {};
  for (let i = 0; i < headers.length; i++) {
    const header = headers[i];
    const value = parseFloat(values[i]);
    
    if (!Number.isNaN(value)) {
      features[header] = value;
    }
  }

  // Extract and categorize vocal features
  const vocalFeatures = {
    pitch: extractPitchFeatures(features),
    dynamics: extractDynamicsFeatures(features),
    quality: extractQualityFeatures(features),
    formants: extractFormantFeatures(features)
  };

  // Log which features were found for debugging
  console.log('[SMILE Parser] Found features:', {
    total: Object.keys(features).length,
    pitch: Object.keys(vocalFeatures.pitch).length,
    dynamics: Object.keys(vocalFeatures.dynamics).length,
    quality: Object.keys(vocalFeatures.quality).length,
    formants: Object.keys(vocalFeatures.formants).length,
    sample_headers: Object.keys(features).slice(0, 5)
  });

  // Debug loudness features specifically
  const loudnessKeys = Object.keys(features).filter(k => k.toLowerCase().includes('loudness'));
  console.log('[SMILE Parser] Loudness-related features:', loudnessKeys);
  
  // Debug percentile/range features
  const rangeKeys = Object.keys(features).filter(k => k.includes('pctl') || k.includes('range') || k.includes('percentile'));
  console.log('[SMILE Parser] Percentile/range features:', rangeKeys);

  return {
    raw: features,
    vocal: vocalFeatures,
    timestamp: Date.now()
  };
}

// Helper function to pick the first available feature from a list of possible names
function pick(features, ...keys) {
  for (const k of keys) {
    if (features[k] !== undefined) return features[k];
  }
  return undefined;
}

function extractPitchFeatures(features) {
  const pitch = {};
  
  // F0 statistics (in semitones from 27.5Hz) - GeMAPSv01a/v01b format
  pitch.mean_st = pick(features, 'F0semitoneFrom27.5Hz_sma3nz_amean');
  if (typeof pitch.mean_st === 'number') {
    pitch.mean_hz = semitonesToHz(pitch.mean_st);
  }

  // In eGeMAPS, stddevNorm is a normalized dispersion measure; we treat it as CV
  pitch.stddev_st = pick(features, 'F0semitoneFrom27.5Hz_sma3nz_stddevNorm');
  if (typeof pitch.stddev_st === 'number') {
    pitch.coefficient_of_variation = pitch.stddev_st;
  }

  // Prefer precomputed range if present
  pitch.range_st = pick(features, 'F0semitoneFrom27.5Hz_sma3nz_range');

  // Optional percentiles if present
  const f0p2 = pick(features, 
    'F0semitoneFrom27.5Hz_sma3nz_percentile2.0',
    'F0semitoneFrom27.5Hz_sma3nz_pctl2.0'
  );
  const f0p98 = pick(features,
    'F0semitoneFrom27.5Hz_sma3nz_percentile98.0',
    'F0semitoneFrom27.5Hz_sma3nz_pctl98.0'
  );
  
  if (typeof f0p2 === 'number') pitch.pctl_02 = f0p2;
  if (typeof f0p98 === 'number') pitch.pctl_98 = f0p98;

  // Convenience range from percentiles if base range missing
  if (pitch.range_st === undefined && typeof f0p2 === 'number' && typeof f0p98 === 'number') {
    pitch.range_st = f0p98 - f0p2;
  }
  
  return pitch;
}

function extractDynamicsFeatures(features) {
  const dynamics = {};
  
  // Loudness statistics - GeMAPSv01a/v01b format
  dynamics.mean_db = pick(
    features,
    'loudness_sma3_amean',
    'pcm_loudness_sma3_amean',
    'pcm_loudness_amean'
  );
  dynamics.stddev_db = pick(
    features,
    'loudness_sma3_stddevNorm',
    'pcm_loudness_sma3_stddevNorm',
    'pcm_loudness_stddevNorm'
  );

  // Prefer a precomputed percentile range if present
  const pctlRange = pick(
    features,
    'loudness_sma3_pctlrange99-1',
    'loudness_sma3_pctlrange98-2',
    'loudness_sma3_pctlrange0-2',  // ARFF format
    'pcm_loudness_sma3_pctlrange99-1',
    'pcm_loudness_sma3_pctlrange98-2',
    'pcm_loudness_pctlrange99-1',
    'pcm_loudness_pctlrange98-2'
  );

  // Otherwise compute from percentiles (names vary slightly by config/version)
  // ARFF format uses percentile20.0, percentile50.0, percentile80.0 instead of 2.0/98.0
  const p2 = pick(
    features,
    'loudness_sma3_percentile2.0',
    'loudness_sma3_percentile20.0',  // ARFF format
    'loudness_sma3_pctl2.0',
    'pcm_loudness_sma3_percentile2.0',
    'pcm_loudness_sma3_pctl2.0',
    'pcm_loudness_percentile2.0',
    'pcm_loudness_pctl2.0'
  );
  const p98 = pick(
    features,
    'loudness_sma3_percentile98.0',
    'loudness_sma3_percentile80.0',  // ARFF format - use 80th percentile as upper bound
    'loudness_sma3_pctl98.0',
    'pcm_loudness_sma3_percentile98.0',
    'pcm_loudness_sma3_pctl98.0',
    'pcm_loudness_percentile98.0',
    'pcm_loudness_pctl98.0'
  );

  console.log('[SMILE Parser] Dynamics extraction debug:', {
    mean_db: dynamics.mean_db,
    stddev_db: dynamics.stddev_db,
    pctlRange,
    p2,
    p98,
    available_features: Object.keys(features).filter(k => k.includes('loudness'))
  });

  // Debug: log all loudness-related features found
  const loudnessFeatures = Object.keys(features).filter(k => 
    k.toLowerCase().includes('loudness') || 
    k.toLowerCase().includes('pcm_loudness') ||
    k.includes('pctl') || 
    k.includes('range') || 
    k.includes('percentile')
  );
  console.log('[SMILE Parser] All loudness/range features found:', loudnessFeatures);

  if (typeof pctlRange === 'number') {
    dynamics.range_db = pctlRange;
    console.log('[SMILE Parser] Using precomputed range:', pctlRange);
  } else if (typeof p2 === 'number' && typeof p98 === 'number') {
    dynamics.range_db = p98 - p2;
    console.log('[SMILE Parser] Computed range from percentiles:', p98 - p2);
  } else {
    console.log('[SMILE Parser] No range data found - Dynamic Control will be N/A');
  }
  
  return dynamics;
}

function extractQualityFeatures(features) {
  const quality = {};
  
  // Jitter (local) - GeMAPSv01a format
  if (features['jitterLocal_sma3nz_amean'] !== undefined) {
    quality.jitter_local = features['jitterLocal_sma3nz_amean'];
  }
  
  if (features['jitterLocal_sma3nz_stddevNorm'] !== undefined) {
    quality.jitter_stddev = features['jitterLocal_sma3nz_stddevNorm'];
  }
  
  // Shimmer (local, dB) - GeMAPSv01a format
  if (features['shimmerLocaldB_sma3nz_amean'] !== undefined) {
    quality.shimmer_local_db = features['shimmerLocaldB_sma3nz_amean'];
  }
  
  if (features['shimmerLocaldB_sma3nz_stddevNorm'] !== undefined) {
    quality.shimmer_stddev = features['shimmerLocaldB_sma3nz_stddevNorm'];
  }
  
  // HNR (Harmonic-to-Noise Ratio) - GeMAPSv01a format
  if (features['HNRdBACF_sma3nz_amean'] !== undefined) {
    quality.hnr_db = features['HNRdBACF_sma3nz_amean'];
  }
  
  if (features['HNRdBACF_sma3nz_stddevNorm'] !== undefined) {
    quality.hnr_stddev = features['HNRdBACF_sma3nz_stddevNorm'];
  }
  
  return quality;
}

function extractFormantFeatures(features) {
  const formants = {};
  
  // F1 frequency - GeMAPSv01a format
  if (features['F1frequency_sma3nz_amean'] !== undefined) {
    formants.f1_mean_hz = features['F1frequency_sma3nz_amean'];
  }
  
  if (features['F1frequency_sma3nz_stddevNorm'] !== undefined) {
    formants.f1_stddev = features['F1frequency_sma3nz_stddevNorm'];
  }
  
  // F2 frequency - GeMAPSv01a format
  if (features['F2frequency_sma3nz_amean'] !== undefined) {
    formants.f2_mean_hz = features['F2frequency_sma3nz_amean'];
  }
  
  if (features['F2frequency_sma3nz_stddevNorm'] !== undefined) {
    formants.f2_stddev = features['F2frequency_sma3nz_stddevNorm'];
  }
  
  // F3 frequency - GeMAPSv01a format
  if (features['F3frequency_sma3nz_amean'] !== undefined) {
    formants.f3_mean_hz = features['F3frequency_sma3nz_amean'];
  }
  
  if (features['F3frequency_sma3nz_stddevNorm'] !== undefined) {
    formants.f3_stddev = features['F3frequency_sma3nz_stddevNorm'];
  }
  
  return formants;
}

function parseSmileArff(arffContent) {
  const lines = arffContent.trim().split(/\r?\n/);
  
  // Find @data section
  let dataStartIndex = -1;
  const attributes = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line.startsWith('@attribute')) {
      // Extract attribute name (skip @attribute and type)
      const parts = line.split(/\s+/);
      if (parts.length >= 2) {
        attributes.push(parts[1]);
      }
    } else if (line === '@data') {
      dataStartIndex = i + 1;
      break;
    }
  }
  
  if (dataStartIndex === -1 || dataStartIndex >= lines.length) {
    throw new Error('No @data section found in ARFF file');
  }
  
  // Parse data line (should be the first non-empty line after @data)
  let dataLine = '';
  for (let i = dataStartIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line && !line.startsWith('@')) {
      dataLine = line;
      break;
    }
  }
  
  if (!dataLine) {
    throw new Error('No data found after @data section');
  }
  
  // Handle ARFF format where data might be on a single line
  const values = dataLine.split(',').map(v => v.trim());
  
  // Allow for missing values in ARFF format
  if (values.length < attributes.length) {
    throw new Error(`Too few values: expected at least ${attributes.length}, got ${values.length}`);
  }
  
  // Create feature map
  const features = {};
  for (let i = 0; i < attributes.length && i < values.length; i++) {
    const attribute = attributes[i];
    const valueStr = values[i];
    
    // Skip missing values (represented as '?')
    if (valueStr === '?' || valueStr === '') {
      continue;
    }
    
    const value = parseFloat(valueStr);
    if (!Number.isNaN(value)) {
      features[attribute] = value;
    }
  }
  
  // Extract and categorize vocal features
  const vocalFeatures = {
    pitch: extractPitchFeatures(features),
    dynamics: extractDynamicsFeatures(features),
    quality: extractQualityFeatures(features),
    formants: extractFormantFeatures(features)
  };

  return {
    raw: features,
    vocal: vocalFeatures,
    timestamp: Date.now()
  };
}

function semitonesToHz(semitones) {
  // Convert semitones from 27.5Hz to Hz
  return 27.5 * Math.pow(2, semitones / 12);
}
