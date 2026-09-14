import test from 'node:test';
import assert from 'node:assert/strict';
import {createMovement,stepMovement,interact,canMount,mountSpot,clearAt,setWalkTarget,LIMITS} from './movement-model.js';
function advance(s,seconds,input={}){for(let i=0;i<seconds*60;i++)stepMovement(s,input,1/60);}
test('walk, approach, mount, ride, stop, dismount and leave the parked bicycle',()=>{
  const s=createMovement();assert.ok(canMount(s));assert.ok(interact(s));assert.equal(s.mode,'approach');assert.equal(interact(s),false);
  advance(s,6);assert.equal(s.mode,'ride');advance(s,2,{forward:1,turn:.4});assert.ok(s.speed>2);assert.ok(Math.hypot(s.bike.x,s.bike.z)>2);assert.equal(interact(s),false);
  while(s.speed>.2)stepMovement(s,{forward:-1},1/60);
  assert.ok(interact(s));advance(s,5);assert.equal(s.mode,'foot');assert.deepEqual({x:s.player.x,z:s.player.z},mountSpot(s));
  const parked={...s.bike};advance(s,.8,{forward:-1});assert.deepEqual(s.bike,parked);assert.ok(Math.hypot(s.player.x-parked.x,s.player.z-parked.z)>.7);
});
test('mount requires proximity and dismount requires a clear exit',()=>{
  const s=createMovement();s.player.x=5;assert.equal(interact(s),false);s.player.x=1;assert.equal(interact(s),false);
  s.mode='ride';s.bike.x=-LIMITS.x+1.01;assert.equal(clearAt(mountSpot(s),.42),false);assert.equal(interact(s),false);
});
test('pause freezes mounting, riding and walking and bounds stop the bicycle',()=>{
  const s=createMovement();interact(s);s.paused=true;const frozen=structuredClone(s);advance(s,2,{forward:1});assert.deepEqual(s,frozen);s.paused=false;advance(s,6);advance(s,20,{forward:1});assert.ok(s.bike.z>-LIMITS.z);assert.equal(s.speed,0);
});
test('click-to-walk reaches a clear nearby point and invalid timing cannot corrupt state',()=>{
  const s=createMovement();assert.ok(setWalkTarget(s,{x:-3,z:-2}));advance(s,8);assert.ok(Math.hypot(s.player.x+3,s.player.z+2)<.15);
  const saved=structuredClone(s);stepMovement(s,{},NaN);stepMovement(s,{},Infinity);assert.deepEqual(s,saved);
});
test('holding the brake stops forward travel; a fresh press is needed to roll backward',()=>{
  const s=createMovement();s.mode='ride';s.speed=3;advance(s,2,{forward:-1});assert.equal(s.speed,0);
  advance(s,.1);advance(s,.3,{forward:-1});assert.ok(s.speed<0);
});
