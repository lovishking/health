import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Activity, ShieldAlert, Users, LineChart, PlayCircle, HelpCircle, UserCheck, X, BellRing, Phone, Mail, Stethoscope } from 'lucide-react';
import { api } from '../api/client';
import { playAlertSound, sendBrowserNotification } from '../utils/audio';

interface NavbarProps {
  wsConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ wsConnected }) => {
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [clinicianName, setClinicianName] = useState(() => localStorage.getItem('clinician_name') || 'Dr. Lovish');
  const [clinicianEmail, setClinicianEmail] = useState(() => localStorage.getItem('clinician_email') || 'lovish@hospital.org');
  const [clinicianPhone, setClinicianPhone] = useState(() => localStorage.getItem('clinician_phone') || '+1 555-0199');
  const [clinicianRole, setClinicianRole] = useState(() => localStorage.getItem('clinician_role') || 'Lead Intensivist');
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createUser({
        email: clinicianEmail,
        display_name: clinicianName,
        phone_number: clinicianPhone,
        role: clinicianRole,
      });
      localStorage.setItem('clinician_name', clinicianName);
      localStorage.setItem('clinician_email', clinicianEmail);
      localStorage.setItem('clinician_phone', clinicianPhone);
      localStorage.setItem('clinician_role', clinicianRole);

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setShowProfileModal(false);
      }, 1200);
    } catch (err) {
      console.error('Failed to save profile', err);
    }
  };

  const handleTestAlert = () => {
    playAlertSound(true);
    sendBrowserNotification(`Alert for ${clinicianName}`, `[CRITICAL] Test alert delivered to ${clinicianName} (${clinicianPhone})`);
  };

  return (
    <>
      <header className="border-b border-slate-800 bg-slate-900/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                <Activity className="w-6 h-6 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-white">RT-HDSS</span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded bg-sky-950 text-sky-400 border border-sky-800">
                    Research Prototype
                  </span>
                </div>
                <p className="text-xs text-slate-400 hidden sm:block">Real-Time Healthcare Decision Support</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <Users className="w-4 h-4" />
                <span>Overview</span>
              </NavLink>

              <NavLink
                to="/monitor"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <LineChart className="w-4 h-4" />
                <span>Monitoring</span>
              </NavLink>

              <NavLink
                to="/risk"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <HelpCircle className="w-4 h-4" />
                <span>Risk & SHAP</span>
              </NavLink>

              <NavLink
                to="/alerts"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-500/10 text-sky-400 border border-sky-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Alerts</span>
              </NavLink>

              <NavLink
                to="/simulator"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                  }`
                }
              >
                <PlayCircle className="w-4 h-4" />
                <span>Replay</span>
              </NavLink>
            </nav>

            {/* Right Side: Active Clinician Profile & WS Pill */}
            <div className="flex items-center gap-3">
              {/* Clinician Button */}
              <button
                onClick={() => setShowProfileModal(true)}
                className="hidden md:flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-xs border border-slate-700 transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-sky-400" />
                <span className="text-slate-200 font-medium truncate max-w-[120px]">{clinicianName}</span>
              </button>

              {/* Connection Status Pill */}
              <div className="flex items-center gap-2 border border-slate-800 px-2.5 py-1 rounded-full bg-slate-950/60">
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span className="text-[11px] font-medium text-slate-300">
                  {wsConnected ? 'Live' : 'Offline'}
                </span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modal: Clinician User Profile & Real-Time Notification Settings */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-2 mb-4">
              <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400 border border-sky-500/20">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Clinician Notification Profile</h3>
                <p className="text-xs text-slate-400">Configure your credentials to receive live ICU telemetry alerts</p>
              </div>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-3">
              <div>
                <label className="text-xs text-slate-300 block mb-1">Clinician Name / Title</label>
                <input
                  type="text"
                  required
                  value={clinicianName}
                  onChange={(e) => setClinicianName(e.target.value)}
                  placeholder="e.g. Dr. Lovish"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                />
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Work Email</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={clinicianEmail}
                    onChange={(e) => setClinicianEmail(e.target.value)}
                    placeholder="lovish@hospital.org"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                  />
                  <Mail className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Mobile Phone (for Emergency SMS Alerts)</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={clinicianPhone}
                    onChange={(e) => setClinicianPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg pl-8 pr-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                  />
                  <Phone className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-300 block mb-1">Clinical Department / Role</label>
                <select
                  value={clinicianRole}
                  onChange={(e) => setClinicianRole(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-sky-500"
                >
                  <option value="Lead Intensivist">Lead Intensivist (ICU)</option>
                  <option value="ICU Charge Nurse">ICU Charge Nurse</option>
                  <option value="Cardiologist">Cardiologist</option>
                  <option value="Clinical Fellow">Clinical Fellow</option>
                </select>
              </div>

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-sky-400 font-medium flex items-center gap-1.5 border border-slate-700 transition"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  Test Sound & Popup
                </button>

                <button
                  type="submit"
                  className="flex-1 px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold transition"
                >
                  {savedSuccess ? 'Saved to System!' : 'Save & Set Active'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
