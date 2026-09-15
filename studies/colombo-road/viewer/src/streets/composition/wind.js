import * as THREE from 'three';

const TAU=Math.PI*2;
const number=(value,fallback)=>Number.isFinite(value)?value:fallback;
const eligible=(material,names)=>!!material&&(names.has(material.name)||material.name?.startsWith('Wind_'));

function stablePhase(x,z,seed){
  const value=Math.sin(x*12.9898+z*78.233+seed*37.719)*43758.5453;
  return value-Math.floor(value);
}

function instanceAttributes(mesh,seed){
  if(!mesh.isInstancedMesh)return;
  const matrix=new THREE.Matrix4(),position=new THREE.Vector3(),phase=new Float32Array(mesh.count),ground=new Float32Array(mesh.count);
  for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,matrix);position.setFromMatrixPosition(matrix);phase[i]=stablePhase(position.x,position.z,seed);ground[i]=position.y;}
  mesh.geometry=mesh.geometry.clone();mesh.geometry.setAttribute('windPhase',new THREE.InstancedBufferAttribute(phase,1));mesh.geometry.setAttribute('windGroundY',new THREE.InstancedBufferAttribute(ground,1));return mesh.geometry;
}

function shaderPatch(shader,mesh,wind,state){
  const instanced=mesh.isInstancedMesh,root=number(wind.rootLockHeight,0),bend=Math.max(root+.01,number(wind.bendStartHeight,root+.1));
  shader.uniforms.windTime=state.time;shader.uniforms.windWorldPhase=state.phase;
  const declarations=`uniform float windTime; uniform float windWorldPhase;${instanced?' attribute float windPhase; attribute float windGroundY;':''}`;
  const localHeight=instanced?'(instanceMatrix * vec4(position,1.0)).y - windGroundY':'position.y';
  const phase=instanced?'windPhase * 6.28318530718':'windWorldPhase';
  const deformation=`
    float windHeight=${localHeight};
    float windWeight=smoothstep(${root.toFixed(5)},${bend.toFixed(5)},windHeight);
    float windWave=sin(windTime*${number(wind.frequency,.55).toFixed(5)}+${phase}+windHeight*.17);
    transformed.x += windWave*${number(wind.amplitude,.08).toFixed(5)}*windWeight;
    transformed.z += cos(windTime*${(number(wind.frequency,.55)*.73).toFixed(5)}+${phase})*${(number(wind.amplitude,.08)*.28).toFixed(5)}*windWeight;`;
  shader.vertexShader=`${declarations}\n${shader.vertexShader}`.replace('#include <begin_vertex>',`#include <begin_vertex>${deformation}`);
}

function depthMaterial(base,mesh,wind,state,key){
  const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:base.map||null,alphaMap:base.alphaMap||null,alphaTest:base.alphaTest||0,side:base.side});
  depth.name=`${base.name}:WindDepth`;depth.onBeforeCompile=shader=>shaderPatch(shader,mesh,wind,state);depth.customProgramCacheKey=()=>`${key}:depth`;
  return depth;
}

export function attachWind(mesh,prefabEntry={},resources=new Set(),windStates=new Set()){
  const wind=prefabEntry.wind;if(!mesh?.isMesh||!wind?.enabled)return false;
  const names=new Set(wind.materials||[]),materials=Array.isArray(mesh.material)?mesh.material:[mesh.material],flags=materials.map(value=>eligible(value,names));
  if(!flags.some(Boolean))return false;
  // A mixed rigid/flexible multi-material draw cannot deform shadows by group;
  // authored landscape assets keep one material per mesh to avoid moving bark.
  if(flags.some(Boolean)&&flags.some(value=>!value)){mesh.userData.windWarning='mixed rigid and flexible materials; wind skipped to keep rigid shadow geometry stationary';return false;}
  const geometry=instanceAttributes(mesh,number(wind.phaseSeed,0));if(geometry)resources.add(geometry);
  mesh.updateWorldMatrix(true,false);const world=new THREE.Vector3();mesh.getWorldPosition(world);
  const state={time:{value:0},phase:{value:stablePhase(world.x,world.z,number(wind.phaseSeed,0))},mesh};
  const key=`wind-v2:${number(wind.rootLockHeight,0)}:${number(wind.bendStartHeight,.1)}:${number(wind.amplitude,.08)}:${number(wind.frequency,.55)}:${mesh.isInstancedMesh?'i':'m'}`;
  const patched=materials.map(base=>{const value=base.clone();value.onBeforeCompile=shader=>shaderPatch(shader,mesh,wind,state);value.customProgramCacheKey=()=>`${key}:color:${base.name}`;value.needsUpdate=true;resources.add(value);return value;});
  mesh.material=Array.isArray(mesh.material)?patched:patched[0];
  mesh.customDepthMaterial=depthMaterial(materials[0],mesh,wind,state,key);resources.add(mesh.customDepthMaterial);
  mesh.geometry.computeBoundingBox();mesh.geometry.boundingBox.expandByScalar(number(wind.amplitude,.08));mesh.geometry.computeBoundingSphere();mesh.geometry.boundingSphere.radius+=number(wind.amplitude,.08);
  mesh.frustumCulled=true;windStates.add(state);return true;
}

export function setWindTime(windStates,time){for(const state of windStates)state.time.value=time;}
