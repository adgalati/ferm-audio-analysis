import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { getGenreColorHex } from '../utils/genreColors';

/**
 * GenreSessionOverlay — standalone pie chart rendered in the transparent overlay window.
 * Receives session data from the main window via IPC.
 * Designed for Streamlabs window capture: transparent background, no chrome.
 */

const SIZE = 300;
const RADIUS = 110;
const CENTER = SIZE / 2;
const STROKE_WIDTH = 48;

function polarToCartesian(cx, cy, r, angleDeg) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

function describeArc(cx, cy, r, startAngle, endAngle) {
  const sweep = Math.min(endAngle - startAngle, 359.999);
  const end = startAngle + sweep;
  const start = polarToCartesian(cx, cy, r, end);
  const finish = polarToCartesian(cx, cy, r, startAngle);
  const largeArcFlag = sweep > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 0 ${finish.x} ${finish.y}`;
}

function GenreSessionOverlay() {
  const [sessionData, setSessionData] = useState([]);
  const [hoveredGenre, setHoveredGenre] = useState(null);

  // Listen for data updates from the main window
  useEffect(() => {
    if (!window.overlayAPI) return;

    const cleanup = window.overlayAPI.onSessionUpdate((data) => {
      setSessionData(data || []);
    });

    // Request initial data
    window.overlayAPI.requestData();

    return () => {
      if (typeof cleanup === 'function') cleanup();
    };
  }, []);

  const totalTracks = sessionData.length;

  // Aggregate genres
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

  // Convert to slices
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

  // Tooltip content
  const tooltipContent = useMemo(() => {
    if (!hoveredGenre || !genreAgg[hoveredGenre]) return null;
    const { count, subgenres } = genreAgg[hoveredGenre];
    const subs = Object.entries(subgenres).sort((a, b) => b[1] - a[1]);
    return { genre: hoveredGenre, count, subs };
  }, [hoveredGenre, genreAgg]);

  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center"
      style={{ background: 'transparent', WebkitAppRegion: 'drag' }}
    >
      {/* Pie Chart */}
      <div
        className="relative"
        style={{
          width: SIZE,
          height: SIZE,
          filter: 'drop-shadow(0 0 18px rgba(0,0,0,0.7)) drop-shadow(0 0 36px rgba(0,0,0,0.35))',
        }}
      >
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
          <defs>
            {/* Soft black glow filter for the shadow halo */}
            <filter id="blackHalo" x="-60%" y="-60%" width="220%" height="220%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="14" result="blur" />
              <feComposite in="blur" in2="SourceGraphic" operator="over" />
            </filter>
          </defs>

          {/* Ambient shadow halo — blurred black circle, soft spread outer glow */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(0,0,0,0.55)"
            strokeWidth={STROKE_WIDTH + 10}
            filter="url(#blackHalo)"
          />

          {/* Background ring */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS}
            fill="none"
            stroke="rgba(45,30,75,0.85)"
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
              style={{
                opacity: hoveredGenre && hoveredGenre !== slice.genre ? 0.25 : 1,
                filter: hoveredGenre === slice.genre
                  ? 'drop-shadow(0 0 4px rgba(0,0,0,0.6))'
                  : 'drop-shadow(0 0 3px rgba(0,0,0,0.4))',
                transition: 'opacity 0.2s, filter 0.25s',
                cursor: 'default',
                WebkitAppRegion: 'no-drag',
              }}
              onMouseEnter={() => setHoveredGenre(slice.genre)}
              onMouseLeave={() => setHoveredGenre(null)}
            />
          ))}

          {/* Center text — track count */}
          <text
            x={CENTER}
            y={CENTER - 10}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontWeight="900"
            style={{
              fontSize: totalTracks >= 100 ? 42 : 54,
              filter: 'drop-shadow(0 0 3px rgba(0,0,0,1)) drop-shadow(0 0 8px rgba(0,0,0,0.8))',
            }}
          >
            {totalTracks}
          </text>
          <text
            x={CENTER}
            y={CENTER + 26}
            textAnchor="middle"
            dominantBaseline="central"
            fill="rgba(196, 238, 255, 0.9)"
            style={{
              fontSize: 15,
              letterSpacing: '0.15em',
              fontWeight: 1000,
              filter: 'drop-shadow(0 0 3px rgba(0,0,0,0.9))',
            }}
          >
            {totalTracks === 1 ? 'TRACK' : 'TRACKS'}
          </text>
        </svg>
      </div>

      {/* Legend */}
      {slices.length > 0 && (
        <div
          className="flex flex-wrap justify-center gap-x-5 gap-y-2 mt-4 px-3"
          style={{ WebkitAppRegion: 'no-drag', maxWidth: SIZE + 80 }}
        >
          {slices.slice(0, 6).map((s) => (
            <div
              key={s.genre}
              className="flex items-center gap-2 cursor-default"
              style={{
                fontSize: 15,
                fontWeight: 600,
                color: hoveredGenre === s.genre ? '#fff' : 'rgba(233,218,255,0.92)',
                textShadow: hoveredGenre === s.genre
                  ? `0 0 8px ${s.color}`
                  : 'none',
                transition: 'color 0.15s, text-shadow 0.2s',
              }}
              onMouseEnter={() => setHoveredGenre(s.genre)}
              onMouseLeave={() => setHoveredGenre(null)}
            >
              <span
                style={{
                  display: 'inline-block',
                  width: 13,
                  height: 13,
                  borderRadius: '50%',
                  backgroundColor: s.color,
                  flexShrink: 0,
                }}
              />
              <span>{s.genre}</span>
              <span style={{ color: 'rgba(167,139,250,0.65)', fontWeight: 400, fontSize: 13 }}>{s.count}</span>
            </div>
          ))}
          {slices.length > 6 && (
            <span style={{ fontSize: 13, color: 'rgba(156,163,175,0.5)' }}>
              +{slices.length - 6} more
            </span>
          )}
        </div>
      )}

      {/* Hover Tooltip */}
      {tooltipContent && (
        <div
          className="absolute pointer-events-none"
          style={{
            top: 16,
            left: '50%',
            transform: 'translateX(-50%)',
            WebkitAppRegion: 'no-drag',
          }}
        >
          <div
            className="rounded-xl px-4 py-3 min-w-[160px]"
            style={{
              background: 'rgba(17,10,40,0.95)',
              backdropFilter: 'blur(14px)',
              border: '1px solid rgba(139,92,246,0.4)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            }}
          >
            <div className="flex items-center gap-2 mb-2">
              <span
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: getGenreColorHex(tooltipContent.genre) }}
              />
              <span className="text-sm font-bold text-white">{tooltipContent.genre}</span>
              <span className="text-xs text-purple-300 ml-auto">
                {tooltipContent.count} track{tooltipContent.count !== 1 ? 's' : ''}
              </span>
            </div>
            <div className="space-y-1">
              {tooltipContent.subs.map(([sub, count]) => (
                <div key={sub} className="flex items-center justify-between text-xs">
                  <span className="text-gray-300 truncate mr-3">{sub}</span>
                  <span className="text-purple-300 font-semibold tabular-nums">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default GenreSessionOverlay;
