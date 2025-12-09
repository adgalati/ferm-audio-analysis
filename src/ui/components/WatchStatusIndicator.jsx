import React from 'react';

function WatchStatusIndicator({ watchPath }) {
  if (!watchPath) return null;
  return (
    <div className="flex items-center gap-2 text-xs text-gray-400">
      <span className="inline-flex w-2 h-2 rounded-full bg-green-500" />
      <span>Watching:</span>
      <span className="text-gray-300 truncate" title={watchPath}>{watchPath}</span>
    </div>
  );
}

export default WatchStatusIndicator;


