import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {SLICE,architecturePlacements,landscapePlacements,cameraPresets,drivewayCenters} from './layout.js';

const assetRoot='/streets/composition';

function seededTexture(kind,size=256){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const context=canvas.getContext('2d'),image=context.createImageData(size,size);let seed=kind==='asphalt'?1981:731;
  for(let i=0;i<size*size;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const x=i%size,y=(i/size)|0,n=(seed>>>24)/255;
    const seam=kind==='concrete'&&(x%64<2||y%64<2);
    const base=kind==='asphalt'?43+n*24:seam?120:156+n*20;
    image.data[i*4]=base+(kind==='concrete'?7:0);image.data[i*4+1]=base+(kind==='concrete'?5:1);image.data[i*4+2]=base;image.data[i*4+3]=255;
  }
  context.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(1,1);
  texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

function roughnessTexture(){
  const size=128,data=new Uint8Array(size*size*4);let seed=97;
  for(let i=0;i<size*size;i++){seed=(Math.imul(seed,1103515245)+12345)>>>0;const value=205+(seed>>>27),offset=i*4;data[offset]=value;data[offset+1]=value;data[offset+2]=value;data[offset+3]=255;}
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(28,3);texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;return texture;
}

function box(group,name,size,position,material){
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(...size),material);mesh.name=name;mesh.position.set(...position);mesh.castShadow=true;mesh.receiveShadow=true;group.add(mesh);return mesh;
}

function plane(group,name,width,depth,position,material){
  const geometry=new THREE.PlaneGeometry(width,depth),uv=geometry.attributes.uv,local=geometry.attributes.position;
  for(let i=0;i<uv.count;i++)uv.setXY(i,(local.getX(i)+position[0])/2,(position[2]-local.getY(i))/2);
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.rotation.x=-Math.PI/2;mesh.position.set(...position);mesh.receiveShadow=true;group.add(mesh);return mesh;
}

function drivewayRamp(group,name,x,material){
  const x0=x-2,x1=x+2,z0=4.27,z1=6.7,y0=.045,y1=.155;
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute([x0,y0,z0,x1,y1,z1,x1,y0,z0,x0,y0,z0,x0,y1,z1,x1,y1,z1],3));geometry.setAttribute('uv',new THREE.Float32BufferAttribute([x0/2,z0/2,x1/2,z1/2,x1/2,z0/2,x0/2,z0/2,x0/2,z1/2,x1/2,z1/2],2));geometry.computeVertexNormals();
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;group.add(mesh);return mesh;
}

function createGround(resources){
  const root=new THREE.Group();root.name='Authored street ground';
  const asphaltMap=seededTexture('asphalt'),concreteMap=seededTexture('concrete'),roughness=roughnessTexture();resources.add(asphaltMap);resources.add(concreteMap);resources.add(roughness);
  const asphalt=new THREE.MeshStandardMaterial({color:0xa7a39b,map:asphaltMap,roughnessMap:roughness,roughness:.94,metalness:0});
  const concrete=new THREE.MeshStandardMaterial({color:0xd0c8b9,map:concreteMap,roughness:.92});
  const curb=new THREE.MeshStandardMaterial({color:0xb9b2a5,roughness:.9});
  const soil=new THREE.MeshStandardMaterial({color:0x526348,roughness:1});
  const water=new THREE.MeshPhysicalMaterial({color:0x598f99,roughness:.22,metalness:0,transmission:.08,transparent:true,opacity:.88,depthWrite:true});
  plane(root,'Asphalt road',190,8,[0,.02,0],asphalt);
  for(const [a,b] of [[-95,-80],[-76,-57],[-53,-34],[-30,95]])plane(root,`South pavement ${a}`,b-a,2.4,[(a+b)/2,.155,5.5],concrete);
  plane(root,'North pavement',190,2.4,[0,.155,-5.5],concrete);plane(root,'Promenade pavement',71,3.4,[59.5,.155,-8.4],concrete);
  for(const [a,b] of [[-95,-80],[-76,-57],[-53,-34],[-30,95]])box(root,`South curb ${a}`,[b-a,.15,.3],[(a+b)/2,.075,4.15],curb);
  box(root,'North curb',[190,.15,.3],[0,.075,-4.15],curb);
  plane(root,'Garden verge',190,18,[0,-.02,16],soil);plane(root,'Shop plots',119,15,[-35.5,-.02,-14.2],soil);
  plane(root,'Lake',86,62,[66,.08,-41.1],water);
  const paint=new THREE.MeshStandardMaterial({color:0xe0ded1,roughness:.8,transparent:true,opacity:.68,polygonOffset:true,polygonOffsetFactor:-2});
  for(let x=-88;x<91;x+=14)plane(root,`Faded centre dash ${x}`,7,.13,[x,.055,0],paint);
  const edgePaint=paint.clone();edgePaint.opacity=.45;resources.add(edgePaint);plane(root,'South faded edge',190,.1,[0,.054,3.72],edgePaint);plane(root,'North faded edge',190,.1,[0,.054,-3.72],edgePaint);
  const patch=new THREE.MeshStandardMaterial({color:0x555452,roughness:.98});resources.add(patch);
  for(const [x,z,w,d] of [[-71,1.4,8,1.8],[-18,-1.6,11,2.1],[41,1.2,7,2.4],[76,-1.1,13,1.5]])plane(root,`Asphalt repair ${x}`,w,d,[x,.045,z],patch);
  const pitMat=new THREE.MeshStandardMaterial({color:0x4d3d2b,roughness:1});resources.add(pitMat);plane(root,'Shop tree pit',1.35,1.05,[-31,.185,-6.25],pitMat);
  for(const x of drivewayCenters)drivewayRamp(root,`Driveway transition ${x}`,x,concrete);
  const drainBed=new THREE.MeshStandardMaterial({color:0x25292a,roughness:.7,metalness:.55});resources.add(drainBed);
  for(const item of landscapePlacements.filter(entry=>entry.prefab==='DrainGrate'))box(root,`Drain recess ${item.id}`,[.88,.025,.48],[item.position[0],.16,item.position[2]],drainBed);
  return root;
}

function manifestEntries(manifest){return new Map((manifest.prefabs||manifest.families||[]).map(entry=>[entry.name||entry.id||entry.node||entry.nodeName,entry]));}

async function loadKit(file,manifestFile,placements,resources){
  const [response,gltf]=await Promise.all([fetch(`${assetRoot}/${manifestFile}`),new GLTFLoader().loadAsync(`${assetRoot}/${file}`)]);
  if(!response.ok)throw new Error(`${manifestFile} returned ${response.status}`);
  const entries=manifestEntries(await response.json()),group=new THREE.Group();group.name=file;gltf.scene.updateMatrixWorld(true);
  const byPrefab=new Map();for(const item of placements){if(!byPrefab.has(item.prefab))byPrefab.set(item.prefab,[]);byPrefab.get(item.prefab).push(item);}
  const placementMatrix=new THREE.Matrix4(),relative=new THREE.Matrix4(),inverseRoot=new THREE.Matrix4(),rotation=new THREE.Quaternion(),scale=new THREE.Vector3(),position=new THREE.Vector3(),up=new THREE.Vector3(0,1,0);
  for(const [prefab,items] of byPrefab){
    const entry=entries.get(prefab),source=gltf.scene.getObjectByName(entry?.node||entry?.nodeName||prefab);if(!source)throw new Error(`${prefab} is missing from ${file}`);
    source.updateWorldMatrix(true,true);inverseRoot.copy(source.matrixWorld).invert();let meshIndex=0;
    source.traverse(object=>{if(!object.isMesh)return;relative.multiplyMatrices(inverseRoot,object.matrixWorld);const instanced=new THREE.InstancedMesh(object.geometry,object.material,items.length);instanced.name=`${prefab} ${meshIndex++}`;instanced.castShadow=true;instanced.receiveShadow=true;
      items.forEach((item,index)=>{rotation.setFromAxisAngle(up,item.yaw||0);scale.setScalar(item.scale||1);position.fromArray(item.position);placementMatrix.compose(position,rotation,scale).multiply(relative);instanced.setMatrixAt(index,placementMatrix);});instanced.instanceMatrix.needsUpdate=true;group.add(instanced);resources.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}
    });
  }
  return group;
}

async function loadLandmark(resources){
  const gltf=await new GLTFLoader().loadAsync(`${assetRoot}/landmark-lod.glb`),root=gltf.scene;
  root.name='Distant Lotus Tower';root.position.set(680,0,-880);root.rotation.y=-.22;
  root.traverse(object=>{if(object.isMesh){object.castShadow=false;object.receiveShadow=true;resources.add(object.geometry);for(const material of Array.isArray(object.material)?object.material:[object.material])resources.add(material);}});return root;
}

export function createCompositionViewer(container,{onStatus,onPreset,onTour,onError,onStats}={}){
  let alive=true,frame=0,touring=false,tourStart=0,tourElapsed=0,activePreset='Garden',loadedState='loading';const resources=new Set();
  const scene=new THREE.Scene();scene.background=new THREE.Color(0xcbd8db);scene.fog=new THREE.FogExp2(0xcbd8db,.00135);
  const renderer=new THREE.WebGLRenderer({antialias:true,powerPreference:'high-performance'});renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.6));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.08;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;container.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(45,1,.15,1500),controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;controls.minDistance=2;controls.maxDistance=180;controls.maxPolarAngle=Math.PI*.48;controls.target.set(...cameraPresets.Garden.target);camera.position.set(...cameraPresets.Garden.position);
  scene.add(new THREE.HemisphereLight(0xdcebf2,0x607059,1.35));const sun=new THREE.DirectionalLight(0xffd9aa,3.15);sun.position.set(-42,68,38);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-105;sun.shadow.camera.right=105;sun.shadow.camera.top=65;sun.shadow.camera.bottom=-65;sun.shadow.camera.near=8;sun.shadow.camera.far=190;sun.shadow.bias=-.00025;scene.add(sun,sun.target);
  scene.add(createGround(resources));
  const backdrop=new THREE.Group(),farWater=new THREE.MeshPhysicalMaterial({color:0x5f929c,roughness:.3,transparent:true,opacity:.84}),farLand=new THREE.MeshStandardMaterial({color:0x66725c,roughness:1});resources.add(farWater);resources.add(farLand);
  plane(backdrop,'Lake continuation',1400,768,[300,.03,-456],farWater);plane(backdrop,'Distant shoreline',1400,300,[300,-.01,-990],farLand);scene.add(backdrop);
  function invalidate(){if(alive&&!frame)frame=requestAnimationFrame(render);}
  function render(now){frame=0;if(!alive)return;if(touring){const t=((now-tourStart)/1000)%38,u=t/38,x=-82+u*166;camera.position.set(x,3.1+Math.sin(u*Math.PI)*.6,1.5);controls.target.set(x+25,2.35,u>.62?-4.3:-1.8);}controls.update();renderer.render(scene,camera);if(touring)invalidate();}
  controls.addEventListener('change',invalidate);controls.addEventListener('start',()=>{if(touring)setTour(false);});
  const observer=new ResizeObserver(()=>{const w=container.clientWidth,h=container.clientHeight;if(!w||!h)return;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h,false);invalidate();});observer.observe(container);
  function preset(name){const value=cameraPresets[name];if(!value)return;setTour(false);tourElapsed=0;activePreset=name;camera.position.set(...value.position);controls.target.set(...value.target);controls.update();onPreset?.(name);invalidate();}
  function setTour(value){if(value===touring)return;const now=performance.now();if(value)tourStart=now-tourElapsed;else tourElapsed=(now-tourStart)%38000;touring=value;onTour?.(touring);invalidate();}
  Promise.allSettled([
    loadKit('architecture.glb','architecture.manifest.json',architecturePlacements,resources),
    loadKit('landscape.glb','landscape.manifest.json',landscapePlacements,resources),
    loadLandmark(resources),
  ]).then(results=>{
    if(!alive){for(const result of results)if(result.status==='fulfilled')result.value.traverse(object=>{object.geometry?.dispose?.();for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[])material.dispose?.();});return;}
    const warnings=[];for(const result of results)if(result.status==='rejected')warnings.push(result.reason?.message||String(result.reason));
    if(results[0].status!=='fulfilled'||results[1].status!=='fulfilled'){loadedState='error';onError?.(`The complete authored street could not load. ${warnings.join(' · ')}`);return;}
    for(const result of results)if(result.status==='fulfilled')scene.add(result.value);const loaded=results.filter(result=>result.status==='fulfilled').length;
    let meshes=0,triangles=0;scene.traverse(object=>{if(!object.isMesh)return;meshes++;const position=object.geometry?.attributes?.position,count=object.isInstancedMesh?object.count:1;triangles+=(object.geometry?.index?.count||position?.count||0)/3*count;});
    loadedState='ready';onStats?.({loadedKits:loaded,instancedMeshes:meshes,realizedTriangles:Math.round(triangles),warnings});onStatus?.(warnings.length?`Street ready · ${warnings.join(' · ')}`:'Street ready for review');invalidate();
  });
  invalidate();
  return {preset,setTour,toggleTour(){setTour(!touring);return touring;},stats(){return {state:loadedState,calls:renderer.info.render.calls,triangles:renderer.info.render.triangles,geometries:renderer.info.memory.geometries,textures:renderer.info.memory.textures};},dispose(){alive=false;if(frame)cancelAnimationFrame(frame);observer.disconnect();controls.dispose();const disposable=new Set(resources);scene.traverse(object=>{if(object.geometry)disposable.add(object.geometry);for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){disposable.add(material);for(const value of Object.values(material))if(value?.isTexture)disposable.add(value);}});for(const item of disposable)item?.dispose?.();renderer.dispose();renderer.domElement.remove();scene.clear();},get presetName(){return activePreset;}};
}
