export const LIMITS={x:13,z:20};
export const OBSTACLES=[{x:-8,z:-12,r:1.6},{x:8,z:-12,r:1.6},{x:-8,z:12,r:1.6},{x:8,z:12,r:1.6}];
export const MOUNT_SECONDS=3.5;
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);};
export const angleDelta=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));
export function localPoint(b,x,z){return{x:b.x+x*Math.cos(b.yaw)+z*Math.sin(b.yaw),z:b.z-x*Math.sin(b.yaw)+z*Math.cos(b.yaw)};}
export function clearAt(p,r=.34,context){if(context?.clearAt)return context.clearAt(p,r);return Math.abs(p.x)<LIMITS.x-r&&Math.abs(p.z)<LIMITS.z-r&&OBSTACLES.every(o=>Math.hypot(p.x-o.x,p.z-o.z)>o.r+r);}
export function mountSpot(s){return localPoint(s.bike,-.6,.2);}
export function canMount(s){
  const p=mountSpot(s),dx=s.player.x-s.bike.x,dz=s.player.z-s.bike.z;
  return s.mode==='foot'&&Math.hypot(s.player.x-p.x,s.player.z-p.z)<1.15&&dx*Math.cos(s.bike.yaw)-dz*Math.sin(s.bike.yaw)<-.25&&clearAt(p,.4,s.context);
}
export function createMovement(context){const state={mode:'foot',player:{x:-1.5,z:.75,yaw:-1.05},bike:{x:0,z:0,yaw:0},speed:0,walkSpeed:0,walkDistance:0,phase:0,wheelAngle:0,steer:0,lean:0,clock:0,elapsed:0,paused:false,target:null,blocked:false,transition:null};if(context)state.context=context;return state;}
export function interact(s){
  if(s.paused)return false;
  if(canMount(s)){
    const target=mountSpot(s),distance=Math.hypot(target.x-s.player.x,target.z-s.player.z);
    s.mode='approach';s.elapsed=0;s.target=null;s.transition={from:{...s.player},target,duration:Math.max(.35,distance/1.0)};return true;
  }
  if(s.mode==='ride'&&Math.abs(s.speed)<.3&&clearAt(mountSpot(s),.42,s.context)){
    s.mode='settle';s.elapsed=0;s.speed=0;s.transition={phase:s.phase,target:Math.round(s.phase/(Math.PI*2))*Math.PI*2};return true;
  }
  return false;
}
export function setWalkTarget(s,p){if(s.mode==='foot'&&clearAt(p,.34,s.context)){s.target={x:p.x,z:p.z};return true;}return false;}
function walkClear(s,p){
  if(!clearAt(p,.34,s.context))return false;
  return [-.55,0,.55].every(z=>{const b=localPoint(s.bike,0,z);return Math.hypot(p.x-b.x,p.z-b.z)>.47;});
}
export function stepMovement(s,input,seconds){
  if(s.paused||!Number.isFinite(seconds)||seconds<=0)return;
  const dt=Math.min(seconds,.05);s.clock+=dt;s.elapsed+=dt;s.blocked=false;
  let forward=clamp(input.forward||0,-1,1),turn=clamp(input.turn||0,-1,1);
  if(s.mode==='foot'){
    if(forward||turn)s.target=null;
    if(s.target){
      const dx=s.target.x-s.player.x,dz=s.target.z-s.player.z,d=Math.hypot(dx,dz);
      if(d<.08){s.target=null;}else{
        const goal=Math.atan2(-dx,-dz),error=angleDelta(s.player.yaw,goal);
        s.player.yaw+=clamp(error,-dt*3.5,dt*3.5);forward=Math.max(0,1-Math.abs(error)/1.2)*Math.min(1,d/.3);turn=0;
      }
    }
    s.player.yaw+=turn*dt*2.2;
    const desired=forward*1.35;s.walkSpeed+=(desired-s.walkSpeed)*Math.min(1,dt*9);
    const delta=s.walkSpeed*dt,p={x:s.player.x-Math.sin(s.player.yaw)*delta,z:s.player.z-Math.cos(s.player.yaw)*delta};
    if(walkClear(s,p)){s.player.x=p.x;s.player.z=p.z;s.walkDistance+=delta;}
    else{s.walkSpeed=0;s.target=null;s.blocked=true;}
  }else if(s.mode==='approach'){
    const t=s.transition,u=clamp(s.elapsed/t.duration,0,1),v=smooth(u),before={...s.player};
    const p={x:t.from.x+(t.target.x-t.from.x)*v,z:t.from.z+(t.target.z-t.from.z)*v};
    if(!walkClear(s,p)){s.mode='foot';s.walkSpeed=0;s.blocked=true;return;}
    Object.assign(s.player,p);s.player.yaw=t.from.yaw+angleDelta(t.from.yaw,s.bike.yaw)*v;
    const distance=Math.hypot(s.player.x-before.x,s.player.z-before.z);s.walkDistance+=distance;s.walkSpeed=distance/dt;
    if(s.elapsed>t.duration+.25){s.mode='mount';s.elapsed=0;s.walkSpeed=0;s.phase=0;}
  }else if(s.mode==='mount'){
    if(s.elapsed>=MOUNT_SECONDS){s.mode='ride';s.elapsed=0;s.phase=0;}
  }else if(s.mode==='ride'){
    if(forward<0&&!s.brakeHeld)s.brakeOnly=s.speed>0;
    s.brakeHeld=forward<0;
    if(forward>0)s.speed+=forward*1.65*dt;
    else if(forward<0)s.speed=s.brakeOnly?Math.max(0,s.speed-4.2*dt):s.speed-4.2*dt;
    else s.speed*=Math.exp(-.30*dt);
    s.speed=clamp(s.speed,-.65,6);
    const steeringLimit=.52-.025*Math.abs(s.speed);
    s.steer+=(turn*steeringLimit-s.steer)*Math.min(1,dt*6);
    const yaw=s.bike.yaw+s.speed/1.093*Math.tan(s.steer)*dt;
    const p={x:s.bike.x-Math.sin(yaw)*s.speed*dt,z:s.bike.z-Math.cos(yaw)*s.speed*dt};
    if(clearAt(p,1.05,s.context)){
      Object.assign(s.bike,p,{yaw});s.wheelAngle-=s.speed*dt/.349;
      if(forward>0&&s.speed>0)s.phase+=s.speed*dt/(.349*2.8);
    }else{s.speed=0;s.blocked=true;}
    const bank=clamp(Math.atan(s.speed*s.speed*Math.tan(s.steer)/(1.093*9.81)),-.20,.20);
    s.lean+=(bank-s.lean)*Math.min(1,dt*5);
  }else if(s.mode==='settle'){
    const t=smooth(s.elapsed/.45);s.phase=s.transition.phase+(s.transition.target-s.transition.phase)*t;s.lean*=Math.exp(-dt*15);s.steer*=Math.exp(-dt*15);
    if(t===1){s.phase=0;s.steer=0;s.lean=0;s.mode='dismount';s.elapsed=0;}
  }else if(s.mode==='dismount'&&s.elapsed>=MOUNT_SECONDS){
    Object.assign(s.player,mountSpot(s),{yaw:s.bike.yaw});s.mode='foot';s.elapsed=0;s.walkSpeed=0;s.target=null;
  }
}
export function movementStatus(s){
  const labels={foot:'On foot',approach:'Approaching bicycle',mount:'Getting on',ride:'Riding',settle:'Putting pedals in position',dismount:'Getting off'};
  const near=canMount(s),canGetOff=s.mode==='ride'&&Math.abs(s.speed)<.3&&clearAt(mountSpot(s),.42,s.context);
  let hint=s.mode==='foot'?(near?'Press E to get on':'Walk to the left side of the bicycle'):s.mode==='ride'?(canGetOff?'Press E to get off':Math.abs(s.speed)>=.3?'Brake to a stop before getting off':'Move away from the edge to get off'):'Let the movement finish';
  if(s.blocked)hint='Path blocked · turn away or roll back';
  return{mode:s.mode,label:labels[s.mode],speed:Math.round(Math.abs(s.mode==='ride'?s.speed:s.walkSpeed)*3.6),distance:Math.hypot(s.player.x-s.bike.x,s.player.z-s.bike.z).toFixed(1),canInteract:near||canGetOff,hint,paused:s.paused};
}
