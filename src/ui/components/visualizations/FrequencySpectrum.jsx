import React, { useMemo } from 'react';
import { FREQUENCY_BANDS } from '../../../utils/genre-spectral-profiles.js';

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const formatFrequency = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }
  if (value >= 1000) {
    const kilo = value / 1000;
    return `${kilo % 1 === 0 ? kilo.toFixed(0) : kilo.toFixed(1)} kHz`;
  }
  return `${Math.round(value)} Hz`;
};

const formatRange = ([low, high]) => `${formatFrequency(low)} - ${formatFrequency(high)}`;

const computeAlignmentOffset = (bandsData = {}, profile) => {
  if (!profile?.frequencyTargets) {
    return 0;
  }
  const diffs = FREQUENCY_BANDS
    .map((band) => {
      const actual = bandsData[band.id];
      const target = profile.frequencyTargets[band.id]?.target;
      if (!Number.isFinite(actual) || !Number.isFinite(target)) {
        return null;
      }
      return actual - target;
    })
    .filter((val) => Number.isFinite(val));

  if (diffs.length === 0) {
    return 0;
  }
  const sum = diffs.reduce((acc, val) => acc + val, 0);
  return sum / diffs.length;
};

export default function FrequencySpectrum({ frequencyBands = {}, profile, activeGenre, alignmentOffset }) {
  const derivedOffset = useMemo(() => {
    if (Number.isFinite(alignmentOffset)) {
      return alignmentOffset;
    }
    return computeAlignmentOffset(frequencyBands, profile);
  }, [alignmentOffset, frequencyBands, profile]);

  const bands = useMemo(() => FREQUENCY_BANDS.map(band => {
    const rawActual = frequencyBands[band.id] ?? 0;
    const target = profile?.frequencyTargets?.[band.id]?.target ?? 0;
    const tolerance = profile?.frequencyTargets?.[band.id]?.tolerance ?? 3;
    const adjustedActual = rawActual - derivedOffset;
    return {
      ...band,
      actual: adjustedActual,
      displayedTarget: target,
      tolerance,
      rawActual
    };
  }), [frequencyBands, profile, derivedOffset]);

  const valueRange = useMemo(() => {
    const values = [];
    bands.forEach(({ actual, displayedTarget, tolerance }) => {
      values.push(actual, displayedTarget, displayedTarget + tolerance, displayedTarget - tolerance);
    });
    const min = Math.min(...values, -18);
    const max = Math.max(...values, 6);
    return { min: Math.min(min, -18), max: Math.max(max, 6) };
  }, [bands]);

  const toPercent = (value) => {
    const span = valueRange.max - valueRange.min || 1;
    const percent = ((value - valueRange.min) / span) * 100;
    return clamp(percent, 0, 100);
  };

  const appliedShift = -(derivedOffset || 0);

  return (
    <div className="bg-gray-900/70 border border-gray-800/60 rounded-xl p-6 shadow-inner">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-slate-100">Frequency Spectrum Snapshot</h3>
          <p className="text-xs text-slate-400">
            Your mix is normalized by {appliedShift >= 0 ? '+' : '-'}{Math.abs(appliedShift).toFixed(2)} dB to compare shape against the {activeGenre || 'reference'} target.
          </p>
        </div>
        <div className="text-right text-xs text-slate-400">
          <div>Scale: {valueRange.min.toFixed(1)} dB to {valueRange.max.toFixed(1)} dB</div>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-3">
        {bands.map(band => {
          const actualHeight = toPercent(band.actual);
          const upperPercent = toPercent(band.displayedTarget + band.tolerance);
          const lowerPercent = toPercent(band.displayedTarget - band.tolerance);
          const topPercent = Math.max(upperPercent, lowerPercent);
          const bottomPercent = Math.min(upperPercent, lowerPercent);
          const toleranceHeight = Math.max(topPercent - bottomPercent, 0);
          const targetPos = toPercent(band.displayedTarget);

          return (
            <div key={band.id} className="flex flex-col items-center">
              <div className="relative w-full h-48 bg-gray-950/50 rounded-lg border border-gray-800/60 overflow-hidden">
                <div
                  className="absolute left-1/2 -translate-x-1/2 w-3 rounded-t-md bg-gradient-to-t from-cyan-500 via-sky-400 to-emerald-300 shadow"
                  style={{ height: `${actualHeight}%`, bottom: 0 }}
                  aria-label={`${band.label} adjusted level ${band.actual.toFixed(2)} dB`}
                />
                <div
                  className="absolute left-0 right-0 bg-indigo-500/20"
                  style={{ bottom: `${bottomPercent}%`, height: `${toleranceHeight}%` }}
                  aria-hidden="true"
                />
                <div
                  className="absolute left-1 right-1 border-t border-dashed border-indigo-300"
                  style={{ bottom: `${targetPos}%` }}
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 text-sm font-semibold text-slate-100">{band.label}</div>
              <div className="text-xs text-slate-400">{band.actual.toFixed(2)} dB</div>
              <div className="text-[11px] text-indigo-300">Target {band.displayedTarget.toFixed(1)} ±{band.tolerance.toFixed(1)}</div>
            </div>
          );
        })}
      </div>

      <div className="mt-5">
        <div className="relative h-[1px] bg-slate-700/80">
          {FREQUENCY_BANDS.map((band, index) => (
            <div
              key={`${band.id}-tick`}
              className="absolute -top-1 h-2 w-[1px] bg-slate-600/80"
              style={{ left: `${(index / (FREQUENCY_BANDS.length - 1)) * 100}%` }}
              aria-hidden="true"
            />
          ))}
        </div>
        <div className="grid grid-cols-7 gap-3 mt-2 text-[11px] text-slate-400">
          {FREQUENCY_BANDS.map(band => (
            <div key={`${band.id}-freq`} className="text-center">
              {formatRange(band.range)}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between mt-4 text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="inline-block w-3 h-3 rounded-full bg-cyan-400" aria-hidden="true" />
          <span>Your Audio</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-[2px] bg-indigo-300 border-t border-dashed border-indigo-100" aria-hidden="true" />
          <span>Target</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-3 bg-indigo-500/20 border border-indigo-400/30" aria-hidden="true" />
          <span>Target Range</span>
        </div>
      </div>
    </div>
  );
}
