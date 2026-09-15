import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';

export function createStudio(host,onReady,onError,onProgress){
  let disposed=false,frame=0,last=0,lastReport=0,playing=false,cadence=30,time=0,mixer=null,action=null,bike=null,clip=null,clay=false;
  const originals=new Map(),rest=new Map(),scene=new THREE.Scene();scene.background=new THREE.Color('#edf0f0');
  const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));
  renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;host.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(36,1,.02,100),controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.minDistance=.35;controls.maxDistance=10;controls.maxPolarAngle=Math.PI*.53;
  scene.add(new THREE.HemisphereLight(0xe8f5ff,0x8a9384,1.8));
  const sun=new THREE.DirectionalLight(0xfff2df,3.5);sun.position.set(3,7,4);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
  Object.assign(sun.shadow.camera,{left:-3,right:3,top:3,bottom:-3,near:.1,far:15});sun.shadow.normalBias=.015;scene.add(sun);
  const fill=new THREE.DirectionalLight(0xd9eeff,1);fill.position.set(-3,3,-2);scene.add(fill);
  const floor=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:0xe4e8e6,roughness:.9}));floor.rotation.x=-Math.PI/2;floor.position.y=-.006;floor.receiveShadow=true;scene.add(floor);
  const room=new RoomEnvironment(),pmrem=new THREE.PMREMGenerator(renderer),environment=pmrem.fromScene(room);scene.environment=environment.texture;room.dispose();pmrem.dispose();
  const clayMaterial=new THREE.MeshStandardMaterial({color:0x60696d,roughness:.85});
  function invalidate(){if(!disposed&&!frame)frame=requestAnimationFrame(render);}
  function render(now){frame=0;if(disposed)return;const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
    if(playing)time+=dt*cadence/30;
    if(mixer){mixer.setTime(time);const phase=time/clip.duration*Math.PI*2;
      for(const name of ['FrontWheel','RearWheel'])bike.getObjectByName(name).quaternion.copy(rest.get(name)).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-phase*2.8));
      bike.getObjectByName('Crank').rotation.x=-phase;
      for(const name of ['Pedal_L','Pedal_R'])bike.getObjectByName(name).rotation.x=phase;
      if(playing&&now-lastReport>100){onProgress(Math.round((time/clip.duration%1)*360));lastReport=now;}
    }
    controls.update();renderer.render(scene,camera);if(playing)invalidate();
  }
  controls.addEventListener('change',invalidate);
  const views={quarter:[[3.2,2.15,-4.0],[0,.95,0]],side:[[4.1,1.4,0],[0,1,0]],front:[[0,1.65,-4.5],[0,1,0]],back:[[0,1.8,4.6],[0,1,0]],head:[[1.1,1.9,-1.8],[0,1.55,-.18]],hands:[[.85,1.38,-1.25],[0,1.03,-.30]],feet:[[1.5,.7,-.75],[0,.35,0]]};
  function view(name){const [position,target]=views[name];camera.position.fromArray(position);controls.target.fromArray(target);controls.update();invalidate();}
  function resize(){const w=host.clientWidth,h=host.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);invalidate();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();view('quarter');
  const loader=new GLTFLoader();
  Promise.all([loader.loadAsync('/cyclist/rider.glb'),loader.loadAsync('/cyclist/bicycle-fitted.glb')]).then(([r,b])=>{
    if(disposed){release(r.scene);release(b.scene);return;}
    bike=b.scene;scene.add(r.scene,bike);
    for(const root of [r.scene,bike])root.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;originals.set(o,o.material);if(clay)o.material=clayMaterial;}});
    for(const name of ['FrontWheel','RearWheel'])rest.set(name,bike.getObjectByName(name).quaternion.clone());
    clip=r.animations[0];if(!clip)throw new Error('The rider has no cycling animation.');
    mixer=new THREE.AnimationMixer(r.scene);action=mixer.clipAction(clip);action.play();mixer.setTime(0);
    onReady();invalidate();
  }).catch(error=>{if(!disposed)onError(error);});
  function release(root){const resources=new Set();root.traverse(o=>{if(o.geometry)resources.add(o.geometry);for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){resources.add(m);for(const t of Object.values(m))if(t?.isTexture)resources.add(t);}});for(const r of resources)r.dispose();}
  return {setPlaying(value){playing=value;last=0;invalidate();},setCadence(value){cadence=value;},setPhase(value){if(clip){time=value*clip.duration;invalidate();}},setClay(value){clay=value;for(const [o,m] of originals)o.material=clay?clayMaterial:m;invalidate();},view,
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();controls.dispose();for(const [o,m] of originals)o.material=m;mixer?.stopAllAction();release(scene);environment.dispose();clayMaterial.dispose();renderer.dispose();renderer.domElement.remove();}
  };
}
