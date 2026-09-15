import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import {smooth} from './movement-model.js';

export function createTransitionStudy(host,onReady,onState,onError){
  let disposed=false,raf,last=0,report=0,mixer,rider,skeleton,jointDots,actions,selected='Dismount',phase=0,playing=false,slow=false,angle='Three-quarter';
  const scene=new THREE.Scene();scene.background=new THREE.Color('#e4ecea');
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=.95;
  renderer.domElement.setAttribute('aria-label','Rider mounting and dismounting a bicycle. Drag to orbit.');host.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(37,1,.05,60),controls=new OrbitControls(camera,renderer.domElement);controls.target.set(-.16,.9,0);controls.enableDamping=true;controls.enablePan=false;controls.minDistance=2;controls.maxDistance=8;controls.maxPolarAngle=Math.PI*.49;
  const ground=new THREE.Mesh(new THREE.PlaneGeometry(80,80),new THREE.MeshStandardMaterial({color:0xc9d2c9,roughness:.95}));ground.rotation.x=-Math.PI/2;ground.position.y=-.003;ground.receiveShadow=true;scene.add(ground);
  scene.add(new THREE.HemisphereLight(0xe9f4ff,0x737c64,1.8));const sun=new THREE.DirectionalLight(0xfff2df,3.2);sun.position.set(3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.normalBias=.008;Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:18});scene.add(sun);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  function frameCamera(){controls.target.y=camera.aspect<1?1:.9;const fit=Math.max(1,.85/camera.aspect)*(camera.aspect<1?1.12:1),offset=angle==='Front'?new THREE.Vector3(0,.4,-4.3):angle==='Side'?new THREE.Vector3(-4.2,.3,0):new THREE.Vector3(-3.4,.65,-2.7);camera.position.copy(controls.target).add(offset.multiplyScalar(fit));controls.update();}
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();frameCamera();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function emit(){onState({phase,playing});}
  function apply(){if(!actions)return;for(const [name,a] of Object.entries(actions)){a.enabled=name===selected;a.setEffectiveWeight(name===selected?1:0);a.time=phase*a.getClip().duration;}mixer.update(0);
    const grip=selected==='Mount'?smooth((phase-.02)/.21):1-smooth((phase-.78)/.22);
    rider.traverse(o=>{if(o.morphTargetDictionary?.HandlebarGrip!==undefined)o.morphTargetInfluences[o.morphTargetDictionary.HandlebarGrip]=grip;});}
  const loader=new GLTFLoader();Promise.all([loader.loadAsync('/cyclist/courier-movement.glb'),loader.loadAsync('/cyclist/bicycle-fitted.glb')]).then(([r,b])=>{
    if(disposed){release(r.scene);release(b.scene);return;}rider=r.scene;scene.add(rider,b.scene);for(const root of [rider,b.scene])root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
    mixer=new THREE.AnimationMixer(rider);actions={};for(const name of ['Mount','Dismount']){const clip=r.animations.find(c=>c.name===name||c.name.endsWith('|'+name));if(!clip)throw new Error('Missing '+name+' animation');const a=mixer.clipAction(clip).play().setLoop(THREE.LoopOnce,1);a.paused=true;a.clampWhenFinished=true;actions[name]=a;}
    skeleton=new THREE.SkeletonHelper(rider);skeleton.material.depthTest=false;skeleton.material.transparent=true;skeleton.material.opacity=.85;skeleton.material.vertexColors=false;skeleton.material.color.set('#127f6b');skeleton.renderOrder=10;skeleton.visible=false;scene.add(skeleton);
    jointDots=new THREE.Group();jointDots.visible=false;scene.add(jointDots);const dotGeometry=new THREE.SphereGeometry(.014,8,6),dotMaterial=new THREE.MeshBasicMaterial({color:0xe19531,depthTest:false,depthWrite:false,toneMapped:false});
    rider.traverse(bone=>{if(bone.isBone){const dot=new THREE.Mesh(dotGeometry,dotMaterial);dot.userData.bone=bone;dot.renderOrder=11;jointDots.add(dot);}});apply();onReady();emit();
  }).catch(e=>{if(!disposed)onError(e);});
  function render(now){if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;if(actions&&playing&&!document.hidden){phase=Math.min(1,phase+dt*(slow?.25:1)/actions[selected].getClip().duration);if(phase===1){playing=false;emit();}}apply();if(jointDots?.visible){rider.updateMatrixWorld(true);for(const dot of jointDots.children)dot.userData.bone.getWorldPosition(dot.position);}controls.update();renderer.render(scene,camera);if(now-report>80){emit();report=now;}raf=requestAnimationFrame(render);}
  raf=requestAnimationFrame(render);
  function release(root){const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const v of Object.values(m))if(v?.isTexture)resources.add(v);}});for(const r of resources)r.dispose();}
  return{action(name){selected=name;phase=0;playing=false;apply();emit();},seek(value){phase=Math.max(0,Math.min(1,value));playing=false;apply();emit();},play(value){if(value&&phase>=1)phase=0;playing=value;last=0;emit();},slow(value){slow=value;},joints(value){if(skeleton){skeleton.visible=value;jointDots.visible=value;}},view(value){angle=value;frameCamera();},dispose(){disposed=true;cancelAnimationFrame(raf);observer.disconnect();controls.dispose();mixer?.stopAllAction();release(scene);environment.dispose();renderer.dispose();renderer.domElement.remove();}};
}
