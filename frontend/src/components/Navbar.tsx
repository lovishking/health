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
  const [clinicianRole, setClinicianRole] = useState(() => localStorage.getItem('clinician_role') || 'user');
  const [password, setPassword] = useState('');
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authToken, setAuthToken] = useState(() => localStorage.getItem('auth_token') || '');
  const [smtpHost, setSmtpHost] = useState(() => localStorage.getItem('smtp_host') || 'smtp.gmail.com');
  const [smtpPort, setSmtpPort] = useState(() => localStorage.getItem('smtp_port') || '587');
  const [smtpUsername, setSmtpUsername] = useState(() => localStorage.getItem('smtp_username') || '');
  const [smtpPassword, setSmtpPassword] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState(() => localStorage.getItem('smtp_from_email') || '');
  const [smtpFromName, setSmtpFromName] = useState(() => localStorage.getItem('smtp_from_name') || 'RT-HDSS Clinical Alerts');
  const [smtpUseTls, setSmtpUseTls] = useState(() => localStorage.getItem('smtp_use_tls') !== 'false');
  const [smtpEnabled, setSmtpEnabled] = useState(() => localStorage.getItem('smtp_enabled') === 'true');
  const [profileError, setProfileError] = useState('');
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!authToken) return;
    api.getMe().then((user) => {
      setClinicianName(user.display_name || user.email);
      setClinicianEmail(user.email);
      setClinicianPhone(user.phone_number || '');
      setClinicianRole(user.role);
      setSmtpEnabled(user.smtp_enabled);
      setSmtpHost(user.smtp_host || 'smtp.gmail.com');
      setSmtpPort(user.smtp_port || '587');
      setSmtpUsername(user.smtp_username || '');
      setSmtpFromEmail(user.smtp_from_email || user.email);
      setSmtpFromName(user.smtp_from_name || 'RT-HDSS Clinical Alerts');
      setSmtpUseTls(user.smtp_use_tls);
    }).catch(() => {
      localStorage.removeItem('auth_token');
      setAuthToken('');
    });
  }, [authToken]);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileError('');
    try {
      if (!authToken) {
        if (!password) {
          setProfileError('Enter your account password.');
          return;
        }
        if (authMode === 'register') {
          await api.createUser({
            email: clinicianEmail,
            display_name: clinicianName,
            phone_number: clinicianPhone,
            role: clinicianRole,
            password,
          });
        }
        const token = await api.loginUser({ email: clinicianEmail, password });
        setAuthToken(token);
      }

      if (smtpEnabled) {
        if (!smtpHost || !smtpPort || !smtpFromEmail || !smtpPassword) {
          setProfileError('SMTP host, port, from email, and password are required for email notifications.');
          return;
        }
        await api.updateMySmtpSettings({
          smtp_host: smtpHost,
          smtp_port: Number(smtpPort),
          smtp_username: smtpUsername || smtpFromEmail,
          smtp_password: smtpPassword,
          smtp_from_email: smtpFromEmail,
          smtp_from_name: smtpFromName,
          smtp_use_tls: smtpUseTls,
          smtp_enabled: true,
        });
      }

      localStorage.setItem('clinician_name', clinicianName);
      localStorage.setItem('clinician_email', clinicianEmail);
      localStorage.setItem('clinician_phone', clinicianPhone);
      localStorage.setItem('clinician_role', clinicianRole);
      localStorage.setItem('smtp_host', smtpHost);
      localStorage.setItem('smtp_port', smtpPort);
      localStorage.setItem('smtp_username', smtpUsername);
      localStorage.setItem('smtp_from_email', smtpFromEmail);
      localStorage.setItem('smtp_from_name', smtpFromName);
      localStorage.setItem('smtp_use_tls', String(smtpUseTls));
      localStorage.setItem('smtp_enabled', String(smtpEnabled));

      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        setShowProfileModal(false);
      }, 1200);
    } catch (err) {
      console.error('Failed to save profile', err);
      setProfileError('Could not save profile. Check your login details and SMTP settings.');
    }
  };

  const handleTestAlert = () => {
    playAlertSound(true);
    sendBrowserNotification(`Alert for ${clinicianName}`, `[CRITICAL] Test alert delivered to ${clinicianName} (${clinicianPhone})`);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setAuthToken('');
    setPassword('');
    setAuthMode('login');
    setShowProfileModal(false);
  };

  return (
    <>
      <header className="border-b border-slate-200/80 bg-white/90 backdrop-blur sticky top-0 z-50 shadow-xs">
        <div className="max-w-[1820px] w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600 shadow-xs">
                <Activity className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-slate-900">RT-HDSS</span>
                  <span className="text-[10px] uppercase font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    Research Prototype
                  </span>
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">Real-Time Healthcare Decision Support</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav className="flex items-center gap-1 sm:gap-2">
              <NavLink
                to="/"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-200 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`
                }
              >
                <Users className="w-4 h-4" />
                <span>Overview</span>
              </NavLink>

              <NavLink
                to="/monitor"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-200 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`
                }
              >
                <LineChart className="w-4 h-4" />
                <span>Monitoring</span>
              </NavLink>

              <NavLink
                to="/risk"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-200 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`
                }
              >
                <HelpCircle className="w-4 h-4" />
                <span>Risk & SHAP</span>
              </NavLink>

              <NavLink
                to="/alerts"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-sky-50 text-sky-700 border border-sky-200 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`
                }
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Alerts</span>
              </NavLink>

              <NavLink
                to="/simulator"
                className={({ isActive }) =>
                  `flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-medium transition ${
                    isActive
                      ? 'bg-purple-50 text-purple-700 border border-purple-200 font-semibold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80'
                  }`
                }
              >
                <PlayCircle className="w-4 h-4" />
                <span>Replay</span>
              </NavLink>
            </nav>

            {/* Right Side: Active Clinician Profile & WS Pill */}
            <div className="flex items-center gap-2.5">
              {/* Login / Clinician Button */}
              <button
                onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 hover:text-slate-900 text-xs font-medium border border-slate-200/80 transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                <span className="truncate max-w-[140px]">
                  {authToken ? `${clinicianName} (${clinicianRole})` : 'Login / Sign Up'}
                </span>
              </button>

              {/* Connection Status Pill */}
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
                wsConnected
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-rose-50 text-rose-700 border-rose-200'
              }`}>
                <span
                  className={`w-2 h-2 rounded-full ${
                    wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'
                  }`}
                />
                <span>{wsConnected ? 'Live' : 'Offline'}</span>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Modal: Clinician User Profile & Real-Time Notification Settings */}
      {showProfileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowProfileModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center gap-3 mb-5">
              <div className="p-2.5 rounded-2xl bg-sky-50 text-sky-600 border border-sky-200">
                <Stethoscope className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Clinician Profile</h3>
                <p className="text-xs text-slate-500">Configure your credentials to receive live ICU telemetry alerts</p>
              </div>
            </div>

            {authToken && (
              <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2.5">
                <div>
                  <p className="text-xs font-semibold text-slate-900">{clinicianEmail}</p>
                  <p className="text-[11px] text-slate-500">Signed in as {clinicianRole}</p>
                </div>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="px-3 py-1 rounded-lg bg-white hover:bg-slate-100 text-xs font-medium text-slate-700 border border-slate-200 shadow-xs transition"
                >
                  Logout
                </button>
              </div>
            )}

            <form onSubmit={handleSaveProfile} className="space-y-3.5">
              {!authToken && (
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => setAuthMode('login')}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                      authMode === 'login'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Login
                  </button>
                  <button
                    type="button"
                    onClick={() => setAuthMode('register')}
                    className={`py-1.5 rounded-lg text-xs font-semibold transition ${
                      authMode === 'register'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Register
                  </button>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-700 font-medium block mb-1">Clinician Name / Title</label>
                <input
                  type="text"
                  required
                  value={clinicianName}
                  onChange={(e) => setClinicianName(e.target.value)}
                  placeholder="e.g. Dr. Lovish"
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-sky-500 transition"
                />
              </div>

              <div>
                <label className="text-xs text-slate-700 font-medium block mb-1">Work Email</label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={clinicianEmail}
                    onChange={(e) => setClinicianEmail(e.target.value)}
                    placeholder="lovish@hospital.org"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-sky-500 transition"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              {!authToken && (
                <div>
                  <label className="text-xs text-slate-700 font-medium block mb-1">Password</label>
                  <input
                    type="password"
                    required
                    minLength={8}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-sky-500 transition"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-slate-700 font-medium block mb-1">Mobile Phone (Emergency SMS)</label>
                <div className="relative">
                  <input
                    type="tel"
                    value={clinicianPhone}
                    onChange={(e) => setClinicianPhone(e.target.value)}
                    placeholder="+1 555-0199"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-sky-500 transition"
                  />
                  <Phone className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                </div>
              </div>

              <div>
                <label className="text-xs text-slate-700 font-medium block mb-1">Clinical Department / Role</label>
                <select
                  value={clinicianRole}
                  onChange={(e) => setClinicianRole(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2 text-xs text-slate-900 outline-none focus:bg-white focus:border-sky-500 transition"
                >
                  <option value="user">User</option>
                  <option value="admin">Admin</option>
                </select>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-3">
                <label className="flex items-center gap-2 text-xs text-slate-800 font-semibold cursor-pointer">
                  <input
                    type="checkbox"
                    checked={smtpEnabled}
                    onChange={(e) => setSmtpEnabled(e.target.checked)}
                    className="accent-sky-600 rounded"
                  />
                  Enable automated critical email notifications
                </label>

                {smtpEnabled && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    <input
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="SMTP host"
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500"
                    />
                    <input
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="Port"
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500"
                    />
                    <input
                      type="text"
                      value={smtpUsername}
                      onChange={(e) => setSmtpUsername(e.target.value)}
                      placeholder="SMTP username"
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500"
                    />
                    <input
                      type="password"
                      value={smtpPassword}
                      onChange={(e) => setSmtpPassword(e.target.value)}
                      placeholder="SMTP password"
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500"
                    />
                    <input
                      type="email"
                      value={smtpFromEmail}
                      onChange={(e) => setSmtpFromEmail(e.target.value)}
                      placeholder="From email"
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500"
                    />
                    <input
                      type="text"
                      value={smtpFromName}
                      onChange={(e) => setSmtpFromName(e.target.value)}
                      placeholder="From name"
                      className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-900 outline-none focus:border-sky-500"
                    />
                    <label className="sm:col-span-2 flex items-center gap-2 text-xs text-slate-600">
                      <input
                        type="checkbox"
                        checked={smtpUseTls}
                        onChange={(e) => setSmtpUseTls(e.target.checked)}
                        className="accent-sky-600 rounded"
                      />
                      Use TLS
                    </label>
                  </div>
                )}
              </div>

              {profileError && <p className="text-xs text-rose-600 font-medium">{profileError}</p>}

              <div className="pt-2 flex items-center justify-between gap-3">
                <button
                  type="button"
                  onClick={handleTestAlert}
                  className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200/80 text-xs text-sky-700 font-medium flex items-center gap-1.5 border border-slate-200 transition"
                >
                  <BellRing className="w-3.5 h-3.5" />
                  Test Sound
                </button>

                <button
                  type="submit"
                  className="flex-1 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-xs transition"
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
