import {Quaternion, Vector3} from 'three';

// Call with the authored seated pose and straight handlebars. Contacts belong
// to the grips; steering never changes a thigh, shin or foot transform.
export function createRiderContacts(rider, bicycle) {
  rider.updateWorldMatrix(true, true);
  bicycle.updateWorldMatrix(true, true);
  const arms = ['L', 'R'].map((side, index) => {
    const upper = rider.getObjectByName(`UpperArm_${side}`);
    const lower = rider.getObjectByName(`Forearm_${side}`);
    const hand = rider.getObjectByName(`Hand_${side}`);
    const grip = bicycle.getObjectByName(`Grip_${side}_Attach`);
    const wrist = hand.getWorldPosition(new Vector3());
    return {
      upper, lower, hand, grip, sign: index ? 1 : -1,
      wrist: grip.worldToLocal(wrist.clone()),
      palm: grip.getWorldQuaternion(new Quaternion()).invert()
        .multiply(hand.getWorldQuaternion(new Quaternion())),
      bones: [upper, lower, hand].map(bone => ({bone, rotation: bone.quaternion.clone()})),
    };
  });

  function aim(bone, from, to) {
    const delta = new Quaternion().setFromUnitVectors(from.normalize(), to.normalize());
    const world = bone.getWorldQuaternion(new Quaternion());
    const parent = bone.parent.getWorldQuaternion(new Quaternion());
    bone.quaternion.copy(parent.invert().multiply(delta).multiply(world));
    bone.updateWorldMatrix(false, true);
  }

  return {
    // AnimationMixer can skip unchanged tracks. Restore the previous authored
    // arm pose BEFORE sampling so procedural corrections cannot accumulate.
    restore() {
      for (const arm of arms) for (const p of arm.bones) p.bone.quaternion.copy(p.rotation);
    },
    capture() {
      for (const arm of arms) for (const p of arm.bones) p.rotation.copy(p.bone.quaternion);
    },
    solve() {
      rider.updateWorldMatrix(true, true);
      bicycle.updateWorldMatrix(true, true);
      for (const {upper, lower, hand, grip, wrist, palm, sign} of arms) {
        const root = upper.getWorldPosition(new Vector3());
        const elbow = lower.getWorldPosition(new Vector3());
        const end = hand.getWorldPosition(new Vector3());
        const target = grip.localToWorld(wrist.clone());
        const direction = target.clone().sub(root);
        const l1 = root.distanceTo(elbow), l2 = elbow.distanceTo(end);
        const d = Math.max(.001, Math.min(direction.length(), l1 + l2 - .00001));
        direction.normalize();
        const along = (l1 * l1 - l2 * l2 + d * d) / (2 * d);
        const pole = rider.localToWorld(new Vector3(sign * .5, 1.05, .05)).sub(root);
        pole.addScaledVector(direction, -pole.dot(direction)).normalize();
        const joint = root.clone().addScaledVector(direction, along)
          .addScaledVector(pole, Math.sqrt(Math.max(0, l1 * l1 - along * along)));
        aim(upper, elbow.sub(root), joint.clone().sub(root));
        const movedElbow = lower.getWorldPosition(new Vector3());
        aim(lower, hand.getWorldPosition(new Vector3()).sub(movedElbow), target.sub(movedElbow));
        // Palm orientation follows the actual tilted steering assembly, not a
        // world-Y twist layered onto last frame's already rotated wrist.
        hand.quaternion.copy(hand.parent.getWorldQuaternion(new Quaternion()).invert()
          .multiply(grip.getWorldQuaternion(new Quaternion())).multiply(palm));
        hand.updateWorldMatrix(false, true);
      }
    },
  };
}
