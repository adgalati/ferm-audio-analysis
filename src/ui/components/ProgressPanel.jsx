import React, { useState, useEffect } from 'react';
import { Loader2, X } from 'lucide-react';

function ProgressPanel({ progress }) {
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      setElapsedTime(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [startTime]);

  const handleCancel = async () => {
    const confirm = window.confirm('Cancel analysis in progress? This will stop all running tasks.');
    if (!confirm) return;
    try {
      const res = await window.electronAPI.cancelAnalysis();
      // Optional: you can add a lightweight event so App can clear UI immediately
      if (res?.success) {
        window.dispatchEvent(new CustomEvent('analysis-cancelled'));
      }
    } catch (_) {}
  };

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-primary-400" />
          Analysis in Progress
        </h2>
        <button
          className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
          onClick={handleCancel}
          title="Cancel analysis"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-gray-400">{progress.message || 'Processing...'}</span>
          <span className="text-gray-400">{formatTime(elapsedTime)}</span>
        </div>
        
        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
          <div
            className="bg-primary-600 h-full transition-all duration-300 ease-out"
            style={{ width: `${progress.percent || 0}%` }}
          >
            <div className="h-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-pulse" />
          </div>
        </div>
        
        <div className="flex justify-between text-xs mt-1">
          <span className="text-gray-500">0%</span>
          <span className="text-primary-400 font-medium">{progress.percent || 0}%</span>
          <span className="text-gray-500">100%</span>
        </div>
      </div>

      <p className="text-xs text-gray-500 text-center">
        This may take a few minutes depending on file length and selected analyses
      </p>
    </div>
  );
}

export default ProgressPanel;
