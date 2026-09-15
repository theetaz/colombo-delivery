import React,{useEffect,useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {ArrowLeft,Pause,Play} from 'lucide-react';
import '@fontsource/dm-sans/400.css';
import '@fontsource/dm-sans/500.css';
import '@fontsource/dm-sans/600.css';
import {createCompositionViewer} from './runtime.js';
import './style.css';

function Composition(){
  const host=useRef(null),viewer=useRef(null);const [preset,setPreset]=useState('Garden'),[tour,setTour]=useState(false),[status,setStatus]=useState('Opening the street…'),[error,setError]=useState('');
  useEffect(()=>{try{viewer.current=createCompositionViewer(host.current,{onStatus:setStatus,onPreset:setPreset,onTour:setTour,onError:setError});}catch(reason){setError(reason.message);}return()=>viewer.current?.dispose();},[]);
  return <main className="composition-shell">
    <div ref={host} className="composition-canvas" aria-label="Interactive 3D Colombo street composition" />
    <header className="composition-header">
      <a href="/" className="back-link"><ArrowLeft size={16}/> District review</a>
      <div><h1>A Colombo street</h1><p>Shaded gardens, neighbourhood shops and a lakeside promenade.</p></div>
    </header>
    <nav className="composition-controls" aria-label="Street views">
      {['Garden','Shops','Lakeside'].map(name=><button key={name} aria-pressed={preset===name&&!tour} onClick={()=>viewer.current?.preset(name)}>{name}</button>)}
      <span aria-hidden="true" />
      <button className="tour" aria-pressed={tour} onClick={()=>viewer.current?.toggleTour()}>{tour?<Pause size={14}/>:<Play size={14}/>} {tour?'Pause tour':'Street tour'}</button>
    </nav>
    <div className={`composition-status ${error?'error':''}`} role="status">{error||status}</div>
    <div className="composition-help">Drag to look around · Scroll to zoom · Right-drag to move</div>
  </main>;
}
createRoot(document.getElementById('root')).render(<Composition/>);
