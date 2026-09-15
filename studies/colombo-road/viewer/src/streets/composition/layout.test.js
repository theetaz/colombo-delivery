import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {SLICE,architecturePlacements,landscapePlacements,placementZoneAt,drivewayCenters} from './layout.js';

const architectureManifest=JSON.parse(readFileSync(new URL('../../../public/streets/composition/architecture.manifest.json',import.meta.url),'utf8'));

test('street keeps two usable traffic lanes and continuous pavements',()=>{
  assert.equal(SLICE.road.zMax-SLICE.road.zMin,8);
  assert.ok(SLICE.southWalk.zMax-SLICE.southWalk.zMin>=2.4);
  assert.ok(SLICE.northWalk.zMax-SLICE.northWalk.zMin>=2.4);
  assert.ok(SLICE.xMax-SLICE.xMin>=160);
});

test('driveway cuts are bounded, separated and span the south pavement',()=>{
  for(let index=0;index<drivewayCenters.length;index++){
    const x=drivewayCenters[index];assert.ok(x-2>SLICE.xMin&&x+2<SLICE.xMax);
    if(index)assert.ok(x-drivewayCenters[index-1]>4);
  }
});

test('architecture stays on land and clear of road and pavements',()=>{
  const families=new Map(architectureManifest.families.map(item=>[item.nodeName,item]));
  for(const item of architecturePlacements){
    const actual=placementZoneAt(item.position);
    assert.notEqual(actual,'water',item.id);
    assert.notEqual(actual,'road',item.id);
    assert.notEqual(actual,'pavement',item.id);
    assert.equal(actual,item.zone,item.id);
    const bounds=families.get(item.prefab).bounds;
    const zMin=item.position[2]+(item.yaw===Math.PI?-bounds.max[2]:bounds.min[2]);
    const zMax=item.position[2]+(item.yaw===Math.PI?-bounds.min[2]:bounds.max[2]);
    if(item.position[2]<0)assert.ok(zMax<=SLICE.northWalk.zMin-.04,`${item.id} facade clears north pavement by ${SLICE.northWalk.zMin-zMax}m`);
    else assert.ok(zMin>=SLICE.southWalk.zMax+.04,`${item.id} facade clears south pavement by ${zMin-SLICE.southWalk.zMax}m`);
  }
});

test('street trees do not occupy the pedestrian clear path',()=>{
  const pits=landscapePlacements.filter(item=>item.treePit);
  assert.ok(pits.length);
  for(const item of pits){
    const z=item.position[2];
    const clearFromRoad=Math.abs(z)-(SLICE.road.zMax+.3);
    assert.ok(clearFromRoad>=1.5,`${item.id} leaves ${clearFromRoad}m`);
  }
});

test('lakeside furnishings stay on promenade and water remains free of buildings',()=>{
  for(const item of landscapePlacements.filter(item=>item.zone==='lakeside'))assert.notEqual(placementZoneAt(item.position),'water',item.id);
  assert.equal(architecturePlacements.some(item=>placementZoneAt(item.position)==='water'),false);
});

test('hardscape props use finished pavement elevations',()=>{
  for(const item of landscapePlacements.filter(item=>['StreetLamp_Civic','Railing_Promenade_2m','Bench_TimberConcrete'].includes(item.prefab)))assert.equal(item.position[1],.155,item.id);
  for(const item of landscapePlacements.filter(item=>item.prefab==='DrainGrate'))assert.ok(item.position[1]>=.15,item.id);
});
