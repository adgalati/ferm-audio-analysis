/**
 * Full Analysis Report Generator
 * 
 * Transforms raw analysis results into a structured, LLM-readable JSON report
 * designed to provide comprehensive context for mixing advice.
 * 
 * Key design decisions:
 * - MAEST embeddings are excluded (saved separately for FAISS)
 * - Every metric includes both raw value and qualitative label
 * - Mixing context is provided for each measurement
 * - Summary section provides high-level overview
 */

import path from 'node:path';
import { getLabelWithValue, getLabel } from './qualitative-labels.js';

/**
 * Calculate melodic range from melody data
 */
function calculateMelodicRange(melody) {
    if (!melody?.f0_hz || melody.f0_hz.length === 0) return null;

    const validPitches = melody.f0_hz.filter(f => f > 0);
    if (validPitches.length === 0) return null;

    const minHz = Math.min(...validPitches);
    const maxHz = Math.max(...validPitches);

    // Convert Hz to semitones (relative to minHz)
    const semitones = 12 * Math.log2(maxHz / minHz);

    return Math.round(semitones * 10) / 10;
}

/**
 * Format a labeled metric for the report
 */
function formatMetric(category, value, options = {}) {
    if (value === null || value === undefined) {
        return null;
    }

    const rounded = typeof value === 'number'
        ? Math.round(value * (options.precision || 100)) / (options.precision || 100)
        : value;

    const labelInfo = getLabelWithValue(category, rounded);

    if (labelInfo) {
        return labelInfo;
    }

    // Fallback if no label category exists
    return {
        value: rounded,
        label: null,
        context: null,
        unit: options.unit || null
    };
}

/**
 * Generate the full analysis report from raw analysis results
 * 
 * @param {Object} analysisResults - Raw results from analyzeAudio()
 * @param {Object} options - Generation options
 * @param {string} options.outputPath - Where the report will be saved
 * @returns {Object} Structured report ready for JSON serialization
 */
export function generateReport(analysisResults, options = {}) {
    const now = new Date();
    const fileName = analysisResults.file ? path.basename(analysisResults.file) : 'Unknown';

    // Build the comprehensive report structure
    const report = {
        // ============================================
        // METADATA
        // ============================================
        metadata: {
            file: analysisResults.file,
            fileName,
            analyzedAt: now.toISOString(),
            mode: 'full',
            version: '1.0.0',
            stemsUsed: analysisResults.stemsUsed || false
        },

        // ============================================
        // EXECUTIVE SUMMARY (for quick LLM overview)
        // ============================================
        summary: generateSummary(analysisResults),

        // ============================================
        // DETAILED SECTIONS
        // ============================================
        sections: {}
    };

    // Add each analysis section with both raw data and labels
    if (analysisResults.rhythm) {
        report.sections.rhythm = generateRhythmSection(analysisResults);
    }

    if (analysisResults.harmony) {
        report.sections.harmony = generateHarmonySection(analysisResults);
    }

    if (analysisResults.melody) {
        report.sections.melody = generateMelodySection(analysisResults);
    }

    if (analysisResults.spectral) {
        report.sections.spectral = generateSpectralSection(analysisResults);
    }

    if (analysisResults.loudness) {
        report.sections.loudness = generateLoudnessSection(analysisResults);
    }

    if (analysisResults.spatial) {
        report.sections.spatial = generateSpatialSection(analysisResults);
    }

    if (analysisResults.smile) {
        report.sections.timbre = generateTimbreSection(analysisResults);
    }

    if (analysisResults.autotagging) {
        report.sections.genre = generateGenreSection(analysisResults);
    }

    // Add key analysis if available
    if (analysisResults.keyAnalysis) {
        report.sections.key = generateKeySection(analysisResults);
    }

    return report;
}

/**
 * Generate the high-level summary section
 */
function generateSummary(results) {
    const summary = {};

    // Top genre tag
    if (results.autotagging?.tags?.[0]) {
        const topTag = results.autotagging.tags[0];
        summary.topGenre = {
            genre: topTag.genre,
            subgenre: topTag.subgenre || null,
            confidence: topTag.score,
            ...getLabel('genreConfidence', topTag.score)
        };
    }

    // Tempo
    if (results.rhythm?.tempo_bpm) {
        summary.tempo = formatMetric('tempo', results.rhythm.tempo_bpm);
    }

    // Key
    if (results.keyAnalysis?.detectedKey) {
        const mode = results.keyAnalysis.mode === 'major' ? 1 : 0;
        summary.key = {
            key: results.keyAnalysis.detectedKey,
            mode: results.keyAnalysis.mode,
            ...getLabel('keyMode', mode)
        };
    }

    // Loudness
    if (results.loudness?.global?.input_i) {
        summary.loudness = formatMetric('loudnessLufs', results.loudness.global.input_i);
    }

    // Spectral balance
    if (results.spectral?.genreFit?.selectedScore !== undefined) {
        summary.spectralBalance = formatMetric('spectralBalance', results.spectral.genreFit.selectedScore);
    }

    // Stereo width
    if (results.spatial?.widthScore !== undefined) {
        summary.stereoWidth = formatMetric('stereoWidth', results.spatial.widthScore);
    }

    return summary;
}

/**
 * Generate rhythm section with detailed timing analysis
 */
function generateRhythmSection(results) {
    const rhythm = results.rhythm;
    const timing = results.scores?.timing;

    const section = {
        tempo: formatMetric('tempo', rhythm.tempo_bpm),
        beatCount: rhythm.beats?.length || 0,
        downbeatCount: rhythm.downbeats?.length || 0
    };

    // Timing analysis
    if (timing) {
        section.timingAnalysis = {
            tightness: formatMetric('timingTightness', timing.mate_ms),
            bias: formatMetric('timingBias', timing.bias_ms),
            subdivision: timing.subdivision ? {
                divisor: timing.subdivision.n,
                period: timing.subdivision.period
            } : null
        };
    }

    // Raw beat grid (for precise timing work)
    section.rawData = {
        beats: rhythm.beats?.slice(0, 50), // First 50 beats as sample
        downbeats: rhythm.downbeats?.slice(0, 20),
        beatsSampleNote: rhythm.beats?.length > 50 ? `Showing 50 of ${rhythm.beats.length} beats` : null
    };

    return section;
}

/**
 * Generate harmony section with chord progression
 */
function generateHarmonySection(results) {
    const harmony = results.harmony;

    // Analyze chord progression patterns
    const chords = harmony.chords || [];
    const chordNames = chords.map(c => c.label).filter(Boolean);
    const uniqueChords = [...new Set(chordNames)];

    // Calculate chord distribution
    const chordCounts = {};
    chordNames.forEach(c => {
        chordCounts[c] = (chordCounts[c] || 0) + 1;
    });

    return {
        chordCount: chords.length,
        uniqueChords: uniqueChords.length,
        chordProgression: chordNames.slice(0, 32), // First 32 chords
        chordDistribution: chordCounts,
        rawData: {
            chords: chords.slice(0, 50), // First 50 chord events
            chordsSampleNote: chords.length > 50 ? `Showing 50 of ${chords.length} chord events` : null
        }
    };
}

/**
 * Generate melody section with pitch analysis
 */
function generateMelodySection(results) {
    const melody = results.melody;

    const section = {
        pitchPointCount: melody.f0_hz?.length || 0,
        melodicRange: formatMetric('melodicRange', calculateMelodicRange(melody))
    };

    // Calculate pitch statistics
    const validPitches = (melody.f0_hz || []).filter(f => f > 0);
    if (validPitches.length > 0) {
        const avgPitch = validPitches.reduce((a, b) => a + b, 0) / validPitches.length;
        const minPitch = Math.min(...validPitches);
        const maxPitch = Math.max(...validPitches);

        section.pitchStats = {
            averageHz: Math.round(avgPitch * 10) / 10,
            minHz: Math.round(minPitch * 10) / 10,
            maxHz: Math.round(maxPitch * 10) / 10,
            voicedFrames: validPitches.length,
            totalFrames: melody.f0_hz.length,
            voicedPercent: Math.round((validPitches.length / melody.f0_hz.length) * 100)
        };
    }

    // Note events if available
    if (melody.notes?.length > 0) {
        section.noteCount = melody.notes.length;
        section.notes = melody.notes.slice(0, 30); // First 30 notes
        section.notesSampleNote = melody.notes.length > 30 ? `Showing 30 of ${melody.notes.length} notes` : null;
    }

    return section;
}

/**
 * Generate spectral section with tonal balance analysis
 */
function generateSpectralSection(results) {
    const spectral = results.spectral;
    const snapshot = spectral.snapshot || {};
    const genreFit = spectral.genreFit || {};

    const section = {
        genreFit: {
            selectedGenre: genreFit.selectedGenre,
            score: formatMetric('spectralBalance', genreFit.selectedScore),
            bestMatch: genreFit.bestMatch,
            bestScore: genreFit.bestScore,
            availableGenres: genreFit.availableGenres
        },
        tonalBalance: {
            brightness: formatMetric('tonalBrightness', snapshot.tonal_balance?.brightness),
            warmth: formatMetric('tonalWarmth', snapshot.tonal_balance?.warmth)
        },
        spectralCharacteristics: {
            averageContrast: snapshot.avg_contrast,
            averageFlux: snapshot.avg_flux,
            averageEnergy: snapshot.avg_energy
        }
    };

    // Frequency bands if available
    if (spectral.frequencyBands) {
        section.frequencyBands = spectral.frequencyBands;
    }

    // LTAS bands if available
    if (spectral.raw_data?.ltas?.rel_db) {
        section.ltasBands = spectral.raw_data.ltas.rel_db;
    }

    return section;
}

/**
 * Generate loudness section with EBU R128 metrics
 */
function generateLoudnessSection(results) {
    const loudness = results.loudness;
    const global = loudness.global || {};

    const section = {
        integratedLoudness: formatMetric('loudnessLufs', global.input_i),
        loudnessRange: formatMetric('dynamicRange', global.input_lra),
        truePeak: formatMetric('truePeak', global.input_tp),
        targetOffset: global.target_offset ? {
            value: global.target_offset,
            unit: 'dB',
            context: global.target_offset > 0
                ? 'Track is quieter than target'
                : 'Track is louder than target'
        } : null
    };

    // Stem analysis if available
    if (loudness.stems) {
        section.stemAnalysis = {
            vocalLoudness: loudness.stems.vocals?.input_i,
            instrumentalLoudness: loudness.stems.instrumental?.input_i,
            gainStaging: loudness.stem_delta
                ? formatMetric('gainStaging', loudness.stem_delta.lufs_delta)
                : null,
            stagingAssessment: loudness.stem_delta?.staging_assessment
        };
    }

    // Timeline statistics if available
    if (loudness.timeline?.stats) {
        section.dynamicProfile = {
            peakLoudness: loudness.timeline.stats.peak,
            minLoudness: loudness.timeline.stats.min,
            range: loudness.timeline.stats.range
        };
    }

    return section;
}

/**
 * Generate spatial section with stereo analysis
 */
function generateSpatialSection(results) {
    const spatial = results.spatial;

    return {
        stereoWidth: formatMetric('stereoWidth', spatial.widthScore),
        widthDescription: spatial.widthDescription,
        phaseCorrelation: formatMetric('phaseCorrelation', spatial.phaseCorrelation),
        midSideLevels: {
            midLoudness: spatial.midLoudness,
            sideLoudness: spatial.sideLoudness,
            difference: spatial.sideLoudness - spatial.midLoudness,
            unit: 'LUFS'
        }
    };
}

/**
 * Generate timbre section with vocal quality analysis
 */
function generateTimbreSection(results) {
    const smile = results.smile?.egemaps;
    if (!smile) return null;

    const scores = smile.scores || {};

    return {
        vocalQuality: {
            pitchStability: formatMetric('pitchStability', scores.pitch_stability),
            dynamicControl: formatMetric('dynamicControl', scores.dynamic_control),
            voiceQuality: formatMetric('voiceQuality', scores.voice_quality),
            overall: scores.overall
        },
        rawFeatures: smile.features ? {
            // Include key eGeMAPS features relevant for mixing
            F0semitoneFrom27_5Hz_sma3nz_amean: smile.features.F0semitoneFrom27_5Hz_sma3nz_amean,
            jitterLocal_sma3nz_amean: smile.features.jitterLocal_sma3nz_amean,
            shimmerLocaldB_sma3nz_amean: smile.features.shimmerLocaldB_sma3nz_amean,
            HNRdBACF_sma3nz_amean: smile.features.HNRdBACF_sma3nz_amean,
            loudness_sma3_amean: smile.features.loudness_sma3_amean
        } : null
    };
}

/**
 * Generate genre/autotagging section
 */
function generateGenreSection(results) {
    const tagging = results.autotagging;

    // Exclude embeddings - they're saved separately for FAISS
    const section = {
        model: tagging.model,
        timestamp: tagging.timestamp,
        topTags: tagging.tags?.map(tag => ({
            genre: tag.genre,
            subgenre: tag.subgenre,
            confidence: tag.score,
            ...getLabel('genreConfidence', tag.score)
        })) || []
    };

    // Hip-hop substyle if available
    if (tagging.hiphop_substyle?.enabled) {
        section.hiphopSubstyle = {
            enabled: true,
            predictions: tagging.hiphop_substyle.top_substyles
        };
    }

    // Note: embeddingPath intentionally excluded from report
    // (saved separately for FAISS indexing)

    return section;
}

/**
 * Generate key/tonality section
 */
function generateKeySection(results) {
    const key = results.keyAnalysis;

    const mode = key.mode === 'major' ? 1 : 0;

    return {
        detectedKey: key.detectedKey,
        mode: {
            name: key.mode,
            ...getLabel('keyMode', mode)
        },
        inKeyPercentage: key.inKeyPercentage !== null
            ? formatMetric('inKeyPercentage', key.inKeyPercentage)
            : null,
        scaleNotes: key.scaleNotes,
        noteAnalysis: key.noteAnalysis?.slice(0, 20) // First 20 note analyses
    };
}

/**
 * Generate a filename for the report based on the audio file
 */
export function generateReportFilename(audioPath) {
    const baseName = path.basename(audioPath, path.extname(audioPath));
    const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '');
    return `${baseName}_full_analysis_${timestamp}.json`;
}

/**
 * Generate an infographic using OpenAI's image generation API (DALL-E / GPT)
 *
 * @param {string} promptText - The prompt describing the infographic
 * @param {string} apiKey - OpenAI API key
 * @param {Object} options - Options containing model and other generation params
 * @returns {Promise<Object>} { success, imageBase64?, mimeType?, error? }
 */
export async function generateOpenAIInfographic(promptText, apiKey, options = {}) {
    if (!apiKey) {
        return { success: false, error: 'OPENAI_API_KEY is not configured.' };
    }

    try {
        const response = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-image-2',
                prompt: promptText,
                n: 1,
                size: '1024x1024',
                output_format: 'png',
                quality: 'medium'
            })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error?.message || 'OpenAI API Error' };
        }

        // gpt-image-2 returns base64 data by default
        if (data.data && data.data[0] && data.data[0].b64_json) {
            console.log('[OpenAI Report] Infographic generated successfully');
            return {
                success: true,
                imageBase64: data.data[0].b64_json,
                mimeType: 'image/png'
            };
        }

        return {
            success: false,
            error: 'No image data returned from OpenAI.'
        };
    } catch (err) {
        console.error('[OpenAI Report] Request failed:', err);
        return { success: false, error: err.message };
    }
}
