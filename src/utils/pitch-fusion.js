/**
 * Fusion configuration constants
 */
const VOICING_THRESHOLD = 0.6; // Min voiced probability to trust voicing
const OCTAVE_TOLERANCE_CENTS = 100; // ±100 cents around octave multiples
const CREPE_CONFIDENCE_WEIGHT = 1.5; // Increased weight for CREPE confidence
const PYIN_VOICING_WEIGHT = 1.0; // Weight for pYIN voiced probability
const MEDIAN_FILTER_WINDOW_SIZE = 5; // Window size for median filter (odd number recommended)
const SILENCE_GATE_THRESHOLD = 0.3; // Lower threshold for silence detection

/**
 * Convert frequency to cents relative to a base frequency
 * @param {number} freq - Frequency in Hz
 * @param {number} baseFreq - Base frequency in Hz (default 440 Hz / A4)
 * @returns {number} - Cents relative to base
 */
function freqToCents(freq, baseFreq = 440) {
  if (freq <= 0 || baseFreq <= 0) return 0;
  return 1200 * Math.log2(freq / baseFreq);
}

/**
 * Convert cents to frequency relative to a base frequency
 * @param {number} cents - Cents relative to base
 * @param {number} baseFreq - Base frequency in Hz (default 440 Hz / A4)
 * @returns {number} - Frequency in Hz
 */
function centsToFreq(cents, baseFreq = 440) {
  return baseFreq * Math.pow(2, cents / 1200);
}

/**
 * Apply median filter to smooth pitch track and reduce noise
 * @param {number[]} data - Input frequency array
 * @param {number} windowSize - Window size (must be odd)
 * @returns {number[]} - Filtered frequency array
 */
function medianFilter(data, windowSize) {
  if (windowSize % 2 === 0) {
    console.warn('[Pitch Fusion] Median filter window size should be odd. Adjusting to next odd number.');
    windowSize += 1;
  }
  if (windowSize === 1) return [...data]; // No filtering needed

  const halfWindow = Math.floor(windowSize / 2);
  const filteredData = new Array(data.length);

  for (let i = 0; i < data.length; i++) {
    const window = [];
    for (let j = -halfWindow; j <= halfWindow; j++) {
      const idx = i + j;
      if (idx >= 0 && idx < data.length) {
        window.push(data[idx]);
      }
    }
    window.sort((a, b) => a - b);
    filteredData[i] = window[Math.floor(window.length / 2)];
  }
  return filteredData;
}

/**
 * Apply silence gate to set f0 to 0 and confidence to 0 during unvoiced segments
 * @param {number[]} f0Data - Input frequency array
 * @param {number[]} confidenceData - Confidence array
 * @returns {Object} - { f0: number[], confidence: number[] }
 */
function applySilenceGate(f0Data, confidenceData) {
  const gatedF0 = [];
  const gatedConfidence = [];
  
  for (let i = 0; i < f0Data.length; i++) {
    const f0 = f0Data[i];
    const conf = confidenceData[i] || 0;
    
    if (conf >= SILENCE_GATE_THRESHOLD) {
      gatedF0.push(f0);
      gatedConfidence.push(conf);
    } else {
      gatedF0.push(0);
      gatedConfidence.push(0);
    }
  }
  
  return { f0: gatedF0, confidence: gatedConfidence };
}

/**
 * Interpolate pYIN track to CREPE sample times using linear interpolation
 * @param {Object} pyinTrack - pYIN track { times, f0_hz, voicedProb }
 * @param {Array<number>} targetTimes - Target time points (CREPE times)
 * @returns {Object} - Interpolated { f0_hz, voicedProb }
 */
function interpolatePyinToCrepe(pyinTrack, targetTimes) {
  const { times: pyinTimes, f0_hz: pyinF0, voicedProb: pyinVoiced } = pyinTrack;

  if (pyinTimes.length === 0) {
    return {
      f0_hz: Array(targetTimes.length).fill(0),
      voicedProb: Array(targetTimes.length).fill(0)
    };
  }

  const interpF0 = [];
  const interpVoiced = [];

  for (const targetTime of targetTimes) {
    // Find bracketing pYIN samples
    let leftIdx = 0;
    let rightIdx = pyinTimes.length - 1;

    for (let i = 0; i < pyinTimes.length - 1; i++) {
      if (pyinTimes[i] <= targetTime && targetTime <= pyinTimes[i + 1]) {
        leftIdx = i;
        rightIdx = i + 1;
        break;
      }
    }

    // Handle out-of-range times
    if (targetTime < pyinTimes[0]) {
      interpF0.push(pyinF0[0]);
      interpVoiced.push(pyinVoiced[0]);
      continue;
    }
    if (targetTime > pyinTimes[pyinTimes.length - 1]) {
      interpF0.push(pyinF0[pyinTimes.length - 1]);
      interpVoiced.push(pyinVoiced[pyinTimes.length - 1]);
      continue;
    }

    // Linear interpolation
    const leftTime = pyinTimes[leftIdx];
    const rightTime = pyinTimes[rightIdx];
    const alpha = (targetTime - leftTime) / (rightTime - leftTime);

    // Interpolate F0 in log scale (Hz) to handle exponential pitch perception
    const leftF0 = pyinF0[leftIdx];
    const rightF0 = pyinF0[rightIdx];
    let interpedF0;

    if (leftF0 > 0 && rightF0 > 0) {
      // Log interpolation for voiced frames
      interpedF0 = leftF0 * Math.pow(rightF0 / leftF0, alpha);
    } else if (leftF0 > 0) {
      interpedF0 = leftF0;
    } else if (rightF0 > 0) {
      interpedF0 = rightF0;
    } else {
      interpedF0 = 0;
    }

    // Linear interpolation for voicing probability
    const leftVoiced = pyinVoiced[leftIdx];
    const rightVoiced = pyinVoiced[rightIdx];
    const interpedVoiced = leftVoiced + (rightVoiced - leftVoiced) * alpha;

    interpF0.push(interpedF0);
    interpVoiced.push(interpedVoiced);
  }

  return { f0_hz: interpF0, voicedProb: interpVoiced };
}

/**
 * Correct octave errors in CREPE by comparing against pYIN
 * @param {number} crepeF0 - CREPE frequency
 * @param {number} pyinF0 - pYIN frequency
 * @returns {number} - Corrected CREPE frequency (may be halved/doubled)
 */
function correctOctaveError(crepeF0, pyinF0) {
  if (crepeF0 <= 0 || pyinF0 <= 0) {
    return crepeF0;
  }

  const crepeCents = freqToCents(crepeF0);
  const pyinCents = freqToCents(pyinF0);

  // Check for octave multiples (±1200 cents)
  const centDiff = crepeCents - pyinCents;
  const octaveOffset = Math.round(centDiff / 1200);

  // If close to octave boundary, correct
  const modCents = ((centDiff % 1200) + 1200) % 1200;
  if (modCents < OCTAVE_TOLERANCE_CENTS || modCents > 1200 - OCTAVE_TOLERANCE_CENTS) {
    // Octave slip detected, correct it
    const correctedCents = crepeCents - octaveOffset * 1200;
    return centsToFreq(correctedCents);
  }

  return crepeF0;
}

/**
 * Fuse CREPE and pYIN pitch tracks for improved accuracy and stability
 * @param {Object} options - Configuration
 * @param {Object} options.crepe - CREPE melody { times, f0_hz, confidence }
 * @param {Object} options.pyinTrack - pYIN pitch track { times, f0_hz, voicedProb }
 * @param {Array<Object>} options.pyinNotes - pYIN notes [{ start, end, midi, f0_hz, confidence }]
 * @returns {Object} - Fused melody { times, f0_hz, confidence, notes }
 */
export function fusePitchTracks({ crepe, pyinTrack, pyinNotes }) {
  if (!crepe || !crepe.times || crepe.times.length === 0) {
    console.warn('[Pitch Fusion] No CREPE data; cannot fuse');
    return crepe || { times: [], f0_hz: [], confidence: [], notes: [] };
  }

  if (!pyinTrack || !pyinTrack.times || pyinTrack.times.length === 0) {
    console.warn('[Pitch Fusion] No pYIN data; using CREPE only');
    return { ...crepe, notes: pyinNotes || [] };
  }

  // Interpolate pYIN to CREPE time grid
  const interpPyin = interpolatePyinToCrepe(pyinTrack, crepe.times);

  const fusedTimes = [...crepe.times];
  const fusedF0 = [];
  const fusedConfidence = [];

  // Fuse each frame
  for (let i = 0; i < crepe.times.length; i++) {
    const crepeF0 = crepe.f0_hz[i];
    const crepeConf = crepe.confidence[i];

    const pyinF0 = interpPyin.f0_hz[i];
    const pyinVoiced = interpPyin.voicedProb[i];

    // Voicing gate: require either CREPE confidence or pYIN voicing
    const isVoiced = crepeConf >= VOICING_THRESHOLD || pyinVoiced >= VOICING_THRESHOLD;

    if (!isVoiced || (crepeF0 <= 0 && pyinF0 <= 0)) {
      // Unvoiced frame
      fusedF0.push(0);
      fusedConfidence.push(0);
      continue;
    }

    // At least one source says voiced; correct octave errors
    let correctedCrepeF0 = crepeF0;
    if (crepeF0 > 0 && pyinF0 > 0) {
      correctedCrepeF0 = correctOctaveError(crepeF0, pyinF0);
    }

    // Weighted fuse in cents
    let fusedF0Hz;
    if (correctedCrepeF0 > 0 && pyinF0 > 0) {
      // Both tracks present: weighted average in cents
      const crepeCents = freqToCents(correctedCrepeF0);
      const pyinCents = freqToCents(pyinF0);

      const crepeWeight = crepeConf * CREPE_CONFIDENCE_WEIGHT;
      const pyinWeight = pyinVoiced * PYIN_VOICING_WEIGHT;
      const totalWeight = crepeWeight + pyinWeight;

      const fusedCents = (crepeCents * crepeWeight + pyinCents * pyinWeight) / totalWeight;
      fusedF0Hz = centsToFreq(fusedCents);
    } else if (correctedCrepeF0 > 0) {
      // Only CREPE
      fusedF0Hz = correctedCrepeF0;
    } else {
      // Only pYIN
      fusedF0Hz = pyinF0;
    }

    // Fused confidence: weighted average, capped at 1.0
    const fusedConf = Math.min(1.0, (crepeConf + pyinVoiced) / 2);

    fusedF0.push(fusedF0Hz);
    fusedConfidence.push(fusedConf);
  }

  // Apply post-fusion median filter to smooth the track
  const medianFilteredF0 = medianFilter(fusedF0, MEDIAN_FILTER_WINDOW_SIZE);
  
  // Apply silence gate to flatten unvoiced segments
  const gatedResult = applySilenceGate(medianFilteredF0, fusedConfidence);

  console.log('[Pitch Fusion] Fusion complete:', {
    frames: fusedTimes.length,
    voicedFrames: gatedResult.f0.filter(f => f > 0).length,
    silenceFrames: gatedResult.f0.filter(f => f === 0).length,
    avgConfidence: gatedResult.confidence.reduce((a, b) => a + b, 0) / gatedResult.confidence.length,
    octaveCorrections: crepe.f0_hz.filter((f, i) => f > 0 && Math.abs(freqToCents(f) - freqToCents(gatedResult.f0[i])) > 100).length,
    notesIncluded: pyinNotes ? pyinNotes.length : 0,
    medianFilterApplied: true,
    silenceGateApplied: true
  });

  return {
    times: fusedTimes,
    f0_hz: gatedResult.f0,
    confidence: gatedResult.confidence,
    notes: pyinNotes || []
  };
}
