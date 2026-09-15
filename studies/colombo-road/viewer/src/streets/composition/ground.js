import * as THREE from 'three';
import {drivewayCenters,landscapePlacements} from './layout.js';

const records=[];

function seededTexture(kind,size=256){
  const canvas=document.createElement('canvas');canvas.width=canvas.height=size;
  const context=canvas.getContext('2d'),image=context.createImageData(size,size);let seed=kind==='asphalt'?1981:731;
  for(let i=0;i<size*size;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const x=i%size,y=(i/size)|0,n=(seed>>>24)/255,seam=kind==='concrete'&&(x%64<2||y%64<2);
    const base=kind==='asphalt'?43+n*24:seam?120:156+n*20;
    image.data[i*4]=base+(kind==='concrete'?7:0);image.data[i*4+1]=base+(kind==='concrete'?5:1);image.data[i*4+2]=base;image.data[i*4+3]=255;
  }
  context.putImageData(image,0,0);const texture=new THREE.CanvasTexture(canvas);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;return texture;
}

function roughnessTexture(){
  const size=128,data=new Uint8Array(size*size*4);let seed=97;
  for(let i=0;i<size*size;i++){seed=(Math.imul(seed,1103515245)+12345)>>>0;const value=205+(seed>>>27),offset=i*4;data[offset]=data[offset+1]=data[offset+2]=value;data[offset+3]=255;}
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(28,3);texture.colorSpace=THREE.NoColorSpace;texture.needsUpdate=true;return texture;
}

function register(object,id,kind,assetId,shape){
  object.name=id;object.userData={...object.userData,stableId:id,instanceId:id,kind,prefabAssetId:assetId};
  const record={id,kind,assetId,name:id,shape,transform:{position:object.position.toArray(),rotation:object.rotation.toArray().slice(0,3),scale:object.scale.toArray()}};
  object.userData.registryRecord=record;records.push(record);return object;
}

function box(group,id,size,position,material,kind='ground'){
  const value=register(new THREE.Mesh(new THREE.BoxGeometry(...size),material),id,kind,'procedural:street-ground',{type:'box',size:[...size]});
  value.position.set(...position);value.userData.registryRecord.transform.position=value.position.toArray();value.castShadow=value.receiveShadow=true;group.add(value);return value;
}

function plane(group,id,width,depth,position,material,kind='ground'){
  const geometry=new THREE.PlaneGeometry(width,depth),uv=geometry.attributes.uv,local=geometry.attributes.position;
  // One UV tile per two metres, positioned in street-space so adjacent slabs align.
  for(let i=0;i<uv.count;i++)uv.setXY(i,(local.getX(i)+position[0])/2,(position[2]-local.getY(i))/2);
  const value=register(new THREE.Mesh(geometry,material),id,kind,'procedural:street-ground',{type:'plane',size:[width,depth]});
  value.rotation.x=-Math.PI/2;value.position.set(...position);value.userData.registryRecord.transform={position:value.position.toArray(),rotation:[-Math.PI/2,0,0],scale:[1,1,1]};value.receiveShadow=true;group.add(value);return value;
}

function drivewayRamp(group,id,x,material){
  const x0=x-2,x1=x+2,z0=4.27,z1=6.7,y0=.045,y1=.155;
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute([x0,y0,z0,x1,y1,z1,x1,y0,z0,x0,y0,z0,x0,y1,z1,x1,y1,z1],3));
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute([x0/2,z0/2,x1/2,z1/2,x1/2,z0/2,x0/2,z0/2,x0/2,z1/2,x1/2,z1/2],2));geometry.computeVertexNormals();
  const value=register(new THREE.Mesh(geometry,material),id,'ground','procedural:driveway-ramp',{type:'ramp',bounds:{xMin:x0,xMax:x1,zMin:z0,zMax:z1,yMin:y0,yMax:y1}});
  value.receiveShadow=true;group.add(value);return value;
}

export function createGround(resources=new Set()){
  records.length=0;const root=register(new THREE.Group(),'ground:root','ground-root','procedural:street-ground',{type:'group'});
  const asphaltMap=seededTexture('asphalt'),concreteMap=seededTexture('concrete'),roughness=roughnessTexture();resources.add(asphaltMap);resources.add(concreteMap);resources.add(roughness);
  const addMaterial=(value)=>{resources.add(value);return value;};
  const asphalt=addMaterial(new THREE.MeshStandardMaterial({color:0xa7a39b,map:asphaltMap,roughnessMap:roughness,roughness:.94,metalness:0}));
  const concrete=addMaterial(new THREE.MeshStandardMaterial({color:0xd0c8b9,map:concreteMap,roughness:.92}));
  const curb=addMaterial(new THREE.MeshStandardMaterial({color:0xb9b2a5,roughness:.9}));
  const soil=addMaterial(new THREE.MeshStandardMaterial({color:0x526348,roughness:1}));
  const water=addMaterial(new THREE.MeshPhysicalMaterial({color:0x598f99,roughness:.22,metalness:0,transmission:.08,transparent:true,opacity:.88,depthWrite:true}));
  plane(root,'ground:road-asphalt',190,8,[0,.02,0],asphalt);
  const south=[[-95,-80],[-76,-57],[-53,-34],[-30,95]];
  south.forEach(([a,b],i)=>plane(root,`ground:pavement:south:${i}`,b-a,2.4,[(a+b)/2,.155,5.5],concrete));
  plane(root,'ground:pavement:north',190,2.4,[0,.155,-5.5],concrete);plane(root,'ground:pavement:promenade',71,3.4,[59.5,.155,-8.4],concrete);
  south.forEach(([a,b],i)=>box(root,`ground:curb:south:${i}`,[b-a,.15,.3],[(a+b)/2,.075,4.15],curb));box(root,'ground:curb:north',[190,.15,.3],[0,.075,-4.15],curb);
  plane(root,'ground:verge:south',190,18,[0,-.02,16],soil);plane(root,'ground:plots:north',119,15,[-35.5,-.02,-14.2],soil);
  plane(root,'ground:lake',86,62,[66,.08,-41.1],water);plane(root,'ground:lake-continuation',1400,768,[300,.03,-456],water);
  plane(root,'ground:distant-shoreline',1400,300,[300,-.01,-990],soil);
  const paint=addMaterial(new THREE.MeshStandardMaterial({color:0xe0ded1,roughness:.8,transparent:true,opacity:.68,polygonOffset:true,polygonOffsetFactor:-2}));
  for(let x=-88;x<91;x+=14)plane(root,`marking:center:${x}`,7,.13,[x,.055,0],paint,'marking');
  const edgePaint=paint.clone();edgePaint.opacity=.45;resources.add(edgePaint);plane(root,'marking:edge:south',190,.1,[0,.054,3.72],edgePaint,'marking');plane(root,'marking:edge:north',190,.1,[0,.054,-3.72],edgePaint,'marking');
  const patch=addMaterial(new THREE.MeshStandardMaterial({color:0x555452,roughness:.98}));
  [[-71,1.4,8,1.8],[-18,-1.6,11,2.1],[41,1.2,7,2.4],[76,-1.1,13,1.5]].forEach(([x,z,w,d],i)=>plane(root,`ground:asphalt-repair:${i}`,w,d,[x,.045,z],patch));
  const pit=addMaterial(new THREE.MeshStandardMaterial({color:0x4d3d2b,roughness:1}));plane(root,'ground:tree-pit:shop',1.35,1.05,[-31,.185,-6.25],pit);
  drivewayCenters.forEach((x,i)=>drivewayRamp(root,`ground:driveway:${i}`,x,concrete));
  const drain=addMaterial(new THREE.MeshStandardMaterial({color:0x25292a,roughness:.7,metalness:.55}));
  landscapePlacements.filter(entry=>entry.prefab==='DrainGrate').forEach(item=>box(root,`ground:drain-recess:${item.id}`,[.88,.025,.48],[item.position[0],.16,item.position[2]],drain));
  root.userData.registryRecords=records.map(record=>structuredClone(record));return root;
}

export function groundRegistryRecords(root){return (root?.userData?.registryRecords||[]).map(record=>structuredClone(record));}
