# Colombo asset review page

A local Vite/React/Three.js page for inspecting the adjacent Colombo asset package.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:5175. Use Node 22.12 or newer. The development server reads
the original files from the parent directory through an explicit asset allowlist.
It does not modify the models or run either Blender script.

- **Layers:** switch between the full district and the independent road-only GLB,
  show/hide scene layers, road centre lines, the boundary and wireframe.
- **Inspect:** search roads, controls and turn restrictions by name/type/ID. Select
  a result to focus the camera. Clicking the scene also selects nearby road lines
  or mesh groups. Source properties are shown alongside your own review notes.
- **Assets:** download all package files, check availability, and explicitly run
  structural data/geometry checks. A structural pass does not certify geographic
  accuracy or legal routing. The editable .blend must be opened in Blender.
- **Drive:** try a single delivery beside Lotus Tower. Open
  http://127.0.0.1:5175/#drive, then choose **Start delivery test**.
- **Cyclist studio:** open http://127.0.0.1:5175/cyclist.html or use the link in
  the Drive panel. Inspect the textured courier, fitted bicycle, pedal cycle,
  cadence and close-up views. Download GLBs or the editable Blender assembly.
  See `../cyclist/README.md` for provenance, rebuilding and current limitations.
- **Walk & ride:** open http://127.0.0.1:5175/movement.html. Walk independently,
  approach the bicycle, mount, ride, stop, dismount and leave it parked. Keyboard,
  ground clicks and touch controls are available. See `../cyclist/MOVEMENT.md`.
- **Bicycle transitions:** open http://127.0.0.1:5175/transitions.html. Compare the
  mounting/dismounting pose sheets with the animated rider, scrub six stages,
  show joints, use quarter speed, and download the editable Blender assembly.
- **Combined street composition:** open
  http://127.0.0.1:5175/street-composition.html. Choose Garden, Shops or Lakeside,
  orbit and zoom, or start/pause the Street tour. This authored 190 m art study
  combines the selected A, B and C concepts; it has no driving controls.
  The living-street controls add Day/Dusk/Night, optional automatic time,
  wind and traffic toggles, exterior delivery-location focus and a portable
  registry export. Background vehicles follow the two left-hand lanes.
  See the [composition guide](../streets/composition/README.md) for Blender
  sources, rebuilding and the human review checklist.
- **Save view:** download the current canvas as a PNG.
- **Vegetation review:** open http://127.0.0.1:5175/vegetation-review.html.
  Inspect three generated tree candidates and two grass forms, compare wind
  strength and weather, and download the GLBs or editable Blender sources.
  This separate review leaves the street composition intact. See the
  [vegetation guide](../vegetation/README.md) for provenance and preparation.
- **Lake Garden Street:** open http://127.0.0.1:5175/environment.html.
  Explore the assembled 190 m street on foot or bicycle, compare Garden,
  Shops and Lakeside views, and test night lighting, wind and rain. Four
  fictional exterior address markers identify future delivery stops. This
  page reuses approved movement assets; its assembled appearance awaits human
  review. See the [environment guide](../../../docs/FIRST_STREET_ENVIRONMENT.md)
  and [editable asset package](../environment/README.md).
- **Export review:** download JSON with your notes, source date, camera pose,
  layer visibility and checks you ran. Notes persist in this browser's local
  storage; the export is the portable copy. Nothing is sent to a remote server.
  Exports also include the pilot route review and current delivery statistics.

Drag to orbit, scroll/pinch to zoom, and right-drag/two-finger pan. On phones,
open **Controls** to show the sidebar. The map remains a geographic blockout;
bridge heights and traffic-control placement need manual review.

`npm run build` creates a standalone `dist/` directory including the package
assets, which can be served with `npm run preview` or any static web server.
The normal build does not run asset accuracy checks or certify the map.

## First delivery pilot

The driving area is a 580 m section of the mapped, forward-only carriageway of
D. R. Wijewardene Mawatha (OSM way 13884292). Spawn is 60 m before collection;
the destination is about 290 m farther along. Both stops are fictional and do
not represent actual businesses. The test preserves the original district GLB.

Use **W / Up** to accelerate, **S / Down** to brake and then reverse, **A / D**
or the left/right arrows to steer, and **Space** for the handbrake. Steering
assistance follows the selected lane when you release the steering keys; turn
it off in the Drive panel to steer manually. Onscreen pedals and steering
buttons support touch and mouse holds. The car is capped at 45 km/h for this
test; that is a gameplay limit, not a statement of the legal speed limit.

Stop within the amber zone and press **E** or **Collect package**. Follow the
teal line, stop at the next zone, and press **E** or **Deliver package** to earn
100 credits. Collection and delivery require a speed below 3 km/h. Each run
awards credits only once. **R** restores the last checkpoint without losing the
package. **Escape** pauses, and switching away from the browser pauses
automatically. Credits accumulate across new deliveries until the page reloads;
there is no account or server persistence. Exit to return to map inspection.

This is an arcade driving test with a corridor boundary. It does not simulate
suspension, traffic, pedestrians, signals, legal turns, fines, health or driving
ratings. It cannot drive every road in the district. The road widths and terrain
elevations still need comparison with real-world references before expansion.

## Route review and rebuilding

`public/delivery/map-review.json` records checks against the local source data
and exported road triangles: continuous centre line, building-footprint
clearance, direction consistency, and a connected clockwise Gamini Hall
roundabout graph. The pilot stops short of the roundabout and excludes nearby
provisional bridges. These checks establish internal consistency, not a street
survey; signal positions, lanes and road elevations remain unverified.

To regenerate the pilot from the adjacent asset package, use Python 3 with
Shapely installed:

```sh
python3 scripts/prepare-delivery.py
npm test
npm run build
```

The extraction script produces `public/delivery/pilot.json` and
`public/delivery/map-review.json`; it does not edit the Blender file or district
models. The tests use the actual extracted route to complete the full delivery
and check credit awards, interaction requirements, pause, reset, speed, steering
and boundary behavior.

The car is adapted from **CarConcept**, Eric Chadwick / Darmstadt Graphics Group
GmbH, 2024, under CC BY 4.0. The model's source, license and modifications are
documented in `public/delivery/CAR-LICENSE.md`. Map data remains © OpenStreetMap
contributors; source and attribution are included in the parent asset package.
