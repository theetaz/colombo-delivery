import React,{useEffect,useRef,useState} from 'react';
import {Bike,ArrowLeft,Play,Pause,RotateCcw,Download} from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import '@fontsource/dm-sans/700.css';
import '../style.css';
import './studio.css';
import {createStudio} from './studio.js';

export default function Studio(){
  const host=useRef(null),engine=useRef(null);
  const [ready,setReady]=useState(false),[error,setError]=useState(''),[playing,setPlaying]=useState(false),[cadence,setCadence]=useState(30),[phase,setPhase]=useState(0),[clay,setClay]=useState(false),[camera,setCamera]=useState('quarter');
  useEffect(()=>{let alive=true;engine.current=createStudio(host.current,()=>{if(alive)setReady(true);},e=>{if(alive)setError(e.message);},value=>{if(alive)setPhase(value);});return()=>{alive=false;engine.current.dispose();};},[]);
  useEffect(()=>engine.current?.setPlaying(playing),[playing]);
  useEffect(()=>engine.current?.setCadence(cadence),[cadence]);
  useEffect(()=>engine.current?.setClay(clay),[clay]);
  function view(name){setCamera(name);engine.current?.view(name);}
  return <div className="app-shell cyclist-shell"><header className="app-header"><div className="brand"><Bike size={27}/><h1>Colombo <span>/ Cyclist studio</span></h1></div><a className="button" href="/#drive" aria-label="Back to map"><ArrowLeft size={15}/><span>Back to map</span></a></header>
    <main className="cyclist-workspace"><aside className="cyclist-panel"><h2>The first pedal turn</h2><p className="subtle small">Inspect the rider, bicycle fit, and movement before street testing.</p>
      <a className="button primary full-width" href="/movement.html">Try walking & riding <ArrowLeft size={15} style={{transform:'rotate(180deg)'}}/></a>
      <div className="divider"/><h3>Movement</h3><button className="button primary full-width" disabled={!ready} onClick={()=>setPlaying(!playing)}>{playing?<Pause size={16}/>:<Play size={16}/>} {playing?'Pause pedaling':'Play pedaling'}</button>
      <label className="field-label" htmlFor="cadence">Cadence <span>{cadence} rpm</span></label><input id="cadence" type="range" min="10" max="90" step="5" value={cadence} onChange={e=>setCadence(+e.target.value)}/>
      <label className="field-label" htmlFor="phase">Pedal position <span>{phase}°</span></label><input id="phase" type="range" min="0" max="360" step="1" value={phase} disabled={playing||!ready} onChange={e=>{setPhase(+e.target.value);engine.current.setPhase(+e.target.value/360);}}/>
      <div className="divider"/><h3>Inspect</h3><div className="studio-views">{[['quarter','Three-quarter'],['side','Side'],['front','Front'],['back','Back'],['head','Face'],['hands','Hands'],['feet','Pedals']].map(([id,label])=><button className={`button ${camera===id?'selected':''}`} key={id} onClick={()=>view(id)} disabled={!ready}>{label}</button>)}</div>
      <label className="studio-toggle"><input type="checkbox" checked={clay} onChange={e=>setClay(e.target.checked)}/>Neutral clay materials</label>
      <button className="button full-width" disabled={!ready} onClick={()=>{setPlaying(false);setPhase(0);engine.current.setPhase(0);view('quarter');}}><RotateCcw size={15}/>Reset inspection</button>
      <div className="divider"/><h3>Working files</h3><a className="text-link" href="/cyclist/rider.glb" download><Download size={14}/>Rider GLB</a><a className="text-link" href="/cyclist/bicycle-fitted.glb" download><Download size={14}/>Fitted bicycle GLB</a><a className="text-link" href="/assets/cyclist/colombo-cyclist.blend" download><Download size={14}/>Editable rider in Blender</a>
      <p className="studio-note">First animation study, with an adjusted saddle and synchronized pedals. Detailed finger grip, steering, balance and road physics are the next pass.</p>
      <a className="text-link" href="https://www.paperroute.lol/devlog/" target="_blank" rel="noreferrer">PaperRoute development reference ↗</a>
    </aside><section className="studio-view" aria-label="Cyclist 3D preview"><div className="canvas-host" ref={host}/><div className="studio-caption"><strong>Rider & commuter bicycle</strong><span>Drag to orbit · Scroll to zoom</span></div>
      {(!ready||error)&&<div className="loading-cover"><div className="loading-card"><Bike size={30}/><h2>{error?'Preview could not load':'Preparing the cyclist'}</h2><p>{error||'Loading geometry, textures, and the pedal rig…'}</p></div></div>}
    </section></main><footer className="status-bar"><span><i className={ready?'ready':'loading'}/>{error?'Asset needs attention':ready?'Ready for pose inspection':'Loading assets…'}</span><span>Blender → Three.js · Local review</span></footer></div>;
}
