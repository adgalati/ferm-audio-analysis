import fs from 'fs';
import path from 'path';
import { app } from 'electron';
import { fileURLToPath } from 'url';

// Handle __dirname in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Determine if we are in dev or prod
// Note: app might be undefined if running in a pure Node process (like a worker), 
// but usually this runs in the main process.
const isDev = !app || !app.isPackaged;

function getCurvesBaseDir() {
    if (isDev) {
        // In dev, we are in src/utils, so we go up to project root then docs/iZotope Target Curves
        return path.join(__dirname, '..', '..', 'docs', 'iZotope Target Curves');
    }

    // In prod, files are in resources/izotope-target-curves
    return path.join(process.resourcesPath, 'izotope-target-curves');
}

// Helper to unwrap the "Type/Value" structure if present
function unwrapArrayField(field) {
    if (Array.isArray(field)) {
        return field;
    }
    if (field && field.Type === 'Array' && Array.isArray(field.Value)) {
        return field.Value.map(v => v.Value);
    }
    return [];
}

// Normalize a raw profile into a standard TonalBalanceProfile
export function normalizeTonalProfile(raw) {
    const frequencies = unwrapArrayField(raw.frequencies_hz);
    const low = unwrapArrayField(raw.low_normalized_mag_dB);
    const high = unwrapArrayField(raw.high_normalized_mag_dB);

    // Extract regions
    const regions = [0, 1, 2, 3].map(i => {
        const freqRaw = raw[`region_${i}_frequencies`];
        const boundsRaw = raw[`region_${i}_bounds`];

        const freq = unwrapArrayField(freqRaw);
        const bounds = unwrapArrayField(boundsRaw);

        return {
            frequencies: [freq[0], freq[1]],
            bounds: [bounds[0], bounds[1]]
        };
    });

    return { frequencies, low, high, regions };
}

/**
 * Load a tonal balance JSON by filename.
 */
export function loadTonalProfileJson(filename) {
    const filePath = path.join(getCurvesBaseDir(), filename);

    if (!fs.existsSync(filePath)) {
        console.error(`Tonal profile JSON not found at ${filePath}`);
        // Return a dummy object or throw, depending on preference. 
        // Throwing is better to catch config errors.
        throw new Error(`Tonal profile JSON not found at ${filePath}`);
    }

    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
}

// Map internal genre keys to actual filenames
const PROFILE_FILENAMES = {
    'Bass Heavy': 'Bass Heavy.json',
    'Classical': 'Orchestral.json',
    'Country': 'Country.json',
    'Electronic': 'EDM.json',
    'Folk': 'Folk.json',
    'Funk/Soul': 'RnB-Soul.json',
    'Hip-Hop': 'Hip Hop.json',
    'Jazz': 'Jazz.json',
    'Modern': 'Modern.json',
    'Pop': 'Pop.json',
    'Reggae': 'Reggae.json',
    'Rock': 'Rock.json'
};

// Export normalized profiles
export const LOADED_TONAL_PROFILES = Object.entries(PROFILE_FILENAMES).reduce((acc, [key, filename]) => {
    try {
        const raw = loadTonalProfileJson(filename);
        acc[key] = normalizeTonalProfile(raw);
    } catch (err) {
        console.error(`Failed to load profile for ${key}:`, err);
        // We might want to skip this genre or provide a fallback
    }
    return acc;
}, {});
