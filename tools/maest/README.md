# MAEST Auto-Tagging Setup

This directory contains the MAEST (Music Audio Embedding for Style Transfer) implementation for automatic genre and style classification.

## Overview

MAEST is a transformer-based model trained on Discogs data that can classify audio into genre and subgenre categories. It's particularly effective for electronic music classification.

- **Model**: `mtg-upf/discogs-maest-30s-pw-129e`
- **Input**: 30-second audio clips, resampled to 16kHz mono
- **Output**: Ranked list of genre/subgenre predictions with confidence scores
- **Size**: ~400MB (downloaded on first run)

## Setup Instructions

### 1. Create Python Virtual Environment

```powershell
# From the project root directory
py -3.11 -m venv .venv\maest
.\.venv\maest\Scripts\activate
```

### 2. Install Dependencies

```powershell
# CPU wheels (recommended for most users)
pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu

# Core MAEST dependencies
pip install "transformers>=4.44" "accelerate>=0.33" librosa soundfile numpy

# Optional: for HTTP service pattern later
pip install fastapi uvicorn
```

### 3. Test Installation

```powershell
python -c "
from transformers import pipeline
clf = pipeline('audio-classification', 
               model='mtg-upf/discogs-maest-30s-pw-129e',
               trust_remote_code=True)
print('MAEST pipeline OK')
"
```

### 4. Configure Environment

Add to `config/windows.env`:

```
MAEST_PYTHON_PATH=.venv\maest\Scripts\python.exe
MAEST_CLI_PATH=tools\maest\maest_cli.py
MAEST_TOP_K=7
```

## Usage

The MAEST CLI script (`maest_cli.py`) accepts audio files and returns JSON with genre predictions:

```bash
python tools/maest/maest_cli.py "path/to/audio.wav" 7
```

Output format:
```json
{
  "model": "mtg-upf/discogs-maest-30s-pw-129e",
  "results": [
    {"genre": "Electronic", "subgenre": "Psytrance", "score": 0.84},
    {"genre": "Electronic", "subgenre": "Goa Trance", "score": 0.33},
    {"genre": "Electronic", "subgenre": "Trance", "score": 0.29}
  ]
}
```

## Supported Audio Formats

- WAV, FLAC, MP3, OGG, M4A, AAC
- Any format supported by `librosa` (requires ffmpeg for compressed formats)

## Performance Notes

- **CPU**: Works well for occasional use (~10-30 seconds per file)
- **CUDA**: Significantly faster if available (~2-5 seconds per file)
- **Memory**: Requires ~2GB RAM for model loading
- **First run**: Downloads model from HuggingFace Hub (~400MB)

## Troubleshooting

### Common Issues

1. **ImportError: No module named 'transformers'**
   - Ensure virtual environment is activated
   - Reinstall dependencies: `pip install transformers>=4.44`

2. **Model download fails**
   - Check internet connection
   - Verify HuggingFace Hub access
   - Try manual download: `huggingface-cli download mtg-upf/discogs-maest-30s-pw-129e`

3. **Audio format not supported**
   - Install ffmpeg: `pip install ffmpeg-python`
   - Ensure ffmpeg is in PATH
   - Convert audio to WAV format

4. **CUDA out of memory**
   - Use CPU version: `pip install torch torchaudio --index-url https://download.pytorch.org/whl/cpu`
   - Reduce batch size or use shorter audio clips

### Performance Optimization

- **CUDA**: Install CUDA wheels for faster inference
- **Batch processing**: Process multiple files in sequence
- **Audio preprocessing**: Use shorter clips (30s) for faster processing

## Model Information

- **Paper**: [MAEST: Music Audio Embedding for Style Transfer](https://arxiv.org/abs/2206.10828)
- **Dataset**: Discogs (genre/style annotations)
- **Architecture**: Transformer-based audio classifier
- **Training**: 30-second audio clips, 16kHz sampling rate

## Citation

```bibtex
@article{maest2022,
  title={MAEST: Music Audio Embedding for Style Transfer},
  author={...},
  journal={arXiv preprint arXiv:2206.10828},
  year={2022}
}
```
