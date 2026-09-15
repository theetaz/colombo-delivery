import fs from 'node:fs';

const context=JSON.parse(fs.readFileSync(new URL('../../source/context.json',import.meta.url)));
const network=JSON.parse(fs.readFileSync(new URL('../../road-network.json',import.meta.url)));
const kit=JSON.parse(fs.readFileSync(new URL('../public/streets/building-kit.manifest.json',import.meta.url)));
const targetIds=new Set(['386048812','10548351','749015601','13884292']);
const depthCenters=new Map([['heritage-shop',.57],['town-house',.345],['corner-shop',.425],['courtyard-house',.163],['mixed-use',.325],['apartment',.315]]);
const families=kit.families.map(f=>({...f,depthCenter:depthCenters.get(f.id)||0}));

function roadLines(road){const g=road.geometry_local_xy;return g.type==='LineString'?[g.coordinates]:g.coordinates;}
function roadSegments(roads){return roads.flatMap(road=>roadLines(road).flatMap(line=>line.slice(1).map((b,i)=>({a:line[i],b,road}))));}
const targetSegments=roadSegments(network.roads.filter(r=>targetIds.has(String(r.id))&&!r.tunnel));
const allSegments=roadSegments(network.roads.filter(r=>!r.tunnel));
function nearest(point,pool=targetSegments){let best=null;for(const segment of pool){const [ax,ay]=segment.a,[bx,by]=segment.b,dx=bx-ax,dy=by-ay;
  const t=Math.max(0,Math.min(1,((point[0]-ax)*dx+(point[1]-ay)*dy)/(dx*dx+dy*dy||1))),x=ax+dx*t,y=ay+dy*t,distance=Math.hypot(point[0]-x,point[1]-y);
  if(!best||distance<best.distance)best={...segment,x,y,distance};}return best;}
function hash(value){let h=2166136261;for(const c of String(value))h=Math.imul(h^c.charCodeAt(0),16777619);return h>>>0;}
function bounds(points){const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];}
function boxesOverlap(a,b,pad=0){return a[0]-pad<=b[2]&&a[2]+pad>=b[0]&&a[1]-pad<=b[3]&&a[3]+pad>=b[1];}
function orient(a,b,c){return (b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);}
function onSegment(a,b,p,e=1e-7){return Math.abs(orient(a,b,p))<=e&&p[0]>=Math.min(a[0],b[0])-e&&p[0]<=Math.max(a[0],b[0])+e&&p[1]>=Math.min(a[1],b[1])-e&&p[1]<=Math.max(a[1],b[1])+e;}
function segmentsIntersect(a,b,c,d){const x=orient(a,b,c),y=orient(a,b,d),z=orient(c,d,a),w=orient(c,d,b);return x*y<0&&z*w<0||onSegment(a,b,c)||onSegment(a,b,d)||onSegment(c,d,a)||onSegment(c,d,b);}
function pointInRing(point,ring){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const a=ring[i],b=ring[j];if(onSegment(a,b,point))return true;if((a[1]>point[1])!==(b[1]>point[1])&&point[0]<(b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;}
function pointInBuilding(point,rings){return pointInRing(point,rings[0])&&!rings.slice(1).some(r=>pointInRing(point,r));}
function polygonsIntersect(a,b){if(!boxesOverlap(bounds(a),bounds(b)))return false;for(let i=0;i<a.length;i++)for(let j=0;j<b.length;j++)if(segmentsIntersect(a[i],a[(i+1)%a.length],b[j],b[(j+1)%b.length]))return true;return pointInRing(a[0],b)||pointInRing(b[0],a);}
function pointSegmentDistance(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p[0]-a[0]-dx*t,p[1]-a[1]-dy*t);}
function polygonDistance(a,b){if(polygonsIntersect(a,b))return 0;let best=Infinity;for(const p of a)for(let i=0;i<b.length;i++)best=Math.min(best,pointSegmentDistance(p,b[i],b[(i+1)%b.length]));for(const p of b)for(let i=0;i<a.length;i++)best=Math.min(best,pointSegmentDistance(p,a[i],a[(i+1)%a.length]));return best;}
function rectangle(family,scale,yaw,center){const w=family.dimensions.width*scale,d=family.dimensions.depth*scale,right=[Math.cos(yaw),Math.sin(yaw)],front=[Math.sin(yaw),-Math.cos(yaw)];
  const local=[[-w/2,family.depthCenter*scale-d/2],[w/2,family.depthCenter*scale-d/2],[w/2,family.depthCenter*scale+d/2],[-w/2,family.depthCenter*scale+d/2]];
  return local.map(([r,f])=>[center[0]+right[0]*r+front[0]*f,center[1]+right[1]*r+front[1]*f]);}
function fittedRootCenter(ring,family,scale,yaw){const right=[Math.cos(yaw),Math.sin(yaw)],front=[Math.sin(yaw),-Math.cos(yaw)],rp=ring.map(p=>p[0]*right[0]+p[1]*right[1]),fp=ring.map(p=>p[0]*front[0]+p[1]*front[1]);
  const middleR=(Math.min(...rp)+Math.max(...rp))/2,middleF=(Math.min(...fp)+Math.max(...fp))/2-family.depthCenter*scale;return [right[0]*middleR+front[0]*middleF,right[1]*middleR+front[1]*middleF];}
function contained(rect,rings){for(let i=0;i<4;i++)for(let n=0;n<=12;n++){const a=rect[i],b=rect[(i+1)%4],t=n/12;if(!pointInBuilding([a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t],rings))return false;}return true;}

const buildings=context.buildings.map(building=>{const rings=building.geometry?.coordinates?.map(r=>r.slice(0,-1));return rings?.[0]?.length>=3?{building,rings,bounds:bounds(rings[0])}:null;}).filter(Boolean);
const water=context.meshes.water,waterTriangles=water.faces.map(face=>face.map(i=>water.vertices[i].slice(0,2)));
const candidates=[];
for(const entry of buildings){const {building,rings}=entry;if(building.name||building.use==='Institutional')continue;
  const box=entry.bounds,center=[(box[0]+box[2])/2,(box[1]+box[3])/2],near=nearest(center);if(!near||near.distance<4||near.distance>25)continue;
  const yaw=Math.atan2(near.x-center[0],center[1]-near.y),choices=[];
  for(const family of families){const scale=building.height/family.dimensions.height;if(scale<.80||scale>1.20)continue;const placementCenter=fittedRootCenter(rings[0],family,scale,yaw),footprint=rectangle(family,scale,yaw,placementCenter);if(!contained(footprint,rings))continue;
    const roadHit=allSegments.some(s=>boxesOverlap(bounds(footprint),bounds([s.a,s.b]),s.road.width_m/2+.5)&&(footprint.some(p=>pointSegmentDistance(p,s.a,s.b)<s.road.width_m/2+.5)||pointInRing(s.a,footprint)||pointInRing(s.b,footprint)));
    if(roadHit||waterTriangles.some(t=>polygonsIntersect(footprint,t)))continue;
    if(buildings.some(other=>other!==entry&&boxesOverlap(bounds(footprint),other.bounds,.25)&&polygonDistance(footprint,other.rings[0])<.25))continue;
    choices.push({family,scale,footprint,center:placementCenter,fit:Math.abs(1-scale)});
  }
  if(choices.length)candidates.push({...entry,center,near,yaw,choices:choices.sort((a,b)=>a.fit-b.fit),score:near.distance+hash(building.id)%100/100});
}
const chosen=[];
for(const candidate of candidates.sort((a,b)=>a.score-b.score)){if(chosen.length>=30)break;
  const choice=candidate.choices.find(c=>!chosen.some(o=>o.choice.family.id===c.family.id&&Math.hypot(o.choice.center[0]-c.center[0],o.choice.center[1]-c.center[1])<35));if(!choice)continue;
  if(chosen.some(o=>polygonDistance(o.choice.footprint,choice.footprint)<1))continue;chosen.push({...candidate,choice});
}
const placements=chosen.map(({building,near,yaw,choice})=>({id:`dressed-${building.id}`,sourceBuildingId:String(building.id),roadId:String(near.road.id),family:choice.family.id,
  position:[+choice.center[0].toFixed(2),+building.base.toFixed(2),+(-choice.center[1]).toFixed(2)],yaw:+yaw.toFixed(4),scale:+choice.scale.toFixed(4),
  footprint:building.geometry.coordinates[0].map(([x,north])=>[+x.toFixed(2),+(-north).toFixed(2)]),
  footprintHoles:building.geometry.coordinates.slice(1).map(ring=>ring.map(([x,north])=>[+x.toFixed(2),+(-north).toFixed(2)])),
  envelope:[+(entryWidth(building)).toFixed(2),+(entryDepth(building)).toFixed(2),+building.height.toFixed(2)],palette:hash(`${building.id}:palette`)%4,scaleJitter:1}));
function entryWidth(building){const b=bounds(building.geometry.coordinates[0]);return b[2]-b[0];}function entryDepth(building){const b=bounds(building.geometry.coordinates[0]);return b[3]-b[1];}
if(placements.length<8||new Set(placements.map(p=>p.family)).size<4)throw new Error('Safe placement coverage fell below the accepted minimum.');
if(new Set(placements.map(p=>p.id)).size!==placements.length)throw new Error('Placement IDs must be unique.');
const output={schemaVersion:2,seed:'colombo-street-dress-v2-safe',targetRoadIds:[...targetIds],placements};
fs.mkdirSync(new URL('../public/streets/',import.meta.url),{recursive:true});fs.writeFileSync(new URL('../public/streets/placements.json',import.meta.url),`${JSON.stringify(output,null,2)}\n`);
console.log(`Wrote ${placements.length} placements from ${candidates.length} safe candidates across ${new Set(placements.map(p=>p.family)).size} families.`);
