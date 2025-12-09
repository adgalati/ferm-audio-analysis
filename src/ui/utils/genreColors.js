/**
 * Shared genre color utilities for consistent styling across components
 */

// Tailwind color mappings for genre families
const genreColors = {
  'Electronic': 'bg-purple-500',
  'Rock': 'bg-red-500',
  'Pop': 'bg-pink-500',
  'Hip-Hop': 'bg-orange-500',
  'Hip Hop': 'bg-orange-500',
  'hiphop': 'bg-orange-500',
  'Jazz': 'bg-blue-500',
  'Classical': 'bg-indigo-500',
  'Country': 'bg-green-500',
  'Blues': 'bg-yellow-500',
  'Folk': 'bg-teal-500',
  'R&B': 'bg-cyan-500',
  'rnb': 'bg-cyan-500',
  'Funk': 'bg-emerald-500',
  'Soul': 'bg-emerald-500',
  'funk': 'bg-emerald-500',
  'soul': 'bg-emerald-500',
  'Reggae': 'bg-lime-500',
  'Latin': 'bg-emerald-500',
  'World': 'bg-violet-500',
  'Experimental': 'bg-rose-500',
  'Ambient': 'bg-slate-500',
  'Dance': 'bg-fuchsia-500',
  'House': 'bg-violet-500',
  'Techno': 'bg-purple-600',
  'Trance': 'bg-indigo-600',
  'Metal': 'bg-gray-700',
  'Punk': 'bg-red-600',
  'Alternative': 'bg-orange-600',
  'Indie': 'bg-yellow-600',
  'Swing': 'bg-blue-600',
  'Contemporary': 'bg-cyan-600',
  'Pop Rap': 'bg-orange-400',
  'Contemporary R&B': 'bg-cyan-400',
  'RnB/Swing': 'bg-blue-400'
};

// Hex color mappings for Canvas/SVG usage
const genreColorsHex = {
  'Electronic': '#8b5cf6',
  'Rock': '#ef4444',
  'Pop': '#ec4899',
  'Hip-Hop': '#f97316',
  'Hip Hop': '#f97316',
  'hiphop': '#f97316',
  'Jazz': '#3b82f6',
  'Classical': '#6366f1',
  'Country': '#22c55e',
  'Blues': '#eab308',
  'Folk': '#14b8a6',
  'R&B': '#06b6d4',
  'rnb': '#06b6d4',
  'Funk': '#10b981',
  'Soul': '#10b981',
  'funk': '#10b981',
  'soul': '#10b981',
  'Reggae': '#84cc16',
  'Latin': '#10b981',
  'World': '#8b5cf6',
  'Experimental': '#f43f5e',
  'Ambient': '#64748b',
  'Dance': '#d946ef',
  'House': '#8b5cf6',
  'Techno': '#7c3aed',
  'Trance': '#4f46e5',
  'Metal': '#374151',
  'Punk': '#dc2626',
  'Alternative': '#ea580c',
  'Indie': '#ca8a04',
  'Swing': '#2563eb',
  'Contemporary': '#0891b2',
  'Pop Rap': '#fb923c',
  'Contemporary R&B': '#22d3ee',
  'RnB/Swing': '#60a5fa'
};

/**
 * Get Tailwind CSS class for a genre
 * @param {string} genre - Genre name
 * @returns {string} Tailwind CSS class
 */
export function getGenreColor(genre) {
  if (!genre) return 'bg-gray-500';
  
  // Try exact match first
  if (genreColors[genre]) {
    return genreColors[genre];
  }
  
  // Try partial matches
  for (const [key, color] of Object.entries(genreColors)) {
    if (genre.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(genre.toLowerCase())) {
      return color;
    }
  }
  
  // Default color
  return 'bg-gray-500';
}

/**
 * Get hex color for a genre (for Canvas/SVG usage)
 * @param {string} genre - Genre name
 * @returns {string} Hex color code
 */
export function getGenreColorHex(genre) {
  if (!genre) return '#6b7280';
  
  // Try exact match first
  if (genreColorsHex[genre]) {
    return genreColorsHex[genre];
  }
  
  // Try partial matches
  for (const [key, color] of Object.entries(genreColorsHex)) {
    if (genre.toLowerCase().includes(key.toLowerCase()) || key.toLowerCase().includes(genre.toLowerCase())) {
      return color;
    }
  }
  
  // Default color
  return '#6b7280';
}

/**
 * Get color with alpha/opacity for overlays
 * @param {string} genre - Genre name
 * @param {number} alpha - Alpha value (0-1)
 * @returns {string} RGBA color string
 */
export function getGenreColorWithAlpha(genre, alpha = 0.5) {
  const hex = getGenreColorHex(genre);
  
  // Convert hex to RGB
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Get all available genre colors (for legends)
 * @returns {Object} Object with genre names as keys and hex colors as values
 */
export function getAllGenreColors() {
  return { ...genreColorsHex };
}

