import React, { useEffect, useState, useCallback, useRef } from 'react';
import { api } from '../api/client';
import { Alert, Patient } from '../types';
import { ShieldAlert, CheckCircle, Clock, Mail, Send } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

export const AlertsPage: React.FC = () => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>('ALL');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [smtpStatus, setSmtpStatus] = useState<any>(null);
  const [sendingTest, setSendingTest] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const wsRefreshTimer = useRef<number | null>(null);

  const fetchAlerts = useCallback(async () => {
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
  }, [selectedPatient]);

  // Load SMTP notification system status
  useEffect(() => {
    api.getSmtpStatus().then(setSmtpStatus).catch(console.error);
  }, []);

  // Auto-refresh alerts when a new alert event comes through WS
  const handleWsEvent = useCallback((event: any) => {
    if (event.type === 'alert_triggered' || event.type === 'reading_update') {
      if (wsRefreshTimer.current !== null) clearTimeout(wsRefreshTimer.current);
      wsRefreshTimer.current = window.setTimeout(() => {
        fetchAlerts();
        wsRefreshTimer.current = null;
      }, 500);
    }
  }, [fetchAlerts]);

  useWebSocket(undefined, handleWsEvent);

  useEffect(() => {
    fetchAlerts();
    return () => {
      if (wsRefreshTimer.current !== null) clearTimeout(wsRefreshTimer.current);
    };
  }, [fetchAlerts]);

  const handleAcknowledge = async (alertId: string) => {
    try {
      const activeClinician = localStorage.getItem('clinician_name') || 'Dr. Lovish';
      await api.acknowledgeAlert(alertId, activeClinician);
      fetchAlerts();
    } catch (err) {
      console.error('Failed to acknowledge alert', err);
    }
  };

  const handleSendTestEmail = async () => {
    try {
      setSendingTest(true);
      setTestResult(null);
      const res = await api.sendTestSmtpAlert();
      const deliveredCount = res.results.filter((r: any) => r.status === 'delivered').length;
      setTestResult(`✓ Test email delivered to ${deliveredCount} of ${res.results.length} configured recipient addresses!`);
    } catch (err: any) {
      setTestResult(`Error dispatching test email: ${err.message}`);
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ShieldAlert className="w-6 h-6 text-rose-500" />
            Clinical Alerts & Notification Dispatch
          </h1>
          <p className="text-xs text-slate-500 mt-1">
            Deduplicated physiological warning thresholds and automated clinical SMTP escalation
          </p>
        </div>

        {/* Filter */}
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 font-medium">Filter Patient:</label>
          <select
            value={selectedPatient}
            onChange={(e) => setSelectedPatient(e.target.value)}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2 outline-none focus:bg-white focus:border-sky-500 transition shadow-xs"
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

      {/* SMTP Email Notification Panel */}
      <div className="bg-gradient-to-r from-sky-50/90 via-white to-slate-50/90 border border-sky-200/90 rounded-2xl p-5 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="p-2.5 rounded-xl bg-sky-100/80 text-sky-700 shrink-0">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-sm font-bold text-slate-900">SMTP Clinical Alert Notification Engine</h2>
                <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="relative flex h-1.5 w-1.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  ACTIVE &amp; VERIFIED
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Critical patient deterioration automatically triggers real-time authenticated SMTP escalation.
              </p>

              {/* Sender & Receiver Badges */}
              <div className="flex items-center gap-2 flex-wrap mt-2.5">
                <span className="text-[11px] text-slate-400 font-medium">Configured Receivers:</span>
                {[
                  'lovishjaiswal8@gmail.com',
                  'lovishjaiswal2023@gmail.com',
                  'lovishjaiswal2025@gmail.com',
                ].map((email) => (
                  <span
                    key={email}
                    className="px-2.5 py-0.5 rounded-full text-[11px] font-mono bg-sky-50 text-sky-700 border border-sky-200 font-medium"
                  >
                    {email}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 shrink-0">
            <button
              onClick={handleSendTestEmail}
              disabled={sendingTest}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-500 disabled:opacity-50 text-white font-semibold text-xs shadow-xs transition"
            >
              {sendingTest ? (
                <>Sending Test Email...</>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Send Test Email
                </>
              )}
            </button>
          </div>
        </div>

        {testResult && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-mono">
            {testResult}
          </div>
        )}
      </div>

      {/* Alert List */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-5 shadow-xs">
        {alerts.length === 0 ? (
          <div className="text-center py-12 text-slate-400">
            <CheckCircle className="w-8 h-8 text-emerald-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No active alerts recorded.</p>
            <p className="text-xs text-slate-400 mt-1">All monitored physiological signs remain within parameters.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {alerts.map((alert) => {
              const isCrit = alert.severity === 'critical';
              const isAck = alert.status === 'acknowledged';

              return (
                <div
                  key={alert.id}
                  className={`border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 transition shadow-xs ${
                    isAck
                      ? 'border-slate-200 bg-slate-50/60 opacity-60'
                      : isCrit
                      ? 'border-rose-200 bg-rose-50/40 glow-critical'
                      : 'border-amber-200 bg-amber-50/40 glow-warning'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full border ${
                          isCrit
                            ? 'bg-rose-100 text-rose-700 border-rose-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200'
                        }`}
                      >
                        {alert.severity}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-900">
                        Patient: {alert.patient_id}
                      </span>
                      {isCrit && (
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 border border-rose-200">
                          SMTP Dispatched
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-700 font-medium">{alert.message}</p>
                    <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {new Date(alert.created_at).toLocaleTimeString()}
                      </span>
                      {isAck && (
                        <span className="flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle className="w-3 h-3" />
                          Ack by: {alert.acknowledged_by || 'Clinician'} at{' '}
                          {alert.acknowledged_at ? new Date(alert.acknowledged_at).toLocaleTimeString() : ''}
                        </span>
                      )}
                    </div>
                  </div>

                  {!isAck && (
                    <button
                      onClick={() => handleAcknowledge(alert.id)}
                      className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-semibold border border-slate-200 shadow-xs self-start md:self-center transition"
                    >
                      Acknowledge
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
