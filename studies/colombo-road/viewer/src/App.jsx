import {useEffect,useRef,useState} from 'react';
import {Map,Camera,Download,Maximize,Navigation,Landmark,PanelLeft,Info,RefreshCw,X,CarFront,Trees} from 'lucide-react';
import {createViewer} from './createViewer.js';
import {LayersPanel,InspectPanel,AssetsPanel} from './Panels.jsx';
import {assetFiles} from '../asset-files.js';
import {assetUrl,loadJSON,defaultLayers,downloadBlob,downloadJSON,inspectData} from './data.js';
import {DeliveryPanel,DeliveryHUD} from './delivery/DeliveryPanel.jsx';

const storageKey='colombo-roads-v1-review';
function loadReviews(){try{return JSON.parse(localStorage.getItem(storageKey))||{};}catch{return {};}}

export default function App(){
  const host=useRef(null),viewer=useRef(null),modelsRef=useRef({});
  const [manifest,setManifest]=useState(null),[network,setNetwork]=useState(null),[models,setModels]=useState({});
  const [tab,setTab]=useState(()=>window.location.hash==='#drive'?'Drive':'Layers'),[mode,setMode]=useState('full'),[layers,setLayers]=useState(()=>window.location.hash==='#street'?{...defaultLayers,markers:false}:defaultLayers);
  const [overlays,setOverlays]=useState({centreLines:false,boundary:false,trafficFlow:false}),[wireframe,setWireframe]=useState(false);
  const [dressed,setDressed]=useState(true);
  const [progress,setProgress]=useState({full:0}),[fatal,setFatal]=useState(''),[notice,setNotice]=useState('');
  const [selection,setSelection]=useState(null),[camera,setCamera]=useState('overview'),[panelOpen,setPanelOpen]=useState(false);
  const [reviews,setReviews]=useState(loadReviews),[storageOkay,setStorageOkay]=useState(true);
  const [fileChecks,setFileChecks]=useState({}),[checkingFiles,setCheckingFiles]=useState(false);
  const [dataChecks,setDataChecks]=useState(null),[checkingData,setCheckingData]=useState(false),[checkError,setCheckError]=useState('');
  const [busyCapture,setBusyCapture]=useState(false);
  const [drive,setDrive]=useState(null),[startingDrive,setStartingDrive]=useState(false),[driveError,setDriveError]=useState(''),[routeReview,setRouteReview]=useState(null);
  const ready=!!models.full;
  const modelReady=!!models[mode];

  useEffect(()=>{
    let alive=true;
    try {
      viewer.current=createViewer(host.current,{
        onProgress:(key,value)=>{if(alive)setProgress(p=>({...p,[key]:value}));},
        onReady:value=>{if(alive){modelsRef.current=value;setModels(value);}},
        onPick:value=>{if(alive){setSelection(value);setTab('Inspect');}},
        onCamera:value=>{if(alive)setCamera(value);},
        onDelivery:value=>{if(alive)setDrive(value);},
        onNotice:message=>{if(alive)setNotice(message);},
        onError:message=>{if(alive)setFatal(message);}
      });
      Promise.all([loadJSON('manifest.json'),loadJSON('road-network.json')]).then(async([m,n])=>{
        if(!alive)return;setManifest(m);setNetwork(n);await viewer.current.load(n,m);if(alive&&window.location.hash==='#street')viewer.current?.preset('street');
      }).catch(error=>{if(alive)setFatal(error.message);});
      fetch('/delivery/map-review.json').then(r=>r.ok?r.json():null).then(value=>{if(alive)setRouteReview(value);}).catch(()=>{});
    } catch(error){setFatal(`3D view could not start: ${error.message}`);}
    return ()=>{alive=false;viewer.current?.dispose();viewer.current=null;};
  },[]);
  useEffect(()=>{viewer.current?.setLayers(layers);},[layers]);
  useEffect(()=>{viewer.current?.setOverlays(overlays);},[overlays]);
  useEffect(()=>{viewer.current?.setWireframe(wireframe);},[wireframe]);
  useEffect(()=>{viewer.current?.setDressed(dressed);},[dressed]);
  useEffect(()=>{
    try{localStorage.setItem(storageKey,JSON.stringify(reviews));setStorageOkay(true);}catch{setStorageOkay(false);}
  },[reviews]);
  useEffect(()=>{if(!notice)return;const timer=setTimeout(()=>setNotice(''),4500);return()=>clearTimeout(timer);},[notice]);

  async function changeMode(next){
    setMode(next);setCheckError('');
    try{await viewer.current?.setMode(next);}catch(error){setMode('full');viewer.current?.setMode('full');setNotice(error.message);}
  }
  async function startDrive(){
    setStartingDrive(true);setDriveError('');setSelection(null);
    setLayers({...defaultLayers,markers:false});setOverlays({centreLines:false,boundary:false,trafficFlow:false});setWireframe(false);
    try{await changeMode('full');await viewer.current.startDelivery();setPanelOpen(false);}
    catch(error){setDriveError(`Could not start the delivery test: ${error.message}`);}
    finally{setStartingDrive(false);}
  }
  function exitDrive(){viewer.current?.stopDelivery();}
  function changeTab(name){if(name!=='Drive'&&drive?.active)exitDrive();setTab(name);}
  function selectFeature(value,focus=false){
    setSelection(value);
    if(value?.type==='control'&&mode!=='full')changeMode('full');
    if(value?.type==='road')setLayers(v=>({...v,roads:true}));
    if(value?.type==='control')setLayers(v=>({...v,markers:true}));
    if(focus){viewer.current?.focus(value);setPanelOpen(false);}else viewer.current?.select(value);
  }
  function review(target,value){setReviews(current=>({...current,[target]:{...value,updatedAt:new Date().toISOString()}}));}
  function exportReview(){
    downloadJSON({asset:manifest?.name,assetVersion:manifest?.version,osmTimestamp:manifest?.osm_timestamp,
      exportedAt:new Date().toISOString(),reviews,fileAvailability:fileChecks,structuralChecks:dataChecks,
      loadedModelStatistics:modelsRef.current,camera:viewer.current?.pose(),display:{mode,layers,overlays,wireframe},
      pilotMapReview:routeReview,deliveryTest:drive,
      note:'User-entered review and measured file/geometry checks. No certification of geographic accuracy.'},'colombo-asset-review.json');
    setNotice('Review exported. Your notes are still saved here.');
  }
  async function capture(){
    setBusyCapture(true);
    try{downloadBlob(await viewer.current.capture(),'colombo-asset-view.png');setNotice('Current 3D view saved.');}
    catch(error){setNotice(error.message);}finally{setBusyCapture(false);}
  }
  async function checkFiles(){
    setCheckingFiles(true);setCheckError('');
    const checked={};
    // Keep file checks bounded, even if the development server becomes unavailable.
    for(let i=0;i<assetFiles.length;i+=4){
      await Promise.all(assetFiles.slice(i,i+4).map(async({file})=>{
        try{
          const response=await fetch(assetUrl(file),{method:'HEAD',signal:AbortSignal.timeout(12000)});
          const contentType=response.headers.get('content-type')||'';
          const isHtml=contentType.includes('text/html');
          checked[file]={ok:response.ok&&!isHtml,bytes:Number(response.headers.get('content-length'))||null,
            error:!response.ok?String(response.status):isHtml?'Unexpected HTML response':null,checkedAt:new Date().toISOString()};
        }catch(error){checked[file]={ok:false,error:error.message,checkedAt:new Date().toISOString()};}
      }));
    }
    setFileChecks(checked);setCheckingFiles(false);
  }
  async function checkData(){
    setCheckingData(true);setCheckError('');
    try{
      const geojson=await loadJSON('roads.geojson');
      // Load the independent road-only export, while keeping the current view selected.
      await viewer.current.ensureRoads();
      setDataChecks(inspectData(network,manifest,geojson,modelsRef.current));
    }catch(error){setCheckError(error.message);viewer.current?.setMode(mode);}
    finally{setCheckingData(false);}
  }
  return <div className="app-shell">
    <header className="app-header"><div className="brand"><Map size={28} strokeWidth={1.4}/><h1>Colombo <span>/ Asset review</span></h1></div>
      <div className="header-actions"><a className="button" href="/street-composition.html"><Trees size={16}/><span>Street study</span></a><button className="button" aria-label="Save view" title="Save view as PNG" onClick={capture} disabled={!modelReady||busyCapture}><Camera size={16}/><span>{busyCapture?'Saving…':'Save view'}</span></button>
        <button className="button primary" aria-label="Export review" title="Export review as JSON" onClick={exportReview} disabled={!ready}><Download size={16}/><span>Export review</span></button></div></header>
    <main className="workspace">
      <aside className={`sidebar ${panelOpen?'open':''}`} aria-label="Asset review controls">
        <nav className="tabs" aria-label="Review panels">{['Layers','Inspect','Assets','Drive'].map(name=><button key={name} aria-pressed={tab===name} disabled={startingDrive} onClick={()=>changeTab(name)}>{name}</button>)}
          <button className="close-panel icon-button" aria-label="Close controls" onClick={()=>setPanelOpen(false)}><X size={18}/></button>
        </nav>
        <div className="panel-content">
          {tab==='Layers'&&<LayersPanel {...{manifest,mode,layers,setLayers,overlays,setOverlays,wireframe,setWireframe,dressed,setDressed}} setMode={changeMode}/>}
          {tab==='Inspect'&&<InspectPanel {...{network,selection,reviews,storageOkay}} onSelect={selectFeature} onFocus={s=>{viewer.current?.focus(s);setPanelOpen(false);}} onReview={review}/>}
          {tab==='Assets'&&<AssetsPanel {...{manifest,models,fileChecks,checkingFiles,dataChecks,checkingData,checkError}} onFileChecks={checkFiles} onDataChecks={checkData}/>}
          {tab==='Drive'&&<DeliveryPanel drive={drive} review={routeReview} ready={ready} starting={startingDrive} error={driveError} onStart={startDrive} onExit={exitDrive} onAssist={value=>viewer.current?.setDriveAssist(value)}/>}
        </div>
      </aside>
      <section className="viewport" aria-label="3D asset view">
        <div ref={host} className="canvas-host"/>
        <button className="mobile-controls button" aria-expanded={panelOpen} onClick={()=>setPanelOpen(!panelOpen)}><PanelLeft size={17}/>Controls</button>
        {!drive?.active&&<div className="camera-toolbar" aria-label="Camera presets">
          <button disabled={!ready} className={camera==='overview'?'active':''} onClick={()=>viewer.current?.preset('overview')}><Map size={17}/><span>Overview</span></button>
          <button disabled={!ready} className={camera==='top'?'active':''} onClick={()=>viewer.current?.preset('top')}><Navigation size={16}/><span>Top down</span></button>
          <button disabled={!ready} className={camera==='street'?'active':''} onClick={()=>{if(mode!=='full')changeMode('full');setLayers(l=>({...l,roads:true,buildings:true,markers:false}));setOverlays({centreLines:false,boundary:false,trafficFlow:false});viewer.current?.preset('street');}}><CarFront size={16}/><span>Street</span></button>
          <button disabled={!ready} className={camera==='tower'?'active':''} onClick={()=>{if(mode!=='full')changeMode('full');setLayers(l=>({...l,tower:true}));viewer.current?.preset('tower');}}><Landmark size={16}/><span>Tower</span></button>
          <button disabled={!ready} title="Fit the entire district" aria-label="Fit the entire district" onClick={()=>viewer.current?.preset('overview')}><Maximize size={17}/></button>
        </div>}
        {drive?.active&&<DeliveryHUD drive={drive} onAction={()=>viewer.current?.deliveryAction()} onPause={value=>viewer.current?.pauseDelivery(value)}
          onReset={()=>viewer.current?.resetDelivery()} onExit={exitDrive} onRestart={()=>viewer.current?.restartDelivery()}
          onCamera={value=>viewer.current?.setDriveCamera(value)} onInput={(key,value)=>viewer.current?.setDriveInput(key,value)}/>}
        {(!modelReady||fatal)&&<div className="loading-cover"><div className="loading-card">
          {fatal?<><Info size={28}/><h2>Unable to open the scene</h2><p>{fatal}</p><button className="button" onClick={()=>window.location.reload()}><RefreshCw size={15}/>Reload viewer</button></>:
            <><div className="loading-map"><Map size={30} strokeWidth={1.4}/></div><h2>{mode==='roads'?'Opening road surfaces':'Opening Colombo'}</h2>
              <p>{network?'Loading the 3D asset…':'Reading the map data…'}</p><progress aria-label="Model loading progress" max="1" value={progress[mode]??undefined}/></>}
        </div></div>}
        {!drive?.active&&<div className="view-help"><span className="desktop-help">Drag to orbit · Scroll to zoom · Right-drag to pan</span><span className="touch-help">Drag to orbit · Pinch to zoom · Two fingers to pan</span></div>}
        {selection&&<button className="selection-caption" onClick={()=>{setTab('Inspect');setPanelOpen(true);}}><span>Inspect {selection.type==='road'?(network?.roads.find(r=>r.id===selection.id)?.name||'unnamed road'):selection.type==='control'?'control marker':selection.type}</span><Info size={15}/></button>}
      </section>
    </main>
    <footer className="status-bar"><span><i className={fatal?'error':modelReady?'ready':'loading'}/>{fatal?'Viewer needs attention':drive?.active?'Delivery pilot · fictional stops':modelReady?'Ready for your review':'Loading assets…'}</span>
      <span className="footer-date">Road data · {manifest?new Date(manifest.osm_timestamp).toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'—'}</span></footer>
    {notice&&<div className="toast" role="status">{notice}</div>}
  </div>;
}
