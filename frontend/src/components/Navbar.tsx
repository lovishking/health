import {doctors,selectDoctor,useProfiles,currentDoctor} from '../profiles';
import React, { useState, useEffect } from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Moon, Sun, ChevronDown } from 'lucide-react';
import { Activity, ShieldAlert, Users, LineChart, PlayCircle, HelpCircle, UserCheck, X, BellRing, Phone, Mail, Stethoscope } from 'lucide-react';
import { api } from '../api/client';
import { sendBrowserNotification } from '../utils/audio';

interface NavbarProps {
  wsConnected: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({ wsConnected }) => {
  const [night, setNight] = useState(document.documentElement.dataset.theme === 'night');
  function toggleTheme() {
    const theme = night ? 'light' : 'night';
    document.documentElement.dataset.theme = theme;
    setNight(!night);
    try { localStorage.setItem('rthdss-theme', theme); } catch {}
  }
  const [showProfileModal, setShowProfileModal] = useState(false);
  const {active}=useProfiles();
  const doctor=currentDoctor();
  return (
    <>
      <header className="workspace-header sticky top-0 z-50">
        <div className="max-w-[1820px] w-full mx-auto px-4 sm:px-6 lg:px-8 2xl:px-10">
          <div className="workspace-toolbar">
            {/* Logo & Title */}
            <div className="flex items-center gap-3">
              <div className="brand-mark">
                <Activity className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-lg tracking-tight text-slate-900">RT-HDSS</span>
                  
                </div>
                <p className="text-xs text-slate-500 hidden sm:block">Clinical workspace</p>
              </div>
            </div>

            {/* Navigation Links */}
            <nav aria-label="Workspace" className="workspace-nav">
              {([
                ['/', 'Home', Home], ['/overview', 'Overview', Users], ['/monitor', 'Monitoring', LineChart],
                ['/risk', 'Risk', HelpCircle], ['/alerts', 'Alerts', ShieldAlert],
                ['/simulator', 'Replay', PlayCircle],
              ] as const).map(([to, label, Icon]) => (
                <NavLink key={to} to={to} end><Icon size={16}/>{label}</NavLink>
              ))}
            {active==='super' && <NavLink to="/management"><Stethoscope size={16}/>Doctor &amp; Patient Management</NavLink>}</nav>

            {/* Right Side: Active Clinician Profile & WS Pill */}
            <div className="flex items-center gap-2.5">
              <button className="icon-control" onClick={toggleTheme} aria-label="Blue-black theme" aria-pressed={night} title={night ? 'Switch to light mode' : 'Switch to blue-black mode'}>
                {night ? <Sun size={17}/> : <Moon size={17}/>}
              </button>
              {/* Login / Clinician Button */}
              <button
                aria-haspopup="dialog" aria-expanded={showProfileModal} onClick={() => setShowProfileModal(true)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200/70 text-slate-700 hover:text-slate-900 text-xs font-medium border border-slate-200/80 transition"
              >
                <UserCheck className="w-3.5 h-3.5 text-sky-600" />
                <span className="truncate max-w-[140px]">
                  {doctor.name}
                </span>
              </button>

              {/* Connection Status Pill */}
              <div role="status" className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border ${
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
          <div role="dialog" aria-label="Select profile" className="animate-bounce-once bg-white border border-slate-200 rounded-3xl max-w-md w-full p-6 shadow-2xl relative max-h-[90vh] overflow-y-auto">
            <button
              aria-label="Close profile selector" onClick={() => setShowProfileModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-slate-700 transition"
            >
              <X className="w-5 h-5" />
            </button>

            <h2 className="text-xl font-semibold">Select profile</h2>
            <div className="doctor-grid selector">{doctors.map(d=><button key={d.id} aria-pressed={active===d.id} onClick={()=>{setShowProfileModal(false);selectDoctor(d.id);}}><b>{d.avatar}</b><strong>{d.name}</strong><small>{d.id==='super'?'Supervisor':'Attending doctor'}</small></button>)}</div>
          </div></div>)}
    </>
  );
};
