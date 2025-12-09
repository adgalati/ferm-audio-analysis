import React, { useState, useEffect, useRef } from 'react';
import { getGenreColorHex } from '../../utils/genreColors';

function GenreDNA({ tags = [] }) {
  const [animatedNodes, setAnimatedNodes] = useState([]);
  const [layoutCalculated, setLayoutCalculated] = useState(false);
  const [zoom, setZoom] = useState({ scale: 0.7, translateX: 0, translateY: 0 });
  const [isZooming, setIsZooming] = useState(false);
  const svgRef = useRef(null);
  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const zoomTimeoutRef = useRef(null);

  if (!tags || tags.length === 0) {
    return (
      <div className="text-gray-400 text-center py-12">
        <div className="w-32 h-32 mx-auto mb-4 rounded-full border-4 border-gray-600 flex items-center justify-center">
          <span className="text-gray-500 text-sm">No genre data</span>
        </div>
        <p>No genre tags available for DNA visualization</p>
      </div>
    );
  }

  // Use ALL tags - no filtering beyond what List View shows
  const allTags = tags;

  // First: Normalize all subgenre/style percentages to add up to 100%
  const totalScore = allTags.reduce((sum, tag) => sum + tag.score, 0);
  const normalizedTags = allTags.map(tag => ({
    ...tag,
    percentage: (tag.score / totalScore) * 100
  }));

  // Group normalized tags by primary genre
  const genreGroups = {};
  normalizedTags.forEach(tag => {
    const primaryGenre = tag.genre;
    if (!genreGroups[primaryGenre]) {
      genreGroups[primaryGenre] = {
        genre: primaryGenre,
        subgenres: [],
        totalPercentage: 0
      };
    }
    genreGroups[primaryGenre].subgenres.push(tag);
    genreGroups[primaryGenre].totalPercentage += tag.percentage;
  });

  // Convert to array and sort by total percentage
  const primaryGenres = Object.values(genreGroups).sort((a, b) => b.totalPercentage - a.totalPercentage);

  // Calculate primary genre percentages (sum of their subgenres)
  const processedGenres = primaryGenres.map(genreGroup => ({
    ...genreGroup,
    percentage: genreGroup.totalPercentage // Primary % = sum of its subgenres
  }));

  // Calculate bubble sizes based on percentages
  const maxPercentage = Math.max(...processedGenres.map(g => g.percentage));
  const minRadius = 40;
  const maxRadius = 100;

  const calculateBubbleSize = (percentage) => {
    const normalizedPercentage = percentage / maxPercentage;
    return minRadius + (normalizedPercentage * (maxRadius - minRadius));
  };

  // Create nodes for layout
  const createNodes = () => {
    const nodes = [];
    const links = [];

    processedGenres.forEach((genreGroup, genreIndex) => {
      const primaryRadius = calculateBubbleSize(genreGroup.percentage);
      const safeGenreId = genreGroup.genre.toLowerCase().replace(/[^a-z0-9]/g, '');

      // Primary genre node
      nodes.push({
        id: `genre-${safeGenreId}`,
        name: genreGroup.genre,
        type: 'primary',
        radius: primaryRadius,
        percentage: genreGroup.percentage,
        color: getGenreColorHex(genreGroup.genre),
        fx: null, // Will be set by layout
        fy: null
      });

      // Subgenre nodes - size based on their percentage of ALL styles
      genreGroup.subgenres.forEach((subgenre, subIndex) => {
        // Calculate subgenre bubble size based on percentage of total (not just within genre)
        const subgenrePercentage = subgenre.percentage;
        const maxSubgenrePercentage = Math.max(...normalizedTags.map(t => t.percentage));
        const subgenreRadius = Math.max(20, (subgenrePercentage / maxSubgenrePercentage) * 60);

        const subName = subgenre.subgenre || subgenre.genre;
        const safeSubId = subName.toLowerCase().replace(/[^a-z0-9]/g, '');

        nodes.push({
          id: `subgenre-${safeGenreId}-${safeSubId}`,
          name: subName,
          type: 'subgenre',
          radius: subgenreRadius,
          percentage: subgenre.percentage,
          parentId: `genre-${safeGenreId}`,
          color: getGenreColorHex(genreGroup.genre),
          fx: null,
          fy: null
        });

        links.push({
          source: `genre-${safeGenreId}`,
          target: `subgenre-${safeGenreId}-${safeSubId}`,
          strength: 0.3
        });
      });
    });

    return { nodes, links };
  };

  // Animation effect
  useEffect(() => {
    const timer = setTimeout(() => {
      const { nodes, links } = createNodes();
      setAnimatedNodes({ nodes, links });
      setLayoutCalculated(true);
    }, 100);
    return () => clearTimeout(timer);
  }, [processedGenres]);

  // Attach native wheel event listener to prevent page scroll when zooming
  const containerRef = useRef(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (!svgRef.current) return;

      // Show zooming state
      setIsZooming(true);

      // Clear existing timeout
      if (zoomTimeoutRef.current) {
        clearTimeout(zoomTimeoutRef.current);
      }

      // Hide cursor after 150ms of no zooming
      zoomTimeoutRef.current = setTimeout(() => {
        setIsZooming(false);
      }, 150);

      const svgRect = svgRef.current.getBoundingClientRect();
      const mouseX = e.clientX - svgRect.left;
      const mouseY = e.clientY - svgRect.top;

      // Calculate zoom center relative to current transform
      const zoomCenterX = (mouseX - zoom.translateX) / zoom.scale;
      const zoomCenterY = (mouseY - zoom.translateY) / zoom.scale;

      // Calculate new scale (zoom in on scroll up, out on scroll down)
      const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.5, Math.min(5, zoom.scale * zoomDelta));

      // Adjust translation to zoom towards mouse position
      const newTranslateX = mouseX - zoomCenterX * newScale;
      const newTranslateY = mouseY - zoomCenterY * newScale;

      setZoom({
        scale: newScale,
        translateX: newTranslateX,
        translateY: newTranslateY
      });
    };

    // Attach with passive: false to allow preventDefault
    container.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      container.removeEventListener('wheel', handleNativeWheel);
    };
  }, [zoom]);

  // Chart dimensions - optimized for container fit
  const width = 900;
  const height = 550;
  const centerY = height / 2;

  // Helper functions
  const polarToCartesian = (centerX, centerY, radius, angleInDegrees) => {
    const angleInRadians = (angleInDegrees - 90) * Math.PI / 180.0;
    return {
      x: centerX + (radius * Math.cos(angleInRadians)),
      y: centerY + (radius * Math.sin(angleInRadians))
    };
  };

  // Radial layout for 3D cluster effect
  const calculateRadialPositions = (nodes) => {
    const primaryNodes = nodes.filter(n => n.type === 'primary');
    const subgenreNodes = nodes.filter(n => n.type === 'subgenre');

    const baseClusterRadius = Math.min(width, height) / 3.5; // Slightly smaller base radius to allow more room for orbits

    // 1) Place primary genres on a circle
    const centerX = width / 2;

    primaryNodes.forEach((node, index) => {
      const angle = (2 * Math.PI * index) / primaryNodes.length;
      const radiusOffset = node.radius * 0.3; // slight depth variance
      const r = baseClusterRadius + radiusOffset;

      node.fx = centerX + r * Math.cos(angle);
      node.fy = centerY + r * Math.sin(angle * 0.8); // 0.8 flattens vertically for “tilt”
    });

    // 2) Subgenres orbit around their parent
    subgenreNodes.forEach(node => {
      const parent = primaryNodes.find(p => p.id === node.parentId);
      if (!parent) return;

      const siblings = subgenreNodes.filter(s => s.parentId === node.parentId);
      const index = siblings.indexOf(node);

      const importance = node.percentage / 100; // 0–1
      const innerOrbit = parent.radius + 50;
      const outerOrbit = parent.radius + 140;
      const orbitRadius = innerOrbit + (1 - importance) * (outerOrbit - innerOrbit);

      // Distribute evenly around the parent, but pointing outwards from center
      const parentAngle = Math.atan2(parent.fy - centerY, parent.fx - centerX);

      // Arc spread depends on number of siblings
      const spread = Math.min(Math.PI * 1.5, siblings.length * 0.5);
      const startAngle = parentAngle - spread / 2;
      const angleStep = spread / (siblings.length + 1);

      const angle = startAngle + (index + 1) * angleStep;

      node.fx = parent.fx + orbitRadius * Math.cos(angle);
      node.fy = parent.fy + orbitRadius * Math.sin(angle);
    });

    // 3) Collision Detection & Resolution
    const allNodes = [...primaryNodes, ...subgenreNodes];
    const iterations = 50;

    for (let k = 0; k < iterations; k++) {
      let moved = false;
      for (let i = 0; i < allNodes.length; i++) {
        for (let j = i + 1; j < allNodes.length; j++) {
          const a = allNodes[i];
          const b = allNodes[j];

          const dx = a.fx - b.fx;
          const dy = a.fy - b.fy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minDist = a.radius + b.radius + 30; // 30px padding

          if (dist < minDist && dist > 0) {
            const overlap = minDist - dist;
            const moveX = (dx / dist) * overlap * 0.5;
            const moveY = (dy / dist) * overlap * 0.5;

            // If one is primary and other is subgenre, move subgenre more
            if (a.type === 'primary' && b.type === 'subgenre') {
              b.fx -= moveX * 1.8;
              b.fy -= moveY * 1.8;
              a.fx += moveX * 0.2;
              a.fy += moveY * 0.2;
            } else if (a.type === 'subgenre' && b.type === 'primary') {
              a.fx += moveX * 1.8;
              a.fy += moveY * 1.8;
              b.fx -= moveX * 0.2;
              b.fy -= moveY * 0.2;
            } else {
              // Equal movement
              a.fx += moveX;
              a.fy += moveY;
              b.fx -= moveX;
              b.fy -= moveY;
            }
            moved = true;
          }
        }
      }
      if (!moved) break;
    }

    return allNodes;
  };

  if (!animatedNodes.nodes || !layoutCalculated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
      </div>
    );
  }

  const { nodes, links } = animatedNodes;
  const positionedNodes = calculateRadialPositions([...nodes]);

  // Zoom and Pan handlers
  const handleMouseDown = (e) => {
    if (e.button === 0) { // Left mouse button
      isDragging.current = true;
      dragStart.current = {
        x: e.clientX - zoom.translateX,
        y: e.clientY - zoom.translateY
      };
      e.currentTarget.style.cursor = 'none';
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging.current) {
      setZoom(prev => ({
        ...prev,
        translateX: e.clientX - dragStart.current.x,
        translateY: e.clientY - dragStart.current.y
      }));
    }
  };

  const handleMouseUp = (e) => {
    isDragging.current = false;
    e.currentTarget.style.cursor = 'grab';
  };

  const handleMouseLeave = (e) => {
    isDragging.current = false;
    e.currentTarget.style.cursor = 'grab';
    setIsZooming(false);
  };

  const resetZoom = () => {
    setZoom({ scale: 0.7, translateX: 0, translateY: 0 });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-gradient-to-r from-purple-400 to-blue-400" />
          Genre Web
        </h3>
        <div className="text-xs text-gray-500">
          {processedGenres.length} primary genres • {allTags.length} styles detected
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
        <div className="flex flex-col items-center">
          {/* Zoom Controls */}
          <div className="mb-4 flex items-center gap-2">
            <button
              onClick={() => setZoom(prev => ({
                ...prev,
                scale: Math.min(5, prev.scale * 1.2)
              }))}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              title="Zoom In"
            >
              +
            </button>
            <button
              onClick={() => setZoom(prev => ({
                ...prev,
                scale: Math.max(0.5, prev.scale * 0.8)
              }))}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              title="Zoom Out"
            >
              −
            </button>
            <button
              onClick={resetZoom}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded-lg text-sm transition-colors"
              title="Reset Zoom"
            >
              Reset
            </button>
            <span className="text-xs text-gray-400 ml-2">
              {Math.round(zoom.scale * 100)}%
            </span>
          </div>

          {/* SVG Bubble Chart */}
          <div
            ref={containerRef}
            className="relative overflow-hidden rounded-lg border border-gray-600 mx-auto"
            style={{
              width: `${width}px`,
              height: `${height}px`,
              cursor: isZooming || isDragging.current ? 'none' : 'grab',
              maxWidth: '100%'
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
          >
            <svg
              ref={svgRef}
              width={width}
              height={height}
              style={{ display: 'block' }}
            >
              <g transform={`translate(${zoom.translateX}, ${zoom.translateY}) scale(${zoom.scale})`}>
                {/* NEW wrapper group for DNA cluster */}
                <g className="dna-cluster">

                  <defs>
                    {positionedNodes.map(node => (
                      <radialGradient id={`bubble-grad-${node.id}`} key={`grad-${node.id}`}>
                        <stop offset="0%" stopColor={node.color} />
                        <stop offset="60%" stopColor={node.color + 'AA'} />
                        <stop offset="100%" stopColor={node.color + '22'} />
                      </radialGradient>
                    ))}

                    <filter id="bubble-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="8" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>

                  {/* Background DNA strands */}
                  {Array.from({ length: 3 }).map((_, i) => {
                    const offsetX = width / 2 - 250 + i * 220;
                    const topY = centerY - 180;
                    const bottomY = centerY + 180;

                    return (
                      <g key={`strand-${i}`} opacity={0.25}>
                        {/* Vertical sinusoid-like backbone */}
                        <path
                          d={`
                            M ${offsetX},${topY}
                            C ${offsetX + 40},${topY + 80},
                              ${offsetX - 40},${centerY - 80},
                              ${offsetX},${centerY}
                            C ${offsetX + 40},${centerY + 80},
                              ${offsetX - 40},${bottomY - 80},
                              ${offsetX},${bottomY}
                          `}
                          stroke="rgba(148, 163, 255, 0.6)"
                          strokeWidth="1.2"
                          fill="none"
                        />
                        {/* Rungs */}
                        {Array.from({ length: 10 }).map((__, j) => {
                          const t = j / 9;
                          const y = topY + (bottomY - topY) * t;
                          return (
                            <line
                              key={j}
                              x1={offsetX - 18}
                              y1={y}
                              x2={offsetX + 18}
                              y2={y}
                              stroke="rgba(148, 163, 255, 0.4)"
                              strokeWidth="1"
                            />
                          );
                        })}
                      </g>
                    );
                  })}

                  {/* Orbit rings for primary genres */}
                  {positionedNodes
                    .filter(n => n.type === 'primary')
                    .map((node, index) => (
                      <circle
                        key={`orbit-${node.id}`}
                        cx={node.fx}
                        cy={node.fy}
                        r={node.radius + 80}
                        fill="none"
                        stroke={node.color + '33'}
                        strokeWidth="1.5"
                        strokeDasharray="8 10"
                        opacity={0}
                        style={{
                          animation: `fadeInScale 1s ease-out ${index * 0.1 + 0.1}s forwards`
                        }}
                      />
                    ))}

                  {/* Connections/Links */}
                  {links.map((link, index) => {
                    const sourceNode = positionedNodes.find(n => n.id === link.source);
                    const targetNode = positionedNodes.find(n => n.id === link.target);
                    if (!sourceNode || !targetNode) return null;

                    const midY = (sourceNode.fy + targetNode.fy) / 2;
                    const pathD = `
                      M ${sourceNode.fx},${sourceNode.fy}
                      C ${sourceNode.fx},${midY}
                        ${targetNode.fx},${midY}
                        ${targetNode.fx},${targetNode.fy}
                    `;

                    return (
                      <g key={`link-${index}`}>
                        <path
                          d={pathD}
                          stroke="rgba(255, 255, 255, 0.18)"
                          strokeWidth="1.5"
                          fill="none"
                          opacity={0}
                          style={{
                            animation: `fadeInScale 1s ease-out ${index * 0.1 + 0.2}s forwards`
                          }}
                        />

                        {/* Optional: a soft outer glow around the strand */}
                        <path
                          d={pathD}
                          stroke={sourceNode.color + '33'}
                          strokeWidth="5"
                          fill="none"
                          opacity={0}
                          style={{
                            animation: `fadeInScale 1s ease-out ${index * 0.1 + 0.2}s forwards`
                          }}
                        />

                        {/* Moving pulses on strands */}
                        <circle r="3" fill="white" opacity={0.9}>
                          <animateMotion
                            dur="3s"
                            repeatCount="indefinite"
                            path={pathD}
                            keyPoints="0;1"
                            keyTimes="0;1"
                          />
                        </circle>
                      </g>
                    );
                  })}

                  {/* Bubbles */}
                  {positionedNodes.map((node, index) => (
                    <circle
                      key={`bubble-${node.id}`}
                      cx={node.fx}
                      cy={node.fy}
                      r={node.radius}
                      fill={`url(#bubble-grad-${node.id})`}
                      stroke="rgba(255, 255, 255, 0.4)"
                      strokeWidth={node.type === 'primary' ? 2.5 : 1.5}
                      opacity={0}
                      style={{
                        animation: `fadeInScale 1s ease-out ${index * 0.1 + 0.2}s forwards`,
                        filter: 'url(#bubble-glow)'
                      }}
                      className="cursor-pointer hover:opacity-90 transition-opacity"
                    />
                  ))}

                  {/* Text Layer - Rendered after bubbles to ensure top layer */}
                  {positionedNodes.map((node, index) => {
                    // Text wrapping for long labels
                    const maxCharsPerLine = node.type === 'primary' ? 10 : 8;
                    const words = node.name.split(' ');
                    const lines = [];
                    let currentLine = '';

                    words.forEach(word => {
                      if ((currentLine + word).length <= maxCharsPerLine) {
                        currentLine += (currentLine ? ' ' : '') + word;
                      } else {
                        if (currentLine) lines.push(currentLine);
                        currentLine = word;
                      }
                    });
                    if (currentLine) lines.push(currentLine);

                    // Limit to 2 lines max
                    const displayLines = lines.slice(0, 2);
                    if (lines.length > 2) {
                      displayLines[1] = displayLines[1].substring(0, maxCharsPerLine - 3) + '...';
                    }

                    return (
                      <g key={`text-${node.id}`}>
                        {/* Multi-line label */}
                        {displayLines.map((line, lineIndex) => (
                          <text
                            key={`line-${lineIndex}`}
                            x={node.fx}
                            y={node.fy + (lineIndex - (displayLines.length - 1) / 2) * 12}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontSize={node.type === 'primary' ? '16' : '12'}
                            fontWeight={node.type === 'primary' ? '700' : '600'}
                            letterSpacing={node.type === 'primary' ? '0.5' : '0.3'}
                            opacity={0}
                            style={{
                              animation: `fadeInScale 1s ease-out ${index * 0.1 + 0.5}s forwards`,
                              textShadow: node.type === 'primary'
                                ? '0 0 8px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,0.8), 0 0 20px rgba(255,255,255,0.1)'
                                : '0 0 6px rgba(0,0,0,0.9), 0 1px 3px rgba(0,0,0,0.8)',
                              fontFamily: 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
                              textTransform: node.type === 'primary' ? 'uppercase' : 'none'
                            }}
                            className="pointer-events-none select-none"
                          >
                            {line}
                          </text>
                        ))}

                        {/* Percentage label with background */}
                        <g>
                          {/* Background rectangle for percentage */}
                          <rect
                            x={node.fx - 15}
                            y={node.fy + node.radius + 8}
                            width="30"
                            height="16"
                            rx="8"
                            fill="rgba(0, 0, 0, 0.7)"
                            stroke="rgba(255, 255, 255, 0.3)"
                            strokeWidth="1"
                            opacity={0}
                            style={{
                              animation: `fadeInScale 1s ease-out ${index * 0.1 + 0.7}s forwards`
                            }}
                          />
                          <text
                            x={node.fx}
                            y={node.fy + node.radius + 16}
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fill="white"
                            fontSize="11"
                            fontWeight="bold"
                            opacity={0}
                            style={{
                              animation: `fadeInScale 1s ease-out ${index * 0.1 + 0.7}s forwards`
                            }}
                            className="pointer-events-none select-none"
                          >
                            {Math.round(node.percentage)}%
                          </text>
                        </g>
                      </g>
                    );
                  })}
                </g>
              </g>
            </svg>
          </div>

          {/* Genre Legend */}
          <div className="mt-6 w-full">
            <h4 className="text-sm font-medium text-gray-300 mb-3 text-center">Genre Composition</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {processedGenres.map((genreGroup, index) => (
                <div key={index} className="bg-gray-700/50 rounded-lg p-3">
                  <div className="flex items-center gap-3 mb-2">
                    <div
                      className="w-4 h-4 rounded-full"
                      style={{ backgroundColor: getGenreColorHex(genreGroup.genre) }}
                    />
                    <span className="text-sm font-medium text-white">{genreGroup.genre}</span>
                    <span className="text-xs text-gray-400 ml-auto">
                      {Math.round(genreGroup.percentage)}%
                    </span>
                  </div>
                  <div className="space-y-1">
                    {genreGroup.subgenres.map((subgenre, subIndex) => (
                      <div key={subIndex} className="flex items-center justify-between text-xs">
                        <span className="text-gray-300">{subgenre.subgenre || subgenre.genre}</span>
                        <span className="text-gray-400">{Math.round(subgenre.percentage)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes fadeInScale {
          from { opacity: 0; transform: scale(0.8); }
          to   { opacity: 1; transform: scale(1); }
        }

        @keyframes dnaDrift {
          0%   { transform: rotate(-1deg) skewY(2deg); }
          50%  { transform: rotate(1deg)  skewY(-2deg); }
          100% { transform: rotate(-1deg) skewY(2deg); }
        }

        :global(.dna-cluster) {
          transform-origin: 50% 50%;
          animation: dnaDrift 18s ease-in-out infinite alternate;
        }
      `}</style>
    </div>
  );
}

export default GenreDNA;
