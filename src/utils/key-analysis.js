/**
 * Key detection and note analysis utilities
 * 
 * Provides functions for:
 * - Detecting key from chord analysis
 * - Converting frequencies to note names
 * - Calculating in-key percentages
 */

// Musical note frequencies (A4 = 440Hz reference)
const NOTE_FREQUENCIES = {
  'C': [16.35, 32.70, 65.41, 130.81, 261.63, 523.25, 1046.50, 2093.00],
  'C#': [17.32, 34.65, 69.30, 138.59, 277.18, 554.37, 1108.73, 2217.46],
  'D': [18.35, 36.71, 73.42, 146.83, 293.66, 587.33, 1174.66, 2349.32],
  'D#': [19.45, 38.89, 77.78, 155.56, 311.13, 622.25, 1244.51, 2489.02],
  'E': [20.60, 41.20, 82.41, 164.81, 329.63, 659.25, 1318.51, 2637.02],
  'F': [21.83, 43.65, 87.31, 174.61, 349.23, 698.46, 1396.91, 2793.83],
  'F#': [23.12, 46.25, 92.50, 185.00, 369.99, 739.99, 1479.98, 2959.96],
  'G': [24.50, 49.00, 98.00, 196.00, 392.00, 783.99, 1567.98, 3135.96],
  'G#': [25.96, 51.91, 103.83, 207.65, 415.30, 830.61, 1661.22, 3322.44],
  'A': [27.50, 55.00, 110.00, 220.00, 440.00, 880.00, 1760.00, 3520.00],
  'A#': [29.14, 58.27, 116.54, 233.08, 466.16, 932.33, 1864.66, 3729.31],
  'B': [30.87, 61.74, 123.47, 246.94, 493.88, 987.77, 1975.53, 3951.07]
};

// Major and minor scale patterns (semitones from root)
const SCALE_PATTERNS = {
  major: [0, 2, 4, 5, 7, 9, 11],      // C D E F G A B
  minor: [0, 2, 3, 5, 7, 8, 10]       // C D Eb F G Ab Bb
};

// Note names in chromatic order
const CHROMATIC_NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

/**
 * Convert frequency to note name and octave
 * @param {number} frequency - Frequency in Hz
 * @returns {Object} { note, octave, cents }
 */
export function frequencyToNote(frequency) {
  if (frequency <= 0) return null;
  
  // Find the closest note
  let closestNote = null;
  let closestOctave = 0;
  let minDistance = Infinity;
  
  for (const [noteName, octaves] of Object.entries(NOTE_FREQUENCIES)) {
    for (let octave = 0; octave < octaves.length; octave++) {
      const distance = Math.abs(frequency - octaves[octave]);
      if (distance < minDistance) {
        minDistance = distance;
        closestNote = noteName;
        closestOctave = octave;
      }
    }
  }
  
  if (!closestNote) return null;
  
  // Calculate cents deviation from the target frequency
  const targetFreq = NOTE_FREQUENCIES[closestNote][closestOctave];
  const cents = 1200 * Math.log2(frequency / targetFreq);
  
  return {
    note: closestNote,
    octave: closestOctave,
    cents: Math.round(cents),
    frequency: frequency
  };
}

/**
 * Parse chord symbol to extract root note and quality
 * @param {string} chordSymbol - Chord symbol (e.g., "C", "Dm", "F#maj7")
 * @returns {Object} { root, quality, bass }
 */
export function parseChordSymbol(chordSymbol) {
  if (!chordSymbol || chordSymbol === 'N') return null;
  
  // Remove bass note notation (e.g., "C/E" -> "C")
  const [chordPart] = chordSymbol.split('/');
  
  // Extract root note
  let root = '';
  let i = 0;
  
  // Handle sharp/flat in root
  if (chordPart[i + 1] === '#' || chordPart[i + 1] === 'b') {
    root = chordPart.substring(0, 2);
    i = 2;
  } else {
    root = chordPart[0];
    i = 1;
  }
  
  // Extract quality
  const quality = chordPart.substring(i);
  
  const result = {
    root: root,
    quality: quality || 'maj', // Default to major if no quality specified
    bass: chordSymbol.includes('/') ? chordSymbol.split('/')[1] : null
  };
  
  // console.log('[Key Analysis] Parsed chord:', chordSymbol, '->', result);
  
  return result;
}

/**
 * Get scale notes for a given key
 * @param {string} root - Root note (e.g., "C", "F#")
 * @param {string} mode - "major" or "minor"
 * @returns {Array} Array of note names in the scale
 */
export function getScaleNotes(root, mode) {
  const rootIndex = CHROMATIC_NOTES.indexOf(root);
  if (rootIndex === -1) {
    // console.log('[Key Analysis] Invalid root for scale:', root);
    return [];
  }
  
  const pattern = SCALE_PATTERNS[mode];
  if (!pattern) {
    // console.log('[Key Analysis] Invalid mode for scale:', mode);
    return [];
  }
  
  const scaleNotes = pattern.map(semitone => {
    const noteIndex = (rootIndex + semitone) % 12;
    return CHROMATIC_NOTES[noteIndex];
  });
  
  // Debug: Log scale notes for A minor
  // if (root === 'A' && mode === 'minor') {
  //   console.log('[Key Analysis] A minor scale notes:', scaleNotes);
  // }
  
  return scaleNotes;
}

/**
 * Enhanced key detection algorithm based on Fix-plan.md
 * @param {Array} chords - Array of chord objects with { start, end, label }
 * @returns {Object} { key, mode, confidence, analysis }
 */
export function detectKeyFromChords(chords) {
  if (!chords || chords.length === 0) {
    return { key: null, mode: null, confidence: 0, analysis: null };
  }
  
  // Parse chords and calculate durations
  const chordAnalysis = [];
  let totalDuration = 0;
  
  // console.log('[Key Analysis] Input chords:', chords.length, 'chords');
  
  for (const chord of chords) {
    const parsed = parseChordSymbol(chord.label);
    if (!parsed) {
      // console.log('[Key Analysis] Failed to parse chord:', chord.label);
      continue;
    }
    
    const duration = (chord.end || chord.start + 1) - chord.start;
    totalDuration += duration;
    
    chordAnalysis.push({
      label: chord.label,
      root: parsed.root,
      quality: parsed.quality,
      start: chord.start,
      end: chord.end || chord.start + 1,
      duration: duration
    });
  }
  
  // console.log('[Key Analysis] Parsed chord analysis:', chordAnalysis.length, 'chords, total duration:', totalDuration);
  
  if (chordAnalysis.length === 0) {
    return { key: null, mode: null, confidence: 0, analysis: null };
  }
  
  // Define all candidate keys and modes
  const candidates = [];
  const keys = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const modes = ['major', 'minor'];
  
  for (const key of keys) {
    for (const mode of modes) {
      candidates.push({ key, mode });
    }
  }
  
  // Calculate scores for each candidate
  const candidateScores = candidates.map(candidate => {
    const score = calculateKeyScore(candidate, chordAnalysis, totalDuration);
    return { ...candidate, score };
  });
  
  // Debug: Log all scores to see what's happening
  // console.log('[Key Analysis] All candidate scores:', candidateScores.slice(0, 10).map(c => 
  //   `${c.key} ${c.mode}: ${c.score.toFixed(4)}`
  // ));
  
  // Sort by score and find best candidate
  candidateScores.sort((a, b) => b.score - a.score);
  const bestCandidate = candidateScores[0];
  
  // console.log('[Key Analysis] Best candidate:', bestCandidate);
  
  if (!bestCandidate || bestCandidate.score <= 0) {
    return { key: null, mode: null, confidence: 0, analysis: null };
  }
  
  // Check for close competitors
  const closeCompetitors = candidateScores.filter(c => 
    c.score > bestCandidate.score * 0.9 && c !== bestCandidate
  );
  
  const confidence = Math.min(100, Math.round(bestCandidate.score * 100));
  
  // console.log('[Key Analysis] Enhanced key detection:', {
  //   key: bestCandidate.key,
  //   mode: bestCandidate.mode,
  //   confidence,
  //   score: bestCandidate.score,
  //   totalChords: chordAnalysis.length,
  //   closeCompetitors: closeCompetitors.map(c => `${c.key} ${c.mode} (${c.score.toFixed(3)})`),
  //   analysis: {
  //     pitchClassSimilarity: calculatePitchClassSimilarity(bestCandidate, chordAnalysis, totalDuration),
  //     chordCompatibility: calculateChordCompatibility(bestCandidate, chordAnalysis),
  //     cadenceScore: calculateCadenceScore(bestCandidate, chordAnalysis),
  //     endpointScore: calculateEndpointScore(bestCandidate, chordAnalysis),
  //     conflictPenalty: calculateConflictPenalty(bestCandidate, chordAnalysis)
  //   }
  // });
  
  return {
    key: bestCandidate.key,
    mode: bestCandidate.mode,
    confidence,
    analysis: {
      totalChords: chordAnalysis.length,
      totalDuration,
      score: bestCandidate.score,
      closeCompetitors,
      breakdown: {
        pitchClassSimilarity: calculatePitchClassSimilarity(bestCandidate, chordAnalysis, totalDuration),
        chordCompatibility: calculateChordCompatibility(bestCandidate, chordAnalysis),
        cadenceScore: calculateCadenceScore(bestCandidate, chordAnalysis),
        endpointScore: calculateEndpointScore(bestCandidate, chordAnalysis),
        conflictPenalty: calculateConflictPenalty(bestCandidate, chordAnalysis)
      }
    }
  };
}

/**
 * Calculate total key score using Fix-plan.md formula
 * Total score = α·pitchClassSimilarity + β·chordCompatibility + γ·cadence + δ·endpoints − ε·conflicts
 */
function calculateKeyScore(candidate, chordAnalysis, totalDuration) {
  const weights = { α: 1.0, β: 1.2, γ: 2.0, δ: 0.6, ε: 0.3 }; // Reduced conflict penalty weight
  
  const pitchClassSimilarity = calculatePitchClassSimilarity(candidate, chordAnalysis, totalDuration);
  const chordCompatibility = calculateChordCompatibility(candidate, chordAnalysis);
  const cadenceScore = calculateCadenceScore(candidate, chordAnalysis);
  const endpointScore = calculateEndpointScore(candidate, chordAnalysis);
  const conflictPenalty = calculateConflictPenalty(candidate, chordAnalysis);
  
  const totalScore = 
    weights.α * pitchClassSimilarity +
    weights.β * chordCompatibility +
    weights.γ * cadenceScore +
    weights.δ * endpointScore -
    weights.ε * conflictPenalty;
  
  // Debug logging for the first few candidates
  // if (candidate.key === 'A' && candidate.mode === 'minor') {
  //   console.log('[Key Analysis] A minor score breakdown:', {
  //     pitchClassSimilarity,
  //     chordCompatibility,
  //     cadenceScore,
  //     endpointScore,
  //     conflictPenalty,
  //     totalScore: Math.max(0, totalScore)
  //   });
  // }
  
  return Math.max(0, totalScore);
}

/**
 * 1. Pitch-class coverage score (duration-weighted)
 * Build a 12-bin histogram from all chord tones, weighted by their on-screen duration.
 * For each candidate scale, compute cosine similarity with its scale mask.
 */
function calculatePitchClassSimilarity(candidate, chordAnalysis, totalDuration) {
  // Build pitch class histogram weighted by duration
  const pitchClassHistogram = new Array(12).fill(0);
  
  for (const chord of chordAnalysis) {
    const chordTones = getChordTones(chord.root, chord.quality);
    const weight = chord.duration / totalDuration;
    
    for (const tone of chordTones) {
      const pcIndex = CHROMATIC_NOTES.indexOf(tone.note);
      if (pcIndex !== -1) {
        pitchClassHistogram[pcIndex] += tone.weight * weight;
      }
    }
  }
  
  // Get scale mask for candidate key/mode
  const scaleNotes = getScaleNotes(candidate.key, candidate.mode);
  const scaleMask = new Array(12).fill(0);
  
  for (const note of scaleNotes) {
    const pcIndex = CHROMATIC_NOTES.indexOf(note);
    if (pcIndex !== -1) {
      scaleMask[pcIndex] = 1;
    }
  }
  
  // Calculate cosine similarity
  return cosineSimilarity(pitchClassHistogram, scaleMask);
}

/**
 * 2. Diatonic chord-quality compatibility
 * For each chord, check if its root and quality match the key's diatonic triad/7th on that scale degree.
 */
function calculateChordCompatibility(candidate, chordAnalysis) {
  const diatonicChords = getDiatonicChords(candidate.key, candidate.mode);
  let compatibilityScore = 0;
  let totalWeight = 0;
  
  for (const chord of chordAnalysis) {
    const weight = chord.duration;
    totalWeight += weight;
    
    const chordName = chord.root + (chord.quality === 'maj' ? '' : chord.quality);
    const scaleDegree = getScaleDegree(chord.root, candidate.key, candidate.mode);
    
    if (scaleDegree !== -1) {
      const expectedQuality = diatonicChords[scaleDegree];
      
      // Debug: Log chord compatibility for A minor
      // if (candidate.key === 'A' && candidate.mode === 'minor') {
      //   console.log('[Key Analysis] Chord compatibility check:', {
      //     chord: chordName,
      //     root: chord.root,
      //     quality: chord.quality,
      //     scaleDegree,
      //     expectedQuality,
      //     match: expectedQuality === chord.quality
      //   });
      // }
      
      if (expectedQuality === chord.quality) {
        // Perfect match
        compatibilityScore += weight * 2;
      } else if (isModalBorrowing(chord.quality, expectedQuality)) {
        // Modal/borrowed chord
        compatibilityScore += weight * 0.5;
      } else if (isStrongMismatch(chord.root, candidate.key, candidate.mode)) {
        // Strong out-of-key chord
        compatibilityScore -= weight * 2;
      }
    }
  }
  
  return totalWeight > 0 ? compatibilityScore / totalWeight : 0;
}

/**
 * 3. Cadence / function bonuses
 * Look for dominant→tonic root motions and other cadential patterns.
 */
function calculateCadenceScore(candidate, chordAnalysis) {
  let cadenceScore = 0;
  
  // Look for V→I or V→i patterns
  for (let i = 0; i < chordAnalysis.length - 1; i++) {
    const current = chordAnalysis[i];
    const next = chordAnalysis[i + 1];
    
    // Check for dominant→tonic motion
    if (isDominantChord(current.root, candidate.key) && next.root === candidate.key) {
      const weight = Math.min(current.duration, next.duration);
      
      // Check if dominant is altered (e.g., E7 in A minor)
      if (isAlteredDominant(current, candidate)) {
        cadenceScore += weight * 6; // Big bonus for altered dominant
      } else {
        cadenceScore += weight * 4; // Standard V→I bonus
      }
    }
    
    // Check for other cadential patterns
    if (candidate.mode === 'minor') {
      // iv→V→i in minor
      if (i < chordAnalysis.length - 2) {
        const third = chordAnalysis[i + 2];
        if (isSubdominantChord(current.root, candidate.key) && 
            isDominantChord(next.root, candidate.key) && 
            third.root === candidate.key) {
          cadenceScore += Math.min(current.duration, next.duration, third.duration) * 3;
        }
      }
    } else {
      // ii→V→I in major
      if (i < chordAnalysis.length - 2) {
        const third = chordAnalysis[i + 2];
        if (isSupertonicChord(current.root, candidate.key) && 
            isDominantChord(next.root, candidate.key) && 
            third.root === candidate.key) {
          cadenceScore += Math.min(current.duration, next.duration, third.duration) * 3;
        }
      }
    }
  }
  
  return cadenceScore;
}

/**
 * 4. Endpoint & salience heuristics
 * Bonus if first or last chord equals candidate tonic, and prevalence of tonic triad tones.
 */
function calculateEndpointScore(candidate, chordAnalysis) {
  let endpointScore = 0;
  
  if (chordAnalysis.length === 0) return 0;
  
  // First chord bonus
  const firstChord = chordAnalysis[0];
  if (firstChord.root === candidate.key) {
    endpointScore += 1;
  }
  
  // Last chord bonus
  const lastChord = chordAnalysis[chordAnalysis.length - 1];
  if (lastChord.root === candidate.key) {
    endpointScore += 1;
  }
  
  // Prevalence of tonic triad tones
  const tonicTriadTones = getTonicTriadTones(candidate.key, candidate.mode);
  let tonicToneDuration = 0;
  let totalDuration = 0;
  
  for (const chord of chordAnalysis) {
    const chordTones = getChordTones(chord.root, chord.quality);
    const hasTonicTone = chordTones.some(tone => tonicTriadTones.includes(tone.note));
    
    if (hasTonicTone) {
      tonicToneDuration += chord.duration;
    }
    totalDuration += chord.duration;
  }
  
  if (totalDuration > 0) {
    endpointScore += (tonicToneDuration / totalDuration) * 2;
  }
  
  return endpointScore;
}

/**
 * 5. Out-of-collection penalties
 * Penalize candidates whose scales conflict with observed chords.
 */
function calculateConflictPenalty(candidate, chordAnalysis) {
  let conflictPenalty = 0;
  const scaleNotes = getScaleNotes(candidate.key, candidate.mode);
  
  for (const chord of chordAnalysis) {
    const chordTones = getChordTones(chord.root, chord.quality);
    const conflictingTones = chordTones.filter(tone => !scaleNotes.includes(tone.note));
    
    // Debug: Log conflict analysis for A minor
    // if (candidate.key === 'A' && candidate.mode === 'minor') {
    //   console.log('[Key Analysis] Conflict analysis for', chord.root + chord.quality, ':', {
    //     chordTones: chordTones.map(t => t.note),
    //     scaleNotes,
    //     conflictingTones: conflictingTones.map(t => t.note),
    //     penalty: chord.duration * conflictingTones.length * 0.5
    //   });
    // }
    
    if (conflictingTones.length > 0) {
      // Penalty proportional to chord duration and number of conflicting tones
      conflictPenalty += chord.duration * conflictingTones.length * 0.5;
    }
  }
  
  return conflictPenalty;
}

// Helper functions for the enhanced algorithm

function getChordTones(root, quality) {
  const rootIndex = CHROMATIC_NOTES.indexOf(root);
  if (rootIndex === -1) {
    // console.log('[Key Analysis] Invalid root note:', root);
    return [];
  }
  
  const tones = [{ note: root, weight: 1.0 }]; // Root gets full weight
  
  // Add third
  const q = String(quality || '').toLowerCase();
  // Determine third: minor for true minor/diminished, major otherwise
  const isMinorTriad = (q.startsWith('m') && !q.startsWith('maj')) || q.startsWith('min') || q.startsWith('dim');
  const thirdIndex = (rootIndex + (isMinorTriad ? 3 : 4)) % 12;
  tones.push({ note: CHROMATIC_NOTES[thirdIndex], weight: 0.8 });
  
  // Add fifth
  const fifthIndex = (rootIndex + 7) % 12;
  tones.push({ note: CHROMATIC_NOTES[fifthIndex], weight: 0.6 });
  
  // Add extensions for 7th chords
  if (q.includes('7')) {
    const seventhIndex = (rootIndex + (q.includes('maj7') ? 11 : 10)) % 12;
    tones.push({ note: CHROMATIC_NOTES[seventhIndex], weight: 0.4 });
  }
  
  // Debug: Log chord tones for Am7
  // if (root === 'A' && quality === 'm7') {
  //   console.log('[Key Analysis] Am7 chord tones:', tones);
  // }
  
  return tones;
}

function getDiatonicChords(key, mode) {
  const chords = {
    major: ['maj', 'm', 'm', 'maj', 'maj', 'm', 'dim'],
    minor: ['m', 'dim', 'maj', 'm', 'm', 'maj', 'maj']
  };
  
  const result = chords[mode] || chords.major;
  
  // Debug: Log diatonic chords for A minor
  // if (key === 'A' && mode === 'minor') {
  //   console.log('[Key Analysis] A minor diatonic chords:', result);
  // }
  
  return result;
}

function getScaleDegree(note, key, mode) {
  const scaleNotes = getScaleNotes(key, mode);
  const degree = scaleNotes.indexOf(note);
  
  // Debug: Log scale degree calculation
  // if (note === 'A' && key === 'A') {
  //   console.log('[Key Analysis] Scale degree for A in', key, mode + ':', degree, 'scale notes:', scaleNotes);
  // }
  
  return degree;
}

function isModalBorrowing(actualQuality, expectedQuality) {
  // Check if chord quality represents modal borrowing
  const modalMappings = {
    'maj': ['m', 'dim'],
    'm': ['maj', 'dim'],
    'dim': ['maj', 'm']
  };
  
  return modalMappings[expectedQuality]?.includes(actualQuality) || false;
}

function isStrongMismatch(chordRoot, key, mode) {
  // Check if chord root is strongly out of key (respect mode)
  const scaleNotes = getScaleNotes(key, mode);
  return !scaleNotes.includes(chordRoot);
}

function isDominantChord(chordRoot, key) {
  const dominants = {
    'C': 'G', 'C#': 'G#', 'D': 'A', 'D#': 'A#', 'E': 'B', 'F': 'C',
    'F#': 'C#', 'G': 'D', 'G#': 'D#', 'A': 'E', 'A#': 'F', 'B': 'F#'
  };
  return dominants[key] === chordRoot;
}

function isSubdominantChord(chordRoot, key) {
  const subdominants = {
    'C': 'F', 'C#': 'F#', 'D': 'G', 'D#': 'G#', 'E': 'A', 'F': 'Bb',
    'F#': 'B', 'G': 'C', 'G#': 'C#', 'A': 'D', 'A#': 'D#', 'B': 'E'
  };
  return subdominants[key] === chordRoot;
}

function isSupertonicChord(chordRoot, key) {
  const supertonics = {
    'C': 'D', 'C#': 'D#', 'D': 'E', 'D#': 'F', 'E': 'F#', 'F': 'G',
    'F#': 'G#', 'G': 'A', 'G#': 'A#', 'A': 'B', 'A#': 'C', 'B': 'C#'
  };
  return supertonics[key] === chordRoot;
}

function isAlteredDominant(chord, candidate) {
  // Check if dominant chord has alterations (e.g., E7 in A minor)
  if (!isDominantChord(chord.root, candidate.key)) return false;
  
  // Check for seventh chord quality
  return chord.quality.includes('7') || chord.quality.includes('maj7');
}

function getTonicTriadTones(key, mode) {
  const rootIndex = CHROMATIC_NOTES.indexOf(key);
  const tones = [CHROMATIC_NOTES[rootIndex]]; // Root
  
  if (mode === 'major') {
    tones.push(CHROMATIC_NOTES[(rootIndex + 4) % 12]); // Major third
  } else {
    tones.push(CHROMATIC_NOTES[(rootIndex + 3) % 12]); // Minor third
  }
  
  tones.push(CHROMATIC_NOTES[(rootIndex + 7) % 12]); // Perfect fifth
  
  return tones;
}

function cosineSimilarity(a, b) {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  if (normA === 0 || normB === 0) return 0;
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Calculate in-key percentage for melody
 * @param {Object} melody - Melody data with { times, f0_hz, confidence }
 * @param {string} key - Detected key (e.g., "C", "F#")
 * @param {string} mode - "major" or "minor"
 * @returns {Object} { inKeyPercentage, totalNotes, inKeyNotes, outOfKeyNotes, analysis }
 */
export function calculateInKeyPercentage(melody, key, mode) {
  if (!melody || !melody.f0_hz || melody.f0_hz.length === 0 || !key || !mode) {
    return { inKeyPercentage: null, totalNotes: 0, inKeyNotes: 0, outOfKeyNotes: 0, analysis: null };
  }
  
  const scaleNotes = getScaleNotes(key, mode);
  if (scaleNotes.length === 0) {
    return { inKeyPercentage: null, totalNotes: 0, inKeyNotes: 0, outOfKeyNotes: 0, analysis: null };
  }
  
  // console.log('[Key Analysis] Scale notes for', key, mode, ':', scaleNotes);
  
  let totalNotes = 0;
  let inKeyNotes = 0;
  let outOfKeyNotes = 0;
  const noteAnalysis = [];
  
  for (let i = 0; i < melody.f0_hz.length; i++) {
    const frequency = melody.f0_hz[i];
    if (frequency <= 0) continue; // Skip unvoiced frames
    
    const noteInfo = frequencyToNote(frequency);
    if (!noteInfo) continue;
    
    totalNotes++;
    const isInKey = scaleNotes.includes(noteInfo.note);
    
    if (isInKey) {
      inKeyNotes++;
    } else {
      outOfKeyNotes++;
    }
    
    noteAnalysis.push({
      time: melody.times[i],
      frequency: frequency,
      note: noteInfo.note,
      octave: noteInfo.octave,
      cents: noteInfo.cents,
      isInKey: isInKey,
      confidence: melody.confidence?.[i] || 0
    });
  }
  
  const inKeyPercentage = totalNotes > 0 ? Math.round((inKeyNotes / totalNotes) * 100) : 0;
  
  console.log('[Key Analysis] In-key analysis:', {
    key,
    mode,
    scaleNotes,
    totalNotes,
    inKeyNotes,
    outOfKeyNotes,
    inKeyPercentage,
    sampleNotes: noteAnalysis.slice(0, 10).map(n => ({
      note: n.note,
      octave: n.octave,
      frequency: n.frequency.toFixed(1),
      isInKey: n.isInKey,
      confidence: n.confidence.toFixed(2)
    }))
  });
  
  return {
    inKeyPercentage,
    totalNotes,
    inKeyNotes,
    outOfKeyNotes,
    analysis: noteAnalysis,
    scaleNotes
  };
}

/**
 * Enhanced key fit score calculation
 * @param {Object} melody - Melody data
 * @param {Array} chords - Chord data
 * @returns {Object} { score, key, mode, inKeyPercentage, analysis }
 */
export function calculateEnhancedKeyFitScore(melody, chords) {
  if (!melody || !melody.f0_hz || melody.f0_hz.length === 0) {
    return { score: null, key: null, mode: null, inKeyPercentage: null, analysis: null };
  }
  
  // Detect key from chords
  const keyDetection = detectKeyFromChords(chords);
  if (!keyDetection.key) {
    return { score: null, key: null, mode: null, inKeyPercentage: null, analysis: keyDetection };
  }
  
  // Calculate in-key percentage
  const inKeyAnalysis = calculateInKeyPercentage(melody, keyDetection.key, keyDetection.mode);
  
  // Convert to 0-100 score
  const score = inKeyAnalysis.inKeyPercentage;
  
  return {
    score,
    key: keyDetection.key,
    mode: keyDetection.mode,
    inKeyPercentage: inKeyAnalysis.inKeyPercentage,
    analysis: {
      keyDetection,
      inKeyAnalysis,
      scaleNotes: inKeyAnalysis.scaleNotes
    }
  };
}
