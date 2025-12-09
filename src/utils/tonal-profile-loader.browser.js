
import BassHeavy from '../../docs/iZotope Target Curves/Bass Heavy.json';
import Classical from '../../docs/iZotope Target Curves/Orchestral.json';
import Country from '../../docs/iZotope Target Curves/Country.json';
import EDM from '../../docs/iZotope Target Curves/EDM.json';
import Folk from '../../docs/iZotope Target Curves/Folk.json';
import FunkSoul from '../../docs/iZotope Target Curves/RnB-Soul.json';
import HipHop from '../../docs/iZotope Target Curves/Hip Hop.json';
import Jazz from '../../docs/iZotope Target Curves/Jazz.json';
import Modern from '../../docs/iZotope Target Curves/Modern.json';
import Pop from '../../docs/iZotope Target Curves/Pop.json';
import Reggae from '../../docs/iZotope Target Curves/Reggae.json';
import Rock from '../../docs/iZotope Target Curves/Rock.json';

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

const RAW_PROFILES = {
    'Bass Heavy': BassHeavy,
    'Classical': Classical,
    'Country': Country,
    'Electronic': EDM, // Mapping EDM to Electronic
    'Folk': Folk,
    'Funk/Soul': FunkSoul,
    'Hip-Hop': HipHop,
    'Jazz': Jazz,
    'Modern': Modern,
    'Pop': Pop,
    'Reggae': Reggae,
    'Rock': Rock
};

// Export normalized profiles
export const LOADED_TONAL_PROFILES = Object.entries(RAW_PROFILES).reduce((acc, [key, raw]) => {
    acc[key] = normalizeTonalProfile(raw);
    return acc;
}, {});
