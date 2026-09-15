import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {createRoute,createRun,advanceRun,telemetry,interact,resetCar,goalFor} from './model.js';

export function createDeliveryRuntime({scene,camera,controls,renderer,invalidate,onUpdate}){
  const group=new THREE.Group();group.visible=false;scene.add(group);
  let state=null,route=null,car=null,loaded=null,active=false,cameraMode='chase';
  let last=0,accumulator=0,lastHud=0,environment=null,previousEnvironment=null,previousFov=42;
  const keys=new Set(),touch={throttle:0,brake:0,steer:0,handbrake:0},wheels=[];
  const reviewLabel=renderer.domElement.getAttribute('aria-label');
  let goal=null,routeLine=null,contactShadow=null,disposed=false;
  const clearInput=()=>{keys.clear();Object.keys(touch).forEach(k=>touch[k]=0);};
  const notify=()=>{if(state)onUpdate({...telemetry(state,route),active,cameraMode});};

  async function load(){
    const response=await fetch('/delivery/pilot.json');
    if(!response.ok)throw new Error('The reviewed delivery route could not load.');
    const data=await response.json();
    const loader=new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const gltf=await loader.loadAsync('/delivery/car.glb');
    if(disposed){release(gltf.scene);return;}
    route=createRoute(data);car=gltf.scene;group.add(car);
    car.traverse(o=>{if(!o.isMesh)return;
      for(const m of Array.isArray(o.material)?o.material:[o.material]){
        if(m.name==='Glass'){m.transmission=0;m.transparent=true;m.opacity=.5;m.depthWrite=false;}
        if(m.name==='Nelum burgundy clearcoat'){m.roughness=.35;m.metalness=.5;}
      }
    });
    for(const code of ['FL','FR','RL','RR'])wheels.push({pivot:car.getObjectByName(`Wheel_${code}`),spin:car.getObjectByName(`Spin_${code}`),front:code[0]==='F'});
    const dashes=[];
    for(let distance=0;distance<route.length;distance+=4){
      const a=route.sample(distance),b=route.sample(Math.min(distance+2,route.length));
      const length=Math.hypot(b.x-a.x,b.z-a.z),dx=(b.z-a.z)/length*.1,dz=-(b.x-a.x)/length*.1;
      const corners=[[a.x+dx,a.y+.07,a.z+dz],[a.x-dx,a.y+.07,a.z-dz],[b.x-dx,b.y+.07,b.z-dz],[b.x+dx,b.y+.07,b.z+dz]];
      for(const i of [0,1,2,0,2,3])dashes.push(...corners[i]);
    }
    const guide=new THREE.BufferGeometry();guide.setAttribute('position',new THREE.Float32BufferAttribute(dashes,3));
    routeLine=new THREE.Mesh(guide,new THREE.MeshBasicMaterial({color:0x08c4c4,side:THREE.DoubleSide}));
    group.add(routeLine);
    goal=new THREE.Group();group.add(goal);
    const frame=new THREE.Mesh(new THREE.TorusGeometry(2.4,.08,8,48),new THREE.MeshBasicMaterial({color:0xf1af36,depthTest:false}));
    frame.rotation.x=-Math.PI/2;frame.renderOrder=5;goal.add(frame);
    const pole=new THREE.Mesh(new THREE.CylinderGeometry(.025,.025,4,6),new THREE.MeshBasicMaterial({color:0xf1af36}));
    pole.position.y=2;goal.add(pole);
    const parcel=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.7),new THREE.MeshStandardMaterial({color:0xdba950,roughness:.8}));
    parcel.position.y=4.2;goal.add(parcel);
    contactShadow=new THREE.Mesh(new THREE.CircleGeometry(1,32),new THREE.MeshBasicMaterial({color:0x15252c,transparent:true,opacity:.2,depthWrite:false}));
    contactShadow.rotation.x=-Math.PI/2;contactShadow.scale.set(1.3,2.5,1);group.add(contactShadow);
    const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer);
    environment=pmrem.fromScene(room).texture;room.dispose();pmrem.dispose();
  }
  function updateCar(){
    car.position.set(state.x,state.y,state.z);
    const f=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw));
    const front=route.height(state.x+f.x*1.325,state.z+f.z*1.325)??state.y;
    const rear=route.height(state.x-f.x*1.325,state.z-f.z*1.325)??state.y;
    car.rotation.order='YXZ';car.rotation.set(Math.atan2(front-rear,2.65),state.yaw,0);
    for(const wheel of wheels){if(wheel.front&&wheel.pivot)wheel.pivot.rotation.y=state.steer;if(wheel.spin)wheel.spin.rotation.x=-state.wheelAngle;}
    contactShadow.position.set(state.x,state.y+.025,state.z);contactShadow.rotation.z=-state.yaw;
    const target=goalFor(state,route);goal.position.set(target.x,target.y+.1,target.z);goal.visible=state.phase!=='complete';
    const delivered=state.phase==='dropoff';
    for(const child of goal.children)if(child.material)child.material.color.set(delivered?0x0ca4b2:0xe4a632);
  }
  function follow(dt,snap=false){
    if(!state)return;
    const forward=new THREE.Vector3(-Math.sin(state.yaw),0,-Math.cos(state.yaw)),p=new THREE.Vector3(state.x,state.y,state.z);
    const target=p.clone().addScaledVector(forward,cameraMode==='chase'?6:10).add(new THREE.Vector3(0,1.1,0));
    const narrow=camera.aspect<.8;
    const position=cameraMode==='chase'?p.clone().addScaledVector(forward,narrow?-11:-8.5).add(new THREE.Vector3(0,narrow?5.5:4,0)):
      p.clone().addScaledVector(forward,-12).add(new THREE.Vector3(0,65,0));
    const blend=snap?1:1-Math.exp(-7*dt);camera.position.lerp(position,blend);camera.lookAt(target);
  }
  function pause(value){if(!state)return;state.paused=value;clearInput();last=0;accumulator=0;notify();invalidate();}
  function action(){if(!active)return;interact(state,route);updateCar();notify();invalidate();}
  function reset(){if(!active)return;resetCar(state,route);clearInput();updateCar();follow(1,true);notify();invalidate();}
  function keyDown(event){
    if(!active||event.target.closest?.('input,textarea,select'))return;
    if(event.target.closest?.('button')&&['Space','Enter'].includes(event.code))return;
    if(['KeyW','KeyS','KeyA','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','KeyR','Escape'].includes(event.code))event.preventDefault();
    if(event.code==='Escape'&&!event.repeat){pause(!state.paused);return;}
    if(state.paused)return;
    if(event.code==='KeyE'&&!event.repeat){action();return;}
    if(event.code==='KeyR'&&!event.repeat){reset();return;}
    keys.add(event.code);
  }
  function keyUp(event){keys.delete(event.code);}
  function blur(){if(active)pause(true);}
  function visibility(){if(document.hidden)blur();}
  window.addEventListener('keydown',keyDown);window.addEventListener('keyup',keyUp);
  window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  function release(root){
    const resources=new Set();root.traverse(o=>{
      if(o.geometry)resources.add(o.geometry);
      for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}
    });for(const r of resources)r.dispose();
  }
  return {
    get active(){return active;},
    get paused(){return state?.paused;},
    get animating(){return active&&!state?.paused&&state?.phase!=='complete';},
    async start(){
      loaded??=load().catch(error=>{loaded=null;throw error;});await loaded;if(disposed)return;
      if(!state)state=createRun(route);
      previousEnvironment=scene.environment;previousFov=camera.fov;scene.environment=environment;
      active=true;state.paused=false;group.visible=true;controls.enabled=false;clearInput();last=0;
      camera.fov=65;camera.updateProjectionMatrix();updateCar();follow(1,true);notify();invalidate();
      renderer.domElement.setAttribute('aria-label','Colombo delivery driving view. W accelerates, S brakes or reverses, A and D steer, Space handbrakes, E collects or delivers, R resets, Escape pauses.');
      renderer.domElement.focus({preventScroll:true});
    },
    stop(){if(!active)return;active=false;group.visible=false;clearInput();controls.enabled=true;
      scene.environment=previousEnvironment;camera.fov=previousFov;camera.updateProjectionMatrix();renderer.domElement.setAttribute('aria-label',reviewLabel);notify();invalidate();},
    tick(now){
      if(!active)return;
      const dt=last?Math.min((now-last)/1000,.1):0;last=now;
      if(!state.paused){
        accumulator+=dt;
        const input={throttle:Math.max(touch.throttle,keys.has('KeyW')||keys.has('ArrowUp')?1:0),
          brake:Math.max(touch.brake,keys.has('KeyS')||keys.has('ArrowDown')?1:0),
          steer:touch.steer+(keys.has('KeyA')||keys.has('ArrowLeft')?1:0)-(keys.has('KeyD')||keys.has('ArrowRight')?1:0),
          handbrake:touch.handbrake||keys.has('Space')};
        while(accumulator>=1/120){advanceRun(state,input,1/120,route);accumulator-=1/120;}
        updateCar();follow(dt);
      }
      if(now-lastHud>100){lastHud=now;notify();}
    },
    action,reset,pause,
    setInput(key,value){if(active&&!state.paused)touch[key]=value;},
    setAssist(value){if(state){state.assist=value;notify();}},
    setCamera(value){cameraMode=value;follow(1,true);notify();invalidate();},
    restart(){if(!state)return;state=createRun(route,state.credits,state.deliveryNumber+1);clearInput();updateCar();follow(1,true);notify();invalidate();},
    dispose(){this.stop();disposed=true;window.removeEventListener('keydown',keyDown);window.removeEventListener('keyup',keyUp);
      window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);
      scene.remove(group);release(group);environment?.dispose();}
  };
}
