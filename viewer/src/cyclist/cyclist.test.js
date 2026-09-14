import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {AnimationMixer,Vector3,Quaternion} from 'three';
import {loadGeometry} from './test-assets.js';

const directory=new URL('../../public/cyclist/',import.meta.url);


test('exported cyclist keeps both ankles at the pedal targets through a complete cycle',async()=>{
  const report=JSON.parse(await readFile(new URL('geometry-check.json',directory),'utf8'));
  const rider=await readFile(new URL('rider.glb',directory));
  assert.equal(report.riderSha256,createHash('sha256').update(rider).digest('hex'),'The Blender checks must match this exported rider');
  assert.ok(report.maxEdgeStretch[0]<4);
  const model=await loadGeometry('rider.glb'),clip=model.animations.find(a=>a.name.includes('Pedal'));
  assert.ok(clip);assert.equal(clip.duration,2);
  const mixer=new AnimationMixer(model.scene);mixer.clipAction(clip).play();
  let count=0;
  model.scene.traverse(o=>{if(!o.isSkinnedMesh)return;count++;const weights=o.geometry.attributes.skinWeight;
    for(let i=0;i<weights.count;i++)assert.ok(Math.abs(weights.getX(i)+weights.getY(i)+weights.getZ(i)+weights.getW(i)-1)<1e-5);
  });
  assert.ok(count>0);
  for(let frame=0;frame<=48;frame++){
    mixer.setTime(frame/24);model.scene.updateMatrixWorld(true);
    const phase=frame/48*Math.PI*2;
    for(const [side,sign] of [['L',-1],['R',1]]){
      const p=phase+(side==='L'?0:Math.PI),foot=model.scene.getObjectByName('Foot_'+side);
      assert.ok(foot);
      const expected=new Vector3(sign*(.112-.035*1.12),.289+.17*Math.sin(p)+.104*1.12+.010,.097+.17*Math.cos(p)+.115*1.12);
      assert.ok(foot.getWorldPosition(new Vector3()).distanceTo(expected)<.0001,`${side} loses its pedal target at frame ${frame}`);
    }
  }
});

test('bicycle fit preserves the approved source and articulated parts',async()=>{
  const original=await readFile(new URL('bicycle.glb',directory));
  assert.equal(createHash('sha256').update(original).digest('hex'),'ae38a9e2670f4e8e6a5ce1079d89bd4289b5bbc0cc83b6389038aee901c62125');
  const fitted=await loadGeometry('bicycle-fitted.glb');fitted.scene.updateMatrixWorld(true);
  for(const name of ['Crank','Pedal_L','Pedal_R','FrontWheel','RearWheel','FrontAssembly','Grip_L_Attach','Grip_R_Attach'])assert.ok(fitted.scene.getObjectByName(name),name);
  const seat=fitted.scene.getObjectByName('Seat_Attach').getWorldPosition(new Vector3());
  assert.ok(Math.abs(seat.y-.943)<.00001);
  assert.ok(Math.abs(seat.z-(.282-.08*.068/.183))<.00001);
});

test('movement clips preserve the approved rig and connect without root jumps',async()=>{
  const report=JSON.parse(await readFile(new URL('movement-check.json',directory),'utf8'));
  assert.equal(report.assetSha256,createHash('sha256').update(await readFile(new URL('courier-movement.glb',directory))).digest('hex'));
  const model=await loadGeometry('courier-movement.glb'),mixer=new AnimationMixer(model.scene);
  const clips=Object.fromEntries(model.animations.map(c=>[c.name.split('|').at(-1),c]));
  for(const [name,duration] of Object.entries({Idle:2,Walk:1,Mount:3.5,Dismount:3.5,Pedal:2}))assert.ok(Math.abs(clips[name]?.duration-duration)<.00001,name);
  function sample(name,time){mixer.stopAllAction();const a=mixer.clipAction(clips[name]);a.play();a.paused=true;a.time=time;mixer.update(0);model.scene.updateMatrixWorld(true);
    const points={};model.scene.traverse(o=>{if(o.isBone)points[o.name]=o.getWorldPosition(new Vector3());});return points;}
  function match(a,b,offset=new Vector3()){
    for(const name of Object.keys(a))assert.ok(a[name].distanceTo(b[name].clone().add(offset))<.00001,`${name} jumps between movement clips`);
  }
  match(sample('Mount',3.5),sample('Pedal',0));match(sample('Dismount',0),sample('Pedal',0));
  match(sample('Mount',0),sample('Idle',0),new Vector3(-.6,0,.2));
  match(sample('Dismount',3.5),sample('Mount',0));
  match(sample('Idle',0),sample('Idle',2));match(sample('Walk',0),sample('Walk',1));
});

test('walking plants the stance shoe and rolls from heel contact to toe push-off',async()=>{
  const model=await loadGeometry('courier-movement.glb'),mixer=new AnimationMixer(model.scene);
  const action=mixer.clipAction(model.animations.find(c=>c.name.endsWith('Walk'))).play();action.paused=true;
  const foot=model.scene.getObjectByName('Foot_L');
  function pose(time){action.time=time;mixer.update(0);model.scene.updateMatrixWorld(true);
    return {position:foot.getWorldPosition(new Vector3()).add(new Vector3(0,0,-time)),rotation:foot.getWorldQuaternion(new Quaternion()).normalize()};}
  const strike=pose(0),flat=pose(.125),late=pose(.333333),push=pose(.5416667);
  assert.ok(flat.position.distanceTo(late.position)<.005,'stance foot slides despite matched travel');
  assert.ok(strike.rotation.angleTo(flat.rotation)>.15,'heel strike has no shoe roll');
  assert.ok(push.rotation.angleTo(late.rotation)>.30,'trailing foot has no toe push-off');
  assert.ok(push.position.y>late.position.y+.055,'heel does not rise during push-off');
});
