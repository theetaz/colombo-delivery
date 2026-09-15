import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createGround,groundRegistryRecords} from './ground.js';
import {attachWind,setWindTime} from './wind.js';

function canvasDocument(){
  return {createElement(tag){assert.equal(tag,'canvas');return {width:0,height:0,getContext(kind){assert.equal(kind,'2d');return {createImageData(width,height){return {width,height,data:new Uint8ClampedArray(width*height*4)};},putImageData(){}};}};}};
}

function vertices(mesh){
  const values=[],attribute=mesh.geometry.attributes.position;
  for(let i=0;i<attribute.count;i++)values.push(new THREE.Vector3().fromBufferAttribute(attribute,i).applyMatrix4(mesh.matrix));
  return values;
}

test('generated ground preserves textured surfaces, open driveway cuts, ramp rise, and aligned metre UVs',()=>{
  const previous=globalThis.document;globalThis.document=canvasDocument();
  try{
    const resources=new Set(),ground=createGround(resources);ground.updateMatrixWorld(true);
    const road=ground.getObjectByName('ground:road-asphalt'),north=ground.getObjectByName('ground:pavement:north');
    assert.ok(road.material.map?.isCanvasTexture,'asphalt keeps its procedural colour map');
    assert.ok(road.material.roughnessMap?.isDataTexture,'asphalt keeps its roughness texture');
    assert.ok(north.material.map?.isCanvasTexture,'paving keeps its procedural concrete map');

    const south=ground.children.filter(object=>object.name.startsWith('ground:pavement:south:'));
    const ramps=ground.children.filter(object=>object.name.startsWith('ground:driveway:'));
    assert.ok(ramps.length>0);assert.ok(south.length>1);
    for(const ramp of ramps){
      const points=vertices(ramp),xs=points.map(point=>point.x),ys=points.map(point=>point.y);
      const xMin=Math.min(...xs),xMax=Math.max(...xs);
      assert.ok(Math.max(...ys)-Math.min(...ys)>.09,'driveway surface rises toward the property');
      const normal=ramp.geometry.attributes.normal;assert.ok(Array.from({length:normal.count},(_,i)=>normal.getY(i)).every(y=>y>.9),'ramp normals point upward');
      for(const slab of south){
        slab.geometry.computeBoundingBox();const slabMin=slab.position.x+slab.geometry.boundingBox.min.x,slabMax=slab.position.x+slab.geometry.boundingBox.max.x;
        assert.ok(slabMax<=xMin+1e-6||slabMin>=xMax-1e-6,'flat paving does not cover a driveway opening');
      }
    }

    const firstRamp=ramps[0],rampPosition=firstRamp.geometry.attributes.position,rampUv=firstRamp.geometry.attributes.uv;
    const boundaryIndex=Array.from({length:rampPosition.count},(_,i)=>i).find(i=>Math.abs(rampPosition.getZ(i)-6.7)<1e-6);
    assert.ok(boundaryIndex>=0);const worldX=rampPosition.getX(boundaryIndex),worldZ=rampPosition.getZ(boundaryIndex);
    assert.ok(Math.abs(rampUv.getX(boundaryIndex)-worldX/2)<1e-6&&Math.abs(rampUv.getY(boundaryIndex)-worldZ/2)<1e-6,'ramp uses the same one-tile-per-two-metres street UV frame');
    const adjacent=south.find(slab=>Math.abs(slab.position.x+slab.geometry.parameters.width/2-worldX)<1e-6||Math.abs(slab.position.x-slab.geometry.parameters.width/2-worldX)<1e-6);
    assert.ok(adjacent,'a paving slab meets the ramp boundary');
    const p=adjacent.geometry.attributes.position,u=adjacent.geometry.attributes.uv;
    const pavingIndex=Array.from({length:p.count},(_,i)=>i).find(i=>Math.abs(p.getX(i)+adjacent.position.x-worldX)<1e-6&&Math.abs(adjacent.position.z-p.getY(i)-worldZ)<1e-6);
    assert.ok(pavingIndex>=0);assert.ok(Math.abs(u.getX(pavingIndex)-rampUv.getX(boundaryIndex))<1e-6&&Math.abs(u.getY(pavingIndex)-rampUv.getY(boundaryIndex))<1e-6,'paving and ramp UVs meet without a texture jump');
  }finally{globalThis.document=previous;}
});

test('ground registry has a unique record for every generated mesh',()=>{
  const previous=globalThis.document;globalThis.document=canvasDocument();
  try{
    const ground=createGround(new Set()),records=groundRegistryRecords(ground),meshes=[];ground.traverse(object=>object.isMesh&&meshes.push(object));
    assert.equal(records.length,meshes.length+1,'records cover all meshes and the ground root');
    assert.equal(new Set(records.map(record=>record.id)).size,records.length,'stable ground IDs are unique');
    for(const mesh of meshes){const record=records.find(value=>value.id===mesh.userData.stableId);assert.ok(record,`${mesh.name} has a registry record`);assert.deepEqual(record.transform.position,mesh.position.toArray());assert.ok(record.shape?.type);}
  }finally{globalThis.document=previous;}
});

test('wind leaves bark untouched and shares time across visible and alpha-cutout shadow shaders',()=>{
  const bark=new THREE.MeshStandardMaterial({name:'Bark_Mottled'}),barkGeometry=new THREE.BoxGeometry(1,2,1),barkMesh=new THREE.InstancedMesh(barkGeometry,bark,1),resources=new Set(),states=new Set();
  barkMesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(3,0,7));const barkBefore=barkMesh.geometry;
  const entry={wind:{enabled:true,materials:['Wind_Broadleaf_Cutout'],rootLockHeight:.18,bendStartHeight:1.2,amplitude:.16,frequency:.55,phaseSeed:.2}};
  assert.equal(attachWind(barkMesh,entry,resources,states),false);assert.equal(barkMesh.material,bark);assert.equal(barkMesh.geometry,barkBefore);assert.equal(barkMesh.customDepthMaterial,undefined);

  const map=new THREE.Texture(),alphaMap=new THREE.Texture(),leaf=new THREE.MeshStandardMaterial({name:'Wind_Broadleaf_Cutout',map,alphaMap,alphaTest:.45,side:THREE.DoubleSide});
  const leafMesh=new THREE.InstancedMesh(new THREE.PlaneGeometry(1,2),leaf,2);
  leafMesh.setMatrixAt(0,new THREE.Matrix4().makeTranslation(3,0,7));leafMesh.setMatrixAt(1,new THREE.Matrix4().makeTranslation(11,0,-5));
  assert.equal(attachWind(leafMesh,entry,resources,states),true);assert.equal(states.size,1);
  assert.ok(leafMesh.geometry.getAttribute('windPhase')?.isInstancedBufferAttribute);assert.ok(leafMesh.geometry.getAttribute('windGroundY')?.isInstancedBufferAttribute);
  assert.notEqual(leafMesh.geometry.getAttribute('windPhase').getX(0),leafMesh.geometry.getAttribute('windPhase').getX(1),'world-separated instances receive distinct stable phases');
  assert.equal(leafMesh.customDepthMaterial.map,map);assert.equal(leafMesh.customDepthMaterial.alphaMap,alphaMap);assert.equal(leafMesh.customDepthMaterial.alphaTest,.45);assert.equal(leafMesh.customDepthMaterial.side,THREE.DoubleSide);

  const visible={uniforms:{},vertexShader:'#include <begin_vertex>'},depth={uniforms:{},vertexShader:'#include <begin_vertex>'};
  leafMesh.material.onBeforeCompile(visible);leafMesh.customDepthMaterial.onBeforeCompile(depth);const [state]=states;
  assert.equal(visible.uniforms.windTime,state.time);assert.equal(depth.uniforms.windTime,state.time);assert.match(visible.vertexShader,/smoothstep/);assert.match(depth.vertexShader,/smoothstep/);
  setWindTime(states,4.25);assert.equal(visible.uniforms.windTime.value,4.25);assert.equal(depth.uniforms.windTime.value,4.25);
});
