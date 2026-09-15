import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {applyPedaling,createPedalingRig} from './trafficRig.js';
import trafficManifest from '../../../public/streets/composition/traffic.manifest.json' with {type:'json'};

const glbUrl=new URL('../../../public/streets/composition/traffic.glb',import.meta.url),entry=trafficManifest.assets.find(item=>item.assetId==='traffic-bicycle-rider');
async function loadBicycle(){const buffer=readFileSync(glbUrl),arrayBuffer=buffer.buffer.slice(buffer.byteOffset,buffer.byteOffset+buffer.byteLength),gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(arrayBuffer,'',resolve,reject));return gltf.scene.getObjectByName(entry.nodeName).clone(true);}
const worldPoint=(object,target=new THREE.Vector3())=>object.getWorldPosition(target);

for(const [label,yaw,position] of [['eastbound',Math.PI/2,[17,0,-1.9]],['westbound',-Math.PI/2,[-23,0,1.9]]])test(`actual exported bicycle holds contacts through 144 crank samples ${label}`,async()=>{
  const root=await loadBicycle();root.position.fromArray(position);root.rotation.y=yaw;root.updateMatrixWorld(true);
  const rig=createPedalingRig(root,entry.motion),hands=['TRAFFIC_BicycleRider__Arm_L__Hand','TRAFFIC_BicycleRider__Arm_R__Hand'].map(name=>root.getObjectByName(name)),handRest=hands.map(hand=>worldPoint(hand).clone()),step=Math.PI*2/144;
  assert.ok(rig.crank);assert.equal(rig.chains.length,2);
  for(const item of rig.chains){assert.strictEqual(item.foot.parent,item.knee);assert.strictEqual(item.knee.parent,item.hip);assert.ok(item.target.parent===rig.crank);}
  for(let sample=0;sample<144;sample++){
    const error=applyPedaling(rig,step);assert.ok(error<.002,`sample ${sample}: contact ${error}`);
    for(const item of rig.chains){const hip=worldPoint(item.hip),knee=worldPoint(item.knee),foot=worldPoint(item.foot),pedal=worldPoint(item.target);assert.ok(Math.abs(hip.distanceTo(knee)-item.chain.rest.upperLength)<1e-5);assert.ok(Math.abs(knee.distanceTo(foot)-item.chain.rest.lowerLength)<1e-5);assert.ok(foot.distanceTo(pedal)<.002);const fq=new THREE.Quaternion(),pq=new THREE.Quaternion();item.foot.getWorldQuaternion(fq);item.target.getWorldQuaternion(pq);assert.ok(fq.angleTo(pq)<1e-5,'shoe and pedal orientations diverged');}
    hands.forEach((hand,index)=>assert.ok(worldPoint(hand).distanceTo(handRest[index])<1e-6,'fixed hand moved'));
  }
});
