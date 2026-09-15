import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {WALK_STRIDE_METRES,walkTiming} from './walking.js';
import {createRiderContacts} from './rider-contacts.js';
import {createMovement,stepMovement,interact,setWalkTarget,movementStatus,OBSTACLES,MOUNT_SECONDS,smooth} from './movement-model.js';

const Y=new THREE.Vector3(0,1,0),X=new THREE.Vector3(1,0,0),TAU=Math.PI*2;
export function createMovementYard(host,onReady,onState,onError){
  let state=createMovement(),disposed=false,raf=0,last=0,report=0,ready=false,mixer,rider,bike,actions={},walkWeight=0,timeScale=1,viewportFit=1,contacts;
  const keyboard=new Set(),touch={forward:0,turn:0},scene=new THREE.Scene();
  scene.background=new THREE.Color('#e4ecea');scene.fog=new THREE.Fog('#e4ecea',35,85);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.setSize(host.clientWidth,host.clientHeight);
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.domElement.setAttribute('aria-label','Walk and ride courtyard. Click the ground to walk there.');host.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(43,1,.05,120);camera.position.set(2.5,2.3,3.4);
  const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2.4;controls.maxDistance=12;controls.maxPolarAngle=Math.PI*.48;
  const focus=new THREE.Vector3(-.6,.95,.1);controls.target.copy(focus);controls.update();
  scene.add(new THREE.HemisphereLight(0xe9f4ff,0x737c64,1.8));
  const sun=new THREE.DirectionalLight(0xfff2df,3.2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.012;
  Object.assign(sun.shadow.camera,{left:-7,right:7,top:7,bottom:-7,near:.1,far:30});scene.add(sun,sun.target);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  const base=new THREE.Mesh(new THREE.PlaneGeometry(160,160),new THREE.MeshStandardMaterial({color:0xbac6af,roughness:1}));base.rotation.x=-Math.PI/2;base.position.y=-.04;scene.add(base);
  function box(w,h,d,x,y,z,color){const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),new THREE.MeshStandardMaterial({color,roughness:.85}));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;scene.add(o);return o;}
  box(28,.12,42,0,-.065,0,0xd0cbbf);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const ctx=canvas.getContext('2d'),pixels=ctx.createImageData(256,256);let seed=811;
  for(let i=0;i<pixels.data.length;i+=4){seed=(seed*1664525+1013904223)>>>0;const n=40+(seed>>>28);pixels.data[i]=n;pixels.data[i+1]=n+3;pixels.data[i+2]=n+3;pixels.data[i+3]=255;}ctx.putImageData(pixels,0,0);
  const asphalt=new THREE.CanvasTexture(canvas);asphalt.colorSpace=THREE.SRGBColorSpace;asphalt.wrapS=asphalt.wrapT=THREE.RepeatWrapping;asphalt.repeat.set(12,19);
  const pavement=new THREE.Mesh(new THREE.PlaneGeometry(24,38),new THREE.MeshStandardMaterial({map:asphalt,roughness:.98}));pavement.rotation.x=-Math.PI/2;pavement.position.y=-.002;pavement.receiveShadow=true;scene.add(pavement);
  for(let z=-16;z<=16;z+=4)box(.10,.005,1.5,0,.003,z,0xd1ccad);
  for(const x of [-11.7,11.7])box(.09,.006,37,x,.004,0,0xdfdccd);
  for(const o of OBSTACLES){
    const planter=new THREE.Mesh(new THREE.CylinderGeometry(o.r,o.r,.45,32),new THREE.MeshStandardMaterial({color:0xc5bbaa,roughness:.95}));planter.position.set(o.x,.2,o.z);planter.castShadow=true;planter.receiveShadow=true;scene.add(planter);
    box(.18,2.5,.18,o.x,1.4,o.z,0x71604b);
    const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(1.75,2),new THREE.MeshStandardMaterial({color:0x55705a,roughness:1}));leaves.position.set(o.x,3,o.z);leaves.scale.y=1.2;leaves.castShadow=true;scene.add(leaves);
  }
  const marker=new THREE.Mesh(new THREE.RingGeometry(.14,.21,32),new THREE.MeshBasicMaterial({color:0x36c9bc,transparent:true,opacity:.9,side:THREE.DoubleSide}));marker.rotation.x=-Math.PI/2;marker.position.y=.012;marker.visible=false;scene.add(marker);
  const actorRoot=new THREE.Group(),bikeRoot=new THREE.Group(),actorLean=new THREE.Group(),bikeLean=new THREE.Group();actorRoot.add(actorLean);bikeRoot.add(bikeLean);scene.add(actorRoot,bikeRoot);
  const restRotations=new Map(),frontRest=new THREE.Quaternion();
  function emit(){onState(movementStatus(state));}
  function action(name,time,weight=1){const a=actions[name];if(!a)return;a.enabled=true;a.paused=true;a.setEffectiveWeight(weight);a.time=Math.max(0,Math.min(time,a.getClip().duration));}
  function pose(dt){
    for(const a of Object.values(actions)){a.enabled=false;a.setEffectiveWeight(0);}
    const onFoot=state.mode==='foot'||state.mode==='approach';
    if(onFoot){
      walkWeight+=(Math.min(1,Math.abs(state.walkSpeed)/.8)-walkWeight)*Math.min(1,dt*12);
      action('Stand',state.clock%2,1-walkWeight);
      const timing=walkTiming(state.walkDistance/WALK_STRIDE_METRES);
      action('Walk',timing.phase*actions.Walk.getClip().duration,walkWeight);
      actorRoot.position.set(state.player.x,0,state.player.z);actorRoot.rotation.y=state.player.yaw;actorLean.rotation.z=0;actorLean.position.y=0;
      // Follow the retimed stance foot with a small, periodic body advance.
      // Fade it with walking so standing and bicycle transition poses stay put.
      actorRoot.position.x-=Math.sin(state.player.yaw)*timing.offset*walkWeight;
      actorRoot.position.z-=Math.cos(state.player.yaw)*timing.offset*walkWeight;
    }else{
      walkWeight=0;actorRoot.position.set(state.bike.x,0,state.bike.z);actorRoot.rotation.y=state.bike.yaw;
      if(state.mode==='mount')action('Mount',Math.min(state.elapsed,MOUNT_SECONDS));
      else if(state.mode==='dismount')action('Dismount',Math.min(state.elapsed,MOUNT_SECONDS));
      else action('Pedal',(((state.phase/TAU)%1)+1)%1*2);
      actorLean.rotation.z=state.lean;actorLean.position.y=.349*(1-Math.cos(state.lean));
    }
    contacts.restore();mixer.update(0);contacts.capture();
    const gripAmount=onFoot?0:state.mode==='mount'?smooth((state.elapsed/MOUNT_SECONDS-.02)/.21):state.mode==='dismount'?1-smooth((state.elapsed/MOUNT_SECONDS-.78)/.22):1;
    rider.traverse(o=>{if(o.morphTargetDictionary?.HandlebarGrip!==undefined)o.morphTargetInfluences[o.morphTargetDictionary.HandlebarGrip]=gripAmount;});
    bikeRoot.position.set(state.bike.x,0,state.bike.z);bikeRoot.rotation.y=state.bike.yaw;bikeLean.rotation.z=state.lean;bikeLean.position.y=.349*(1-Math.cos(state.lean));
    for(const name of ['FrontWheel','RearWheel'])bike.getObjectByName(name).quaternion.copy(restRotations.get(name)).multiply(new THREE.Quaternion().setFromAxisAngle(X,state.wheelAngle));
    bike.getObjectByName('Crank').rotation.x=-state.phase;
    for(const name of ['Pedal_L','Pedal_R'])bike.getObjectByName(name).rotation.x=state.phase;
    bike.getObjectByName('FrontAssembly').quaternion.copy(frontRest).multiply(new THREE.Quaternion().setFromAxisAngle(Y,state.steer));
    scene.updateMatrixWorld(true);
    if(state.mode==='ride'||state.mode==='settle')contacts.solve();
    marker.visible=Boolean(state.target);if(state.target)marker.position.set(state.target.x,.012,state.target.z);
    const distance=Math.hypot(state.player.x-state.bike.x,state.player.z-state.bike.z),weight=onFoot?.5*(1-smooth((distance-2.5)/2.5)):1;
    const target=new THREE.Vector3(state.player.x+(state.bike.x-state.player.x)*weight,1,state.player.z+(state.bike.z-state.player.z)*weight),delta=target.sub(focus).multiplyScalar(1-Math.exp(-dt*5));
    focus.add(delta);controls.target.add(delta);camera.position.add(delta);controls.update();
    sun.position.copy(focus).add(new THREE.Vector3(5,10,7));sun.target.position.copy(focus);
  }
  const loader=new GLTFLoader();
  Promise.all([loader.loadAsync('/cyclist/courier-movement.glb'),loader.loadAsync('/cyclist/bicycle-fitted.glb')]).then(([r,b])=>{
    if(disposed){release(r.scene);release(b.scene);return;}
    rider=r.scene;bike=b.scene;actorLean.add(rider);bikeLean.add(bike);mixer=new THREE.AnimationMixer(rider);
    for(const name of ['Idle','Stand','Walk','Mount','Dismount','Pedal']){const clip=r.animations.find(c=>c.name===name||c.name.endsWith('|'+name));if(!clip)throw new Error('Missing '+name+' animation');actions[name]=mixer.clipAction(clip);actions[name].play().setLoop(THREE.LoopOnce,1);actions[name].clampWhenFinished=true;actions[name].paused=true;}
    for(const root of [rider,bike])root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    for(const name of ['FrontWheel','RearWheel'])restRotations.set(name,bike.getObjectByName(name).quaternion.clone());
    frontRest.copy(bike.getObjectByName('FrontAssembly').quaternion);
    scene.updateMatrixWorld(true);
    for(const a of Object.values(actions))a.setEffectiveWeight(0);
    action('Pedal',0);mixer.update(0);scene.updateMatrixWorld(true);
    contacts=createRiderContacts(rider,bike);
    ready=true;onReady();emit();
  }).catch(e=>{if(!disposed)onError(e);});
  const axis=()=>({forward:touch.forward+(keyboard.has('KeyW')||keyboard.has('ArrowUp')?1:0)-(keyboard.has('KeyS')||keyboard.has('ArrowDown')?1:0),turn:touch.turn+(keyboard.has('KeyA')||keyboard.has('ArrowLeft')?1:0)-(keyboard.has('KeyD')||keyboard.has('ArrowRight')?1:0)});
  function clearInput(){keyboard.clear();touch.forward=touch.turn=0;}
  function pause(value){state.paused=value;clearInput();last=0;emit();}
  function reset(){state=createMovement();walkWeight=0;clearInput();emit();}
  function keydown(e){if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName))return;if(['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','KeyE','Escape','KeyR'].includes(e.code))e.preventDefault();if(e.code==='Escape'&&!e.repeat)pause(!state.paused);else if(e.code==='KeyR'&&!e.repeat)reset();else if(e.code==='KeyE'&&!e.repeat){interact(state);emit();}else keyboard.add(e.code);}
  function keyup(e){keyboard.delete(e.code);}function blur(){if(ready)pause(true);}function visibility(){if(document.hidden)blur();}
  window.addEventListener('keydown',keydown);window.addEventListener('keyup',keyup);window.addEventListener('blur',blur);document.addEventListener('visibilitychange',visibility);
  let pointer=null;
  function pointerdown(e){pointer={x:e.clientX,y:e.clientY};}
  function pointerup(e){if(!pointer||Math.hypot(e.clientX-pointer.x,e.clientY-pointer.y)>6||e.button!==0)return;pointer=null;if(!ready||state.paused||state.mode!=='foot')return;
    const rect=renderer.domElement.getBoundingClientRect(),ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2((e.clientX-rect.left)/rect.width*2-1,1-(e.clientY-rect.top)/rect.height*2),camera);
    const point=ray.ray.intersectPlane(new THREE.Plane(Y,0),new THREE.Vector3());if(point)setWalkTarget(state,point);
  }
  renderer.domElement.addEventListener('pointerdown',pointerdown);renderer.domElement.addEventListener('pointerup',pointerup);
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;const fit=Math.max(1,.95/camera.aspect);camera.position.sub(controls.target).multiplyScalar(fit/viewportFit).add(controls.target);viewportFit=fit;controls.minDistance=2.4*fit;controls.maxDistance=12*fit;camera.updateProjectionMatrix();renderer.setSize(w,h);}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function render(now){if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(ready){stepMovement(state,axis(),dt*timeScale);pose(state.paused?0:dt);if(now-report>120){emit();report=now;}}renderer.render(scene,camera);raf=requestAnimationFrame(render);}
  raf=requestAnimationFrame(render);
  function release(root){const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const t of Object.values(m))if(t?.isTexture)resources.add(t);}});for(const r of resources)r.dispose();}
  return{interact(){if(ready){interact(state);emit();}},input(axis,value){touch[axis]=value;},setSlow(value){timeScale=value ? .25 : 1;},pause,reset,
    dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();window.removeEventListener('keydown',keydown);window.removeEventListener('keyup',keyup);window.removeEventListener('blur',blur);document.removeEventListener('visibilitychange',visibility);renderer.domElement.removeEventListener('pointerdown',pointerdown);renderer.domElement.removeEventListener('pointerup',pointerup);mixer?.stopAllAction();release(scene);environment.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
