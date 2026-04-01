import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { Sparkles, SlidersHorizontal } from 'lucide-react';
import FrequencySpectrum from './FrequencySpectrum.jsx';
import { FREQUENCY_BANDS, GENRE_SPECTRAL_PROFILES, TARGET_CENTERS_HZ } from '../../../utils/genre-spectral-profiles.js';

ChartJS.register(CategoryScale, LinearScale, LogarithmicScale, PointElement, LineElement, Filler, Tooltip, Legend);

// Hand-picked logarithmic tick values (like Tonal Balance Control - minimal set to prevent overlap)
const LOG_TICK_VALUES = [40, 100, 200, 600, 1000, 2000, 4000, 6000, 10000, 16000, 20000];

// Macro-band edge separators
// Macro-band edge separators
const MACRO_BAND_EDGES = [20, 250, 1000, 4000, 20000];

const DISPLAY_SCALE = 1.0;

const formatFrequencyValue = (value) => {
  if (!Number.isFinite(value)) return '';
  if (value >= 1000) {
    const kilo = value / 1000;
    return `${Number.isInteger(kilo) ? kilo.toFixed(0) : kilo.toFixed(1)} kHz`;
  }
  return `${Math.round(value)} Hz`;
};

const formatFrequencyRange = ([low, high]) => `${formatFrequencyValue(low)} – ${formatFrequencyValue(high)}`;

function Sparkline({ values = [], label, color = '#22d3ee', subtitle = null, fullWidth = false, height = 120 }) {
  if (!values || values.length === 0) {
    return (
      <div className="bg-gray-800/60 rounded-lg p-4 border border-gray-700/50 text-sm text-gray-400">
        No {label} data available
      </div>
    );
  }

  const viewWidth = fullWidth ? 720 : 260;
  const viewHeight = height;
  const paddingX = 16;
  const paddingY = 16;
  const filtered = values.filter(v => Number.isFinite(v));
  const safeValues = filtered.length > 0 ? filtered : [0];
  const minValue = Math.min(...safeValues);
  const maxValue = Math.max(...safeValues);
  const range = maxValue - minValue || 1;

  const points = safeValues.map((val, idx) => {
    const x = paddingX + (idx / Math.max(safeValues.length - 1, 1)) * (viewWidth - paddingX * 2);
    const y = paddingY + (1 - (val - minValue) / range) * (viewHeight - paddingY * 2);
    return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  const gradientId = `spark-${(label || 'series').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-gradient`;

  return (
    <div className={`bg-gray-900/60 rounded-lg p-5 border border-gray-800/70 ${fullWidth ? 'w-full' : ''}`}>
      <div className="flex items-center justify-between mb-1">
        <div>
          <span className="text-xs uppercase tracking-wide text-gray-400 block">{label}</span>
          {subtitle && (
            <span className="text-[11px] text-gray-500 block">{subtitle}</span>
          )}
        </div>
        <span className="text-xs text-gray-500">Max {maxValue.toFixed(3)}</span>
      </div>
      <svg
        role="img"
        aria-label={`${label} trend`}
        width={fullWidth ? '100%' : viewWidth}
        height={viewHeight}
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.35" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path
          d={`${points} L ${viewWidth - paddingX} ${viewHeight - paddingY} L ${paddingX} ${viewHeight - paddingY} Z`}
          fill={`url(#${gradientId})`}
          opacity="0.35"
        />
        <path d={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function SpectralDisplay({ spectralData, detectedGenre }) {
  const [activeGenre, setActiveGenre] = useState(() => spectralData?.genreFit?.selectedGenre || detectedGenre || spectralData?.genreFit?.bestMatch);

  const genreScores = spectralData?.genreFit?.scores || {};
  const availableGenres = useMemo(() => {
    const set = new Set(Object.keys(GENRE_SPECTRAL_PROFILES));
    if (Array.isArray(spectralData?.genreFit?.availableGenres)) {
      for (const genre of spectralData.genreFit.availableGenres) {
        if (genre) {
          set.add(genre);
        }
      }
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [spectralData?.genreFit?.availableGenres]);
  const alignmentOffsets = spectralData?.genreFit?.alignmentOffsets || {};

  const bandLabels = useMemo(() => FREQUENCY_BANDS.map(band => band.label), []);
  const bandKeys = useMemo(() => FREQUENCY_BANDS.map(band => band.id), []);
  const bandCenters = useMemo(() => FREQUENCY_BANDS.map(band => {
    const [low, high] = band.range;
    return Math.sqrt(low * high);
  }), []);

  // Calculate dynamic min/max based on actual data range
  const chartFrequencyRange = useMemo(() => {
    if (bandCenters.length === 0) return { min: 20, max: 20000 };

    const minDataFreq = Math.min(...bandCenters);
    const maxDataFreq = Math.max(...bandCenters);

    // All possible tick values for boundary calculation
    const allPossibleTicks = [20, 30, 40, 100, 200, 600, 1000, 2000, 4000, 6000, 10000, 12000, 16000, 20000];

    // Min: find the tick value just below the minimum data frequency
    let min = allPossibleTicks[0];
    for (const tick of allPossibleTicks) {
      if (tick < minDataFreq) {
        min = tick;
      } else {
        break;
      }
    }

    // Max: always extend to 20 kHz to show the full audible spectrum
    const max = 20000;

    return { min, max };
  }, [bandCenters]);

  const activeProfile = useMemo(() => {
    if (activeGenre && GENRE_SPECTRAL_PROFILES[activeGenre]) {
      return GENRE_SPECTRAL_PROFILES[activeGenre];
    }
    const resolved = detectedGenre && GENRE_SPECTRAL_PROFILES[detectedGenre];
    return resolved || GENRE_SPECTRAL_PROFILES[availableGenres[0]];
  }, [activeGenre, detectedGenre, availableGenres]);

  const activeAlignmentOffset = useMemo(() => {
    if (activeGenre && Number.isFinite(alignmentOffsets[activeGenre])) {
      return alignmentOffsets[activeGenre];
    }
    if (detectedGenre && Number.isFinite(alignmentOffsets[detectedGenre])) {
      return alignmentOffsets[detectedGenre];
    }
    return 0;
  }, [activeGenre, detectedGenre, alignmentOffsets]);

  const tonalChartData = useMemo(() => {
    const actualLevels = bandKeys.map(key =>
      ((spectralData?.frequencyBands?.[key] ?? 0) - activeAlignmentOffset) * DISPLAY_SCALE
    );
    const targetLevels = bandKeys.map(key =>
      (activeProfile?.frequencyTargets?.[key]?.target ?? 0) * DISPLAY_SCALE
    );

    // Band-level points for target and audio markers
    const targetPoints = targetLevels.map((value, idx) => ({ x: bandCenters[idx], y: value }));
    const actualPoints = actualLevels.map((value, idx) => ({ x: bandCenters[idx], y: value }));

    // High-res "Your Audio" curve from LTAS data (80 log-spaced points)
    const ltasHighres = spectralData?.raw_data?.ltas;
    let highResActualCurve = null;
    if (ltasHighres?.highres_frequencies?.length && ltasHighres?.highres_db?.length) {
      highResActualCurve = [];
      for (let i = 0; i < ltasHighres.highres_frequencies.length; i++) {
        const f = ltasHighres.highres_frequencies[i];
        const db = ltasHighres.highres_db[i];
        if (f > 0 && Number.isFinite(db)) {
          highResActualCurve.push({ x: f, y: (db - activeAlignmentOffset) * DISPLAY_SCALE });
        }
      }
    }

    // Continuous tolerance tube from the profile's curve
    const highRes = activeProfile?.highResCurve;
    const curve = activeProfile?.curve;

    let lowerCurve = [];
    let upperCurve = [];

    if (highRes?.frequencies?.length) {
      // Use high-res data (already anchored)
      // Filter out frequencies <= 0 and invalid Y values
      const validIndices = [];
      for (let i = 0; i < highRes.frequencies.length; i++) {
        const f = highRes.frequencies[i];
        const l = highRes.low[i];
        const h = highRes.high[i];
        if (f > 0 && Number.isFinite(l) && Number.isFinite(h)) {
          validIndices.push(i);
        }
      }

      lowerCurve = validIndices.map(i => ({ x: highRes.frequencies[i], y: highRes.low[i] * DISPLAY_SCALE }));
      upperCurve = validIndices.map(i => ({ x: highRes.frequencies[i], y: highRes.high[i] * DISPLAY_SCALE }));
    } else if (curve?.p10Db?.length && curve?.p90Db?.length) {
      // Fallback to low-res
      lowerCurve = curve.p10Db.map((y, i) => ({ x: TARGET_CENTERS_HZ[i], y: y * DISPLAY_SCALE }));
      upperCurve = curve.p90Db.map((y, i) => ({ x: TARGET_CENTERS_HZ[i], y: y * DISPLAY_SCALE }));
    }

    // Choose the best "Your Audio" line data
    const audioLineData = highResActualCurve && highResActualCurve.length > 0
      ? highResActualCurve
      : actualPoints;

    const datasets = [
      // 1) Lower tolerance curve (invisible, drawn first)
      {
        id: 'tolLowerCurve',
        label: 'Tolerance (lower)',
        data: lowerCurve,
        borderColor: 'rgba(0,0,0,0)',
        backgroundColor: 'rgba(0,0,0,0)',
        pointRadius: 0,
        tension: 0.35,
        fill: false,
        parsing: false,
        order: 1,
        spanGaps: true
      },
      // 2) Upper tolerance curve (fills to previous dataset = tube)
      {
        id: 'tolUpperCurve',
        label: 'Tolerance Band',
        data: upperCurve,
        borderColor: 'rgba(0,0,0,0)',
        backgroundColor: 'rgba(129,140,248,0.18)',
        pointRadius: 0,
        tension: 0.35,
        fill: '-1',  // Fill to previous dataset (creates the tube)
        parsing: false,
        order: 1,
        spanGaps: true
      },
      // 3) Target dotted line
      {
        id: 'target',
        label: `${activeGenre || detectedGenre || 'Genre'} Target`,
        data: targetPoints,
        borderColor: '#818cf8',
        borderDash: [6, 4],
        borderWidth: 2,
        pointRadius: 0,
        pointBackgroundColor: '#818cf8',
        pointHoverRadius: 3,
        tension: 0.35,
        fill: false,
        parsing: false,
        order: 2
      },
      // 4) Your audio — smooth high-res curve
      {
        id: 'actual',
        label: 'Your Audio',
        data: audioLineData,
        borderColor: '#22d3ee',
        backgroundColor: 'rgba(34,211,238,0.1)',
        borderWidth: 3,
        pointRadius: 0,
        pointBackgroundColor: '#22d3ee',
        pointHoverRadius: 4,
        tension: 0.35,
        fill: false,
        parsing: false,
        order: 3
      },
    ];
    return { datasets };
  }, [spectralData?.frequencyBands, spectralData?.raw_data?.ltas, activeProfile, activeGenre, detectedGenre, bandKeys, bandCenters, activeAlignmentOffset]);

  const bandEdgesPlugin = useMemo(() => ({
    id: 'bandEdges',
    beforeDraw: (chart) => {
      const { ctx, chartArea, scales } = chart;
      if (!scales.x) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
      ctx.lineWidth = 1;

      // Draw separators at 250, 1000, 4000 Hz
      for (const f of MACRO_BAND_EDGES.slice(1, -1)) {
        const x = scales.x.getPixelForValue(f);
        if (x > chartArea.left && x < chartArea.right) {
          ctx.beginPath();
          ctx.moveTo(x, chartArea.top);
          ctx.lineTo(x, chartArea.bottom);
          ctx.stroke();
        }
      }
      ctx.restore();
    }
  }), []);

  const bandLabelPlugin = useMemo(() => ({
    id: 'bandLabels',
    afterDraw: (chart) => {
      const { ctx, chartArea, scales } = chart;
      if (!chartArea || !scales.x) return;

      ctx.save();
      ctx.font = '11px sans-serif';
      ctx.fillStyle = '#94a3b8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const xScale = scales.x;
      const bottom = chartArea.bottom;
      const labelY = bottom + 40;

      FREQUENCY_BANDS.forEach((band, index) => {
        const centerFreq = bandCenters[index];
        const xPos = xScale.getPixelForValue(centerFreq);

        if (xPos >= chartArea.left && xPos <= chartArea.right) {
          ctx.fillText(bandLabels[index], xPos, labelY);
        }
      });

      ctx.restore();
    }
  }), [bandCenters, bandLabels]);

  const tonalChartOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    interaction: { mode: 'index', intersect: false },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          color: '#cbd5f5',
          padding: 20,
          usePointStyle: true,
          filter: (item) => item.text !== 'Tolerance (lower)'
        }
      },
      tooltip: {
        callbacks: {
          label: (context) => {
            const freq = context.parsed.x;
            return `${context.dataset.label}: ${context.parsed.y.toFixed(2)} dB @ ${formatFrequencyValue(freq)}`;
          }
        }
      }
    },
    scales: {
      x: {
        type: 'logarithmic',
        min: chartFrequencyRange.min,
        max: chartFrequencyRange.max,
        grid: {
          color: 'rgba(148, 163, 184, 0.15)',
          tickLength: 6
        },
        // Force our exact tick set (always use LOG_TICK_VALUES, which ends at 10 kHz)
        afterBuildTicks: (scale) => {
          scale.ticks = LOG_TICK_VALUES
            .filter(v => v >= scale.min && v <= scale.max)
            .map(v => ({ value: v }));
        },
        ticks: {
          color: '#94a3b8',
          font: { size: 10 },
          padding: 6,
          autoSkip: false,
          maxRotation: 0,
          callback: (val) => formatFrequencyValue(Number(val))
        },
        title: {
          display: true,
          text: 'Frequency (Hz)',
          color: '#cbd5f5',
          font: { size: 12 },
          padding: { bottom: 60 }
        },
        afterFit: (scale) => {
          scale.height += 60;
        }
      },
      y: {
        min: -30,
        max: 30,
        grid: {
          color: 'rgba(148, 163, 184, 0.08)',
          drawBorder: false
        },
        ticks: { color: '#94a3b8' },
        title: {
          display: true,
          text: 'Relative Level (dB)',
          color: '#cbd5f5',
          font: { size: 12 }
        }
      }
    }
  }), [chartFrequencyRange]);

  const handleGenreSelect = (genre) => {
    setActiveGenre(genre);
  };

  const fluxValues = spectralData?.normalized?.fluxValues || [];
  const contrastBands = spectralData?.normalized?.contrastBands || [];
  const energyValues = spectralData?.normalized?.energyValues || [];
  const contrastValues = contrastBands?.flat?.() || [];

  return (
    <div className="space-y-6">
      <section className="bg-gray-900/70 border border-gray-800/60 rounded-xl p-6 shadow-inner space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h3 className="text-xl font-semibold text-slate-100 flex items-center gap-2">
              <SlidersHorizontal className="w-5 h-5 text-indigo-400" aria-hidden="true" />
              Spectral Genre Fit
            </h3>
            <p className="text-sm text-slate-400 max-w-xl">
              Compare your track's tonal balance against genre reference curves. Labels indicate how well your mix stays within tolerance bands.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {availableGenres.map((genre) => {
              const score = genreScores[genre];
              const isActive = genre === activeGenre;
              const scoreValue = Math.round(score ?? 0);
              const label = getSpectralLabel(scoreValue);

              // Color coding based on label
              let scoreColor = 'text-gray-400';
              if (label === 'Well-Balanced') scoreColor = 'text-emerald-400';
              else if (label === 'Balanced') scoreColor = 'text-cyan-400';
              else if (label === 'Unbalanced') scoreColor = 'text-yellow-400';
              else if (label === 'Very Unbalanced') scoreColor = 'text-red-400';

              return (
                <button
                  key={genre}
                  type="button"
                  onClick={() => handleGenreSelect(genre)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${isActive ? 'bg-indigo-600/80 border-indigo-400 text-white' : 'bg-gray-800/60 border-gray-700 text-gray-300 hover:bg-gray-800'}`}
                  aria-pressed={isActive}
                  title={`${genre} fit: ${label}`}
                >
                  <span className="block text-xs uppercase tracking-wide text-indigo-200/80">{genre}</span>
                  <span className={`block text-sm font-semibold ${isActive ? 'text-white' : scoreColor}`}>{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Genre Detail Bar */}
        {activeGenre && genreScores[activeGenre] !== undefined && (
          <div className="bg-gray-950/40 rounded-lg border border-indigo-500/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <div>
                <span className="text-sm font-medium text-indigo-300">{activeGenre}</span>
                <p className="text-xs text-gray-400 mt-0.5">
                  {GENRE_SPECTRAL_PROFILES[activeGenre]?.description || 'Genre target curve.'}
                </p>
              </div>
              <span className="text-2xl font-bold text-indigo-200">{getSpectralLabel(Math.round(genreScores[activeGenre]))}</span>
            </div>
            <div className="w-full h-3 rounded-full bg-gray-800 overflow-hidden">
              <div
                className={`h-full bg-gradient-to-r ${Math.round(genreScores[activeGenre]) >= 85 ? 'from-emerald-500 via-green-400 to-cyan-400' :
                  Math.round(genreScores[activeGenre]) >= 70 ? 'from-cyan-500 via-blue-400 to-indigo-400' :
                    Math.round(genreScores[activeGenre]) >= 50 ? 'from-yellow-500 via-amber-400 to-orange-400' :
                      Math.round(genreScores[activeGenre]) >= 30 ? 'from-orange-500 via-red-500 to-pink-500' :
                        'from-red-500 via-orange-500 to-yellow-500'
                  } transition-all duration-300`}
                style={{ width: `${clampScore(genreScores[activeGenre])}%` }}
              />
            </div>
          </div>
        )}
      </section>

      <section className="bg-gray-900/70 border border-gray-800/60 rounded-xl p-6 shadow-inner">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-5 h-5 text-cyan-400" aria-hidden="true" />
          <h3 className="text-lg font-semibold text-slate-100">Tonal Balance Comparison</h3>
        </div>
        <div className="w-full h-[75vh] min-h-[500px]">
          <Line data={tonalChartData} options={tonalChartOptions} plugins={[bandEdgesPlugin, bandLabelPlugin]} />
        </div>
      </section>

      <FrequencySpectrum
        frequencyBands={spectralData?.frequencyBands}
        activeGenre={activeGenre}
        profile={activeProfile}
        alignmentOffset={activeAlignmentOffset}
      />

      <Sparkline
        label="Spectral Flux Timeline"
        subtitle="Frame-to-frame magnitude change (normalized)"
        values={fluxValues}
        color="#38bdf8"
        fullWidth
        height={140}
      />

      <Sparkline
        label="Spectral Contrast Timeline"
        subtitle="Average contrast per analysis frame (normalized)"
        values={contrastValues}
        color="#a855f7"
        fullWidth
        height={140}
      />

      <Sparkline
        label="RMS Energy Timeline"
        subtitle="Short-term energy contour across the track"
        values={energyValues}
        color="#f97316"
        fullWidth
        height={140}
      />
    </div >
  );
}

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.min(100, value));
}

function getSpectralLabel(score) {
  if (!Number.isFinite(score)) {
    return 'Unknown';
  }
  if (score >= 70) return 'Well-Balanced';
  if (score >= 60) return 'Balanced';
  if (score >= 50) return 'Unbalanced';
  return 'Very Unbalanced';
}
