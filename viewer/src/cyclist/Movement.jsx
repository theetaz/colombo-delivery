import React,{useEffect,useRef,useState} from 'react';
import {Bike,ArrowLeft,ArrowRight,ArrowUp,ArrowDown,RotateCcw,Play,Pause,Footprints} from 'lucide-react';
import '@fontsource/dm-sans/400.css';import '@fontsource/dm-sans/500.css';import '@fontsource/dm-sans/600.css';import '@fontsource/dm-sans/700.css';
import '../style.css';import './movement.css';
import {createMovementYard} from './movement-runtime.js';

function Hold({label,axis,value,engine,children,disabled}){
  const release=e=>{engine.current?.input(axis,0);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
  return <button className="yard-hold" aria-label={label} title={label} disabled={disabled} onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);engine.current?.input(axis,value);}} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={()=>engine.current?.input(axis,0)} onKeyDown={e=>{if(['Space','Enter'].includes(e.code)){e.preventDefault();engine.current?.input(axis,value);}}} onKeyUp={()=>engine.current?.input(axis,0)} onBlur={()=>engine.current?.input(axis,0)}>{children}</button>;
}
export default function Movement(){
  const host=useRef(),engine=useRef();const[ready,setReady]=useState(false),[slow,setSlow]=useState(false),[error,setError]=useState(''),[state,setState]=useState({label:'Preparing courtyard',mode:'foot',speed:0,hint:'Loading the rider and bicycle',canInteract:false,paused:false});
  useEffect(()=>{let alive=true;engine.current=createMovementYard(host.current,()=>{if(alive)setReady(true);},s=>{if(alive)setState(s);},e=>{if(alive)setError(e.message);});return()=>{alive=false;engine.current.dispose();};},[]);
  useEffect(()=>engine.current?.setSlow(slow),[slow]);
  const riding=state.mode==='ride',transition=!['foot','ride'].includes(state.mode),disabled=!ready||state.paused||transition;
  return <div className="yard-shell"><header className="yard-header"><div className="brand"><Bike size={26}/><h1>Colombo <span>/ Walk & ride</span></h1></div><nav><a className="button" href="/cyclist.html" aria-label="Back to cyclist studio"><ArrowLeft size={15}/><span>Cyclist studio</span></a><button className="button" aria-label="Slow motion" aria-pressed={slow} disabled={!ready} onClick={()=>{setSlow(!slow);engine.current.setSlow(!slow);}}>{slow?'¼×':'1×'}</button><button className="button" aria-label="Reset courtyard" disabled={!ready} onClick={()=>engine.current.reset()}><RotateCcw size={16}/></button><button className="button" aria-label={state.paused?'Resume':'Pause'} disabled={!ready} onClick={()=>engine.current.pause(!state.paused)}>{state.paused?<Play size={16}/>:<Pause size={16}/>}</button></nav></header>
    <main className="yard-view"><div ref={host} className="canvas-host"/><div className="yard-guide"><span className="yard-overline">MOVEMENT STUDY · 02</span><h2>One rider. On and off the bike.</h2><p>Click the ground to walk.<br/><kbd>W</kbd><kbd>S</kbd> {riding?'pedal / brake':'walk forward / back'} · <kbd>A</kbd><kbd>D</kbd> {riding?'steer':'turn'}<br/><kbd>E</kbd> get on / off · Drag to look around</p></div>
      <div className="yard-bottom"><div className="yard-mode"><div className="yard-mode-icon">{riding?<Bike size={24}/>:<Footprints size={24}/>}</div><div><span className="yard-overline">{state.paused?'PAUSED':'COURTYARD TEST'}</span><strong role="status">{state.label}</strong><p>{state.hint}</p></div><div className="yard-speed"><b>{state.speed}</b><span>km/h</span></div></div>
        <div className="yard-actions"><div className="yard-pad"><Hold label={riding?'Steer left':'Turn left'} axis="turn" value={1} engine={engine} disabled={disabled}><ArrowLeft size={22}/></Hold><Hold label={riding?'Steer right':'Turn right'} axis="turn" value={-1} engine={engine} disabled={disabled}><ArrowRight size={22}/></Hold></div>
          <button className="button primary yard-interact" disabled={!ready||state.paused||!state.canInteract} onClick={()=>engine.current.interact()}>{transition?'Moving…':riding?'Get off bicycle':'Get on bicycle'}<kbd>E</kbd></button>
          <div className="yard-pad"><Hold label={riding?'Brake or roll back':'Walk backward'} axis="forward" value={-1} engine={engine} disabled={disabled}><ArrowDown size={22}/></Hold><Hold label={riding?'Pedal forward':'Walk forward'} axis="forward" value={1} engine={engine} disabled={disabled}><ArrowUp size={22}/></Hold></div></div>
      </div>
      {state.paused&&ready&&<div className="yard-pause"><h2>Paused for inspection</h2><p>Drag to inspect this pose.</p><button className="button primary" onClick={()=>engine.current.pause(false)}><Play size={16}/>Continue</button></div>}
      {(!ready||error)&&<div className="loading-cover"><div className="loading-card"><Bike size={30}/><h2>{error?'Could not load the courtyard':'Preparing your ride'}</h2><p>{error||'Loading the character and movement clips…'}</p></div></div>}
    </main><footer className="yard-footer"><span>Walk → get on → ride → stop → get off</span><span>Assisted balance · Flat-ground prototype</span></footer></div>;
}
