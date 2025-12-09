import React, { useState } from 'react';
import { Mic2, Volume2, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
import { getScoreColorClass, getScoreBadgeClass } from '../../../utils/vocal-scoring.js';

function VocalQuality({ smileData }) {
  const [expandedSections, setExpandedSections] = useState({
    pitch: false,
    dynamics: false,
    quality: false
  });

  if (!smileData?.egemaps?.features || !smileData?.egemaps?.scores) {
    return (
      <div className="p-6 text-center text-gray-500">
        <Sparkles className="w-12 h-12 mx-auto mb-4 text-gray-400" />
        <p>No vocal quality data available</p>
        <p className="text-sm mt-2">Enable "Timbre" analysis to see vocal metrics</p>
      </div>
    );
  }

  const { features, scores } = smileData.egemaps;
  const { pitch, dynamics, quality } = features;

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const GaugeBar = ({ score, label, icon: Icon, colorClass }) => (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-700">{label}</span>
        </div>
        <span className={`text-lg font-bold ${colorClass}`}>
          {score || 'N/A'}
        </span>
      </div>
      
      <div className="w-full bg-gray-200 rounded-full h-3">
        <div 
          className={`h-3 rounded-full transition-all duration-500 ${
            score >= 80 ? 'bg-green-500' :
            score >= 60 ? 'bg-yellow-500' :
            score >= 40 ? 'bg-orange-500' : 'bg-red-500'
          }`}
          style={{ width: `${score || 0}%` }}
        />
      </div>
    </div>
  );

  const DetailSection = ({ title, icon: Icon, isExpanded, onToggle, children }) => (
    <div className="border border-gray-200 rounded-lg mb-4">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Icon className="w-5 h-5 text-gray-600" />
          <span className="font-medium text-gray-700">{title}</span>
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-gray-400" />
        )}
      </button>
      
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-gray-100">
          <div className="pt-4 space-y-3">
            {children}
          </div>
        </div>
      )}
    </div>
  );

  const MetricRow = ({ label, value, unit = '', format = 'number' }) => {
    let displayValue = value;
    if (format === 'number' && typeof value === 'number') {
      displayValue = value.toFixed(2);
    } else if (format === 'percentage' && typeof value === 'number') {
      displayValue = `${(value * 100).toFixed(1)}%`;
    }
    
    return (
      <div className="flex justify-between items-center py-2">
        <span className="text-sm text-gray-600">{label}</span>
        <span className="text-sm font-medium text-gray-900">
          {displayValue}{unit}
        </span>
      </div>
    );
  };

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-purple-600" />
          Vocal Quality Analysis
        </h3>
        
        {/* Overall Score */}
        {scores.overall !== null && (
          <div className="mb-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="font-medium text-gray-700">Overall Vocal Score</span>
              <span className={`text-2xl font-bold ${getScoreColorClass(scores.overall)}`}>
                {scores.overall}
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
              <div 
                className={`h-2 rounded-full transition-all duration-500 ${
                  scores.overall >= 80 ? 'bg-green-500' :
                  scores.overall >= 60 ? 'bg-yellow-500' :
                  scores.overall >= 40 ? 'bg-orange-500' : 'bg-red-500'
                }`}
                style={{ width: `${scores.overall}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Individual Metrics */}
      <div className="space-y-4">
        {/* Pitch Stability */}
        <GaugeBar
          score={scores.pitch_stability}
          label="Pitch Stability"
          icon={Mic2}
          colorClass={getScoreColorClass(scores.pitch_stability)}
        />
        
        <DetailSection
          title="Pitch Details"
          icon={Mic2}
          isExpanded={expandedSections.pitch}
          onToggle={() => toggleSection('pitch')}
        >
          {pitch?.mean_hz && <MetricRow label="Mean Frequency" value={pitch.mean_hz} unit=" Hz" />}
          {pitch?.mean_st !== undefined && <MetricRow label="Mean (semitones)" value={pitch.mean_st} unit=" st" />}
          {pitch?.stddev_st !== undefined && <MetricRow label="Standard Deviation" value={pitch.stddev_st} unit=" st" />}
          {pitch?.range_st !== undefined && <MetricRow label="Range" value={pitch.range_st} unit=" st" />}
          {pitch?.coefficient_of_variation !== undefined && (
            <MetricRow label="Coefficient of Variation" value={pitch.coefficient_of_variation} format="percentage" />
          )}
          {pitch?.range_hz && <MetricRow label="Range" value={pitch.range_hz} unit=" Hz" />}
        </DetailSection>

        {/* Dynamic Control */}
        <GaugeBar
          score={scores.dynamic_control}
          label="Dynamic Control"
          icon={Volume2}
          colorClass={getScoreColorClass(scores.dynamic_control)}
        />
        
        <DetailSection
          title="Dynamics Details"
          icon={Volume2}
          isExpanded={expandedSections.dynamics}
          onToggle={() => toggleSection('dynamics')}
        >
          {dynamics?.mean_db !== undefined && <MetricRow label="Mean Loudness" value={dynamics.mean_db} unit=" dB" />}
          {dynamics?.stddev_db !== undefined && <MetricRow label="Standard Deviation" value={dynamics.stddev_db} unit=" dB" />}
          {dynamics?.range_db !== undefined && <MetricRow label="Dynamic Range" value={dynamics.range_db} unit=" dB" />}
          {dynamics?.pctl_02 !== undefined && <MetricRow label="2nd Percentile" value={dynamics.pctl_02} unit=" dB" />}
          {dynamics?.pctl_98 !== undefined && <MetricRow label="98th Percentile" value={dynamics.pctl_98} unit=" dB" />}
        </DetailSection>

        {/* Voice Quality removed from card-level display per user preference; keep details collapsible only if needed */}
      </div>

      {/* Interpretation Guide */}
      <div className="mt-8 p-4 bg-blue-50 rounded-lg">
        <h4 className="font-medium text-blue-900 mb-2">Score Interpretation</h4>
        <div className="text-sm text-blue-800 space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-green-500 rounded"></div>
            <span><strong>80-100:</strong> Excellent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-yellow-500 rounded"></div>
            <span><strong>60-79:</strong> Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-orange-500 rounded"></div>
            <span><strong>40-59:</strong> Fair</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 bg-red-500 rounded"></div>
            <span><strong>0-39:</strong> Needs Improvement</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VocalQuality;
