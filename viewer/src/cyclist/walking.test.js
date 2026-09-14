import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationMixer,Quaternion,Vector3} from 'three';
import {loadGeometry} from './test-assets.js';
import {WALK_STRIDE_METRES,WALK_SPEED_METRES_PER_SECOND,walkTiming,walkClockPhase} from './walking.js';

async function sampler(name){
  const model=await loadGeometry('courier-movement.glb'),mixer=new AnimationMixer(model.scene);
  const action=mixer.clipAction(model.animations.find(c=>c.name===name)).play();action.paused=true;
  const point=name=>model.scene.getObjectByName(name).getWorldPosition(new Vector3());
  const rotation=name=>model.scene.getObjectByName(name).getWorldQuaternion(new Quaternion()).normalize();
  const flexion=(a,b,c)=>180-point(a).sub(point(b)).angleTo(point(c).sub(point(b)))*180/Math.PI;
  return{point,rotation,flexion,pose(t){action.time=t;mixer.update(0);model.scene.updateMatrixWorld(true);}};
}

test('walking extends the support knee, bends the swing knee, and keeps the trunk upright',async()=>{
  const s=await sampler('Walk');let peak=0;
  for(let i=0;i<100;i++){
    const t=i/100;s.pose(t);
    const trunk=s.point('Head').sub(s.point('Pelvis'));
    assert.ok(trunk.angleTo(new Vector3(0,1,0))*180/Math.PI<4,'torso leans out of upright alignment');
    for(const side of ['L','R']){
      const p=(t+(side==='R'?.5:0))%1,knee=s.flexion('Thigh_'+side,'Shin_'+side,'Foot_'+side);
      if(p<.04)assert.ok(knee<18,'heel contact stays crouched');
      if(p>=.27&&p<=.34)assert.ok(knee<15,'support knee never extends');
      if(p>=.7&&p<=.85)peak=Math.max(peak,knee);
    }
  }
  assert.ok(peak>50&&peak<72,'swing knee does not flex enough for a relaxed clearance step');
  const stand=await sampler('Stand');stand.pose(0);
  for(const side of ['L','R'])assert.ok(stand.flexion('Thigh_'+side,'Shin_'+side,'Foot_'+side)<12,'standing remains crouched');
});

test('arms counter the opposite step with soft elbows and stable wrists',async()=>{
  const s=await sampler('Walk'),baseline={};let low=Infinity,high=-Infinity,back=-Infinity,front=Infinity;
  for(let i=0;i<=100;i++){
    s.pose(i/100);
    for(const side of ['L','R']){
      const elbow=s.flexion('UpperArm_'+side,'Forearm_'+side,'Hand_'+side);
      assert.ok(elbow>=5&&elbow<=24,'elbow pumps or locks instead of hanging loosely');
      const relative=s.rotation('Forearm_'+side).invert().multiply(s.rotation('Hand_'+side)).normalize();
      baseline[side]??=relative.clone();
      assert.ok(baseline[side].angleTo(relative)*180/Math.PI<5,'wrist rotates independently of the forearm');
    }
    const wrist=s.point('Hand_L');low=Math.min(low,wrist.y);high=Math.max(high,wrist.y);front=Math.min(front,wrist.z);back=Math.max(back,wrist.z);
  }
  assert.ok(high-low>.02,'wrist is still pinned to a horizontal line');
  assert.ok(back-front>.22,'arm has no pendulum swing');
  s.pose(0);
  assert.ok(s.point('Foot_L').z<s.point('Foot_R').z,'left heel should lead at contact');
  assert.ok(s.point('Hand_R').z<s.point('Hand_L').z,'right hand should lead with the left foot');
});

test('the planted ankle has no false reversal and the terminal knee releases smoothly',async()=>{
  const s=await sampler('Walk');let previousFoot=-Infinity,previousKnee=Infinity;
  for(let i=0;i<=480;i++){
    const t=i/480;s.pose(t);
    const knee=s.flexion('Thigh_L','Shin_L','Foot_L');
    assert.ok(knee>4,'leg reaches its lockout and snaps back');
    if(t<=.55){
      const z=s.point('Foot_L').z;
      assert.ok(z>=previousFoot-.0001,'planted ankle reverses direction during push-off');previousFoot=z;
    }
    if(t>=.90){
      assert.ok(knee<=previousKnee+.05,'terminal swing brakes and bends back before contact');previousKnee=knee;
    }
  }
});

test('walking joint velocity is continuous at exported keys and across the loop',async()=>{
  const s=await sampler('Walk'),epsilon=.00001;
  function angle(t){s.pose((t%1+1)%1);return s.flexion('Thigh_L','Shin_L','Foot_L');}
  // Sample physical joint motion rather than just checking interpolation labels.
  for(let i=0;i<96;i++){
    const t=i/96,center=angle(t),incoming=(center-angle(t-epsilon))/epsilon,outgoing=(angle(t+epsilon)-center)/epsilon;
    assert.ok(Math.abs(outgoing-incoming)<3,`knee velocity jumps at phase ${t}`);
  }
});

test('step handoffs take less time without holding, skipping, or changing the cycle duration',()=>{
  const contactWindow=walkClockPhase(.10)+1-walkClockPhase(.90);
  assert.ok(contactWindow<.175,'the handoff still dwells for the previous 20% of a cycle');
  for(const fps of [24,60,144])for(const speed of [1,.25,-1]){
    const increment=WALK_SPEED_METRES_PER_SECOND*speed/fps/WALK_STRIDE_METRES;
    let cycle=.97,previous=walkTiming(cycle);
    for(let frame=0;frame<fps*8;frame++){
      cycle+=increment;const next=walkTiming(cycle);
      const advance=increment+(next.offset-previous.offset)/WALK_STRIDE_METRES;
      assert.ok(advance/increment>.74&&advance/increment<1.26,'loop holds or jumps between frames');
      const expected=((previous.phase+advance)%1+1)%1;
      assert.ok(Math.abs(next.phase-expected)<1e-10,'loop discards elapsed time at its boundary');
      previous=next;
    }
  }
  for(const pose of [0,.1,.3,.54,.75,1]){
    assert.ok(Math.abs(walkTiming(walkClockPhase(pose)).phase-(pose%1))<1e-9,'inspection button changes its named pose');
  }
  for(const cycle of [-1.2,0,.37,1.1]){
    const a=walkTiming(cycle),b=walkTiming(cycle+1);
    assert.ok(Math.abs(a.phase-b.phase)<1e-12&&Math.abs(a.offset-b.offset)<1e-12,'cadence drifts between cycles');
  }
});

test('retimed walking keeps both planted feet still relative to the ground',async()=>{
  const s=await sampler('Walk');
  for(const side of ['L','R'])for(const lap of [-1,0,1]){
    const shift=side==='L'?0:.5;
    const from=walkClockPhase(.12+shift)+lap,to=walkClockPhase(.32+shift)+lap;
    let planted;
    for(let i=0;i<=60;i++){
      const cycle=from+(to-from)*i/60,timing=walkTiming(cycle);s.pose(timing.phase);
      const foot=s.point('Foot_'+side);foot.z-=cycle*WALK_STRIDE_METRES+timing.offset;
      planted??=foot.clone();
      assert.ok(foot.distanceTo(planted)<.005,'timing adjustment makes the support foot slide');
    }
  }
});

test('retimed legs keep their velocity through consecutive step and cycle joins',async()=>{
  const s=await sampler('Walk'),epsilon=.00001;
  function points(cycle){
    const timing=walkTiming(cycle);s.pose(timing.phase);
    return ['Shin_L','Foot_L','Shin_R','Foot_R'].map(name=>{
      const p=s.point(name);p.z-=cycle*WALK_STRIDE_METRES+timing.offset;return p;
    });
  }
  for(const join of [-.5,0,.5,1,1.5]){
    const before=points(join-epsilon),center=points(join),after=points(join+epsilon);
    for(let i=0;i<center.length;i++){
      const incoming=center[i].clone().sub(before[i]).divideScalar(epsilon);
      const outgoing=after[i].clone().sub(center[i]).divideScalar(epsilon);
      assert.ok(incoming.distanceTo(outgoing)<.02,'leg velocity breaks at the joined step');
    }
  }
});
