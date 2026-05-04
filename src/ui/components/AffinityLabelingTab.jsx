import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Heart, RefreshCw, Search, ChevronDown, ChevronUp, Info } from 'lucide-react';

const AFFINITY_META = [
  { value: 0, emoji: '❌', label: 'Strong dislike / very poor quality', color: 'bg-red-700', activeColor: 'bg-red-600 ring-2 ring-red-400', textColor: 'text-red-300' },
  { value: 1, emoji: '👎', label: 'Slight dislike / poor quality', color: 'bg-orange-800', activeColor: 'bg-orange-600 ring-2 ring-orange-400', textColor: 'text-orange-300' },
  { value: 2, emoji: '😐', label: 'Okay / neutral; could be higher with better quality', color: 'bg-gray-600', activeColor: 'bg-gray-500 ring-2 ring-gray-300', textColor: 'text-gray-300' },
  { value: 3, emoji: '🔥', label: 'Runner-up to favorite', color: 'bg-teal-800', activeColor: 'bg-teal-600 ring-2 ring-teal-400', textColor: 'text-teal-300' },
  { value: 4, emoji: '⭐', label: 'Favorite', color: 'bg-amber-800', activeColor: 'bg-amber-600 ring-2 ring-amber-400', textColor: 'text-amber-300' },
];

const PAGE_SIZE = 30;

export default function AffinityLabelingTab() {
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [genres, setGenres] = useState([]);
  const [search, setSearch] = useState('');
  const [genreFilter, setGenreFilter] = useState('');
  const [affinityFilter, setAffinityFilter] = useState('all'); // 'all'|'labeled'|'unlabeled'|'0'..'4'
  const [excludeAi, setExcludeAi] = useState(false);
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
    if (excludeAi) q.excludeAiGenerated = true;
    if (affinityFilter === 'labeled') q.labeledOnly = true;
    else if (affinityFilter === 'unlabeled') q.labeledOnly = false;
    else if (['0','1','2','3','4'].includes(affinityFilter)) q.affinityValue = parseInt(affinityFilter);
    return q;
  }, [search, genreFilter, affinityFilter, excludeAi, sortBy, sortOrder, page]);

  const loadRecords = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await window.electronAPI.mongodb('mongodb:query-affinity-records', buildQuery());
      if (result.success) {
        setRecords(result.records || []);
        setTotal(result.total || 0);
        if (result.stats) setStats(result.stats);
      }
    } catch (e) { console.error('Load affinity records error:', e); }
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

  const saveAffinity = async (id, value) => {
    const rec = records.find(r => r._id === id);
    const newVal = (rec?.affinityLabel === value) ? null : value;
    setRecords(prev => prev.map(r => r._id === id ? { ...r, affinityLabel: newVal } : r));
    flash(id);
    await window.electronAPI.mongodb('mongodb:update-affinity-label', { id, affinityLabel: newVal });
    loadRecords();
  };

  const bulkSetAffinity = async (value) => {
    const ids = [...selected];
    setBulkProgress({ done: 0, total: ids.length });
    for (let i = 0; i < ids.length; i++) {
      await window.electronAPI.mongodb('mongodb:update-affinity-label', { id: ids[i], affinityLabel: value });
      setBulkProgress({ done: i + 1, total: ids.length });
    }
    setSelected(new Set());
    setBulkProgress(null);
    loadRecords();
  };

  // Keyboard shortcuts: 0–4 for affinity on hovered row
  useEffect(() => {
    const handler = (e) => {
      const id = hoveredRow.current;
      if (!id) return;
      if (e.key >= '0' && e.key <= '4') { e.preventDefault(); saveAffinity(id, parseInt(e.key)); }
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
          <h3 className="text-sm font-semibold text-amber-400 mb-4 flex items-center gap-2">
            <Heart className="w-4 h-4" /> Affinity Training Labels (0–4)
          </h3>
          <div className="grid grid-cols-3 gap-4 text-center mb-3">
            <div><div className="text-2xl font-bold text-white">{stats.totalEmbedded}</div><div className="text-xs text-gray-400">Embedded Tracks</div></div>
            <div><div className="text-2xl font-bold text-emerald-400">{stats.affinityLabeled}</div><div className="text-xs text-gray-400">Labeled</div></div>
            <div><div className="text-2xl font-bold text-gray-400">{stats.affinityUnlabeled}</div><div className="text-xs text-gray-400">Unlabeled</div></div>
          </div>
          {/* Distribution bar */}
          <div className="flex gap-0.5 h-3 rounded overflow-hidden bg-gray-700">
            {AFFINITY_META.map(m => {
              const count = stats.affinityDistribution?.[m.value] || 0;
              const pct = stats.affinityLabeled > 0 ? (count / stats.affinityLabeled) * 100 : 0;
              return pct > 0 ? (
                <div key={m.value} className={`${m.color} transition-all`} style={{ width: `${pct}%` }} title={`${m.emoji} ${m.value}: ${count}`} />
              ) : null;
            })}
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            {AFFINITY_META.map(m => <span key={m.value}>{m.emoji} {stats.affinityDistribution?.[m.value] || 0}</span>)}
          </div>
          {/* Progress bar */}
          <div className="mt-3 h-1.5 rounded bg-gray-700 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-all" style={{ width: `${stats.totalEmbedded > 0 ? (stats.affinityLabeled / stats.totalEmbedded * 100) : 0}%` }} />
          </div>
          <div className="text-xs text-gray-500 mt-1">
            {stats.totalEmbedded > 0 ? (stats.affinityLabeled / stats.totalEmbedded * 100).toFixed(1) : 0}% labeled
            <span className="text-gray-600 ml-2">•</span>
            <span className="ml-2">{stats.affinityUnlabeled} remaining</span>
          </div>
        </div>
      )}

      {/* Legend */}
      <button onClick={() => setLegendOpen(v => !v)} className="flex items-center gap-2 text-xs text-gray-400 hover:text-gray-200 transition-colors">
        <Info className="w-3.5 h-3.5" /> Label Reference {legendOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {legendOpen && (
        <div className="p-3 bg-gray-800/60 rounded-lg border border-gray-700 text-xs space-y-1">
          <div className="font-semibold text-amber-400 mb-1">Affinity (0–4)</div>
          {AFFINITY_META.map(m => (
            <div key={m.value} className="flex items-center gap-2 py-0.5">
              <span>{m.emoji}</span><span className={m.textColor}>{m.value}</span><span className="text-gray-400">— {m.label}</span>
            </div>
          ))}
          <div className="mt-2 text-gray-500 italic">Keyboard: hover a row, press 0–4 to assign</div>
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
        <select value={affinityFilter} onChange={e => { setAffinityFilter(e.target.value); setPage(1); }}
          className="bg-gray-900 border border-gray-700 rounded px-2 py-1.5 text-sm text-gray-300 focus:outline-none focus:border-cyan-500">
          <option value="all">All</option>
          <option value="labeled">Labeled</option>
          <option value="unlabeled">Unlabeled</option>
          {AFFINITY_META.map(m => <option key={m.value} value={String(m.value)}>{m.emoji} {m.value}</option>)}
        </select>
        <label className="flex items-center gap-1.5 cursor-pointer text-xs text-gray-400 hover:text-gray-200">
          <input type="checkbox" checked={excludeAi} onChange={() => { setExcludeAi(v => !v); setPage(1); }}
            className="w-3.5 h-3.5 rounded border-gray-600 bg-gray-700 text-rose-500 focus:ring-1 focus:ring-rose-500" />
          Hide AI tracks
        </label>
        <button onClick={loadRecords} disabled={isLoading} className="p-1.5 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors">
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Bulk Toolbar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 bg-amber-900/20 border border-amber-700/40 rounded-lg p-3">
          <span className="text-sm text-amber-300 font-medium">{selected.size} selected</span>
          <div className="h-5 border-l border-gray-600" />
          <span className="text-xs text-gray-400">Set Affinity:</span>
          {AFFINITY_META.map(m => (
            <button key={m.value} onClick={() => bulkSetAffinity(m.value)} disabled={!!bulkProgress}
              className={`px-2 py-1 text-xs rounded ${m.color} hover:opacity-80 text-white transition-all`}>
              {m.emoji} {m.value}
            </button>
          ))}
          {bulkProgress && (
            <span className="text-xs text-amber-400 ml-2">{bulkProgress.done}/{bulkProgress.total}...</span>
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
                  <th className="px-3 py-2.5 text-center font-semibold text-amber-400">Affinity</th>
                </tr>
              </thead>
              <tbody>
                {records.map(rec => (
                  <tr key={rec._id}
                    onMouseEnter={() => { hoveredRow.current = rec._id; }}
                    onMouseLeave={() => { hoveredRow.current = null; }}
                    className={`border-b border-gray-700/50 transition-all ${flashId === rec._id ? 'bg-amber-900/20' : 'hover:bg-gray-700/40'}`}>
                    <td className="px-3 py-2">
                      <input type="checkbox" checked={selected.has(rec._id)} onChange={() => toggleSelect(rec._id)} className="rounded border-gray-600 bg-gray-700" />
                    </td>
                    <td className="px-3 py-2 truncate max-w-[300px]" title={rec.clipName}>
                      <span className="text-gray-200">{rec.clipName}</span>
                    </td>
                    <td className="px-3 py-2 text-gray-400 text-xs">{rec.topGenreWithStyle || rec.topGenre || '—'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">{rec.date ? new Date(rec.date).toLocaleDateString() : '—'}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {AFFINITY_META.map(m => (
                          <button key={m.value} onClick={() => saveAffinity(rec._id, m.value)}
                            title={`${m.value}: ${m.label}`}
                            className={`w-7 h-7 rounded text-xs font-bold transition-all ${rec.affinityLabel === m.value ? m.activeColor + ' text-white scale-110' : m.color + '/40 text-gray-400 hover:text-white hover:opacity-80'}`}>
                            {m.value}
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
