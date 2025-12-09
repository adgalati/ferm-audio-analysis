import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Compute voiced segments from CREPE melody data
 * @param {Object} melody - CREPE melody data with times and confidence arrays
 * @param {number} confidenceThreshold - Minimum confidence for voiced frames (default: 0.5)
 * @param {number} minSegmentDuration - Minimum segment duration in seconds (default: 0.2)
 * @param {number} maxGapDuration - Maximum gap to merge segments in seconds (default: 0.1)
 * @returns {Array} Array of {start, end} segments in seconds
 */
export function computeVoicedSegments(melody, confidenceThreshold = 0.5, minSegmentDuration = 0.2, maxGapDuration = 0.1) {
  if (!melody || !melody.times || !melody.confidence || melody.times.length === 0) {
    return [];
  }

  const { times, confidence } = melody;
  const segments = [];
  let currentStart = null;

  for (let i = 0; i < times.length; i++) {
    const time = times[i];
    const conf = confidence[i];

    if (conf >= confidenceThreshold) {
      // Start of a voiced segment
      if (currentStart === null) {
        currentStart = time;
      }
    } else {
      // End of a voiced segment
      if (currentStart !== null) {
        const duration = time - currentStart;
        if (duration >= minSegmentDuration) {
          segments.push({ start: currentStart, end: time });
        }
        currentStart = null;
      }
    }
  }

  // Handle case where segment extends to end of audio
  if (currentStart !== null) {
    const lastTime = times[times.length - 1];
    const duration = lastTime - currentStart;
    if (duration >= minSegmentDuration) {
      segments.push({ start: currentStart, end: lastTime });
    }
  }

  // Merge segments that are close together
  const mergedSegments = [];
  for (const segment of segments) {
    if (mergedSegments.length === 0) {
      mergedSegments.push(segment);
    } else {
      const lastSegment = mergedSegments[mergedSegments.length - 1];
      const gap = segment.start - lastSegment.end;
      
      if (gap <= maxGapDuration) {
        // Merge segments
        lastSegment.end = segment.end;
      } else {
        // Keep as separate segment
        mergedSegments.push(segment);
      }
    }
  }

  return mergedSegments;
}

/**
 * Generate openSMILE frame list configuration file
 * @param {Array} segments - Array of {start, end} segments in seconds
 * @param {string} outputPath - Path to save the configuration file
 * @returns {Promise<string>} Path to the generated configuration file
 */
export async function generateFrameListConfig(segments, outputPath) {
  if (segments.length === 0) {
    throw new Error('No voiced segments to generate frame list for');
  }

  // Format segments as openSMILE frame list: "start-end,start-end,..."
  const frameList = segments
    .map(seg => `${seg.start.toFixed(1)}s-${seg.end.toFixed(1)}s`)
    .join(',');

  const configContent = `# Generated frame list for openSMILE functionals
frameMode = list
frameList = ${frameList}
frameCenterSpecial = left
`;

  await fs.writeFile(outputPath, configContent, 'utf-8');
  console.log('[Voicing Gating] Generated frame list config:', outputPath);
  console.log('[Voicing Gating] Frame segments:', segments.length, 'total duration:', 
    segments.reduce((sum, seg) => sum + (seg.end - seg.start), 0).toFixed(1), 'seconds');

  return outputPath;
}

/**
 * Create voiced segments and frame list config for openSMILE
 * @param {Object} melody - CREPE melody data
 * @param {string} tmpDir - Temporary directory for output files
 * @param {number} confidenceThreshold - Minimum confidence for voiced frames
 * @returns {Promise<string|null>} Path to frame list config file, or null if no segments
 */
export async function createVoicingGate(melody, tmpDir, confidenceThreshold = 0.5) {
  const segments = computeVoicedSegments(melody, confidenceThreshold);
  
  if (segments.length === 0) {
    console.log('[Voicing Gating] No voiced segments found, skipping gating');
    return null;
  }

  // Ensure tmp directory exists
  await fs.mkdir(tmpDir, { recursive: true });

  // Generate frame list config file
  const configPath = path.join(tmpDir, `smile_frames_${Date.now()}.conf.inc`);
  await generateFrameListConfig(segments, configPath);

  return configPath;
}

