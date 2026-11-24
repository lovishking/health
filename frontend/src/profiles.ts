import { useSyncExternalStore } from 'react';
import type { Patient } from './types';

export const doctors = [
  {id:'super', name:'Super Doctor', avatar:'SD'},
  {id:'d1', name:'Doctor 1', avatar:'D1'},
  {id:'d2', name:'Doctor 2', avatar:'D2'},
  {id:'d3', name:'Doctor 3', avatar:'D3'},
];
const key = 'clinical-profiles-v1';
type State = { active:string; assignments:Record<string,string> };
function read(): State {
  try {
    const saved = JSON.parse(localStorage.getItem(key) || '{}');
    if (doctors.some(d => d.id === saved.active) && saved.assignments)
      return saved;
  } catch {}
  return {active:'super', assignments:{}};
}
let state = read();
let patients: Patient[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());
function save(next:State) { localStorage.setItem(key, JSON.stringify(next)); state=next; notify(); }
window.addEventListener('storage', e => { if(e.key===key){ state=read(); notify(); } });
export const useProfiles = () => useSyncExternalStore(fn => { listeners.add(fn); return () => listeners.delete(fn); }, () => state);
export function selectDoctor(id:string) { if(doctors.some(d=>d.id===id)) save({...state,active:id}); }
export function assign(id:string, doctor:string) {
  if(state.active !== 'super' || (doctor && !doctors.some(d=>d.id===doctor))) return;
  save({...state, assignments:{...state.assignments,[id]:doctor}});
}
export function rememberPatients(list:Patient[]) {patients=list;return list.filter(p=>visible(p.id));}
export function visible(id:string) {
  if(state.active==='super') return true;
  const patient=patients.find(p=>p.id===id || p.display_id===id);
  return !!patient && state.assignments[patient.id]===state.active;
}
export const currentDoctor = () => doctors.find(d=>d.id===state.active)!;
