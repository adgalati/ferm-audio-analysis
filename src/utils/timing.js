// Subdivision-aware timing analysis utilities

// Helper functions
const median = arr => {
  if (!arr.length) return 0;
  const sorted = arr.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
};

const medianAbs = arr => {
  if (!arr.length) return 0;
  const m = median(arr);
  return median(arr.map(x => Math.abs(x - m)));
};

/**
 * Detect the best subdivision for timing analysis
 * @param {number[]} beats - Array of beat times in seconds
 * @param {number[]} onsets - Array of onset times in seconds
 * @returns {Object} { n: subdivision count, period: beat period in seconds }
 */
export function detectSubdivision(beats, onsets) {
  if (!beats?.length || !onsets?.length) return { n: 4, period: null }; // default 16ths
  
  const diffs = beats.slice(1).map((b, i) => b - beats[i]);
  const T = median(diffs); // beat period in seconds
  
  // Test candidates: 2,3,4 (8ths, triplets, 16ths)
  const cands = [2, 3, 4].map(n => {
    const devs = onsets.map(t => {
      // Distance to nearest subdivision line
      const phase = ((t - beats[0]) % T + T) % T;
      const grid = Array.from({ length: n }, (_, k) => k * T / n);
      const d = grid.reduce((best, g) => 
        Math.abs(phase - g) < Math.abs(best) ? phase - g : best, 
        phase - grid[0]
      );
      return Math.abs(d);
    });
    return { n, mad: medianAbs(devs) };
  });
  
  cands.sort((a, b) => a.mad - b.mad);
  return { n: cands[0].n, period: T };
}

/**
 * Calculate timing statistics against a specific subdivision
 * @param {number[]} beats - Array of beat times in seconds
 * @param {number[]} onsets - Array of onset times in seconds
 * @param {number} n - Subdivision count (2=8ths, 3=triplets, 4=16ths)
 * @param {number} T - Beat period in seconds
 * @returns {Object} { mate_ms, bias_ms, devs_ms }
 */
export function timingStats(beats, onsets, n, T) {
  if (!beats?.length || !onsets?.length) {
    return { mate_ms: 0, bias_ms: 0, devs_ms: [] };
  }
  
  const ref0 = beats[0];
  const gridStep = T / n;
  
  const devs = onsets.map(t => {
    const k = Math.round((t - ref0) / gridStep);
    return (t - (ref0 + k * gridStep)) * 1000; // Convert to ms
  });
  
  return {
    mate_ms: medianAbs(devs),
    bias_ms: median(devs),
    devs_ms: devs
  };
}

/**
 * Convert MATE to a musical timing score
 * @param {number} mate_ms - Median Absolute Timing Error in milliseconds
 * @returns {number} Score from 0-100
 */
export function timingScore(mate_ms) {
  // Piecewise linear: 0ms→100, 35→95, 60→85, 100→70, 150→55, 200→40, 300→20
  const table = [
    [0, 100], [35, 95], [60, 85], [100, 70], 
    [150, 55], [200, 40], [300, 20], [500, 0]
  ];
  
  for (let i = 1; i < table.length; i++) {
    const [x0, y0] = table[i - 1];
    const [x1, y1] = table[i];
    if (mate_ms <= x1) {
      const t = (mate_ms - x0) / (x1 - x0);
      return y0 + (y1 - y0) * t;
    }
  }
  return 0;
}
