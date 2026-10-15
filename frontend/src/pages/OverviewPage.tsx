import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Patient } from '../types';
import { Users, AlertTriangle, ShieldCheck, HeartPulse, Activity, ArrowRight, RefreshCw, Search, Heart, Gauge } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

export const OverviewPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'Critical' | 'Warning' | 'Stable'>('all');
  const wsRefreshTimerRef = useRef<number | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPatients();
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedRefresh = useCallback(() => {
    if (wsRefreshTimerRef.current !== null) {
      clearTimeout(wsRefreshTimerRef.current);
    }
    wsRefreshTimerRef.current = window.setTimeout(() => {
      fetchPatients();
      wsRefreshTimerRef.current = null;
    }, 400);
  }, [fetchPatients]);

  const handleWsEvent = useCallback((event: any) => {
    if (event.type === 'reading_update' || event.type === 'alert_triggered') {
      debouncedRefresh();
    }
  }, [debouncedRefresh]);

  useWebSocket(undefined, handleWsEvent);

  useEffect(() => {
    fetchPatients();
    const interval = setInterval(fetchPatients, 10000);
    return () => {
      clearInterval(interval);
      if (wsRefreshTimerRef.current !== null) {
        clearTimeout(wsRefreshTimerRef.current);
      }
    };
  }, [fetchPatients]);

  const criticalCount = patients.filter((p) => p.latest_tier === 'Critical').length;
  const warningCount = patients.filter((p) => p.latest_tier === 'Warning').length;
  const stableCount = patients.filter((p) => p.latest_tier === 'Stable').length;

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.display_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.display_name && p.display_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTier = tierFilter === 'all' || p.latest_tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [patients, searchQuery, tierFilter]);

  return (
    <div className="space-y-6">
      {/* Header Banner / Clinical Command Bar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-100/80 text-sky-600 shadow-xs">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2.5 flex-wrap">
                <h1 className="text-xl font-bold text-slate-900 tracking-tight font-sans">
                  ICU Clinical Command Center
                </h1>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  LIVE TELEMETRY ACTIVE
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Real-time multi-patient surveillance · PhysioNet Challenge 2012 Cohort & ML Early Warning System
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-auto">
            <Link
              to="/simulator"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-xs transition"
            >
              Stream Simulator
            </Link>
            <button
              onClick={fetchPatients}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-100 transition shadow-xs cursor-pointer"
              title="Refresh cohort"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Sync
            </button>
          </div>
        </div>
      </div>

      {/* Metric Summary KPI Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Monitored Patients */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Monitored Beds</span>
            <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 text-slate-600 group-hover:scale-105 transition-transform">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-slate-900 mt-2.5 tracking-tight">
            {patients.length}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
            <span>Occupancy Rate</span>
            <span className="font-mono text-slate-600 font-semibold">{Math.round((patients.length / 12) * 100)}%</span>
          </div>
        </div>

        {/* Critical Priority */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Critical Priority</span>
            <div className="p-2 rounded-xl bg-rose-50 border border-rose-100 text-rose-600 group-hover:scale-105 transition-transform">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-rose-600 mt-2.5 tracking-tight">
            {criticalCount}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
            <span>Action</span>
            <span className="text-rose-600 font-medium">Bedside review</span>
          </div>
        </div>

        {/* Warning Watch */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Warning Watch</span>
            <div className="p-2 rounded-xl bg-amber-50 border border-amber-100 text-amber-600 group-hover:scale-105 transition-transform">
              <HeartPulse className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-amber-600 mt-2.5 tracking-tight">
            {warningCount}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
            <span>Status</span>
            <span className="text-amber-600 font-medium">Telemetry drift</span>
          </div>
        </div>

        {/* Stable Cohort */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-md transition-all group">
          <div className="flex items-center justify-between text-slate-500 text-xs font-semibold uppercase tracking-wider">
            <span>Stable Cohort</span>
            <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 text-emerald-600 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-extrabold font-mono text-emerald-600 mt-2.5 tracking-tight">
            {stableCount}
          </div>
          <div className="flex items-center justify-between text-xs text-slate-400 mt-2 pt-2 border-t border-slate-100">
            <span>Condition</span>
            <span className="text-emerald-600 font-medium">Within baseline</span>
          </div>
        </div>
      </div>

      {/* Patient Bed Management Section */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
        {/* Controls: Search & Segmented Filter Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              placeholder="Search by Bed ID or Patient Name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9.5 pr-4 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition"
            />
          </div>

          <div className="flex items-center bg-slate-50 border border-slate-200/90 rounded-xl p-1 text-xs shadow-xs overflow-x-auto">
            {(
              [
                { id: 'all', label: 'All Beds', count: patients.length, color: 'text-slate-600' },
                { id: 'Critical', label: 'Critical', count: criticalCount, color: 'text-rose-600' },
                { id: 'Warning', label: 'Warning', count: warningCount, color: 'text-amber-600' },
                { id: 'Stable', label: 'Stable', count: stableCount, color: 'text-emerald-600' },
              ] as const
            ).map((t) => (
              <button
                key={t.id}
                onClick={() => setTierFilter(t.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium text-xs whitespace-nowrap transition cursor-pointer ${
                  tierFilter === t.id
                    ? 'bg-white text-slate-900 shadow-xs font-semibold'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                <span>{t.label}</span>
                <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full bg-slate-100 ${t.color}`}>
                  {t.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Patients Grid */}
        {filteredPatients.length === 0 ? (
          <div className="text-center py-14 border border-dashed border-slate-200 rounded-2xl">
            <HeartPulse className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-slate-800">No matching patient beds found</p>
            <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
              {searchQuery
                ? `No active ICU beds match query "${searchQuery}". Try clearing filters.`
                : 'No patients registered in this tier category.'}
            </p>
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="mt-3 text-xs text-sky-600 font-medium hover:underline cursor-pointer"
              >
                Clear Search
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredPatients.map((p) => {
              const isCrit = p.latest_tier === 'Critical';
              const isWarn = p.latest_tier === 'Warning';
              return (
                <div
                  key={p.id}
                  className={`group relative rounded-2xl border p-5 transition-all duration-300 flex flex-col justify-between ${
                    isCrit
                      ? 'border-rose-200/90 bg-rose-50/20 glow-critical hover:shadow-lg hover:-translate-y-0.5'
                      : isWarn
                      ? 'border-amber-200/90 bg-amber-50/20 glow-warning hover:shadow-lg hover:-translate-y-0.5'
                      : 'border-slate-200/90 bg-white hover:border-slate-300 hover:shadow-md hover:-translate-y-0.5'
                  }`}
                >
                  <div>
                    {/* Bed ID & Status Pill Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-9 h-9 rounded-xl flex items-center justify-center font-mono font-bold text-xs ${
                            isCrit
                              ? 'bg-rose-100 text-rose-700'
                              : isWarn
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-sky-50 text-sky-700'
                          }`}
                        >
                          {p.display_id.replace(/[^0-9]/g, '') || '01'}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 text-sm font-mono tracking-tight">
                              {p.display_id}
                            </span>
                            {p.active_alerts_count > 0 && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 animate-pulse">
                                {p.active_alerts_count} ALERT{p.active_alerts_count > 1 ? 'S' : ''}
                              </span>
                            )}
                          </div>
                          <span className="text-xs text-slate-500 font-medium block">
                            {p.display_name || 'ICU Patient'}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
                          isCrit
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : isWarn
                            ? 'bg-amber-100 text-amber-700 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                        }`}
                      >
                        {p.latest_tier || 'Pending'}
                      </span>
                    </div>

                    {/* Quick Vitals Preview Chips */}
                    <div className="grid grid-cols-3 gap-2 mt-4 pt-3.5 border-t border-slate-100/90">
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase">
                          <Heart className="w-3 h-3 text-rose-500" /> HR
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-800 mt-0.5">Active</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase">
                          <Activity className="w-3 h-3 text-sky-500" /> SpO2
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-800 mt-0.5">Stream</span>
                      </div>
                      <div className="p-2 rounded-xl bg-slate-50 border border-slate-100 flex flex-col items-center text-center">
                        <div className="flex items-center gap-1 text-[10px] font-semibold text-slate-400 uppercase">
                          <Gauge className="w-3 h-3 text-indigo-500" /> BP
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-800 mt-0.5">Auto</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Timestamp and Open Monitor Action */}
                  <div className="mt-4 pt-3 border-t border-slate-100/90 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px] font-mono">
                      {p.latest_reading_time
                        ? `Observed ${new Date(p.latest_reading_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`
                        : 'Awaiting telemetry'}
                    </span>
                    <Link
                      to={`/monitor?patient=${p.display_id}`}
                      className="text-sky-600 hover:text-sky-700 font-semibold inline-flex items-center gap-1 text-xs group-hover:translate-x-0.5 transition-transform"
                    >
                      Bed Monitor <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
