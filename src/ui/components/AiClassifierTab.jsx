import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bot, RefreshCw, Search, ChevronDown, ChevronUp, Info } from 'lucide-react';

const AI_META = [
  { value: 0, emoji: '✅', label: 'Not AI', color: 'bg-emerald-800', activeColor: 'bg-emerald-600 ring-2 ring-emerald-400', desc: 'Human-created track' },
  { value: 1, emoji: '🤖', label: 'AI Generated', color: 'bg-rose-800', activeColor: 'bg-rose-600 ring-2 ring-rose-400', desc: 'AI-generated or very likely (best guess)' },
];

const PAGE_SIZE = 30;

export default function AiClassifierTab() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [genres, setGenres] = useState([]);
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [aiFilter, setAiFilter] = useState('all'); // 'all'|'unlabeled'|'0'|'1'
  const [selected, setSelected] = useState(new Set());
  const [flashId, setFlashId] = useState(null);
  const [legendOpen, setLegendOpen] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(null);
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState(-1);
  const searchTimeout = useRef(null);
  const hoveredRow = useRef(null);

  const buildQuery = useCallback(() => {
    const q = { sortBy, sortOrder, limit: PAGE_SIZE, skip: (page - 1) * PAGE_SIZE };
    if (search) q.clipNameSearch = search;
    if (genreFilter) q.genreFilter = genreFilter;
    if (aiFilter === 'unlabeled') q.aiLabeledOnly = false;
    else if (aiFilter === '0') q.aiGeneratedValue = 0;
    else if (aiFilter === '1') q.aiGeneratedValue = 1;
    return q;
  }, [search, genreFilter, aiFilter, sortBy, sortOrder, page]);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.mongodb('mongodb:query-affinity-records', buildQuery());
      if (result.success) {
        setRecords(result.records || []);
        setTotal(result.total || 0);
        if (result.stats) setStats(result.stats);
      }
    } catch (e) { console.error('Load AI classifier records error:', e); }
    setIsLoading(false);
  }, [buildQuery]);

  useEffect(() => { loadRecords(); }, [loadRecords]);

  useEffect(() => {
    (async () => {
      try {
        const r = await window.electronAPI.mongodb('mongodb:get-unique-genres', {});
        if (r.success) setGenres(r.genres || []);
      } catch (_) {}
    })();
  }, []);

  const handleSearchChange = (val) => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => { setSearch(val); setPage(1); }, 350);
  };

  const flash = (id) => { setFlashId(id); setTimeout(() => setFlashId(null), 600); };

  const saveAiLabel = async (id, value) => {
    const rec = records.find(r => r._id === id);
    const newVal = (rec?.aiGeneratedLabel === value) ? null : value;
    setRecords(prev => prev.map(r => r._id === id ? { ...r, aiGeneratedLabel: newVal } : r));
    flash(id);
    await window.electronAPI.mongodb('mongodb:update-ai-generated-label', { id, aiGeneratedLabel: newVal });
    loadRecords();
  };

  const bulkSetAi = async (value) => {
    const ids = [...selected];
    setBulkProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      await window.electronAPI.mongodb('mongodb:update-ai-generated-label', { id: ids[i], aiGeneratedLabel: value });
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setSelected(new Set());
    setBulkProgress(null);
    loadRecords();
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e) => {
      const id = hoveredRow.current;
      if (!id) return;
      if (e.key === '0') { e.preventDefault(); saveAiLabel(id, 0); }
      if (e.key === '1') { e.preventDefault(); saveAiLabel(id, 1); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [records]);

  const toggleSelect = (id) => {
    setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };
  const toggleAll = () => {
    if (selected.size === records.length) setSelected(new Set());
    else setSelected(new Set(records.map(r => r._id)));
  };

  const handleSort = (field) => {
    if (sortBy === field) setSortOrder(o => o === 1 ? -1 : 1);
    else { setSortBy(field); setSortOrder(-1); }
    setPage(1);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Stats Banner */}
      {stats && (
        <div className="bg-gray-800/80 rounded-xl p-5 border border-gray-700">
          <h3 className="text-sm font-semibold text-rose-400 mb-4 flex items-center gap-2">
            <Bot className="w-4 h-4" /> AI Generated Detection — Training Labels
          </h3>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-white">{stats.totalEmbedded}</div>
              <div className="text-xs text-gray-400">Embedded Tracks</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-cyan-400">{stats.aiLabeled}</div>
              <div className="text-xs text-gray-400">Labeled</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-emerald-400">{stats.aiNegative}</div>
              <div className="text-xs text-gray-400">✅ Not AI</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-rose-400">{stats.aiPositive}</div>
              <div className="text-xs text-gray-400">🤖 AI</div>
            </div>
          </div>
          <div className="mt-3 h-1.5 rounded bg-gray-700 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-rose-500 to-emerald-500 transition-all"
              style={{ width: `${stats.totalEmbedded > 0 ? (stats.aiLabeled / stats.totalEmbedded * 100) : 0}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.totalEmbedded > 0 ? (stats.aiLabeled / stats.totalEmbedded * 100).toFixed(1) : 0}% labeled
            <span className="text-gray-600 ml-2">•</span>
            <span className="ml-2">{stats.aiUnlabeled} remaining</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <button onClick={() => setLegendOpen(v => !v)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors">
        <Info className="w-3.5 h-3.5" /> Label Reference {legendOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {legendOpen && (
        <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700 text-xs space-y-1">
          <div className="font-semibold text-rose-400 mb-1">AI Generated (binary)</div>
          {AI_META.map(m => (
            <div key={m.value} className="flex items-center gap-2 py-0.5">
              <span>{m.emoji}</span>
              <span className="text-gray-300 font-mono">{m.value}</span>
              <span className="text-gray-400">— {m.desc}</span>
            </div>
          ))}
          <div className="mt-2 text-gray-500 italic">Keyboard: hover a row, press 0 (not AI) or 1 (AI)</div>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-3 bg-gray-800/60 p-3 rounded-lg border border-gray-700">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input type="text" placeholder="Search clip name..." onChange={e => handleSearchChange(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 bg-gray-900 border border-gray-700 rounded text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-cyan-500" />
        </div>
        <select value={genreFilter} onChange={e => { setGenreFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500">
          <option value="">All Genres</option>
          {genres.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
        <select value={aiFilter} onChange={e => { setAiFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500">
          <option value="all">All</option>
          <option value="unlabeled">Unlabeled</option>
          <option value="0">✅ Not AI</option>
          <option value="1">🤖 AI</option>
        </select>
        <button onClick={loadRecords} disabled={isLoading} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Bulk Toolbar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-rose-900/20 border border-rose-700/40 rounded-lg p-3">
          <span className="text-sm text-rose-300 font-medium">{selected.size} selected</span>
          <div className="h-5 border-l border-gray-600" />
          <span className="text-xs text-gray-400">Set AI label:</span>
          {AI_META.map(m => (
            <button key={m.value} onClick={() => bulkSetAi(m.value)} disabled={!!bulkProgress}
              className={`px-3 py-1.5 text-xs rounded ${m.color} hover:opacity-80 text-white transition-all flex items-center gap-1.5`}>
              {m.emoji} {m.label}
            </button>
          ))}
          {bulkProgress && (
            <span className="text-xs text-rose-400 ml-2">{bulkProgress.done}/{bulkProgress.total}...</span>
          )}
          <button onClick={() => setSelected(new Set())} className="ml-auto text-xs text-gray-400 hover:text-white">Clear</button>
        </div>
      )}

      {/* Table */}
      <div className="bg-gray-800/60 rounded-xl border border-gray-700 overflow-hidden">
        {isLoading && records.length === 0 ? (
          <div className="p-10 text-center text-gray-400"><RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin" />Loading...</div>
        ) : records.length === 0 ? (
          <div className="p-10 text-center text-gray-500">No embedded records found matching filters</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-900/80 border-b border-gray-700">
                <tr>
                  <th className="px-3 py-2.5 text-left w-8">
                    <input type="checkbox" checked={selected.size === records.length && records.length > 0} onChange={toggleAll} className="rounded border-gray-600 bg-gray-700" />
                  </th>
                  <th onClick={() => handleSort('clipName')} className="px-3 py-2.5 text-left cursor-pointer hover:bg-gray-800 transition-colors font-semibold text-gray-300">
                    Clip Name {sortBy === 'clipName' && (sortOrder === -1 ? '↓' : '↑')}
                  </th>
                  <th onClick={() => handleSort('topGenre')} className="px-3 py-2.5 text-left cursor-pointer hover:bg-gray-800 transition-colors font-semibold text-gray-300">
                    Genre {sortBy === 'topGenre' && (sortOrder === -1 ? '↓' : '↑')}
                  </th>
                  <th onClick={() => handleSort('date')} className="px-3 py-2.5 text-left cursor-pointer hover:bg-gray-800 transition-colors font-semibold text-gray-300">
                    Date {sortBy === 'date' && (sortOrder === -1 ? '↓' : '↑')}
                  </th>
                  <th className="px-3 py-2.5 text-center font-semibold text-rose-400">AI Generated?</th>
                </tr>
              </thead>
              <tbody>
                {records.map(rec => (
                  <tr key={rec._id}
                    onMouseEnter={() => { hoveredRow.current = rec._id; }}
                    onMouseLeave={() => { hoveredRow.current = null; }}
                    className={`border-b border-gray-700/50 transition-all ${flashId === rec._id ? 'bg-rose-900/20' : 'hover:bg-gray-700/40'}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(rec._id)} onChange={() => toggleSelect(rec._id)} className="rounded border-gray-600 bg-gray-700" />
                    </td>
                    <td className="px-3 py-2 truncate max-w-[300px]" title={rec.clipName}>
                      <span className="text-gray-200">{rec.clipName}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{rec.topGenreWithStyle || rec.topGenre || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{rec.date ? new Date(rec.date).toLocaleDateString() : '—'}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1.5">
                        {AI_META.map(m => (
                          <button key={m.value} onClick={() => saveAiLabel(rec._id, m.value)}
                            title={m.desc}
                            className={`px-3 py-1 rounded text-xs font-medium transition-all whitespace-nowrap ${
                              rec.aiGeneratedLabel === m.value
                                ? m.activeColor + ' text-white'
                                : 'bg-gray-700/50 text-gray-500 hover:text-white hover:opacity-80'
                            }`}>
                            {m.emoji} {m.label}
                          </button>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-400">
          <span>Page {page} of {totalPages} ({total} records)</span>
          <div className="flex gap-2">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-white text-xs">Prev</button>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:opacity-40 rounded text-white text-xs">Next</button>
          </div>
        </div>
      )}
    </div>
  );
}
