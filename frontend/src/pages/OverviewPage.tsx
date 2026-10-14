import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Patient } from '../types';
import { Users, AlertTriangle, ShieldCheck, HeartPulse, Activity, ArrowRight, Server, RefreshCw } from 'lucide-react';

export const OverviewPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const data = await api.getPatients();
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
    const interval = setInterval(fetchPatients, 5000);
    return () => clearInterval(interval);
  }, []);

  const criticalCount = patients.filter((p) => p.latest_tier === 'Critical').length;
  const warningCount = patients.filter((p) => p.latest_tier === 'Warning').length;
  const stableCount = patients.filter((p) => p.latest_tier === 'Stable').length;
  const totalAlerts = patients.reduce((acc, p) => acc + (p.active_alerts_count || 0), 0);

  return (
    <div className="space-y-6">
      {/* Top Banner / Disclaimer */}
      <div className="bg-sky-950/40 border border-sky-800/40 rounded-xl p-4 flex items-start gap-3">
        <Activity className="w-5 h-5 text-sky-400 mt-0.5 flex-shrink-0" />
        <div className="text-xs text-sky-200 leading-relaxed">
          <strong className="text-sky-300 font-semibold block mb-0.5">Clinical Decision Support Notice</strong>
          RT-HDSS is an academic research prototype demonstrating real-time ICU data replay, multi-modal risk scoring,
          and clinical safety overrides. Numerical thresholds and probabilities do not replace medical judgment.
        </div>
      </div>

      {/* Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Monitored Patients</span>
            <Users className="w-4 h-4 text-sky-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-white mt-2">{patients.length}</div>
          <div className="text-xs text-slate-400 mt-1">Active observation cohort</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Critical Tiers</span>
            <AlertTriangle className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-rose-400 mt-2">{criticalCount}</div>
          <div className="text-xs text-slate-400 mt-1">Requires urgent clinician review</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Warning Tiers</span>
            <HeartPulse className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-amber-400 mt-2">{warningCount}</div>
          <div className="text-xs text-slate-400 mt-1">Borderline physiological vitals</div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between text-slate-400 text-xs font-medium">
            <span>Stable Cohort</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold font-mono text-emerald-400 mt-2">{stableCount}</div>
          <div className="text-xs text-slate-400 mt-1">Within normal baseline limits</div>
        </div>
      </div>

      {/* Patient Cohort Grid */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-white">Monitored Patient Cohort</h2>
            <p className="text-xs text-slate-400">Real-time status synced via WebSockets</p>
          </div>
          <button
            onClick={fetchPatients}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 text-xs text-slate-300 hover:bg-slate-700 transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {patients.length === 0 ? (
          <div className="text-center py-12 border border-dashed border-slate-800 rounded-lg">
            <HeartPulse className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm text-slate-400">No patients currently registered.</p>
            <p className="text-xs text-slate-400 mt-1">
              Start the Replay Engine from the navigation bar to stream simulated ICU patient observations.
            </p>
            <Link
              to="/simulator"
              className="inline-flex items-center gap-1.5 mt-4 px-4 py-2 rounded-lg bg-sky-500 text-white text-xs font-medium hover:bg-sky-400 transition"
            >
              Launch Replay Engine
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {patients.map((p) => {
              const isCrit = p.latest_tier === 'Critical';
              const isWarn = p.latest_tier === 'Warning';
              return (
                <div
                  key={p.id}
                  className={`border rounded-xl p-4 bg-slate-950/60 transition ${
                    isCrit
                      ? 'border-red-500/50 glow-critical'
                      : isWarn
                      ? 'border-amber-500/50 glow-warning'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-white text-sm">{p.display_id}</span>
                        {p.active_alerts_count > 0 && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                            {p.active_alerts_count} ALERT
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400">{p.display_name || 'ICU Patient'}</span>
                    </div>

                    <span
                      className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${
                        isCrit
                          ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                          : isWarn
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      }`}
                    >
                      {p.latest_tier || 'Pending'}
                    </span>
                  </div>

                  <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs">
                    <span className="text-slate-400 text-[11px]">
                      {p.latest_reading_time
                        ? `Last: ${new Date(p.latest_reading_time).toLocaleTimeString()}`
                        : 'No readings yet'}
                    </span>
                    <Link
                      to={`/monitor?patient=${p.display_id}`}
                      className="text-sky-400 hover:text-sky-300 font-medium inline-flex items-center gap-1 text-xs"
                    >
                      Monitor <ArrowRight className="w-3.5 h-3.5" />
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
