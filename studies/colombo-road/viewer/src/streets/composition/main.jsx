import React,{useEffect,useMemo,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft,Download,MapPin,Pause,Play} from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import {createCompositionViewer} from './runtime.js';
import {registryDownload} from './worldRegistry.js';
import './style.css';
import './living.css';

function Composition(){
  const host=useRef(null),viewer=useRef(null);
  const [preset,setPreset]=useState('Garden');
  const [tour,setTour]=useState(false);
  const [status,setStatus]=useState('Opening the street…');
  const [error,setError]=useState('');
  const [registry,setRegistry]=useState(null);
  const [selected,setSelected]=useState('');
  const [phase,setPhase]=useState('Day');
  const [auto,setAuto]=useState(false);
  const [motion,setMotion]=useState(true);
  const [traffic,setTraffic]=useState(true);
  const [wind,setWind]=useState(true);

  useEffect(()=>{
    try{
      viewer.current=createCompositionViewer(host.current,{onStatus:setStatus,onPreset:setPreset,onTour:setTour,onError:setError,onRegistry:setRegistry,onPhase:setPhase});
      window.__COLOMBO_COMPOSITION__=viewer.current;
    }catch(reason){setError(reason.message);}
    return()=>{delete window.__COLOMBO_COMPOSITION__;viewer.current?.dispose();};
  },[]);

  const stops=registry?.deliveryStops||[];
  const chosen=useMemo(()=>stops.find(item=>item.id===selected),[stops,selected]);
  function choose(id){setSelected(id);if(id)viewer.current?.focusDeliveryStop(id);}
  function download(){
    const blob=new Blob([registryDownload(registry)],{type:'application/json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
    link.href=url;link.download='colombo-living-street.registry.json';link.click();URL.revokeObjectURL(url);
  }

  return <main className="composition-shell">
    <div ref={host} className="composition-canvas" aria-label="Interactive 3D Colombo street composition"/>
    <header className="composition-header"><a href="/" className="back-link"><ArrowLeft size={16}/> District review</a><div><h1>A living Colombo street</h1><p>One authored 190 m corridor with neighbourhood deliveries, gardens and lakeside movement. <a href="/environment.html">Open the playable asset environment</a>.</p></div></header>
    <nav className="composition-controls" aria-label="Street views">
      {['Garden','Shops','Lakeside'].map(name=><button key={name} aria-pressed={preset===name&&!tour} onClick={()=>viewer.current?.preset(name)}>{name}</button>)}
      <span/><button className="tour" aria-pressed={tour} onClick={()=>viewer.current?.toggleTour()}>{tour?<Pause size={14}/>:<Play size={14}/>} {tour?'Pause tour':'Street tour'}</button>
    </nav>
    <aside className="living-panel" aria-label="Living street controls">
      <label>Time<select value={phase} onChange={event=>{setPhase(event.target.value);viewer.current?.setPhase(event.target.value);}} disabled={auto}>{['Day','Dusk','Night'].map(name=><option key={name}>{name}</option>)}</select></label>
      <label className="check"><input type="checkbox" checked={auto} onChange={event=>{setAuto(event.target.checked);viewer.current?.setAutomaticDayCycle(event.target.checked);}}/> Automatic day cycle</label>
      <div className="toggle-row">
        <button aria-pressed={motion} onClick={()=>setMotion(viewer.current?.setMotion(!motion)??!motion)}>Motion</button>
        <button aria-pressed={traffic} onClick={()=>setTraffic(viewer.current?.setTraffic(!traffic)??!traffic)}>Traffic</button>
        <button aria-pressed={wind} onClick={()=>setWind(viewer.current?.setWind(!wind)??!wind)}>Wind</button>
      </div>
      <hr/>
      <label><span>Delivery locations</span><select value={selected} onChange={event=>choose(event.target.value)}><option value="">Choose a location</option>{stops.map(stop=><option key={stop.id} value={stop.id}>{stop.name} · {stop.role}</option>)}</select></label>
      {chosen&&<div className="location-card"><MapPin size={15}/><div><strong>{chosen.name}</strong><code>{chosen.id}</code><small>{chosen.role} · {chosen.buildingId}</small></div></div>}
      <button className="download" disabled={!registry} onClick={download}><Download size={14}/> Export registry JSON</button>
    </aside>
    <div className={`composition-status ${error?'error':''}`} role="status">{error||status}</div>
    <div className="composition-help">Drag to look · Scroll to zoom · Right-drag to move</div>
  </main>;
}

const appRoot=window.__COLOMBO_COMPOSITION_ROOT__||createRoot(document.getElementById('root'));
window.__COLOMBO_COMPOSITION_ROOT__=appRoot;
appRoot.render(<Composition/>);
