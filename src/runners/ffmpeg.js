import { execa } from 'execa';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

/**
 * Run FFmpeg loudnorm filter to get global loudness stats
 * @param {Object} options - Configuration options
 * @param {string} options.audioPath - Path to input audio file
 * @param {string} options.ffmpegPath - FFmpeg executable path
 * @returns {Promise<Object>} Loudness stats: { input_i, input_lra, input_tp }
 */
export async function runFFmpegLoudnorm({ audioPath, ffmpegPath = 'ffmpeg', signal }) {
  console.log('[FFmpeg Runner] Running loudnorm analysis for:', audioPath);

  const args = [
    '-i', audioPath,
    '-af', 'loudnorm=print_format=json',
    '-f', 'null',
    '-'
  ];

  console.log('[FFmpeg Runner] Running:', ffmpegPath, args.join(' '));

  try {
    const { stdout, stderr } = await execa(ffmpegPath, args, {
      windowsHide: true,
      timeout: 60000, // 1 minute timeout
      cancelSignal: signal
    });

    // FFmpeg outputs the JSON to stderr for loudnorm
    const jsonOutput = stderr;
    console.log('[FFmpeg Runner] Loudnorm output:', jsonOutput);

    // Parse the JSON output - FFmpeg outputs multi-line JSON
    const lines = jsonOutput.split('\n');
    let jsonStart = -1;
    let jsonEnd = -1;

    // Find the start of the JSON block (line with just '{')
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line === '{') {
        jsonStart = i;
        break;
      }
    }

    // Find the end of the JSON block (line with just '}')
    if (jsonStart !== -1) {
      for (let i = jsonStart; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '}') {
          jsonEnd = i;
          break;
        }
      }
    }

    if (jsonStart === -1 || jsonEnd === -1) {
      console.log('[FFmpeg Runner] JSON parsing failed. Looking for lines containing { and }:');
      lines.forEach((line, i) => {
        if (line.includes('{') || line.includes('}')) {
          console.log(`[FFmpeg Runner] Line ${i}: ${line.trim()}`);
        }
      });
      throw new Error('No loudnorm JSON found in FFmpeg output');
    }

    // Extract the complete JSON block
    const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
    const jsonString = jsonLines.join('\n');

    console.log('[FFmpeg Runner] Extracted JSON string:', jsonString);

    const loudnessData = JSON.parse(jsonString);

    console.log('[FFmpeg Runner] Parsed loudness data:', {
      input_i: loudnessData.input_i,
      input_lra: loudnessData.input_lra,
      input_tp: loudnessData.input_tp
    });

    return {
      input_i: parseFloat(loudnessData.input_i),
      input_lra: parseFloat(loudnessData.input_lra),
      input_tp: parseFloat(loudnessData.input_tp)
    };

  } catch (error) {
    console.error('[FFmpeg Runner] Loudnorm failed:', error);
    const enhancedError = new Error(`FFmpeg loudnorm failed: ${error.message}`);
    enhancedError.stderr = error.stderr || error.stdout;
    throw enhancedError;
  }
}

/**
 * Run FFmpeg loudnorm filter multiple times to get timeline loudness data
 * @param {Object} options - Configuration options
 * @param {string} options.audioPath - Path to input audio file
 * @param {string} options.ffmpegPath - FFmpeg executable path
 * @param {string} options.outputPath - Path to save timeline data
 * @returns {Promise<Array>} Timeline data: [{ time, momentary, short_term }]
 */
export async function runFFmpegEbur128({ audioPath, ffmpegPath = 'ffmpeg', outputPath, signal }) {
  console.log('[FFmpeg Runner] Running loudness timeline analysis for:', audioPath);

  try {
    // Get audio duration first
    const durationArgs = [
      '-i', audioPath,
      '-f', 'null',
      '-'
    ];

    const { stderr: durationStderr } = await execa(ffmpegPath, durationArgs, {
      windowsHide: true,
      timeout: 30000,
      cancelSignal: signal
    });

    // Extract duration from FFmpeg output
    const durationMatch = durationStderr.match(/Duration: (\d+):(\d+):(\d+\.\d+)/);
    if (!durationMatch) {
      throw new Error('Could not determine audio duration');
    }

    const hours = parseInt(durationMatch[1]);
    const minutes = parseInt(durationMatch[2]);
    const seconds = parseFloat(durationMatch[3]);
    const totalDuration = hours * 3600 + minutes * 60 + seconds;

    console.log('[FFmpeg Runner] Audio duration:', totalDuration, 'seconds');

    // Generate timeline data by analyzing segments
    const timelineData = [];
    const segmentDuration = 0.5; // 500ms segments
    const numSegments = Math.ceil(totalDuration / segmentDuration);

    for (let i = 0; i < numSegments; i++) {
      if (signal?.aborted) throw new Error('Aborted');
      const startTime = i * segmentDuration;
      const endTime = Math.min(startTime + segmentDuration, totalDuration);

      // Skip if segment is too short
      if (endTime - startTime < 0.1) break;

      try {
        const segmentArgs = [
          '-i', audioPath,
          '-ss', startTime.toString(),
          '-t', (endTime - startTime).toString(),
          '-af', 'loudnorm=print_format=json',
          '-f', 'null',
          '-'
        ];

        const { stderr: segmentStderr } = await execa(ffmpegPath, segmentArgs, {
          windowsHide: true,
          timeout: 10000,
          cancelSignal: signal
        });

        // Parse JSON from segment output
        const lines = segmentStderr.split('\n');
        let jsonStart = -1;
        let jsonEnd = -1;

        for (let j = 0; j < lines.length; j++) {
          const line = lines[j].trim();
          if (line === '{') {
            jsonStart = j;
          }
          if (jsonStart !== -1 && line === '}') {
            jsonEnd = j;
            break;
          }
        }

        if (jsonStart !== -1 && jsonEnd !== -1) {
          const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
          const jsonString = jsonLines.join('\n');

          try {
            const loudnessData = JSON.parse(jsonString);
            timelineData.push({
              time: startTime,
              momentary: parseFloat(loudnessData.input_i),
              short_term: parseFloat(loudnessData.input_i), // Use integrated as short-term approximation
              integrated: parseFloat(loudnessData.input_i)
            });
          } catch (parseError) {
            console.warn('[FFmpeg Runner] Failed to parse segment JSON:', parseError.message);
          }
        }

        // Add small delay to prevent overwhelming the system
        if (i % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 10));
        }

      } catch (segmentError) {
        console.warn('[FFmpeg Runner] Failed to analyze segment at', startTime, ':', segmentError.message);
      }
    }

    console.log('[FFmpeg Runner] Generated timeline points:', timelineData.length);

    // Save to file if outputPath provided
    if (outputPath) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(outputPath, JSON.stringify(timelineData, null, 2), 'utf-8');
      console.log('[FFmpeg Runner] Timeline data saved to:', outputPath);
    }

    return timelineData;

  } catch (error) {
    console.error('[FFmpeg Runner] Timeline analysis failed:', error);
    throw new Error(`FFmpeg timeline analysis failed: ${error.message}`);
  }
}

async function logToDesktop(message) {
  try {
    const desktopPath = path.join(os.homedir(), 'Desktop', 'ferm-stereo-debug.log');
    const timestamp = new Date().toISOString();
    await fs.appendFile(desktopPath, `[${timestamp}] ${message}\n`);
  } catch (e) {
    // Ignore logging errors
  }
}

/**
 * Run Stereo Analysis using FFmpeg
 * Measures Phase Correlation (astats) and Side/Mid integrated loudness
 * @param {Object} options - Configuration options
 * @param {string} options.audioPath - Path to input audio file
 * @param {string} options.ffmpegPath - FFmpeg executable path
 * @returns {Promise<Object>} { correlation: number, side_loudness: number, mid_loudness: number }
 */
export async function runStereoAnalysis({ audioPath, ffmpegPath = 'ffmpeg', signal }) {
  console.log('[FFmpeg Runner] Running stereo analysis for:', audioPath);
  await logToDesktop(`Starting stereo analysis for: ${audioPath}`);

  // 1. Get Phase Correlation using aphasemeter
  // Use ametadata to print to stderr instead of a file to avoid path escaping issues
  // Range is [-1, 1], same as correlation.

  let correlation = 0;
  let sideLoudness = -99;
  let midLoudness = -99;

  try {
    // Use ametadata=mode=print to output to stderr instead of a file
    // This avoids all the path escaping nightmares with absolute paths
    const phaseArgs = [
      '-i', audioPath,
      '-filter_complex', 'aphasemeter=video=0,ametadata=mode=print',
      '-f', 'null',
      '-'
    ];

    await logToDesktop(`Running FFmpeg phase analysis with args: ${phaseArgs.join(' ')}`);

    const { stderr: phaseOutput } = await execa(ffmpegPath, phaseArgs, {
      windowsHide: true,
      timeout: 60000,
      cancelSignal: signal
    });

    // Parse phase data from stderr
    const lines = phaseOutput.split('\n');
    let sum = 0;
    let count = 0;

    for (const line of lines) {
      const match = line.match(/lavfi\.aphasemeter\.phase=([-\d\.]+)/);
      if (match) {
        sum += parseFloat(match[1]);
        count++;
      }
    }

    if (count > 0) {
      correlation = sum / count;
      // Clamp to [-1, 1] just in case
      correlation = Math.max(-1, Math.min(1, correlation));
    }

    console.log(`[FFmpeg Runner] Calculated correlation from ${count} frames: ${correlation.toFixed(4)}`);
    await logToDesktop(`Calculated correlation: ${correlation} (from ${count} frames)`);

    // Side Channel Loudness
    // Side = L - R (usually 0.5*L - 0.5*R for mono downmix)
    // "pan=mono|c0=0.5*c0-0.5*c1"
    const sideArgs = [
      '-i', audioPath,
      '-af', 'pan=mono|c0=0.5*c0-0.5*c1,loudnorm=print_format=json',
      '-f', 'null',
      '-'
    ];

    await logToDesktop(`Running FFmpeg side loudness with args: ${sideArgs.join(' ')}`);

    const { stderr: sideOutput } = await execa(ffmpegPath, sideArgs, {
      windowsHide: true,
      timeout: 60000,
      cancelSignal: signal
    });

    // Extract JSON for Side
    try {
      const sideJsonStr = extractJsonFromOutput(sideOutput);
      const sideData = JSON.parse(sideJsonStr);
      sideLoudness = parseFloat(sideData.input_i);
    } catch (e) {
      console.warn('[FFmpeg Runner] Failed to parse Side loudness:', e.message);
      await logToDesktop(`Failed to parse Side loudness: ${e.message}`);
    }

    // Mid Channel Loudness
    // Mid = L + R (usually 0.5*L + 0.5*R for mono downmix)
    // "pan=mono|c0=0.5*c0+0.5*c1"
    const midArgs = [
      '-i', audioPath,
      '-af', 'pan=mono|c0=0.5*c0+0.5*c1,loudnorm=print_format=json',
      '-f', 'null',
      '-'
    ];

    await logToDesktop(`Running FFmpeg mid loudness with args: ${midArgs.join(' ')}`);

    const { stderr: midOutput } = await execa(ffmpegPath, midArgs, {
      windowsHide: true,
      timeout: 60000,
      cancelSignal: signal
    });

    // Extract JSON for Mid
    try {
      const midJsonStr = extractJsonFromOutput(midOutput);
      const midData = JSON.parse(midJsonStr);
      midLoudness = parseFloat(midData.input_i);
    } catch (e) {
      console.warn('[FFmpeg Runner] Failed to parse Mid loudness:', e.message);
      await logToDesktop(`Failed to parse Mid loudness: ${e.message}`);
    }

    console.log('[FFmpeg Runner] Stereo analysis results:', {
      correlation,
      side_loudness: sideLoudness,
      mid_loudness: midLoudness
    });

    // Run Histogram Analysis
    let histogram = null;
    try {
      histogram = await runStereoHistogramAnalysis({ audioPath, ffmpegPath, signal });
    } catch (histError) {
      console.warn('[FFmpeg Runner] Histogram analysis failed:', histError.message);
      await logToDesktop(`Histogram analysis failed: ${histError.message}`);
    }

    await logToDesktop(`Stereo analysis complete. Results: Correlation=${correlation}, Side=${sideLoudness}, Mid=${midLoudness}, Histogram=${histogram ? 'Yes' : 'No'}`);

    return {
      correlation,
      side_loudness: sideLoudness,
      mid_loudness: midLoudness,
      histogram
    };

  } catch (error) {
    console.error('[FFmpeg Runner] Stereo analysis failed:', error);
    await logToDesktop(`Stereo analysis failed: ${error.message}\nStderr: ${error.stderr || 'N/A'}`);

    // Don't throw, return partial/default data to avoid failing entire analysis
    return {
      correlation: 0,
      side_loudness: -70,
      mid_loudness: -70,
      histogram: null,
      error: error.message
    };
  }
}

/**
 * Run Stereo Histogram Analysis
 * Calculates energy distribution across stereo field (Mid/Side angles)
 * @param {Object} options
 * @returns {Promise<Array<number>>} 36-bin histogram
 */
export async function runStereoHistogramAnalysis({ audioPath, ffmpegPath = 'ffmpeg', signal }) {
  console.log('[FFmpeg Runner] Running stereo histogram analysis for:', audioPath);
  await logToDesktop(`Starting stereo histogram analysis for: ${audioPath}`);

  const args = [
    '-i', audioPath,
    '-f', 'f32le', // Raw 32-bit float PCM
    '-ac', '2',    // Force stereo
    '-ar', '44100', // Resample to 44.1k to keep data rate manageable
    '-'
  ];

  const ffmpegProcess = execa(ffmpegPath, args, {
    buffer: false,  // Stream output
    windowsHide: true,
    cancelSignal: signal
  });

  const BINS = 36;
  const histogram = new Float64Array(BINS).fill(0);

  // Stream processing
  // We need to read chunks of 8 bytes (2 channels * 4 bytes float)
  // But we'll get larger chunks from the stream

  let leftoverBuffer = null;

  for await (const chunk of ffmpegProcess.stdout) {
    let buffer = chunk;

    // Handle leftovers from previous chunk
    if (leftoverBuffer) {
      buffer = Buffer.concat([leftoverBuffer, chunk]);
      leftoverBuffer = null;
    }

    // Ensure we have complete samples (multiple of 8 bytes)
    const leftoverBytes = buffer.length % 8;
    if (leftoverBytes > 0) {
      leftoverBuffer = buffer.slice(buffer.length - leftoverBytes);
      buffer = buffer.slice(0, buffer.length - leftoverBytes);
    }

    if (buffer.length === 0) continue;

    // Process samples
    for (let i = 0; i < buffer.length; i += 8) {
      const left = buffer.readFloatLE(i);
      const right = buffer.readFloatLE(i + 4);

      // Convert to Mid/Side
      const mid = (left + right) / 2;
      const side = (left - right) / 2;

      // Calculate energy (magnitude)
      // Using squared magnitude for energy is common, or just magnitude for amplitude
      // Let's use magnitude r = sqrt(M^2 + S^2)
      const r = Math.sqrt(mid * mid + side * side);

      if (r < 0.0001) continue; // Skip silence

      // Calculate angle theta = atan2(S, M)
      // Range: -PI to +PI
      // 0 is Center (Mid only, S=0)
      // PI/2 is Side only (M=0)
      // We want to map -PI/2 (-90deg) to +PI/2 (+90deg) mostly
      // But atan2 returns full circle. 
      // In M/S:
      // M>0, S=0 -> 0 (Center)
      // M=0, S>0 -> PI/2 (Full Side +)
      // M=0, S<0 -> -PI/2 (Full Side -)
      // M<0 (Phase inverted center) -> PI or -PI

      let theta = Math.atan2(side, mid);

      // Wrap phase-inverted signals to the front for visualization simplicity?
      // Or keep them? Usually we care about the stereo image width.
      // Let's map [-PI, PI] to bins.
      // But typically stereo image is visualized as -90 to +90 degrees.
      // Values with |theta| > PI/2 imply negative correlation (M < 0).
      // We can map them to the edges or keep them.
      // Let's clamp to [-PI/2, PI/2] for a simple "width" histogram, 
      // or map the full circle.
      // The guide says "-90 to +90". This implies we might ignore phase inversion or clamp it.
      // Let's clamp for now as "Super Wide" usually just means lots of Side energy.

      // Actually, let's use the full range but focus the bins on -PI/2 to PI/2
      // If we have 36 bins covering -PI to PI, that's 10 degrees per bin.
      // Let's stick to the guide: "-90 to +90".
      // If theta is outside this range (M < 0), it's out of phase.
      // We can put it in the extreme bins or ignore.
      // Let's clamp it to [-PI/2, PI/2] to show it as "Wide".

      if (theta > Math.PI / 2) theta = Math.PI / 2;
      if (theta < -Math.PI / 2) theta = -Math.PI / 2;

      // Map -PI/2 .. +PI/2 to 0 .. BINS-1
      // Range is PI
      const normalized = (theta + Math.PI / 2) / Math.PI; // 0..1
      const binIndex = Math.floor(normalized * BINS);

      // Clamp index
      const idx = Math.max(0, Math.min(BINS - 1, binIndex));

      histogram[idx] += r;
    }
  }

  // Normalize histogram
  // Find max bin
  let maxVal = 0;
  for (let i = 0; i < BINS; i++) {
    if (histogram[i] > maxVal) maxVal = histogram[i];
  }

  const result = [];
  if (maxVal > 0) {
    for (let i = 0; i < BINS; i++) {
      result.push(Number((histogram[i] / maxVal).toFixed(4)));
    }
  } else {
    for (let i = 0; i < BINS; i++) result.push(0);
  }

  console.log(`[FFmpeg Runner] Histogram generated with ${BINS} bins`);
  await logToDesktop(`Histogram generated. Max value: ${maxVal}`);

  return result;
}

/**
 * Helper to extract JSON block from FFmpeg stderr output
 */
function extractJsonFromOutput(output) {
  const lines = output.split('\n');
  let jsonStart = -1;
  let jsonEnd = -1;

  // Find last occurrence of JSON block to be safe (sometimes multiple filters print)
  // Actually loudnorm usually prints at end.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (line === '{') {
      jsonStart = i;
    }
    if (jsonStart !== -1 && line === '}') {
      jsonEnd = i;
    }
  }

  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('No JSON found in output');
  }

  const jsonLines = lines.slice(jsonStart, jsonEnd + 1);
  return jsonLines.join('\n');
}

/**
 * Preprocess audio for openSMILE: convert to mono and resample to 16kHz
 * @param {Object} options - Configuration options
 * @param {string} options.inputPath - Path to input audio file
 * @param {string} options.outputPath - Path to save preprocessed audio
 * @param {string} options.ffmpegPath - FFmpeg executable path
 * @returns {Promise<string>} Path to preprocessed audio file
 */
export async function preprocessForOpenSMILE({ inputPath, outputPath, ffmpegPath = 'ffmpeg' }) {
  console.log('[FFmpeg Runner] Preprocessing for openSMILE:', inputPath);

  const args = [
    '-i', inputPath,
    '-ac', '1',        // Convert to mono
    '-ar', '16000',    // Resample to 16kHz
    '-y',              // Overwrite output file
    outputPath
  ];

  console.log('[FFmpeg Runner] Running:', ffmpegPath, args.join(' '));

  try {
    const { stdout, stderr } = await execa(ffmpegPath, args, {
      windowsHide: true,
      timeout: 60000 //1 minute timeout
    });

    console.log('[FFmpeg Runner] Preprocessing complete:', outputPath);
    return outputPath;

  } catch (error) {
    console.error('[FFmpeg Runner] Preprocessing failed:', error);
    throw new Error(`FFmpeg preprocessing failed: ${error.message}`);
  }
}

/**
 * Check if FFmpeg is available
 * @param {string} ffmpegPath - FFmpeg executable path
 * @returns {Promise<boolean>} True if available
 */
export async function checkFFmpegAvailability(ffmpegPath = 'ffmpeg') {
  try {
    // If ffmpegPath is just 'ffmpeg', try to find it in PATH
    const executable = ffmpegPath === 'ffmpeg' ? 'ffmpeg' : ffmpegPath;
    console.log('[FFmpeg Runner] Checking FFmpeg availability at:', executable);
    await execa(executable, ['-version'], { windowsHide: true, timeout: 10000 });
    console.log('[FFmpeg Runner] FFmpeg is available');
    return true;
  } catch (error) {
    console.log('[FFmpeg Runner] FFmpeg availability check failed:', error.message);
    console.log('[FFmpeg Runner] Error details:', error);

    // Enhanced diagnostics for Windows paths
    if (process.platform === 'win32' && ffmpegPath !== 'ffmpeg' && ffmpegPath.includes('\\')) {
      console.error('[FFmpeg Runner] ===== DIAGNOSTIC INFORMATION =====');
      console.error('[FFmpeg Runner] Original path:', ffmpegPath);
      console.error('[FFmpeg Runner] Executable path:', executable);
      console.error('[FFmpeg Runner] Path length:', executable.length, 'characters');

      // Check path length (Windows MAX_PATH is 260)
      if (executable.length > 260) {
        console.error('[FFmpeg Runner] ⚠️  PATH TOO LONG: Windows MAX_PATH limit is 260 characters');
        console.error('[FFmpeg Runner]    Current path exceeds limit by', executable.length - 260, 'characters');
        console.error('[FFmpeg Runner]    Solutions:');
        console.error('[FFmpeg Runner]      1. Enable Windows long path support (requires admin + restart)');
        console.error('[FFmpeg Runner]      2. Create a symlink to a shorter path');
        console.error('[FFmpeg Runner]      3. Add FFmpeg bin directory to PATH and leave FFMPEG_PATH empty');
      }

      // Check if file exists
      try {
        const stats = await fs.stat(executable);
        console.error('[FFmpeg Runner] ✓ File exists');
        console.error('[FFmpeg Runner]   File size:', stats.size, 'bytes');
        console.error('[FFmpeg Runner]   Is file:', stats.isFile());
        console.error('[FFmpeg Runner]   Is directory:', stats.isDirectory());

        // Try normalized path
        const normalizedPath = path.resolve(executable);
        console.error('[FFmpeg Runner] Normalized path:', normalizedPath);
        console.error('[FFmpeg Runner] Normalized path length:', normalizedPath.length);

        if (normalizedPath !== executable) {
          console.error('[FFmpeg Runner] ⚠️  Path differs from normalized version');
          console.error('[FFmpeg Runner]    Trying normalized path...');
          try {
            await execa(normalizedPath, ['-version'], { windowsHide: true, timeout: 10000 });
            console.error('[FFmpeg Runner] ✓ Normalized path works!');
            console.error('[FFmpeg Runner]    Consider updating config to use:', normalizedPath);
            return true;
          } catch (normError) {
            console.error('[FFmpeg Runner] ✗ Normalized path also failed:', normError.message);
          }
        }
      } catch (fsError) {
        if (fsError.code === 'ENOENT') {
          console.error('[FFmpeg Runner] ✗ FILE NOT FOUND');
          console.error('[FFmpeg Runner]   The file does not exist at the specified path');
          console.error('[FFmpeg Runner]   Please verify:');
          console.error('[FFmpeg Runner]     1. The path in config/windows.env is correct');
          console.error('[FFmpeg Runner]     2. FFmpeg is installed at that location');
          console.error('[FFmpeg Runner]     3. The path uses correct backslashes for Windows');
        } else {
          console.error('[FFmpeg Runner] ✗ File system error:', fsError.code, fsError.message);
        }
      }

      // Check error type
      if (error.message && error.message.includes('cannot find the path')) {
        console.error('[FFmpeg Runner] ⚠️  Windows "cannot find the path" error');
        console.error('[FFmpeg Runner]    Common causes:');
        console.error('[FFmpeg Runner]      - Path too long (>260 chars)');
        console.error('[FFmpeg Runner]      - Invalid characters in path');
        console.error('[FFmpeg Runner]      - Missing directory in path');
        console.error('[FFmpeg Runner]      - Permissions issue');
      }

      if (error.exitCode !== undefined) {
        console.error('[FFmpeg Runner] Exit code:', error.exitCode);
      }

      if (error.stderr) {
        console.error('[FFmpeg Runner] Stderr:', error.stderr.slice(0, 500));
      }

      console.error('[FFmpeg Runner] ====================================');
      console.error('[FFmpeg Runner] RECOMMENDED FIXES:');
      console.error('[FFmpeg Runner]   1. Test manually in PowerShell:');
      console.error('[FFmpeg Runner]      & "' + executable + '" -version');
      console.error('[FFmpeg Runner]   2. If manual test works, try adding to PATH:');
      console.error('[FFmpeg Runner]      Set FFMPEG_PATH= in config/windows.env (empty)');
      console.error('[FFmpeg Runner]      Add bin directory to system PATH');
      console.error('[FFmpeg Runner]   3. If path is too long, create symlink:');
      console.error('[FFmpeg Runner]      New-Item -ItemType SymbolicLink -Path "C:\\Tools\\ffmpeg" -Target "' + path.dirname(executable) + '"');
    }

    return false;
  }
}
