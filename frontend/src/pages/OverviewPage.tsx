import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { Patient } from '../types';
import { Users, AlertTriangle, ShieldCheck, HeartPulse, Activity, ArrowRight, RefreshCw, Search, Heart, Gauge } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket';

export const OverviewPage: React.FC<{ title?: string }> = ({ title = 'Patient overview' }) => {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<'all' | 'Critical' | 'Warning' | 'Stable'>('all');
  const wsRefreshTimerRef = useRef<number | null>(null);

  const fetchPatients = useCallback(async () => {
    try {
      setLoading(true);
      const data = await api.getPatients();
      setPatients(data);
    } catch (err) {
      console.error('Failed to load patients', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const debouncedRefresh = useCallback(() => {
    if (wsRefreshTimerRef.current !== null) {
      clearTimeout(wsRefreshTimerRef.current);
    }
    wsRefreshTimerRef.current = window.setTimeout(() => {
      fetchPatients();
      wsRefreshTimerRef.current = null;
    }, 400);
  }, [fetchPatients]);

  const handleWsEvent = useCallback((event: any) => {
    if (event.type === 'reading_update' || event.type === 'alert_triggered') {
      debouncedRefresh();
    }
  }, [debouncedRefresh]);

  const { isConnected } = useWebSocket(undefined, handleWsEvent);

  useEffect(() => {
    fetchPatients();
    const interval = setInterval(fetchPatients, 10000);
    return () => {
      clearInterval(interval);
      if (wsRefreshTimerRef.current !== null) {
        clearTimeout(wsRefreshTimerRef.current);
      }
    };
  }, [fetchPatients]);

  const criticalCount = patients.filter((p) => p.latest_tier === 'Critical').length;
  const warningCount = patients.filter((p) => p.latest_tier === 'Warning').length;
  const stableCount = patients.filter((p) => p.latest_tier === 'Stable').length;

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesSearch =
        p.display_id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.display_name && p.display_name.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesTier = tierFilter === 'all' || p.latest_tier === tierFilter;
      return matchesSearch && matchesTier;
    });
  }, [patients, searchQuery, tierFilter]);

  const tiers = ['all', 'Critical', 'Warning', 'Stable'] as const;
  return (
    <section className="overview">
      <header className="page-heading">
        <div><h1>{title}</h1><p>{isConnected ? 'Connected to live telemetry' : 'Waiting for live connection'}</p></div>
        <div className="flex items-center gap-2">
          <button className="icon-control" title="Refresh patients" aria-label="Refresh patients" onClick={fetchPatients}><RefreshCw size={16} className={loading ? 'animate-spin' : ''}/></button>
          <Link className="primary-control" to="/simulator">Open simulator <ArrowRight size={15}/></Link>
        </div>
      </header>
      <dl className="cohort-counts">{[
        ['Monitored beds', patients.length, 'total'], ['Critical', criticalCount, 'critical'],
        ['Warning', warningCount, 'warning'], ['Stable', stableCount, 'stable'],
      ].map(([label, count, tone]) => <div key={label}><dt><i className={'status-dot ' + tone}/>{label}</dt><dd>{count}</dd></div>)}</dl>
      <section aria-label="Patient directory">
        <div className="directory-tools">
          <div className="tier-tabs" aria-label="Filter by risk">{tiers.map(tier =>
            <button key={tier} aria-pressed={tierFilter === tier} onClick={() => setTierFilter(tier)}>{tier === 'all' ? 'All patients' : tier}</button>)}</div>
          <label className="directory-search"><Search size={16}/><input type="search" aria-label="Search patients" placeholder="Search patients or beds" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}/></label>
        </div>
        <div className="directory">
          <div className="directory-row directory-labels"><span>Patient / bed</span><span>Risk</span><span>Active alerts</span><span>Last observation</span><span/></div>
          {filteredPatients.map(p => <Link key={p.id} to={'/monitor?patient=' + encodeURIComponent(p.display_id)} className="directory-row patient-row">
            <div><strong>{p.display_name || p.display_id}</strong><small>{p.display_id}</small></div>
            <span className={'risk-label ' + (p.latest_tier || 'unknown').toLowerCase()}>{p.latest_tier || 'Pending'}</span>
            <span className="alert-count">{p.active_alerts_count}<span className="mobile-label"> active alerts</span></span>
            <time>{p.latest_reading_time ? new Date(p.latest_reading_time).toLocaleTimeString() : 'Awaiting reading'}</time>
            <ArrowRight size={16} aria-label="Open monitor"/>
          </Link>)}
          {!filteredPatients.length && <p className="py-8 text-center text-sm text-slate-600">{loading ? 'Loading patients...' : 'No patients match this view.'}</p>}
        </div>
      </section>
    </section>
  );
};
