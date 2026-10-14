import React, { useEffect, useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../api/client';
import { Patient, VitalReading, RiskPrediction } from '../types';
import { VitalCard } from '../components/VitalCard';
import { useWebSocket } from '../hooks/useWebSocket';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from 'recharts';
import { Activity, Clock, ShieldAlert, CheckCircle, Database } from 'lucide-react';

export const PatientDetailPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentPatientId = searchParams.get('patient') || 'DEMO-001';

  const [patients, setPatients] = useState<Patient[]>([]);
  const [readings, setReadings] = useState<VitalReading[]>([]);
  const [latestRisk, setLatestRisk] = useState<RiskPrediction | null>(null);
  const [loading, setLoading] = useState(false);

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

  useEffect(() => {
    loadData(currentPatientId);
  }, [currentPatientId]);

  // Handle incoming live WebSocket readings
  const handleLiveEvent = (event: any) => {
    if (event.type === 'reading_update' && event.patient_id === currentPatientId) {
      const newReading: VitalReading = {
        id: event.data.id,
        patient_id: event.patient_id,
        source: 'stream',
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
      // refresh risk
      api.getLatestRisk(currentPatientId).then(setLatestRisk).catch(() => {});
    }
  };

  useWebSocket(currentPatientId, handleLiveEvent);

  const latest = readings.length > 0 ? readings[readings.length - 1] : null;

  // Format chart time
  const chartData = useMemo(() => {
    return readings.map((r) => ({
      time: new Date(r.event_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
      heart_rate: r.heart_rate,
      spo2: r.spo2,
      systolic_bp: r.systolic_bp,
      diastolic_bp: r.diastolic_bp,
      respiratory_rate: r.respiratory_rate,
      temperature: r.temperature,
    }));
  }, [readings]);

  return (
    <div className="space-y-6">
      {/* Patient Header & Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-white">{currentPatientId}</h1>
              {latestRisk && (
                <span
                  className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
                    latestRisk.final_tier === 'Critical'
                      ? 'bg-red-500/20 text-red-400 border-red-500/40 glow-critical'
                      : latestRisk.final_tier === 'Warning'
                      ? 'bg-amber-500/20 text-amber-400 border-amber-500/40 glow-warning'
                      : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 glow-stable'
                  }`}
                >
                  {latestRisk.final_tier} Tier
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              {latest ? `Latest Observation: ${new Date(latest.event_timestamp).toLocaleTimeString()}` : 'No readings yet'}
            </p>
          </div>
        </div>

        {/* Patient Switcher */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400 font-medium">Switch Patient:</label>
          <select
            value={currentPatientId}
            onChange={(e) => setSearchParams({ patient: e.target.value })}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 focus:ring-1 focus:ring-sky-500 outline-none"
          >
            {patients.map((p) => (
              <option key={p.id} value={p.display_id}>
                {p.display_id} {p.display_name ? `(${p.display_name})` : ''} - {p.latest_tier || 'Pending'}
              </option>
            ))}
            {!patients.some((p) => p.display_id === currentPatientId) && (
              <option value={currentPatientId}>{currentPatientId}</option>
            )}
          </select>
        </div>
      </div>

      {/* Vital Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        <VitalCard
          label="Heart Rate"
          value={latest?.heart_rate}
          unit="bpm"
          normalRange="60 - 100"
          type="hr"
          isCritical={latest?.heart_rate ? latest.heart_rate > 150 || latest.heart_rate < 40 : false}
          isWarning={latest?.heart_rate ? (latest.heart_rate > 100 && latest.heart_rate <= 150) || (latest.heart_rate >= 40 && latest.heart_rate < 60) : false}
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
          value={latest?.systolic_bp && latest?.diastolic_bp ? `${Math.round(latest.systolic_bp)}/${Math.round(latest.diastolic_bp)}` : '--'}
          unit="mmHg"
          normalRange="90/60 - 120/80"
          type="bp"
          isCritical={latest?.systolic_bp ? latest.systolic_bp < 75 || latest.systolic_bp > 210 : false}
          isWarning={latest?.systolic_bp ? (latest.systolic_bp >= 75 && latest.systolic_bp < 90) || (latest.systolic_bp > 140 && latest.systolic_bp <= 210) : false}
        />
        <VitalCard
          label="Respiratory Rate"
          value={latest?.respiratory_rate}
          unit="/min"
          normalRange="12 - 20"
          type="resp"
          isCritical={latest?.respiratory_rate ? latest.respiratory_rate > 35 || latest.respiratory_rate < 8 : false}
          isWarning={latest?.respiratory_rate ? (latest.respiratory_rate > 20 && latest.respiratory_rate <= 35) || (latest.respiratory_rate >= 8 && latest.respiratory_rate < 12) : false}
        />
        <VitalCard
          label="Temperature"
          value={latest?.temperature}
          unit="°C"
          normalRange="36.5 - 37.5"
          type="temp"
          isCritical={latest?.temperature ? latest.temperature > 40.5 || latest.temperature < 34.0 : false}
          isWarning={latest?.temperature ? (latest.temperature > 37.8 && latest.temperature <= 40.5) || (latest.temperature >= 34.0 && latest.temperature < 36.0) : false}
        />
      </div>

      {/* Recharts Time-Series Graphs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SpO2 and Heart Rate Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Oxygen Saturation (SpO2) & Heart Rate</h2>
              <p className="text-[11px] text-slate-400">Live chronological trajectory</p>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
              Live Stream
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis yAxisId="hr" domain={[30, 180]} stroke="#f43f5e" tick={{ fontSize: 10 }} orientation="left" />
                <YAxis yAxisId="spo2" domain={[70, 100]} stroke="#0ea5e9" tick={{ fontSize: 10 }} orientation="right" />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line yAxisId="hr" type="monotone" dataKey="heart_rate" name="Heart Rate (bpm)" stroke="#f43f5e" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line yAxisId="spo2" type="monotone" dataKey="spo2" name="SpO2 (%)" stroke="#0ea5e9" strokeWidth={2} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Blood Pressure Chart */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-semibold text-white">Arterial Blood Pressure (Sys / Dia)</h2>
              <p className="text-[11px] text-slate-400">Pressure trends (mmHg)</p>
            </div>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-400 border border-indigo-800">
              Hemodynamics
            </span>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                <YAxis domain={[30, 200]} stroke="#818cf8" tick={{ fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '12px' }} />
                <Legend wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }} />
                <Line type="monotone" dataKey="systolic_bp" name="Systolic BP" stroke="#818cf8" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="diastolic_bp" name="Diastolic BP" stroke="#a5b4fc" strokeWidth={2} strokeDasharray="4 4" dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Reading History Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-sm font-semibold text-white">Physiological Reading History</h2>
            <p className="text-[11px] text-slate-400">Audited timestamped measurements</p>
          </div>
          <span className="text-xs text-slate-400 font-mono">{readings.length} records loaded</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950 text-slate-400 font-medium border-b border-slate-800">
              <tr>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3">HR (bpm)</th>
                <th className="py-2.5 px-3">SpO2 (%)</th>
                <th className="py-2.5 px-3">BP (Sys/Dia)</th>
                <th className="py-2.5 px-3">Resp (/min)</th>
                <th className="py-2.5 px-3">Temp (°C)</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3">Quality Flags</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {readings.slice(-15).reverse().map((r) => (
                <tr key={r.id} className="hover:bg-slate-800/30 transition">
                  <td className="py-2 px-3 text-slate-300">
                    {new Date(r.event_timestamp).toLocaleTimeString()}
                  </td>
                  <td className={`py-2 px-3 ${r.heart_rate && (r.heart_rate > 140 || r.heart_rate < 50) ? 'text-red-400 font-bold' : 'text-slate-200'}`}>
                    {r.heart_rate ?? '--'}
                  </td>
                  <td className={`py-2 px-3 ${r.spo2 && r.spo2 < 90 ? 'text-red-400 font-bold' : 'text-slate-200'}`}>
                    {r.spo2 ?? '--'}%
                  </td>
                  <td className="py-2 px-3 text-slate-200">
                    {r.systolic_bp && r.diastolic_bp ? `${r.systolic_bp}/${r.diastolic_bp}` : '--'}
                  </td>
                  <td className="py-2 px-3 text-slate-200">{r.respiratory_rate ?? '--'}</td>
                  <td className="py-2 px-3 text-slate-200">{r.temperature ?? '--'}</td>
                  <td className="py-2 px-3 text-slate-400 text-[11px] font-sans">{r.source}</td>
                  <td className="py-2 px-3">
                    {r.quality_flags ? (
                      <span className="text-amber-400 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800 font-sans">
                        Flagged
                      </span>
                    ) : (
                      <span className="text-emerald-400 text-[10px] font-sans">Clean</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
