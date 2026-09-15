// Metre-scale arcade driving and delivery rules, independent of rendering.
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const toward=(v,target,step)=>v<target?Math.min(target,v+step):Math.max(target,v-step);
const angle=v=>Math.atan2(Math.sin(v),Math.cos(v));

export function createRoute(data){
  const segments=[];let length=0;
  for(let i=1;i<data.points.length;i++){
    const a=data.points[i-1],b=data.points[i],dx=b[0]-a[0],dz=b[2]-a[2],len=Math.hypot(dx,dz);
    if(len<.0001)continue;
    segments.push({a,b,dx,dz,len,start:length});length+=len;
  }
  const samples=new Map(data.terrain.samples.map(([x,n,h])=>[`${x},${n}`,h]));
  function height(x,z){
    const north=-z,s=data.terrain.step,gx=Math.floor(x/s)*s,gy=Math.floor(north/s)*s;
    const fx=(x-gx)/s,fy=(north-gy)/s;
    const [a,b,c,d]=[[gx,gy],[gx+s,gy],[gx+s,gy+s],[gx,gy+s]].map(p=>samples.get(p.join(',')));
    if([a,b,c,d].some(v=>v===undefined))return null;
    return fx>=fy?(1-fx)*a+(fx-fy)*b+fy*c:(1-fy)*a+(fy-fx)*d+fx*c;
  }
  function sample(distance,offset=data.laneOffset){
    const s=clamp(distance,0,length),seg=segments.find(p=>s<=p.start+p.len)||segments.at(-1),t=clamp((s-seg.start)/seg.len,0,1);
    const x=seg.a[0]+seg.dx*t+seg.dz/seg.len*offset,z=seg.a[2]+seg.dz*t-seg.dx/seg.len*offset;
    return {x,z,y:height(x,z)??seg.a[1],yaw:Math.atan2(-seg.dx,-seg.dz),distance:s};
  }
  function locate(x,z){
    let best={distance:Infinity,progress:0,yaw:0};
    for(const s of segments){
      const t=clamp(((x-s.a[0])*s.dx+(z-s.a[2])*s.dz)/(s.len*s.len),0,1);
      const d=Math.hypot(x-s.a[0]-t*s.dx,z-s.a[2]-t*s.dz);
      if(d<best.distance)best={distance:d,progress:s.start+s.len*t,yaw:Math.atan2(-s.dx,-s.dz)};
    }
    return best;
  }
  function blocked(car){
    const forward=[-Math.sin(car.yaw),-Math.cos(car.yaw)],right=[Math.cos(car.yaw),-Math.sin(car.yaw)];
    for(const longitudinal of [-2.2,2.2])for(const lateral of [-.99,.99]){
      const p=locate(car.x+forward[0]*longitudinal+right[0]*lateral,car.z+forward[1]*longitudinal+right[1]*lateral);
      if(p.distance>data.width/2-.08)return p.progress<3||p.progress>length-3?'End of test route':'Road boundary';
    }
    return height(car.x,car.z)===null?'Outside terrain coverage':'';
  }
  return {data,segments,length,height,sample,locate,blocked};
}

export function createRun(route,credits=0,deliveryNumber=1){
  return {...route.sample(route.data.spawnDistance),speed:0,steer:0,wheelAngle:0,progress:route.data.spawnDistance,
    travelled:0,phase:'pickup',credits,deliveryNumber,paused:false,assist:true,blocked:'',contacts:0,message:'',elapsed:0};
}
export function goalFor(state,route){
  return route.sample(state.phase==='pickup'?route.data.pickupDistance:route.data.dropoffDistance);
}
export function telemetry(state,route){
  const goal=goalFor(state,route),distance=Math.hypot(state.x-goal.x,state.z-goal.z);
  const canAct=!state.paused&&state.phase!=='complete'&&distance<=route.data.goalRadius&&Math.abs(state.speed)<=route.data.stopSpeed;
  const heading=state.yaw+(state.speed<0?Math.PI:0);
  const wrongWay=Math.abs(angle(heading-route.locate(state.x,state.z).yaw))>Math.PI*.65&&Math.abs(state.speed)>.8;
  return {phase:state.phase,credits:state.credits,speedKph:Math.abs(state.speed)*3.6,remaining:distance,
    progress:state.progress,canAct,paused:state.paused,assist:state.assist,blocked:state.blocked,contacts:state.contacts,
    message:state.message,wrongWay,travelled:state.travelled,deliveryNumber:state.deliveryNumber,
    position:[state.x,state.y,state.z],yaw:state.yaw};
}
export function interact(state,route){
  if(state.phase==='complete')return false;
  if(!telemetry(state,route).canAct){state.message='Stop inside the marked zone to continue.';return false;}
  if(state.phase==='pickup'){state.phase='dropoff';state.message='Package collected. Follow the route to the delivery point.';}
  else {state.phase='complete';state.credits+=route.data.reward;state.speed=0;state.message=`Delivery complete. ${route.data.reward} credits earned.`;}
  return true;
}
export function resetCar(state,route){
  if(state.phase==='complete')return;
  Object.assign(state,route.sample(state.phase==='pickup'?route.data.spawnDistance:route.data.pickupDistance+12),
    {speed:0,steer:0,blocked:'',message:'Car returned to the last checkpoint.'});
  state.progress=state.distance;
}
export function advanceRun(state,input,dt,route){
  if(state.paused||state.phase==='complete'||!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,1/30);state.elapsed+=dt;
  const gas=clamp(input.throttle||0,0,1),brake=clamp(input.brake||0,0,1);
  if(input.handbrake)state.speed=toward(state.speed,0,14*dt);
  else if(brake)state.speed=state.speed>.2?Math.max(0,state.speed-9*dt):Math.max(-3,state.speed-3*dt);
  else if(gas)state.speed=Math.min(route.data.maxSpeedKph/3.6,state.speed+(state.speed<0?8:4)*dt);
  else state.speed=toward(state.speed,0,(.65+.005*state.speed*state.speed)*dt);
  let steerInput=clamp(input.steer||0,-1,1);
  if(state.assist&&Math.abs(steerInput)<.001&&state.speed>=0){
    const ahead=route.sample(state.progress+8+state.speed*.65);
    const desired=Math.atan2(-(ahead.x-state.x),-(ahead.z-state.z));
    steerInput=clamp(angle(desired-state.yaw)*2.8,-1,1);
  }
  const maxSteer=.5/(1+(Math.abs(state.speed)/16)**2);
  state.steer+=(steerInput*maxSteer-state.steer)*(1-Math.exp(-10*dt));
  const yaw=state.yaw+state.speed/2.65*Math.tan(state.steer)*dt;
  const next={x:state.x-Math.sin(yaw)*state.speed*dt,z:state.z-Math.cos(yaw)*state.speed*dt,yaw};
  const blocked=route.blocked(next);
  if(blocked){if(!state.blocked)state.contacts++;state.speed=0;state.blocked=blocked;return;}
  state.blocked='';state.travelled+=Math.hypot(next.x-state.x,next.z-state.z);
  Object.assign(state,next);state.y=route.height(state.x,state.z);state.progress=route.locate(state.x,state.z).progress;
  state.wheelAngle+=state.speed*dt/.36;
}
