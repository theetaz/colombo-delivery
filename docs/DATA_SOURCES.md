# Data Sources, Provenance, and Licensing

## OpenStreetMap road data

The Stage 1 audit uses an offline extract of OpenStreetMap (OSM) data around
Lotus Tower. The exact Overpass query, endpoint, response timestamp, source data
timestamp, study bounds, and SHA-256 digest are recorded in
`data/osm/manifest.json`. Keeping the raw compressed response and its manifest
allows later results to be traced to one immutable input even as OSM changes.

OpenStreetMap data is made available by the OpenStreetMap Foundation under the
[Open Data Commons Open Database License 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
The [OSM copyright page](https://www.openstreetmap.org/copyright) summarizes the
credit and share-alike requirements. The OSM Foundation's
[attribution guideline](https://osmfoundation.org/wiki/Licence/Attribution_Guidelines)
explains how it expects attribution to appear for databases, interactive maps,
static images, routing, and computer games.

For this repository:

- The raw OSM snapshot and data derived from it remain OSM-derived database
  material and are provided under the ODbL. The manifest and this document sit
  beside those files as their source and licence notice.
- Audit tables and GeoJSON that reproduce or transform OSM facts are treated as
  OSM-derived data. Publishing them here provides a downloadable copy and the
  scripts provide the reproducible transformation.
- A rendered map, screenshot, or game scene is treated as a produced work for
  this project's current planning. It may have a separate licence, but public
  use still needs clear OSM attribution. This classification should be checked
  again if the stored data model or sources change.
- Public interactive maps and the eventual game should show a legible
  `© OpenStreetMap contributors` credit near the map or scene, linked to the
  OSM copyright page. Static exports should carry the same credit beside the
  image. An About or Data Licences view should keep the source and ODbL link
  easy to find.
- Code, original art, and other independently authored material do not become
  ODbL data merely because the game uses OSM. Keep independently sourced data
  separable and record its provenance before combining it with routing data.

These are the project's operating rules based on OSMF's published guidance,
not legal advice. The ODbL legal text controls, and any uncertain redistribution
case should be checked before release.

## How OSM tags are interpreted

The audit records mapped evidence and gaps; it does not certify current law,
street safety, or physical conditions.

- [`highway=*`](https://wiki.openstreetmap.org/wiki/Key:highway) identifies a
  road, street, path, or related feature. Its road values primarily describe
  function and importance, not guaranteed physical dimensions or legal class.
- [`lanes=*`](https://wiki.openstreetmap.org/wiki/Key:lanes) is the total number
  of lanes available to motorised traffic. It is not a street count and does
  not establish lane width. Directional lane tags and `width=*` are separate
  evidence.
- [`access=*`](https://wiki.openstreetmap.org/wiki/Key:access) is hierarchical.
  A more specific mode tag such as `bicycle=*` overrides a broader `vehicle=*`
  or `access=*` value for that mode. Missing access tags require a
  jurisdiction-aware default and therefore remain assumptions in this audit.
- [`oneway=*`](https://wiki.openstreetmap.org/wiki/Key:oneway) follows the OSM
  way direction for `yes` and the reverse for `-1`. A roundabout normally
  implies one-way travel. [`oneway:bicycle=*`](https://wiki.openstreetmap.org/wiki/Key:oneway:bicycle)
  and explicit contraflow cycleway tags can override the general rule for
  bicycles.
- A [`type=restriction`](https://wiki.openstreetmap.org/wiki/Relation:restriction)
  relation connects `from`, `via`, and `to` members. `no_*` relations prohibit
  the represented movement; `only_*` relations allow that movement and prohibit
  the alternatives. Mode-specific `restriction:bicycle=*`, `except=bicycle`,
  and conditional tags can change bicycle routing. A count of restriction
  relations is not proof that every legal or physically necessary turn rule is
  mapped.
- [`highway=traffic_signals`](https://wiki.openstreetmap.org/wiki/Tag:highway%3Dtraffic_signals)
  records that a way or junction is signal-controlled. OSM's mapping is an
  abstraction and complex junctions can use several layouts. A signal node by
  itself does not provide a verified phase plan, timing, stop-line position, or
  every controlled approach. Game signals need an explicit authored control
  plan and must not be described as real Colombo timings without further
  evidence.

## Other data and assets

No Colombo Atlas asset or third-party imagery is part of the Stage 1 snapshot.
Before importing any later source, record its owner, original URL or repository,
version or retrieval date, licence, required attribution, and any conversion.
Do not infer permission from public availability.
