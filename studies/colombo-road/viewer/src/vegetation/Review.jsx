import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Box,
  Download,
  Pause,
  Play,
  RotateCcw,
  Sun,
  Wind,
} from "lucide-react";
import { createVegetationViewer } from "./runtime.js";
import { dimensions, formatCount } from "./model.js";
export default function Review() {
  const host = useRef(null),
    viewer = useRef(null),
    [manifest, setManifest] = useState(null),
    [ready, setReady] = useState(false),
    [selected, setSelected] = useState(""),
    [mode, setMode] = useState("isolated"),
    [lod, setLod] = useState("near"),
    [wind, setWind] = useState("Breeze"),
    [paused, setPaused] = useState(false),
    [direction, setDirection] = useState(35),
    [weather, setWeather] = useState("Sunny"),
    [status, setStatus] = useState("Loading the vegetation kit…"),
    [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    createVegetationViewer(host.current, {
      onManifest: (value) => {
        if (alive) {
          setManifest(value);
          setSelected(value.assets[0]?.id || "");
        }
      },
      onStatus: (value) => alive && setStatus(value),
    })
      .then((value) => {
        if (alive) {
          viewer.current = value;
          window.__COLOMBO_VEGETATION__ = value;
          setReady(true);
        } else value.dispose();
      })
      .catch((reason) => alive && setError(reason.message));
    return () => {
      alive = false;
      delete window.__COLOMBO_VEGETATION__;
      viewer.current?.dispose();
    };
  }, []);
  const asset = useMemo(
      () => manifest?.assets.find((value) => value.id === selected),
      [manifest, selected],
    ),
    size = asset && dimensions(asset.bounds);
  function choose(id) {
    setSelected(id);
    viewer.current?.select(id);
  }
  function sceneMode(value) {
    setMode(value);
    viewer.current?.setMode(value);
  }
  return (
    <div className="vegetation-shell">
      <header className="vegetation-header">
        <a href="/street-composition.html">
          <ArrowLeft size={16} /> Street composition
        </a>
        <div>
          <h1>Colombo vegetation study</h1>
          <p>Five generated sources, prepared for wind and weather review. <a href="/environment.html">See them in the playable street</a>.</p>
        </div>
        <span className="review-state">
          <i className={error ? "error" : "ready"} />
          {error ? "Needs attention" : ready ? "Ready to inspect" : "Loading"}
        </span>
      </header>
      <main className="vegetation-workspace">
        <aside className="vegetation-sidebar">
          <fieldset disabled={!ready}>
            <section>
              <h2>Asset kit</h2>
              <div className="mode-switch">
                {["isolated", "collection"].map((value) => (
                  <button
                    key={value}
                    aria-pressed={mode === value}
                    onClick={() => sceneMode(value)}
                  >
                    {value === "isolated" ? "Isolated" : "Collection"}
                  </button>
                ))}
              </div>
              <div className="mode-switch" aria-label="Level of detail">
                {["near", "distance"].map((value) => (
                  <button
                    key={value}
                    aria-pressed={lod === value}
                    onClick={() => {
                      setLod(value);
                      viewer.current?.setLod(value);
                    }}
                  >
                    {value === "near" ? "Near · LOD 0" : "Distance · LOD 1"}
                  </button>
                ))}
              </div>
              <div className="asset-list">
                {manifest?.assets.map((value) => (
                  <button
                    key={value.id}
                    aria-pressed={selected === value.id}
                    onClick={() => choose(value.id)}
                  >
                    <span>{value.label}</span>
                    <small>
                      {value.kind} · {value.height} m
                    </small>
                  </button>
                ))}
              </div>
            </section>
            <section>
              <h3>Camera</h3>
              <div className="control-grid">
                <button onClick={() => viewer.current?.setView("front")}>
                  Front
                </button>
                <button onClick={() => viewer.current?.setView("side")}>
                  Side
                </button>
                <button onClick={() => viewer.current?.reset()}>
                  <RotateCcw size={14} /> Reset
                </button>
              </div>
            </section>
            <section>
              <h3>
                <Wind size={15} /> Wind preview
              </h3>
              <div className="preset-row">
                {["Calm", "Breeze", "Strong"].map((value) => (
                  <button
                    key={value}
                    aria-pressed={wind === value}
                    onClick={() => {
                      setWind(value);
                      viewer.current?.setWindPreset(value);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <label className="range-label" htmlFor="direction">
                Direction <span>{direction}°</span>
              </label>
              <input
                id="direction"
                type="range"
                min="0"
                max="359"
                value={direction}
                onChange={(event) => {
                  setDirection(+event.target.value);
                  viewer.current?.setDirection(+event.target.value);
                }}
              />
              <button
                className="pause-button"
                onClick={() => {
                  const next = !paused;
                  setPaused(next);
                  viewer.current?.setWindPaused(next);
                }}
              >
                {paused ? <Play size={14} /> : <Pause size={14} />}{" "}
                {paused ? "Resume wind" : "Pause wind"}
              </button>
            </section>
            <section>
              <h3>
                <Sun size={15} /> Weather preview
              </h3>
              <div className="weather-row">
                {["Sunny", "Overcast", "Rain"].map((value) => (
                  <button
                    key={value}
                    aria-pressed={weather === value}
                    onClick={() => {
                      setWeather(value);
                      viewer.current?.setWeather(value);
                    }}
                  >
                    {value}
                  </button>
                ))}
              </div>
              <p className="fine-print">
                Visual lighting, fog, wetness and rain preview. This is not a
                physical weather simulation.
              </p>
            </section>
          </fieldset>
        </aside>
        <section className="vegetation-stage">
          <div
            ref={host}
            className="vegetation-canvas"
            aria-label="Orbitable 3D vegetation review"
          />
          <div className="stage-note">
            <strong>
              {mode === "collection"
                ? "Complete first kit"
                : asset?.label || "Vegetation"}
            </strong>
            <span>Drag to orbit · Scroll to zoom · Right-drag to pan</span>
          </div>
          {(error || !ready) && (
            <div className="loading-panel">
              <Box size={28} />
              <h2>
                {error ? "Preview could not load" : "Preparing vegetation"}
              </h2>
              <p>{error || status}</p>
            </div>
          )}
        </section>
        <aside className="vegetation-inspector">
          <h2>Asset record</h2>
          {asset ? (
            <>
              <dl>
                <dt>ID</dt>
                <dd>
                  <code>{asset.id}</code>
                </dd>
                <dt>Dimensions</dt>
                <dd>{size.map((value) => value.toFixed(2)).join(" × ")} m</dd>
                <dt>Triangles</dt>
                <dd>
                  {formatCount(asset.triangleCount)} <span>LOD 0</span>
                </dd>
                <dt>LOD 1</dt>
                <dd>{formatCount(asset.lod1TriangleCount)} triangles</dd>
                <dt>Source</dt>
                <dd>
                  {asset.source.generator} · {asset.source.filename}
                </dd>
                <dt>Wind data</dt>
                <dd>{asset.wind.attribute} · RGB masks</dd>
              </dl>
              <div className="downloads">
                <a href={asset.url} download>
                  <Download size={14} /> LOD 0 GLB
                </a>
                <a href={asset.lod1Url} download>
                  <Download size={14} /> LOD 1 GLB
                </a>
                <a href={asset.blendUrl} download>
                  <Download size={14} /> Editable Blender
                </a>
              </div>
              <p className="fine-print">
                Generated source and Blender preparation remain candidates until
                human art review. Numeric checks cover structure, scale, masks
                and export validity.
              </p>
            </>
          ) : (
            <p className="fine-print">
              Asset metadata will appear after the manifest loads.
            </p>
          )}
        </aside>
      </main>
      <footer className="vegetation-footer">
        <span>
          <i className={error ? "error" : ready ? "ready" : "loading"} />
          {error || status}
        </span>
        <span>
          Wind and weather are review controls · Street scenes unchanged
        </span>
      </footer>
    </div>
  );
}
