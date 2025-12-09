/**
 * Parse MAEST JSON output into structured format
 * @param {string} jsonOutput - Raw JSON string from MAEST CLI
 * @returns {Object} Parsed MAEST data: { model, results: [{ genre, subgenre, score }], hiphop_substyle }
 */
export function parseMAESTOutput(jsonOutput) {
  try {
    const data = JSON.parse(jsonOutput);

    // Check if we have the new format (with tags/embedding) or old format (with results)
    const hasNewFormat = data.tags !== undefined;
    const results = hasNewFormat ? data.tags : data.results;

    // Validate required fields
    if (!data.model || !Array.isArray(results)) {
      throw new Error('Invalid MAEST output format: missing model or results/tags');
    }

    // Validate and normalize results
    const normalizedResults = results.map((item, index) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Invalid result at index ${index}: not an object`);
      }

      const { genre, subgenre, score } = item;

      if (typeof genre !== 'string' || genre.trim() === '') {
        throw new Error(`Invalid genre at index ${index}: must be non-empty string`);
      }

      if (score !== null && score !== undefined) {
        const numScore = parseFloat(score);
        if (isNaN(numScore) || numScore < 0 || numScore > 1) {
          throw new Error(`Invalid score at index ${index}: must be number between 0 and 1`);
        }
        item.score = numScore;
      } else {
        item.score = 0; // Default score if missing
      }

      // Normalize subgenre (can be null)
      if (subgenre !== null && subgenre !== undefined && typeof subgenre !== 'string') {
        item.subgenre = String(subgenre);
      }

      return {
        genre: genre.trim(),
        subgenre: subgenre?.trim() || null,
        score: item.score
      };
    });

    const parsed = {
      model: data.model,
      results: normalizedResults,
      timestamp: Date.now()
    };

    // Add substyle data if present
    if (data.hiphop_substyle) {
      parsed.hiphop_substyle = data.hiphop_substyle;
    }

    return parsed;

  } catch (error) {
    console.error('[MAEST Parser] Failed to parse MAEST JSON:', error);
    throw new Error(`Failed to parse MAEST JSON: ${error.message}`);
  }
}
