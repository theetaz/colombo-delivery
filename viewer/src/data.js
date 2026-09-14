export const assetUrl=file=>`/assets/${file}`;
export const formatNumber=n=>new Intl.NumberFormat('en').format(n);
export const bytes=n=>n==null?'Not checked':n<1e6?`${(n/1000).toFixed(0)} KB`:`${(n/1e6).toFixed(1)} MB`;
export const layerDefinitions=[
  ['roads','Roads','#555f66'],['buildings','Buildings','#cdc5b4'],
  ['terrain','Terrain','#aeb595'],['water','Water','#77adbf'],
  ['parks','Green spaces','#749865'],['railPaths','Rail & paths','#a6a0b1'],
  ['tower','Lotus Tower','#ae4598'],['markers','Control markers','#eb9c31']
];
export const defaultLayers=Object.fromEntries(layerDefinitions.map(([key])=>[key,true]));
export const reviewOptions=[['unreviewed','Not reviewed'],['accepted','Looks correct'],['issue','Needs attention']];
export const reviewSubjects=[...layerDefinitions.map(([id,label])=>({id,label})),
  {id:'graph',label:'Road network & restrictions'},{id:'exports',label:'Asset files & exports'}];
export const linesOf=road=>road.geometry_local_xy.type==='LineString'?
  [road.geometry_local_xy.coordinates]:road.geometry_local_xy.coordinates;
export function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),5000);
}
export function downloadJSON(data,name){downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),name);}
export async function loadJSON(file){
  const response=await fetch(assetUrl(file));
  if(!response.ok)throw new Error(`${file} could not load (${response.status}).`);
  return response.json();
}

// These checks report file/graph integrity only. They cannot certify geographic accuracy.
export function inspectData(network,manifest,geojson,models){
  const results=[];
  const add=(label,okay,detail)=>results.push({label,status:okay?'pass':'fail',detail});
  const nodeIds=new Set(network.nodes.map(n=>n.id));
  const roadIds=new Set(network.roads.map(r=>r.id));
  add('Unique road and node IDs',roadIds.size===network.roads.length&&nodeIds.size===network.nodes.length,
    `${roadIds.size} road IDs · ${nodeIds.size} node IDs`);
  const brokenEdges=network.edges.filter(e=>!nodeIds.has(e.from)||!nodeIds.has(e.to)||!roadIds.has(e.way_id));
  add('Graph references',brokenEdges.length===0,`${brokenEdges.length} edges reference a missing node or road`);
  const finite=p=>Array.isArray(p)&&p.length>=2&&p.every(Number.isFinite);
  const badNodes=network.nodes.filter(n=>!finite(n.position));
  const badRoads=network.roads.filter(r=>!linesOf(r).every(line=>line.length>=2&&line.every(finite)));
  add('Finite coordinates',badNodes.length===0&&badRoads.length===0,`${badNodes.length} invalid nodes · ${badRoads.length} invalid roads`);
  add('Positive edge lengths',network.edges.every(e=>Number.isFinite(e.length_m)&&e.length_m>0),
    `${network.edges.length} directed edges inspected`);
  add('Manifest road count',network.roads.length===manifest.statistics.road_ways,`${network.roads.length} ways in data; ${manifest.statistics.road_ways} declared`);
  add('GeoJSON road IDs',geojson.type==='FeatureCollection'&&geojson.features.length===roadIds.size&&
    new Set(geojson.features.map(f=>String(f.id))).size===roadIds.size&&geojson.features.every(f=>roadIds.has(String(f.id))),
    `${geojson.features?.length??0} geographic features`);
  const missingMembers=network.turn_restrictions.flatMap(r=>r.members.filter(m=>
    m.type==='way'?!roadIds.has(String(m.ref)):m.type==='node'?!nodeIds.has(String(m.ref)):false));
  results.push({label:'Restriction references',status:missingMembers.length?'warning':'pass',
    detail:`${network.turn_restrictions.length} records · ${missingMembers.length} members outside this asset. Restrictions are not enforced.`});
  for(const [key,label] of [['full','Full district GLB'],['roads','Road-only GLB']]){
    const m=models[key];
    results.push({label,status:!m?'pending':m.nonFinite?'fail':'pass',detail:m?
      `${formatNumber(m.triangles)} triangles · ${m.meshes} meshes · ${m.nonFinite} non-finite vertex components`:'Load this model to inspect its geometry.'});
  }
  results.push({label:'Geographic and driving accuracy',status:'manual',detail:'Requires your review: bridge decks, road widths, real junctions, signal positions and legal routing.'});
  return {createdAt:new Date().toISOString(),scope:'Structural integrity only',results};
}
