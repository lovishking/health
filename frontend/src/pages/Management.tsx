import {useEffect,useState} from 'react';
import {Link} from 'react-router-dom';
import {api} from '../api/client';
import {assign,doctors,useProfiles} from '../profiles';
import type {Patient} from '../types';

export function Management(){
  const {assignments}=useProfiles();
  const [patients,setPatients]=useState<Patient[]>([]);
  const [filter,setFilter]=useState('*');
  const [status,setStatus]=useState('Loading patients...');
  useEffect(()=>{api.getPatients().then(rows=>{setPatients(rows);setStatus('');}).catch(()=>setStatus('Could not load patients.'));},[]);
  const rows=patients.filter(p=>filter==='*'||(assignments[p.id]||'')===filter);
  return <section className="overview"><header className="page-heading"><h1>Doctor &amp; Patient Management</h1></header>
    <div className="doctor-grid">{doctors.map(d=><button key={d.id} aria-pressed={filter===d.id} onClick={()=>setFilter(d.id)}><b>{d.avatar}</b><strong>{d.name}</strong><small>{d.id==='super'?'Supervisor':'Attending doctor'} · {patients.filter(p=>assignments[p.id]===d.id).length} assigned</small></button>)}</div>
    <div className="tier-tabs">{[['*','All patients'],['','Unassigned']].map(([id,label])=><button key={id} aria-pressed={filter===id} onClick={()=>setFilter(id)}>{label}</button>)}</div>
    <div className="directory">{rows.map(p=><div className="assignment-row" key={p.id}><Link to={'/monitor?patient='+encodeURIComponent(p.display_id)}><strong>{p.display_name || p.display_id}</strong><small>{p.display_id} · {p.latest_tier}</small></Link><select aria-label={'Assigned doctor for '+p.display_id} value={assignments[p.id]||''} onChange={e=>assign(p.id,e.target.value)}><option value="">Unassigned</option>{doctors.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>)}{!rows.length&&<p className="p-5">{status || 'No patients in this group.'}</p>}</div></section>;
}
