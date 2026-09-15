import { createEnvironment } from "../environment/runtime.js";
import { commandSession, createSession, restoreSession, serializeSession, sessionView, stepSession } from "./session.js";

const PHASE_ALIAS = { Day: "Sunny", Sunny: "Sunny", Dusk: "Dusk", Night: "Night" };
const ACTIVE_PHASES = new Set(["pickup", "delivery"]);

function asCommand(session, value) {
  const command = typeof value === "string" ? { type: value } : { ...value };
  return { ...command, playerId: command.playerId || session.playerId };
}

/**
 * Creates the single-player coordinator. The serializable session is the only
 * gameplay authority; the environment consumes snapshots as a visual adapter.
 */
export async function createGame(host, callbacks = {}, options = {}) {
  if (!host?.appendChild) throw new TypeError("createGame requires a host element");
  let disposed = false, inputEnabled = true, session;
  let environment = null, lastPublishedAt = -Infinity, pendingMount = false;
  try {
    session = options.session || (options.savedSession ? restoreSession(options.savedSession, options) : createSession(options));
    if (session.paused && !ACTIVE_PHASES.has(session.phase)) commandSession(session, { type: "TOGGLE_PAUSE", playerId: session.playerId });

    const publish = (force = false) => {
      const view = sessionView(session);
      const now = performance.now();
      if (force || now - lastPublishedAt >= 100) {
        lastPublishedAt = now;
        callbacks.onState?.(view);
      }
      return view;
    };
    const command = (value) => {
      if (disposed) return { accepted: false, reason: "disposed" };
      const result = commandSession(session, asCommand(session, value));
      publish(true);
      return { ...result };
    };
    const action = (code) => {
      if (!inputEnabled) return;
      if (code === "KeyE") pendingMount = true;
      else if (code === "KeyF") command("PACKAGE_ACTION");
      else if (code === "Escape") command("TOGGLE_PAUSE");
    };

    environment = await createEnvironment(host, {
      controlled: true,
      onAction: action,
      onFrame(dt, movementInput) {
        if (disposed) return sessionView(session);
        if (pendingMount) { pendingMount = false; command("VEHICLE_INTERACTION"); }
        stepSession(session, inputEnabled ? movementInput : { forward: 0, turn: 0 }, dt);
        return publish();
      },
      onReady(info) { callbacks.onReady?.({ ...info, playerId: session.playerId, sessionId: session.sessionId, view: sessionView(session) }); },
    });
    environment.follow();

    const suspend = () => {
      environment?.clearInput();
      pendingMount = false;
      if (!session.paused && ACTIVE_PHASES.has(session.phase)) command("TOGGLE_PAUSE");
    };
    const visibility = () => { if (document.hidden) suspend(); };
    window.addEventListener("blur", suspend);
    document.addEventListener("visibilitychange", visibility);
    publish(true);

    return {
      start() { return command("START_SHIFT"); },
      command,
      setMovement(input) { if (inputEnabled) environment.setMovement(input); else environment.clearInput(); },
      setInputEnabled(value) { inputEnabled = Boolean(value); environment.setInputEnabled(inputEnabled); if (!inputEnabled) pendingMount = false; return inputEnabled; },
      pause(value) { const requested = value === undefined ? !session.paused : Boolean(value); return requested === session.paused ? { accepted: true, event: requested ? "paused" : "resumed" } : command("TOGGLE_PAUSE"); },
      setSettings(settings = {}) {
        if (settings.phase) environment.setPhase(PHASE_ALIAS[settings.phase] || "Sunny");
        if (settings.weather) environment.setWeather(settings.weather);
        if (settings.wind) environment.setWind(settings.wind);
        if (Number.isFinite(settings.direction)) environment.setDirection(settings.direction);
        return environment.stats();
      },
      snapshot() { return sessionView(session); },
      serialize() { return serializeSession(session); },
      restore(value) {
        try {
          const restored = restoreSession(value, options.playerId ? { playerId: options.playerId } : {});
          if (restored.paused && !ACTIVE_PHASES.has(restored.phase)) commandSession(restored, { type: "TOGGLE_PAUSE", playerId: restored.playerId });
          session = restored; environment.clearInput(); pendingMount = false; environment.applyState(sessionView(session));
          return { ok: true, view: publish(true) };
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          callbacks.onRestoreError?.(message);
          return { ok: false, error: message };
        }
      },
      resize() { environment.resize(); },
      stats() { return { session: sessionView(session), environment: environment.stats(), inputEnabled, disposed }; },
      dispose() { if (disposed) return; disposed = true; window.removeEventListener("blur", suspend); document.removeEventListener("visibilitychange", visibility); environment.dispose(); environment = null; },
    };
  } catch (error) {
    environment?.dispose();
    callbacks.onError?.(error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export const createGameRuntime = createGame;
