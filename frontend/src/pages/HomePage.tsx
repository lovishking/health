import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, FileText, Radio, ShieldCheck, Bell, Layers, Database, Timer, ChevronRight } from 'lucide-react';
import './home.css';

const workflow = [
  { Icon: Radio, title: 'Capture the reading', body: 'Replay ICU observations or generate a synthetic stream. Each reading carries its source, patient identifier and observation time.', url: '/simulator', action: 'Explore replay' },
  { Icon: ShieldCheck, title: 'Understand the risk', body: 'Follow vital signs over time, inspect quality flags and see which safety rule raised a patient to Warning or Critical.', url: '/risk', action: 'Inspect risk assessment' },
  { Icon: Bell, title: 'Review the alert', body: 'Find the patient who needs attention, send a critical alert by email and record when a clinician acknowledges it.', url: '/alerts', action: 'View alerts' },
];

function Count({ value }: { value: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !window.IntersectionObserver || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let frame = 0;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      const start = performance.now();
      function tick(now: number) {
        const t = Math.min(1, (now - start) / 750);
        node!.textContent = Math.round(value * (1 - (1 - t) ** 3)).toLocaleString('en-US');
        if (t < 1) frame = requestAnimationFrame(tick);
      }
      frame = requestAnimationFrame(tick);
    });
    observer.observe(node);
    return () => { observer.disconnect(); cancelAnimationFrame(frame); };
  }, [value]);
  return <span ref={ref}>{value.toLocaleString('en-US')}</span>;
}

const diagrams = [
  ['Ingest', 'Validate', 'Window', 'Assess', 'Alert'],
  ['Snapshot · 50%', 'Sequence · 50%', 'Combined risk'],
  ['Training cohort', 'Validation cohort', 'Test cohort'],
];

export function HomePage() {
  const [topic, setTopic] = useState(0);
  const notes = [
    { tab: 'Architecture', title: 'Keep the history behind every alert', body: 'The design links ingestion, validation, patient-specific time windows and the monitoring dashboard. Raw observations and quality flags stay together so the clinician can trace a warning back to the reading that raised it.', detail: 'Ingestion API → validation → patient window → assessment → alert history' },
    { tab: 'Fusion model', title: 'A snapshot and a sequence', body: 'The poster proposes XGBoost for a single snapshot and an LSTM for the patient’s recent sequence. Their class probabilities would be combined before safety rules could escalate the tier. The proposed models still require training and validation.', detail: 'Proposed weighting before safety-rule escalation.' },
    { tab: 'Evaluation', title: 'Measure alert quality and timing', body: 'The evaluation plan separates patients across training, validation and test sets. It calls for per-class precision and recall, calibration, dashboard latency, duplicate alerts and time to acknowledgement.', detail: 'Research stage: evaluation planned · clinical performance unmeasured' },
  ];
  return <article className="project-home">
    <header className="project-hero">
      <div className="hero-copy"><div className="project-kicker"><Activity size={18}/> INNOVISTA 3.0 / 2026</div>
      <h1>Real-Time Healthcare<br/><em>Decision Support</em> System</h1>
      <p>A research prototype for early detection of patient deterioration. Follow a vital reading from the bedside monitor to the alert a clinician reviews.</p>
      <div className="project-actions"><Link to="/overview">Open dashboard <ArrowRight size={17}/></Link><a href="/project/rt-hdss-poster.pdf" target="_blank" rel="noreferrer"><FileText size={16}/> Project poster</a></div>
      </div><figure className="trace-console"><figcaption><Activity size={16}/> Bedside signals <small>Illustrative telemetry</small></figcaption><div className="trace-screen" aria-hidden="true"/><div className="signal-key" aria-label="Illustrative telemetry channels"><span>ECG</span><span>Pleth</span><span>Respiration</span></div>
      </figure>
    </header>
    <dl className="dataset-strip" aria-label="PhysioNet Challenge 2012 research dataset">
      <div><dt><Database size={15}/>Research dataset</dt><dd>PhysioNet <b>2012</b></dd></div>
      <div><dt><Activity size={15}/>ICU stays in cohort</dt><dd><Count value={12000}/></dd></div>
      <div><dt><Layers size={15}/>Recorded variables</dt><dd><small>Up to</small> <Count value={42}/></dd></div>
      <div><dt><Timer size={15}/>Observation window</dt><dd><Count value={48}/> <small>hours from admission</small></dd></div>
    </dl>
    <section className="project-section"><h2>From observation to action</h2>
      <div className="workflow">{workflow.map(({Icon,title,body,url,action}) => <section key={title}><Icon size={22}/><h3>{title}</h3><p>{body}</p><Link to={url}>{action} <ArrowRight size={14}/></Link></section>)}</div>
    </section>
    <section className="research-notes">
      <div><h2>Inside the research</h2><div role="tablist" className="note-options" aria-label="Research topic">{notes.map((note,i)=><button key={note.tab} role="tab" id={`topic-${i}`} aria-controls="research-panel" aria-selected={topic===i} tabIndex={topic===i?0:-1} onKeyDown={event=>{
        const keys:Record<string,number> = {ArrowRight:(i+1)%notes.length,ArrowDown:(i+1)%notes.length,ArrowLeft:(i+notes.length-1)%notes.length,ArrowUp:(i+notes.length-1)%notes.length,Home:0,End:notes.length-1};
        const next=keys[event.key];
        if(next===undefined) return;
        event.preventDefault();
        setTopic(next);
        document.getElementById(`topic-${next}`)?.focus();
      }} onClick={()=>setTopic(i)}>{note.tab}<ArrowRight size={15}/></button>)}</div></div>
      <div key={topic} className="research-copy" role="tabpanel" id="research-panel" aria-labelledby={`topic-${topic}`} tabIndex={0}><h3>{notes[topic].title}</h3><p>{notes[topic].body}</p><ol className={'diagram diagram-' + topic} aria-label={notes[topic].tab}>{diagrams[topic].map((label,i)=><li key={label} style={{animationDelay: i * 65 + 'ms'}}>{label}{topic===0 && i<4 && <ChevronRight size={13}/>}</li>)}</ol><small>{notes[topic].detail}</small></div>
    </section>
    <section className="project-section research"><a className="poster-cover" href="/project/rt-hdss-poster.pdf" target="_blank" rel="noreferrer"><img src="/project/exhibition.jpg" loading="lazy" width="552" height="780" alt="Open the full INNOVISTA project exhibition poster"/></a>
    <div><h2>Project &amp; team</h2><h3>Sir M. Visvesvaraya Institute of Technology</h3><p>Department of Information Science and Engineering</p><dl className="credits"><dt>Research team</dt><dd>Aditya Pratap Singh · Amit Kumar · Harsh Raj · Lovish Jaiswal</dd><dt>Project guide</dt><dd>Ms. Navya Sree R</dd></dl><a className="poster-link" href="/project/rt-hdss-poster.pdf" target="_blank" rel="noreferrer">View exhibition poster <ArrowRight size={15}/></a></div></section>
  </article>;
}
