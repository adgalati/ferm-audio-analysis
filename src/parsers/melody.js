
import { parse } from 'csv-parse/sync';

// Robust CSV parser for melody contours from Melodia or CREPE Vamp plugin
// Accepts rows in any of these shapes: [time, f0, conf?] or [time, f0] or [f0, time]
export function parseMelodiaCsv(csvText) {
  let text = csvText.trim();
  if (!text) return { times: [], f0_hz: [], confidence: [] };
  // Normalize delimiter if needed
  if (text.indexOf(',') === -1 && text.indexOf(';') !== -1) {
    text = text.replace(/;/g, ',');
  }
  
  const rows = parse(text, { relaxColumnCount: true });
  
  const times = [], f0 = [], conf = [];
  const rawData = []; // Store all data for silence detection
  
  // First pass: collect all data
  for (const r of rows) {
    if (!r || r.length < 3) continue;
    
    // Handle CREPE format: [filename, timestamp, frequency, confidence] or [, timestamp, frequency, confidence]
    let timestamp, frequency, confidence;
    
    if (r.length >= 4) {
      // Check if first column is empty (subsequent rows)
      if (r[0] === '' || r[0].trim() === '') {
        timestamp = parseFloat(r[1]);
        frequency = parseFloat(r[2]);
        confidence = parseFloat(r[3]);
      } else {
        // First row with filename
        timestamp = parseFloat(r[1]);
        frequency = parseFloat(r[2]);
        confidence = parseFloat(r[3]);
      }
    } else if (r.length === 3) {
      // Fallback: [timestamp, frequency, confidence]
      timestamp = parseFloat(r[0]);
      frequency = parseFloat(r[1]);
      confidence = parseFloat(r[2]);
    }
    
    if (Number.isNaN(timestamp) || Number.isNaN(frequency) || Number.isNaN(confidence)) {
      continue;
    }
    
    rawData.push({ timestamp, frequency, confidence });
  }
  
  if (rawData.length === 0) {
    return { times: [], f0_hz: [], confidence: [] };
  }
  
  // Detect silence regions and filter out artifacts
  const silenceRegions = detectSilenceRegions(rawData);
  
  // Second pass: filter data based on silence detection and other criteria
  for (const data of rawData) {
    const { timestamp, frequency, confidence } = data;
    
    // Skip if in a detected silence region
    if (isInSilenceRegion(timestamp, silenceRegions)) {
      continue;
    }
    
    // Filter by frequency range (human vocal range) and confidence
    const isVocalRange = frequency >= 80 && frequency <= 800; // 80-800 Hz typical vocal range
    const isHighConfidence = confidence >= 0.8; // High confidence threshold (80%+)
    
    // Additional filtering for artifacts
    const isReasonableFrequency = frequency > 0 && frequency < 2000; // Reasonable upper bound
    const isNotSpike = !isFrequencySpike(data, rawData); // Detect sudden frequency spikes
    
    if (isVocalRange && isHighConfidence && isReasonableFrequency && isNotSpike) {
      times.push(timestamp);
      f0.push(frequency);
      conf.push(confidence);
    }
  }
  
  console.log('[Melody Parser] Filtered melody data:', {
    originalPoints: rawData.length,
    filteredPoints: times.length,
    silenceRegions: silenceRegions.length,
    removedPoints: rawData.length - times.length
  });
  
  return { times, f0_hz: f0, confidence: conf };
}

// Detect silence regions based on low confidence and frequency patterns
function detectSilenceRegions(data) {
  const silenceRegions = [];
  const windowSize = 10; // frames to analyze together
  const minSilenceDuration = 0.5; // minimum silence duration in seconds
  
  for (let i = 0; i < data.length - windowSize; i++) {
    const window = data.slice(i, i + windowSize);
    const avgConfidence = window.reduce((sum, d) => sum + d.confidence, 0) / window.length;
    const avgFrequency = window.reduce((sum, d) => sum + d.frequency, 0) / window.length;
    
    // Detect silence: low confidence AND reasonable frequency range
    const isLowConfidence = avgConfidence < 0.8; // Updated to match main threshold
    const isReasonableRange = avgFrequency >= 50 && avgFrequency <= 1000;
    
    if (isLowConfidence && isReasonableRange) {
      const startTime = window[0].timestamp;
      const endTime = window[window.length - 1].timestamp;
      
      // Extend silence region if it continues
      let regionEnd = endTime;
      for (let j = i + windowSize; j < data.length; j++) {
        const nextConfidence = data[j].confidence;
        const nextFrequency = data[j].frequency;
        
        if (nextConfidence < 0.8 && nextFrequency >= 50 && nextFrequency <= 1000) {
          regionEnd = data[j].timestamp;
        } else {
          break;
        }
      }
      
      // Only add if duration is significant
      if (regionEnd - startTime >= minSilenceDuration) {
        silenceRegions.push({ start: startTime, end: regionEnd });
      }
    }
  }
  
  // Merge overlapping regions
  return mergeOverlappingRegions(silenceRegions);
}

// Check if a timestamp is within any silence region
function isInSilenceRegion(timestamp, silenceRegions) {
  return silenceRegions.some(region => timestamp >= region.start && timestamp <= region.end);
}

// Detect sudden frequency spikes that are likely artifacts
function isFrequencySpike(currentData, allData) {
  const currentIndex = allData.findIndex(d => d.timestamp === currentData.timestamp);
  if (currentIndex < 2 || currentIndex >= allData.length - 2) return false;
  
  const prev = allData[currentIndex - 1];
  const next = allData[currentIndex + 1];
  const current = currentData;
  
  // Check for sudden jumps (> 200 Hz change)
  const prevDiff = Math.abs(current.frequency - prev.frequency);
  const nextDiff = Math.abs(current.frequency - next.frequency);
  
  return prevDiff > 200 || nextDiff > 200;
}

// Merge overlapping silence regions
function mergeOverlappingRegions(regions) {
  if (regions.length === 0) return [];
  
  regions.sort((a, b) => a.start - b.start);
  const merged = [regions[0]];
  
  for (let i = 1; i < regions.length; i++) {
    const current = regions[i];
    const last = merged[merged.length - 1];
    
    if (current.start <= last.end) {
      // Overlapping regions, merge them
      last.end = Math.max(last.end, current.end);
    } else {
      // Non-overlapping, add new region
      merged.push(current);
    }
  }
  
  return merged;
}
