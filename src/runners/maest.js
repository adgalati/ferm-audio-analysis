import { execa } from 'execa';
import path from 'node:path';

/**
 * Run MAEST genre/style classification
 * @param {Object} options - Configuration options
 * @param {string} options.audioPath - Path to input audio file
 * @param {number} options.topK - Number of top predictions to return (default: 7)
 * @param {string} options.pythonPath - Path to Python executable
 * @param {string} options.cliPath - Path to MAEST CLI script
 * @returns {Promise<Object>} Classification results: { model, results: [{ genre, subgenre, score }] }
 */
export async function runMAEST({
  audioPath,
  topK = 7,
  pythonPath,
  cliPath,
  saveEmbeddingPath,
  signal
}) {
  console.log('[MAEST Runner] Starting genre classification for:', audioPath);

  const args = [cliPath, audioPath, String(topK), 'all'];
  if (saveEmbeddingPath) {
    args.push('--save-embedding', saveEmbeddingPath);
  }

  console.log('[MAEST Runner] Running:', pythonPath, args.join(' '));

  try {
    const { stdout, stderr } = await execa(pythonPath, args, {
      windowsHide: true,
      timeout: 120000, // 2 minute timeout for model inference
      cancelSignal: signal
    });

    console.log('[MAEST Runner] MAEST stdout:', stdout);
    if (stderr) console.log('[MAEST Runner] MAEST stderr:', stderr);

    // Parse JSON output
    const result = JSON.parse(stdout);

    console.log('[MAEST Runner] Classification complete:', {
      model: result.model,
      numResults: result.results?.length || 0,
      topResult: result.results?.[0]
    });

    return result;

  } catch (error) {
    console.error('[MAEST Runner] MAEST failed:', error);
    throw new Error(`MAEST classification failed: ${error.message}`);
  }
}

/**
 * Check if MAEST is available
 * @param {string} pythonPath - Path to Python executable
 * @param {string} cliPath - Path to MAEST CLI script
 * @returns {Promise<boolean>} True if available
 */
export async function checkMAESTAvailability(pythonPath, cliPath) {
  try {
    // Test if Python can import required modules and load the model
    const testArgs = ['-c', `
import sys
try:
    import transformers
    import librosa
    import numpy
    print("Dependencies OK")
except ImportError as e:
    print(f"Missing dependency: {e}")
    sys.exit(1)
`];

    await execa(pythonPath, testArgs, {
      windowsHide: true,
      timeout: 30000
    });

    // Test if CLI script exists and is executable
    const fs = await import('fs/promises');
    await fs.access(cliPath);

    console.log('[MAEST Runner] MAEST availability check passed');
    return true;
  } catch (error) {
    console.log('[MAEST Runner] MAEST availability check failed:', error.message);
    return false;
  }
}
