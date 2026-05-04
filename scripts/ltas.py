import sys
import json
import numpy as np
import librosa


def smooth(psd, freqs, width_oct=1 / 3):
    out = np.zeros_like(psd)
    for i, freq in enumerate(freqs):
        if freq < 20:
            out[i] = out[i - 1] if i else 0.0
            continue
        lo = freq * 2 ** (-width_oct / 2)
        hi = freq * 2 ** (width_oct / 2)
        mask = (freqs >= lo) & (freqs <= hi)
        out[i] = psd[mask].mean() if mask.any() else psd[i]
    return out


def band_db(freqs, psd_values, band_lo, band_hi):
    mask = (freqs >= band_lo) & (freqs <= band_hi)
    if not np.any(mask):
        return -120.0
    power = float(psd_values[mask].mean())
    power = max(power, 1e-12)
    return 10.0 * np.log10(power)


def main():
    if len(sys.argv) < 2:
        raise SystemExit('Usage: python scripts/ltas.py <audio-path>')

    audio_path = sys.argv[1]
    signal, sr = librosa.load(audio_path, sr=None, mono=True)

    stft = librosa.stft(signal, n_fft=4096, hop_length=2048, window='hann')
    power_spectrogram = np.abs(stft) ** 2
    freqs = librosa.fft_frequencies(sr=sr, n_fft=4096)
    psd = power_spectrogram.mean(axis=1)
    psd_smoothed = smooth(psd, freqs)

    bands = [
        (20, 60, 'subBass'),
        (60, 250, 'bass'),
        (250, 500, 'lowMid'),
        (500, 2000, 'mid'),
        (2000, 4000, 'highMid'),
        (4000, 8000, 'presence'),
        (8000, 20000, 'brilliance'),
    ]

    abs_db = {
        name: band_db(freqs, psd_smoothed, low, high) for (low, high, name) in bands
    }

    mid_band_names = ['lowMid', 'mid', 'highMid']
    mid_values = [abs_db[name] for name in mid_band_names if name in abs_db]
    anchor = sum(mid_values) / len(mid_values) if mid_values else 0.0

    rel_db = {name: value - anchor for name, value in abs_db.items()}

    # High-res spectrum: 80 log-spaced points from 20 Hz to min(20 kHz, Nyquist)
    nyquist = sr / 2.0
    hi_limit = min(20000.0, nyquist - 1)
    n_points = 80
    hr_freqs = np.geomspace(20.0, hi_limit, n_points)

    # Convert smoothed PSD to dB
    psd_db = 10.0 * np.log10(np.maximum(psd_smoothed, 1e-12))

    # Interpolate in log-frequency space for smooth results
    log_freqs = np.log10(np.maximum(freqs, 1e-6))
    log_hr = np.log10(hr_freqs)
    hr_db = np.interp(log_hr, log_freqs, psd_db)

    # Second smoothing pass (2/3 octave) on the interpolated curve for a
    # cleaner visual display — band-level scoring data is unaffected.
    hr_db = smooth(hr_db, hr_freqs, width_oct=2 / 3)

    # Anchor high-res to same mid-band reference
    hr_db_anchored = (hr_db - anchor).tolist()
    hr_freqs_list = hr_freqs.tolist()

    print(json.dumps({
        'abs_db': abs_db,
        'rel_db': rel_db,
        'highres_frequencies': hr_freqs_list,
        'highres_db': hr_db_anchored,
    }))


if __name__ == '__main__':
    main()
