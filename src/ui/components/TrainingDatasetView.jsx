import React, { useState, useEffect } from 'react';
import { Database, RefreshCw, Search } from 'lucide-react';

export default function TrainingDatasetView() {
    const [records, setRecords] = useState([]);
    const [isLoading, setIsLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const result = await window.electronAPI.training('training:getTrainingAnalysis');
            if (result.success) {
                // Convert object to array
                const data = Object.values(result.analysis || {});
                setRecords(data);
            }
        } catch (err) {
            console.error('Failed to load training data:', err);
        } finally {
            setIsLoading(false);
        }
    };

    const filteredRecords = records.filter(r =>
        r.audio_path.toLowerCase().includes(searchTerm.toLowerCase()) ||
        r.track_id.includes(searchTerm)
    );

    const getTopTags = (tags) => {
        if (!tags || !Array.isArray(tags)) return [];
        return tags.slice(0, 3).map(t => {
            const label = t.subgenre ? `${t.genre} - ${t.subgenre}` : t.genre;
            return `${label} (${(t.score * 100).toFixed(0)}%)`;
        }).join(', ');
    };

    return (
        <div className="space-y-6">
            <div className="card p-6 bg-gray-800 rounded-lg border border-gray-700">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-primary-400 flex items-center gap-2">
                        <Database className="w-5 h-5" />
                        Training Dataset Storage
                    </h2>
                    <button
                        onClick={loadData}
                        disabled={isLoading}
                        className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-white rounded flex items-center gap-2 text-sm"
                    >
                        <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {/* Search */}
                <div className="mb-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search by filename or ID..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 rounded pl-9 pr-4 py-2 text-sm text-gray-300 focus:outline-none focus:border-primary-500"
                        />
                    </div>
                </div>

                {/* Table */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-gray-700 text-gray-300 uppercase text-xs">
                            <tr>
                                <th className="px-4 py-3 rounded-tl-lg">ID</th>
                                <th className="px-4 py-3">File Name</th>
                                <th className="px-4 py-3">Before Tags (Initial)</th>
                                <th className="px-4 py-3 rounded-tr-lg">After Tags (Trained)</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700">
                            {filteredRecords.length === 0 ? (
                                <tr>
                                    <td colSpan="4" className="px-4 py-8 text-center text-gray-500">
                                        No records found.
                                    </td>
                                </tr>
                            ) : (
                                filteredRecords.map((record) => (
                                    <tr key={record.track_id} className="hover:bg-gray-700/50 transition-colors">
                                        <td className="px-4 py-3 font-mono text-gray-400">{record.track_id}</td>
                                        <td className="px-4 py-3 text-gray-200 truncate max-w-xs" title={record.audio_path}>
                                            {record.audio_path.split(/[\\/]/).pop()}
                                        </td>
                                        <td className="px-4 py-3 text-gray-300">
                                            {getTopTags(record.results)}
                                        </td>
                                        <td className="px-4 py-3 text-gray-500 italic">
                                            {/* Placeholder for future post-training tags */}
                                            Pending Training...
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 text-xs text-gray-500 text-right">
                    Total Records: {filteredRecords.length}
                </div>
            </div>
        </div>
    );
}
