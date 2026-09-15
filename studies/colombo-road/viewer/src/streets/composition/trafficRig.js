import * as THREE from 'three';

export function solveKnee3D(hip,target,upperLength,lowerLength,pole){
  const delta=target.map((value,index)=>value-hip[index]),distance=Math.hypot(...delta),d=Math.max(.000001,Math.min(distance,upperLength+lowerLength-.000001)),axis=delta.map(value=>value/(distance||1)),projection=pole.map((value,index)=>value-hip[index]),dot=projection.reduce((sum,value,index)=>sum+value*axis[index],0),perp=projection.map((value,index)=>value-dot*axis[index]),perpLength=Math.hypot(...perp),bend=perp.map(value=>value/(perpLength||1)),along=(upperLength*upperLength+d*d-lowerLength*lowerLength)/(2*d),height=Math.sqrt(Math.max(0,upperLength*upperLength-along*along));
  return hip.map((value,index)=>value+axis[index]*along+bend[index]*height);
}

export function createPedalingRig(root,motion={}){
  const crank=root?.getObjectByName(motion.crankNode),chains=(motion.pedaling?.chains||[]).map(chain=>({chain,hip:root.getObjectByName(chain.hip),knee:root.getObjectByName(chain.knee),foot:root.getObjectByName(chain.foot),target:root.getObjectByName(chain.target)}));
  return setupPedalingRig({root,crank,chains,contactError:0});
}

export function setupPedalingRig(rig){
  if(!rig?.root||!rig.crank)return rig;
  rig.root.updateMatrixWorld(true);
  for(const item of rig.chains){
    if(!item.hip||!item.knee||!item.foot||!item.target)continue;
    const poleWorld=new THREE.Vector3();item.knee.getWorldPosition(poleWorld);
    item.base={hipQuaternion:item.hip.quaternion.clone(),kneeQuaternion:item.knee.quaternion.clone(),footQuaternion:item.foot.quaternion.clone(),targetQuaternion:item.target.quaternion.clone(),hipPosition:item.hip.position.clone(),kneePosition:item.knee.position.clone(),footPosition:item.foot.position.clone(),poleParent:item.hip.parent.worldToLocal(poleWorld.clone())};
  }
  return rig;
}

export function applyPedaling(rig,turn){
  if(!rig?.crank||!rig.chains?.length)return 0;
  rig.crank.rotation.x+=turn;
  for(const item of rig.chains)if(item.target&&item.base)item.target.quaternion.copy(item.base.targetQuaternion).premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1,0,0),-rig.crank.rotation.x));
  rig.root.updateMatrixWorld(true);rig.contactError=0;
  const targetWorld=new THREE.Vector3(),hipWorld=new THREE.Vector3(),kneeWorld=new THREE.Vector3(),footWorld=new THREE.Vector3(),desired=new THREE.Vector3(),restDirection=new THREE.Vector3(),delta=new THREE.Quaternion(),parentInverse=new THREE.Matrix4(),targetParent=new THREE.Vector3(),hipParent=new THREE.Vector3(),poleParent=new THREE.Vector3(),targetQuaternion=new THREE.Quaternion(),parentQuaternion=new THREE.Quaternion();
  for(const item of rig.chains){
    const {chain,hip,knee,foot,target,base}=item;if(!base)continue;
    hip.position.copy(base.hipPosition);knee.position.copy(base.kneePosition);foot.position.copy(base.footPosition);hip.quaternion.copy(base.hipQuaternion);knee.quaternion.copy(base.kneeQuaternion);foot.quaternion.copy(base.footQuaternion);
    rig.root.updateMatrixWorld(true);target.getWorldPosition(targetWorld);hip.getWorldPosition(hipWorld);
    parentInverse.copy(hip.parent.matrixWorld).invert();targetParent.copy(targetWorld).applyMatrix4(parentInverse);hipParent.copy(hip.position);poleParent.copy(base.poleParent);
    const kneePoint=solveKnee3D(hipParent.toArray(),targetParent.toArray(),chain.rest.upperLength,chain.rest.lowerLength,poleParent.toArray());
    desired.fromArray(kneePoint).sub(hipParent).normalize();restDirection.copy(base.kneePosition).applyQuaternion(base.hipQuaternion).normalize();delta.setFromUnitVectors(restDirection,desired);hip.quaternion.copy(base.hipQuaternion).premultiply(delta);
    rig.root.updateMatrixWorld(true);target.getWorldPosition(targetWorld);knee.getWorldPosition(kneeWorld);parentInverse.copy(knee.parent.matrixWorld).invert();targetParent.copy(targetWorld).applyMatrix4(parentInverse);desired.copy(targetParent).sub(knee.position).normalize();restDirection.copy(base.footPosition).applyQuaternion(base.kneeQuaternion).normalize();delta.setFromUnitVectors(restDirection,desired);knee.quaternion.copy(base.kneeQuaternion).premultiply(delta);
    rig.root.updateMatrixWorld(true);target.getWorldQuaternion(targetQuaternion);foot.parent.getWorldQuaternion(parentQuaternion);foot.quaternion.copy(parentQuaternion.invert().multiply(targetQuaternion));rig.root.updateMatrixWorld(true);
    foot.getWorldPosition(footWorld);target.getWorldPosition(targetWorld);rig.contactError=Math.max(rig.contactError,footWorld.distanceTo(targetWorld));
  }
  return rig.contactError;
}
