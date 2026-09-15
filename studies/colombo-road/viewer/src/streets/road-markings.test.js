import test from 'node:test';
import assert from 'node:assert/strict';
import {deriveRoadMarkings,markingsForRoad} from './road-markings.js';

const road=(overrides={})=>({id:'r',direction:'both',lanes:2,width_m:6.4,tags:{},tunnel:false,
  geometry_local_xy:{type:'LineString',coordinates:[[0,0],[0,160]]},...overrides});

test('two-way LHT arrows use the left lane in each travel direction',()=>{
  const marks=markingsForRoad(road()),arrows=marks.filter(m=>m.type==='arrow');
  assert.ok(arrows.some(a=>a.direction==='forward'&&a.x<0));
  assert.ok(arrows.some(a=>a.direction==='reverse'&&a.x>0));
});

test('two-lane one-way creates one divider and never opposing arrows',()=>{
  const marks=markingsForRoad(road({id:'13884292',direction:'forward'}));
  assert.ok(marks.some(m=>m.type==='lane'));
  assert.ok(marks.filter(m=>m.type==='arrow').every(m=>m.direction==='forward'));
  assert.equal(marks.some(m=>m.type==='centre'),false);
});

test('reverse one-way arrows face against source geometry',()=>{
  const arrow=markingsForRoad(road({direction:'reverse',lanes:1})).find(m=>m.type==='arrow');
  assert.equal(arrow.direction,'reverse');assert.ok(arrow.tz>0);
});

test('markings leave junction clearances at both ends',()=>{
  const segments=markingsForRoad(road(),new Set(),{junctionGap:12}).filter(m=>m.a);
  assert.ok(segments.every(m=>m.from>=12&&m.to<=148));
});

test('roundabouts, tunnels, and conditional roads are skipped',()=>{
  assert.deepEqual(markingsForRoad(road(),new Set(['r'])),[]);
  assert.deepEqual(markingsForRoad(road({tunnel:true})),[]);
  assert.deepEqual(markingsForRoad(road({tags:{'lanes:conditional':'2 @ (Mo-Fr)'}})),[]);
});

test('left-hand lane stays left on each cardinal source direction',()=>{
  const cases=[[[[0,0],[0,160]],'x',-1],[[[0,0],[160,0]],'z',-1],[[[0,0],[0,-160]],'x',1],[[[0,0],[-160,0]],'z',1]];
  for(const [coordinates,axis,sign] of cases){const arrow=markingsForRoad(road({geometry_local_xy:{type:'LineString',coordinates}})).find(m=>m.type==='arrow'&&m.direction==='forward');assert.equal(Math.sign(arrow[axis]),sign);}
});

test('single-lane two-way roads do not receive a centre line',()=>{
  assert.equal(markingsForRoad(road({lanes:1,width_m:3.2})).some(m=>m.type==='centre'),false);
});

test('one-way T-junction uses distinct neighbors for an internal marking gap',()=>{
  const main=road({direction:'forward',geometry_local_xy:{type:'LineString',coordinates:[[0,0],[0,80],[0,160]]}});
  const network={roads:[main],roundabout_way_ids:[],nodes:[{id:'a',position:[0,0,0]},{id:'j',position:[0,0,-80]},{id:'b',position:[0,0,-160]},{id:'c',position:[40,0,-80]}],edges:[
    {from:'a',to:'j'},{from:'j',to:'b'},{from:'j',to:'c'}
  ]};
  const marks=deriveRoadMarkings(network,{junctionGap:9});
  assert.ok(marks.length>0);assert.ok(marks.every(mark=>{const x=mark.a?(mark.a.x+mark.b.x)/2:mark.x,z=mark.a?(mark.a.z+mark.b.z)/2:mark.z;return Math.hypot(x,z+80)>=9;}));
});
