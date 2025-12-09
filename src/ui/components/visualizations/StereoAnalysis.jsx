import React from 'react';
import { Activity, ArrowRightLeft, Waves, AlertTriangle } from 'lucide-react';

export default function StereoAnalysis({ spatialData }) {
  if (!spatialData) {
    return null;
  }

  const { phaseCorrelation, widthScore, widthDescription, sideLoudness, midLoudness } = spatialData;

  // Normalize correlation from -1..1 to 0..100 for meter
  const correlationPercent = ((phaseCorrelation + 1) / 2) * 100;

  // Color for phase
  let phaseColor = 'text-green-400';
  let phaseBg = 'bg-green-500';
  let phaseMessage = 'Good Phase Coherence';

  if (phaseCorrelation < 0) {
    phaseColor = 'text-red-400';
    phaseBg = 'bg-red-500';
    phaseMessage = 'Phase Cancellation Detected!';
  } else if (phaseCorrelation < 0.5) {
    phaseColor = 'text-yellow-400';
    phaseBg = 'bg-yellow-500';
    phaseMessage = 'Weak Phase Coherence';
  }

  // Color for width
  let widthColor = 'text-blue-400';
  if (widthScore < 20) widthColor = 'text-gray-400'; // Mono
  else if (widthScore >= 80) widthColor = 'text-purple-400'; // Super wide

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Phase Correlation Meter */}
        <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className={`w-5 h-5 ${phaseColor}`} />
              <h3 className="font-semibold text-gray-200">Phase Correlation</h3>
            </div>
            <span className={`text-lg font-bold font-mono ${phaseColor}`}>
              {phaseCorrelation.toFixed(3)}
            </span>
          </div>

          <div className="relative h-6 bg-gray-700 rounded-full overflow-hidden mb-2">
            {/* Background zones */}
            <div className="absolute inset-0 flex">
              <div className="w-1/2 bg-red-900/30 h-full border-r border-gray-600"></div>
              <div className="w-1/2 bg-green-900/30 h-full"></div>
            </div>

            {/* Zero marker */}
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-400 transform -translate-x-1/2 z-10"></div>

            {/* Indicator */}
            <div
              className={`absolute top-0 bottom-0 w-2 h-full ${phaseBg} transition-all duration-500 shadow-[0_0_10px_rgba(0,0,0,0.5)] border border-white/20`}
              style={{ left: `${Math.max(0, Math.min(100, correlationPercent))}%`, transform: 'translateX(-50%)' }}
            />
          </div>

          <div className="flex justify-between text-xs text-gray-500 font-mono px-1 mb-3">
            <span>-1</span>
            <span>0</span>
            <span>+1</span>
          </div>

          <div className="flex items-start gap-2 bg-gray-900/50 rounded p-3 text-sm">
            {phaseCorrelation < 0 ? (
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            ) : (
              <Activity className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
            )}
            <div>
              <div className={`font-medium ${phaseColor} mb-0.5`}>{phaseMessage}</div>
              <p className="text-gray-400 text-xs">
                {phaseCorrelation < 0
                  ? "Warning: Negative correlation means left and right channels are cancelling each other out. Check your stereo widening effects or mic placement."
                  : "Positive values indicate good mono compatibility."}
              </p>
            </div>
          </div>
        </div>

        {/* Stereo Width Gauge */}
        <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Waves className={`w-5 h-5 ${widthColor}`} />
              <h3 className="font-semibold text-gray-200">Stereo Width</h3>
            </div>
            <span className={`text-lg font-bold ${widthColor}`}>
              {widthScore.toFixed(0)}/100
            </span>
          </div>

          <div className="relative h-32 flex items-end justify-center mb-2 overflow-hidden">
            {/* Semicircle gauge background */}
            <div className="absolute bottom-0 w-64 h-32 bg-gray-700 rounded-t-full opacity-20 border-t border-gray-600"></div>

            {/* Needle */}
            <div
              className="absolute bottom-0 w-1 h-28 bg-gray-200 origin-bottom transition-transform duration-700 ease-out z-10"
              style={{
                transform: `rotate(${(widthScore / 100) * 180 - 90}deg)`,
                boxShadow: '0 0 10px rgba(0,0,0,0.5)'
              }}
            ></div>
            <div className="absolute bottom-0 w-4 h-4 bg-gray-200 rounded-full z-20"></div>

            {/* Labels */}
            <div className="absolute bottom-8 text-center z-0">
              <div className={`text-xl font-bold ${widthColor}`}>{widthDescription}</div>
              <div className="text-xs text-gray-500 mt-1">Width Factor</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-4">
            <div className="bg-gray-900/50 rounded p-2 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Mid Level</div>
              <div className="text-gray-200 font-mono font-semibold">
                {midLoudness > -90 ? `${midLoudness.toFixed(1)} LUFS` : '--'}
              </div>
            </div>
            <div className="bg-gray-900/50 rounded p-2 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider">Side Level</div>
              <div className="text-gray-200 font-mono font-semibold">
                {sideLoudness > -90 ? `${sideLoudness.toFixed(1)} LUFS` : '--'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stereo Image Histogram */}
      {spatialData.histogram && (
        <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-indigo-400" />
              <h3 className="font-semibold text-gray-200">Stereo Image Distribution</h3>
            </div>
          </div>

          <div className="flex justify-center">
            <StereoHistogram data={spatialData.histogram} />
          </div>

          <div className="text-center text-xs text-gray-500 mt-2">
            Displays energy distribution across the stereo field (Left to Right)
          </div>
        </div>
      )}
    </div>
  );
}

function StereoHistogram({ data }) {
  if (!data || data.length === 0) return null;

  // Data is 36 bins from -90 to +90 degrees
  // We want to plot a polar histogram (semicircle)

  const width = 300;
  const height = 160;
  const centerX = width / 2;
  const centerY = height - 10;
  const radius = 140;

  // Generate path for the filled area
  let pathD = `M ${centerX} ${centerY}`; // Start at center

  // We need to map bins to angles
  // Bin 0 = -90 deg (Left) -> 180 deg in SVG coord system (if 0 is right)
  // Actually in SVG: 0 is Right, 90 is Down, 180 is Left, 270 is Up.
  // We want a semicircle from Left (180) to Right (0) going upwards (negative Y).
  // Wait, standard math angle: 0 is Right, 90 is Up, 180 is Left.
  // So we want 180 (Left) to 0 (Right).

  // Our data: 0..35 bins.
  // Bin 0 is -90 deg (Left).
  // Bin 35 is +90 deg (Right).

  // Let's map bin index to angle in radians for SVG (0 is Right, counter-clockwise is negative Y in screen coords? No, Y is down).
  // SVG coords:
  // x = cx + r * cos(a)
  // y = cy + r * sin(a)
  // We want Left (-1, 0) to Right (1, 0) via Top (0, -1).
  // Left is PI (180 deg). Right is 0 (0 deg). Top is -PI/2 (270 deg / -90 deg).

  // Our bins:
  // Bin 0 (-90 deg stereo) -> Should be Left side of plot -> Angle PI
  // Bin 35 (+90 deg stereo) -> Should be Right side of plot -> Angle 0
  // Center (0 deg stereo) -> Should be Top of plot -> Angle -PI/2

  // So we map bin 0..35 to PI..0

  const points = [];

  for (let i = 0; i < data.length; i++) {
    const val = data[i];
    // Map i to angle
    // i=0 -> PI
    // i=35 -> 0
    const angle = Math.PI - (i / (data.length - 1)) * Math.PI;

    // Calculate radius for this point (scaled by value)
    // Use square root scaling to boost smaller values (better visibility for dynamic range)
    // Add small base radius so we can see 0 values
    const scaledVal = Math.sqrt(val);
    const r = 20 + (scaledVal * (radius - 20));

    const x = centerX + r * Math.cos(angle);
    const y = centerY - r * Math.sin(angle); // Subtract because Y grows down

    points.push({ x, y });
  }

  // Construct path
  // Move to first point
  if (points.length > 0) {
    // We want to draw a shape that goes from center, to p1, p2... pn, back to center
    // But for a smooth look, maybe just the outline?
    // Let's do a polygon

    // Start at center
    pathD = `M ${centerX} ${centerY}`;

    // Line to each point
    points.forEach(p => {
      pathD += ` L ${p.x} ${p.y}`;
    });

    // Close back to center
    pathD += ` Z`;
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      {/* Background Grid */}
      <path d={`M ${centerX - radius} ${centerY} A ${radius} ${radius} 0 0 1 ${centerX + radius} ${centerY}`}
        fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="4 4" />
      <path d={`M ${centerX - radius * 0.66} ${centerY} A ${radius * 0.66} ${radius * 0.66} 0 0 1 ${centerX + radius * 0.66} ${centerY}`}
        fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="4 4" />
      <path d={`M ${centerX - radius * 0.33} ${centerY} A ${radius * 0.33} ${radius * 0.33} 0 0 1 ${centerX + radius * 0.33} ${centerY}`}
        fill="none" stroke="#374151" strokeWidth="1" strokeDasharray="4 4" />

      {/* Angle lines */}
      <line x1={centerX} y1={centerY} x2={centerX} y2={centerY - radius} stroke="#374151" strokeWidth="1" />
      <line x1={centerX} y1={centerY} x2={centerX - radius * Math.cos(Math.PI / 4)} y2={centerY - radius * Math.sin(Math.PI / 4)} stroke="#374151" strokeWidth="1" />
      <line x1={centerX} y1={centerY} x2={centerX + radius * Math.cos(Math.PI / 4)} y2={centerY - radius * Math.sin(Math.PI / 4)} stroke="#374151" strokeWidth="1" />

      {/* Data Polygon */}
      <path d={pathD} fill="rgba(129, 140, 248, 0.5)" stroke="#818cf8" strokeWidth="2" strokeLinejoin="round" />

      {/* Labels */}
      <text x={centerX - radius - 10} y={centerY} fill="#9ca3af" fontSize="10" textAnchor="end">L</text>
      <text x={centerX + radius + 10} y={centerY} fill="#9ca3af" fontSize="10" textAnchor="start">R</text>
      <text x={centerX} y={centerY - radius - 5} fill="#9ca3af" fontSize="10" textAnchor="middle">C</text>
    </svg>
  );
}


