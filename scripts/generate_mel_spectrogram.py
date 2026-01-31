#!/usr/bin/env python3
"""
Generate a mel-spectrogram image from an audio file.

Usage:
    python scripts/generate_mel_spectrogram.py <audio-path> <output-image-path>

Outputs JSON to stdout: {"success": true, "imagePath": "..."} or {"success": false, "error": "..."}
"""

import sys
import json
import numpy as np
import librosa
import librosa.display
import matplotlib
matplotlib.use('Agg')  # Non-interactive backend for headless rendering
import matplotlib.pyplot as plt


def generate_mel_spectrogram(audio_path: str, output_path: str) -> dict:
    """Generate a mel-spectrogram image and save it to output_path."""
    try:
        # Load audio file
        y, sr = librosa.load(audio_path, sr=None, mono=True)
        
        # Compute mel-spectrogram
        # Using standard parameters for good visualization
        mel_spec = librosa.feature.melspectrogram(
            y=y,
            sr=sr,
            n_mels=128,
            fmax=sr / 2,
            hop_length=512,
            n_fft=2048
        )
        
        # Convert to decibels
        mel_spec_db = librosa.power_to_db(mel_spec, ref=np.max)
        
        # Create figure with dark theme to match app aesthetics
        fig, ax = plt.subplots(figsize=(12, 4), facecolor='#1f2937')
        ax.set_facecolor('#1f2937')
        
        # Display mel-spectrogram with a purple-blue colormap to match app theme
        img = librosa.display.specshow(
            mel_spec_db,
            sr=sr,
            hop_length=512,
            x_axis='time',
            y_axis='mel',
            ax=ax,
            cmap='magma'
        )
        
        # Style the axes
        ax.set_xlabel('Time (s)', color='#9ca3af', fontsize=10)
        ax.set_ylabel('Frequency (Hz)', color='#9ca3af', fontsize=10)
        ax.tick_params(colors='#6b7280', labelsize=8)
        
        # Add colorbar
        cbar = fig.colorbar(img, ax=ax, format='%+2.0f dB')
        cbar.ax.yaxis.set_tick_params(color='#6b7280')
        cbar.ax.tick_params(colors='#6b7280', labelsize=8)
        cbar.set_label('dB', color='#9ca3af', fontsize=10)
        
        # Adjust layout and save
        plt.tight_layout()
        plt.savefig(output_path, dpi=100, facecolor='#1f2937', edgecolor='none', bbox_inches='tight')
        plt.close(fig)
        
        return {"success": True, "imagePath": output_path}
        
    except Exception as e:
        return {"success": False, "error": str(e)}


def main():
    if len(sys.argv) < 3:
        print(json.dumps({"success": False, "error": "Usage: python generate_mel_spectrogram.py <audio-path> <output-image-path>"}))
        sys.exit(1)
    
    audio_path = sys.argv[1]
    output_path = sys.argv[2]
    
    result = generate_mel_spectrogram(audio_path, output_path)
    print(json.dumps(result))
    
    if not result["success"]:
        sys.exit(1)


if __name__ == '__main__':
    main()
