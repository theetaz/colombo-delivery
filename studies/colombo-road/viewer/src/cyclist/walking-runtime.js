import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {WALK_STRIDE_METRES,WALK_SPEED_METRES_PER_SECOND,walkTiming,walkClockPhase} from './walking.js';

export function createWalkingStudy(host,onReady,onPhase,onError){
  let disposed=false,raf,last=0,report=0,mixer,actions,phase=0,cycle=0,paused=false,previous=false,slow=false,angle='Side';
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e4ecea');scene.fog=new THREE.Fog('#e4ecea',10,28);
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  renderer.domElement.setAttribute('aria-label','Walking character preview. Drag to inspect the posture.');host.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(36,1,.05,60),controls=new OrbitControls(camera,renderer.domElement);controls.target.set(0,.91,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2;controls.maxDistance=7;controls.maxPolarAngle=Math.PI*.49;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0xc9d2c9,roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=-.003;ground.receiveShadow=true;scene.add(ground);
  // Moving floor references show ground travel while the camera follows the body.
  const marks=new THREE.Group();scene.add(marks);
  for(let z=-12;z<=12;z++)for(const x of [-.8,.8]){
    const mark=new THREE.Mesh(new THREE.BoxGeometry(.045,.002,.12),new THREE.MeshStandardMaterial({color:0x9cafa5,roughness:1}));mark.position.set(x,0,z);marks.add(mark);
  }
  scene.add(new THREE.HemisphereLight(0xe9f4ff,0x737c64,1.8));
  const sun=new THREE.DirectionalLight(0xfff2df,3.2);sun.position.set(3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.008;Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:18});scene.add(sun);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  function frameCamera(){
    const fit=Math.max(1,.75/camera.aspect),offset=angle==='Front'?new THREE.Vector3(0,.30,-3.4):angle==='Side'?new THREE.Vector3(-3.4,.22,0):new THREE.Vector3(2.6,.55,-2.6);
    camera.position.copy(controls.target).add(offset.multiplyScalar(fit));controls.update();
  }
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();frameCamera();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function apply(){
    if(!actions)return;
    actions.Walk.setEffectiveWeight(previous?0:1);actions.WalkBefore.setEffectiveWeight(previous?1:0);
    for(const a of Object.values(actions))a.time=phase*a.getClip().duration;
    mixer.update(0);
  }
  new GLTFLoader().loadAsync('/cyclist/courier-movement.glb').then(model=>{
    if(disposed){release(model.scene);return;}
    scene.add(model.scene);model.scene.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});mixer=new THREE.AnimationMixer(model.scene);actions={};
    for(const name of ['Walk','WalkBefore']){const clip=model.animations.find(c=>c.name===name||c.name.endsWith('|'+name));if(!clip)throw new Error('Missing '+name+' animation');const a=mixer.clipAction(clip).play();a.paused=true;actions[name]=a;}
    apply();onReady();
  }).catch(e=>{if(!disposed)onError(e);});
  function render(now){
    if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    if(actions&&!paused&&!document.hidden){
      const travel=dt*WALK_SPEED_METRES_PER_SECOND*(slow?.25:1),stride=previous?1:WALK_STRIDE_METRES;
      const beforeOffset=previous?0:walkTiming(cycle).offset;
      cycle=(cycle+travel/stride)%1;
      const timing=previous?{phase:cycle,offset:0}:walkTiming(cycle);phase=timing.phase;
      // Match floor travel to the retimed foot, including the small within-step
      // body advance, rather than letting planted shoes drift over the marks.
      marks.position.z=((marks.position.z+travel+timing.offset-beforeOffset)%1+1)%1;
    }
    apply();controls.update();renderer.render(scene,camera);if(now-report>80){onPhase(phase);report=now;}raf=requestAnimationFrame(render);
  }
  raf=requestAnimationFrame(render);
  function release(root){const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const r of resources)r.dispose();}
  return{pause(value){paused=value;},seek(value){phase=Math.max(0,Math.min(1,value));cycle=previous?phase:walkClockPhase(phase);apply();onPhase(phase);},before(value){previous=value;cycle=previous?phase:walkClockPhase(phase);apply();},slow(value){slow=value;},view(value){angle=value;frameCamera();},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();mixer?.stopAllAction();release(scene);environment.dispose();renderer.dispose();renderer.domElement.remove();}};
}
