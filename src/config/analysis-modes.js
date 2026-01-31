/**
 * Analysis Mode Configurations
 * 
 * Centralized configuration for different analysis modes:
 * - Stream Mode: Optimized for live stream review (speed-focused)
 * - Full Mode: Comprehensive analysis for LLM-consumable reports
 */

export const ANALYSIS_MODES = {
    stream: {
        name: 'Stream Mode',
        description: 'Optimized for live stream review - fast analysis',
        analyses: ['rhythm', 'harmony', 'spectral', 'loudness', 'autotagging', 'spatial'],
        enableSmile: false,
        useStems: true
    },
    full: {
        name: 'Full Analysis Mode',
        description: 'Comprehensive analysis for LLM-consumable reports with mixing advice context',
        analyses: ['rhythm', 'harmony', 'melody', 'spectral', 'loudness', 'autotagging', 'spatial', 'timbre'],
        enableSmile: true,
        useStems: true
    }
};

/**
 * Get the analyses array for a specific mode
 * @param {string} mode - 'stream' or 'full'
 * @returns {string[]} Array of analysis type identifiers
 */
export function getAnalysesForMode(mode) {
    return ANALYSIS_MODES[mode]?.analyses || ANALYSIS_MODES.stream.analyses;
}

/**
 * Get full configuration for a mode
 * @param {string} mode - 'stream' or 'full'
 * @returns {Object} Mode configuration object
 */
export function getModeConfig(mode) {
    return ANALYSIS_MODES[mode] || ANALYSIS_MODES.stream;
}
