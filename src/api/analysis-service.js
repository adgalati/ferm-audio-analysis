import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execa } from 'execa';
import { loadWindowsEnv } from '../utils/env.js';
import { runSonicAnnotator } from '../runners/sonic.js';
import { runOpenSmile } from '../runners/smile.js';
import { runDemucs, checkDemucsAvailability } from '../runners/demucs.js';
import { runFFmpegLoudnorm, runFFmpegEbur128, runStereoAnalysis, checkFFmpegAvailability, preprocessForOpenSMILE } from '../runners/ffmpeg.js';
import { runMAEST, checkMAESTAvailability } from '../runners/maest.js';
import { parseTimesCsv } from '../parsers/beats.js';
import { parseChordsCsv } from '../parsers/chords.js';
import { parseMelodiaCsv } from '../parsers/melody.js';
import { parsePyinPitchCsv, parsePyinNotesCsv } from '../parsers/pyin.js';
import { parseSmileCsv } from '../parsers/smile.js';
import { parseLoudnormJson, parseEbur128Timeline, calculateLoudnessStats, calculateStemDelta } from '../parsers/loudness.js';
import { parseMAESTOutput } from '../parsers/maest.js';
import { parseSpectralContrastCsv, parseSpectralFluxCsv, parseEnergyCsv, computeSpectralSnapshot } from '../parsers/spectral.js';
import { detectSubdivision, timingStats, timingScore } from '../utils/timing.js';
import { calculateVocalScores } from '../utils/vocal-scoring.js';
import { createVoicingGate } from '../utils/voicing-gating.js';
import { calculateEnhancedKeyFitScore, detectKeyFromChords, getScaleNotes } from '../utils/key-analysis.js';
import { fusePitchTracks } from '../utils/pitch-fusion.js';
import {
  calculateFrequencyBands,
  calculateGenreFitScore,
  getBestMatchingGenre,
  normalizeSpectralData,
  resolveGenreKey,
  GENRE_SPECTRAL_PROFILES
} from '../utils/spectral-analysis.js';

const MAEST_VERSIONS = {
  'mtg-upf/discogs-maest-30s-pw-129e': 'maest_v1'
};

let PLUGINS = null;
let env = null;

async function loadConfig() {
  if (!PLUGINS) {
    PLUGINS = JSON.parse(await fs.readFile('config/plugins.json', 'utf-8'));
  }
  if (!env) {
    env = loadWindowsEnv();
  }
}

function ensurePath(p, name) {
  if (!p) throw new Error(`Missing path for ${name}. Check config/windows.env`);
  return p;
}

async function runPlugin(pluginId, audioPath, sonicExe, vampPath, options = {}) {
  const csv = await runSonicAnnotator({
    exe: sonicExe,
    pluginPath: vampPath,
    pluginId,
    audioPath,
    signal: options.signal
  });
  return csv;
}

function calculateTimingMetrics(onsets, beats) {
  if (!onsets || !beats || onsets.length === 0 || beats.length === 0) {
    return { mate_ms: 0, bias_ms: 0, subdivision: null };
  }

  // Detect the best subdivision for timing analysis
  const { n, period } = detectSubdivision(beats, onsets);

  // Calculate timing stats against the detected subdivision
  const stats = timingStats(beats, onsets, n, period);

  return {
    mate_ms: stats.mate_ms,
    bias_ms: stats.bias_ms,
    subdivision: { n, period },
    devs_ms: stats.devs_ms
  };
}

function calculateKeyFitScore(melody, chords) {
  // Use enhanced key fit calculation
  const result = calculateEnhancedKeyFitScore(melody, chords);

  if (!result.score) {
    return null;
  }

  // Return the in-key percentage as the score (0-100)
  return result.score;
}

function calculateStereoWidthScore(sideLoudness, midLoudness) {
  // difference = Side - Mid (in LUFS/dB)
  // Usually Side is quieter than Mid.
  // If Side == Mid, difference is 0.
  // If Side is -6dB vs Mid, difference is -6.
  const diff = sideLoudness - midLoudness;

  // Score mapping:
  // diff <= -20: 0 (Very Narrow/Mono)
  // diff == -6: 50 (Standard Stereo)
  // diff >= 0: 80+ (Very Wide)

  // Simple linear mapping: score = 80 + (diff * 4)
  // Clamped between 0 and 100.
  // Examples:
  // diff 0 -> 80
  // diff -6 -> 56
  // diff -12 -> 32
  // diff -20 -> 0
  // diff +5 -> 100

  let score = 80 + (diff * 4);
  score = Math.max(0, Math.min(100, score));

  let description = 'Unknown';
  if (score < 20) description = 'Mono / Very Narrow';
  else if (score < 40) description = 'Narrow Stereo';
  else if (score < 60) description = 'Standard Stereo';
  else if (score < 80) description = 'Wide Stereo';
  else description = 'Super Wide / Immersive';

  return {
    score: Math.round(score),
    description
  };
}

export async function analyzeAudio({ audioPath, analyses = ['rhythm', 'harmony', 'melody', 'spectral'], enableSmile = false, useStems = false, onProgress, signal }) {
  console.log('[Analysis Service] Starting analysis for:', audioPath);
  console.log('[Analysis Service] Requested analyses:', analyses);

  try {
    await loadConfig();
    console.log('[Analysis Service] Config loaded');
  } catch (error) {
    console.error('[Analysis Service] Failed to load config:', error);
    throw error;
  }

  console.log('[Analysis Service] Environment variables:', {
    SONIC_ANNOTATOR_EXE: env.SONIC_ANNOTATOR_EXE,
    VAMP_PATH: env.VAMP_PATH,
    OPENSMILE_EXE: env.OPENSMILE_EXE,
    FFMPEG_PATH: env.FFMPEG_PATH
  });

  const SONIC = ensurePath(env.SONIC_ANNOTATOR_EXE, 'SONIC_ANNOTATOR_EXE');
  const VAMP_PATH = ensurePath(env.VAMP_PATH, 'VAMP_PATH');
  const OPENSMILE = env.OPENSMILE_EXE;
  const OPENSMILE_CONFIG = env.OPENSMILE_CONFIG;
  const FFMPEG = env.FFMPEG_PATH;

  const audio = path.resolve(audioPath);
  console.log('[Analysis Service] Resolved audio path:', audio);

  // Determine audio paths for analysis
  let instrumentalPath = audio;
  let vocalPath = audio;
  let stemsUsed = false;

  if (useStems) {
    // Check if Demucs is available
    const demucsAvailable = await checkDemucsAvailability(env.DEMUCS_CMD);

    if (demucsAvailable) {
      try {
        const throwIfAborted = () => {
          if (signal?.aborted) {
            const err = new Error('Analysis aborted');
            err.name = 'AbortError';
            throw err;
          }
        };
        throwIfAborted();
        console.log('[Analysis Service] Running Demucs stem separation...');
        const stems = await runDemucs({
          audioPath: audio,
          demucsCmd: env.DEMUCS_CMD,
          demucsArgs: env.DEMUCS_ARGS,
          device: env.DEMUCS_DEVICE,
          outDir: env.DEMUCS_OUTDIR,
          ffmpegPath: env.FFMPEG_PATH,
          onProgress,
          signal
        });
        throwIfAborted();
        instrumentalPath = stems.instrumental;
        vocalPath = stems.vocals;
        stemsUsed = true;

        console.log('[Analysis Service] Using stems - Instrumental:', instrumentalPath);
        console.log('[Analysis Service] Using stems - Vocals:', vocalPath);
      } catch (error) {
        console.warn('[Analysis Service] Demucs failed, falling back to full mix:', error.message);
        // Fall back to original audio
      }
    } else {
      console.warn('[Analysis Service] Demucs not available, using full mix');
    }
  }

  const result = {
    file: audio,
    stemsUsed,
    instrumentalPath,
    vocalPath,
    rhythm: null,
    harmony: null,
    melody: null,
    onsets: null,
    smile: null,
    loudness: null,
    autotagging: null,
    spectral: null,
    spatial: null,
    scores: {}
  };

  // Weighted progress for smoother updates
  const stepWeights = [];
  analyses.includes('rhythm') && stepWeights.push(20);
  analyses.includes('harmony') && stepWeights.push(15);
  analyses.includes('melody') && stepWeights.push(20);
  analyses.includes('spectral') && stepWeights.push(10);
  enableSmile && analyses.includes('timbre') && stepWeights.push(15);
  analyses.includes('loudness') && FFMPEG && stepWeights.push(20);
  analyses.includes('spatial') && FFMPEG && stepWeights.push(15);
  analyses.includes('autotagging') && stepWeights.push(10);
  const totalWeight = stepWeights.reduce((a, b) => a + b, 0) || 100;
  let completedWeight = 0;

  const updateProgress = (message, weight = 0) => {
    completedWeight += weight;
    const percent = Math.max(0, Math.min(100, Math.round((completedWeight / totalWeight) * 100)));
    onProgress && onProgress({ percent, message });
  };

  const throwIfAborted = () => {
    if (signal?.aborted) {
      const err = new Error('Analysis aborted');
      err.name = 'AbortError';
      throw err;
    }
  };

  // Rhythm Analysis
  if (analyses.includes('rhythm')) {
    throwIfAborted();
    onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Extracting rhythm features...' });

    // Analyze instrumental rhythm (beats/bars for beat grid)
    const instrumentalBeatsCsv = await runPlugin(PLUGINS.qm.beats, instrumentalPath, SONIC, VAMP_PATH, { signal });
    throwIfAborted();
    const instrumentalBarsCsv = await runPlugin(PLUGINS.qm.bars, instrumentalPath, SONIC, VAMP_PATH, { signal });

    // Analyze vocal rhythm (onsets for vocal timing)
    throwIfAborted();
    const vocalOnsetsCsv = await runPlugin(PLUGINS.qm.onsets, vocalPath, SONIC, VAMP_PATH, { signal });

    // If stems are used, also analyze vocal beats for comparison
    let vocalBeatsCsv = null;
    if (stemsUsed) {
      try {
        throwIfAborted();
        vocalBeatsCsv = await runPlugin(PLUGINS.qm.beats, vocalPath, SONIC, VAMP_PATH, { signal });
      } catch (error) {
        console.warn('[Analysis Service] Failed to extract vocal beats:', error.message);
      }
    }

    const instrumentalBeats = parseTimesCsv(instrumentalBeatsCsv);
    const instrumentalDownbeats = parseTimesCsv(instrumentalBarsCsv);
    const vocalOnsets = parseTimesCsv(vocalOnsetsCsv);
    const vocalBeats = vocalBeatsCsv ? parseTimesCsv(vocalBeatsCsv) : null;

    console.log('[Analysis Service] Parsed rhythm:', {
      instrumentalBeats: instrumentalBeats.length,
      instrumentalDownbeats: instrumentalDownbeats.length,
      vocalOnsets: vocalOnsets.length,
      vocalBeats: vocalBeats?.length || 0,
      stemsUsed,
      sample: instrumentalBeats.slice(0, 5)
    });

    // Compute robust tempo from median inter-beat interval (use instrumental beats as primary)
    const tempo_bpm = (() => {
      const beatsToUse = instrumentalBeats.length > 0 ? instrumentalBeats : vocalBeats;
      if (!beatsToUse || beatsToUse.length < 2) return null;

      const intervals = [];
      for (let i = 1; i < beatsToUse.length; i++) {
        const interval = beatsToUse[i] - beatsToUse[i - 1];
        // Filter reasonable intervals (20-240 BPM range)
        if (interval > 0.25 && interval < 3.0) {
          intervals.push(interval);
        }
      }
      if (intervals.length === 0) return null;

      intervals.sort((a, b) => a - b);
      const mid = Math.floor(intervals.length / 2);
      const med = intervals.length % 2 === 0 ?
        (intervals[mid - 1] + intervals[mid]) / 2 :
        intervals[mid];

      if (!med || med <= 0) return null;
      return 60 / med;
    })();

    // Store rhythm data with clear separation
    result.rhythm = {
      beats: instrumentalBeats,           // Primary beat grid from instrumental
      downbeats: instrumentalDownbeats,   // Downbeats from instrumental
      tempo_bpm,
      vocalBeats: vocalBeats             // Vocal beats for comparison (if available)
    };
    result.onsets = vocalOnsets;          // Vocal onsets for timing analysis

    updateProgress('Rhythm analysis complete', 20);
  }

  // Harmony Analysis
  if (analyses.includes('harmony')) {
    throwIfAborted();
    onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Analyzing harmony...' });

    const chordCsv = await runPlugin(PLUGINS.chordino.simple, instrumentalPath, SONIC, VAMP_PATH, { signal });
    const chords = parseChordsCsv(chordCsv);

    console.log('[Analysis Service] Parsed chords count:', chords.length, 'sample:', chords.slice(0, 3));
    result.harmony = { chords };

    updateProgress('Harmony analysis complete', 15);
  }

  // Melody Analysis (CREPE Vamp with optional pYIN fusion; gracefully skip if unavailable)
  if (analyses.includes('melody')) {
    throwIfAborted();
    onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Extracting melody...' });
    try {
      const crepeIds = (PLUGINS.melody?.plugins || []).filter(Boolean);
      let melCsv = null;
      for (const pid of crepeIds) {
        try {
          throwIfAborted();
          melCsv = await runPlugin(pid, vocalPath, SONIC, VAMP_PATH, { signal });
          if (melCsv) break;
        } catch (_) { }
      }
      if (!melCsv) throw new Error('No CREPE plugin available');
      const melody = parseMelodiaCsv(melCsv);
      console.log('[Analysis Service] Parsed CREPE melody points:', melody.f0_hz?.length, 'sample:', {
        t: melody.times?.slice(0, 5), f0: melody.f0_hz?.slice(0, 5)
      });

      // Attempt pYIN fusion if available
      let finalMelody = melody;
      try {
        if (PLUGINS.melody?.pyin?.pitch) {
          console.log('[Analysis Service] Attempting pYIN pitch...', {
            pluginId: PLUGINS.melody.pyin.pitch,
            vampPath: VAMP_PATH,
            vocalPath
          });

          // Sanity: check vocalPath exists before invoking plugin
          try {
            const st = await fs.stat(vocalPath);
            console.log('[Analysis Service] Vocal path exists:', { size: st.size });
          } catch (fsErr) {
            console.warn('[Analysis Service] Vocal path missing or unreadable for pYIN:', fsErr.message);
          }

          throwIfAborted();
          const pyinPitchCsv = await runPlugin(PLUGINS.melody.pyin.pitch, vocalPath, SONIC, VAMP_PATH, { signal });

          // Lightly log the start of the CSV to diagnose headers/columns
          const preview = (pyinPitchCsv || '').split(/\r?\n/).slice(0, 5).join('\n');
          console.log('[Analysis Service] pYIN pitch CSV preview (first 5 lines):\n' + preview);

          const pyinTrack = parsePyinPitchCsv(pyinPitchCsv);

          // Optional: attempt to read notes but DO NOT REQUIRE them
          let pyinNotes = [];
          if (PLUGINS.melody?.pyin?.notes) {
            try {
              console.log('[Analysis Service] Attempting pYIN notes...', { pluginId: PLUGINS.melody.pyin.notes });
              throwIfAborted();
              const pyinNotesCsv = await runPlugin(PLUGINS.melody.pyin.notes, vocalPath, SONIC, VAMP_PATH, { signal });
              const notesPreview = (pyinNotesCsv || '').split(/\r?\n/).slice(0, 5).join('\n');
              console.log('[Analysis Service] pYIN notes CSV preview (first 5 lines):\n' + notesPreview);
              pyinNotes = parsePyinNotesCsv(pyinNotesCsv);
            } catch (noteErr) {
              console.warn('[Analysis Service] pYIN notes unavailable/failed; continuing without notes:', noteErr?.message);
            }
          }

          console.log('[Analysis Service] pYIN parsed summary:', {
            pitchFrames: pyinTrack?.times?.length || 0,
            voicedFrames: (pyinTrack?.voicedProb || []).filter(v => v >= 0.5).length,
            nonZeroF0: (pyinTrack?.f0_hz || []).filter(f => f > 0).length,
            noteEvents: pyinNotes?.length || 0
          });

          if (!pyinTrack?.times?.length) {
            console.warn('[Analysis Service] pYIN track has 0 frames. Check VAMP_PATH and plugin ID. Falling back to CREPE only.');
          } else if ((pyinTrack.f0_hz || []).every(f => f <= 0)) {
            console.warn('[Analysis Service] pYIN pitch returned only zeros. Possible unvoiced output or incompatible CSV format.');
          } else {
            // Fuse CREPE and pYIN tracks
            finalMelody = fusePitchTracks({
              crepe: melody,
              pyinTrack,
              pyinNotes
            });
            console.log('[Analysis Service] Fusion complete; using fused melody with', {
              frames: finalMelody.times.length,
              voicedFrames: finalMelody.f0_hz.filter(f => f > 0).length,
              notes: finalMelody.notes?.length || 0
            });
          }
        } else {
          console.log('[Analysis Service] pYIN pitch plugin ID not configured; skipping pYIN');
        }
      } catch (pyinError) {
        console.warn('[Analysis Service] pYIN fusion failed, using CREPE only:', pyinError?.message);
        // Fall back to CREPE alone; finalMelody already set above
      }

      result.melody = finalMelody;
      updateProgress('Melody analysis complete', 20);
    } catch (e) {
      console.warn('[Analysis Service] Melody plugin unavailable or failed. Skipping melody.', e?.message);
      result.melody = null;
      onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Melody plugin missing — skipped' });
    }
  }

  // Vocal Analysis (openSMILE)
  if (analyses.includes('timbre') && enableSmile) {
    if (!OPENSMILE || !OPENSMILE_CONFIG) {
      console.warn('openSMILE requested but not configured');
    } else {
      try {
        throwIfAborted();
        onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Analyzing vocal quality...' });

        const smileOut = path.resolve('tmp', `egemaps_${Date.now()}.csv`);
        await fs.mkdir('tmp', { recursive: true });

        // Preprocess audio for openSMILE: convert to mono/16kHz
        const ffmpegExe = path.join(FFMPEG, 'ffmpeg.exe');
        const preprocessedPath = path.resolve('tmp', `vocal_mono16k_${Date.now()}.wav`);

        console.log('[Analysis Service] Preprocessing vocal track for openSMILE...');
        await preprocessForOpenSMILE({
          inputPath: vocalPath,
          outputPath: preprocessedPath,
          ffmpegPath: ffmpegExe,
          signal
        });

        // Create voicing gate if melody analysis was performed
        let frameModeInclude = null;
        if (result.melody && result.melody.times && result.melody.confidence) {
          console.log('[Analysis Service] Creating voicing gate from CREPE data...');
          frameModeInclude = await createVoicingGate(result.melody, 'tmp');
        }

        // Run OpenSMILE on preprocessed vocal track
        throwIfAborted();
        await runOpenSmile({
          exe: OPENSMILE,
          config: OPENSMILE_CONFIG,
          audioPath: preprocessedPath,
          csvOutPath: smileOut,
          frameModeInclude,
          signal
        });

        // Clean up preprocessed file
        try {
          await fs.unlink(preprocessedPath);
        } catch (cleanupError) {
          console.warn('[Analysis Service] Failed to cleanup preprocessed file:', cleanupError.message);
        }

        // Parse CSV and calculate vocal scores
        const csvContent = await fs.readFile(smileOut, 'utf-8');
        const smileData = parseSmileCsv(csvContent);
        const vocalScores = calculateVocalScores(smileData.vocal);

        result.smile = {
          egemaps: {
            csv: smileOut,
            features: smileData.vocal,
            scores: vocalScores
          }
        };

        console.log('[Analysis Service] Vocal analysis complete:', {
          pitch_stability: vocalScores?.pitch_stability,
          dynamic_control: vocalScores?.dynamic_control,
          voice_quality: vocalScores?.voice_quality,
          overall: vocalScores?.overall,
          voicing_gated: !!frameModeInclude
        });

        updateProgress('Vocal analysis complete', 15);
      } catch (error) {
        console.warn('[Analysis Service] OpenSMILE failed, skipping vocal analysis:', error.message);
        result.smile = null;
        updateProgress('Vocal analysis skipped (OpenSMILE error)', 15);
      }
    }
  }

  // Loudness Analysis (FFmpeg) - only if explicitly requested
  if (analyses.includes('loudness') && FFMPEG) {
    try {
      throwIfAborted();
      onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Analyzing loudness...' });

      const ffmpegExe = path.join(FFMPEG, 'ffmpeg.exe');
      console.log('[Analysis Service] Constructed FFmpeg path:', ffmpegExe);

      // Test direct execa call first
      try {
        const { execa } = await import('execa');
        console.log('[Analysis Service] Testing direct execa call...');
        await execa(ffmpegExe, ['-version'], { windowsHide: true, timeout: 10000 });
        console.log('[Analysis Service] Direct execa call succeeded');
      } catch (error) {
        console.log('[Analysis Service] Direct execa call failed:', error.message);
      }

      const ffmpegAvailable = await checkFFmpegAvailability(ffmpegExe);
      if (ffmpegAvailable) {
        console.log('[Analysis Service] Running FFmpeg loudness analysis...');

        // Global loudness stats for main audio
        const globalLoudness = await runFFmpegLoudnorm({
          audioPath: audio,
          ffmpegPath: ffmpegExe,
          signal
        });

        let stemLoudness = null;
        let stemDelta = null;

        // Per-stem analysis if stems are available (either flagged or paths differ from main audio)
        const haveDistinctStemPaths = (vocalPath && instrumentalPath && (vocalPath !== audio || instrumentalPath !== audio));
        if (stemsUsed || haveDistinctStemPaths) {
          console.log('[Analysis Service] Analyzing stem loudness...');

          throwIfAborted();
          const vocalLoudness = await runFFmpegLoudnorm({
            audioPath: vocalPath,
            ffmpegPath: ffmpegExe,
            signal
          });

          throwIfAborted();
          const instrumentalLoudness = await runFFmpegLoudnorm({
            audioPath: instrumentalPath,
            ffmpegPath: ffmpegExe,
            signal
          });

          stemLoudness = {
            vocals: vocalLoudness,
            instrumental: instrumentalLoudness
          };

          stemDelta = calculateStemDelta(vocalLoudness, instrumentalLoudness);
        }

        // Optional: Timeline analysis for visualization
        let timelineData = null;
        try {
          const timelinePath = path.resolve('tmp', `loudness_timeline_${Date.now()}.json`);
          await fs.mkdir('tmp', { recursive: true });

          throwIfAborted();
          timelineData = await runFFmpegEbur128({
            audioPath: audio,
            ffmpegPath: ffmpegExe,
            outputPath: timelinePath,
            signal
          });

          const timelineStats = calculateLoudnessStats(timelineData);

          result.loudness = {
            global: globalLoudness,
            stems: stemLoudness,
            stem_delta: stemDelta,
            timeline: {
              data: timelineData,
              stats: timelineStats,
              file: timelinePath
            }
          };

        } catch (timelineError) {
          console.warn('[Analysis Service] Timeline analysis failed, using global stats only:', timelineError.message);
          result.loudness = {
            global: globalLoudness,
            stems: stemLoudness,
            stem_delta: stemDelta,
            timeline: null
          };
        }

        console.log('[Analysis Service] Loudness analysis complete:', {
          global_lufs: globalLoudness.input_i,
          global_lra: globalLoudness.input_lra,
          global_tp: globalLoudness.input_tp,
          stem_delta: stemDelta?.lufs_delta,
          staging: stemDelta?.staging_assessment
        });

        updateProgress('Loudness analysis complete', 20);
      } else {
        console.warn('[Analysis Service] FFmpeg not available, skipping loudness analysis');
        result.loudness = null;
      }
    } catch (error) {
      console.error('[Analysis Service] Loudness analysis failed:', error);
      console.error('[Analysis Service] Error details:', error.message);
      if (error.stderr) {
        console.error('[Analysis Service] FFmpeg stderr:', error.stderr);
      }
      result.loudness = null;
      updateProgress('Loudness analysis skipped (FFmpeg error)', 20);
    }
  } else if (analyses.includes('loudness') && !FFMPEG) {
    console.warn('[Analysis Service] FFmpeg path not configured, skipping loudness analysis');
    result.loudness = null;
  }

  // Spatial/Stereo Analysis
  if (analyses.includes('spatial') && FFMPEG) {
    try {
      throwIfAborted();
      onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Analyzing stereo field...' });

      const ffmpegExe = path.join(FFMPEG, 'ffmpeg.exe');

      // Use full mix for spatial analysis, NOT stems
      const stereoData = await runStereoAnalysis({
        audioPath: audio, // Always use original audio for stereo analysis
        ffmpegPath: ffmpegExe,
        signal
      });

      const widthScore = calculateStereoWidthScore(stereoData.side_loudness, stereoData.mid_loudness);

      result.spatial = {
        phaseCorrelation: stereoData.correlation,
        sideLoudness: stereoData.side_loudness,
        midLoudness: stereoData.mid_loudness,
        widthScore: widthScore.score,
        widthDescription: widthScore.description,
        histogram: stereoData.histogram
      };

      console.log('[Analysis Service] Spatial analysis complete:', result.spatial);

      updateProgress('Stereo analysis complete', 15);

    } catch (error) {
      console.error('[Analysis Service] Spatial analysis failed:', error);
      result.spatial = null;
      updateProgress('Spatial analysis skipped (error)', 15);
    }
  }

  // Auto-Tagging Analysis (MAEST)
  if (analyses.includes('autotagging')) {
    throwIfAborted();
    try {
      onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Running genre classification...' });

      const MAEST_PYTHON = env.MAEST_PYTHON_PATH;
      const MAEST_CLI = env.MAEST_CLI_PATH;
      const MAEST_TOP_K = parseInt(env.MAEST_TOP_K) || 7;

      if (!MAEST_PYTHON || !MAEST_CLI) {
        console.warn('[Analysis Service] MAEST requested but not configured');
        result.autotagging = null;
      } else {
        const maestAvailable = await checkMAESTAvailability(MAEST_PYTHON, MAEST_CLI);

        if (maestAvailable) {
          console.log('[Analysis Service] Running MAEST genre classification...');

          // Prepare for embedding extraction - use configurable path for production compatibility
          const embeddingsBase = env.EMBEDDINGS_PATH || path.resolve('data', 'embeddings');
          const embeddingId = randomUUID();
          const tempDir = path.join(embeddingsBase, 'temp');
          await fs.mkdir(tempDir, { recursive: true });
          const tempEmbeddingPath = path.join(tempDir, `${embeddingId}.npy`);

          // Use full mix for genre classification (not stems)
          throwIfAborted();
          const maestResult = await runMAEST({
            audioPath: audio,
            topK: MAEST_TOP_K,
            pythonPath: MAEST_PYTHON,
            cliPath: MAEST_CLI,
            saveEmbeddingPath: tempEmbeddingPath,
            signal
          });

          // Handle embedding file storage and versioning
          let finalEmbeddingPath = null;
          if (maestResult.embedding_saved_to) {
            try {
              const modelId = maestResult.model;
              // Determine version folder: use mapped version or default to maest_v2 for new/unknown models
              const versionFolder = MAEST_VERSIONS[modelId] || 'maest_v2';

              const finalDir = path.join(embeddingsBase, versionFolder);
              await fs.mkdir(finalDir, { recursive: true });

              const targetPath = path.join(finalDir, `${embeddingId}.npy`);
              await fs.rename(tempEmbeddingPath, targetPath);

              // Store the absolute path for consistency across dev/production
              finalEmbeddingPath = targetPath;
              console.log('[Analysis Service] Embedding saved to:', finalEmbeddingPath);
            } catch (err) {
              console.warn('[Analysis Service] Failed to move embedding file:', err.message);
              // Fallback: if move failed, maybe keep temp path or null?
              // If rename failed, file is still at tempEmbeddingPath
            }
          }

          const parsedResult = parseMAESTOutput(JSON.stringify(maestResult));

          result.autotagging = {
            model: parsedResult.model,
            tags: parsedResult.results,
            timestamp: parsedResult.timestamp,
            embeddingPath: finalEmbeddingPath,
            hiphop_substyle: maestResult.hiphop_substyle
          };

          console.log('[Analysis Service] MAEST classification complete:', {
            model: parsedResult.model,
            numTags: parsedResult.results.length,
            topTag: parsedResult.results[0]
          });

          updateProgress('Genre classification complete', 10);
        } else {
          console.warn('[Analysis Service] MAEST not available, skipping auto-tagging');
          result.autotagging = null;
          updateProgress('Auto-tagging skipped (MAEST not available)', 10);
        }
      }
    } catch (error) {
      console.error('[Analysis Service] MAEST classification failed:', error);
      result.autotagging = null;
      updateProgress('Auto-tagging skipped (MAEST error)', 10);
    }
  }

  // Spectral Analysis (BBC Vamp plugins)
  if (analyses.includes('spectral')) {
    throwIfAborted();
    onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Loading spectral plugins…' });
    onProgress && onProgress({ percent: Math.round((completedWeight / totalWeight) * 100), message: 'Analyzing spectral characteristics…' });

    try {
      // Run spectral analysis plugins in parallel
      const [contrastCsv, fluxCsv, energyCsv] = await Promise.all([
        runPlugin(PLUGINS.spectral.contrast_mean, audio, SONIC, VAMP_PATH, { signal }),
        runPlugin(PLUGINS.spectral.flux, audio, SONIC, VAMP_PATH, { signal }),
        runPlugin(PLUGINS.spectral.energy, audio, SONIC, VAMP_PATH, { signal })
      ]);

      // Parse the CSV results
      const contrastData = parseSpectralContrastCsv(contrastCsv);
      const fluxData = parseSpectralFluxCsv(fluxCsv);
      const energyData = parseEnergyCsv(energyCsv);

      let ltas = null;
      try {
        const python = env.MAEST_PYTHON_PATH || 'python';

        // Calculate absolute path to ltas.py script
        const __filename = fileURLToPath(import.meta.url);
        const __dirname = path.dirname(__filename);
        // From src/api/analysis-service.js, go up two levels to project root, then into scripts
        let ltasScript = path.join(__dirname, '..', '..', 'scripts', 'ltas.py');

        // In production, the script is in app.asar.unpacked, not app.asar
        if (ltasScript.includes('app.asar')) {
          ltasScript = ltasScript.replace('app.asar', 'app.asar.unpacked');
        }

        console.log('[Analysis Service] LTAS script path:', ltasScript);
        const { stdout } = await execa(python, [ltasScript, audio], { timeout: 120000, cancelSignal: signal });
        ltas = JSON.parse(stdout);
        console.log('[Analysis Service] LTAS computation successful');
      } catch (ltasError) {
        console.warn('[Analysis Service] LTAS helper failed:', ltasError.message);
        console.warn('[Analysis Service] LTAS error details:', ltasError);
      }

      const spectralSnapshot = computeSpectralSnapshot(contrastData, fluxData, energyData);
      if (ltas?.rel_db) {
        spectralSnapshot.ltas_bands = ltas.rel_db;
      }

      const rawSpectral = {
        contrast: contrastData,
        flux: fluxData,
        energy: energyData,
        ltas
      };

      const frequencyBands = calculateFrequencyBands({ raw_data: rawSpectral, snapshot: spectralSnapshot });
      const normalizedSpectral = normalizeSpectralData(rawSpectral);
      const genreFitSummary = getBestMatchingGenre({ frequencyBands, snapshot: spectralSnapshot });

      const maestTopTag = result.autotagging?.tags?.[0] || null;
      const resolvedMaestGenre = resolveGenreKey(maestTopTag?.genre);
      const availableGenres = Object.keys(GENRE_SPECTRAL_PROFILES);

      let defaultGenre = resolvedMaestGenre && GENRE_SPECTRAL_PROFILES[resolvedMaestGenre]
        ? resolvedMaestGenre
        : genreFitSummary.bestMatch;

      if (!defaultGenre && availableGenres.length > 0) {
        defaultGenre = availableGenres[0];
      }

      const defaultProfile = defaultGenre ? GENRE_SPECTRAL_PROFILES[defaultGenre] : null;
      const defaultScore = defaultProfile
        ? calculateGenreFitScore({ frequencyBands, snapshot: spectralSnapshot }, defaultProfile)
        : null;

      const detectedScore = resolvedMaestGenre && GENRE_SPECTRAL_PROFILES[resolvedMaestGenre]
        ? calculateGenreFitScore({ frequencyBands, snapshot: spectralSnapshot }, GENRE_SPECTRAL_PROFILES[resolvedMaestGenre])
        : null;

      result.spectral = {
        snapshot: spectralSnapshot,
        raw_data: rawSpectral,
        normalized: normalizedSpectral,
        frequencyBands,
        genreFit: {
          scores: genreFitSummary.scores,
          bestMatch: genreFitSummary.bestMatch,
          bestScore: genreFitSummary.bestScore,
          alignmentOffsets: genreFitSummary.alignmentOffsets,
          detectedGenre: resolvedMaestGenre,
          detectedScore,
          detectedConfidence: maestTopTag?.score ?? null,
          maestTag: maestTopTag,
          selectedGenre: defaultGenre,
          selectedScore: defaultScore,
          availableGenres
        }
      };

      console.log('[Analysis Service] Spectral analysis complete:', {
        avg_contrast: spectralSnapshot.avg_contrast?.toFixed(3),
        avg_flux: spectralSnapshot.avg_flux?.toFixed(3),
        avg_energy: spectralSnapshot.avg_energy?.toFixed(3),
        brightness: spectralSnapshot.tonal_balance?.brightness?.toFixed(3),
        warmth: spectralSnapshot.tonal_balance?.warmth?.toFixed(3),
        ltasAvailable: Boolean(ltas?.rel_db),
        selectedGenre: defaultGenre,
        selectedScore: defaultScore,
        bestGenre: genreFitSummary.bestMatch,
        bestScore: genreFitSummary.bestScore
      });

      updateProgress('Spectral analysis complete', 10);
    } catch (error) {
      console.warn('[Analysis Service] Spectral analysis failed, skipping:', error.message);
      result.spectral = null;
      updateProgress('Spectral analysis skipped (plugin error)', 10);
    }
  }

  // Calculate scores
  if (result.onsets && result.rhythm?.beats) {
    // Use instrumental beats as the reference grid for timing analysis
    result.scores.timing = calculateTimingMetrics(result.onsets, result.rhythm.beats);

    // If vocal beats are available, also calculate vocal timing vs instrumental grid
    if (result.rhythm.vocalBeats && result.rhythm.vocalBeats.length > 0) {
      result.scores.vocalTiming = calculateTimingMetrics(result.rhythm.vocalBeats, result.rhythm.beats);
    }
  }

  if (result.melody && result.harmony) {
    // Full key analysis with melody in-key percentage
    const keyFitResult = calculateEnhancedKeyFitScore(result.melody, result.harmony.chords);
    result.scores.key_fit = keyFitResult.score;

    // Store detailed key analysis for UI display
    if (keyFitResult.analysis) {
      result.keyAnalysis = {
        detectedKey: keyFitResult.key,
        mode: keyFitResult.mode,
        inKeyPercentage: keyFitResult.inKeyPercentage,
        scaleNotes: keyFitResult.analysis?.inKeyAnalysis?.scaleNotes || [],
        noteAnalysis: keyFitResult.analysis?.inKeyAnalysis?.analysis || []
      };
    }
  } else if (result.harmony && result.harmony.chords?.length > 0) {
    // Key detection from chords only (when melody analysis is skipped)
    const keyDetection = detectKeyFromChords(result.harmony.chords);
    if (keyDetection.key) {
      result.keyAnalysis = {
        detectedKey: keyDetection.key,
        mode: keyDetection.mode,
        inKeyPercentage: null, // Not available without melody
        scaleNotes: getScaleNotes(keyDetection.key, keyDetection.mode),
        noteAnalysis: []
      };
      console.log('[Analysis Service] Key detected from chords:', result.keyAnalysis);
    }
  }

  onProgress && onProgress({ percent: 100, message: 'Analysis complete!' });

  return result;
}
