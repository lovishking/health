import React, { useState, useEffect, useRef } from 'react';
import { Play, Pause, Square, FastForward, Activity, CheckCircle, AlertTriangle, Terminal } from 'lucide-react';
import { api } from '../api/client';
import { Patient } from '../types';

export const SimulatorPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [patientId, setPatientId] = useState('ICU-BED-101');
  const [scenario, setScenario] = useState<'stable' | 'deteriorating' | 'critical_override'>('deteriorating');
  const [speed, setSpeed] = useState<number>(1000); // ms
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  useEffect(() => {
    api.getPatients().then((data) => {
      setPatients(data);
      if (data.length > 0 && !data.some(p => p.display_id === patientId)) {
        setPatientId(data[0].display_id);
      }
    }).catch(console.error);
  }, []);

  const isRunningRef = useRef(false);
  const isPausedRef = useRef(false);

  const appendLog = (msg: string) => {
    setLogs((prev) => [`[${new Date().toLocaleTimeString()}] ${msg}`, ...prev.slice(0, 100)]);
  };

  const startReplay = async () => {
    setIsRunning(true);
    setIsPaused(false);
    isRunningRef.current = true;
    isPausedRef.current = false;

    appendLog(`Starting stream for ${patientId} (Scenario: ${scenario}, Interval: ${speed}ms)`);

    let step = 0;
    const maxSteps = 40;

    const intervalId = window.setInterval(async () => {
      if (!isRunningRef.current) {
        clearInterval(intervalId);
        return;
      }
      if (isPausedRef.current) {
        return;
      }

      if (step >= maxSteps) {
        appendLog(`Replay sequence finished (${maxSteps} steps sent).`);
        setIsRunning(false);
        isRunningRef.current = false;
        clearInterval(intervalId);
        return;
      }

      const progress = step / maxSteps;
      let hr = 75,
        spo2 = 98,
        sys = 120,
        dia = 80,
        resp = 16,
        temp = 37.0;

      if (scenario === 'stable') {
        hr = Math.round(72 + 5 * Math.sin(step * 0.4) + (Math.random() * 4 - 2));
        spo2 = Math.round(98 + (Math.random() * 2 - 1));
        sys = Math.round(120 + 4 * Math.sin(step * 0.3) + (Math.random() * 4 - 2));
        dia = Math.round(80 + 3 * Math.sin(step * 0.3) + (Math.random() * 2 - 1));
        resp = Math.round(16 + (Math.random() * 2 - 1));
        temp = +(36.8 + (Math.random() * 0.2 - 0.1)).toFixed(1);
      } else if (scenario === 'deteriorating') {
        hr = Math.round(75 + progress * 70 + (Math.random() * 6 - 3)); // spikes to ~145
        spo2 = Math.round(98 - progress * 17 + (Math.random() * 2 - 1)); // drops to ~81%
        sys = Math.round(120 - progress * 45 + (Math.random() * 6 - 3)); // drops to ~75
        dia = Math.round(80 - progress * 28 + (Math.random() * 4 - 2));
        resp = Math.round(16 + progress * 18 + (Math.random() * 2 - 1)); // rises to ~34
        temp = +(37.0 + progress * 2.3 + (Math.random() * 0.2 - 0.1)).toFixed(1); // fever ~39.3 C
      } else if (scenario === 'critical_override') {
        hr = Math.round(70 - progress * 35 + (Math.random() * 4 - 2)); // bradycardia ~35 bpm
        spo2 = Math.round(95 - progress * 16 + (Math.random() * 2 - 1)); // hypoxemia ~79%
        sys = Math.round(115 - progress * 45 + (Math.random() * 4 - 2)); // shock ~70 mmHg
        dia = Math.round(75 - progress * 30 + (Math.random() * 2 - 1));
        resp = Math.round(15 - progress * 8 + (Math.random() * 2 - 1));
        temp = +(36.5 - progress * 3.0 + (Math.random() * 0.2 - 0.1)).toFixed(1); // hypothermia ~33.5 C
      }

      const payload = {
        source: 'synthetic',
        source_event_id: `live-sim-${patientId}-${step}-${Date.now()}`,
        event_timestamp: new Date().toISOString(),
        heart_rate: hr,
        spo2: spo2,
        systolic_bp: sys,
        diastolic_bp: dia,
        respiratory_rate: resp,
        temperature: temp,
      };

      try {
        await api.postReading(patientId, payload);
        appendLog(`[Step ${step + 1}/${maxSteps}] Ingested -> HR: ${hr} bpm | SpO2: ${spo2}% | BP: ${sys}/${dia} | Resp: ${resp}/min`);
      } catch (err: any) {
        appendLog(`[ERROR Step ${step + 1}] Failed to transmit: ${err.message}`);
      }

      step++;
    }, speed);
  };

  const pauseReplay = () => {
    setIsPaused(true);
    isPausedRef.current = true;
    appendLog('Replay stream paused.');
  };

  const resumeReplay = () => {
    setIsPaused(false);
    isPausedRef.current = false;
    appendLog('Replay stream resumed.');
  };

  const stopReplay = () => {
    setIsRunning(false);
    setIsPaused(false);
    isRunningRef.current = false;
    isPausedRef.current = false;
    appendLog('Replay stream stopped.');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400">
            <Activity className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">Physiological Replay & Simulation Engine</h1>
            <p className="text-xs text-slate-400 mt-1">
              Stream synthetic physiological trajectories and historical ICU data to test live ingestion and alerting
            </p>
          </div>
        </div>
      </div>

      {/* Control Console */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Settings Panel */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-semibold text-white">Stream Configuration</h2>

          {/* Patient ID */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Target Patient Bed:</label>
            <select
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              disabled={isRunning}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono outline-none focus:border-sky-500 mb-1"
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

          {/* Scenario */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Simulation Trajectory:</label>
            <select
              value={scenario}
              onChange={(e) => setScenario(e.target.value as any)}
              disabled={isRunning}
              className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-slate-200 outline-none focus:border-sky-500"
            >
              <option value="deteriorating">Deteriorating (Hypoxemia + Septic Tachycardia)</option>
              <option value="critical_override">Critical Override (Severe Bradycardia & Shock)</option>
              <option value="stable">Stable (Physiological Baseline Variations)</option>
            </select>
          </div>

          {/* Speed */}
          <div>
            <label className="text-xs text-slate-400 block mb-1">Playback Interval: {speed / 1000}s</label>
            <input
              type="range"
              min={300}
              max={3000}
              step={100}
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              disabled={isRunning}
              className="w-full accent-sky-500"
            />
          </div>

          {/* Controls */}
          <div className="pt-2 border-t border-slate-800 flex items-center gap-2">
            {!isRunning ? (
              <button
                onClick={startReplay}
                className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
              >
                <Play className="w-3.5 h-3.5" /> Start Replay
              </button>
            ) : (
              <>
                {!isPaused ? (
                  <button
                    onClick={pauseReplay}
                    className="flex-1 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Pause className="w-3.5 h-3.5" /> Pause
                  </button>
                ) : (
                  <button
                    onClick={resumeReplay}
                    className="flex-1 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                  >
                    <Play className="w-3.5 h-3.5" /> Resume
                  </button>
                )}
                <button
                  onClick={stopReplay}
                  className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <Square className="w-3.5 h-3.5" /> Stop
                </button>
              </>
            )}
          </div>
        </div>

        {/* Live Replay Terminal / Logs */}
        <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl p-5 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-sky-400" />
              <h3 className="text-sm font-semibold text-white">Live Transmission Audit Log</h3>
            </div>
            <button
              onClick={() => setLogs([])}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              Clear Logs
            </button>
          </div>

          <div className="flex-1 bg-slate-950 rounded-lg p-3 border border-slate-800/80 font-mono text-xs overflow-y-auto max-h-80 space-y-1">
            {logs.length === 0 ? (
              <span className="text-slate-600">Replay engine idle. Click 'Start Replay' to transmit vitals.</span>
            ) : (
              logs.map((log, index) => (
                <div
                  key={index}
                  className={log.includes('ERROR') ? 'text-rose-400' : 'text-slate-300'}
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
