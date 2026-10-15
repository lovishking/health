import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, Activity, Database, Terminal, Zap } from 'lucide-react';
import { api, ReplayStatus } from '../api/client';
import { Patient } from '../types';

export const SimulatorPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('DEMO-001');
  const [dataSource, setDataSource] = useState<'dataset' | 'synthetic'>('dataset');
  const [scenario, setScenario] = useState<'stable' | 'deteriorating' | 'critical_override'>('deteriorating');
  const [speed, setSpeed] = useState<number>(1000); // ms
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [stepCount, setStepCount] = useState(0);

  useEffect(() => {
    api.getPatients().then((data) => {
      setPatients(data);
      if (data.length > 0 && !data.some(p => p.display_id === patientId)) {
        setPatientId(data[0].display_id);
      }
    }).catch(console.error);

    // Initial check of backend replay status
    api.getReplayStatus().then((status) => {
      if (status.is_running) {
        setIsRunning(true);
        setIsPaused(status.is_paused);
        setPatientId(status.patient_id);
        setStepCount(status.sent_count);
        setSpeed(status.speed * 1000);
        setDataSource(status.source.startsWith('physionet') ? 'dataset' : 'synthetic');
        appendLog(`Connected to active backend stream for ${status.patient_id} (${status.source})`);
      }
    }).catch(console.error);
  }, []);

  const appendLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 100)]);
  };

  // Sync polling when running
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(async () => {
      try {
        const s = await api.getReplayStatus();
        setIsRunning(s.is_running);
        setIsPaused(s.is_paused);
        setStepCount(s.sent_count);
        if (s.last_reading) {
          const lr = s.last_reading;
          appendLog(`[#${s.sent_count}] HR: ${lr.heart_rate} bpm | SpO2: ${lr.spo2}% | BP: ${lr.systolic_bp}/${lr.diastolic_bp} | Source: ${lr.source}`);
        }
      } catch (e) {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isRunning]);

  const startReplay = async () => {
    try {
      const sourceKey = dataSource === 'dataset' ? 'physionet_2012' : 'synthetic_sim';
      appendLog(`Initiating real-time replay for ${patientId} (Source: ${sourceKey}, Speed: ${speed / 1000}s)...`);
      const res = await api.startReplay(patientId, speed / 1000, sourceKey, true);
      setIsRunning(true);
      setIsPaused(false);
      setStepCount(res.sent_count);
      appendLog(`Replay active! Streaming from ${res.source} (${res.total_records} records loaded)`);
    } catch (err: any) {
      appendLog(`[ERROR] Failed to start replay: ${err.message}`);
    }
  };

  const pauseReplay = async () => {
    try {
      const res = await api.pauseReplay();
      setIsPaused(true);
      appendLog('Stream paused on server.');
    } catch (err: any) {
      appendLog(`[ERROR] Failed to pause: ${err.message}`);
    }
  };

  const resumeReplay = async () => {
    try {
      const res = await api.resumeReplay();
      setIsPaused(false);
      appendLog('Stream resumed on server.');
    } catch (err: any) {
      appendLog(`[ERROR] Failed to resume: ${err.message}`);
    }
  };

  const stopReplay = async () => {
    try {
      await api.stopReplay();
      setIsRunning(false);
      setIsPaused(false);
      appendLog('Stream stopped.');
    } catch (err: any) {
      appendLog(`[ERROR] Failed to stop: ${err.message}`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Physiological Replay & Simulation Engine</h1>
              <p className="text-xs text-slate-500 mt-0.5">
                Streams real historical ICU datasets (PhysioNet Challenge 2012) and synthetic trajectories in real time
              </p>
            </div>
          </div>
          {isRunning && (
            <div className="flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-1.5 text-xs text-emerald-700 font-medium px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200/70">
                <span className="relative flex h-2 w-2">
                  <span className={`${isPaused ? '' : 'animate-ping'} absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75`}></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {isPaused ? 'PAUSED' : 'STREAMING LIVE'}
              </div>
              <span className="text-xs text-slate-600 font-mono bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200/80">
                #{stepCount} readings sent
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Control Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 space-y-4 shadow-xs">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Stream Configuration</h2>

          {/* Data Source Selection */}
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">Data Source:</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setDataSource('dataset')}
                disabled={isRunning}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                  dataSource === 'dataset'
                    ? 'bg-sky-50 text-sky-700 border-sky-300 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Database className="w-3.5 h-3.5" /> PhysioNet 2012
              </button>
              <button
                type="button"
                onClick={() => setDataSource('synthetic')}
                disabled={isRunning}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border flex items-center justify-center gap-1.5 transition ${
                  dataSource === 'synthetic'
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-300 shadow-xs'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <Zap className="w-3.5 h-3.5" /> Synthetic Sim
              </button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5 leading-relaxed">
              {dataSource === 'dataset'
                ? 'Replays authentic ICU time series from PhysioNet Challenge 2012 cohort.'
                : 'Generates mathematical trajectories for algorithmic boundary testing.'}
            </p>
          </div>

          {/* Patient ID */}
          <div>
            <label className="text-xs font-medium text-slate-700 block mb-1.5">Target Patient Bed:</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              disabled={isRunning}
              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 font-mono outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition"
            >
              {patients.map((p) => (
                <option key={p.id} value={p.display_id}>
                  {p.display_id} - {p.display_name || 'Patient'}
                </option>
              ))}
              {!patients.some((p) => p.display_id === patientId) && (
                <option value={patientId}>{patientId}</option>
              )}
            </select>
          </div>

          {/* Scenario (only if synthetic) */}
          {dataSource === 'synthetic' && (
            <div>
              <label className="text-xs font-medium text-slate-700 block mb-1.5">Simulation Trajectory:</label>
              <select
                value={scenario}
                onChange={(e) => setScenario(e.target.value as any)}
                disabled={isRunning}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 outline-none focus:bg-white focus:border-sky-500 focus:ring-2 focus:ring-sky-100 transition"
              >
                <option value="deteriorating">Deteriorating (Hypoxemia + Septic Tachycardia)</option>
                <option value="critical_override">Critical Override (Severe Bradycardia & Shock)</option>
                <option value="stable">Stable (Physiological Baseline Variations)</option>
              </select>
            </div>
          )}

          {/* Speed */}
          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="text-xs font-medium text-slate-700">Playback Interval:</label>
              <span className="text-xs font-mono font-semibold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                {speed / 1000}s
              </span>
            </div>
            <input
              type="range"
              min="200"
              max="5000"
              step="100"
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={isRunning}
              className="w-full accent-sky-600 cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-slate-400 font-mono mt-1">
              <span>0.2s (Rapid)</span>
              <span>1.0s (Real-Time)</span>
              <span>5.0s (Slow)</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex gap-2">
            {!isRunning ? (
              <button
                onClick={startReplay}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-medium text-xs shadow-xs transition cursor-pointer"
              >
                <Play className="w-3.5 h-3.5 fill-current" /> Start Continuous Stream
              </button>
            ) : (
              <>
                {isPaused ? (
                  <button
                    onClick={resumeReplay}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs shadow-xs transition cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" /> Resume
                  </button>
                ) : (
                  <button
                    onClick={pauseReplay}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white font-medium text-xs shadow-xs transition cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5 fill-current" /> Pause
                  </button>
                )}
                <button
                  onClick={stopReplay}
                  className="px-4 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium text-xs shadow-xs transition cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5 fill-current" /> Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Terminal Logs */}
        <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-2xl p-5 flex flex-col font-mono text-xs shadow-xs">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-slate-500" />
              <span className="text-slate-800 font-semibold text-xs font-sans">Replay Ingestion Telemetry Log</span>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] text-slate-400 hover:text-slate-700 transition font-sans cursor-pointer"
            >
              Clear Log
            </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-1.5 max-h-[350px] pr-2 select-text bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
            {logs.length === 0 ? (
              <p className="text-slate-400 italic">No stream events yet. Click &quot;Start Continuous Stream&quot; to begin.</p>
            ) : (
              logs.map((log, i) => (
                <div
                  key={i}
                  className={`text-[11px] leading-relaxed font-mono ${
                    log.includes('ERROR')
                      ? 'text-rose-600 font-semibold'
                      : log.includes('PhysioNet') || log.includes('physionet')
                      ? 'text-sky-700 font-medium'
                      : log.includes('Replay active')
                      ? 'text-emerald-700 font-semibold'
                      : 'text-slate-700'
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
