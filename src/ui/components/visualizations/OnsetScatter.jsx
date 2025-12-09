import React, { useRef, useEffect } from 'react';
import { Chart } from 'chart.js/auto';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { detectSubdivision } from '../../../utils/timing.js';

// Lightweight custom plugin to draw a vertical playhead and ±35ms tolerance lines
const playheadPlugin = {
  id: 'playhead',
  afterDraw(chart) {
    const opts = chart.options?.plugins?.playhead;
    if (!opts) return;
    const currentTime = opts.currentTime ?? null;
    const grid = opts.grid || null; // { ref0, period, n }
    const { ctx, chartArea, scales } = chart;
    if (!chartArea || !scales?.x || !scales?.y) return;
    const { left, right, top, bottom } = chartArea;

    // Draw tolerance lines at y = ±35ms
    const yScale = scales.y;
    const yPosTop = yScale.getPixelForValue(35);
    const yPosBottom = yScale.getPixelForValue(-35);
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
    ctx.lineWidth = 2;
    // +35ms
    ctx.beginPath();
    ctx.moveTo(left, yPosTop);
    ctx.lineTo(right, yPosTop);
    ctx.stroke();
    // -35ms
    ctx.beginPath();
    ctx.moveTo(left, yPosBottom);
    ctx.lineTo(right, yPosBottom);
    ctx.stroke();
    ctx.restore();

    // Draw timing grid (quarters/eighths/sixteenths/triplets)
    if (grid && grid.period && grid.n && grid.ref0 != null) {
      const xScale = scales.x;
      const beatPeriod = grid.period; // seconds per beat
      const step = beatPeriod / grid.n; // grid step in seconds
      // Determine visible time range
      const tMin = xScale.getValueForPixel(left);
      const tMax = xScale.getValueForPixel(right);
      // Find starting k index such that ref0 + k*step >= tMin
      let kStart = Math.floor((tMin - grid.ref0) / step) - 1;
      if (!Number.isFinite(kStart)) kStart = 0;
      ctx.save();
      for (let k = kStart; k < 100000; k++) {
        const t = grid.ref0 + k * step;
        if (t > tMax + step) break;
        const x = xScale.getPixelForValue(t);
        if (x < left || x > right) continue;
        // Thicker line at downbeats (every beatPeriod)
        const isBeat = Math.abs(((t - grid.ref0) / beatPeriod) - Math.round((t - grid.ref0) / beatPeriod)) < 1e-6;
        ctx.strokeStyle = isBeat ? 'rgba(148, 163, 184, 0.6)' : 'rgba(148, 163, 184, 0.3)';
        ctx.lineWidth = isBeat ? 2 : 1;
        ctx.setLineDash(isBeat ? [] : [3, 4]);
        ctx.beginPath();
        ctx.moveTo(x, top);
        ctx.lineTo(x, bottom);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (currentTime == null) return;
    // Draw vertical playhead at current time
    const xScale = scales.x;
    const xPos = xScale.getPixelForValue(currentTime);
    if (xPos < left || xPos > right) return;
    ctx.save();
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(234, 179, 8, 0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(xPos, top);
    ctx.lineTo(xPos, bottom);
    ctx.stroke();
    ctx.restore();
  }
};

function OnsetScatter({ onsets = [], beats = [], subdivision, gridMode = 'auto' }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const { currentTime } = useAudioPlayer();
  const fullRangeRef = useRef({ min: null, max: null });
  const zoomStateRef = useRef({ dragging: false, startX: 0, startMin: null, startMax: null });

  useEffect(() => {
    if (!onsets.length || !beats.length || !chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');

    // Subdivision-aware deviations (match backend timing computation)
    const detected = (subdivision && subdivision.n && subdivision.period)
      ? subdivision
      : detectSubdivision(beats, onsets);
    let n = detected.n;
    const period = detected.period;
    // Override n by gridMode when requested
    if (gridMode === 'quarter') n = 1;
    else if (gridMode === 'eighth') n = 2;
    else if (gridMode === 'triplet') n = 3;
    else if (gridMode === 'sixteenth') n = 4;
    const ref0 = beats[0];
    const gridStep = period && n ? (period / n) : null;

    const deviations = (!gridStep) ? [] : onsets.map(onset => {
      const k = Math.round((onset - ref0) / gridStep);
      const deviationMs = (onset - (ref0 + k * gridStep)) * 1000;
      return { x: onset, y: deviationMs };
    });

    // Calculate MATE (median absolute) and Bias (median) to match labels & backend
    const abs = deviations.map(d => Math.abs(d.y)).sort((a, b) => a - b);
    const devs = deviations.map(d => d.y).sort((a, b) => a - b);
    const mid = Math.floor(abs.length / 2);
    const mate = abs.length ? (abs.length % 2 === 0 ? (abs[mid - 1] + abs[mid]) / 2 : abs[mid]) : 0;
    const bias = devs.length ? (devs.length % 2 === 0 ? (devs[mid - 1] + devs[mid]) / 2 : devs[mid]) : 0;

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [{
          label: 'Onset Deviations',
          data: deviations,
          backgroundColor: 'rgba(139, 92, 246, 0.6)',
          borderColor: 'rgb(139, 92, 246)',
          pointRadius: 4,
          pointHoverRadius: 6,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            type: 'linear',
            title: {
              display: true,
              text: 'Time (seconds)',
              color: '#9ca3af'
            },
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(75, 85, 99, 0.3)' }
          },
          y: {
            title: {
              display: true,
              text: 'Deviation (ms)',
              color: '#9ca3af'
            },
            ticks: { color: '#9ca3af' },
            grid: { color: 'rgba(75, 85, 99, 0.3)' }
          }
        },
        plugins: {
          legend: {
            labels: { color: '#9ca3af' }
          },
          playhead: {
            currentTime,
            grid: { ref0, period, n }
          }
        }
      },
      plugins: [playheadPlugin]
    });

    // Initialize full x-range from data
    const xs = [...onsets, ...(beats || [])];
    const min = xs.length ? Math.max(0, Math.min(...xs)) : 0;
    const max = xs.length ? Math.max(...xs) : 0;
    fullRangeRef.current = { min, max };

    // Helper to set x scale min/max and update
    const setXRange = (a, b, mode = 'none') => {
      const chart = chartInstance.current;
      if (!chart) return;
      const xScale = chart.options.scales.x;
      xScale.min = a;
      xScale.max = b;
      chart.update(mode);
    };

    // Wheel zoom
    const handleWheel = (e) => {
      e.preventDefault();
      const chart = chartInstance.current;
      if (!chart) return;
      const scale = chart.scales.x;
      const { min: fullMin, max: fullMax } = fullRangeRef.current;
      const curMin = chart.options.scales.x.min ?? scale.min;
      const curMax = chart.options.scales.x.max ?? scale.max;
      const mouseX = e.offsetX;
      const t = scale.getValueForPixel(mouseX);
      const range = Math.max(0.001, curMax - curMin);
      const zoomIn = e.deltaY < 0;
      const factor = zoomIn ? 0.9 : 1.1;
      let newRange = Math.max((fullMax - fullMin) / 500, Math.min((fullMax - fullMin), range * factor));
      let newMin = t - (t - curMin) * (newRange / range);
      let newMax = newMin + newRange;
      if (newMin < fullMin) { newMin = fullMin; newMax = fullMin + newRange; }
      if (newMax > fullMax) { newMax = fullMax; newMin = fullMax - newRange; }
      setXRange(newMin, newMax);
    };

    // Drag pan
    const handlePointerDown = (e) => {
      const chart = chartInstance.current;
      if (!chart) return;
      const scale = chart.scales.x;
      zoomStateRef.current.dragging = true;
      zoomStateRef.current.startX = e.clientX;
      zoomStateRef.current.startMin = chart.options.scales.x.min ?? scale.min;
      zoomStateRef.current.startMax = chart.options.scales.x.max ?? scale.max;
    };
    const handlePointerMove = (e) => {
      if (!zoomStateRef.current.dragging) return;
      const chart = chartInstance.current;
      if (!chart) return;
      const scale = chart.scales.x;
      const dxPx = e.clientX - zoomStateRef.current.startX;
      const t0 = scale.getValueForPixel(0);
      const t1 = scale.getValueForPixel(dxPx);
      const delta = (t1 - t0);
      const { min: fullMin, max: fullMax } = fullRangeRef.current;
      let newMin = zoomStateRef.current.startMin - delta;
      let newMax = zoomStateRef.current.startMax - delta;
      const width = newMax - newMin;
      if (newMin < fullMin) { newMin = fullMin; newMax = newMin + width; }
      if (newMax > fullMax) { newMax = fullMax; newMin = newMax - width; }
      setXRange(newMin, newMax);
    };
    const handlePointerUp = () => { zoomStateRef.current.dragging = false; };

    const canvas = chartInstance.current.canvas;
    canvas.addEventListener('wheel', handleWheel, { passive: false });
    canvas.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
      canvas.removeEventListener('wheel', handleWheel);
      canvas.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [onsets, beats, subdivision, gridMode]);

  // Update playhead position as audio plays
  useEffect(() => {
    if (!chartInstance.current) return;
    const opts = chartInstance.current.options;
    if (opts && opts.plugins && opts.plugins.playhead) {
      opts.plugins.playhead.currentTime = currentTime;
      chartInstance.current.update('none');
    }
  }, [currentTime]);

  if (!onsets.length || !beats.length) {
    return (
      <div className="text-gray-400 text-center py-12">
        Need both onset and beat data for timing analysis
      </div>
    );
  }

  // Calculate statistics (subdivision-aware, median-based)
  let mate = 0, bias = 0;
  let gridLabel = null;
  let stepMs = null;
  let beatMs = null;
  if (onsets.length && beats.length) {
    const detected = (subdivision && subdivision.n && subdivision.period)
      ? subdivision
      : detectSubdivision(beats, onsets);
    let n = detected.n;
    const period = detected.period;
    if (gridMode === 'quarter') n = 1;
    else if (gridMode === 'eighth') n = 2;
    else if (gridMode === 'triplet') n = 3;
    else if (gridMode === 'sixteenth') n = 4;
    const ref0 = beats[0];
    const gridStep = period && n ? (period / n) : null;
    if (gridStep) {
      const devs = onsets.map(onset => (onset - (ref0 + Math.round((onset - ref0) / gridStep) * gridStep)) * 1000);
      const sortedAbs = devs.map(v => Math.abs(v)).sort((a, b) => a - b);
      const sorted = devs.slice().sort((a, b) => a - b);
      const mid = Math.floor(sorted.length / 2);
      mate = sortedAbs.length ? (sortedAbs.length % 2 === 0 ? (sortedAbs[mid - 1] + sortedAbs[mid]) / 2 : sortedAbs[mid]) : 0;
      bias = sorted.length ? (sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid]) : 0;
      stepMs = gridStep * 1000;
      beatMs = period * 1000;
      gridLabel = n === 1 ? 'quarters' : n === 2 ? '8ths' : n === 3 ? 'triplets' : '16ths';
    }
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Onset Timing Analysis</h3>
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-gray-900 rounded p-3">
            <p className="text-xs text-gray-500 mb-1">MATE (Median Absolute Timing Error)</p>
            <p className="text-2xl font-bold text-primary-300">{mate.toFixed(2)} ms</p>
          </div>
          <div className="bg-gray-900 rounded p-3">
            <p className="text-xs text-gray-500 mb-1">Timing Bias</p>
            <p className="text-2xl font-bold text-blue-300">
              {bias > 0 ? '+' : ''}{bias.toFixed(2)} ms
            </p>
            <p className="text-xs text-gray-500">{bias > 0 ? 'Late' : bias < 0 ? 'Early' : 'On Time'}</p>
          </div>
        </div>
        {gridLabel && (
          <div className="mb-3 text-xs text-gray-400">
            Subdivision: <span className="text-gray-200 font-medium">{gridLabel}</span>
            {stepMs != null && <> • Step: {stepMs.toFixed(1)} ms</>}
            {beatMs != null && <> • Beat: {beatMs.toFixed(1)} ms</>}
          </div>
        )}
        
        <div className="flex items-center justify-between mb-2 text-xs text-gray-400">
          <div>Scroll to zoom • Drag to pan</div>
          <button
            className="px-2 py-1 border border-gray-600 rounded hover:bg-gray-700"
            onClick={() => {
              const { min, max } = fullRangeRef.current;
              if (chartInstance.current) {
                const xScale = chartInstance.current.options.scales.x;
                xScale.min = min; xScale.max = max; chartInstance.current.update('none');
              }
            }}
          >Reset Zoom</button>
        </div>
        <div style={{ height: '300px' }}>
          <canvas ref={chartRef}></canvas>
        </div>
        
        <p className="text-xs text-gray-500 mt-4 text-center">
          Points show how far each onset is from the nearest beat. Dashed lines at ±35ms show tolerance thresholds.
        </p>
      </div>
    </div>
  );
}

export default OnsetScatter;
