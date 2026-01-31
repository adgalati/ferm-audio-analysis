/**
 * Qualitative Labels for Audio Analysis
 * 
 * Comprehensive labeling system designed for LLM interpretation
 * to provide mixing advice context. Each metric includes thresholds
 * and descriptive labels that help an LLM understand the musical
 * and technical implications.
 */

/**
 * Label definitions with thresholds and mixing context
 */
export const LABELS = {
    // ============================================
    // TEMPO / RHYTHM LABELS
    // ============================================
    tempo: {
        thresholds: [
            { max: 60, label: 'Very Slow', context: 'Ballad/ambient territory. Leave space in the mix, use longer reverbs.' },
            { max: 90, label: 'Slow', context: 'R&B/soul pacing. Focus on groove pocket, emphasize low-end warmth.' },
            { max: 110, label: 'Moderate', context: 'Pop/funk tempo. Balance between energy and clarity.' },
            { max: 130, label: 'Upbeat', context: 'Dance/rock energy. Tighten transients, consider sidechain compression.' },
            { max: 150, label: 'Fast', context: 'EDM/punk territory. Prioritize punch and clarity over sustain.' },
            { max: Infinity, label: 'Very Fast', context: 'Drum & bass/speed metal. Extreme transient control needed.' }
        ],
        unit: 'BPM'
    },

    timingTightness: {
        thresholds: [
            { max: 8, label: 'Very Tight', context: 'Highly quantized/programmed feel. May benefit from subtle humanization.' },
            { max: 15, label: 'Tight', context: 'Professional performance. Good pocket, minimal timing issues.' },
            { max: 25, label: 'Loose', context: 'Natural/human feel. Consider if intentional groove or needs tightening.' },
            { max: 40, label: 'Very Loose', context: 'Significant timing drift. May need manual editing or time-stretching.' },
            { max: Infinity, label: 'Unstable', context: 'Severe timing issues. Major editing or re-recording may be needed.' }
        ],
        unit: 'ms MATE (Mean Absolute Timing Error)'
    },

    timingBias: {
        thresholds: [
            { max: -15, label: 'Rushing', context: 'Consistently ahead of the beat. Creates urgency but may feel anxious.' },
            { max: -5, label: 'Slightly Ahead', context: 'Pushing the beat. Adds energy in uptempo tracks.' },
            { max: 5, label: 'On the Beat', context: 'Neutral timing. Clean and professional feel.' },
            { max: 15, label: 'Slightly Behind', context: 'Laying back on the beat. Creates relaxed, groovy feel.' },
            { max: Infinity, label: 'Dragging', context: 'Consistently behind the beat. May feel sluggish or intentionally lazy.' }
        ],
        unit: 'ms bias'
    },

    // ============================================
    // LOUDNESS LABELS
    // ============================================
    loudnessLufs: {
        thresholds: [
            { max: -20, label: 'Very Quiet', context: 'Significant headroom. May need gain staging review or intentional dynamic range.' },
            { max: -14, label: 'Quiet', context: 'Conservative level. Good for classical/jazz, may be quiet for streaming.' },
            { max: -11, label: 'Moderate', context: 'Balanced level. Suitable for most streaming platforms.' },
            { max: -8, label: 'Loud', context: 'Competitive loudness. Watch for dynamic range compression.' },
            { max: -5, label: 'Very Loud', context: 'Aggressive loudness. Risk of distortion and listener fatigue.' },
            { max: Infinity, label: 'Extremely Loud', context: 'Critically loud. Likely over-compressed, may cause clipping on playback.' }
        ],
        unit: 'LUFS (integrated)'
    },

    dynamicRange: {
        thresholds: [
            { max: 4, label: 'Low Dynamic Range', context: 'Heavily compressed. "Wall of sound" effect, may lack punch.' },
            { max: 8, label: 'Moderate Dynamic Range', context: 'Modern pop/EDM standard. Balanced energy and impact.' },
            { max: 12, label: 'Good Dynamic Range', context: 'Breathing room in the mix. Good transient preservation.' },
            { max: 18, label: 'High Dynamic Range', context: 'Cinematic/classical dynamics. Requires attentive listening environment.' },
            { max: Infinity, label: 'Very High Dynamic Range', context: 'Extreme dynamics. May need parallel compression for playback consistency.' }
        ],
        unit: 'LU (Loudness Range)'
    },

    truePeak: {
        thresholds: [
            { max: -3, label: 'Safe', context: 'Well below clipping. Room for encoding headroom.' },
            { max: -1, label: 'Acceptable', context: 'Standard mastering level. Safe for most codecs.' },
            { max: -0.3, label: 'Borderline', context: 'Near maximum. May clip in lossy encoding.' },
            { max: 0, label: 'At Limit', context: 'Hitting 0 dBFS. Risk of inter-sample peaks in conversion.' },
            { max: Infinity, label: 'Clipping', context: 'Over 0 dB true peak. Definite distortion artifacts.' }
        ],
        unit: 'dB TP'
    },

    gainStaging: {
        thresholds: [
            { max: -10, label: 'Vocals Much Quieter', context: 'Vocals buried. Consider vocal ride or compression.' },
            { max: -6, label: 'Vocals Quieter', context: 'Instrumental-forward mix. May be intentional for certain genres.' },
            { max: -2, label: 'Balanced', context: 'Good vocal-instrumental balance. Standard pop/rock staging.' },
            { max: 2, label: 'Vocals Forward', context: 'Vocal-centric mix. Common for intimate vocal styles.' },
            { max: 6, label: 'Vocals Much Louder', context: 'Vocals very prominent. Check if over-compressed or too upfront.' },
            { max: Infinity, label: 'Vocals Dominant', context: 'Extreme vocal focus. Instrumental may feel disconnected.' }
        ],
        unit: 'dB (vocal-instrumental delta)'
    },

    // ============================================
    // SPECTRAL BALANCE LABELS
    // ============================================
    spectralBalance: {
        thresholds: [
            { max: 30, label: 'Very Unbalanced', context: 'Major EQ issues. Needs significant corrective work.' },
            { max: 50, label: 'Unbalanced', context: 'Noticeable tonal imbalance. Target EQ adjustments recommended.' },
            { max: 70, label: 'Balanced', context: 'Acceptable tonal distribution. Minor tweaks may help.' },
            { max: 85, label: 'Well-Balanced', context: 'Good frequency distribution. Matches genre expectations.' },
            { max: Infinity, label: 'Excellent', context: 'Professional-grade spectral balance. Reference quality.' }
        ],
        unit: 'genre fit score (0-100)'
    },

    tonalBrightness: {
        thresholds: [
            { max: 0.3, label: 'Dark', context: 'Subdued highs. May sound muffled or warm depending on genre.' },
            { max: 0.45, label: 'Slightly Dark', context: 'Rolled-off highs. Common for vintage or warm aesthetics.' },
            { max: 0.55, label: 'Neutral', context: 'Balanced high-end. Natural and versatile.' },
            { max: 0.7, label: 'Slightly Bright', context: 'Enhanced presence. Good for clarity and detail.' },
            { max: Infinity, label: 'Bright', context: 'Emphasized highs. May be harsh or crisp depending on execution.' }
        ],
        unit: 'brightness ratio'
    },

    tonalWarmth: {
        thresholds: [
            { max: 0.3, label: 'Thin', context: 'Lacking low-mid warmth. May sound cold or anemic.' },
            { max: 0.45, label: 'Lean', context: 'Reduced warmth. Clean but potentially lacking body.' },
            { max: 0.55, label: 'Balanced', context: 'Good low-mid presence. Natural and full.' },
            { max: 0.7, label: 'Warm', context: 'Enhanced low-mids. Cozy, analog-like character.' },
            { max: Infinity, label: 'Very Warm', context: 'Emphasized warmth. May be muddy if excessive.' }
        ],
        unit: 'warmth ratio'
    },

    // ============================================
    // SPATIAL / STEREO LABELS
    // ============================================
    stereoWidth: {
        thresholds: [
            { max: 20, label: 'Mono/Very Narrow', context: 'Minimal stereo spread. May be intentional for mono compatibility or vintage style.' },
            { max: 40, label: 'Narrow', context: 'Conservative stereo. Good for focused, centered sound.' },
            { max: 60, label: 'Standard Stereo', context: 'Normal stereo field. Industry standard width.' },
            { max: 80, label: 'Wide', context: 'Enhanced stereo image. Immersive but check mono compatibility.' },
            { max: Infinity, label: 'Super Wide', context: 'Very wide stereo. May have phase issues in mono playback.' }
        ],
        unit: 'width score (0-100)'
    },

    phaseCorrelation: {
        thresholds: [
            { max: -0.5, label: 'Severe Phase Issues', context: 'Strong phase cancellation. Will collapse badly in mono.' },
            { max: 0, label: 'Phase Problems', context: 'Negative correlation. Noticeable mono issues.' },
            { max: 0.5, label: 'Moderate Phase', context: 'Some stereo tricks but mono-safe. Monitor carefully.' },
            { max: 0.8, label: 'Good Phase', context: 'Strong mono compatibility. Natural stereo image.' },
            { max: Infinity, label: 'Excellent Phase', context: 'Near-perfect correlation. Mono-safe and phase-coherent.' }
        ],
        unit: 'correlation coefficient (-1 to +1)'
    },

    // ============================================
    // KEY / HARMONY LABELS
    // ============================================
    keyMode: {
        thresholds: [
            { max: 0, label: 'Minor Key', context: 'Darker, more emotional tonality. Common in R&B, blues, some rock.' },
            { max: Infinity, label: 'Major Key', context: 'Brighter, more uplifting tonality. Common in pop, country, upbeat music.' }
        ],
        unit: 'mode (0=minor, 1=major)'
    },

    inKeyPercentage: {
        thresholds: [
            { max: 50, label: 'Many Out-of-Key Notes', context: 'Significant chromatic content or possible tuning issues.' },
            { max: 70, label: 'Some Chromatic Notes', context: 'Intentional chromaticism or blue notes common in jazz/blues.' },
            { max: 85, label: 'Mostly Diatonic', context: 'Standard pop/rock harmony. Occasional passing tones.' },
            { max: 95, label: 'Very Diatonic', context: 'Strong adherence to key. Clear tonal center.' },
            { max: Infinity, label: 'Fully Diatonic', context: 'No chromatic departures. Simple, clear harmony.' }
        ],
        unit: '% notes in detected key'
    },

    // ============================================
    // GENRE / STYLE LABELS
    // ============================================
    genreConfidence: {
        thresholds: [
            { max: 0.3, label: 'Low Confidence', context: 'Genre classification uncertain. May be genre-bending or eclectic.' },
            { max: 0.5, label: 'Moderate Confidence', context: 'Some genre characteristics present. May blend multiple influences.' },
            { max: 0.7, label: 'Good Confidence', context: 'Clear genre identity. References established style conventions.' },
            { max: 0.85, label: 'High Confidence', context: 'Strong genre match. Follows genre production conventions closely.' },
            { max: Infinity, label: 'Very High Confidence', context: 'Definitive genre classification. Archetypal sound for the genre.' }
        ],
        unit: 'probability (0-1)'
    },

    // ============================================
    // TIMBRE / VOCAL LABELS
    // ============================================
    pitchStability: {
        thresholds: [
            { max: 30, label: 'Unstable Pitch', context: 'Significant pitch variation. May need tuning or is intentionally raw.' },
            { max: 50, label: 'Variable Pitch', context: 'Noticeable pitch movement. Expressive but may need correction.' },
            { max: 70, label: 'Moderate Stability', context: 'Acceptable pitch control. Natural human variation.' },
            { max: 85, label: 'Good Pitch', context: 'Solid pitch accuracy. Professional vocal performance.' },
            { max: Infinity, label: 'Excellent Pitch', context: 'Very stable pitch. May be pitch-corrected or highly skilled.' }
        ],
        unit: 'stability score (0-100)'
    },

    dynamicControl: {
        thresholds: [
            { max: 30, label: 'Poor Control', context: 'Wide dynamic swings. Significant compression/automation needed.' },
            { max: 50, label: 'Variable Dynamics', context: 'Noticeable volume inconsistency. Vocal riding recommended.' },
            { max: 70, label: 'Moderate Control', context: 'Acceptable dynamics. Light compression should suffice.' },
            { max: 85, label: 'Good Control', context: 'Consistent performance. Minimal processing needed.' },
            { max: Infinity, label: 'Excellent Control', context: 'Professional-grade dynamics. Well-controlled delivery.' }
        ],
        unit: 'control score (0-100)'
    },

    voiceQuality: {
        thresholds: [
            { max: 30, label: 'Needs Work', context: 'Quality issues detected. Check recording environment/technique.' },
            { max: 50, label: 'Fair Quality', context: 'Some issues present. EQ and processing may help.' },
            { max: 70, label: 'Good Quality', context: 'Solid vocal quality. Standard processing applies.' },
            { max: 85, label: 'Very Good', context: 'High-quality vocal. Enhance rather than correct.' },
            { max: Infinity, label: 'Excellent', context: 'Professional vocal quality. Preserve natural character.' }
        ],
        unit: 'quality score (0-100)'
    },

    // ============================================
    // MELODY LABELS
    // ============================================
    melodicRange: {
        thresholds: [
            { max: 6, label: 'Narrow Range', context: 'Limited pitch movement. Spoken-word like or monotonous.' },
            { max: 12, label: 'Moderate Range', context: 'Standard pop vocal range. Comfortable for most singers.' },
            { max: 18, label: 'Wide Range', context: 'Expressive melodic content. More challenging performance.' },
            { max: 24, label: 'Very Wide', context: 'Two+ octave range. Virtuosic or dramatic content.' },
            { max: Infinity, label: 'Extreme Range', context: 'Exceptional range. Possibly multiple voices or octave jumps.' }
        ],
        unit: 'semitones'
    }
};

/**
 * Get a qualitative label for a given category and value
 * @param {string} category - Label category (e.g., 'tempo', 'loudnessLufs')
 * @param {number} value - The numeric value to label
 * @returns {Object} { label, context, unit } or null if category not found
 */
export function getLabel(category, value) {
    const config = LABELS[category];
    if (!config) return null;

    const threshold = config.thresholds.find(t => value <= t.max);
    if (!threshold) return null;

    return {
        label: threshold.label,
        context: threshold.context,
        unit: config.unit
    };
}

/**
 * Get label with full details including the raw value
 * @param {string} category - Label category
 * @param {number} value - The numeric value
 * @returns {Object} Full label object with value, label, context, and unit
 */
export function getLabelWithValue(category, value) {
    const labelInfo = getLabel(category, value);
    if (!labelInfo) return null;

    return {
        value: value,
        label: labelInfo.label,
        context: labelInfo.context,
        unit: labelInfo.unit
    };
}

/**
 * Get all available label categories
 * @returns {string[]} Array of category names
 */
export function getCategories() {
    return Object.keys(LABELS);
}
