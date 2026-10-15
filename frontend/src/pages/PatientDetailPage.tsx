import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { api, ReplayStatus } from '../api/client';
import { Patient, VitalReading, RiskPrediction, Alert } from '../types';
import { VitalCard } from '../components/VitalCard';
import { useWebSocket } from '../hooks/useWebSocket';
import { playAlertSound } from '../utils/audio';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine,
} from 'recharts';
import {
  Activity,
  Play,
  Pause,
  Square,
  Zap,
  ShieldAlert,
  ArrowUpRight,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Bell,
  Check,
  Volume2,
} from 'lucide-react';

export const PatientDetailPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPatientId = searchParams.get('patient') || 'DEMO-001';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [readings, setReadings] = useState<VitalReading[]>([]);
  const [latestRisk, setLatestRisk] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(false);

  // Alerts column state
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [alertsScope, setAlertsScope] = useState<'this_bed' | 'all_beds'>('this_bed');
  const [newestAlertId, setNewestAlertId] = useState<string | null>(null);

  // Replay & Streaming state
  const [replayStatus, setReplayStatus] = useState<ReplayStatus | null>(null);
  const [streamSpeed, setStreamSpeed] = useState<number>(1.0);
  const [streamSource, setStreamSource] = useState<string>('physionet_2012');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Load patients list for selector
  useEffect(() => {
    api.getPatients().then(setPatients).catch(console.error);
  }, []);

  // Fetch readings & risk for active patient
  const loadData = async (pId: string) => {
    try {
      setLoading(true);
      const [fetchedReadings, riskData] = await Promise.allSettled([
        api.getReadings(pId, 60),
        api.getLatestRisk(pId),
      ]);
      if (fetchedReadings.status === 'fulfilled') {
        setReadings(fetchedReadings.value.reverse()); // oldest to newest for charts
      }
      if (riskData.status === 'fulfilled') {
        setLatestRisk(riskData.value);
      } else {
        setLatestRisk(null);
      }
    } finally {
      setLoading(false);
    }
  };

  // Fetch alerts for active patient or all beds
  const loadAlerts = useCallback(async (pId: string, scope: 'this_bed' | 'all_beds') => {
    try {
      if (scope === 'this_bed') {
        const patientAlerts = await api.getAlerts(pId);
        setAlerts(patientAlerts);
      } else {
        const all = await api.getAllAlerts(undefined, 40);
        setAlerts(all);
      }
    } catch (err) {
      console.error('Failed to load alerts', err);
    }
  }, []);

  useEffect(() => {
    loadData(currentPatientId);
    loadAlerts(currentPatientId, alertsScope);
  }, [currentPatientId, alertsScope, loadAlerts]);

  // Track currentPatientId in a ref to avoid stale closures in WS handler
  const currentPatientIdRef = useRef(currentPatientId);
  useEffect(() => {
    currentPatientIdRef.current = currentPatientId;
  }, [currentPatientId]);

  // Handle incoming live WebSocket events
  const handleLiveEvent = useCallback((event: any) => {
    const pid = currentPatientIdRef.current;

    // Reading updates
    if (event.type === 'reading_update' && event.patient_id === pid) {
      const newReading: VitalReading = {
        id: event.data.id,
        patient_id: event.patient_id,
        source: event.data.source || 'stream',
        event_timestamp: event.data.event_timestamp,
        ingested_at: event.data.event_timestamp,
        heart_rate: event.data.heart_rate,
        spo2: event.data.spo2,
        systolic_bp: event.data.systolic_bp,
        diastolic_bp: event.data.diastolic_bp,
        respiratory_rate: event.data.respiratory_rate,
        temperature: event.data.temperature,
        quality_flags: event.data.quality_flags,
      };

      setReadings((prev) => [...prev.slice(-59), newReading]);
      setLastUpdated(new Date());

      // Update replay counter status in real-time
      setReplayStatus((prev) =>
        prev
          ? {
              ...prev,
              is_running: true,
              is_paused: false,
              sent_count: prev.sent_count + 1,
              last_reading: event.data,
            }
          : prev
      );

      // Update risk tier from broadcast payload
      if (event.data.risk_tier) {
        setLatestRisk((prev) =>
          prev ? { ...prev, final_tier: event.data.risk_tier, decision_source: event.data.decision_source } : prev
        );
      }
      api.getLatestRisk(pid).then(setLatestRisk).catch(() => {});
    }

    // Real-time alert triggers
    if (event.type === 'alert_triggered' || (event.type === 'reading_update' && event.data?.alert_created)) {
      const isCrit = event.data?.risk_tier === 'Critical' || event.data?.severity === 'critical';
      const eventPid = event.patient_id || event.data?.patient_id || pid;
      const alertId = event.data?.id || `alert-${Date.now()}`;

      const newAlert: Alert = {
        id: alertId,
        patient_id: eventPid,
        severity: isCrit ? 'critical' : 'warning',
        message:
          event.data?.message ||
          `[${isCrit ? 'CRITICAL' : 'WARNING'}] Vital deterioration detected for ${eventPid} (SpO2: ${event.data?.spo2 ?? '--'}%, HR: ${event.data?.heart_rate ?? '--'} bpm)`,
        status: 'active',
        created_at: new Date().toISOString(),
      };

      // Set newest alert ID to trigger smooth left-to-right animation
      setNewestAlertId(alertId);

      // Prepend to stack so it mounts directly on top of previous alerts
      setAlerts((prev) => [newAlert, ...prev.filter((a) => a.id !== alertId)]);

      // Chime audio alert
      playAlertSound(isCrit);
    }
  }, []);

  useWebSocket(currentPatientId, handleLiveEvent);

  // Poll replay status and auto-start streaming for active patient
  useEffect(() => {
    let isMounted = true;

    const checkAndAutoStart = async () => {
      try {
        const status = await api.getReplayStatus();
        if (!isMounted) return;
        setReplayStatus(status);

        if (!status.is_running || status.patient_id !== currentPatientId) {
          const started = await api.startReplay(currentPatientId, streamSpeed, streamSource, true);
          if (isMounted) setReplayStatus(started);
        }
      } catch (err) {
        console.error('Error auto-starting dataset stream:', err);
      }
    };

    checkAndAutoStart();

    const interval = setInterval(async () => {
      try {
        const s = await api.getReplayStatus();
        if (isMounted) setReplayStatus(s);
      } catch (e) {}
    }, 4000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [currentPatientId, streamSource]);

  // Replay control handlers
  const handleStart = async () => {
    try {
      const s = await api.startReplay(currentPatientId, streamSpeed, streamSource, true);
      setReplayStatus(s);
    } catch (err) {
      console.error(err);
    }
  };

  const handlePause = async () => {
    try {
      const s = await api.pauseReplay();
      setReplayStatus(s);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResume = async () => {
    try {
      const s = await api.resumeReplay();
      setReplayStatus(s);
    } catch (err) {
      console.error(err);
    }
  };

  const handleStop = async () => {
    try {
      const s = await api.stopReplay();
      setReplayStatus(s);
    } catch (err) {
      console.error(err);
    }
  };

  const handleSpeedChange = async (newSpeed: number) => {
    setStreamSpeed(newSpeed);
    if (replayStatus?.is_running) {
      try {
        const s = await api.startReplay(currentPatientId, newSpeed, streamSource, true);
        setReplayStatus(s);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // Acknowledge alert handler
  const handleAcknowledgeAlert = async (alertId: string) => {
    try {
      await api.acknowledgeAlert(alertId, 'Dr. Clinician');
      setAlerts((prev) =>
        prev.map((a) => (a.id === alertId ? { ...a, status: 'acknowledged' } : a))
      );
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    }
  };

  const latest = readings.length > 0 ? readings[readings.length - 1] : null;

  // Format chart time with guaranteed numeric conversions
  const chartData = useMemo(() => {
    if (!readings || readings.length === 0) return [];
    return readings.map((r) => ({
      time: new Date(r.event_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      heart_rate: r.heart_rate != null ? Number(r.heart_rate) : undefined,
      spo2: r.spo2 != null ? Number(r.spo2) : undefined,
      systolic_bp: r.systolic_bp != null ? Number(r.systolic_bp) : undefined,
      diastolic_bp: r.diastolic_bp != null ? Number(r.diastolic_bp) : undefined,
      respiratory_rate: r.respiratory_rate != null ? Number(r.respiratory_rate) : undefined,
      temperature: r.temperature != null ? Number(r.temperature) : undefined,
    }));
  }, [readings]);

  // Determine current active patient details
  const activePatient = patients.find((p) => p.display_id === currentPatientId);

  // Filtered alerts for display
  const displayAlerts = useMemo(() => {
    if (alertsScope === 'this_bed') {
      return alerts.filter((a) => a.patient_id === currentPatientId);
    }
    return alerts;
  }, [alerts, alertsScope, currentPatientId]);

  const activeAlertsCount = displayAlerts.filter((a) => a.status === 'active').length;

  return (
    <div className="flex flex-col xl:flex-row items-start gap-6 2xl:gap-8">
      {/* ============================================================== */}
      {/* MAIN LEFT WORKSPACE (Telemetry, Vitals, High-Res AreaCharts)   */}
      {/* ============================================================== */}
      <div className="flex-1 w-full min-w-0 space-y-6">
        {/* Patient Header & Quick Action Bar */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-5">
            {/* Identity & Status */}
            <div className="flex items-center gap-4.5">
              <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-sky-50 to-indigo-50 border border-sky-100 flex items-center justify-center text-sky-700 font-mono font-bold text-lg shadow-xs shrink-0">
                {currentPatientId.replace(/[^0-9]/g, '') || '01'}
              </div>
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-2xl font-bold font-mono text-slate-900 tracking-tight">
                    {currentPatientId}
                  </h1>
                  {latestRisk && (
                    <span
                      className={`text-xs font-semibold px-3 py-0.5 rounded-full border ${
                        latestRisk.final_tier === 'Critical'
                          ? 'bg-rose-100 text-rose-700 border-rose-200 glow-critical'
                          : latestRisk.final_tier === 'Warning'
                          ? 'bg-amber-100 text-amber-700 border-amber-200 glow-warning'
                          : 'bg-emerald-50 text-emerald-700 border-emerald-200 glow-stable'
                      }`}
                    >
                      {latestRisk.final_tier} Tier
                    </span>
                  )}
                  {/* Live stream beacon */}
                  <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    {lastUpdated ? `SYNC · ${lastUpdated.toLocaleTimeString()}` : 'STREAM READY'}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-1.5 flex-wrap">
                  <span className="font-medium text-slate-700">{activePatient?.display_name || 'ICU Critical Care Ward'}</span>
                  <span className="text-slate-300">·</span>
                  <span className="flex items-center gap-1.5 font-mono text-slate-400">
                    <Clock className="w-3.5 h-3.5" />
                    {latest ? `Latest Observation: ${new Date(latest.event_timestamp).toLocaleTimeString()}` : 'Awaiting observations'}
                  </span>
                </div>
              </div>
            </div>

            {/* Patient Switcher & Clinical Links */}
            <div className="flex items-center gap-3.5 flex-wrap">
              <Link
                to={`/risk?patient=${currentPatientId}`}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700 hover:text-slate-900 hover:bg-slate-100 transition shadow-xs"
              >
                <ShieldAlert className="w-3.5 h-3.5 text-indigo-500" />
                Risk Analysis <ArrowUpRight className="w-3 h-3 text-slate-400" />
              </Link>

              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-400 font-medium">Bed:</label>
                <select
                  value={currentPatientId}
                  onChange={(e) => setSearchParams({ patient: e.target.value })}
                  className="bg-slate-50 border border-slate-200 text-slate-800 text-xs font-semibold rounded-xl px-3 py-2 outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition shadow-xs cursor-pointer min-w-[140px]"
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.display_id}>
                      {p.display_id} · {p.latest_tier || 'Pending'}
                    </option>
                  ))}
                  {!patients.some((p) => p.display_id === currentPatientId) && (
                    <option value={currentPatientId}>{currentPatientId}</option>
                  )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Real-Time Telemetry Streaming Dock */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-[0_1px_3px_rgba(0,0,0,0.03)]">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div
                className={`p-2.5 rounded-xl border transition-all shrink-0 ${
                  replayStatus?.is_running && !replayStatus.is_paused
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-600'
                    : replayStatus?.is_paused
                    ? 'bg-amber-50 border-amber-200 text-amber-600'
                    : 'bg-slate-50 border-slate-200 text-slate-400'
                }`}
              >
                <Zap className={`w-4 h-4 ${replayStatus?.is_running && !replayStatus.is_paused ? 'animate-pulse' : ''}`} />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-900 font-sans">
                    PhysioNet Challenge 2012 ICU Telemetry
                  </span>
                  {replayStatus?.is_running ? (
                    replayStatus.is_paused ? (
                      <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                        PAUSED
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200/70 font-medium">
                        <span className="relative flex h-1.5 w-1.5">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                          <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                        </span>
                        BROADCASTING LIVE · {replayStatus.speed}s INTERVAL
                      </span>
                    )
                  ) : (
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-slate-100 text-slate-600 border border-slate-200">
                      IDLE
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  {replayStatus?.is_running
                    ? `Active ingestion for ${replayStatus.patient_id} · ${replayStatus.sent_count} telemetry packets streamed`
                    : 'Automatic real-time chronological streaming from ICU cohort record'}
                </p>
              </div>
            </div>

            {/* Speed Selector & Playback Controls */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl p-1 text-xs shadow-xs">
                <span className="text-[11px] text-slate-400 px-2.5 font-medium">Speed:</span>
                {[
                  { label: '0.5s', val: 0.5 },
                  { label: '1.0s', val: 1.0 },
                  { label: '2.0s', val: 2.0 },
                ].map((s) => (
                  <button
                    key={s.val}
                    onClick={() => handleSpeedChange(s.val)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition cursor-pointer ${
                      streamSpeed === s.val
                        ? 'bg-white text-slate-900 font-bold shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {s.label}
                  </button>
                ))}
              </div>

              {replayStatus?.is_running ? (
                <div className="flex items-center gap-2">
                  {replayStatus.is_paused ? (
                    <button
                      onClick={handleResume}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5 fill-current" /> Resume
                    </button>
                  ) : (
                    <button
                      onClick={handlePause}
                      className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <Pause className="w-3.5 h-3.5 fill-current" /> Pause
                    </button>
                  )}
                  <button
                    onClick={handleStop}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-50 hover:bg-rose-50 hover:text-rose-600 text-slate-700 text-xs font-semibold border border-slate-200 transition cursor-pointer"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" /> Stop
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleStart}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-semibold text-xs shadow-xs transition cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 fill-current" /> Start Stream
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Vital Metric Cards Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 sm:gap-4.5">
          <VitalCard
            label="Heart Rate"
            value={latest?.heart_rate}
            unit="bpm"
            normalRange="60 - 100"
            type="hr"
            isCritical={latest?.heart_rate ? latest.heart_rate > 150 || latest.heart_rate < 40 : false}
            isWarning={
              latest?.heart_rate
                ? (latest.heart_rate > 100 && latest.heart_rate <= 150) || (latest.heart_rate >= 40 && latest.heart_rate < 60)
                : false
            }
          />
          <VitalCard
            label="Oxygen (SpO2)"
            value={latest?.spo2}
            unit="%"
            normalRange="95 - 100"
            type="spo2"
            isCritical={latest?.spo2 ? latest.spo2 < 85 : false}
            isWarning={latest?.spo2 ? latest.spo2 >= 85 && latest.spo2 < 93 : false}
          />
          <VitalCard
            label="Blood Pressure"
            value={
              latest?.systolic_bp && latest?.diastolic_bp
                ? `${Math.round(latest.systolic_bp)}/${Math.round(latest.diastolic_bp)}`
                : '--'
            }
            unit="mmHg"
            normalRange="90/60 - 120/80"
            type="bp"
            isCritical={latest?.systolic_bp ? latest.systolic_bp < 75 || latest.systolic_bp > 210 : false}
            isWarning={
              latest?.systolic_bp
                ? (latest.systolic_bp >= 75 && latest.systolic_bp < 90) ||
                  (latest.systolic_bp > 140 && latest.systolic_bp <= 210)
                : false
            }
          />
          <VitalCard
            label="Respiratory Rate"
            value={latest?.respiratory_rate}
            unit="/min"
            normalRange="12 - 20"
            type="resp"
            isCritical={latest?.respiratory_rate ? latest.respiratory_rate > 35 || latest.respiratory_rate < 8 : false}
            isWarning={
              latest?.respiratory_rate
                ? (latest.respiratory_rate > 20 && latest.respiratory_rate <= 35) ||
                  (latest.respiratory_rate >= 8 && latest.respiratory_rate < 12)
                : false
            }
          />
          <VitalCard
            label="Temperature"
            value={latest?.temperature}
            unit="°C"
            normalRange="36.5 - 37.5"
            type="temp"
            isCritical={latest?.temperature ? latest.temperature > 40.5 || latest.temperature < 34.0 : false}
            isWarning={
              latest?.temperature
                ? (latest.temperature > 37.8 && latest.temperature <= 40.5) ||
                  (latest.temperature >= 34.0 && latest.temperature < 36.0)
                : false
            }
          />
        </div>

        {/* High-Resolution Time-Series AreaCharts */}
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-6">
          {/* SpO2 and Heart Rate AreaChart */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Cardio-Pulmonary Trajectory (SpO2 & Heart Rate)
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Live chronological ICU observations with gradient trends</p>
              </div>
              <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/80 font-medium shrink-0">
                Real-Time Feed
              </span>
            </div>

            <div className="w-full h-[320px] min-h-[320px]">
              {chartData.length === 0 ? (
                <div className="h-[320px] flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-100 rounded-xl">
                  <Activity className="w-8 h-8 text-sky-400 animate-pulse mb-2" />
                  <span>Awaiting telemetry stream points...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientHr" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#e11d48" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#e11d48" stopOpacity={0.0} />
                      </linearGradient>
                      <linearGradient id="gradientSpo2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0284c7" stopOpacity={0.18} />
                        <stop offset="95%" stopColor="#0284c7" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <YAxis
                      yAxisId="hr"
                      domain={[30, 180]}
                      stroke="#e11d48"
                      tick={{ fontSize: 10, fill: '#e11d48' }}
                      orientation="left"
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      yAxisId="spo2"
                      domain={[70, 100]}
                      stroke="#0284c7"
                      tick={{ fontSize: 10, fill: '#0284c7' }}
                      orientation="right"
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '14px',
                        boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
                        fontSize: '12px',
                        color: '#0f172a',
                        padding: '8px 12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                    <ReferenceLine yAxisId="spo2" y={90} stroke="#f43f5e" strokeDasharray="3 3" label={{ value: 'SpO2 Min', fill: '#f43f5e', fontSize: 9 }} />
                    <Area
                      yAxisId="hr"
                      type="monotone"
                      dataKey="heart_rate"
                      name="Heart Rate (bpm)"
                      stroke="#e11d48"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gradientHr)"
                      connectNulls={true}
                      isAnimationActive={false}
                    />
                    <Area
                      yAxisId="spo2"
                      type="monotone"
                      dataKey="spo2"
                      name="SpO2 (%)"
                      stroke="#0284c7"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gradientSpo2)"
                      connectNulls={true}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Arterial Blood Pressure AreaChart */}
          <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                  Hemodynamics & Arterial Pressure
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Systolic & Diastolic arterial pressure (mmHg)</p>
              </div>
              <span className="text-[10px] uppercase font-mono px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/80 font-medium shrink-0">
                Hemodynamics
              </span>
            </div>

            <div className="w-full h-[320px] min-h-[320px]">
              {chartData.length === 0 ? (
                <div className="h-[320px] flex flex-col items-center justify-center text-slate-400 text-xs border border-dashed border-slate-100 rounded-xl">
                  <Activity className="w-8 h-8 text-indigo-400 animate-pulse mb-2" />
                  <span>Awaiting blood pressure telemetry...</span>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -16, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradientSys" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.16} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                    <XAxis dataKey="time" stroke="#94a3b8" tick={{ fontSize: 10, fill: '#64748b' }} tickLine={false} />
                    <YAxis domain={[30, 200]} stroke="#4f46e5" tick={{ fontSize: 10, fill: '#4f46e5' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#ffffff',
                        borderColor: '#e2e8f0',
                        borderRadius: '14px',
                        boxShadow: '0 8px 24px -4px rgba(0,0,0,0.08)',
                        fontSize: '12px',
                        color: '#0f172a',
                        padding: '8px 12px',
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '12px' }} />
                    <ReferenceLine y={140} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Sys Limit', fill: '#f59e0b', fontSize: 9 }} />
                    <Area
                      type="monotone"
                      dataKey="systolic_bp"
                      name="Systolic BP"
                      stroke="#4f46e5"
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#gradientSys)"
                      connectNulls={true}
                      isAnimationActive={false}
                    />
                    <Area
                      type="monotone"
                      dataKey="diastolic_bp"
                      name="Diastolic BP"
                      stroke="#818cf8"
                      strokeWidth={1.8}
                      strokeDasharray="4 4"
                      fill="none"
                      connectNulls={true}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>
        </div>

        {/* Reading History Table */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 tracking-tight">Physiological Telemetry Log</h2>
              <p className="text-xs text-slate-400 mt-0.5">Audited timestamped observations streamed in chronological sequence</p>
            </div>
            <span className="text-xs text-slate-600 font-mono bg-slate-50 px-3 py-1 rounded-full border border-slate-200 font-medium">
              {readings.length} records active
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-200">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">HR (bpm)</th>
                  <th className="py-3 px-4">SpO2 (%)</th>
                  <th className="py-3 px-4">BP (Sys/Dia)</th>
                  <th className="py-3 px-4">Resp (/min)</th>
                  <th className="py-3 px-4">Temp (°C)</th>
                  <th className="py-3 px-4">Source Dataset</th>
                  <th className="py-3 px-4">Quality Signal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-slate-700">
                {readings
                  .slice(-15)
                  .reverse()
                  .map((r) => (
                    <tr key={r.id} className="hover:bg-slate-50/70 transition">
                      <td className="py-3 px-4 text-slate-500">
                        {new Date(r.event_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </td>
                      <td
                        className={`py-3 px-4 ${
                          r.heart_rate && (r.heart_rate > 140 || r.heart_rate < 50)
                            ? 'text-rose-600 font-bold'
                            : 'text-slate-900'
                        }`}
                      >
                        {r.heart_rate ?? '--'}
                      </td>
                      <td
                        className={`py-3 px-4 ${
                          r.spo2 && r.spo2 < 90 ? 'text-rose-600 font-bold' : 'text-slate-900'
                        }`}
                      >
                        {r.spo2 ?? '--'}%
                      </td>
                      <td className="py-3 px-4 text-slate-900 font-medium">
                        {r.systolic_bp && r.diastolic_bp ? `${r.systolic_bp}/${r.diastolic_bp}` : '--'}
                      </td>
                      <td className="py-3 px-4 text-slate-700">{r.respiratory_rate ?? '--'}</td>
                      <td className="py-3 px-4 text-slate-700">{r.temperature ?? '--'}</td>
                      <td className="py-3 px-4 font-sans">
                        {r.source === 'physionet_2012' ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-sky-50 text-sky-700 border border-sky-200/80 font-mono font-medium">
                            physionet_2012
                          </span>
                        ) : r.source?.includes('synthetic') ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] bg-purple-50 text-purple-700 border border-purple-200/80 font-mono font-medium">
                            synthetic
                          </span>
                        ) : (
                          <span className="text-slate-500 text-[11px] font-sans">{r.source}</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {r.quality_flags ? (
                          <span className="text-amber-700 text-[10px] px-2.5 py-0.5 rounded-full bg-amber-50 border border-amber-200 font-sans font-medium">
                            Flagged
                          </span>
                        ) : (
                          <span className="text-emerald-700 text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 font-sans font-medium inline-flex items-center gap-1">
                            <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Clean
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ============================================================== */}
      {/* VERTICAL ALERTS COLUMN (Right Side, Real-Time Smooth Stacking) */}
      {/* ============================================================== */}
      <div className="w-full xl:w-[420px] 2xl:w-[460px] shrink-0 xl:sticky xl:top-20 space-y-4">
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.03),0_6px_16px_rgba(0,0,0,0.02)]">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 shrink-0">
                <Bell className="w-4.5 h-4.5 animate-bounce-once" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 tracking-tight leading-none">Clinical Alerts Stack</h2>
                <p className="text-xs text-slate-400 mt-1">Real-time bedside escalations</p>
              </div>
            </div>

            <span
              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border shrink-0 ${
                activeAlertsCount > 0
                  ? 'bg-rose-100 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}
            >
              {activeAlertsCount} ACTIVE
            </span>
          </div>

          {/* Scope Filter Switcher */}
          <div className="grid grid-cols-2 gap-1.5 p-1 bg-slate-50 rounded-xl border border-slate-200/80 my-4 text-xs">
            <button
              onClick={() => setAlertsScope('this_bed')}
              className={`py-2 rounded-lg font-medium transition cursor-pointer text-center ${
                alertsScope === 'this_bed'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              This Bed ({alerts.filter((a) => a.patient_id === currentPatientId).length})
            </button>
            <button
              onClick={() => setAlertsScope('all_beds')}
              className={`py-2 rounded-lg font-medium transition cursor-pointer text-center ${
                alertsScope === 'all_beds'
                  ? 'bg-white text-slate-900 font-semibold shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              All Beds ({alerts.length})
            </button>
          </div>

          {/* Alerts Stack List */}
          <div className="space-y-3.5 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
            {displayAlerts.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200/80 rounded-2xl px-5">
                <CheckCircle2 className="w-9 h-9 text-emerald-500 mx-auto mb-2.5 opacity-80" />
                <p className="text-xs font-semibold text-slate-800">No active alerts</p>
                <p className="text-[11px] text-slate-400 mt-1 leading-relaxed">
                  All physiological vital parameters are currently within safe baseline targets.
                </p>
              </div>
            ) : (
              displayAlerts.map((alert) => {
                const isCritical = alert.severity === 'critical';
                const isNew = alert.id === newestAlertId;
                const isAcknowledged = alert.status === 'acknowledged';

                return (
                  <div
                    key={alert.id}
                    className={`rounded-2xl border p-4 transition-all duration-300 relative ${
                      isNew ? 'animate-slide-in-left' : ''
                    } ${
                      isAcknowledged
                        ? 'border-slate-200 bg-slate-50/60 opacity-60'
                        : isCritical
                        ? 'border-l-4 border-l-rose-500 border-rose-200/90 bg-rose-50/30 glow-critical shadow-xs'
                        : 'border-l-4 border-l-amber-500 border-amber-200/90 bg-amber-50/30 glow-warning shadow-xs'
                    }`}
                  >
                    {/* Header: Tag + Patient + Time */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isCritical
                              ? 'bg-rose-100 text-rose-700 border-rose-200'
                              : 'bg-amber-100 text-amber-700 border-amber-200'
                          }`}
                        >
                          {alert.severity}
                        </span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {alert.patient_id}
                        </span>
                      </div>

                      <span className="text-[10px] font-mono text-slate-400">
                        {new Date(alert.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                    </div>

                    {/* Alert Message */}
                    <p className="text-xs text-slate-700 font-medium leading-relaxed mb-3.5">
                      {alert.message}
                    </p>

                    {/* Footer: Acknowledge Button */}
                    <div className="flex items-center justify-between pt-2.5 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-sans">
                        {isAcknowledged ? 'Acknowledged' : 'Pending bedside review'}
                      </span>

                      {!isAcknowledged ? (
                        <button
                          onClick={() => handleAcknowledgeAlert(alert.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-semibold shadow-2xs transition cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600" /> Acknowledge
                        </button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Reviewed
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
