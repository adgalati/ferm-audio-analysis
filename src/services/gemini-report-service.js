/**
 * Gemini Report Service
 * Aggregates analysis insights and generates infographic images via Gemini API.
 */

import fs from 'fs/promises';
import path from 'path';

// ---------------------------------------------------------------------------
// Data Aggregation
// ---------------------------------------------------------------------------

/**
 * Available data categories for report generation.
 */
export const DATA_CATEGORIES = [
    { key: 'genre', label: 'Genre & Style' },
    { key: 'key', label: 'Key Signature' },
    { key: 'loudness', label: 'Loudness' },
    { key: 'gainStaging', label: 'Gain Staging' },
    { key: 'timing', label: 'Timing' },
    { key: 'hiphopSubstyle', label: 'Hip-Hop Substyles' },
    { key: 'fermFactor', label: 'FERM Factor' },
    { key: 'favorites', label: 'Favorites' },
    { key: 'spectral', label: 'Spectral Analysis' }
];

/**
 * Aggregate insights from an array of analysis records.
 * Only computes stats for the categories listed in `selectedCategories`.
 *
 * @param {Array} records - MongoDB analysis records
 * @param {string[]} selectedCategories - Array of category keys to include
 * @param {Object} [userDateRange] - User-selected date range { dateFrom, dateTo }
 * @returns {Object} Structured insights object
 */
export function aggregateInsights(records, selectedCategories = [], userDateRange = {}) {
    const insights = {
        totalTracks: records.length,
        dateRange: {
            earliest: null,
            latest: null
        },
        categories: {}
    };

    if (records.length === 0) return insights;

    // Compute actual date range from records (for logging)
    const dates = records
        .map(r => r.date ? new Date(r.date) : null)
        .filter(Boolean)
        .sort((a, b) => a - b);

    const computedEarliest = dates.length > 0 ? dates[0] : null;
    const computedLatest = dates.length > 0 ? dates[dates.length - 1] : null;

    console.log(`[GeminiReport] Record date range: ${computedEarliest?.toISOString()} — ${computedLatest?.toISOString()}`);
    console.log(`[GeminiReport] User-selected range: ${userDateRange.dateFrom || 'all'} — ${userDateRange.dateTo || 'all'}`);

    // Use user-selected range for display, fall back to computed range
    if (userDateRange.dateFrom) {
        insights.dateRange.earliest = new Date(userDateRange.dateFrom).toISOString();
    } else if (computedEarliest) {
        insights.dateRange.earliest = computedEarliest.toISOString();
    }

    if (userDateRange.dateTo) {
        insights.dateRange.latest = new Date(userDateRange.dateTo).toISOString();
    } else if (computedLatest) {
        insights.dateRange.latest = computedLatest.toISOString();
    }

    const selected = new Set(selectedCategories);

    // ----- Genre & Style -----
    if (selected.has('genre')) {
        const genreCounts = {};
        const styleCounts = {};
        for (const r of records) {
            if (r.topGenre) genreCounts[r.topGenre] = (genreCounts[r.topGenre] || 0) + 1;
            if (r.topGenreWithStyle) styleCounts[r.topGenreWithStyle] = (styleCounts[r.topGenreWithStyle] || 0) + 1;
        }
        const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1]);
        insights.categories.genre = {
            topGenres: sorted.slice(0, 10).map(([genre, count]) => ({
                genre,
                count,
                percentage: ((count / records.length) * 100).toFixed(1)
            })),
            topStyles: Object.entries(styleCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([style, count]) => ({ style, count })),
            uniqueGenres: sorted.length
        };
    }

    // ----- Key Signature -----
    if (selected.has('key')) {
        const keyCounts = {};
        const modeCounts = {};
        for (const r of records) {
            const k = r.keyFit?.key;
            const m = r.keyFit?.mode;
            if (k) keyCounts[k] = (keyCounts[k] || 0) + 1;
            if (m) modeCounts[m] = (modeCounts[m] || 0) + 1;
        }
        insights.categories.key = {
            topKeys: Object.entries(keyCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 12)
                .map(([key, count]) => ({ key, count, percentage: ((count / records.length) * 100).toFixed(1) })),
            modeDistribution: Object.entries(modeCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([mode, count]) => ({ mode, count })),
            avgKeyFitScore: avg(records.map(r => r.keyFit?.score).filter(v => v != null)),
            avgInKeyPercentage: avg(records.map(r => r.inKeyPercentage).filter(v => v != null))
        };
    }

    // ----- Loudness -----
    if (selected.has('loudness')) {
        const lufs = records.map(r => r.loudness?.LUFS).filter(v => v != null);
        const lra = records.map(r => r.loudness?.LRA).filter(v => v != null);
        const tp = records.map(r => r.loudness?.TP).filter(v => v != null);
        insights.categories.loudness = {
            avgLUFS: avg(lufs),
            avgLRA: avg(lra),
            avgTruePeak: avg(tp),
            minLUFS: lufs.length ? Math.min(...lufs).toFixed(2) : null,
            maxLUFS: lufs.length ? Math.max(...lufs).toFixed(2) : null,
            sampleSize: lufs.length
        };
    }

    // ----- Gain Staging -----
    if (selected.has('gainStaging')) {
        const qualityCounts = {};
        const deltas = [];
        let excludedCount = 0;
        for (const r of records) {
            const q = r.gainStaging?.quality;
            const delta = r.gainStaging?.deltaLufs;
            if (q) qualityCounts[q] = (qualityCounts[q] || 0) + 1;
            if (delta != null) {
                // Exclude large negative deltas (< -10 dB) — these are typically
                // instrumentals where stem separation produced skewed results
                if (delta >= -10) {
                    deltas.push(delta);
                } else {
                    excludedCount++;
                }
            }
        }
        if (excludedCount > 0) {
            console.log(`[GeminiReport] Gain staging: excluded ${excludedCount} records with deltaLufs < -10`);
        }
        insights.categories.gainStaging = {
            qualityDistribution: Object.entries(qualityCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([quality, count]) => ({ quality: quality.replace(/-/g, ' '), count })),
            avgDeltaLufs: avg(deltas),
            validSampleSize: deltas.length,
            excludedInstrumentals: excludedCount
        };
    }

    // ----- Timing -----
    if (selected.has('timing')) {
        const vals = records.map(r => r.timingTightness).filter(v => v != null);
        insights.categories.timing = {
            avgTimingTightness: avg(vals),
            sampleSize: vals.length
        };
    }

    // ----- Hip-Hop Substyles -----
    if (selected.has('hiphopSubstyle')) {
        const substyleCounts = {};
        let tracksWithSubstyles = 0;
        for (const r of records) {
            if (r.hiphop_substyle?.enabled && r.hiphop_substyle.top_substyles?.length) {
                tracksWithSubstyles++;
                for (const sub of r.hiphop_substyle.top_substyles) {
                    const label = sub.label.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    substyleCounts[label] = (substyleCounts[label] || 0) + 1;
                }
            }
        }
        insights.categories.hiphopSubstyle = {
            substyleDistribution: Object.entries(substyleCounts)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([substyle, count]) => ({ substyle, count })),
            tracksWithSubstyles
        };
    }

    // ----- FERM Factor -----
    if (selected.has('fermFactor')) {
        const vals = records.map(r => r.fermFactor).filter(v => v != null);
        insights.categories.fermFactor = {
            average: avg(vals),
            min: vals.length ? Math.min(...vals).toFixed(2) : null,
            max: vals.length ? Math.max(...vals).toFixed(2) : null,
            sampleSize: vals.length
        };
    }

    // ----- Favorites -----
    if (selected.has('favorites')) {
        const favs = records.filter(r => r.isFavorite);
        insights.categories.favorites = {
            count: favs.length,
            percentage: ((favs.length / records.length) * 100).toFixed(1),
            topNotes: favs
                .filter(r => r.favoriteNotes)
                .slice(0, 5)
                .map(r => ({ clipName: r.clipName, notes: r.favoriteNotes }))
        };
    }

    // ----- Spectral Analysis -----
    if (selected.has('spectral')) {
        const genreFitMatches = {};
        const brightness = [];
        const warmth = [];
        for (const r of records) {
            if (r.spectral?.genreFit?.bestMatch) {
                const m = r.spectral.genreFit.bestMatch;
                genreFitMatches[m] = (genreFitMatches[m] || 0) + 1;
            }
            if (r.spectral?.snapshot?.tonal_balance?.brightness != null) {
                brightness.push(r.spectral.snapshot.tonal_balance.brightness);
            }
            if (r.spectral?.snapshot?.tonal_balance?.warmth != null) {
                warmth.push(r.spectral.snapshot.tonal_balance.warmth);
            }
        }
        insights.categories.spectral = {
            topGenreFits: Object.entries(genreFitMatches)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .map(([match, count]) => ({ match, count })),
            avgBrightness: avg(brightness),
            avgWarmth: avg(warmth)
        };
    }

    return insights;
}

// ---------------------------------------------------------------------------
// Infographic Generation — uses @google/genai SDK (Nano Banana Pro)
// ---------------------------------------------------------------------------

const SYSTEM_INSTRUCTION_TEMPLATE = (orientationHint) => `You are a professional graphic designer creating branded infographic reports for "FERM Factor" — a music audio analysis platform. 

Style guidelines:
- Use the attached logo as the header/branding element — replicate its chrome metallic and cyan cursive aesthetic
- Dark background (near-black or very dark grey, like #1a1a2e or #0f0f1a)
- Accent colors: cyan (#00e5ff), electric blue (#3b82f6), purple (#8b5cf6)
- Modern, sleek layout with clean typography
- Use charts, icons, and visual hierarchy to make data scannable
- ${orientationHint}
- Include the date range prominently
- Make it visually stunning and professional`;

/**
 * Generate an infographic image using Gemini 3 Pro Image Preview
 * via the @google/genai SDK following the official Nano Banana Pro docs.
 *
 * @param {Object} insights - Output of aggregateInsights()
 * @param {string} logoBase64 - Base64-encoded PNG logo
 * @param {string} apiKey - Gemini API key
 * @param {Object} [options] - Image generation options
 * @param {string} [options.aspectRatio='9:16'] - Aspect ratio (e.g. '9:16', '1:1', '16:9')
 * @param {string} [options.imageSize='2K'] - Resolution ('1K', '2K', '4K')
 * @param {string} [options.userPrompt] - Optional user instructions for layout/style
 * @returns {Promise<Object>} { success, imageBase64?, mimeType?, error? }
 */
export async function generateInfographic(insights, logoBase64, apiKey, options = {}) {
    if (!apiKey) {
        return { success: false, error: 'GEMINI_API_KEY is not configured.' };
    }

    const aspectRatio = options.aspectRatio || '9:16';
    const imageSize = options.imageSize || '2K';
    const userPrompt = options.userPrompt || null;

    try {
        const { GoogleGenAI } = await import('@google/genai');
        const ai = new GoogleGenAI({ apiKey });

        const prompt = buildPrompt(insights, aspectRatio);

        // Build contents array: logo image + text prompt
        const contents = [
            {
                inlineData: {
                    mimeType: 'image/png',
                    data: logoBase64
                }
            },
            {
                text: prompt
            }
        ];

        // Derive orientation hint from aspect ratio
        const orientationHint = getOrientationHint(aspectRatio);

        // Merge system instruction with optional user prompt
        let systemInstruction = SYSTEM_INSTRUCTION_TEMPLATE(orientationHint);
        if (userPrompt) {
            systemInstruction += `\n\nAdditional user instructions:\n${userPrompt}`;
            console.log(`[GeminiReport] User prompt appended: "${userPrompt.substring(0, 80)}..."`);
        }

        console.log(`[GeminiReport] Generating infographic — aspectRatio: ${aspectRatio}, imageSize: ${imageSize}`);

        const response = await ai.models.generateContent({
            model: 'gemini-3-pro-image-preview',
            contents: contents,
            config: {
                responseModalities: ['TEXT', 'IMAGE'],
                systemInstruction: systemInstruction,
                imageConfig: {
                    aspectRatio: aspectRatio,
                    imageSize: imageSize
                }
            }
        });

        // Extract image from response (following SDK response structure)
        const parts = response.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
            if (part.inlineData) {
                console.log('[GeminiReport] Infographic generated successfully');
                return {
                    success: true,
                    imageBase64: part.inlineData.data,
                    mimeType: part.inlineData.mimeType || 'image/png'
                };
            }
        }

        // No image — check for text-only response
        const textParts = parts.filter(p => p.text).map(p => p.text).join('\n');
        console.error('[GeminiReport] No image in response. Text:', textParts);
        return {
            success: false,
            error: 'Gemini did not return an image. ' + (textParts ? `Response: ${textParts.substring(0, 200)}` : 'Empty response.')
        };
    } catch (err) {
        console.error('[GeminiReport] Request failed:', err);
        return { success: false, error: err.message };
    }
}

// ---------------------------------------------------------------------------
// Prompt Builder
// ---------------------------------------------------------------------------

function buildPrompt(insights, aspectRatio = '9:16') {
    const lines = [
        'Generate a visually stunning infographic image for the following audio analysis report data.',
        `Total Submissions: ${insights.totalTracks}`,
    ];

    if (insights.dateRange.earliest && insights.dateRange.latest) {
        lines.push(`Date range: ${new Date(insights.dateRange.earliest).toLocaleDateString()} — ${new Date(insights.dateRange.latest).toLocaleDateString()}`);
    }

    lines.push('');

    const cats = insights.categories;

    if (cats.genre) {
        lines.push('=== GENRE & STYLE ===');
        lines.push(`Unique genres: ${cats.genre.uniqueGenres}`);
        lines.push('Top genres:');
        for (const g of cats.genre.topGenres) {
            lines.push(`  • ${g.genre}: ${g.count} tracks (${g.percentage}%)`);
        }
        if (cats.genre.topStyles.length) {
            lines.push('Top styles:');
            for (const s of cats.genre.topStyles.slice(0, 5)) {
                lines.push(`  • ${s.style}: ${s.count} tracks`);
            }
        }
        lines.push('');
    }

    if (cats.key) {
        lines.push('=== KEY SIGNATURE ===');
        lines.push('Most common keys:');
        for (const k of cats.key.topKeys.slice(0, 8)) {
            lines.push(`  • ${k.key}: ${k.count} tracks (${k.percentage}%)`);
        }
        if (cats.key.modeDistribution.length) {
            lines.push('Mode distribution:');
            for (const m of cats.key.modeDistribution) {
                lines.push(`  • ${m.mode}: ${m.count} tracks`);
            }
        }
        if (cats.key.avgKeyFitScore) lines.push(`Avg key fit: ${cats.key.avgKeyFitScore}%`);
        if (cats.key.avgInKeyPercentage) lines.push(`Avg in-key percentage: ${cats.key.avgInKeyPercentage}%`);
        lines.push('');
    }

    if (cats.loudness) {
        lines.push('=== LOUDNESS ===');
        if (cats.loudness.avgLUFS) lines.push(`Average LUFS: ${cats.loudness.avgLUFS}`);
        if (cats.loudness.avgLRA) lines.push(`Average LRA: ${cats.loudness.avgLRA} LU`);
        if (cats.loudness.avgTruePeak) lines.push(`Average True Peak: ${cats.loudness.avgTruePeak} dBFS`);
        if (cats.loudness.minLUFS && cats.loudness.maxLUFS) {
            lines.push(`LUFS range: ${cats.loudness.minLUFS} to ${cats.loudness.maxLUFS}`);
        }
        lines.push('');
    }

    if (cats.gainStaging) {
        lines.push('=== GAIN STAGING ===');
        if (cats.gainStaging.avgDeltaLufs) lines.push(`Avg delta LUFS: ${cats.gainStaging.avgDeltaLufs}`);
        if (cats.gainStaging.qualityDistribution.length) {
            lines.push('Quality distribution:');
            for (const q of cats.gainStaging.qualityDistribution) {
                lines.push(`  • ${q.quality}: ${q.count} tracks`);
            }
        }
        lines.push('');
    }

    if (cats.timing) {
        lines.push('=== TIMING ===');
        if (cats.timing.avgTimingTightness) lines.push(`Average timing tightness: ${cats.timing.avgTimingTightness}`);
        lines.push(`Sample size: ${cats.timing.sampleSize} tracks`);
        lines.push('');
    }

    if (cats.hiphopSubstyle) {
        lines.push('=== HIP-HOP SUBSTYLES ===');
        lines.push(`Tracks with substyle data: ${cats.hiphopSubstyle.tracksWithSubstyles}`);
        if (cats.hiphopSubstyle.substyleDistribution.length) {
            lines.push('Top substyles:');
            for (const s of cats.hiphopSubstyle.substyleDistribution) {
                lines.push(`  • ${s.substyle}: ${s.count} tracks`);
            }
        }
        lines.push('');
    }

    if (cats.fermFactor) {
        lines.push('=== FERM FACTOR ===');
        if (cats.fermFactor.average) lines.push(`Average: ${cats.fermFactor.average}`);
        if (cats.fermFactor.min && cats.fermFactor.max) {
            lines.push(`Range: ${cats.fermFactor.min} — ${cats.fermFactor.max}`);
        }
        lines.push(`Sample size: ${cats.fermFactor.sampleSize} tracks`);
        lines.push('');
    }

    if (cats.favorites) {
        lines.push('=== FAVORITES ===');
        lines.push(`Favorited: ${cats.favorites.count} tracks (${cats.favorites.percentage}%)`);
        lines.push('');
    }

    if (cats.spectral) {
        lines.push('=== SPECTRAL ANALYSIS ===');
        if (cats.spectral.avgBrightness) lines.push(`Avg brightness: ${cats.spectral.avgBrightness}`);
        if (cats.spectral.avgWarmth) lines.push(`Avg warmth: ${cats.spectral.avgWarmth}`);
        if (cats.spectral.topGenreFits.length) {
            lines.push('Top spectral genre fits:');
            for (const f of cats.spectral.topGenreFits) {
                lines.push(`  • ${f.match}: ${f.count} tracks`);
            }
        }
        lines.push('');
    }

    const orientationLabel = getOrientationHint(aspectRatio);
    lines.push(`Create a polished, modern infographic image displaying this data with the FERM Factor branding from the attached logo. Use charts and visual elements to represent distributions. ${orientationLabel}. The aspect ratio must be ${aspectRatio}.`);

    return lines.join('\n');
}

/**
 * Derive a human-readable orientation hint from the aspect ratio.
 */
function getOrientationHint(aspectRatio) {
    const [w, h] = aspectRatio.split(':').map(Number);
    if (w < h) return 'The layout should be portrait-oriented (tall), suitable for social media stories';
    if (w > h) return 'The layout should be landscape-oriented (wide), suitable for presentations or widescreen displays';
    return 'The layout should be square, balanced in all directions';
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function avg(arr) {
    if (!arr || arr.length === 0) return null;
    return (arr.reduce((s, v) => s + v, 0) / arr.length).toFixed(2);
}

// ---------------------------------------------------------------------------
// Report Library / Persistence
// ---------------------------------------------------------------------------

const REPORTS_DIR = 'F:\\FERM\\reports';

/**
 * Save a generated report (image + metadata) to the local library.
 * @param {string} imageBase64 - The image data
 * @param {Object} metadata - Associated metadata (insights, options, etc.)
 * @returns {Promise<Object>} { success, id }
 */
export async function saveReportToLibrary(imageBase64, metadata) {
    try {
        await fs.mkdir(REPORTS_DIR, { recursive: true });

        const now = new Date();
        // Use a clean timestamp for filename
        const timestamp = now.toISOString().replace(/[:.]/g, '-');
        const id = `report_${timestamp}`;

        const imagePath = path.join(REPORTS_DIR, `${id}.png`);
        const jsonPath = path.join(REPORTS_DIR, `${id}.json`);

        const meta = {
            id,
            savedAt: now.toISOString(),
            ...metadata
        };

        await fs.writeFile(imagePath, Buffer.from(imageBase64, 'base64'));
        await fs.writeFile(jsonPath, JSON.stringify(meta, null, 2));

        console.log(`[GeminiReport] Saved report to library: ${id}`);
        return { success: true, id };
    } catch (error) {
        console.error('[GeminiReport] Failed to save to library:', error);
        return { success: false, error: error.message };
    }
}

/**
 * List all saved reports (metadata only).
 * @returns {Promise<Array>} List of report objects sorted by date desc
 */
export async function listSavedReports() {
    try {
        try {
            await fs.access(REPORTS_DIR);
        } catch {
            return []; // Directory doesn't exist yet
        }

        const files = await fs.readdir(REPORTS_DIR);
        const reports = [];

        const jsonFiles = files.filter(f => f.endsWith('.json'));

        for (const file of jsonFiles) {
            try {
                const filePath = path.join(REPORTS_DIR, file);
                const content = await fs.readFile(filePath, 'utf-8');
                const meta = JSON.parse(content);
                // Ensure ID is present
                if (!meta.id) meta.id = file.replace('.json', '');

                reports.push(meta);
            } catch (err) {
                console.warn(`[GeminiReport] Skipping corrupted metadata: ${file}`);
            }
        }

        return reports.sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
    } catch (error) {
        console.error('[GeminiReport] Failed to list reports:', error);
        return [];
    }
}

/**
 * Load the image for a specific report ID.
 * @param {string} id 
 * @returns {Promise<Object>} { success, imageBase64 }
 */
export async function loadReportImage(id) {
    try {
        const imagePath = path.join(REPORTS_DIR, `${id}.png`);
        const buffer = await fs.readFile(imagePath);
        return { success: true, imageBase64: buffer.toString('base64') };
    } catch (error) {
        return { success: false, error: error.message };
    }
}

/**
 * Delete a report from the library.
 * @param {string} id 
 * @returns {Promise<Object>} { success }
 */
export async function deleteReport(id) {
    try {
        const imagePath = path.join(REPORTS_DIR, `${id}.png`);
        const jsonPath = path.join(REPORTS_DIR, `${id}.json`);

        await fs.unlink(imagePath).catch(() => { });
        await fs.unlink(jsonPath).catch(() => { });

        return { success: true };
    } catch (error) {
        return { success: false, error: error.message };
    }
}
