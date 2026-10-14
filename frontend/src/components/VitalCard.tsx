import React from 'react';
import { Heart, Activity, Thermometer, Wind, Gauge, AlertTriangle } from 'lucide-react';

interface VitalCardProps {
  label: string;
  value: number | string | undefined | null;
  unit: string;
  normalRange: string;
  type: 'hr' | 'spo2' | 'bp' | 'resp' | 'temp';
  isCritical?: boolean;
  isWarning?: boolean;
  qualityFlag?: string;
}

export const VitalCard: React.FC<VitalCardProps> = ({
  label,
  value,
  unit,
  normalRange,
  type,
  isCritical,
  isWarning,
  qualityFlag,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'hr':
        return <Heart className="w-5 h-5 text-rose-400" />;
      case 'spo2':
        return <Activity className="w-5 h-5 text-sky-400" />;
      case 'bp':
        return <Gauge className="w-5 h-5 text-indigo-400" />;
      case 'resp':
        return <Wind className="w-5 h-5 text-teal-400" />;
      case 'temp':
        return <Thermometer className="w-5 h-5 text-amber-400" />;
    }
  };

  const getBorderColor = () => {
    if (isCritical) return 'border-red-500/50 bg-red-950/20 glow-critical';
    if (isWarning) return 'border-amber-500/50 bg-amber-950/20 glow-warning';
    return 'border-slate-800 bg-slate-900/60 hover:border-slate-700';
  };

  const getValueColor = () => {
    if (isCritical) return 'text-red-400';
    if (isWarning) return 'text-amber-400';
    return 'text-slate-100';
  };

  return (
    <div
      className={`rounded-xl border p-4 transition-all duration-300 relative overflow-hidden ${getBorderColor()}`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <div className="p-1.5 rounded-lg bg-slate-800/80">{getIcon()}</div>
      </div>

      <div className="flex items-baseline gap-1.5 my-1">
        <span className={`text-2xl sm:text-3xl font-bold tracking-tight font-mono ${getValueColor()}`}>
          {value !== undefined && value !== null ? value : '--'}
        </span>
        <span className="text-xs text-slate-400">{unit}</span>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/60 text-[11px] text-slate-400">
        <span>Norm: {normalRange}</span>
        {isCritical ? (
          <span className="text-red-400 font-semibold flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> Critical
          </span>
        ) : isWarning ? (
          <span className="text-amber-400 font-semibold">Warning</span>
        ) : (
          <span className="text-emerald-400 font-medium">Normal</span>
        )}
      </div>

      {qualityFlag && (
        <div className="mt-2 text-[10px] text-amber-400 bg-amber-950/40 border border-amber-800/40 rounded px-1.5 py-0.5 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3 flex-shrink-0" />
          <span className="truncate">{qualityFlag}</span>
        </div>
      )}
    </div>
  );
};
