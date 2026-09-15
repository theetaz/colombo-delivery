import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {assetUrl,linesOf} from './data.js';
import {createStreetScene,disposeStreetScene,setStreetPresentation} from './streets/street-scene.js';
import {sampleLine} from './streets/road-markings.js';

function category(object){
  for(let o=object;o;o=o.parent){
    const layer=o.userData.asset_layer;
    if(layer==='Lotus Tower')return 'tower';
    if(layer==='03 Building blockouts')return 'buildings';
    if(layer==='01 Roads')return 'roads';
    if(o.userData.kind||/^Reference.post/.test(o.name))return 'markers';
    if(['terrain','water','parks'].includes(o.name))return o.name;
    if(['rail','paths'].includes(o.name))return 'railPaths';
  }
  return 'tower';
}

export function createViewer(container,{onProgress,onReady,onPick,onError,onCamera,onDelivery,onNotice}){
  let alive=true,frame=0,model=null,network=null,mode='full',wireframe=false,dressed=true,streetRoot=null;
  let activeCamera='overview';
  let delivery=null,deliveryLoading=null;
  let layerState={},overlays={},selection=null,roadLoading=null;
  const roots={},modelStats={},meshGroups={},loader=new GLTFLoader();
  const scene=new THREE.Scene();
  scene.background=new THREE.Color('#e1e7ec');
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false,preserveDrawingBuffer:false});
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.6));
  renderer.outputColorSpace=THREE.SRGBColorSpace;
  renderer.toneMapping=THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure=.95;
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Interactive Colombo district. Drag to orbit, scroll to zoom, right-drag to pan. Use the Inspect tab to select roads by name.');
  container.appendChild(renderer.domElement);
  const camera=new THREE.PerspectiveCamera(42,1,.3,24000);
  const controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.16;
  controls.minDistance=3;controls.maxDistance=12000;
  controls.maxPolarAngle=Math.PI-.06;
  controls.target.set(-400,10,-450);camera.position.set(1700,2000,1900);
  scene.add(new THREE.HemisphereLight(0xe5f3ff,0x707a64,1));
  const sun=new THREE.DirectionalLight(0xffe8c2,2.25);sun.position.set(180,430,220);sun.castShadow=true;
  sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-320;sun.shadow.camera.right=320;sun.shadow.camera.top=320;sun.shadow.camera.bottom=-320;sun.shadow.camera.near=40;sun.shadow.camera.far=1000;sun.shadow.bias=-.00025;scene.add(sun);
  scene.add(sun.target);
  const fill=new THREE.DirectionalLight(0xd6e6ff,.3);fill.position.set(-800,1000,-900);scene.add(fill);
  const overlayRoot=new THREE.Group();scene.add(overlayRoot);
  const raycaster=new THREE.Raycaster(),mouse=new THREE.Vector2();
  let pointerStart=null,roadLines=null,roadPickIds=[],controlPoints=null,selectedHighlight=null,boundary=null;
  const elevation=new Map();
  const allResources=new Set();

  function render(now){
    frame=0;if(!alive)return;
    if(delivery?.active)delivery.tick(now);else controls.update();
    renderer.render(scene,camera);
    if(delivery?.animating)invalidate();
  }
  function invalidate(){if(alive&&!frame)frame=requestAnimationFrame(render);}
  controls.addEventListener('change',invalidate);
  controls.addEventListener('start',()=>{activeCamera='custom';onCamera('custom');});
  function resize(){
    const width=container.clientWidth,height=container.clientHeight;
    if(!width||!height)return;
    camera.aspect=width/height;camera.updateProjectionMatrix();
    renderer.setSize(width,height);
    if(roots.full&&['overview','top'].includes(activeCamera))preset(activeCamera);
    invalidate();
  }
  const observer=new ResizeObserver(resize);observer.observe(container);
  function lost(event){event.preventDefault();onError('The browser lost its graphics context. Reload the page to restore the viewer.');}
  renderer.domElement.addEventListener('webglcontextlost',lost);

  function track(root){
    root.traverse(o=>{
      if(o.geometry)allResources.add(o.geometry);
      for(const mat of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){
        allResources.add(mat);
        for(const value of Object.values(mat))if(value?.isTexture)allResources.add(value);
      }
    });
  }
  function disposeRoot(root){root?.traverse(o=>{
    o.geometry?.dispose();
    for(const m of o.material?(Array.isArray(o.material)?o.material:[o.material]):[]){
      for(const value of Object.values(m))if(value?.isTexture)value.dispose();m.dispose();
    }
  });}
  function collect(root){
    let triangles=0,meshes=0,nonFinite=0;
    root.traverse(o=>{
      if(!o.isMesh)return;
      meshes++;
      const p=o.geometry.attributes.position;
      triangles+=(o.geometry.index?.count||p.count)/3;
      // Inspect the loaded attribute representation, including normalized/interleaved values.
      for(let i=0;i<p.count;i++)for(const value of [p.getX(i),p.getY(i),p.getZ(i)])if(!Number.isFinite(value))nonFinite++;
    });
    const box=new THREE.Box3().setFromObject(root),size=box.getSize(new THREE.Vector3());
    return {triangles:Math.round(triangles),meshes,nonFinite,size:size.toArray().map(n=>Math.round(n*100)/100)};
  }
  function applyLayers(){
    for(const [key,root] of Object.entries(roots)){
      root.visible=mode===key;
      root.traverse(o=>{
        if(!o.isMesh)return;
        o.visible=layerState[category(o)]!==false;
        for(const m of Array.isArray(o.material)?o.material:[o.material]){
          if(m.wireframe!==wireframe){m.wireframe=wireframe;m.needsUpdate=true;}
        }
      });
    }
    if(roadLines)roadLines.visible=!!overlays.centreLines;
    if(controlPoints)controlPoints.visible=mode==='full'&&layerState.markers!==false;
    if(boundary)boundary.visible=!!overlays.boundary;
    if(streetRoot)setStreetPresentation(streetRoot,{dressed:dressed&&mode==='full',roadsVisible:layerState.roads!==false,buildingsVisible:layerState.buildings!==false,trafficFlow:overlays.trafficFlow!==false});
    invalidate();
  }
  function loadModel(key,file){
    return new Promise((resolve,reject)=>{
      loader.load(assetUrl(file),gltf=>{
        if(!alive){disposeRoot(gltf.scene);resolve(null);return;}
        roots[key]=gltf.scene;scene.add(gltf.scene);track(gltf.scene);
        modelStats[key]=collect(gltf.scene);
        meshGroups[key]=[];
        gltf.scene.traverse(o=>{if(o.isMesh)meshGroups[key].push(o);});
        applyLayers();onReady({...modelStats});resolve(gltf.scene);
      },event=>onProgress(key,event.total?event.loaded/event.total:null),error=>reject(new Error(`${file}: ${error.message||'Could not load this model.'}`)));
    });
  }
  function coordinates(road){
    return linesOf(road).map(line=>line.map(([x,north])=>{
      const z=-north,y=elevation.get(`${x.toFixed(2)},${z.toFixed(2)}`)??0;
      return new THREE.Vector3(x,y+(road.bridge?1.25:.25),z);
    }));
  }
  function lineMaterial(color,opacity=1){
    return new THREE.LineBasicMaterial({color,transparent:opacity<1,opacity,depthTest:false,depthWrite:false});
  }
  function buildOverlays(data,manifest){
    network=data;
    for(const n of data.nodes)elevation.set(`${n.position[0].toFixed(2)},${n.position[2].toFixed(2)}`,n.position[1]);
    const positions=[];
    for(const road of data.roads){
      for(const points of coordinates(road))for(let i=1;i<points.length;i++){
        positions.push(...points[i-1].toArray(),...points[i].toArray());roadPickIds.push(road.id);
      }
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    roadLines=new THREE.LineSegments(g,lineMaterial(0x087e8b,.7));roadLines.renderOrder=5;overlayRoot.add(roadLines);
    const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.Float32BufferAttribute(data.controls.flatMap(c=>[c.position[0],c.position[1]+3,c.position[2]]),3));
    controlPoints=new THREE.Points(pg,new THREE.PointsMaterial({color:0xc57911,size:5,sizeAttenuation:false,depthTest:false}));
    controlPoints.renderOrder=6;overlayRoot.add(controlPoints);
    const [x0,n0,x1,n1]=manifest.bounds_local_xy;
    const bg=new THREE.BufferGeometry().setFromPoints([[x0,1,-n0],[x1,1,-n0],[x1,1,-n1],[x0,1,-n1],[x0,1,-n0]].map(p=>new THREE.Vector3(...p)));
    boundary=new THREE.Line(bg,lineMaterial(0x758f9f,.85));boundary.renderOrder=4;overlayRoot.add(boundary);
    track(overlayRoot);applyLayers();
  }
  function clearHighlight(){
    if(selectedHighlight){overlayRoot.remove(selectedHighlight);disposeRoot(selectedHighlight);selectedHighlight=null;}
  }
  function showSelection(value){
    selection=value;clearHighlight();
    if(!value||!network)return;
    if(value.type==='road'){
      const r=network.roads.find(r=>r.id===value.id);if(!r)return;
      const positions=[];
      for(const pts of coordinates(r))for(let i=1;i<pts.length;i++)positions.push(...pts[i-1].toArray(),...pts[i].toArray());
      const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      selectedHighlight=new THREE.LineSegments(g,lineMaterial(0xea751e));
      selectedHighlight.renderOrder=10;
    }else if(value.type==='control'){
      const c=network.controls.find(c=>c.id===value.id);if(!c)return;
      const geom=new THREE.SphereGeometry(5,12,8),mat=new THREE.MeshBasicMaterial({color:0xea751e,wireframe:true,depthTest:false});
      selectedHighlight=new THREE.Mesh(geom,mat);selectedHighlight.position.fromArray(c.position);selectedHighlight.position.y+=3;
      selectedHighlight.renderOrder=10;
    }else if(value.type==='surface'&&value.object){
      const box=new THREE.Box3().setFromObject(value.object);
      selectedHighlight=new THREE.Box3Helper(box,0xea751e);
    }
    if(selectedHighlight)overlayRoot.add(selectedHighlight);invalidate();
  }
  function setPose(position,target,name){
    activeCamera=name;
    controls.enableDamping=false;
    camera.position.fromArray(position);controls.target.fromArray(target);controls.update();
    controls.enableDamping=true;onCamera(name);invalidate();
  }
  function fit(){
    const vertical=THREE.MathUtils.degToRad(camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*camera.aspect);
    const target=new THREE.Vector3(-400,35,-450),direction=new THREE.Vector3(1.05,1.25,1.25).normalize();
    const right=new THREE.Vector3().crossVectors(camera.up,direction).normalize();
    const up=new THREE.Vector3().crossVectors(direction,right).normalize();
    let distance=0;
    const fitPoint=point=>{
      const delta=point.clone().sub(target),depth=delta.dot(direction);
      distance=Math.max(distance,Math.abs(delta.dot(right))/Math.tan(horizontal/2)+depth,
        Math.abs(delta.dot(up))/Math.tan(vertical/2)+depth);
    };
    if(roots.full){
      roots.full.updateMatrixWorld(true);
      roots.full.traverse(o=>{
        if(!o.isMesh)return;
        o.geometry.computeBoundingBox();const box=o.geometry.boundingBox;
        for(const x of [box.min.x,box.max.x])for(const y of [box.min.y,box.max.y])for(const z of [box.min.z,box.max.z])
          fitPoint(new THREE.Vector3(x,y,z).applyMatrix4(o.matrixWorld));
      });
    }else{
      for(const x of [-1300,500])for(const y of [-20,350])for(const z of [-1350,450])fitPoint(new THREE.Vector3(x,y,z));
    }
    const offset=direction.multiplyScalar(distance*1.15);
    setPose(target.clone().add(offset).toArray(),target.toArray(),'overview');
  }
  function preset(name){
    if(name==='overview'){fit();return;}
    if(name==='top'){
      const distance=1050/Math.tan(THREE.MathUtils.degToRad(camera.fov)/2)/Math.min(camera.aspect,1);
      setPose([-400,distance,-449.9],[-400,0,-450],'top');
    }else if(name==='street'){
      const road=network?.roads.find(item=>String(item.id)==='386048812');
      if(!road)return;
      const line=linesOf(road)[0],placements=(streetRoot?.userData.placements||[]).filter(item=>item.roadId===String(road.id));
      // Frame the densest authored cluster, with the camera kept over the left lane.
      const countNearby=item=>placements.filter(other=>Math.hypot(other.position[0]-item.position[0],other.position[2]-item.position[2])<60).length;
      const anchor=placements.slice().sort((a,b)=>countNearby(b)-countNearby(a))[0]?.position||[-558,0,368];
      let nearest=Infinity,focusDistance=0,distance=0;
      for(let i=1;i<line.length;i++){
        const [ax,an]=line[i-1],[bx,bn]=line[i],dx=bx-ax,dz=an-bn,length=Math.hypot(dx,dz);
        if(!length)continue;
        const t=THREE.MathUtils.clamp(((anchor[0]-ax)*dx+(anchor[2]+an)*dz)/(length*length),0,1);
        const gap=Math.hypot(anchor[0]-ax-dx*t,anchor[2]+an-dz*t);
        if(gap<nearest){nearest=gap;focusDistance=distance+length*t;}distance+=length;
      }
      const at=sampleLine(line,focusDistance-18),ahead=sampleLine(line,focusDistance+12);
      const x=at.x+at.tz*.9,z=at.z-at.tx*.9;
      const heightAt=streetRoot?.userData.heightAt;
      const position=[x,(heightAt?.(x,z)??0)+3.2,z],target=[ahead.x,(heightAt?.(ahead.x,ahead.z)??0)+2.5,ahead.z];
      const point=new THREE.Vector3(...target);
      sun.target.position.copy(point);sun.position.copy(point).add(new THREE.Vector3(180,430,220));sun.target.updateMatrixWorld();
      sun.shadow.camera.left=sun.shadow.camera.bottom=-80;sun.shadow.camera.right=sun.shadow.camera.top=80;sun.shadow.camera.updateProjectionMatrix();
      setPose(position,target,'street');
    }else setPose([460,260,580],[0,175,0],'tower');
  }
  function focus(value){
    showSelection(value);
    if(value?.type==='road'){
      const road=network.roads.find(r=>r.id===value.id);if(!road)return;
      const points=coordinates(road).flat(),box=new THREE.Box3().setFromPoints(points),center=box.getCenter(new THREE.Vector3());
      const size=box.getSize(new THREE.Vector3()),d=Math.max(90,Math.hypot(size.x,size.z)*.85)/Math.min(camera.aspect,1);
      setPose([center.x+d*.35,center.y+d,center.z+d*.65],center.toArray(),'selection');
    }else if(value?.type==='control'){
      const c=network.controls.find(c=>c.id===value.id);if(!c)return;
      const [x,y,z]=c.position;setPose([x+40,y+55,z+55],[x,y+2,z],'selection');
    }
  }
  function pointerDown(event){pointerStart=[event.clientX,event.clientY,event.button];}
  function pointerUp(event){
    if(delivery?.active){pointerStart=null;return;}
    if(!pointerStart||pointerStart[2]!==0||Math.hypot(event.clientX-pointerStart[0],event.clientY-pointerStart[1])>5||!network)return;
    pointerStart=null;
    const rect=renderer.domElement.getBoundingClientRect();mouse.set((event.clientX-rect.left)/rect.width*2-1,-(event.clientY-rect.top)/rect.height*2+1);
    raycaster.setFromCamera(mouse,camera);
    const threshold=Math.max(1.2,Math.min(8,camera.position.distanceTo(controls.target)*.0025));
    raycaster.params.Line.threshold=threshold;
    if(layerState.roads!==false||overlays.centreLines){
      const hit=raycaster.intersectObject(roadLines,false)[0];
      if(hit){const id=roadPickIds[Math.floor(hit.index/2)];if(id){onPick({type:'road',id});showSelection({type:'road',id});return;}}
    }
    const hits=raycaster.intersectObjects((meshGroups[mode]||[]).filter(o=>o.visible),false);
    const hit=hits[0];
    if(hit){
      let o=hit.object;while(o.parent&&!o.userData.osm_node_id&&category(o)==='markers')o=o.parent;
      if(o.userData.osm_node_id){const picked={type:'control',id:String(o.userData.osm_node_id)};onPick(picked);showSelection(picked);}
      else {const picked={type:'surface',name:hit.object.name,layer:category(hit.object),point:hit.point.toArray().map(n=>+n.toFixed(2))};onPick(picked);showSelection({...picked,object:hit.object});}
    }
  }
  renderer.domElement.addEventListener('pointerdown',pointerDown);
  renderer.domElement.addEventListener('pointerup',pointerUp);
  resize();fit();
  async function ensureRoads(){
    if(!roots.roads){
      roadLoading??=loadModel('roads','road-surfaces.glb').catch(error=>{roadLoading=null;throw error;});
      await roadLoading;
    }
  }
  return {
    async load(data,manifest){buildOverlays(data,manifest);model=await loadModel('full','colombo-roads.glb');
      if(!alive)return model;
      try{
        const streets=await createStreetScene({network:data,sourceRoot:model,invalidate});
        if(!alive){disposeStreetScene(streets);return model;}
        streetRoot=streets;scene.add(streetRoot);applyLayers();
      }catch(error){if(alive)onNotice?.(`Street artwork could not load. The source district is available. ${error.message}`);}
      if(alive)fit();return model;},
    async setMode(next){
      mode=next;applyLayers();
      if(next==='roads')await ensureRoads();
      applyLayers();
    },
    ensureRoads,
    async startDelivery(){
      deliveryLoading??=import('./delivery/runtime.js').then(({createDeliveryRuntime})=>{
        if(alive)delivery=createDeliveryRuntime({scene,camera,controls,renderer,invalidate,onUpdate:onDelivery});
      }).catch(error=>{deliveryLoading=null;throw error;});
      await deliveryLoading;if(!alive)return;
      sun.target.position.set(40,0,-120);sun.position.set(220,430,100);sun.target.updateMatrixWorld();
      sun.shadow.camera.left=sun.shadow.camera.bottom=-320;sun.shadow.camera.right=sun.shadow.camera.top=320;sun.shadow.camera.updateProjectionMatrix();
      showSelection(null);activeCamera='drive';onCamera('drive');await delivery.start();
    },
    stopDelivery(){delivery?.stop();fit();},
    deliveryAction(){delivery?.action();},
    resetDelivery(){delivery?.reset();},
    pauseDelivery(value){delivery?.pause(value);},
    setDriveInput(key,value){delivery?.setInput(key,value);},
    setDriveAssist(value){delivery?.setAssist(value);},
    setDriveCamera(value){delivery?.setCamera(value);},
    restartDelivery(){delivery?.restart();},
    setLayers(value){layerState=value;applyLayers();},
    setOverlays(value){overlays=value;applyLayers();},
    setWireframe(value){wireframe=value;applyLayers();},
    setDressed(value){dressed=value;applyLayers();},
    preset,focus,select:showSelection,
    pose(){return {position:camera.position.toArray(),target:controls.target.toArray()};},
    async capture(){
      renderer.render(scene,camera);
      return new Promise((resolve,reject)=>renderer.domElement.toBlob(b=>b?resolve(b):reject(new Error('Image capture failed.')),'image/png'));
    },
    dispose(){
      alive=false;if(frame)cancelAnimationFrame(frame);delivery?.dispose();observer.disconnect();controls.dispose();clearHighlight();disposeStreetScene(streetRoot);
      renderer.domElement.removeEventListener('webglcontextlost',lost);
      renderer.domElement.removeEventListener('pointerdown',pointerDown);renderer.domElement.removeEventListener('pointerup',pointerUp);
      for(const resource of allResources)resource.dispose();renderer.dispose();renderer.domElement.remove();
    }
  };
}
