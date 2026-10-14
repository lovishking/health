import React, { useEffect, useState } from 'react';
import { api } from '../api/client';
import { Alert, Patient } from '../types';
import { ShieldAlert, CheckCircle, Clock, Bell, User, MessageSquare } from 'lucide-react';

export const AlertsPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('ALL');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const patientsList = await api.getPatients();
      setPatients(patientsList);

      let allAlerts: Alert[] = [];
      if (selectedPatient === 'ALL') {
        const results = await Promise.all(patientsList.map((p) => api.getAlerts(p.display_id)));
        allAlerts = results.flat();
      } else {
        allAlerts = await api.getAlerts(selectedPatient);
      }
      allAlerts.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      setAlerts(allAlerts);
    } catch (err) {
      console.error('Failed to load alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
  }, [selectedPatient]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const activeClinician = localStorage.getItem('clinician_name') || 'Dr. Lovish';
      await api.acknowledgeAlert(alertId, activeClinician);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-400" />
            Clinical Alerts & Notification Dispatch
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Deduplicated physiological warning thresholds and emergency dispatch logs
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Filter Patient:</label>
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="bg-slate-950 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-2 outline-none focus:ring-1 focus:ring-sky-500"
          >
            <option value="ALL">All Patients</option>
            {patients.map((p) => (
              <option key={p.id} value={p.display_id}>
                {p.display_id}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Alert List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5">
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-medium">No active alerts recorded.</p>
            <p className="text-xs text-slate-500 mt-1">All monitored physiological signs remain within parameters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const isCrit = alert.severity === 'critical';
              const isAck = alert.status === 'acknowledged';

              return (
                <div
                  key={alert.id}
                  className={`border rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition ${
                    isAck
                      ? 'border-slate-800 bg-slate-950/40 opacity-70'
                      : isCrit
                      ? 'border-red-500/50 bg-red-950/20 glow-critical'
                      : 'border-amber-500/50 bg-amber-950/20'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                          isCrit
                            ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="font-mono text-xs font-semibold text-slate-300">
                        Patient: {alert.patient_id}
                      </span>
                      <span className="text-slate-500 text-[11px] flex items-center gap-1 font-mono">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-200 font-medium">{alert.message}</p>

                    {isAck && (
                      <p className="text-[11px] text-emerald-400 flex items-center gap-1 font-sans">
                        <CheckCircle className="w-3 h-3" /> Acknowledged by {alert.acknowledged_by || 'Clinician'} at{' '}
                        {alert.acknowledged_at ? new Date(alert.acknowledged_at).toLocaleTimeString() : ''}
                      </p>
                    )}
                  </div>

                  {/* Actions & Dispatch Status */}
                  <div className="flex items-center gap-3">
                    <div className="text-right hidden sm:block">
                      <span className="text-[10px] text-slate-400 block">Notification Delivery</span>
                      <span className="text-xs text-sky-400 font-mono">Mock SMS / WS</span>
                    </div>

                    {!isAck ? (
                      <button
                        onClick={() => handleAcknowledge(alert.id)}
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-medium transition flex items-center gap-1.5"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-xs text-slate-400 font-mono px-3 py-1 rounded bg-slate-800">
                        Acknowledged
                      </span>
                    )}
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
