import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {deriveRoadMarkings} from './road-markings.js';
import {createRoadHeightSampler} from './road-height.js';

function asphaltTexture(){
  const size=128,data=new Uint8Array(size*size*4);let seed=1977;
  for(let i=0;i<size*size;i++){
    seed=(Math.imul(seed,1664525)+1013904223)>>>0;
    const grain=53+((seed>>>24)%25),fleck=(seed&255)>249?22:0,j=i*4;
    data[j]=grain+fleck;data[j+1]=grain+fleck;data[j+2]=grain+fleck+2;data[j+3]=255;
  }
  const texture=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.colorSpace=THREE.SRGBColorSpace;
  texture.minFilter=THREE.LinearMipmapLinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=true;texture.needsUpdate=true;
  return texture;
}

function roadGeometry(source){
  const geometry=source.clone(),position=geometry.attributes.position,uv=[];
  for(let i=0;i<position.count;i++)uv.push(position.getX(i)/6,position.getZ(i)/6);
  geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));return geometry;
}

function markingMesh(markings,heightAt,name,color=0xf2efe2){
  const vertices=[],widths={centre:.13,lane:.1};
  const addTriangle=(points,indices)=>{const sampled=indices.map(index=>{const p=points[index],y=heightAt(p[0],p[1]);return y==null?null:[p[0],y+.015,p[1]];});if(sampled.every(Boolean))for(const point of sampled)vertices.push(...point);};
  for(const mark of markings){
    if(mark.type==='arrow'){
      const {x,z,tx,tz}=mark,nx=-tz,nz=tx,length=3,width=.8,tip=[x+tx*length*.6,z+tz*length*.6],tail=[x-tx*length*.4,z-tz*length*.4];
      const points=[[tail[0]+nx*.13,tail[1]+nz*.13],[tail[0]-nx*.13,tail[1]-nz*.13],
        [x+tx*.05-nx*width,z+tz*.05-nz*width],tip,[x+tx*.05+nx*width,z+tz*.05+nz*width]];
      for(const tri of [[0,1,2],[0,2,3],[0,3,4]])addTriangle(points,tri);
      continue;
    }
    const dx=mark.b.x-mark.a.x,dz=mark.b.z-mark.a.z,length=Math.hypot(dx,dz)||1,nx=-dz/length*(widths[mark.type]||.1),nz=dx/length*(widths[mark.type]||.1);
    const corners=[[mark.a.x+nx,mark.a.z+nz],[mark.a.x-nx,mark.a.z-nz],[mark.b.x-nx,mark.b.z-nz],[mark.b.x+nx,mark.b.z+nz]];
    addTriangle(corners,[0,1,2]);addTriangle(corners,[0,2,3]);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();geometry.computeBoundingSphere();
  const material=new THREE.MeshStandardMaterial({color,roughness:.72,metalness:0,transparent:color!==0xf2efe2,opacity:color!==0xf2efe2 ? .82 : 1,polygonOffset:true,polygonOffsetFactor:-2,side:THREE.DoubleSide});
  const mesh=new THREE.Mesh(geometry,material);mesh.name=name;mesh.receiveShadow=true;mesh.renderOrder=3;return mesh;
}

function dimensions(entry){const d=entry.dimensions||entry.size||{};return [d.width??d[0]??1,d.height??d[1]??1,d.depth??d[2]??1];}
function familyEntries(manifest){
  const entries=Array.isArray(manifest.families)?manifest.families:Object.entries(manifest.families||{}).map(([id,value])=>({id,...value}));
  return new Map(entries.map(entry=>[entry.id||entry.name||entry.nodeName,entry]));
}
function tintClone(root,palette){
  root.traverse(object=>{if(!object.isMesh)return;object.castShadow=true;object.receiveShadow=true;
    object.material=(Array.isArray(object.material)?object.material:[object.material]).map(material=>{
      const clone=material.clone();if(clone.color&&palette){const hsl={};clone.color.getHSL(hsl);clone.color.setHSL((hsl.h+palette*.018)%1,Math.min(.62,hsl.s*1.04),Math.max(.2,Math.min(.78,hsl.l+(palette-1.5)*.025)));}return clone;
    });if(object.material.length===1)object.material=object.material[0];
  });
}

function onBoundary(x,z,polygon,tolerance=.025){
  for(let i=0;i<polygon.length-1;i++){const [ax,az]=polygon[i],[bx,bz]=polygon[i+1],dx=bx-ax,dz=bz-az,t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz||1)));if(Math.hypot(x-(ax+dx*t),z-(az+dz*t))<=tolerance)return true;}return false;
}
function insidePolygon(x,z,polygon){
  if(onBoundary(x,z,polygon))return true;
  let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
    const [xi,zi]=polygon[i],[xj,zj]=polygon[j];if(((zi>z)!==(zj>z))&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside;
  }return inside;
}
export function filterSourceBuildings(sourceRoot,placements){
  const selected=new Set(placements.map(item=>item.sourceBuildingId)),removed=new Map(placements.map(item=>[item.sourceBuildingId,0])),changes=[];
  sourceRoot.updateMatrixWorld(true);
  sourceRoot.traverse(object=>{if(!object.isMesh)return;let ids=[];try{ids=JSON.parse(object.userData.building_ids||'[]');}catch{return;}
    if(!ids.some(id=>selected.has(String(id))))return;
    const source=object.geometry,index=source.index,position=source.attributes.position;if(!index)return;
    const point=new THREE.Vector3(),kept=[];for(let i=0;i<index.count;i+=3){const ia=index.getX(i),ib=index.getX(i+1),ic=index.getX(i+2);point.set((position.getX(ia)+position.getX(ib)+position.getX(ic))/3,(position.getY(ia)+position.getY(ib)+position.getY(ic))/3,(position.getZ(ia)+position.getZ(ib)+position.getZ(ic))/3).applyMatrix4(object.matrixWorld);
      const match=placements.find(item=>point.y>=item.position[1]-.025&&point.y<=item.position[1]+item.envelope[2]+.025&&insidePolygon(point.x,point.z,item.footprint)&&!(item.footprintHoles||[]).some(hole=>insidePolygon(point.x,point.z,hole)));
      if(match)removed.set(match.sourceBuildingId,removed.get(match.sourceBuildingId)+1);else kept.push(ia,ib,ic);
    }
    const filtered=source.clone();filtered.setIndex(kept);filtered.computeBoundingSphere();changes.push({object,original:source,filtered});
  });
  const missed=[...removed].filter(([,count])=>count===0).map(([id])=>id);if(missed.length){for(const change of changes)change.filtered.dispose();throw new Error(`Could not isolate dressed source buildings: ${missed.join(', ')}`);}
  changes.stats={removedTriangles:[...removed.values()].reduce((sum,count)=>sum+count,0),buildings:removed.size};return changes;
}

export async function createStreetScene({network,sourceRoot,invalidate}){
  const [placementResponse,manifestResponse,gltf]=await Promise.all([fetch('/streets/placements.json'),fetch('/streets/building-kit.manifest.json'),new GLTFLoader().loadAsync('/streets/colombo-building-kit.glb')]);
  if(!placementResponse.ok||!manifestResponse.ok)throw new Error('Street dressing data could not load.');
  const [placements,manifest]=await Promise.all([placementResponse.json(),manifestResponse.json()]);
  const group=new THREE.Group();group.name='Dressed Colombo streets';
  const heightAt=createRoadHeightSampler(sourceRoot);
  const buildings=new THREE.Group();buildings.name='Dressed street buildings';group.add(buildings);
  const families=familyEntries(manifest),missingFamilies=placements.placements.filter(placement=>{const entry=families.get(placement.family);return !entry||!gltf.scene.getObjectByName(entry.nodeName||entry.id||placement.family);});
  if(missingFamilies.length)throw new Error(`Building kit is missing families for: ${missingFamilies.map(item=>item.id).join(', ')}`);
  const buildingGeometry=filterSourceBuildings(sourceRoot,placements.placements);
  const asphalt=asphaltTexture(),roadMaterials=[];
  sourceRoot.traverse(object=>{if(!object.isMesh)return;let current=object;while(current&&current.userData.asset_layer!=='01 Roads')current=current.parent;
    if(!current)return;const originals=Array.isArray(object.material)?object.material:[object.material];
    const textured=originals.map(material=>{const clone=material.clone();clone.color.set('#d1d2ce');clone.map=asphalt;clone.bumpMap=asphalt;clone.bumpScale=.015;clone.roughnessMap=null;clone.roughness=.91;clone.metalness=0;clone.envMapIntensity=.18;clone.needsUpdate=true;return clone;}),originalGeometry=object.geometry,texturedGeometry=roadGeometry(originalGeometry);
    roadMaterials.push({object,originalReceiveShadow:object.receiveShadow,original:Array.isArray(object.material)?originals:originals[0],textured:Array.isArray(object.material)?textured:textured[0],originalGeometry,texturedGeometry});
  });
  const markings=deriveRoadMarkings(network),paint=markingMesh(markings.filter(mark=>mark.type!=='arrow'),heightAt,'Inferred lane markings');
  const flow=markingMesh(markings.filter(mark=>mark.type==='arrow'),heightAt,'Inferred traffic flow',0x12a9b2);group.add(paint,flow);
  for(const placement of placements.placements){
    const entry=families.get(placement.family),source=gltf.scene.getObjectByName(entry.nodeName||entry.id||placement.family);
    const clone=source.clone(true);clone.name=placement.id;clone.position.set(0,0,0);clone.rotation.set(0,0,0);clone.scale.set(1,1,1);tintClone(clone,placement.palette);
    const [width,height,depth]=dimensions(entry),envelope=placement.envelope,jitter=placement.scaleJitter||1;
    if(Number.isFinite(placement.scale))clone.scale.setScalar(placement.scale);
    else clone.scale.set(envelope[0]/width*1.04*jitter,envelope[2]/height*jitter,envelope[1]/depth*1.04*jitter);
    clone.position.fromArray(placement.position);clone.rotation.y=placement.yaw;clone.userData.streetFamily=placement.family;buildings.add(clone);
  }
  group.userData.asphalt=asphalt;group.userData.kitScene=gltf.scene;group.userData.roadMaterials=roadMaterials;group.userData.buildingGeometry=buildingGeometry;group.userData.paint=paint;group.userData.flow=flow;group.userData.buildings=buildings;group.userData.heightAt=heightAt;group.userData.placements=placements.placements;invalidate();
  setStreetPresentation(group,{dressed:true,roadsVisible:true,buildingsVisible:true,trafficFlow:false});
  return group;
}

export function setStreetPresentation(group,{dressed=true,roadsVisible=true,buildingsVisible=true,trafficFlow=true}={}){
  if(!group)return;group.visible=dressed;group.userData.paint.visible=roadsVisible;group.userData.flow.visible=roadsVisible&&trafficFlow;group.userData.buildings.visible=buildingsVisible;
  for(const entry of group.userData.roadMaterials){entry.object.receiveShadow=dressed&&roadsVisible?true:entry.originalReceiveShadow;entry.object.material=dressed&&roadsVisible?entry.textured:entry.original;entry.object.geometry=dressed&&roadsVisible?entry.texturedGeometry:entry.originalGeometry;}
  for(const entry of group.userData.buildingGeometry)entry.object.geometry=dressed&&buildingsVisible?entry.filtered:entry.original;
}

export function disposeStreetScene(group){
  const resources=new Set([group?.userData.asphalt]);
  for(const entry of group?.userData.roadMaterials||[]){resources.add(entry.texturedGeometry);for(const material of Array.isArray(entry.textured)?entry.textured:[entry.textured])resources.add(material);entry.object.geometry=entry.originalGeometry;entry.object.material=entry.original;entry.object.receiveShadow=entry.originalReceiveShadow;}
  for(const entry of group?.userData.buildingGeometry||[]){resources.add(entry.filtered);entry.object.geometry=entry.original;}
  group?.traverse(object=>{if(object.geometry)resources.add(object.geometry);for(const material of object.material?(Array.isArray(object.material)?object.material:[object.material]):[]){resources.add(material);for(const value of Object.values(material))if(value?.isTexture)resources.add(value);}});
  for(const resource of resources)resource?.dispose?.();group?.removeFromParent();
}
