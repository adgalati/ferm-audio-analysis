# FERM Audio Analysis

A **Windows-native** desktop application for comprehensive audio analysis, featuring stem separation, genre classification, and musicality scoring. Built with Electron and React, powered by industry-standard audio analysis tools.

***Disclaimer*** This repo is largely 'vibe-coded' so excuse any mess. It works for my purposes. This is only the second app I've built to this extent. I use it primarily for my live streams and other research experiments.
It's really just a prototype. It does build fine with npm run build:electron, just make sure to copy the config folder
into the installation directory after running the executable.

Follow the ./SETUP_GUIDE.md for complete configuration instructions. I've only installed it on one other system besides my main PC, but it should work as-is on any other Windows system provided you have the tools properly installed and configured.

---

## ✨ Features

### 🎵 Audio Analysis Engine (designed for ~30 second clips, but can handle longer files)
Analyze audio files with a powerful suite of extraction tools:

| Feature | Tool | Description |
|---------|------|-------------|
| **Beat/Tempo Detection** | QM Vamp Plugins | Beats, downbeats, and tempo from instrumental |
| **Chord & Key Detection** | Chordino (NNLS Chroma) | Harmonic analysis from instrumental |
| **Melody Extraction** | CREPE + pYIN | Pitch tracking with voicing fusion from vocal stem |
| **Onset Detection** | QM Onset Detector | Vocal timing events |
| **Loudness Analysis** | FFmpeg | LUFS, true peak, dynamic range |
| **Spectral Analysis** | BBC Vamp + LTAS | Contrast, flux, energy, and genre-targeted frequency comparison |
| **Stereo Analysis** | FFmpeg | Stereo width and L/R distribution |
| **Timbral Features** | openSMILE (eGeMAPS) | MFCCs and voice quality metrics |
| **Stem Separation** | Demucs | AI-powered vocals/instrumental isolation |
| **Genre Classification** | MAEST | Auto-tagging with 400 genre/style labels | 

### 🖥️ Modern Desktop UI

- **Drag-and-drop** or file picker for audio input
- **Watch folder mode** — auto-analyze files dropped into a directory
- **Interactive visualizations** including:
  - Waveform display with playback
  - Chord timeline
  - Melody contour plot
  - Onset scatter (vocal timing vs beat grid)
  - Spectral comparison display (with official iZotope Tonal Balance Control 2 references)
  - Stereo image polar plot
  - Genre "DNA" network visualization
- **Score cards** for quick insights (Spectral Fit, Loudness, Gain Staging, Top Genre)
- **Tabbed results view** — Overview, Harmony, Rhythm, Vocals, Spectral Fit

*Note: I have configured the watch folder analysis pipeline to run a specific set of tools for my purposes.
It skips melody extraction and openSMILE to save time, but those are available (I have not done much refining in the 
openSMILE analysis).
Also, every analysis that runs MAEST saves the raw embeddings to the data folder. The training 
mode saves embeddings to the training folder, and you can use the UI to label your own sub-genre/styles, and initiate the 
sklearn training pipeline which will save the .joblib files to the training/models folder.
Included in this repo is a v1 classifier for Hip-Hop that will trigger whenever a Hip-Hop genre from the discogs classifier is tagged. It's only trained on a small dataset of about 100 tracks for 7 extra genres, it's not robust, but is a good start to experiment with.

### ☁️ Cloud Storage (MongoDB)

- Automatically save analysis results to your MongoDB Atlas cluster (or configure DB service of choice)
- Browse, search, and filter your analysis history
- View detailed summaries for any stored record
- Track source type (independent vs mainstream/reference)
- Offline queue with automatic sync when connection restored

### 🏆 FERM Factor & FERM Faves (personal scoring system I never really use but it's there)

- **Subjective scoring** system for rating tracks on multiple criteria
- **Leaderboard** for comparing tracks

### 🤖 AI Training Mode

- Extract embeddings from analyzed tracks
- Build custom genre classifiers
- UI is set up to train on Hip-Hop, Pop, Rock, and Electronic substyles
- Dataset view with before/after genre predictions

---

## 🚀 Quick Start

### Desktop UI (Recommended)

```bash
npm install
npm run dev
```

This launches the Electron app. For detailed setup of external tools (Sonic Annotator, Demucs, MAEST, etc.), see **[SETUP_GUIDE.md](./SETUP_GUIDE.md)**.

### Command Line

For batch processing without the UI:

```bash
node src/analyze.js --in "C:\music\song.wav" --out "C:\music\out.json" --smile
```

---

## 🔧 Configuration

| File | Purpose |
|------|---------|
| `config/windows.env` | Paths to external tools (Sonic Annotator, FFmpeg, Demucs, etc.) |
| `config/windows.example.env` | Template — copy to `windows.env` and customize |
| `config/plugins.json` | Vamp plugin IDs and default parameters |

See **[SETUP_GUIDE.md](./SETUP_GUIDE.md)** for complete configuration instructions.

---

## 📊 Output JSON Structure

The analysis pipeline produces a unified JSON with all extracted features:

```jsonc
{
  "file": "C:\\music\\song.wav",
  "stemsUsed": true,
  "instrumentalPath": "...",
  "vocalPath": "...",
  "rhythm": {
    "beats": [0.48, 1.00, ...],
    "downbeats": [0.48, 2.40, ...],
    "tempo_bpm": 93.6
  },
  "harmony": {
    "chords": [{"start": 0.0, "end": 2.0, "label": "G:min"}, ...],
    "key": "G minor"
  },
  "melody": {
    "times": [0.03, 0.04, ...],
    "f0_hz": [233.1, 231.2, ...],
    "confidence": [0.82, 0.76, ...]
  },
  "onsets": [0.12, 0.35, 0.57, ...],
  "loudness": {
    "integrated_lufs": -14.2,
    "true_peak_dbfs": -1.0,
    "lra": 6.5
  },
  "spectral": {
    "spectrum": [...],
    "fit_score": 0.85
  },
  "autotagging": {
    "model": "mtg-upf/discogs-maest-30s-pw-129e",
    "tags": [{"genre": "Hip-Hop", "score": 0.84}, ...]
  },
  "scores": {
    "timing": { "mate_ms": 42.0, "bias_ms": -18.0 },
    "key_fit": 0.81
  }
}
```

---

## 🏗️ Architecture

```
src/
├── api/              # Analysis service & genre explainer
├── parsers/          # CSV → JSON parsers for each tool
├── runners/          # Tool wrappers (Demucs, FFmpeg, MAEST, openSMILE, Sonic Annotator)
├── services/         # MongoDB service
├── ui/
│   ├── components/   # React components
│   │   └── visualizations/  # Charts & plots
│   ├── contexts/     # Audio player context
│   └── stores/       # Local history store
├── utils/            # Scoring algorithms, schema transforms, helpers
└── analyze.js        # CLI orchestrator

electron/
├── main.js           # Electron main process
└── preload.js        # IPC bridge
```

---

## 🛠️ Development

```bash
# Start dev server with hot reload
npm run dev

# Build for production
npm run build

# Package Electron app
npm run build:electron
```

**CLI dry run** (print commands without executing):
```bash
node src/analyze.js --in "song.wav" --out "out.json" --dry
```

---

## 📝 License

MIT (for the repo code). External tools have their own licenses:
- Vamp plugins / Sonic Annotator
- openSMILE
- Demucs
- MAEST

Please follow their respective terms.
