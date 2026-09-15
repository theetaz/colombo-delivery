import React, { useEffect, useRef, useState } from "react";
import { Bike, CloudRain, Eye, Footprints, Pause, Play, Wind } from "lucide-react";
import { createEnvironment } from "./runtime.js";
import { addresses } from "./layout.js";

export default function Environment() {
  const host = useRef(null), viewer = useRef(null);
  const [ready, setReady] = useState(false), [error, setError] = useState("");
  const [phase, setPhase] = useState("Sunny"), [weather, setWeather] = useState("Clear"), [wind, setWind] = useState("Breeze");
  const [paused, setPaused] = useState(false), [inspection, setInspection] = useState(false);
  const [state, setState] = useState({ mode: "foot", label: "On foot", hint: "Walk to the bicycle", speed: 0, drawCalls: 0, triangles: 0 });
  const [counts, setCounts] = useState(null);
  useEffect(() => {
    let alive = true;
    createEnvironment(host.current, {
      onReady: (value) => alive && (setCounts(value), setReady(true)),
      onState: (value) => { if (alive) { setState(value); setPaused(value.paused); setInspection(value.inspection); } },
    }).then((value) => {
      if (!alive) return value.dispose();
      viewer.current = value;
      window.__COLOMBO_ENVIRONMENT__ = value;
      value.follow();
    }).catch((reason) => alive && setError(reason.message));
    return () => { alive = false; delete window.__COLOMBO_ENVIRONMENT__; viewer.current?.dispose(); };
  }, []);
  function togglePause() { const value = !paused; setPaused(value); viewer.current?.pause(value); }
  function choosePreset(name) { setInspection(true); viewer.current?.preset(name); }
  function follow() { setInspection(false); viewer.current?.follow(); }
  return <main className="environment-shell">
    <div ref={host} className="environment-canvas" />
    <header className="environment-header">
      <div><span className="eyebrow">First playable environment</span><h1>Lake Garden Street</h1><p>A fictional Colombo pilot assembled from prepared candidates and approved movement assets.</p></div>
      <nav><a className="play-link" href="/play.html">Play delivery game</a><a href="/street-composition.html">Street study</a><a href="/vegetation-review.html">Vegetation kit</a></nav>
    </header>
    <section className="view-tabs" aria-label="Environment views">
      {["Garden", "Shops", "Lakeside", "Overview"].map((name) => <button disabled={!ready} key={name} onClick={() => choosePreset(name)}>{name}</button>)}
      <button disabled={!ready} className="follow" aria-pressed={!inspection} onClick={follow}><Eye size={15}/> Follow courier</button>
    </section>
    <aside className="environment-panel">
      <div className="readiness"><i className={error ? "error" : ready ? "ready" : "loading"}/><span>{error || (ready ? "All required game assets loaded" : "Assembling the street…")}</span></div>
      <div className="transport"><span>{state.mode === "ride" ? <Bike size={18}/> : <Footprints size={18}/>} {state.label}</span><strong>{state.speed.toFixed(1)} km/h</strong></div>
      <p className={`movement-hint ${state.canInteract ? "action" : ""}`}>{state.hint}</p>
      <p className="instructions"><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> move · <kbd>E</kbd> mount / dismount · <kbd>Space</kbd> pause</p>
      <label>Light<select disabled={!ready} value={phase} onChange={(event) => { setPhase(event.target.value); viewer.current?.setPhase(event.target.value); }}>{["Sunny", "Dusk", "Night"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label><CloudRain size={15}/> Weather<select disabled={!ready} value={weather} onChange={(event) => { setWeather(event.target.value); viewer.current?.setWeather(event.target.value); }}>{["Clear", "Rain"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <label><Wind size={15}/> Wind<select disabled={!ready} value={wind} onChange={(event) => { setWind(event.target.value); viewer.current?.setWind(event.target.value); }}>{["Calm", "Breeze", "Strong"].map((v) => <option key={v}>{v}</option>)}</select></label>
      <button disabled={!ready} className="pause" onClick={togglePause}>{paused ? <Play size={15}/> : <Pause size={15}/>} {paused ? "Resume" : "Pause"}</button>
      <div className="stop-list"><span>Fictional delivery markers</span>{addresses.map((address) => <button disabled={!ready} key={address.id} onClick={() => { setInspection(true); viewer.current?.focusStop(address.id); }}>{address.label}<small>{address.role}</small></button>)}</div>
      {counts && <dl><div><dt>Buildings</dt><dd>{counts.buildings}</dd></div><div><dt>Trees</dt><dd>{counts.trees}</dd></div><div><dt>Understory</dt><dd>{counts.understory}</dd></div><div><dt>Stops</dt><dd>{counts.addresses}</dd></div></dl>}
      <small>{state.drawCalls} draw calls · {Math.round(state.triangles / 1000)}k visible triangles</small>
    </aside>
    <footer>Pickup and dropoff markers use fictional pilot addresses. Exterior interaction anchors await human orientation review.</footer>
  </main>;
}
