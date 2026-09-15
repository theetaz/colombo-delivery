import architectureManifest from '../../../public/streets/composition/architecture.manifest.json' with {type:'json'};
import landscapeManifest from '../../../public/streets/composition/landscape.manifest.json' with {type:'json'};
import trafficManifest from '../../../public/streets/composition/traffic.manifest.json' with {type:'json'};
import landmarkManifest from '../../../public/streets/composition/landmark-lod.manifest.json' with {type:'json'};
import {architecturePlacements,blocks,deliveryStops as stopDefinitions,districts,landscapePlacements,pathLightPlacements,roads} from './layout.js';

export const WORLD_ID='world:colombo-living-street-v1';
const entry=(pack,item,manifest)=>({assetId:item.assetId||item.id||item.asset,nodeName:item.nodeName||item.node||item.name,category:item.category||pack,bounds:item.bounds,dimensions:item.dimensions||item.size,pack,provenance:item.provenance||manifest.provenance||manifest.authoredWith});
const architecture=architectureManifest.families.map(item=>({...entry('architecture',item,architectureManifest),doorwayAnchors:item.doorwayAnchors||[]}));
const landscape=landscapeManifest.prefabs.map(item=>entry('landscape',item,landscapeManifest));
const traffic=trafficManifest.assets.map(item=>({...entry('traffic',item,trafficManifest),motion:item.motion}));
const landmark=[entry('landmark',landmarkManifest,landmarkManifest)];
const pathLight=[{assetId:'runtime:path-light-bollard',nodeName:'RuntimePathLightBollard',category:'lighting',pack:'runtime',dimensions:{width:.26,height:.72,depth:.26},provenance:'Original project-authored runtime geometry.'}];
const ground=[
  {assetId:'procedural:street-ground',nodeName:'RuntimeStreetGround',category:'ground',pack:'runtime',provenance:'Original project-authored procedural street geometry.'},
  {assetId:'procedural:driveway-ramp',nodeName:'RuntimeDrivewayRamp',category:'ground',pack:'runtime',provenance:'Original project-authored procedural street geometry.'},
];
export const assetCatalogue={architecture,landscape,traffic,landmark,pathLight,ground};
const flatCatalogue=Object.values(assetCatalogue).flat(),byNode=new Map(flatCatalogue.map(item=>[item.nodeName,item]));

const trafficLength=assetId=>traffic.find(item=>item.assetId===assetId)?.dimensions?.length;
export const trafficDefinitions=[
  {id:'traffic:car:01',prefabAssetId:'traffic-compact-car',prefab:'TRAFFIC_CompactCar',lane:'eastbound',startX:-80,speed:8.4,length:trafficLength('traffic-compact-car'),wheelRadius:.34},
  {id:'traffic:scooter:01',prefabAssetId:'traffic-scooter-rider',prefab:'TRAFFIC_ScooterRider',lane:'eastbound',startX:-36,speed:10.2,length:trafficLength('traffic-scooter-rider'),wheelRadius:.29},
  {id:'traffic:bicycle:01',prefabAssetId:'traffic-bicycle-rider',prefab:'TRAFFIC_BicycleRider',lane:'eastbound',startX:18,speed:5.2,length:trafficLength('traffic-bicycle-rider'),wheelRadius:.36},
  {id:'traffic:van:01',prefabAssetId:'traffic-delivery-van',prefab:'TRAFFIC_DeliveryVan',lane:'eastbound',startX:61,speed:7.1,length:trafficLength('traffic-delivery-van'),wheelRadius:.39},
  {id:'traffic:car:02',prefabAssetId:'traffic-compact-car',prefab:'TRAFFIC_CompactCar',lane:'westbound',startX:78,speed:7.8,length:trafficLength('traffic-compact-car'),wheelRadius:.34},
  {id:'traffic:scooter:02',prefabAssetId:'traffic-scooter-rider',prefab:'TRAFFIC_ScooterRider',lane:'westbound',startX:32,speed:9.4,length:trafficLength('traffic-scooter-rider'),wheelRadius:.29},
  {id:'traffic:bicycle:02',prefabAssetId:'traffic-bicycle-rider',prefab:'TRAFFIC_BicycleRider',lane:'westbound',startX:-18,speed:4.8,length:trafficLength('traffic-bicycle-rider'),wheelRadius:.36},
  {id:'traffic:van:02',prefabAssetId:'traffic-delivery-van',prefab:'TRAFFIC_DeliveryVan',lane:'westbound',startX:-67,speed:6.8,length:trafficLength('traffic-delivery-van'),wheelRadius:.39},
];

const blockFor=(position,zone)=>zone==='lakeside'?'block:north-lakeside':position[2]>0?'block:south-gardens':'block:north-shops';
const prefabRecord=(item,kind)=>({...item,kind,prefabAssetId:byNode.get(item.prefab)?.assetId,blockId:blockFor(item.position,item.zone),yaw:item.yaw||0,scale:item.scale||1});
export function transformLocalPoint(position,yaw=0,scale=1,point=[0,0,0]){const c=Math.cos(yaw),s=Math.sin(yaw),x=point[0]*scale,z=point[2]*scale;return [position[0]+x*c+z*s,position[1]+point[1]*scale,position[2]-x*s+z*c];}

function resolveStops(buildings){const buildingsById=new Map(buildings.map(item=>[item.id,item]));return stopDefinitions.map(definition=>{const building=buildingsById.get(definition.buildingId),catalogue=flatCatalogue.find(item=>item.assetId===building?.prefabAssetId),anchor=catalogue?.doorwayAnchors?.find(item=>item.id===definition.entrance.sourceAnchorId),position=anchor?transformLocalPoint(building.position,building.yaw,building.scale,anchor.position):definition.entrance.position,z=definition.approach.sidewalk==='south'?5.55:-5.55;return {...definition,entrance:{...definition.entrance,position},approach:{...definition.approach,position:[position[0],.16,z]}};});}

export function buildWorldRegistry({groundRecords}={}){
  const architectureInstances=architecturePlacements.map(item=>prefabRecord(item,item.prefab==='ARCH_GardenWallGate'?'boundary-prop':'building')),buildings=architectureInstances.filter(item=>item.kind==='building');
  const props=[...architectureInstances.filter(item=>item.kind==='boundary-prop'),...landscapePlacements.map(item=>prefabRecord(item,'prop'))];
  const lights=pathLightPlacements.map(item=>({...item,kind:'path-light',prefabAssetId:pathLight[0].assetId,blockId:blockFor(item.position,item.zone)}));
  const trafficInstances=trafficDefinitions.map(item=>({...item,kind:'traffic',roadId:roads[0].id}));
  const landmarkInstances=[{id:'landmark:lotus-tower',kind:'landmark',prefab:landmark[0].nodeName,prefabAssetId:landmark[0].assetId,position:[680,0,-880],yaw:-.22,districtId:districts[0].id}];
  const grounds=(groundRecords||[]).map(item=>({...item,prefabAssetId:item.prefabAssetId||item.assetId}));
  return {schemaVersion:2,id:WORLD_ID,scope:{description:'One authored 190 m straight Colombo street demonstration corridor',cityWide:false,source:'Project-authored composition; not an OSM road reconstruction'},assetCatalogue,districts,blocks,roads,deliveryStops:resolveStops(buildings),instances:[...grounds,...buildings,...props,...lights,...trafficInstances,...landmarkInstances]};
}

export function validateRegistry(registry=buildWorldRegistry()){
  const stops=registry.deliveryStops||[],instances=registry.instances||[],all=[registry,...(registry.districts||[]),...(registry.blocks||[]),...(registry.roads||[]),...stops,...instances,...stops.flatMap(stop=>[stop.entrance,stop.approach])],ids=all.map(item=>item?.id).filter(Boolean),errors=[];
  const duplicates=[...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))],buildings=new Map(instances.filter(item=>item.kind==='building').map(item=>[item.id,item])),roadIds=new Set((registry.roads||[]).map(item=>item.id)),districtIds=new Set((registry.districts||[]).map(item=>item.id)),blockIds=new Set((registry.blocks||[]).map(item=>item.id)),catalogue=Object.values(registry.assetCatalogue||{}).flat(),catalogueAssetIds=catalogue.map(item=>item.assetId),catalogueIds=new Set(catalogueAssetIds),duplicateAssets=[...new Set(catalogueAssetIds.filter((id,index)=>id&&catalogueAssetIds.indexOf(id)!==index))];
  if(duplicates.length)errors.push(`Duplicate IDs: ${duplicates.join(', ')}`);
  if(duplicateAssets.length)errors.push(`Duplicate catalogue asset IDs: ${duplicateAssets.join(', ')}`);
  for(const asset of catalogue){if(!asset.assetId)errors.push('Catalogue asset missing assetId');if(!asset.provenance)errors.push(`${asset.assetId||'Catalogue asset'} has no provenance`);}
  for(const block of registry.blocks||[]){if(!districtIds.has(block.districtId))errors.push(`${block.id} has unknown district ${block.districtId}`);for(const id of block.adjacentRoadIds||[])if(!roadIds.has(id))errors.push(`${block.id} has unknown road ${id}`);}
  for(const road of registry.roads||[])if(!districtIds.has(road.districtId))errors.push(`${road.id} has unknown district ${road.districtId}`);
  for(const item of instances){if(!item.id||!item.kind)errors.push('Instance missing stable ID or kind');if(!item.prefabAssetId)errors.push(`${item.id||'Instance'} has no prefabAssetId`);else if(!catalogueIds.has(item.prefabAssetId))errors.push(`${item.id} has unknown prefab asset ${item.prefabAssetId}`);if(item.blockId&&!blockIds.has(item.blockId))errors.push(`${item.id} has unknown block ${item.blockId}`);if(item.roadId&&!roadIds.has(item.roadId))errors.push(`${item.id} has unknown road ${item.roadId}`);if(item.districtId&&!districtIds.has(item.districtId))errors.push(`${item.id} has unknown district ${item.districtId}`);if(item.kind==='building'&&!item.blockId)errors.push(`${item.id} building has no block`);}
  for(const stop of stops){if(!stop.id)errors.push('Delivery stop missing ID');if(!stop.entrance?.id)errors.push(`${stop.id||'Delivery stop'} entrance missing ID`);if(!stop.approach?.id)errors.push(`${stop.id||'Delivery stop'} approach missing ID`);const building=buildings.get(stop.buildingId);if(!building){errors.push(`${stop.id} has unknown building ${stop.buildingId}`);continue;}const asset=catalogue.find(item=>item.assetId===building.prefabAssetId),anchor=asset?.doorwayAnchors?.find(item=>item.id===stop.entrance.sourceAnchorId);if(!anchor){errors.push(`${stop.id} has unknown source anchor ${stop.entrance.sourceAnchorId}`);continue;}const expected=transformLocalPoint(building.position,building.yaw,building.scale,anchor.position),distance=Math.hypot(...expected.map((value,index)=>value-stop.entrance.position[index]));if(distance>.001)errors.push(`${stop.id} entrance does not match source anchor`);const z=stop.approach.position[2],sign=stop.approach.sidewalk==='south'?1:-1;if(Math.sign(z)!==sign||Math.abs(z)<4.3||Math.abs(z)>6.7)errors.push(`${stop.id} approach is outside its ${stop.approach.sidewalk} sidewalk`);if(Math.abs(stop.approach.position[0]-stop.entrance.position[0])>.75)errors.push(`${stop.id} approach is not aligned with its entrance`);if(Math.abs(stop.entrance.position[2]-z)<.5)errors.push(`${stop.id} entrance clearance is too small`);if(Math.sign(building.position[2])!==sign)errors.push(`${stop.id} approach is on the wrong side of the road`);}
  return {valid:errors.length===0,errors,counts:{ids:ids.length,instances:new Set(instances.map(item=>item.id)).size,buildings:buildings.size,deliveryStops:stops.length,catalogueAssets:catalogueIds.size}};
}
export const registryDownload=(registry=buildWorldRegistry())=>JSON.stringify(registry,null,2)+'\n';
