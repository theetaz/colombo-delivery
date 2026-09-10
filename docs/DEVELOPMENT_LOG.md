# Development Log

This log records completed and verifiable changes. Planned work belongs in the
roadmap.

## 2026-09-11

- Initialized the local Git repository with `main` as its initial branch.
- Created the private
  [theetaz/colombo-delivery](https://github.com/theetaz/colombo-delivery)
  GitHub repository and configured it as the local `origin` remote.
- Defined the browser-based Colombo parcel-delivery game concept and progression
  from bicycle to electric bicycle, motorbikes, and cars.
- Defined the first playable target around Lotus Tower: a bicycle, 10–20
  validated delivery points, a complete timed job, local earnings, and an
  electric-bicycle upgrade.
- Recorded the proposed rendering, physics, interface, asset, map-processing,
  routing, streaming, and save-data architecture.
- Added staged milestones with acceptance criteria.
- Identified the OpenStreetMap coverage audit as the next implementation step.
- Changed the GitHub repository visibility from private to public so development
  can be followed openly.
- Updated the README with links to the roadmap, development log, and `main`
  branch commit history for following public progress.
- Selected OSM way 728831229 as the Lotus Tower audit anchor at longitude
  79.8583149, latitude 6.9270265. Defined a 1,000 m circular core and a 500 m
  routing buffer within a 1,500 m context area.
- Recorded the Colombo Atlas reference origin separately and measured its
  approximately 0.68 m offset from the OSM anchor for later asset alignment.
- Stored the exact Overpass query, compressed response, endpoint, OSM base time,
  download time, projection parameters, element counts, and SHA-256 digests in
  a provenance manifest. The snapshot contains OSM data as of 2026-09-10
  23:11:10 UTC.
- Added a standard-library Python fetch command and a deterministic offline audit
  command. The fetch is an explicit snapshot refresh; normal reproduction uses
  the committed snapshot without network access.
- Generated separate GeoJSON layers for study areas, roads, mapped audit
  features, and graph-screened candidate endpoints, plus JSON and CSV audit
  reports.
- Measured 700 OSM highway ways and 60,253.5 m of clipped highway centreline in
  the core. Of those ways, 571 are in the motor-road subset used for lane,
  width, speed, and motor-road name coverage.
- Recorded the main evidence limits: only 5 of 700 core highway ways have an
  explicit bicycle tag, 39 have an explicit general access tag, 107 of 571
  motor-road ways have a lane count, and 10 of 571 have a width.
- Checked network structure separately from legal routing. The context graph has
  6,380 nodes in 15 undirected components, with 6,304 nodes in the largest
  component; turn restrictions and unresolved access defaults are not yet
  applied.
- Parsed 26 structurally complete turn-restriction relations, including nine in
  the core, without presenting structural completeness as real-world
  verification.
- Screened 15 candidate delivery endpoints from 67 possibilities using actual
  highway nodes, mapped direction, structural out-and-back reachability, access
  exclusions, endpoint distance, and spatial spread. Every candidate still
  requires manual access, entrance, stopping, and safety validation.
- Added offline interactive HTML and static SVG previews with road and audit
  layers, source-feature inspection, map controls, caveats, and visible OSM
  attribution.
- Added 12 regression tests for source integrity, deterministic offline audit
  outputs, geometry clipping and projection, access and direction handling,
  restriction completeness, feature classification, strict explicit-access
  lower bounds, and candidate-output invariants.
- Documented OSM data provenance, ODbL handling, attribution placement, tag
  semantics, audit definitions, findings, and remaining manual acceptance
  gates.
- Added a chronological build timeline with commit-pinned links to the project
  foundation, public progress documentation, and reproducible road-audit
  artifacts.
- Defined the next bounded engineering milestone as one inspectable browser 3D
  road slice with camera controls, real-to-local coordinate evidence, and
  explicit road-width provenance. Bicycle implementation follows its geometry
  and alignment review.
