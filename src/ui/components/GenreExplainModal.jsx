import React from 'react';

function GenreExplainModal({ open, onClose, loading, error, data }) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg mx-4 bg-gray-900 border border-gray-700 rounded-lg shadow-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Genre Explainer</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>

        {loading && (
          <div className="text-gray-400">Loading explanation…</div>
        )}

        {!loading && error && (
          <div className="text-red-400 text-sm">{error}</div>
        )}

        {!loading && !error && data && (
          <div className="space-y-3">
            <div className="text-white font-medium">{data.title}</div>
            {Array.isArray(data.bullets) && data.bullets.length > 0 && (
              <ul className="list-disc list-inside space-y-1 text-sm text-gray-200">
                {data.bullets.map((b, i) => (
                  <li key={i}>{b}</li>
                ))}
              </ul>
            )}
            {data.summary && (
              <p className="text-sm text-gray-400">{data.summary}</p>
            )}
            <div className="flex justify-end">
              <button
                className="px-3 py-1 rounded bg-gray-700 hover:bg-gray-600 text-sm text-gray-100"
                onClick={() => {
                  const text = `${data.title}\n\n- ${data.bullets?.join('\n- ')}\n\n${data.summary}`;
                  navigator.clipboard.writeText(text);
                }}
              >Copy</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default GenreExplainModal;




