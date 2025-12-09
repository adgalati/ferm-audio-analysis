# FERM Audio Analysis - Windows Setup Guide

This guide covers the complete setup process for running the FERM Audio Analysis stack on Windows 10/11, including Python environments, external tools, and configuration.

## 1. Prerequisites

Ensure you have the following installed:
- **Node.js** (v18 or later)
- **Python** (v3.11 recommended)
- **Git**

## 2. Install Node.js Dependencies

Open a terminal in the project root and run:

```powershell
npm install
```

## 3. Set up Python Environments (Demucs & MAEST)

We use two separate Python environments: one for Demucs (stem separation) and one for MAEST (auto-tagging).

We have provided a helper script to automate this. Run:

```powershell
.\scripts\setup_env.ps1
```

**What this script does:**
1. Creates a main venv at `.venv`.
2. Installs `demucs`, `torch`, and `torchaudio` (with CUDA support) into it.
3. Creates a nested venv at `.venv\maest`.
4. Installs `transformers`, `librosa`, and other MAEST deps into it.

> **Note:** If you do not have an NVIDIA GPU, you may want to edit the script to remove `--index-url https://download.pytorch.org/whl/cu118` to install the CPU versions of Torch, though the CUDA versions usually work on CPU (just larger).

## 4. Install External Audio Tools

You need to download and place the following tools. Based on your `config\windows.env`, here is where they should go:

### A. Sonic Annotator
1. Download **Sonic Annotator** for Windows (64-bit) from the [Vamp Plugins site](https://www.vamp-plugins.org/sonic-annotator/).
2. Extract it so the executable is at:
   `C:\AudioTools\sonic-annotator\sonic-annotator.exe`

### B. Vamp Plugins
1. Create the directory: `C:\AudioTools\vamp`
2. Download the following plugin bundles and copy their `.dll` (and `.cat`/`.n3`) files into that folder:
   - **QM Vamp Plugins** ([Download](https://vamp-plugins.org/plugin-doc/qm-vamp-plugins.html)) — beats, bars, onsets
   - **Chordino (NNLS Chroma)** ([Download](https://www.isophonics.net/nnls-chroma)) — chord detection
   - **pYIN** ([Download](https://code.soundsoftware.ac.uk/projects/pyin)) — pitch tracking
   - **CREPE Vamp** (optional, for enhanced pitch) — [ircam-crepe](https://github.com/ircam-ismm/crepe-vamp) or similar
   - **BBC Vamp Plugins** ([Download](https://github.com/bbc/bbc-vamp-plugins/releases)) — spectral analysis

### C. openSMILE
1. Download **openSMILE** (Windows binary) from [audeering/opensmile](https://github.com/audeering/opensmile/releases).
2. Extract it so the executable is at:
   `C:\AudioTools\openSMILE\SMILExtract.exe`
3. Ensure the config file exists at:
   `C:\AudioTools\openSMILE\config\gemaps\v01a\GeMAPSv01a.conf`
   *(If your version has a different config structure, update `OPENSMILE_CONFIG` in `config\windows.env`)*

### D. FFmpeg
You have specified a Winget path for FFmpeg in your config.
- Ensure `ffmpeg.exe` exists at: `C:\Users\username\AppData\Local\Microsoft\WinGet\Packages\Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe\ffmpeg-8.0-full_build\bin\ffmpeg.exe`
- **Recommended:** Add this directory to your System PATH environment variable so `demucs` can find it easily.

## 5. Configuration

Copy `config\windows.example.env` to `config\windows.env` and customize it for your system directories.

**Double check:**
- `DEMUCS_DEVICE=cuda` (Change to `cpu` if you don't have an NVIDIA GPU).
- `DEMUCS_OUTDIR` points to `C:\demucs\stems`. Ensure this directory exists or the drive is accessible.

## 6. Running the App

**Desktop UI (Electron):**
```powershell
npm run dev
```

**CLI Only:**
```powershell
node src/analyze.js --in "path\to\song.wav" --out "path\to\output.json"
```

## Troubleshooting

- **"Vamp plugin not found"**: Ensure `VAMP_PATH` in `windows.env` matches where you put the DLLs.
- **Demucs Error**: If Demucs fails, try running it manually to see the error:
  ```powershell
  .\.venv\Scripts\demucs.exe --help
  ```
- **MAEST Error**: The first run of MAEST will download a ~400MB model. Ensure you have internet access.
