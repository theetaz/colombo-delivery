import React, { useEffect, useMemo, useRef, useState } from "react";
import { Bike, ChevronDown, ChevronLeft, ChevronRight, ChevronUp, CircleDollarSign, Clock3, HelpCircle, Package, Pause, Play, RotateCcw, Settings, X } from "lucide-react";
import { createGame } from "./runtime.js";
import { minimapEntities } from "./minimap.js";
import { addresses } from "../environment/layout.js";
import { loadProgress, saveProgress } from "./session.js";

const PLAYER_KEY = "colombo-delivery:local-player:v1";
const seconds = (value) => `${Math.max(0, Math.ceil(value || 0))}s`;
const addressLabels = new Map(addresses.map((address) => [address.id, address.label]));
const safeStorage = { getItem(key) { try { return localStorage.getItem(key); } catch { return null; } }, setItem(key, value) { localStorage.setItem(key, value); }, removeItem(key) { try { localStorage.removeItem(key); } catch {} } };
function localPlayerId() { const saved = safeStorage.getItem(PLAYER_KEY); if (saved) return saved; const id = `player:local:${crypto.randomUUID?.() || Math.random().toString(36).slice(2)}`; try { safeStorage.setItem(PLAYER_KEY, id); } catch {} return id; }

function Minimap({ view }) {
  return <div className="minimap-wrap"><div className="minimap" aria-label="North-up street minimap"><span className="north">N</span><i className="road"/>{minimapEntities(view).map((item) => <i key={item.id} className={`map-dot ${item.kind}`} style={{ left: `${item.point.left}%`, top: `${item.point.top}%`, transform: `translate(-50%,-50%) rotate(${-item.yaw}rad)` }}/>)}</div><div className="map-legend" aria-label="Map legend">{[["player","You"],["bike","Bike"],["target","Stop"],["traffic","Traffic"]].map(([kind,label]) => <span key={kind}><i className={`map-dot ${kind}`}/>{label}</span>)}</div></div>;
}

function Hold({ label, axis, value, movement, children }) {
  const release = (event) => { movement(axis, 0); if (event?.currentTarget?.hasPointerCapture?.(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); };
  return <button className="hold" aria-label={label} onPointerDown={(event) => { event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId); movement(axis, value); }} onPointerUp={release} onPointerCancel={release} onLostPointerCapture={() => movement(axis, 0)} onKeyDown={(event) => { if (["Enter", "Space"].includes(event.code)) { event.preventDefault(); movement(axis, value); } }} onKeyUp={(event) => { if (["Enter", "Space"].includes(event.code)) movement(axis, 0); }} onBlur={() => movement(axis, 0)}>{children}</button>;
}

export default function Game() {
  const host = useRef(null), game = useRef(null), generation = useRef(0), dialog = useRef(null), axes = useRef({ forward: 0, turn: 0 }), savedAt = useRef(0), savedFingerprint = useRef(""), overlayOpen = useRef(false), overlayWasPaused = useRef(false), playerId = useRef(localPlayerId()), progress = useRef(loadProgress(safeStorage, playerId.current));
  const [view, setView] = useState(null), [ready, setReady] = useState(false), [error, setError] = useState(""), [saveWarning, setSaveWarning] = useState("");
  const [help, setHelp] = useState(false), [settings, setSettings] = useState(false), [hasSave, setHasSave] = useState(() => Boolean(progress.current.savedSession)), [wallet, setWallet] = useState(progress.current.wallet);
  const [visuals, setVisuals] = useState({ phase: "Sunny", weather: "Clear", wind: "Breeze" });
  const updateView = (next) => { setView(next); game.current?.setInputEnabled(["pickup", "delivery"].includes(next.phase) && !overlayOpen.current); const now = performance.now(), fingerprint = `${next.phase}|${next.paused}|${next.movement?.mode}|${next.receipts?.length || 0}`; if (game.current && next.phase !== "menu" && (now - savedAt.current >= 1000 || fingerprint !== savedFingerprint.current)) { savedAt.current = now; savedFingerprint.current = fingerprint; try { const session = JSON.parse(game.current.serialize()); if (saveProgress(safeStorage, progress.current, session)) { setHasSave(true); setWallet(progress.current.wallet); setSaveWarning(""); } else setSaveWarning("Progress isn’t saved on this device."); } catch { setSaveWarning("Progress isn’t saved on this device."); } } };
  useEffect(() => {
    let alive = true; const token = ++generation.current;
    setReady(false); setError("");
    createGame(host.current, { onState: (next) => alive && generation.current === token && updateView(next), onError: (message) => { if (alive && generation.current === token) setError(message); } }, { playerId: playerId.current }).then((value) => { if (!alive || generation.current !== token) return value.dispose(); game.current = value; window.__COLOMBO_GAME__ = value; value.setInputEnabled(["pickup", "delivery"].includes(value.snapshot().phase)); setReady(true); }).catch((reason) => { if (alive && generation.current === token) { setReady(false); setError(reason.message); } });
    return () => { alive = false; if (generation.current === token) generation.current++; delete window.__COLOMBO_GAME__; const current = game.current; game.current = null; current?.dispose(); };
  }, []);
  useEffect(() => { if (help || settings) dialog.current?.focus(); }, [help, settings]);
  const phase = view?.phase || "menu", movement = view?.movement || {}, job = view?.currentJob || view?.job || {};
  const activePaused = Boolean(view?.paused && ["pickup", "delivery"].includes(phase));
  const setMovement = (axis, value) => { axes.current[axis] = value; game.current?.setMovement({ ...axes.current }); };
  const command = (type) => game.current?.command(type);
  const openOverlay = (setter) => { overlayOpen.current = true; overlayWasPaused.current = Boolean(view?.paused); game.current?.setInputEnabled(false); if (["pickup", "delivery"].includes(phase) && !view?.paused) command("TOGGLE_PAUSE"); setter(true); };
  const closeOverlay = () => { setHelp(false); setSettings(false); overlayOpen.current = false; if (["pickup", "delivery"].includes(phase) && !overlayWasPaused.current && game.current?.snapshot()?.paused) command("TOGGLE_PAUSE"); game.current?.setInputEnabled(["pickup", "delivery"].includes(phase)); };
  const continueGame = () => { const saved = progress.current.savedSession; if (!saved) return; const restored = game.current?.restore(saved); if (!restored?.ok) { progress.current.savedSession = null; saveProgress(safeStorage, progress.current); setHasSave(false); command("START_SHIFT"); } };
  const recover = () => { if (view?.paused) command("TOGGLE_PAUSE"); command("RECOVER"); };
  const returnToMenu = () => { command("RETURN_TO_MENU"); progress.current.savedSession = null; if (!saveProgress(safeStorage, progress.current)) setSaveWarning("Progress isn’t saved on this device."); setHasSave(false); };
  const objective = phase === "pickup" ? `Collect from ${view?.target?.label || "the pickup"}` : phase === "delivery" ? `Deliver to ${view?.target?.label || "the customer"}` : "Complete your delivery shift";
  const interaction = view?.canPackageAction ? `Press F to ${phase === "pickup" ? "collect" : "deliver"}`
    : view?.targetDistance <= 3 && movement.mode !== "foot" ? "Brake to a full stop, then press E to dismount"
    : view?.targetDistance <= 3 ? "Walk into the highlighted stop and stand still"
    : movement.mode === "foot" && movement.canInteract ? "Press E to mount, then ride toward the highlighted stop"
    : movement.mode === "foot" ? `Head toward the highlighted stop · ${Math.round(view?.targetDistance || 0)} m`
    : movement.hint || view?.message || "Ride toward the highlighted stop";
  const trapDialog = (event) => { if (event.key === "Escape") { event.preventDefault(); closeOverlay(); return; } if (event.key !== "Tab") return; const items = [...event.currentTarget.querySelectorAll("button,select,[tabindex]:not([tabindex='-1'])")].filter((item) => !item.disabled); if (!items.length) return; const first = items[0], last = items.at(-1); if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); } else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); } };
  const offerDetails = useMemo(() => ({ reward: job.reward ?? job.payout ?? 0, label: job.label || job.title || `Delivery ${Number(view?.jobIndex || 0) + 1}`, from: job.pickup?.label || job.pickupLabel || addressLabels.get(job.pickupId) || "Neighbourhood pickup", to: job.dropoff?.label || job.dropoffLabel || addressLabels.get(job.dropoffId) || "Local delivery" }), [job, view?.jobIndex]);
  return <main className="game-shell">
    <div className="game-canvas" ref={host}/>
    {!ready && !error && <div className="loading">Opening Lake Garden Street…</div>}
    {error && <div className="fatal"><h1>Couldn’t start the shift</h1><p>{error}</p><button onClick={() => location.reload()}>Try again</button></div>}
    {ready && !error && phase === "menu" && <section className="welcome"><span>Colombo Delivery</span><h1>Your first shift starts here.</h1><p>Walk to your bicycle, collect three neighbourhood orders, and deliver them before time runs out.</p><button className="primary" onClick={() => command("START_SHIFT")}><Play size={18}/> Start shift</button>{hasSave && <button onClick={continueGame}>Continue saved shift</button>}<small>Single player · Progress stays in this browser</small></section>}
    {ready && !error && phase === "offer" && <section className="offer"><span>Job {Number(view?.jobIndex || 0) + 1} of {view?.jobs?.length || 3}</span><h2>{offerDetails.label}</h2><div><strong>{offerDetails.from}</strong><i>to</i><strong>{offerDetails.to}</strong></div><p><CircleDollarSign size={17}/> Earn {offerDetails.reward}</p><button className="primary" onClick={() => command("ACCEPT_JOB")}>Accept delivery</button></section>}
    {ready && !error && ["pickup", "delivery"].includes(phase) && <>
      <header className="mission"><span>Job {Number(view?.jobIndex || 0) + 1} / {view?.jobs?.length || 3}</span><h1>{objective}</h1><p>{interaction}</p></header>
      <div className="game-stats"><span><Clock3 size={16}/>{seconds(view?.deadlineRemaining)}</span><span><CircleDollarSign size={16}/>{wallet}</span><button aria-label="Pause" onClick={() => command("TOGGLE_PAUSE")}><Pause size={17}/></button></div>
      <Minimap view={view}/>
      <div className="context-actions"><button disabled={!movement.canInteract} onClick={() => command("MOUNT_ACTION")}><Bike size={17}/>{movement.mode === "ride" ? "Dismount" : "Mount"}<kbd>E</kbd></button><button className="package" disabled={!view?.canPackageAction} onClick={() => command("PACKAGE_ACTION")}><Package size={17}/>{phase === "pickup" ? "Collect" : "Deliver"}<kbd>F</kbd></button></div>
      <div className="touch-controls"><div><Hold label="Turn left" axis="turn" value={1} movement={setMovement}><ChevronLeft/></Hold><Hold label="Turn right" axis="turn" value={-1} movement={setMovement}><ChevronRight/></Hold></div><div><Hold label="Move backward or brake" axis="forward" value={-1} movement={setMovement}><ChevronDown/></Hold><Hold label="Move forward" axis="forward" value={1} movement={setMovement}><ChevronUp/></Hold></div></div>
    </>}
    {ready && !error && !activePaused && phase === "job_complete" && <section className="result"><span>Delivery complete</span><h2>Nice work.</h2><p>You earned {job.reward ?? job.payout ?? 0}. Shift total: {view?.shiftEarnings || 0}.</p><button className="primary" onClick={() => command("NEXT_JOB")}>Next job</button></section>}
    {ready && !error && !activePaused && phase === "job_failed" && <section className="result"><span>Delivery missed</span><h2>Try that run again.</h2><p>{view?.message || "The order ran out of time."}</p><button className="primary" onClick={() => command("RETRY_JOB")}>Retry job</button><button onClick={returnToMenu}>Return to menu</button></section>}
    {ready && !error && !activePaused && phase === "results" && <section className="result"><span>Shift complete</span><h2>{view?.completedJobIds?.length || 0} deliveries finished</h2><p>You earned {view?.shiftEarnings || 0} this shift.</p><button className="primary" onClick={returnToMenu}>Return to menu</button></section>}
    {ready && !error && activePaused && <section className="pause-menu"><h2>Shift paused</h2><button className="primary" onClick={() => command("TOGGLE_PAUSE")}><Play size={17}/> Resume</button><button onClick={() => openOverlay(setSettings)}><Settings size={17}/> Settings</button><button onClick={() => openOverlay(setHelp)}><HelpCircle size={17}/> Controls</button><button onClick={recover}><RotateCcw size={17}/> Restart this delivery</button><button onClick={returnToMenu}>End shift</button></section>}
    {!error && (help || settings) && <div className="modal-shade"><section ref={dialog} tabIndex={-1} onKeyDown={trapDialog} className="dialog" role="dialog" aria-modal="true" aria-label={help ? "Game controls" : "Street settings"}><button className="close" aria-label="Close" onClick={closeOverlay}><X/></button>{help ? <><h2>Controls</h2><dl><div><dt>WASD / arrows</dt><dd>Walk, steer and ride</dd></div><div><dt>E</dt><dd>Mount or dismount nearby</dd></div><div><dt>F</dt><dd>Collect or deliver in a marker</dd></div><div><dt>Escape</dt><dd>Pause the shift</dd></div></dl></> : <><h2>Street settings</h2>{[["Light", "phase", ["Sunny", "Dusk", "Night"]], ["Weather", "weather", ["Clear", "Rain"]], ["Wind", "wind", ["Calm", "Breeze", "Strong"]]].map(([label, key, options]) => <label key={key}>{label}<select value={visuals[key]} onChange={(event) => { const next = { ...visuals, [key]: event.target.value }; setVisuals(next); game.current?.setSettings(next); }}>{options.map((option) => <option key={option}>{option}</option>)}</select></label>)}</>}</section></div>}
    {ready && !error && phase !== "menu" && <div className="corner-tools"><button aria-label="Help" onClick={() => openOverlay(setHelp)}><HelpCircle/></button></div>}
    {saveWarning && <div className="save-status" role="status">{saveWarning}</div>}
  </main>;
}
