import React, { useState, useMemo, useRef, useCallback } from 'react';
import { PieChart, RotateCcw, Play, Pause, ExternalLink } from 'lucide-react';
import { getGenreColorHex } from '../utils/genreColors';

/**
 * GenreSessionTracker — lives in the Analysis tab top bar.
 * Shows a colorful SVG pie chart of genre distribution across the session,
 * with a track-count overlay and hover tooltips for sub-style breakdowns.
 *
 * Props:
 *   sessionData   — array of { genre, subgenre } entries (one per analyzed track)
 *   isActive      — whether the session is currently recording
 *   onToggle      — called when user clicks play/pause to start/stop session
 *   onReset       — called when user clicks to clear the session
 *   onPopout      — called when user clicks to pop out into overlay window
 */

const SIZE = 120;
const RADIUS = 48;
const CENTER = SIZE / 2;
const STROKE_WIDTH = 22;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  // Clamp to avoid rendering artifacts on near-full circles
  const sweep = Math.min(endAngle - startAngle, 359.999);
  const end = startAngle + sweep;
  const start = polarToCartesian(cx, cy, r, end);
  const finish = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${finish.x} ${finish.y}`;
}

function GenreSessionTracker({ sessionData = [], isActive = false, onToggle, onReset, onPopout }) {
  const [hoveredGenre, setHoveredGenre] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  const totalTracks = sessionData.length;

  // Aggregate genres: { genre: { count, subgenres: { sub: count } } }
  const genreAgg = useMemo(() => {
    const agg = {};
    for (const entry of sessionData) {
      const g = entry.genre || 'Other';
      if (!agg[g]) agg[g] = { count: 0, subgenres: {} };
      agg[g].count++;
      const sub = entry.subgenre || g;
      agg[g].subgenres[sub] = (agg[g].subgenres[sub] || 0) + 1;
    }
    return agg;
  }, [sessionData]);

  // Convert to slices sorted by count desc
  const slices = useMemo(() => {
    const entries = Object.entries(genreAgg).sort((a, b) => b[1].count - a[1].count);
    let angle = 0;
    return entries.map(([genre, data]) => {
      const fraction = data.count / totalTracks;
      const sweep = fraction * 360;
      const startAngle = angle;
      angle += sweep;
      return {
        genre,
        count: data.count,
        fraction,
        startAngle,
        sweep,
        color: getGenreColorHex(genre),
        subgenres: data.subgenres,
      };
    });
  }, [genreAgg, totalTracks]);

  const handleSliceHover = useCallback((genre, e) => {
    setHoveredGenre(genre);
    if (containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      setTooltipPos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    }
  }, []);

  const handleSliceLeave = useCallback(() => {
    setHoveredGenre(null);
  }, []);

  // Tooltip content for hovered genre
  const tooltipContent = useMemo(() => {
    if (!hoveredGenre || !genreAgg[hoveredGenre]) return null;
    const { count, subgenres } = genreAgg[hoveredGenre];
    const subs = Object.entries(subgenres).sort((a, b) => b[1] - a[1]);
    return { genre: hoveredGenre, count, subs };
  }, [hoveredGenre, genreAgg]);

  return (
    <div
      ref={containerRef}
      className="relative flex items-center gap-4 select-none"
      style={{ minWidth: 180 }}
    >
      {/* Pie Chart */}
      <div className="relative flex-shrink-0" style={{ width: SIZE, height: SIZE }}>
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="drop-shadow-[0_0_12px_rgba(139,92,246,0.25)]"
        >
          {/* Background ring */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(55,65,81,0.6)"
            strokeWidth={STROKE_WIDTH}
          />

          {/* Pie slices */}
          {slices.map((slice) => (
            <path
              key={slice.genre}
              d={describeArc(CENTER, CENTER, RADIUS, slice.startAngle, slice.startAngle + slice.sweep)}
              fill="none"
              stroke={slice.color}
              strokeWidth={STROKE_WIDTH}
              strokeLinecap="butt"
              className="transition-opacity duration-200"
              style={{
                opacity: hoveredGenre && hoveredGenre !== slice.genre ? 0.35 : 1,
                filter: hoveredGenre === slice.genre ? `drop-shadow(0 0 6px ${slice.color})` : 'none',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => handleSliceHover(slice.genre, e)}
              onMouseMove={(e) => handleSliceHover(slice.genre, e)}
              onMouseLeave={handleSliceLeave}
            />
          ))}

          {/* Center text — track count */}
          <text
            x={CENTER}
            y={CENTER - 6}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-white font-extrabold"
            style={{ fontSize: totalTracks >= 100 ? 20 : 26 }}
          >
            {totalTracks}
          </text>
          <text
            x={CENTER}
            y={CENTER + 14}
            textAnchor="middle"
            dominantBaseline="central"
            className="fill-gray-400"
            style={{ fontSize: 10, letterSpacing: '0.05em' }}
          >
            {totalTracks === 1 ? 'TRACK' : 'TRACKS'}
          </text>
        </svg>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-2 min-w-0">
        <div className="text-xs font-semibold uppercase tracking-widest text-gray-400 truncate">
          Session Genres
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onToggle}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              isActive
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-[0_0_10px_rgba(34,211,238,0.15)] hover:bg-cyan-500/30'
                : 'bg-gray-700/60 text-gray-300 border border-gray-600 hover:bg-gray-600 hover:text-white'
            }`}
            title={isActive ? 'Pause session tracking' : 'Start tracking genre distribution'}
          >
            {isActive ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
            {isActive ? 'Tracking' : 'Start'}
          </button>

          {(totalTracks > 0 || isActive) && (
            <button
              onClick={onReset}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-700/60 text-gray-400 border border-gray-600 hover:bg-red-900/30 hover:text-red-300 hover:border-red-500/40 transition-all duration-200"
              title="Reset session — clear all genre data"
            >
              <RotateCcw className="w-3 h-3" />
              Reset
            </button>
          )}

          {onPopout && (
            <button
              onClick={onPopout}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-gray-700/60 text-gray-400 border border-gray-600 hover:bg-purple-900/30 hover:text-purple-300 hover:border-purple-500/40 transition-all duration-200"
              title="Pop out into overlay window for Streamlabs capture"
            >
              <ExternalLink className="w-3 h-3" />
              Pop Out
            </button>
          )}
        </div>

        {/* Mini legend — top 3 genres */}
        {slices.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 mt-1">
            {slices.slice(0, 4).map((s) => (
              <div
                key={s.genre}
                className="flex items-center gap-1.5 text-[11px] text-gray-300 cursor-pointer transition-colors hover:text-white"
                onMouseEnter={(e) => handleSliceHover(s.genre, e)}
                onMouseLeave={handleSliceLeave}
              >
                <span
                  className="inline-block w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: s.color }}
                />
                <span className="truncate max-w-[72px]">{s.genre}</span>
                <span className="text-gray-500">{s.count}</span>
              </div>
            ))}
            {slices.length > 4 && (
              <span className="text-[11px] text-gray-500">+{slices.length - 4} more</span>
            )}
          </div>
        )}
      </div>

      {/* Hover Tooltip */}
      {tooltipContent && (
        <div
          className="absolute z-50 pointer-events-none"
          style={{
            left: tooltipPos.x,
            top: tooltipPos.y - 12,
            transform: 'translate(-50%, -100%)',
          }}
        >
          <div className="bg-gray-900/95 backdrop-blur-lg border border-gray-600/70 rounded-xl px-4 py-3 shadow-2xl shadow-black/40 min-w-[160px]">
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: getGenreColorHex(tooltipContent.genre) }}
              />
              <span className="text-sm font-bold text-white">{tooltipContent.genre}</span>
              <span className="text-xs text-gray-400 ml-auto">{tooltipContent.count} track{tooltipContent.count !== 1 ? 's' : ''}</span>
            </div>
            <div className="space-y-1">
              {tooltipContent.subs.map(([sub, count]) => (
                <div key={sub} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 truncate mr-3">{sub}</span>
                  <span className="text-cyan-300 font-semibold tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GenreSessionTracker;
