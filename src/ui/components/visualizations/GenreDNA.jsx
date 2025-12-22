import React from 'react';
import { getGenreColorHex } from '../../utils/genreColors';

function GenreDNA({ tags = [] }) {
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

  // Normalize all subgenre/style percentages to add up to 100%
  const totalScore = tags.reduce((sum, tag) => sum + tag.score, 0);
  const normalizedTags = tags.map(tag => ({
    ...tag,
    percentage: (tag.score / totalScore) * 100
  }));

  // Sort by percentage descending
  const sortedTags = [...normalizedTags].sort((a, b) => b.percentage - a.percentage);

  // Get unique primary genres for the legend
  const uniqueGenres = [...new Set(tags.map(tag => tag.genre))];

  // Calculate max percentage for the bar widths
  const maxPercentage = Math.max(...sortedTags.map(t => t.percentage));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold flex items-center gap-3">
          <div className="w-6 h-6 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
          Genre DNA
        </h3>
        <div className="text-sm text-gray-400">
          {sortedTags.length} styles detected
        </div>
      </div>

      {/* Main Ladder Display */}
      <div className="bg-gray-800/80 rounded-2xl p-6 border border-gray-600">
        {/* Vertical Ladder of Styles */}
        <div className="space-y-3">
          {sortedTags.map((tag, index) => {
            const styleName = tag.subgenre || tag.genre;
            const genreColor = getGenreColorHex(tag.genre);
            const barWidth = (tag.percentage / maxPercentage) * 100;

            return (
              <div
                key={index}
                className="relative flex items-center gap-4 p-4 rounded-xl transition-all duration-300 hover:bg-gray-700/50"
                style={{
                  animationDelay: `${index * 50}ms`
                }}
              >
                {/* Rank Number */}
                <div
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg"
                  style={{
                    backgroundColor: genreColor + '33',
                    color: genreColor,
                    border: `2px solid ${genreColor}`
                  }}
                >
                  {index + 1}
                </div>

                {/* Style Name and Bar */}
                <div className="flex-grow">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xl md:text-2xl font-bold text-white leading-tight">
                      {styleName}
                    </span>
                    <span
                      className="text-2xl md:text-3xl font-black ml-4"
                      style={{ color: genreColor }}
                    >
                      {Math.round(tag.percentage)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-700 ease-out"
                      style={{
                        width: `${barWidth}%`,
                        background: `linear-gradient(90deg, ${genreColor}, ${genreColor}88)`
                      }}
                    />
                  </div>
                </div>

                {/* Decorative color accent */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 rounded-l-xl"
                  style={{ backgroundColor: genreColor }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Genre Color Legend */}
      <div className="bg-gray-800/60 rounded-xl p-5 border border-gray-700">
        <h4 className="text-base font-semibold text-gray-300 mb-4 text-center uppercase tracking-wider">
          Genre Color Key
        </h4>
        <div className="flex flex-wrap justify-center gap-4">
          {uniqueGenres.map((genre, index) => (
            <div
              key={index}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-700/50"
            >
              <div
                className="w-5 h-5 rounded-full shadow-lg"
                style={{
                  backgroundColor: getGenreColorHex(genre),
                  boxShadow: `0 0 10px ${getGenreColorHex(genre)}66`
                }}
              />
              <span className="text-base font-medium text-white">
                {genre}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default GenreDNA;
