# Colombo Delivery

Colombo Delivery is a planned browser-based 3D driving game built around real
Colombo roads and coordinates. Players collect parcels, navigate to reachable
delivery points, follow traffic rules, and earn money for vehicle upgrades.
Progression begins with a bicycle, continues through an electric bicycle and
motorbikes, and eventually unlocks cars.

Repository: [theetaz/colombo-delivery](https://github.com/theetaz/colombo-delivery)

## Project status

The local repository currently contains product and engineering documentation
only. No game runtime, map data, assets, or build tooling has been added yet.

Development happens in public. Follow the [roadmap](docs/ROADMAP.md) for planned
stages, the [development log](docs/DEVELOPMENT_LOG.md) for verified changes, and
the [main branch commit history](https://github.com/theetaz/colombo-delivery/commits/main)
for the project's implementation record.

The first playable target is a small, recognizable area around Lotus Tower. It
will include a controllable bicycle, 10–20 verified pickup and drop-off points,
one complete timed-delivery loop, saved earnings, and an electric-bicycle
upgrade. The map can then expand through connected areas of Colombo.

## Product principles

- Preserve real road geometry, names, directions, junctions, and coordinates
  where source data can be verified.
- Include the local streets needed to connect destinations, even when the main
  focus is on popular roads.
- Make safe driving compatible with delivery deadlines.
- Keep bicycle and motorbike handling approachable with assisted balance.
- Scale to a large browser map by loading nearby city sections and simplifying
  distant scenery.

## Documentation

- [Roadmap](docs/ROADMAP.md) defines the staged delivery plan and acceptance
  criteria.
- [Architecture](docs/ARCHITECTURE.md) records the proposed technical design
  and open decisions.
- [Development log](docs/DEVELOPMENT_LOG.md) records completed, verifiable
  project changes.

## Next step

Audit OpenStreetMap coverage for the selected Lotus Tower area. The audit must
check road connectivity, access and one-way restrictions, crossings, traffic
signals, roundabouts, bridges, and useful delivery entrances before map
generation begins.
