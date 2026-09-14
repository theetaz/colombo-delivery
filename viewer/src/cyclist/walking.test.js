import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationMixer,Quaternion,Vector3} from 'three';
import {loadGeometry} from './test-assets.js';

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
