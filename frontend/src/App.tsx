import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Link } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { OverviewPage } from './pages/OverviewPage';
import { PatientDetailPage } from './pages/PatientDetailPage';
import { RiskExplanationPage } from './pages/RiskExplanationPage';
import { AlertsPage } from './pages/AlertsPage';
import { SimulatorPage } from './pages/SimulatorPage';
import { useWebSocket } from './hooks/useWebSocket';
import { api } from './api/client';
import { playAlertSound, requestBrowserNotificationPermission, sendBrowserNotification } from './utils/audio';
import { AlertTriangle, Bell, X, ShieldAlert, ArrowRight } from 'lucide-react';

interface ToastAlert {
  id: string;
  patient_id: string;
  severity: string;
  message: string;
  time: string;
}

export const App: React.FC = () => {
  const [activeToast, setActiveToast] = useState<ToastAlert | null>(null);
  const [notificationsEnabled, setNotificationsEnabled] = useState(false);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'granted') {
      setNotificationsEnabled(true);
    }
  }, []);

  const handleEnableNotifications = () => {
    requestBrowserNotificationPermission();
    if ('Notification' in window) {
      Notification.requestPermission().then((perm) => {
        if (perm === 'granted') {
          setNotificationsEnabled(true);
          sendBrowserNotification('Notifications Active', 'You will receive real-time clinical alerts.');
        }
      });
    }
  };

  const handleGlobalWebSocketEvent = (event: any) => {
    if (event.type === 'alert_triggered' || (event.type === 'reading_update' && event.data?.alert_created)) {
      const isCritical = event.data?.risk_tier === 'Critical' || event.data?.severity === 'critical';
      const patientId = event.patient_id || event.data?.patient_id || 'DEMO-001';
      const message =
        event.data?.message ||
        `Critical physiological deterioration detected for ${patientId} (Risk Tier: ${event.data?.risk_tier || 'Critical'})`;

      // Play audio chime
      playAlertSound(isCritical);

      // Send desktop notification
      sendBrowserNotification(`Clinical Alert: ${patientId}`, message);

      // Show toast
      setActiveToast({
        id: event.data?.id || String(Date.now()),
        patient_id: patientId,
        severity: isCritical ? 'critical' : 'warning',
        message: message,
        time: new Date().toLocaleTimeString(),
      });
    }
  };

  const { isConnected } = useWebSocket(undefined, handleGlobalWebSocketEvent);

  return (
    <BrowserRouter>
      <div className="min-h-screen bg-slate-950 flex flex-col font-sans selection:bg-sky-500 selection:text-white relative">
        <Navbar wsConnected={isConnected} />

        {/* Live Floating Alert Toast Banner */}
        {activeToast && (
          <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-md w-full bg-slate-900 border border-red-500/60 rounded-xl p-4 shadow-2xl glow-critical animate-bounce-once">
            <div className="flex items-start justify-between gap-3">
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400 mt-0.5">
                <AlertTriangle className="w-5 h-5 animate-pulse" />
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                    REAL-TIME {activeToast.severity} ALERT
                  </span>
                  <span className="text-xs font-mono font-bold text-white">{activeToast.patient_id}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{activeToast.time}</span>
                </div>
                <p className="text-xs text-slate-200 font-medium leading-relaxed">{activeToast.message}</p>
                <div className="pt-2 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Link
                      to={`/monitor?patient=${activeToast.patient_id}`}
                      onClick={() => setActiveToast(null)}
                      className="text-xs text-sky-400 hover:text-sky-300 font-semibold inline-flex items-center gap-1"
                    >
                      View Telemetry <ArrowRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                  <button
                    onClick={async () => {
                      if (activeToast.id) {
                        try {
                          const activeClinician = localStorage.getItem('clinician_name') || 'Dr. Lovish';
                          await api.acknowledgeAlert(activeToast.id, activeClinician);
                        } catch {}
                      }
                      setActiveToast(null);
                    }}
                    className="px-2.5 py-1 rounded bg-sky-600 hover:bg-sky-500 text-white font-medium text-xs transition"
                  >
                    Acknowledge
                  </button>
                </div>
              </div>
              <button
                onClick={() => setActiveToast(null)}
                className="text-slate-400 hover:text-slate-200 p-1 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Notification Permission Prompt if not granted */}
        {!notificationsEnabled && (
          <div className="bg-sky-950/60 border-b border-sky-900/60 py-2 px-4 text-center text-xs text-sky-200 flex items-center justify-center gap-2">
            <Bell className="w-4 h-4 text-sky-400" />
            <span>Enable browser audio and desktop alerts to receive instant clinical notifications:</span>
            <button
              onClick={handleEnableNotifications}
              className="px-2.5 py-0.5 rounded bg-sky-500 text-white font-semibold text-xs hover:bg-sky-400 transition"
            >
              Enable Alerts
            </button>
          </div>
        )}

        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Routes>
            <Route path="/" element={<OverviewPage />} />
            <Route path="/monitor" element={<PatientDetailPage />} />
            <Route path="/risk" element={<RiskExplanationPage />} />
            <Route path="/alerts" element={<AlertsPage />} />
            <Route path="/simulator" element={<SimulatorPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>

        <footer className="border-t border-slate-900 bg-slate-950 py-4 text-center text-xs text-slate-500">
          RT-HDSS Academic Research Prototype • Clinical Decision Support • Not for Autonomous Medical Diagnosis
        </footer>
      </div>
    </BrowserRouter>
  );
};

export default App;
