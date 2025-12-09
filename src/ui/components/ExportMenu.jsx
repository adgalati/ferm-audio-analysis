import React, { useState } from 'react';
import { Download, FileJson, Image, Copy, Check } from 'lucide-react';

function ExportMenu({ results }) {
  const [copied, setCopied] = useState(false);

  const handleExportJson = async () => {
    const result = await window.electronAPI.exportJson(results);
    if (result.success) {
      console.log('Exported to:', result.path);
    }
  };

  const handleCopyBadgeText = () => {
    const { scores } = results;
    const badgeText = `In-Key ${Math.round((scores?.key_fit || 0) * 100)} • Timing ${Math.round(100 - (scores?.timing?.mate_ms || 0))} • ${scores?.timing?.bias_ms > 0 ? 'Late' : 'Early'} bias ${Math.abs(scores?.timing?.bias_ms || 0).toFixed(0)} ms`;
    
    navigator.clipboard.writeText(badgeText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        className="btn-secondary flex items-center gap-2"
        onClick={handleExportJson}
        title="Export results as JSON"
      >
        <FileJson className="w-4 h-4" />
        Export JSON
      </button>

      <button
        className="btn-secondary flex items-center gap-2"
        onClick={handleCopyBadgeText}
        title="Copy badge text for streaming overlays"
      >
        {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        {copied ? 'Copied!' : 'Copy Badge'}
      </button>
    </div>
  );
}

export default ExportMenu;
