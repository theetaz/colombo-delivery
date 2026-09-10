# Build Timeline

This is the chronological public record of how Colombo Delivery is being built.
Each completed milestone links to the exact Git commit that delivered it, so its
documents, data, and previews remain inspectable even as the current project
changes.

## 2026-09-11 — Project foundation

Status: complete.

The project began with a browser-based 3D parcel-delivery game concept set on
real Colombo roads. The first playable scope was defined around Lotus Tower,
starting with a bicycle and one complete delivery loop before expanding to more
vehicles and areas. The proposed architecture established TypeScript, Vite,
Three.js, and metre-based local world coordinates as the initial technical
direction.

Delivered in commit
[`d18705e664cee4aaec2a9fda5d79135f917494d9`](https://github.com/theetaz/colombo-delivery/commit/d18705e664cee4aaec2a9fda5d79135f917494d9):

- [Original project definition](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/README.md)
- [Proposed architecture](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/docs/ARCHITECTURE.md)
- [Initial staged roadmap](https://github.com/theetaz/colombo-delivery/blob/d18705e664cee4aaec2a9fda5d79135f917494d9/docs/ROADMAP.md)

## 2026-09-11 — Public progress record

Status: complete.

The repository was made public and its documentation was connected to the
public commit history. This established the roadmap and development log as the
places to follow planned work and verified outcomes.

Delivered in commit
[`4f67ed18e069091a062d607cec795d10bfb8f84e`](https://github.com/theetaz/colombo-delivery/commit/4f67ed18e069091a062d607cec795d10bfb8f84e):

- [Public-facing README](https://github.com/theetaz/colombo-delivery/blob/4f67ed18e069091a062d607cec795d10bfb8f84e/README.md)
- [Development log at this milestone](https://github.com/theetaz/colombo-delivery/blob/4f67ed18e069091a062d607cec795d10bfb8f84e/docs/DEVELOPMENT_LOG.md)

## 2026-09-11 — Reproducible Lotus Tower road audit

Status: desk audit delivered; Stage 1 field checks remain open.

The first real map-data slice captured a fixed OpenStreetMap snapshot around
Lotus Tower and added a deterministic offline audit. It measures road geometry,
mapped directions and access evidence, structural connectivity, relevant map
features, and data gaps. It also screens 15 provisional delivery endpoints.
Those candidates and the illustrative route remain unverified for current
bicycle access, entrances, legal stopping, junction movements, and street
conditions.

Delivered in commit
[`01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac`](https://github.com/theetaz/colombo-delivery/commit/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac):

- [Audit report](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/MAP_DATA_AUDIT.md)
- [Snapshot provenance](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/osm/manifest.json)
- [Generated road geometry](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/derived/road_network.geojson)
- [Machine-readable audit results](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data/audit/audit_summary.json)
- [All saved data artifacts](https://github.com/theetaz/colombo-delivery/tree/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/data)
- [Interactive audit preview source](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.html)
- [Static audit preview](https://github.com/theetaz/colombo-delivery/blob/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.svg)

![Stage 1 Lotus Tower road audit at the delivery commit](https://raw.githubusercontent.com/theetaz/colombo-delivery/01c3ec2e8bc8bfaa490b6f2e34c6a25252f7aeac/docs/maps/lotus-tower-road-audit.svg)

Validation measured 700 core `highway=*` ways, 23 mapped traffic-signal
nodes, and 15 graph-screened candidate endpoints. All 12 tests passed, and
offline regeneration produced outputs identical to the committed artifacts.

## Current state

The repository contains the product definition and Stage 1 audit pipeline. It
does not yet contain a browser game or 3D runtime. The normal current static
preview is [the repository SVG](maps/lotus-tower-road-audit.svg); unlike the
commit-pinned image above, that relative link follows the current checkout.

The interactive preview is an offline HTML artifact, not a hosted game. GitHub
shows its source. To inspect the current checkout, run this from the repository
root:

```sh
python3 -m http.server 4173 --bind 127.0.0.1 --directory docs/maps
```

Then open
[http://127.0.0.1:4173/lotus-tower-road-audit.html](http://127.0.0.1:4173/lotus-tower-road-audit.html).
That address works only while the local server is running.

## Next bounded milestone — First 3D road slice

Build one small browser-rendered road section from the committed audited
geometry using the proposed Vite, TypeScript, and Three.js stack. The slice is
complete when someone can inspect it in a desktop browser and:

- orbit, pan, and zoom the camera around the road;
- see the source longitude and latitude alongside the local metre coordinates
  used by the scene;
- verify coordinate alignment against the recorded Lotus Tower origin;
- trace every rendered centreline back to the audited GeoJSON feature; and
- inspect the exact road-width rule used for each segment, distinguishing a
  source `width` value from a lane-derived or road-class fallback.

This milestone validates the map-to-3D coordinate and road-width pipeline. The
first controllable bicycle follows after the road geometry and alignment pass
this review.

Future completed milestones will be appended here in delivery order with their
date, outcome, preview or artifacts, validation, remaining limitations, and
implementation commit. Artifact links will use that commit hash rather than a
moving branch link.
