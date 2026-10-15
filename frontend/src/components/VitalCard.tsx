import React from 'react';
import { Heart, Activity, Thermometer, Wind, Gauge, AlertTriangle, ArrowUpRight, ArrowDownRight } from 'lucide-react';

interface VitalCardProps {
  label: string;
  value: number | string | undefined | null;
  unit: string;
  normalRange: string;
  type: 'hr' | 'spo2' | 'bp' | 'resp' | 'temp';
  isCritical?: boolean;
  isWarning?: boolean;
  qualityFlag?: string;
  trend?: 'up' | 'down' | 'steady';
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
  trend,
}) => {
  const getIcon = () => {
    switch (type) {
      case 'hr':
        return <Heart className="w-4 h-4 text-rose-500 fill-rose-500/20" />;
      case 'spo2':
        return <Activity className="w-4 h-4 text-sky-500" />;
      case 'bp':
        return <Gauge className="w-4 h-4 text-indigo-500" />;
      case 'resp':
        return <Wind className="w-4 h-4 text-teal-500" />;
      case 'temp':
        return <Thermometer className="w-4 h-4 text-amber-500" />;
    }
  };

  const getTheme = () => {
    if (isCritical) {
      return {
        card: 'border-rose-200/90 bg-rose-50/30 glow-critical ring-1 ring-rose-400/30',
        valText: 'text-rose-600',
        badge: 'bg-rose-100/90 text-rose-700 border-rose-200',
        iconBg: 'bg-rose-100/80',
        barColor: 'bg-rose-500',
      };
    }
    if (isWarning) {
      return {
        card: 'border-amber-200/90 bg-amber-50/30 glow-warning ring-1 ring-amber-400/30',
        valText: 'text-amber-600',
        badge: 'bg-amber-100/90 text-amber-700 border-amber-200',
        iconBg: 'bg-amber-100/80',
        barColor: 'bg-amber-500',
      };
    }
    return {
      card: 'border-slate-200/80 bg-white hover:border-slate-300/90 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)] hover:shadow-md',
      valText: 'text-slate-900',
      badge: 'bg-emerald-50 text-emerald-700 border-emerald-200/70',
      iconBg: 'bg-slate-50 border border-slate-100',
      barColor: 'bg-emerald-500',
    };
  };

  const theme = getTheme();

  // Compute percentage for range gauge if numeric
  const getRangePercentage = (): number | null => {
    if (typeof value !== 'number') return null;
    switch (type) {
      case 'hr': // 30 - 180
        return Math.min(100, Math.max(0, ((value - 30) / (180 - 30)) * 100));
      case 'spo2': // 70 - 100
        return Math.min(100, Math.max(0, ((value - 70) / (100 - 70)) * 100));
      case 'resp': // 8 - 40
        return Math.min(100, Math.max(0, ((value - 8) / (40 - 8)) * 100));
      case 'temp': // 34 - 41
        return Math.min(100, Math.max(0, ((value - 34) / (41 - 34)) * 100));
      default:
        return null;
    }
  };

  const pct = getRangePercentage();

  return (
    <div
      className={`rounded-2xl border p-4.5 transition-all duration-200 relative overflow-hidden flex flex-col justify-between group ${theme.card}`}
    >
      {/* Background Micro ECG waveform decoration */}
      <div className="absolute right-0 top-0 bottom-0 w-32 pointer-events-none opacity-[0.04] group-hover:opacity-[0.08] transition-opacity flex items-center justify-end pr-2 overflow-hidden">
        <svg viewBox="0 0 100 30" className="w-28 h-12 stroke-current text-slate-900 fill-none" strokeWidth="2">
          <path d="M0,15 L25,15 L32,5 L38,25 L44,15 L50,15 L55,9 L60,21 L65,15 L100,15" />
        </svg>
      </div>

      <div>
        {/* Top Header */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-[11px] font-semibold text-slate-500 tracking-wider uppercase font-sans">
            {label}
          </span>
          <div className={`p-1.5 rounded-xl transition-transform duration-200 group-hover:scale-105 ${theme.iconBg}`}>
            {getIcon()}
          </div>
        </div>

        {/* Main Vital Value */}
        <div className="flex items-baseline gap-1.5 my-1">
          <span className={`text-3xl sm:text-[34px] font-extrabold tracking-tight font-mono ${theme.valText}`}>
            {value !== undefined && value !== null ? value : '--'}
          </span>
          <span className="text-xs font-semibold text-slate-400 font-mono">{unit}</span>
          {trend && (
            <span className="ml-auto text-xs">
              {trend === 'up' && <ArrowUpRight className="w-3.5 h-3.5 text-rose-500" />}
              {trend === 'down' && <ArrowDownRight className="w-3.5 h-3.5 text-sky-500" />}
            </span>
          )}
        </div>
      </div>

      {/* Visual Mini Range Bar (if numeric) */}
      {pct !== null && (
        <div className="my-2.5">
          <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden relative">
            {/* Subtle normal range zone highlight */}
            <div
              className={`h-full rounded-full transition-all duration-500 ${theme.barColor}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      {/* Bottom Status / Normal Range Row */}
      <div className="pt-2.5 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-500">
        <span className="font-mono text-slate-400 text-[10px]">Norm: {normalRange}</span>
        {isCritical ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 bg-rose-100 text-rose-700 border-rose-200">
            <span className="relative flex h-1.5 w-1.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-rose-500"></span>
            </span>
            CRITICAL
          </span>
        ) : isWarning ? (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border flex items-center gap-1 bg-amber-100 text-amber-700 border-amber-200">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            WARNING
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border bg-emerald-50 text-emerald-700 border-emerald-200/60">
            NORMAL
          </span>
        )}
      </div>

      {qualityFlag && (
        <div className="mt-2 text-[10px] text-amber-700 bg-amber-50/90 border border-amber-200 rounded-lg px-2 py-0.5 flex items-center gap-1.5 font-medium">
          <AlertTriangle className="w-3 h-3 flex-shrink-0 text-amber-600" />
          <span className="truncate">{qualityFlag}</span>
        </div>
      )}
    </div>
  );
};
