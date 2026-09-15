import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {AnimationMixer,Vector3} from 'three';
import {loadGeometry} from './test-assets.js';

test('transition work preserves the approved walking, standing and pedaling tracks',async()=>{
  const model=await loadGeometry('courier-movement.glb');
  // Fingerprints of the accepted 705a404 animation data, before this study.
  const approved={Walk:'edc86342d028f00671a36490f0f6c7c35dcbe0c66e3b700d6abc284628ecaf8a',
    Stand:'fade26bd35f55c320853e007164808e991d358661830df4e4f5ceed5f9edfc1f',
    Pedal:'11764c52c968865c2b870c0386a7c07814974a8f9753c39bbab7d64b32cf17dd'};
  for(const [name,fingerprint] of Object.entries(approved)){
    const clip=model.animations.find(c=>c.name===name);
    const data=JSON.stringify(clip.tracks.map(t=>[t.name,Array.from(t.times),Array.from(t.values)]));
    assert.equal(createHash('sha256').update(data).digest('hex'),fingerprint,`${name} changed during transition work`);
  }
});

test('ground and grip contacts hold continuously until the support transfer',async()=>{
  const model=await loadGeometry('courier-movement.glb'),mixer=new AnimationMixer(model.scene);
  const point=name=>model.scene.getObjectByName(name).getWorldPosition(new Vector3());
  for(const name of ['Mount','Dismount']){
    mixer.stopAllAction();const action=mixer.clipAction(model.animations.find(c=>c.name===name)).play();action.paused=true;
    function pose(p){action.time=p*3.5;mixer.update(0);model.scene.updateMatrixWorld(true);}
    for(let i=0;i<=106;i++){
      const p=.23+i*.005;pose(p);
      assert.ok(point('Foot_L').distanceTo(new Vector3(-.38,.11648,-.02))<.002,`${name} slides/lifts the support foot at ${p}`);
      for(const [side,sign] of [['L',-1],['R',1]])
        assert.ok(point('Hand_'+side).distanceTo(new Vector3(sign*.287,1.037,-.26))<.002,`${name} loses ${side} grip before the leg has landed at ${p}`);
    }
    for(let i=0;i<=40;i++){
      const p=(name==='Mount'?.82:.76)+i*(name==='Mount'?.18:.24)/40;pose(p);
      const target=name==='Mount'?new Vector3(.0728,.41548,.0558):new Vector3(-.495,.11648,.2);
      assert.ok(point('Foot_R').distanceTo(target)<.002,`${name} loses the new right-foot support at ${p}`);
    }
    // Include the seated pose blend, where repeated parent transforms used
    // to pull the hands away even though both clips had matching endpoints.
    for(let i=0;i<=200;i++){
      const p=name==='Mount'?.23+i*.77/200:i*.78/200;pose(p);
      for(const [side,sign] of [['L',-1],['R',1]])
        assert.ok(point('Hand_'+side).distanceTo(new Vector3(sign*.287,1.037,-.26))<.002,`${name} loses ${side} grip during the seated blend at ${p}`);
    }
  }
});

test('transition joints move continuously through subframe keys without stepping',async()=>{
  const model=await loadGeometry('courier-movement.glb'),mixer=new AnimationMixer(model.scene),h=.00001;
  const names=['Pelvis','Shin_R','Foot_R','Hand_R'];
  for(const name of ['Mount','Dismount']){
    mixer.stopAllAction();const clip=model.animations.find(c=>c.name===name),action=mixer.clipAction(clip).play();action.paused=true;
    assert.equal(clip.tracks[0].times.length,337);
    function pose(t){action.time=t;mixer.update(0);model.scene.updateMatrixWorld(true);return names.map(n=>model.scene.getObjectByName(n).getWorldPosition(new Vector3()));}
    for(const t of clip.tracks[0].times.slice(1,-1)){
      const before=pose(t-h),at=pose(t),after=pose(t+h);
      for(let j=0;j<names.length;j++){
        const incoming=at[j].clone().sub(before[j]).divideScalar(h),outgoing=after[j].sub(at[j]).divideScalar(h);
        assert.ok(incoming.distanceTo(outgoing)<.03,`${name} ${names[j]} changes velocity abruptly at ${t}`);
      }
    }
  }
});
