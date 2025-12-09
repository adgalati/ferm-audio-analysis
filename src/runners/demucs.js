import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

/**
 * Generate a hash for the input file to use as cache key
 * @param {string} filePath - Path to the audio file
 * @returns {Promise<string>} Hash string
 */
async function generateFileHash(filePath) {
  const stats = await fs.stat(filePath);
  const content = await fs.readFile(filePath);
  return crypto.createHash('md5').update(content).update(stats.mtime.getTime().toString()).digest('hex');
}

/**
 * Check if stems already exist in cache
 * @param {string} cacheDir - Cache directory path
 * @returns {Promise<Object>} { vocals: path|null, instrumental: path|null, exists: boolean }
 */
async function checkStemCache(cacheDir) {
  const vocalsPath = path.join(cacheDir, 'vocals.wav');
  const instrumentalPath = path.join(cacheDir, 'no_vocals.wav');
  
  try {
    await fs.access(vocalsPath);
    await fs.access(instrumentalPath);
    return { vocals: vocalsPath, instrumental: instrumentalPath, exists: true };
  } catch {
    return { vocals: null, instrumental: null, exists: false };
  }
}

/**
 * Run Demucs stem separation
 * @param {Object} options - Configuration options
 * @param {string} options.audioPath - Path to input audio file
 * @param {string} options.demucsCmd - Demucs command (default: 'demucs')
 * @param {string} options.demucsArgs - Demucs arguments
 * @param {string} options.device - Device to use (cuda/cpu)
 * @param {string} options.outDir - Output directory
 * @param {string} options.ffmpegPath - FFmpeg path for PATH env
 * @param {Function} options.onProgress - Progress callback
 * @returns {Promise<Object>} { vocals: path, instrumental: path }
 */
export async function runDemucs({ 
  audioPath, 
  demucsCmd = 'demucs', 
  demucsArgs = '-n htdemucs --segment 7 --overlap 0.1 --jobs 1 --shifts 1 --two-stems vocals',
  device = 'cuda',
  outDir = 'tmp/stems',
  ffmpegPath,
  onProgress,
  signal 
}) {
  console.log('[Demucs Runner] Starting stem separation for:', audioPath);
  
  // Generate cache key and check if stems exist
  const fileHash = await generateFileHash(audioPath);
  const cacheDir = path.join(outDir, fileHash);
  await fs.mkdir(cacheDir, { recursive: true });
  
  const cached = await checkStemCache(cacheDir);
  if (cached.exists) {
    console.log('[Demucs Runner] Using cached stems');
    if (onProgress) onProgress({ percent: 100, message: 'Using cached stems' });
    return { vocals: cached.vocals, instrumental: cached.instrumental };
  }
  
  if (onProgress) onProgress({ percent: 0, message: 'Separating stems with Demucs...' });
  
  // Parse arguments
  const args = demucsArgs.split(' ').filter(arg => arg.trim());
  
  // Add device and output directory
  args.push('-d', device);
  args.push('-o', outDir);
  args.push(audioPath);
  
  console.log('[Demucs Runner] Running:', demucsCmd, args.join(' '));
  
  // Set up environment with FFmpeg path
  const env = {
    ...process.env,
    PATH: ffmpegPath ? `${ffmpegPath};${process.env.PATH}` : process.env.PATH
  };
  
  try {
    const { stdout, stderr } = await execa(demucsCmd, args, { 
      windowsHide: true,
      env,
      timeout: 300000, // 5 minute timeout
      cancelSignal: signal
    });
    
    console.log('[Demucs Runner] Demucs stdout:', stdout);
    if (stderr) console.log('[Demucs Runner] Demucs stderr:', stderr);
    
    // Find the output files
    const basename = path.basename(audioPath, path.extname(audioPath));
    const modelDir = path.join(outDir, 'htdemucs', basename);
    
    const vocalsPath = path.join(modelDir, 'vocals.wav');
    const instrumentalPath = path.join(modelDir, 'no_vocals.wav');
    
    // Copy to cache directory
    await fs.copyFile(vocalsPath, path.join(cacheDir, 'vocals.wav'));
    await fs.copyFile(instrumentalPath, path.join(cacheDir, 'no_vocals.wav'));
    
    console.log('[Demucs Runner] Stem separation complete');
    console.log('[Demucs Runner] Vocals:', vocalsPath);
    console.log('[Demucs Runner] Instrumental:', instrumentalPath);
    
    if (onProgress) onProgress({ percent: 100, message: 'Stems ready' });
    
    return { vocals: vocalsPath, instrumental: instrumentalPath };
    
  } catch (error) {
    console.error('[Demucs Runner] Demucs failed:', error);
    throw new Error(`Demucs stem separation failed: ${error.message}`);
  }
}

/**
 * Check if Demucs is available
 * @param {string} demucsCmd - Demucs command to test
 * @returns {Promise<boolean>} True if available
 */
export async function checkDemucsAvailability(demucsCmd = 'demucs') {
  try {
    // Fast path: ensure the executable exists when an absolute/relative path is provided
    try {
      const fs = await import('node:fs/promises');
      // If demucsCmd looks like a path to an exe, check it exists
      if (demucsCmd.toLowerCase().endsWith('.exe') || demucsCmd.includes('\\') || demucsCmd.includes('/')) {
        await fs.access(demucsCmd);
      }
    } catch (_) {
      // If access fails, we still try running --help below which will error quickly if missing
    }

    // Some environments are slow on first import; allow more time
    await execa(demucsCmd, ['--help'], { windowsHide: true, timeout: 60000 });
    return true;
  } catch (error) {
    // If we timed out, assume available to avoid false negatives on cold starts
    if (String(error && error.message).toLowerCase().includes('timed out')) {
      console.warn('[Demucs Runner] Availability check timed out; assuming Demucs is available.');
      return true;
    }
    return false;
  }
}
