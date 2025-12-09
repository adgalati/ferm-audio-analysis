import React from 'react';

/**
 * Loudness Timeline Chart Component
 * Displays loudness variation over time using a simple SVG-based chart
 */
export default function LoudnessTimeline({ timelineData, className = '' }) {
  if (!timelineData || timelineData.length === 0) {
    return (
      <div className={`p-4 text-center text-gray-500 ${className}`}>
        <p>No timeline data available</p>
        <p className="text-sm">Timeline analysis may have failed or is not enabled</p>
      </div>
    );
  }

  // Chart dimensions
  const width = 800;
  const height = 200;
  const padding = 40;
  const chartWidth = width - 2 * padding;
  const chartHeight = height - 2 * padding;

  // Find min/max values for scaling
  const values = timelineData.map(d => d.integrated || d.momentary || d.short_term);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const valueRange = maxValue - minValue;

  // Scale values to chart coordinates
  const scaleY = (value) => {
    return padding + chartHeight - ((value - minValue) / valueRange) * chartHeight;
  };

  const scaleX = (time) => {
    const maxTime = Math.max(...timelineData.map(d => d.time));
    return padding + (time / maxTime) * chartWidth;
  };

  // Generate path for the line
  const pathData = timelineData
    .map((point, index) => {
      const x = scaleX(point.time);
      const y = scaleY(point.integrated || point.momentary || point.short_term);
      return `${index === 0 ? 'M' : 'L'} ${x} ${y}`;
    })
    .join(' ');

  // Generate grid lines
  const gridLines = [];
  const numGridLines = 5;
  for (let i = 0; i <= numGridLines; i++) {
    const value = minValue + (valueRange * i) / numGridLines;
    const y = scaleY(value);
    gridLines.push(
      <line
        key={`grid-${i}`}
        x1={padding}
        y1={y}
        x2={padding + chartWidth}
        y2={y}
        stroke="#e5e7eb"
        strokeWidth="1"
        strokeDasharray="2,2"
      />
    );
  }

  // Generate time axis labels
  const timeLabels = [];
  const maxTime = Math.max(...timelineData.map(d => d.time));
  const numTimeLabels = 6;
  for (let i = 0; i <= numTimeLabels; i++) {
    const time = (maxTime * i) / numTimeLabels;
    const x = scaleX(time);
    timeLabels.push(
      <text
        key={`time-${i}`}
        x={x}
        y={height - 10}
        textAnchor="middle"
        className="text-xs fill-gray-600"
      >
        {time.toFixed(1)}s
      </text>
    );
  }

  // Generate value axis labels
  const valueLabels = [];
  for (let i = 0; i <= numGridLines; i++) {
    const value = minValue + (valueRange * i) / numGridLines;
    const y = scaleY(value);
    valueLabels.push(
      <text
        key={`value-${i}`}
        x={10}
        y={y + 4}
        textAnchor="end"
        className="text-xs fill-gray-600"
      >
        {value.toFixed(1)}
      </text>
    );
  }

  return (
    <div className={`${className}`}>
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-gray-800">Loudness Timeline</h3>
        <p className="text-sm text-gray-600">
          Loudness variation over time ({timelineData.length} data points)
        </p>
      </div>
      
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <svg width={width} height={height} className="w-full h-auto">
          {/* Grid lines */}
          {gridLines}
          
          {/* Chart area */}
          <rect
            x={padding}
            y={padding}
            width={chartWidth}
            height={chartHeight}
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          
          {/* Data line */}
          <path
            d={pathData}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            className="drop-shadow-sm"
          />
          
          {/* Data points */}
          {timelineData.map((point, index) => {
            const x = scaleX(point.time);
            const y = scaleY(point.integrated || point.momentary || point.short_term);
            return (
              <circle
                key={index}
                cx={x}
                cy={y}
                r="2"
                fill="#3b82f6"
                className="hover:r-3 transition-all duration-200"
              />
            );
          })}
          
          {/* Labels */}
          {timeLabels}
          {valueLabels}
          
          {/* Axis labels */}
          <text
            x={width / 2}
            y={height - 5}
            textAnchor="middle"
            className="text-sm font-medium fill-gray-700"
          >
            Time (seconds)
          </text>
          <text
            x={15}
            y={height / 2}
            textAnchor="middle"
            transform={`rotate(-90, 15, ${height / 2})`}
            className="text-sm font-medium fill-gray-700"
          >
            Loudness (LUFS)
          </text>
        </svg>
        
        {/* Legend */}
        <div className="mt-4 flex items-center justify-center space-x-6 text-sm text-gray-600">
          <div className="flex items-center space-x-2">
            <div className="w-4 h-0.5 bg-blue-500"></div>
            <span>Integrated Loudness</span>
          </div>
          <div className="text-xs text-gray-500">
            Range: {minValue.toFixed(1)} to {maxValue.toFixed(1)} LUFS
          </div>
        </div>
      </div>
    </div>
  );
}
