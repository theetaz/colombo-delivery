import {CarFront,Package,Flag,Play,Pause,RotateCcw,LogOut,ArrowLeft,ArrowRight,ArrowUp,ArrowDown,Check,CheckCircle2} from 'lucide-react';

export function DeliveryPanel({drive,review,ready,starting,error,onStart,onExit,onAssist}){
  return <section className="panel-section delivery-panel">
    <div className="delivery-eyebrow"><CarFront size={16}/>Delivery test · 01</div>
    <h2>A short drive by the tower</h2>
    <p className="subtle small">Collect one package, follow the marked road, and make your first delivery.</p>
    <a className="button full-width" href="/cyclist.html">Open cyclist studio <ArrowRight size={15}/></a>
    <div className="pilot-card"><span>TEST ROAD</span><strong>D. R. Wijewardene Mawatha</strong>
      <div><span>580 m test area</span><span>45 km/h car cap</span></div></div>
    <ol className="delivery-steps">
      <li><Package size={17}/><div><strong>Collect the package</strong><span>Stop in the amber zone and press E.</span></div></li>
      <li><Flag size={17}/><div><strong>Follow the teal route</strong><span>Drive about 290 m to the next stop.</span></div></li>
      <li><CheckCircle2 size={17}/><div><strong>Deliver & earn 100 credits</strong><span>Stop in the teal zone and press E.</span></div></li>
    </ol>
    {!drive?.active?<button className="button primary full-width" disabled={!ready||starting} onClick={onStart}><Play size={16}/>{starting?'Preparing car…':drive?'Return to delivery':'Start delivery test'}</button>:
      <><label className="toggle-row drive-assist"><input type="checkbox" checked={drive.assist} onChange={e=>onAssist(e.target.checked)}/><span className="check-box"><Check size={12}/></span>Steering assistance</label>
        <p className="subtle small">Follows the road when you release the steering keys. You control acceleration and braking.</p>
        <button className="button full-width exit-drive" onClick={onExit}><LogOut size={15}/>Back to map review</button></>}
    {error&&<p className="error-note" role="alert">{error}</p>}
    <div className="drive-keys"><h3>Keyboard controls</h3><dl>
      <div><dt><kbd>W</kbd> / <kbd>↑</kbd></dt><dd>Accelerate</dd></div>
      <div><dt><kbd>S</kbd> / <kbd>↓</kbd></dt><dd>Brake, then reverse</dd></div>
      <div><dt><kbd>A</kbd> <kbd>D</kbd></dt><dd>Steer left / right</dd></div>
      <div><dt><kbd>Space</kbd></dt><dd>Handbrake</dd></div>
      <div><dt><kbd>E</kbd> / <kbd>R</kbd></dt><dd>Interact / reset car</dd></div>
      <div><dt><kbd>Esc</kbd></dt><dd>Pause</dd></div>
    </dl></div>
    <details className="route-review"><summary>Map review & test limits</summary>
      <p>This is one bounded carriageway with fictional delivery stops. Buildings are blockouts. Traffic, fines, health and a driving rating come later.</p>
      {review?.checks.map(item=><div className="check-result" key={item.label}><span className={`status-label ${item.status}`}>{item.status==='pass'?'Geometry checked':'Needs real-world review'}</span><strong>{item.label}</strong><p>{item.detail}</p></div>)}
      {!review&&<p>Detailed review could not load. Road width, elevations and traffic controls still need manual confirmation.</p>}
      <a href="/delivery/map-review.json" download className="text-link">Download the route review</a>
    </details>
    <p className="car-credit">Car adapted from <a href="https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept" target="_blank" rel="noreferrer">CarConcept</a>, Eric Chadwick / Darmstadt Graphics Group GmbH, 2024. <a href="/delivery/CAR-LICENSE.md" target="_blank" rel="noreferrer">CC BY 4.0 & modifications</a>.</p>
  </section>;
}

function HoldButton({label,children,input,value=1,onInput,className=''}){
  const release=e=>{onInput(input,0);if(e.currentTarget.hasPointerCapture(e.pointerId))e.currentTarget.releasePointerCapture(e.pointerId);};
  return <button className={`hold-button ${className}`} aria-label={label} title={label}
    onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture(e.pointerId);onInput(input,value);}}
    onPointerUp={release} onPointerCancel={release} onLostPointerCapture={()=>onInput(input,0)}
    onKeyDown={e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();onInput(input,value);}}}
    onKeyUp={e=>{if(e.code==='Enter'||e.code==='Space')onInput(input,0);}} onBlur={()=>onInput(input,0)}>{children}</button>;
}

export function DeliveryHUD({drive,onAction,onPause,onReset,onExit,onRestart,onCamera,onInput}){
  const complete=drive.phase==='complete';
  const action=drive.phase==='pickup'?'Collect package':'Deliver package';
  return <div className="delivery-hud">
    <div className="mission-card"><div className={`mission-icon ${complete?'complete':''}`}>{complete?<CheckCircle2 size={23}/>:drive.phase==='pickup'?<Package size={23}/>:<Flag size={23}/>}</div>
      <div><span className="mission-overline">{complete?'DELIVERY COMPLETE':`DELIVERY ${String(drive.deliveryNumber).padStart(2,'0')} · ${drive.phase==='pickup'?'PICKUP':'DROPOFF'}`}</span>
        <h2>{complete?'100 credits earned':drive.phase==='pickup'?'Collect your package':'Deliver to the lakeside'}</h2>
        <p>{complete?'Ready for another run?':`${Math.round(drive.remaining)} m away · ${drive.canAct?'Ready to '+(drive.phase==='pickup'?'collect':'deliver'):'Follow the line and stop in the zone'}`}</p></div></div>
    <div className="drive-toolbar">
      <button className="button" aria-label={drive.paused?'Resume driving':'Pause driving'} onClick={()=>onPause(!drive.paused)}>{drive.paused?<Play size={16}/>:<Pause size={16}/>}</button>
      <button className="button" aria-label="Reset car" disabled={complete} onClick={onReset}><RotateCcw size={16}/></button>
      <button className="button" onClick={()=>onCamera(drive.cameraMode==='chase'?'overhead':'chase')}>{drive.cameraMode==='chase'?'Top view':'Chase view'}</button>
      <button className="button" aria-label="Exit delivery test" onClick={onExit}><LogOut size={16}/></button>
    </div>
    <div className="drive-status"><div className="speed"><strong>{Math.round(drive.speedKph)}</strong><span>km/h</span></div><div><span>CREDITS</span><strong>{drive.credits}</strong></div><div className="assist-indicator">Assist {drive.assist?'on':'off'}</div></div>
    {(drive.blocked||drive.wrongWay)&&!drive.paused&&<div className="drive-warning" role="status">{drive.blocked?`${drive.blocked} · Reverse or press R to reset`:'Wrong way · Follow the marked direction'}</div>}
    {drive.paused?<div className="drive-pause"><h2>Driving paused</h2><p>Your package and credits are saved for this session.</p><button className="button primary" onClick={()=>onPause(false)}><Play size={16}/>Resume driving</button></div>:
      <div className="delivery-action">{complete?<button className="button primary" onClick={onRestart}>Start another delivery <ArrowRight size={16}/></button>:
        <><button className="button primary" onClick={onAction} disabled={!drive.canAct}>{drive.phase==='pickup'?<Package size={17}/>:<Flag size={17}/>}<span>{action}</span><kbd>E</kbd></button><span>{drive.canAct?'You’re in the zone':drive.remaining<=7?'Brake to a stop to continue':'Stop inside the marked zone'}</span></>}</div>}
    {!drive.paused&&!complete&&<div className="driving-controls"><div className="steering-controls">
      <HoldButton label="Steer left" input="steer" onInput={onInput}><ArrowLeft size={23}/></HoldButton>
      <HoldButton label="Steer right" input="steer" value={-1} onInput={onInput}><ArrowRight size={23}/></HoldButton></div>
      <div className="pedal-controls"><HoldButton label="Brake or reverse" input="brake" onInput={onInput}><ArrowDown size={22}/><span>Brake</span></HoldButton>
      <HoldButton label="Accelerate" input="throttle" onInput={onInput} className="accelerator"><ArrowUp size={22}/><span>Drive</span></HoldButton></div></div>}
  </div>;
}
