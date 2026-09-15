"""Build a geographic road asset from the bundled source snapshot.

Requires Python 3.12+, Shapely 2.1+, and pyproj. Does not start an application.
"""
import collections
import json
import math
import re
from pathlib import Path

from pyproj import Transformer
from shapely import constrained_delaunay_triangles, make_valid
from shapely.geometry import LineString, Point, Polygon, box, mapping, shape
from shapely.ops import transform, unary_union

ROOT = Path(__file__).resolve().parents[1]
config = json.loads((ROOT / 'source/config.json').read_text())
context = json.loads((ROOT / 'source/context.json').read_text())
osm = json.loads((ROOT / 'source/osm.json').read_text())
boundary = box(*config['bounds_metres'])
project = Transformer.from_crs(4326, config['crs'], always_xy=True).transform
unproject = Transformer.from_crs(config['crs'], 4326, always_xy=True).transform
samples = {(round(x), round(y)): z for x, y, z in context['terrain_samples']}


def ground(x, y):
    step = 60
    gx, gy = math.floor(x / step) * step, math.floor(y / step) * step
    fx, fy = (x - gx) / step, (y - gy) / step
    a, b, c, d = [samples[p] for p in ((gx, gy), (gx+step, gy),
                                     (gx+step, gy+step), (gx, gy+step))]
    return (1-fx)*a + (fx-fy)*b + fy*c if fx >= fy else (1-fy)*a + (fy-fx)*d + fx*c


def parts(geometry, kind='Polygon'):
    if geometry.is_empty:
        return []
    if geometry.geom_type == kind:
        return [geometry]
    return [part for child in getattr(geometry, 'geoms', []) for part in parts(child, kind)]


def surface(geometry, offset):
    vertices, faces = [], []
    if geometry.is_empty:
        return {'vertices': vertices, 'faces': faces}
    left, bottom, right, top = geometry.bounds
    for x in range(math.floor(left/60)*60, math.ceil(right/60)*60, 60):
        for y in range(math.floor(bottom/60)*60, math.ceil(top/60)*60, 60):
            for cell in (Polygon([(x,y),(x+60,y),(x+60,y+60)]),
                         Polygon([(x,y),(x+60,y+60),(x,y+60)])):
                for poly in parts(make_valid(geometry.intersection(cell))):
                    for triangle in constrained_delaunay_triangles(poly).geoms:
                        coords = list(triangle.exterior.coords)[:3]
                        a, b, c = coords
                        if (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]) < 0:
                            coords.reverse()
                        n = len(vertices)
                        vertices.extend([[round(px,4),round(py,4),round(ground(px,py)+offset,4)] for px,py in coords])
                        faces.append([n,n+1,n+2])
    return {'vertices': vertices, 'faces': faces}


motor_highways = {'motorway','motorway_link','trunk','trunk_link','primary','primary_link',
                  'secondary','secondary_link','tertiary','tertiary_link','unclassified',
                  'residential','living_street','service','road'}
width_defaults = {'motorway':18,'trunk':16,'primary':14,'secondary':11,'tertiary':9,
                  'residential':6,'living_street':5,'service':4,'unclassified':6,'road':6}
node_sources = {str(e['id']): e for e in osm['elements'] if e['type'] == 'node'}
nodes, edges, roads, geo_features, controls = {}, [], [], [], []
surfaces = collections.defaultdict(list)


def direction(tags):
    raw = next((tags[k] for k in ('oneway:motor_vehicle','oneway:vehicle','oneway') if k in tags), None)
    if any(k.startswith('oneway') and 'conditional' in k for k in tags):
        return None, 'Conditional direction requires interpretation'
    if raw in ('yes','1','true'):
        return 'forward', 'OSM tag'
    if raw == '-1':
        return 'reverse', 'OSM tag'
    if raw in ('no','0','false'):
        return 'both', 'OSM tag'
    if raw is not None:
        return None, 'Unresolved OSM direction value'
    if tags.get('junction') == 'roundabout' or tags.get('highway') == 'motorway':
        return 'forward', 'Implied by OSM road type'
    return 'both', 'Default assumption; no direction tag'


def road_width(tags, travel):
    raw = tags.get('width','').strip()
    if re.fullmatch(r'\d+(?:\.\d+)?\s*m?', raw):
        value = float(raw.rstrip('m').strip())
        if 1 <= value <= 50:
            return value, 'OSM width'
    lanes = tags.get('lanes','')
    if lanes.isdigit() and 1 <= int(lanes) <= 12:
        return int(lanes)*3.2, 'Estimated: mapped lanes × 3.2 m'
    value = width_defaults.get(tags['highway'].removesuffix('_link'),6)
    if travel in ('forward','reverse'):
        value = max(3.5,value/2)
    return value, 'Estimated from road class and direction'


for element in osm['elements']:
    tags = element.get('tags',{})
    if element['type'] != 'way' or tags.get('highway') not in motor_highways:
        continue
    if tags.get('area') == 'yes':
        continue
    geometry = element.get('geometry',[])
    if len(geometry) < 2 or any('lon' not in p for p in geometry):
        continue
    coords = [project(p['lon'],p['lat']) for p in geometry]
    line = LineString(coords)
    clipped = line.intersection(boundary)
    if clipped.is_empty or clipped.length < .05:
        continue
    way_id = str(element['id'])
    travel, direction_source = direction(tags)
    width, width_source = road_width(tags,travel)
    access = next((tags[k] for k in ('motor_vehicle','vehicle','access') if k in tags), None)
    eligible = access in (None,'yes','permissive','designated') and travel is not None
    bridge = tags.get('bridge') not in (None,'no')
    tunnel = tags.get('tunnel') not in (None,'no')
    layer = int(tags.get('layer','0')) if re.fullmatch(r'-?\d+',tags.get('layer','0')) else 0
    group = 'bridges' if bridge else 'restricted_roads' if not eligible else 'roads'
    height_offset = 1.2 if bridge else .20
    # Underground ways remain in data; drawing them over the surface is misleading.
    if not tunnel:
        surfaces[group].append(clipped.buffer(width/2, cap_style=1, join_style=1).intersection(boundary))
    row = {'id':way_id,'name':tags.get('name'), 'names':{k:v for k,v in tags.items() if k.startswith('name:')},
           'highway':tags['highway'],'tags':tags,'width_m':round(width,2),'width_source':width_source,
           'direction':travel,'direction_source':direction_source,'access':access,
           'base_graph_eligible':eligible,'bridge':bridge,'tunnel':tunnel,'layer':layer,
           'lanes':int(tags['lanes']) if tags.get('lanes','').isdigit() else None,
           'maxspeed':tags.get('maxspeed'),'length_m':round(clipped.length,2),
           'geometry_local_xy':mapping(clipped),'surface_layer':group if not tunnel else None}
    roads.append(row)
    geo_features.append({'type':'Feature','id':way_id,'properties':{k:v for k,v in row.items() if k!='geometry_local_xy'},
                         'geometry':mapping(transform(unproject,clipped))})
    source_ids = element['nodes']
    for i,(a,b) in enumerate(zip(coords,coords[1:])):
        piece = LineString([a,b]).intersection(boundary)
        for segment in parts(piece,'LineString'):
            if segment.length < .01:
                continue
            ends = list(segment.coords)
            ids = []
            for j,p in enumerate((ends[0],ends[-1])):
                original = a if j==0 else b
                original_id = str(source_ids[i+j])
                if math.dist(p,original) < .001:
                    key = original_id
                    source_node = node_sources.get(original_id,{})
                    clipped_end = False
                else:
                    key = f'boundary:{way_id}:{i}:{j}'
                    source_node = {}
                    clipped_end = True
                # Shared OSM node IDs establish junctions. Geometric crossings do not.
                nodes[key] = {'id':key,'position':[round(p[0],4),round(ground(*p)+.20,4),round(-p[1],4)],
                              'height_status':'Regional terrain only; bridge decks unresolved',
                              'boundary':clipped_end,'tags':source_node.get('tags',{})}
                ids.append(key)
            base = {'way_id':way_id,'length_m':round(segment.length,3),'base_graph_eligible':eligible,
                    'bridge':bridge,'tunnel':tunnel,'layer':layer}
            if travel in ('both','forward'):
                edges.append({'id':f'{way_id}:{i}:f','from':ids[0],'to':ids[1],**base})
            if travel in ('both','reverse'):
                edges.append({'id':f'{way_id}:{i}:r','from':ids[1],'to':ids[0],**base})

road_ids = {r['id'] for r in roads}
restrictions = []
for element in osm['elements']:
    tags = element.get('tags',{})
    if element['type']=='relation' and tags.get('type')=='restriction':
        members = [{k:m[k] for k in ('type','ref','role')} for m in element.get('members',[])]
        if any(str(m['ref']) in road_ids for m in members if m['type']=='way'):
            restrictions.append({'id':str(element['id']),'tags':tags,'members':members,
                                 'all_way_members_in_asset':all(str(m['ref']) in road_ids for m in members if m['type']=='way'),
                                 'enforced':False})
    if element['type']!='node':
        continue
    kind = tags.get('highway')
    if kind not in ('traffic_signals','stop','give_way','mini_roundabout') and tags.get('crossing')!='traffic_signals':
        continue
    x,y = project(element['lon'],element['lat'])
    if not boundary.covers(Point(x,y)):
        continue
    controls.append({'id':str(element['id']),'kind':kind or 'signal_crossing','tags':tags,
                     'position':[round(x,4),round(ground(x,y)+.20,4),round(-y,4)],
                     'graph_node_id':str(element['id']) if str(element['id']) in nodes else None,
                     'placement':'Mapped node; marker is not a surveyed pole or stop line',
                     'timing':None,'orientation':None})

roundabouts = [r['id'] for r in roads if r['tags'].get('junction')=='roundabout']
mesh_data = dict(context['meshes'])
for group, polygons in surfaces.items():
    print('Meshing',group,len(polygons),flush=True)
    mesh_data[group] = surface(unary_union(polygons),1.2 if group=='bridges' else .20)

notes = [
    'First district asset for user testing, not all of Colombo and not a playable game.',
    'Road geometry/tags are from the bundled OpenStreetMap snapshot. Completeness and current ground conditions have not been verified.',
    'Regional terrain, water and building context reuse the 2026-09-05 city dataset. Building facades are simple placeholders.',
    'Most road widths are estimated. Lane meshes, surveyed kerbs, stop lines, street signs and signal schedules are not supplied.',
    'Bridge surfaces use a provisional terrain + 1.2 m offset. Ramps, overpass clearance and graph heights need correction before driving physics.',
    'Graph edges follow shared source node IDs and base one-way tags. Restrictions and node access/barrier tags are preserved but not enforced.',
    'Conditional direction is unresolved and excluded from the eligible base graph; vehicle-specific exceptions require runtime interpretation.',
    'Unmapped direction defaults to two-way for the base graph; this is an assumption, not verified signage.',
    'Private, destination-only and other restricted roads remain visible but are excluded from the eligible base graph.',
    'No safe spawns, reachable delivery stops, pathfinding, penalties, collisions or traffic simulation have been established.',
    'Boundary endpoints leave the study area; they are not real-world dead ends.',
    'Signal markers may sit at junction centres or approach nodes; do not use their position as a fine trigger.',
    'No browser, gameplay, performance or visual testing was performed for this handover.'
]
manifest = {'name':config['name'],'version':1,'stage':'geographic_asset_for_user_testing',
            'origin_lon_lat':config['origin'],'crs':config['crs'],'units':'metres',
            'blender_axes':'X east, Y north, Z up','gltf_and_graph_axes':'X east, Y up, Z south',
            'bounds_local_xy':config['bounds_metres'],'area_km2':boundary.area/1e6,
            'osm_timestamp':osm['osm3s']['timestamp_osm_base'],'context_snapshot':config['context_snapshot'],
            'statistics':{'road_ways':len(roads),'road_length_km':round(sum(r['length_m'] for r in roads)/1000,2),
                          'named_ways':sum(bool(r['name']) for r in roads),'distinct_road_names':len({r['name'] for r in roads if r['name']}),
                          'graph_nodes':len(nodes),'directed_edges':len(edges),'roundabout_ways':len(roundabouts),
                          'traffic_signal_nodes':sum(c['kind']=='traffic_signals' for c in controls),
                          'control_nodes':len(controls),'turn_restrictions':len(restrictions),
                          'buildings':len(context['buildings'])},
            'sources':context['metadata']['sources'],'accuracy_notes':notes,
            'assets':{'scene':'colombo-roads.glb','blender':'Colombo_Roads_v1.blend',
                      'road_surfaces':'road-surfaces.glb','road_network':'road-network.json',
                      'geographic_roads':'roads.geojson'},
            'default_camera':{'position':[700,1350,1100],'target':[-400,0,-450]},
            'tested':False}
network = {'schema_version':1,'axes':'X east, Y up, Z south','units':'metres',
           'enforces_turn_restrictions':False,'ready_for_safe_routing':False,
           'roads':roads,'nodes':list(nodes.values()),'edges':edges,'controls':controls,
           'turn_restrictions':restrictions,'roundabout_way_ids':roundabouts}
for filename,data in [('manifest.json',manifest),('road-network.json',network),
                       ('roads.geojson',{'type':'FeatureCollection','features':geo_features}),
                       ('source/prepared-scene.json',{'meshes':mesh_data,'buildings':context['buildings'],
                         'controls':controls,'tower_base_z':0.0})]:
    (ROOT/filename).write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
print('ASSET DATA CREATED',json.dumps(manifest['statistics']),flush=True)
