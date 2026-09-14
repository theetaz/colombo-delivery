import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createRoute,createRun,advanceRun,interact,telemetry,resetCar} from './model.js';

const pilot=JSON.parse(readFileSync(new URL('../../public/delivery/pilot.json',import.meta.url)));
const route=createRoute(pilot);
const step=(state,input,count=120)=>{for(let i=0;i<count;i++)advanceRun(state,input,1/120,route);};

test('actual pilot supports a complete assisted delivery with one credit award',()=>{
  const state=createRun(route);let collected=false;
  for(let i=0;i<120*120&&state.phase!=='complete';i++){
    const t=telemetry(state,route);
    if(t.canAct){assert.equal(interact(state,route),true);if(state.phase==='dropoff')collected=true;continue;}
    const desired=Math.min(pilot.maxSpeedKph/3.6,Math.sqrt(2*6*Math.max(t.remaining-2,0)));
    advanceRun(state,{throttle:state.speed<desired-.2?1:0,brake:state.speed>desired+.2?1:0,handbrake:t.remaining<3},1/120,route);
  }
  assert.equal(collected,true);assert.equal(state.phase,'complete');assert.equal(state.credits,100);
  assert.equal(state.contacts,0);assert.ok(state.travelled>340&&state.travelled<360);
  for(let i=0;i<10;i++)assert.equal(interact(state,route),false);
  assert.equal(state.credits,100);
  const position=[state.x,state.z];step(state,{throttle:1});assert.deepEqual([state.x,state.z],position);
});

test('package interactions require the correct stop, low speed and an unpaused run',()=>{
  const state=createRun(route);
  assert.equal(interact(state,route),false);
  Object.assign(state,route.sample(pilot.dropoffDistance));assert.equal(interact(state,route),false);
  Object.assign(state,route.sample(pilot.pickupDistance),{speed:3});assert.equal(interact(state,route),false);
  state.speed=0;state.paused=true;assert.equal(interact(state,route),false);
  state.paused=false;assert.equal(interact(state,route),true);assert.equal(state.credits,0);
});

test('pause freezes the run and resuming accepts input',()=>{
  const state=createRun(route);state.paused=true;const before=structuredClone(state);
  step(state,{throttle:1,steer:1});assert.deepEqual(state,before);
  state.paused=false;step(state,{throttle:1});assert.ok(state.travelled>1);
});

test('manual steering stops at the road boundary without crossing it',()=>{
  const state=createRun(route);state.assist=false;
  for(let i=0;i<120*20&&!state.blocked;i++)advanceRun(state,{throttle:1,steer:1},1/120,route);
  assert.equal(state.blocked,'Road boundary');assert.equal(state.speed,0);assert.equal(route.blocked(state),'');
  assert.ok(state.contacts>0);
});

test('assistance stays on the carriageway up to the bounded route end',()=>{
  const state=createRun(route);
  for(let i=0;i<120*90&&!state.blocked;i++)advanceRun(state,{throttle:1},1/120,route);
  assert.equal(state.blocked,'End of test route');assert.ok(state.progress>route.length-5);
  assert.equal(route.blocked(state),'');
});

test('reset retains the package and credits but restores a safe checkpoint',()=>{
  const state=createRun(route,200);
  Object.assign(state,route.sample(pilot.pickupDistance));interact(state,route);
  state.x+=100;state.speed=8;resetCar(state,route);
  assert.equal(state.phase,'dropoff');assert.equal(state.credits,200);assert.equal(state.speed,0);
  assert.equal(route.blocked(state),'');assert.ok(state.progress>pilot.pickupDistance);
});

test('braking, reversing and wrong-way warning behave consistently',()=>{
  const state=createRun(route);step(state,{throttle:1},240);const speed=state.speed;
  step(state,{brake:1},60);assert.ok(state.speed<speed);
  step(state,{handbrake:1},120);assert.equal(state.speed,0);
  step(state,{brake:1},60);assert.ok(state.speed<-.8);assert.equal(telemetry(state,route).wrongWay,true);
});

test('non-finite timing is ignored and car speed is capped',()=>{
  const state=createRun(route);const before=structuredClone(state);
  for(const dt of [NaN,Infinity,-1,0])advanceRun(state,{throttle:1},dt,route);
  assert.deepEqual(state,before);
  step(state,{throttle:1},120*12);assert.ok(state.speed<=pilot.maxSpeedKph/3.6);
  assert.ok(Number.isFinite(state.y));assert.ok(Math.abs(route.length-580)<.01);
});
