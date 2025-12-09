
import fs from 'node:fs/promises';
import path from 'node:path';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import { loadWindowsEnv } from './utils/env.js';
import { runSonicAnnotator } from './runners/sonic.js';
import { runOpenSmile } from './runners/smile.js';
import { preprocessForOpenSMILE } from './runners/ffmpeg.js';
import { parseTimesCsv } from './parsers/beats.js';
import { parseChordsCsv } from './parsers/chords.js';
import { parseMelodiaCsv } from './parsers/melody.js';
import { parseSmileCsv } from './parsers/smile.js';
import { calculateVocalScores } from './utils/vocal-scoring.js';
import { calculateEnhancedKeyFitScore } from './utils/key-analysis.js';

const argv = yargs(hideBin(process.argv))
  .option('in', { type: 'string', demandOption: true, desc: 'Path to audio file' })
  .option('out', { type: 'string', demandOption: true, desc: 'Path to output JSON' })
  .option('smile', { type: 'boolean', default: false, desc: 'Run openSMILE eGeMAPS' })
  .option('stems', { type: 'boolean', default: false, desc: 'Use Demucs stem separation' })
  .option('dry', { type: 'boolean', default: false, desc: 'Print commands only' })
  .help().argv;

const env = loadWindowsEnv();
const PLUGINS = JSON.parse(await fs.readFile('config/plugins.json', 'utf-8'));

function ensurePath(p, name) {
  if (!p) throw new Error(`Missing path for ${name}. Check config/windows.env`);
  return p;
}

const SONIC = ensurePath(env.SONIC_ANNOTATOR_EXE, 'SONIC_ANNOTATOR_EXE');
const VAMP_PATH = ensurePath(env.VAMP_PATH, 'VAMP_PATH');
const OPENSMILE = env.OPENSMILE_EXE;
const OPENSMILE_CONFIG = env.OPENSMILE_CONFIG;

async function runPlugin(pluginId, audioPath) {
  const csv = await runSonicAnnotator({ exe: SONIC, pluginPath: VAMP_PATH, pluginId, audioPath });
  return csv;
}

async function main() {
  const audio = path.resolve(argv.in);

  if (argv.dry) {
    console.log('DRY RUN - Commands that would be executed:');
    console.log('Audio file:', audio);
    
    if (argv.stems) {
      console.log('Demucs command:');
      console.log(`${env.DEMUCS_CMD} ${env.DEMUCS_ARGS} -d ${env.DEMUCS_DEVICE} -o ${env.DEMUCS_OUTDIR} "${audio}"`);
      console.log('Expected outputs:');
      const basename = path.basename(audio, path.extname(audio));
      console.log(`  Vocals: ${env.DEMUCS_OUTDIR}/htdemucs/${basename}/vocals.wav`);
      console.log(`  Instrumental: ${env.DEMUCS_OUTDIR}/htdemucs/${basename}/no_vocals.wav`);
    }
    
    console.log('Sonic Annotator commands:');
    console.log(`${SONIC} -d ${PLUGINS.qm.beats} -w csv --csv-stdout "${argv.stems ? 'INSTRUMENTAL_PATH' : audio}"`);
    console.log(`${SONIC} -d ${PLUGINS.qm.bars} -w csv --csv-stdout "${argv.stems ? 'INSTRUMENTAL_PATH' : audio}"`);
    console.log(`${SONIC} -d ${PLUGINS.qm.onsets} -w csv --csv-stdout "${argv.stems ? 'VOCAL_PATH' : audio}"`);
    console.log(`${SONIC} -d ${PLUGINS.chordino.simple} -w csv --csv-stdout "${argv.stems ? 'INSTRUMENTAL_PATH' : audio}"`);
    console.log(`${SONIC} -d ${PLUGINS.melody.plugins[0]} -w csv --csv-stdout "${argv.stems ? 'VOCAL_PATH' : audio}"`);
    
    if (argv.smile) {
      console.log(`openSMILE: ${OPENSMILE} -C ${OPENSMILE_CONFIG} -I "${argv.stems ? 'VOCAL_PATH' : audio}" -O tmp/egemaps.csv`);
    }
    
    return;
  }

  // Determine audio paths for analysis
  let instrumentalPath = audio;
  let vocalPath = audio;
  let stemsUsed = false;

  if (argv.stems) {
    console.log('Running Demucs stem separation...');
    const { runDemucs } = await import('./runners/demucs.js');
    try {
      const stems = await runDemucs({
        audioPath: audio,
        demucsCmd: env.DEMUCS_CMD,
        demucsArgs: env.DEMUCS_ARGS,
        device: env.DEMUCS_DEVICE,
        outDir: env.DEMUCS_OUTDIR,
        ffmpegPath: env.FFMPEG_PATH
      });
      instrumentalPath = stems.instrumental;
      vocalPath = stems.vocals;
      stemsUsed = true;
      console.log('Stem separation complete');
    } catch (error) {
      console.warn('Demucs failed, falling back to full mix:', error.message);
    }
  }

  // 1) Rhythm
  const tempoCsv = await runPlugin(PLUGINS.qm.tempo, instrumentalPath);
  const instrumentalBeatsCsv = await runPlugin(PLUGINS.qm.beats, instrumentalPath);
  const instrumentalBarsCsv = await runPlugin(PLUGINS.qm.bars, instrumentalPath);
  const vocalOnsetsCsv = await runPlugin(PLUGINS.qm.onsets, vocalPath);

  const instrumentalBeats = parseTimesCsv(instrumentalBeatsCsv);
  const instrumentalDownbeats = parseTimesCsv(instrumentalBarsCsv);
  const vocalOnsets = parseTimesCsv(vocalOnsetsCsv);

  // If stems are used, also analyze vocal beats for comparison
  let vocalBeats = null;
  if (stemsUsed) {
    try {
      const vocalBeatsCsv = await runPlugin(PLUGINS.qm.beats, vocalPath);
      vocalBeats = parseTimesCsv(vocalBeatsCsv);
    } catch (error) {
      console.warn('Failed to extract vocal beats:', error.message);
    }
  }

  // naive tempo from first tempo value if present
  const tempoLines = tempoCsv.trim().split(/\r?\n/);
  const tempo_bpm = (() => {
    for (const ln of tempoLines) {
      const v = parseFloat(ln.split(',')[0]);
      if (!Number.isNaN(v)) return v;
    }
    return null;
  })();

  // 2) Harmony
  const chordCsv = await runPlugin(PLUGINS.chordino.simple, instrumentalPath);
  const chords = parseChordsCsv(chordCsv);

  // 3) Melody (CREPE)
  const melCsv = await runPlugin(PLUGINS.melody.plugins[0], vocalPath);
  const melody = parseMelodiaCsv(melCsv);

  // 4) (optional) openSMILE vocal analysis
  let smile = null;
  if (argv.smile) {
    if (!OPENSMILE || !OPENSMILE_CONFIG) {
      console.warn('openSMILE requested but OPENSMILE_EXE / OPENSMILE_CONFIG not set.');
    } else {
      try {
        const smileOut = path.resolve('tmp', `egemaps_${Date.now()}.csv`);
        await fs.mkdir('tmp', { recursive: true });
        
        // Preprocess audio for openSMILE: convert to mono/16kHz
        const preprocessedPath = path.resolve('tmp', `vocal_mono16k_${Date.now()}.wav`);
        
        console.log('Preprocessing vocal track for openSMILE...');
        await preprocessForOpenSMILE({
          inputPath: vocalPath,
          outputPath: preprocessedPath,
          ffmpegPath: env.FFMPEG_PATH ? path.join(env.FFMPEG_PATH, 'ffmpeg.exe') : 'ffmpeg'
        });
        
        // Run OpenSMILE on preprocessed vocal track
        await runOpenSmile({ exe: OPENSMILE, config: OPENSMILE_CONFIG, audioPath: preprocessedPath, csvOutPath: smileOut });
        
        // Clean up preprocessed file
        try {
          await fs.unlink(preprocessedPath);
        } catch (cleanupError) {
          console.warn('Failed to cleanup preprocessed file:', cleanupError.message);
        }
        
        // Parse CSV and calculate vocal scores
        const csvContent = await fs.readFile(smileOut, 'utf-8');
        const smileData = parseSmileCsv(csvContent);
        const vocalScores = calculateVocalScores(smileData.vocal);
        
        smile = { 
          egemaps: { 
            csv: smileOut,
            features: smileData.vocal,
            scores: vocalScores
          } 
        };
        
        console.log('Vocal analysis complete:', {
          pitch_stability: vocalScores?.pitch_stability,
          dynamic_control: vocalScores?.dynamic_control,
          voice_quality: vocalScores?.voice_quality,
          overall: vocalScores?.overall
        });
      } catch (error) {
        console.warn('OpenSMILE failed, skipping vocal analysis:', error.message);
        smile = null;
      }
    }
  }

  const result = {
    file: audio,
    stemsUsed,
    instrumentalPath,
    vocalPath,
    rhythm: { 
      beats: instrumentalBeats,           // Primary beat grid from instrumental
      downbeats: instrumentalDownbeats,   // Downbeats from instrumental
      tempo_bpm,
      vocalBeats: vocalBeats             // Vocal beats for comparison (if available)
    },
    harmony: { chords },
    melody,
    onsets: vocalOnsets,                 // Vocal onsets for timing analysis
    smile,
    scores: {}, // TODO: add timing scoring next step
    keyAnalysis: null
  };

  // Calculate key analysis if both melody and harmony are available
  if (melody && chords && chords.length > 0) {
    const keyFitResult = calculateEnhancedKeyFitScore(melody, chords);
    if (keyFitResult.analysis) {
      result.scores.key_fit = keyFitResult.score;
      result.keyAnalysis = {
        detectedKey: keyFitResult.key,
        mode: keyFitResult.mode,
        inKeyPercentage: keyFitResult.inKeyPercentage,
        scaleNotes: keyFitResult.analysis?.inKeyAnalysis?.scaleNotes || [],
        noteAnalysis: keyFitResult.analysis?.inKeyAnalysis?.analysis || []
      };
    }
  }

  await fs.writeFile(argv.out, JSON.stringify(result, null, 2), 'utf-8');
  console.log('Wrote', argv.out);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
