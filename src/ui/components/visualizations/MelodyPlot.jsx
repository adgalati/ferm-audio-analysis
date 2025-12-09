import React, { useRef, useEffect, useState, useMemo } from 'react';
import { Chart } from 'chart.js/auto';
import { useAudioPlayer } from '../../contexts/AudioPlayerContext';
import { frequencyToNote } from '../../../utils/key-analysis.js';

function MelodyPlot({ melody, keyAnalysis }) {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const overlayCanvasRef = useRef(null);
  const { currentTime, isInitialized } = useAudioPlayer();
  const [currentMelodyPoint, setCurrentMelodyPoint] = useState(null);
  const [chartDimensions, setChartDimensions] = useState({ width: 0, height: 0 });
  
  // Memoize voicing map for fast lookups (avoids expensive backward/forward searches)
  const voicingMap = useMemo(() => {
    if (!melody || !melody.f0_hz) return {};
    const map = {};
    let lastVoicedIndex = -1;
    
    for (let i = 0; i < melody.f0_hz.length; i++) {
      if (melody.f0_hz[i] > 0) {
        lastVoicedIndex = i;
      }
      map[i] = lastVoicedIndex !== -1 ? lastVoicedIndex : -1;
    }
    
    return map;
  }, [melody]);

  // Find current melody point based on playback time (simplified, no expensive searches)
  useEffect(() => {
    if (!melody || !melody.times || !melody.f0_hz || !isInitialized) return;
    
    // Binary search for closest time
    let closestIndex = 0;
    let closestDistance = Math.abs(melody.times[0] - currentTime);
    
    for (let i = 1; i < melody.times.length; i++) {
      const distance = Math.abs(melody.times[i] - currentTime);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestIndex = i;
      } else if (distance > closestDistance) {
        // If distance is increasing, we've passed the closest point
        break;
      }
    }
    
    if (closestDistance < 0.2) { // Within 200ms
      const frequency = melody.f0_hz[closestIndex];
      const confidence = melody.confidence?.[closestIndex] || 0;
      
      // Use memoized voicing map to find last voiced point
      let lastVoicedIndex = voicingMap[closestIndex] || -1;
      let displayFrequency = frequency > 0 ? frequency : (lastVoicedIndex !== -1 ? melody.f0_hz[lastVoicedIndex] : 0);
      
      setCurrentMelodyPoint({
        time: melody.times[closestIndex],
        frequency: displayFrequency,
        confidence: frequency > 0 ? confidence : 0,
        isSilent: frequency === 0,
        index: closestIndex
      });
    } else {
      setCurrentMelodyPoint(null);
    }
  }, [currentTime, melody, isInitialized, voicingMap]);

  useEffect(() => {
    if (!melody || !chartRef.current) return;

    const ctx = chartRef.current.getContext('2d');

    // Filter out zero frequencies (unvoiced)
    const data = melody.times
      .map((t, i) => ({
        x: t,
        y: melody.f0_hz[i],
        confidence: melody.confidence[i]
      }))
      .filter(d => d.y > 0);

    if (chartInstance.current) {
      chartInstance.current.destroy();
    }

    chartInstance.current = new Chart(ctx, {
      type: 'line',
      data: {
        datasets: [
          {
            label: 'Melody (Hz)',
            data: data,
            borderColor: 'rgb(139, 92, 246)',
            backgroundColor: 'rgba(139, 92, 246, 0.1)',
            pointRadius: 0,
            borderWidth: 2,
            tension: 0.4,
          }
        ]
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
              text: 'Frequency (Hz)',
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
          tooltip: {
            callbacks: {
              label: (context) => {
                const point = data[context.dataIndex];
                const noteInfo = frequencyToNote(point.y);
                const lines = [
                  `Time: ${point.x.toFixed(2)}s`,
                  `Frequency: ${point.y.toFixed(2)} Hz`,
                  `Confidence: ${(point.confidence * 100).toFixed(1)}%`
                ];
                
                if (noteInfo) {
                  lines.push(`Note: ${noteInfo.note}${noteInfo.octave}`);
                  if (noteInfo.cents !== 0) {
                    lines.push(`Cents: ${noteInfo.cents > 0 ? '+' : ''}${noteInfo.cents}`);
                  }
                  
                  // Show key analysis if available
                  if (keyAnalysis && keyAnalysis.noteAnalysis) {
                    const noteAnalysis = keyAnalysis.noteAnalysis.find(n => 
                      Math.abs(n.time - point.x) < 0.1 && Math.abs(n.frequency - point.y) < 1
                    );
                    if (noteAnalysis) {
                      lines.push(`In Key: ${noteAnalysis.isInKey ? 'Yes' : 'No'}`);
                    }
                  }
                }
                
                return lines;
              }
            }
          }
        }
      }
    });

    return () => {
      if (chartInstance.current) {
        chartInstance.current.destroy();
      }
    };
  }, [melody]);

  // Update chart when current melody point changes
  useEffect(() => {
    if (!chartInstance.current || !melody) return;
    
    // Do NOT update chart on every frame - it causes glitches
    // Instead, just track the current point for overlay rendering
  }, [currentMelodyPoint, melody]);

  // Render tracking dot and vertical line on overlay canvas
  useEffect(() => {
    if (!overlayCanvasRef.current || !chartInstance.current || !currentMelodyPoint || !melody) return;

    const chart = chartInstance.current;
    const canvas = overlayCanvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Match overlay canvas to chart size
    canvas.width = chart.canvas.width;
    canvas.height = chart.canvas.height;
    
    // Get chart scale information
    const xScale = chart.scales.x;
    const yScale = chart.scales.y;
    
    if (!xScale || !yScale) return;
    
    // Convert time to pixel position
    const xPixel = xScale.getPixelForValue(currentMelodyPoint.time);
    const yPixel = yScale.getPixelForValue(currentMelodyPoint.frequency);
    
    // Clear overlay
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Draw vertical line
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
    ctx.lineWidth = 2;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.moveTo(xPixel, 0);
    ctx.lineTo(xPixel, canvas.height);
    ctx.stroke();
    ctx.setLineDash([]);
    
    // Draw tracking dot
    const dotRadius = 6;
    ctx.fillStyle = currentMelodyPoint.isSilent ? 'rgba(251, 191, 36, 0.4)' : 'rgba(251, 191, 36, 0.9)';
    ctx.beginPath();
    ctx.arc(xPixel, yPixel, dotRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // Draw dot outline
    ctx.strokeStyle = 'rgb(251, 191, 36)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(xPixel, yPixel, dotRadius, 0, Math.PI * 2);
    ctx.stroke();
  }, [currentMelodyPoint, melody]);

  if (!melody || !Array.isArray(melody.f0_hz) || melody.f0_hz.length === 0) {
    // eslint-disable-next-line no-console
    console.log('[MelodyPlot] No melody data available. Melody keys:', melody ? Object.keys(melody) : null);
    return (
      <div className="text-gray-400 text-center py-12">
        No melody data available
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-lg font-semibold mb-4">Melody Contour</h3>
      
      {/* Key Analysis Display */}
      {keyAnalysis && (
        <div className="mb-4 p-4 bg-blue-900/20 border border-blue-400/30 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div>
              <strong className="text-blue-300">Detected Key:</strong>
              <div className="text-blue-100">
                {keyAnalysis.detectedKey} {keyAnalysis.mode}
              </div>
            </div>
            <div>
              <strong className="text-blue-300">In-Key Percentage:</strong>
              <div className="text-blue-100">
                {keyAnalysis.inKeyPercentage}%
              </div>
            </div>
            <div>
              <strong className="text-blue-300">Scale Notes:</strong>
              <div className="text-blue-100">
                {keyAnalysis.scaleNotes.join(', ')}
              </div>
            </div>
          </div>
        </div>
      )}
      
      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="mb-4 p-3 bg-yellow-900/20 border border-yellow-400/30 rounded-lg">
          <div className="text-sm text-yellow-300">
            {currentMelodyPoint ? (
              <>
                <strong>Current:</strong> {currentMelodyPoint.isSilent ? '0.0' : currentMelodyPoint.frequency.toFixed(1)} Hz 
                ({currentMelodyPoint.time.toFixed(2)}s) 
                - Confidence: {currentMelodyPoint.isSilent ? '0.0' : (currentMelodyPoint.confidence * 100).toFixed(1)}%
                {currentMelodyPoint.isSilent && <span className="text-yellow-200 ml-2">(Silent)</span>}
              </>
            ) : (
              <span className="text-gray-400">Waiting for playback...</span>
            )}
          </div>
        </div>
        <div style={{ height: '300px', position: 'relative' }}>
          <canvas ref={chartRef}></canvas>
          <canvas 
            ref={overlayCanvasRef}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              cursor: 'crosshair',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>
    </div>
  );
}

export default MelodyPlot;
