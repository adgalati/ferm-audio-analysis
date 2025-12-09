#!/usr/bin/env python3
"""
Simple TBC EDM curve parser without external dependencies
"""
import json

# Load the EDM target curve
with open('docs/iZotope Target Curves/EDM.json', 'r') as f:
    data = json.load(f)

freqs = data['frequencies_hz']
median_db = data['normalized_mag_dB']
low_db = data['low_normalized_mag_dB']
high_db = data['high_normalized_mag_dB']

# Our 7 band centers
our_bands = [
    ('subBass', 40),
    ('bass', 100),
    ('lowMid', 200),
    ('mid', 1000),
    ('highMid', 2000),
    ('presence', 4000),
    ('brilliance', 10000)
]

print("iZotope TBC EDM Curve Analysis")
print("=" * 60)

for band_name, target_freq in our_bands:
    # Find closest frequency
    min_dist = float('inf')
    best_idx = 0
    for i, f in enumerate(freqs):
        dist = abs(f - target_freq)
        if dist < min_dist:
            min_dist = dist
            best_idx = i
    
    actual_freq = freqs[best_idx]
    median = median_db[best_idx]
    low = low_db[best_idx]
    high = high_db[best_idx]
    tolerance = (high - low) / 2
    
    print(f"{band_name:12s} ({target_freq:5.0f} Hz -> {actual_freq:7.1f} Hz):")
    print(f"  Median: {median:6.2f} dB")
    print(f"  Low:    {low:6.2f} dB")
    print(f"  High:   {high:6.2f} dB")
    print(f"  Tol:     ±{tolerance:5.2f} dB")
    print()
