import {useMemo,useState} from 'react';
import {Check,Download,ExternalLink,Info,Search,LocateFixed,ArrowUpRight} from 'lucide-react';
import {assetFiles} from '../asset-files.js';
import {assetUrl,bytes,formatNumber,layerDefinitions,reviewOptions,reviewSubjects} from './data.js';

export function Toggle({label,checked,onChange,color,disabled=false}){
  return <label className={`toggle-row ${disabled?'disabled':''}`}>
    <input type="checkbox" checked={checked} onChange={e=>onChange(e.target.checked)} disabled={disabled}/>
    <span className="check-box"><Check size={12}/></span>
    {color&&<span className="layer-dot" style={{background:color}}/>}
    <span>{label}</span>
  </label>;
}

export function LayersPanel({manifest,mode,setMode,layers,setLayers,overlays,setOverlays,wireframe,setWireframe,dressed,setDressed}){
  return <><section className="panel-section">
    <h2>Scene layers</h2><p className="subtle">Lotus Tower &amp; Fort</p>
    <div className="segmented" aria-label="Model selection">
      <button aria-pressed={mode==='full'} onClick={()=>setMode('full')}>Full district</button>
      <button aria-pressed={mode==='roads'} onClick={()=>setMode('roads')}>Roads only</button>
    </div>
    <div className="segmented street-style" aria-label="Street presentation">
      <button aria-pressed={!dressed} onClick={()=>setDressed(false)}>Source</button>
      <button aria-pressed={dressed} onClick={()=>setDressed(true)}>Dressed streets</button>
    </div>
    <div className="layer-list">{layerDefinitions.map(([id,label,color])=><Toggle key={id} label={label} color={color}
      checked={layers[id]} disabled={mode==='roads'&&id!=='roads'} onChange={checked=>setLayers({...layers,[id]:checked})}/>)}</div>
    <div className="divider"/>
    <Toggle label="Road centre lines" checked={overlays.centreLines} onChange={centreLines=>setOverlays({...overlays,centreLines})}/>
    <Toggle label="Inferred traffic flow" checked={overlays.trafficFlow!==false} onChange={trafficFlow=>setOverlays({...overlays,trafficFlow})}/>
    <Toggle label="Study boundary" checked={overlays.boundary} onChange={boundary=>setOverlays({...overlays,boundary})}/>
    <Toggle label="Wireframe" checked={wireframe} onChange={setWireframe}/>
    <p className="help-note"><Info size={16}/><span>Control markers show mapped locations, not verified traffic lights.</span></p>
  </section>
  <div className="sidebar-bottom"><div className="summary-stats">
    <div><strong>{manifest?.area_km2??'—'} km²</strong><span>Study area</span></div>
    <div><strong>{manifest?.statistics.road_length_km??'—'} km</strong><span>Mapped roads</span></div>
  </div><a className="source-link" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">Source: OpenStreetMap <ExternalLink size={12}/></a></div></>;
}

function Field({label,children}){return <div className="detail-row"><dt>{label}</dt><dd>{children??'Not recorded'}</dd></div>;}
const human=s=>s?.replaceAll('_',' ');

function ReviewEditor({target,title,reviews,onReview,storageOkay}){
  const value=reviews[target]||{status:'unreviewed',note:''};
  return <div className="review-editor"><h3>Your review</h3><p className="subtle small">{title}</p>
    <label className="field-label" htmlFor="review-status">Status</label>
    <select id="review-status" value={value.status} onChange={e=>onReview(target,{...value,status:e.target.value,title})}>
      {reviewOptions.map(([id,label])=><option key={id} value={id}>{label}</option>)}
    </select>
    <label className="field-label" htmlFor="review-note">Notes</label>
    <textarea id="review-note" rows={4} placeholder="What looks correct, or needs a closer look?" value={value.note}
      onChange={e=>onReview(target,{...value,note:e.target.value,title})}/>
    <p className="subtle small">{storageOkay?'Notes stay in this browser. Export review to share them.':'Browser storage is unavailable. Export review before closing.'}</p>
  </div>;
}

export function InspectPanel({network,selection,onSelect,onFocus,reviews,onReview,storageOkay}){
  const [query,setQuery]=useState(''),[kind,setKind]=useState('roads'),[reviewSubject,setReviewSubject]=useState('roads');
  const records=useMemo(()=>{
    if(!network)return [];
    const q=query.toLocaleLowerCase();
    const input=kind==='roads'?network.roads:kind==='controls'?network.controls:network.turn_restrictions;
    return input.filter(r=>[r.name,r.id,r.highway,r.kind,r.tags?.restriction,...Object.values(r.names||{})].join(' ').toLocaleLowerCase().includes(q));
  },[network,query,kind]);
  const road=selection?.type==='road'?network?.roads.find(r=>r.id===selection.id):null;
  const control=selection?.type==='control'?network?.controls.find(c=>c.id===selection.id):null;
  const restriction=selection?.type==='restriction'?network?.turn_restrictions.find(r=>r.id===selection.id):null;
  const title=road?(road.name||`Unnamed ${road.highway}`):control?`${human(control.kind)} · ${control.id}`:
    restriction?human(restriction.tags.restriction):selection?.name;
  const reviewTitle=title||reviewSubjects.find(s=>s.id===reviewSubject).label;
  const reviewTarget=selection?`${selection.type}:${selection.id||selection.name}`:`layer:${reviewSubject}`;
  return <section className="panel-section inspect-section">
    <h2>Inspect the map</h2><p className="subtle">Find a feature or select it in the scene.</p>
    <label className="field-label" htmlFor="feature-type">Feature type</label>
    <select id="feature-type" value={kind} onChange={e=>{setKind(e.target.value);setQuery('');}}>
      <option value="roads">Roads ({network?.roads.length??0})</option>
      <option value="controls">Control markers ({network?.controls.length??0})</option>
      <option value="restrictions">Turn restrictions ({network?.turn_restrictions.length??0})</option>
    </select>
    <label className="search-field"><Search size={16}/><input aria-label="Find a road or feature" type="search" placeholder="Search name, type or ID…" value={query} onChange={e=>setQuery(e.target.value)}/></label>
    <div className="feature-list" aria-label="Matching features">{records.slice(0,45).map(r=>{
      const type=kind==='roads'?'road':kind==='controls'?'control':'restriction';
      return <button key={r.id} className={selection?.type===type&&selection.id===r.id?'selected':''}
        onClick={()=>onSelect({type,id:r.id},type!=='restriction')}>
        <span>{r.name||human(r.kind)||human(r.tags?.restriction)||`Unnamed ${r.highway}`}</span>
        <small>{r.id} {r.highway?`· ${human(r.highway)}`:''}</small>
      </button>;
    })}{!records.length&&<p className="subtle empty">No matching features.</p>}</div>
    <p className="small subtle result-count">{records.length>45?`Showing 45 of ${records.length}. Search to narrow the list.`:`${records.length} matching features`}</p>
    {selection&&<div className="selection-detail">
      <div className="detail-heading"><h3>{title}</h3><button className="text-button" onClick={()=>onSelect(null)}>Clear</button></div>
      {(road||control)&&<button className="button full-width" onClick={()=>onFocus(selection)}><LocateFixed size={15}/> Focus in scene</button>}
      <dl>
        {road&&<><Field label="Source ID">{road.id}</Field><Field label="Road class">{human(road.highway)}</Field>
          <Field label="Width">{road.width_m} m</Field><Field label="Width source">{road.width_source}</Field>
          <Field label="Direction">{road.direction||'Unresolved'}</Field><Field label="Direction source">{road.direction_source}</Field>
          <Field label="Length">{road.length_m} m</Field><Field label="Lanes">{road.lanes}</Field>
          <Field label="Speed tag">{road.maxspeed}</Field><Field label="Access tag">{road.access}</Field>
          <Field label="Bridge / layer">{road.bridge?'Yes':'No'} / {road.layer}</Field>
          <Field label="Base graph">{road.base_graph_eligible?'Included; restrictions still need enforcement':'Excluded'}</Field></>}
        {control&&<><Field label="Source ID">{control.id}</Field><Field label="Type">{human(control.kind)}</Field>
          <Field label="Graph node">{control.graph_node_id}</Field><Field label="Signal timing">Unverified</Field>
          <Field label="Placement">{control.placement}</Field></>}
        {restriction&&<><Field label="Source ID">{restriction.id}</Field><Field label="Enforced">No</Field>
          {restriction.members.map((m,i)=><Field key={i} label={m.role}>{m.type} {m.ref}</Field>)}</>}
        {selection.type==='surface'&&<><Field label="Layer">{selection.layer}</Field>
          <Field label="Picked point (m)">{selection.point?.join(', ')}</Field><Field label="Selection">Mesh or material group; not necessarily a single building.</Field></>}
      </dl>
      {(road||control||restriction)&&<details><summary>Original source tags</summary><pre>{JSON.stringify((road||control||restriction).tags,null,2)}</pre></details>}
      {(road||control||restriction)&&<a className="text-link" href={`https://www.openstreetmap.org/${road?'way':control?'node':'relation'}/${selection.id}`} target="_blank" rel="noreferrer">Open source record <ArrowUpRight size={14}/></a>}
    </div>}
    {!selection&&<><label className="field-label" htmlFor="review-subject">Review a layer</label><select id="review-subject" value={reviewSubject} onChange={e=>setReviewSubject(e.target.value)}>{reviewSubjects.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></>}
    <ReviewEditor key={reviewTarget} target={reviewTarget} title={reviewTitle} reviews={reviews} onReview={onReview} storageOkay={storageOkay}/>
  </section>;
}

export function AssetsPanel({manifest,models,fileChecks,checkingFiles,onFileChecks,dataChecks,checkingData,onDataChecks,checkError}){
  return <section className="panel-section assets-section"><h2>Assets &amp; checks</h2>
    <p className="subtle">Inspect the files. Keep accuracy review separate.</p>
    <div className="checks-actions"><button className="button full-width" disabled={checkingFiles} onClick={onFileChecks}>{checkingFiles?'Checking files…':'Check file availability'}</button>
      <button className="button full-width" disabled={checkingData||!manifest} onClick={onDataChecks}>{checkingData?'Checking structure…':'Check data & geometry'}</button></div>
    {checkError&&<p className="error-note" role="alert">{checkError}</p>}
    {dataChecks&&<div className="check-results" aria-live="polite"><h3>Structural checks</h3>{dataChecks.results.map(r=><div className="check-result" key={r.label}>
      <span className={`status-label ${r.status}`}>{r.status==='pass'?'Pass':r.status==='fail'?'Fail':r.status==='manual'?'Manual':r.status==='warning'?'Review':'Pending'}</span>
      <strong>{r.label}</strong><p>{r.detail}</p></div>)}</div>}
    <h3 className="section-label">Package files</h3>
    <div className="asset-list">{assetFiles.map(asset=>{
      const checked=fileChecks[asset.file],declared=manifest?.export?.files?.[asset.file];
      const glbKey=asset.file==='colombo-roads.glb'?'full':asset.file==='road-surfaces.glb'?'roads':null;
      return <div className="asset-row" key={asset.file}><div><strong>{asset.label}</strong><span className="filename">{asset.file}</span>
        <small>{checked?(checked.ok?`${bytes(checked.bytes)} · Available`:`Unavailable · ${checked.error}`):declared?`${bytes(declared)} · Declared size`:'Availability not checked'}</small>
        {models[glbKey]&&<small>{formatNumber(models[glbKey].triangles)} triangles loaded</small>}
      </div><a className="icon-button" href={assetUrl(asset.file)} download aria-label={`Download ${asset.label}`}><Download size={15}/></a></div>;
    })}</div>
    <details className="accuracy-details"><summary>Known limitations</summary><ul>{manifest?.accuracy_notes.filter(n=>!n.startsWith('No browser,')).map(n=><li key={n}>{n}</li>)}</ul></details>
    <p className="help-note"><Info size={16}/><span>Availability and geometry checks do not validate real-world accuracy. Open the .blend file in Blender for editing and source-scene review.</span></p>
  </section>;
}
