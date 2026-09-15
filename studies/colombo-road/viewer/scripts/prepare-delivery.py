"""Extract and review the bounded delivery pilot from the existing source assets."""
import collections
import datetime
import json
import math
from pathlib import Path

from shapely.geometry import LinearRing, Point, Polygon, box, shape
from shapely.ops import substring, unary_union
from shapely.strtree import STRtree

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT/'viewer/public/delivery'
OUT.mkdir(parents=True,exist_ok=True)
network = json.loads((ROOT/'road-network.json').read_text())
context = json.loads((ROOT/'source/context.json').read_text())
scene = json.loads((ROOT/'source/prepared-scene.json').read_text())
manifest = json.loads((ROOT/'manifest.json').read_text())
roads = {r['id']:r for r in network['roads']}
nodes = {n['id']:(n['position'][0],-n['position'][2]) for n in network['nodes']}
road = roads['13884292']
source = shape(road['geometry_local_xy'])
start,end = 200,780
route = substring(source,start,end)
corridor = route.buffer(road['width_m']/2)
samples = {(round(x),round(y)):z for x,y,z in context['terrain_samples']}


def height(x,y):
    step=60; gx,gy=math.floor(x/step)*step,math.floor(y/step)*step
    fx,fy=(x-gx)/step,(y-gy)/step
    a,b,c,d=[samples[k] for k in [(gx,gy),(gx+step,gy),(gx+step,gy+step),(gx,gy+step)]]
    return ((1-fx)*a+(fx-fy)*b+fy*c if fx>=fy else (1-fy)*a+(fy-fx)*d+fx*c)+.2


# Preserve bends exactly and insert intermediate points for steering look-ahead.
distances={0.0,route.length}
distances.update(float(i) for i in range(0,math.ceil(route.length),2))
for p in route.coords:
    distances.add(route.project(Point(p)))
points=[]
for s in sorted(distances):
    x,y=route.interpolate(s).coords[0]
    points.append([round(x,5),round(height(x,y),5),round(-y,5)])

buildings=[shape(b['geometry']) for b in context['buildings']]
tree=STRtree(buildings)
overlaps=[]
for i in tree.query(corridor):
    area=buildings[i].intersection(corridor).area
    if area>.05:
        overlaps.append({'building_id':context['buildings'][i]['id'],'overlap_m2':round(area,3)})
road_mesh=scene['meshes']['roads']
triangles=[]
for f in road_mesh['faces']:
    p=Polygon([road_mesh['vertices'][i][:2] for i in f])
    if p.intersects(corridor):triangles.append(p)
coverage=unary_union(triangles)
gaps=route.difference(coverage).length
small_area=box(-520,-60,450,560)
near_roads=[r for r in network['roads'] if shape(r['geometry_local_xy']).intersects(small_area)]
ring=roads['308346186']
ring_edges=[e for e in network['edges'] if e['way_id']==ring['id']]
ring_nodes={e['from'] for e in ring_edges}|{e['to'] for e in ring_edges}
external=[e for e in network['edges'] if e['way_id']!=ring['id'] and (e['from'] in ring_nodes or e['to'] in ring_nodes)]
indegree=collections.Counter(e['to'] for e in ring_edges)
outdegree=collections.Counter(e['from'] for e in ring_edges)
ring_closed=all(indegree[k]==1 and outdegree[k]==1 for k in ring_nodes)
if ring_closed and ring_nodes:
    successors={e['from']:e['to'] for e in ring_edges}
    first=next(iter(ring_nodes));current=first;visited=set()
    while current not in visited:
        visited.add(current);current=successors[current]
    ring_closed=current==first and visited==ring_nodes
else:
    ring_closed=False
ring_line=shape(ring['geometry_local_xy'])
clockwise=not LinearRing(ring_line.coords).is_ccw
forward_edges=[e for e in network['edges'] if e['way_id']==road['id']]
expected_segments=len(list(source.coords))-1


def matches_geometry(edges,line):
    segments=list(zip(list(line.coords),list(line.coords)[1:]))
    matched=set()
    for e in edges:
        for index,(a,b) in enumerate(segments):
            if math.dist(nodes[e['from']],a)<.001 and math.dist(nodes[e['to']],b)<.001:
                matched.add(index)
    return len(edges)==len(matched)==len(segments)


direction_matches=road['direction']=='forward' and matches_geometry(forward_edges,source)
ring_matches=ring_closed and clockwise and bool(external) and matches_geometry(ring_edges,ring_line)
grade=max(abs(a[1]-b[1])/max(.00001,math.hypot(a[0]-b[0],a[2]-b[2])) for a,b in zip(points,points[1:]))
grid_bounds=route.buffer(80).bounds
grid_samples=[[x,y,z+.2] for (x,y),z in samples.items() if x%60==0 and y%60==0 and
              grid_bounds[0]-60<=x<=grid_bounds[2]+60 and grid_bounds[1]-60<=y<=grid_bounds[3]+60]
audit={
    'reviewed_at':datetime.datetime.now(datetime.timezone.utc).isoformat(),
    'scope':'Source data and exported geometry review, not a street survey',
    'osm_timestamp':manifest['osm_timestamp'],'area_roads':len(near_roads),
    'pilot_way_id':road['id'],'pilot_road':road['name'],'pilot_length_m':round(route.length,2),
    'checks':[
        {'label':'Continuous road surface','status':'pass' if gaps<.01 else 'fail','detail':f'{gaps:.3f} m of pilot centre line outside road triangles.'},
        {'label':'Building clearance','status':'pass' if not overlaps else 'fail','detail':f'{len(overlaps)} footprint overlaps above 0.05 m² in the pilot carriageway.'},
        {'label':'Recorded one-way direction','status':'pass' if direction_matches else 'fail','detail':f'{len(forward_edges)} forward graph edges match {expected_segments} source segments.'},
        {'label':'Gamini Hall roundabout graph','status':'pass' if ring_matches else 'fail','detail':f'{len(ring_edges)} edges form a clockwise ring with {len(external)} external directed connections. The delivery pilot stops short of this junction.'},
        {'label':'Bridge decks','status':'manual','detail':f'{sum(r["bridge"] for r in near_roads)} nearby bridge ways remain provisional and are outside the delivery pilot.'},
        {'label':'Road width','status':'manual','detail':f'{road["width_m"]} m, estimated from two mapped lanes. No surveyed lane or kerb geometry.'},
        {'label':'Elevation','status':'manual','detail':f'Regional terrain gives a maximum sampled grade of {grade*100:.1f}%. This is not a measured road profile.'},
        {'label':'Traffic controls','status':'manual','detail':'Source nodes cannot establish physical poles, stop lines or signal timing. No red-light fines are simulated in this pilot.'},
    ],
    'building_conflicts':overlaps,
    'geometry_changes':'None needed on the selected pilot centre line. Existing assets are preserved.',
    'references':['https://wiki.openstreetmap.org/wiki/Key:oneway','https://wiki.openstreetmap.org/wiki/Tag:junction%3Droundabout']
}
if any(c['status']=='fail' for c in audit['checks']):
    raise RuntimeError('Pilot failed structural review; fix the source before generating a playable route.')
pilot={
    'id':'lotus-delivery-01','title':'Lotus Tower delivery','roadName':road['name'],'wayId':road['id'],
    'points':points,'width':road['width_m'],'length':route.length,
    'terrain':{'step':60,'samples':grid_samples,'axes':'Samples are [east,north,height], metres'},
    'spawnDistance':30,'pickupDistance':90,'dropoffDistance':380,'laneOffset':1.25,
    'reward':100,'maxSpeedKph':45,'goalRadius':7,'stopSpeed':.8,
    'pickupLabel':'Lotus collection point','dropoffLabel':'Lakeside delivery point',
    'destinationNote':'Fictional delivery stops on a real mapped road; no association with a real business.',
    'scope':'580 m of one carriageway. Bounded driving prototype, no general road routing or traffic simulation.'
}
(OUT/'pilot.json').write_text(json.dumps(pilot,separators=(',',':'))+'\n')
(OUT/'map-review.json').write_text(json.dumps(audit,indent=2)+'\n')
print(json.dumps({'pilot_length_m':route.length,'points':len(points),'buildings_overlapping':len(overlaps),
                  'centreline_gap_m':gaps,'roundabout_closed':ring_closed,'roundabout_clockwise':clockwise}))
