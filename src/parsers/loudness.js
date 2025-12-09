/**
 * Parse FFmpeg loudnorm JSON output
 * @param {string} jsonOutput - Raw JSON string from FFmpeg loudnorm
 * @returns {Object} Parsed loudness data
 */
export function parseLoudnormJson(jsonOutput) {
  try {
    const data = JSON.parse(jsonOutput);
    return {
      input_i: parseFloat(data.input_i),
      input_lra: parseFloat(data.input_lra),
      input_tp: parseFloat(data.input_tp),
      input_thresh: parseFloat(data.input_thresh),
      target_i: parseFloat(data.target_i),
      target_lra: parseFloat(data.target_lra),
      target_tp: parseFloat(data.target_tp),
      target_thresh: parseFloat(data.target_thresh),
      output_i: parseFloat(data.output_i),
      output_lra: parseFloat(data.output_lra),
      output_tp: parseFloat(data.output_tp),
      output_thresh: parseFloat(data.output_thresh),
      normalization_type: data.normalization_type,
      target_offset: parseFloat(data.target_offset)
    };
  } catch (error) {
    console.error('[Loudness Parser] Failed to parse loudnorm JSON:', error);
    throw new Error(`Failed to parse loudnorm JSON: ${error.message}`);
  }
}

/**
 * Parse FFmpeg ebur128 timeline output
 * @param {string} output - Raw output from FFmpeg ebur128
 * @returns {Array} Timeline data points
 */
export function parseEbur128Timeline(output) {
  const timelineData = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    // Look for lines like: "t: 0.000000 M: -23.0 S: -23.0 I: -23.0 LRA: 0.0"
    const match = line.match(/t:\s*([\d.]+)\s+M:\s*([-\d.]+)\s+S:\s*([-\d.]+)\s+I:\s*([-\d.]+)\s+LRA:\s*([-\d.]+)/);
    if (match) {
      timelineData.push({
        time: parseFloat(match[1]),
        momentary: parseFloat(match[2]),
        short_term: parseFloat(match[3]),
        integrated: parseFloat(match[4]),
        lra: parseFloat(match[5])
      });
    }
  }
  
  return timelineData;
}

/**
 * Calculate loudness statistics from timeline data
 * @param {Array} timelineData - Timeline data from ebur128
 * @returns {Object} Statistics summary
 */
export function calculateLoudnessStats(timelineData) {
  if (!timelineData || timelineData.length === 0) {
    return null;
  }
  
  const momentary = timelineData.map(d => d.momentary).filter(v => !isNaN(v));
  const shortTerm = timelineData.map(d => d.short_term).filter(v => !isNaN(v));
  const lra = timelineData.map(d => d.lra).filter(v => !isNaN(v));
  
  const stats = {
    momentary: {
      min: Math.min(...momentary),
      max: Math.max(...momentary),
      mean: momentary.reduce((a, b) => a + b, 0) / momentary.length,
      std: Math.sqrt(momentary.reduce((sq, n) => sq + Math.pow(n - stats.momentary.mean, 2), 0) / momentary.length)
    },
    short_term: {
      min: Math.min(...shortTerm),
      max: Math.max(...shortTerm),
      mean: shortTerm.reduce((a, b) => a + b, 0) / shortTerm.length,
      std: Math.sqrt(shortTerm.reduce((sq, n) => sq + Math.pow(n - stats.short_term.mean, 2), 0) / shortTerm.length)
    },
    lra: {
      min: Math.min(...lra),
      max: Math.max(...lra),
      mean: lra.reduce((a, b) => a + b, 0) / lra.length
    },
    duration: timelineData.length > 0 ? timelineData[timelineData.length - 1].time : 0
  };
  
  return stats;
}

/**
 * Calculate stem delta (vocals - instrumental LUFS)
 * @param {Object} vocalLoudness - Vocal stem loudness data
 * @param {Object} instrumentalLoudness - Instrumental stem loudness data
 * @returns {Object} Delta analysis
 */
export function calculateStemDelta(vocalLoudness, instrumentalLoudness) {
  if (!vocalLoudness || !instrumentalLoudness) {
    return null;
  }
  
  const delta = {
    lufs_delta: vocalLoudness.input_i - instrumentalLoudness.input_i,
    lra_delta: vocalLoudness.input_lra - instrumentalLoudness.input_lra,
    tp_delta: vocalLoudness.input_tp - instrumentalLoudness.input_tp,
    staging_assessment: null
  };
  
  // Assess gain staging
  if (delta.lufs_delta > 3) {
    delta.staging_assessment = 'vocals_hot';
  } else if (delta.lufs_delta < -3) {
    delta.staging_assessment = 'vocals_soft';
  } else {
    delta.staging_assessment = 'balanced';
  }
  
  return delta;
}
