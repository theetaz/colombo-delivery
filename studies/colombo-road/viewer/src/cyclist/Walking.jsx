import React,{useEffect,useRef,useState} from 'react';
import {ArrowLeft,Footprints,Pause,Play} from 'lucide-react';
import '@fontsource/dm-sans/400.css';import '@fontsource/dm-sans/500.css';import '@fontsource/dm-sans/600.css';import '@fontsource/dm-sans/700.css';
import '../style.css';import './walking.css';
import {createWalkingStudy} from './walking-runtime.js';

export default function Walking(){
  const host=useRef(),engine=useRef();
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[playing,setPlaying]=useState(true),[before,setBefore]=useState(false),[slow,setSlow]=useState(false),[view,setView]=useState('Side'),[phase,setPhase]=useState(0);
  useEffect(()=>{let alive=true;engine.current=createWalkingStudy(host.current,()=>alive&&setReady(true),p=>alive&&setPhase(p),e=>alive&&setError(e.message));return()=>{alive=false;engine.current.dispose();};},[]);
  function pause(value){setPlaying(!value);engine.current.pause(value);}
  function pose(value){pause(true);engine.current.seek(Number(value)/100);setPhase(Number(value)/100);}
  return <div className="walk-shell"><header className="walk-header"><div className="brand"><Footprints size={24}/><h1>Colombo <span>/ Walking study</span></h1></div><a className="button" href="/movement.html"><ArrowLeft size={16}/>Courtyard</a></header>
    <main className="walk-stage"><div className="canvas-host" ref={host}/><div className="walk-caption"><span>WALKING · 03</span><h2>{before?'Previous walk':'Upright walk'}</h2><p>{before?'Compare the bent stance and fixed-height wrists.':'Straight support leg. Relaxed arms. Heel-to-toe steps.'}</p></div>
      <div className="walk-views" role="group" aria-label="Camera angle">{['Side','Front','Three-quarter'].map(name=><button className="button" key={name} aria-pressed={view===name} disabled={!ready} onClick={()=>{setView(name);engine.current.view(name);}}>{name}</button>)}</div>
      {(!ready||error)&&<div className="loading-cover"><div className="loading-card"><h2>{error?'Could not load walking study':'Loading walking study'}</h2><p>{error||'Preparing the character…'}</p></div></div>}
    </main>
    <section className="walk-controls" aria-label="Walking playback"><div className="walk-toolbar"><button className="button primary" disabled={!ready} onClick={()=>pause(playing)}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pause':'Play'}</button><button className="button" disabled={!ready} aria-pressed={slow} onClick={()=>{setSlow(!slow);engine.current.slow(!slow);}}>Slow motion</button><button className="button" disabled={!ready} aria-pressed={before} onClick={()=>{setBefore(!before);engine.current.before(!before);}}>{before?'Show updated walk':'Compare previous walk'}</button><span className="walk-cadence">4.9 km/h · {before?'162':'123'} steps/min</span></div>
      <label className="walk-timeline">Step cycle <input type="range" min="0" max="100" step="1" value={Math.round(phase*100)} aria-label="Step cycle" disabled={!ready} onChange={e=>pose(e.target.value)}/><output>{Math.round(phase*100)}%</output></label>
      <div className="walk-phases">{[['Heel contact',0],['Weight acceptance',10],['Straight support',30],['Toe push-off',54],['Leg swing',75]].map(([name,p])=><button key={name} disabled={!ready} onClick={()=>pose(p)}>{name}</button>)}</div>
      <p className="walk-help">Drag to orbit · Scroll to zoom · Pause and switch versions to compare the same step.</p>
    </section></div>;
}
