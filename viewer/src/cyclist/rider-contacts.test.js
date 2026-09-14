import test from 'node:test';
import assert from 'node:assert/strict';
import {AnimationMixer, Group, Quaternion, Vector3} from 'three';
import {loadGeometry} from './test-assets.js';
import {createRiderContacts} from './rider-contacts.js';

test('steering reaches both grips without twisting ankles or accumulating wrist rotation', async () => {
  const r = await loadGeometry('courier-movement.glb'), b = await loadGeometry('bicycle-fitted.glb');
  const world = new Group(), rider = r.scene, bike = b.scene;
  world.add(rider, bike);
  const mixer = new AnimationMixer(rider), pedal = r.animations.find(c => c.name.includes('Pedal'));
  const action = mixer.clipAction(pedal).play(); action.paused = true; action.time = .37;
  mixer.update(0); world.updateMatrixWorld(true);
  const contacts = createRiderContacts(rider, bike), front = bike.getObjectByName('FrontAssembly');
  const rest = front.quaternion.clone();
  const feet = ['L','R'].map(side => {
    const bone = rider.getObjectByName('Foot_' + side);
    return {bone, position: bone.getWorldPosition(new Vector3()), rotation: bone.getWorldQuaternion(new Quaternion())};
  });
  const grips = ['L','R'].map(side => {
    const hand = rider.getObjectByName('Hand_' + side), grip = bike.getObjectByName('Grip_' + side + '_Attach');
    return {hand, grip, offset: grip.worldToLocal(hand.getWorldPosition(new Vector3())),
      rotation: grip.getWorldQuaternion(new Quaternion()).invert().multiply(hand.getWorldQuaternion(new Quaternion()))};
  });
  for (const yaw of [0, 1.3, -2.1]) {
    world.rotation.set(.05, yaw, .18);
    for (let frame = 0; frame < 240; frame++) {
      const steer = Math.sin(frame / 20) * .52;
      contacts.restore(); mixer.update(0); contacts.capture();
      front.quaternion.copy(rest).multiply(new Quaternion().setFromAxisAngle(new Vector3(0,1,0), steer));
      world.updateMatrixWorld(true); contacts.solve();
      for (const {bone, position, rotation} of feet) {
        assert.ok(bone.getWorldPosition(new Vector3()).distanceTo(world.localToWorld(position.clone())) < 1e-5, 'ankle position changed with steering');
        assert.ok(bone.getWorldQuaternion(new Quaternion()).normalize().angleTo(world.getWorldQuaternion(new Quaternion()).multiply(rotation).normalize()) < 1e-5, `ankle rotated with steering ${bone.name} frame=${frame} angle=${bone.getWorldQuaternion(new Quaternion()).normalize().angleTo(world.getWorldQuaternion(new Quaternion()).multiply(rotation).normalize())}`);
      }
      for (const {hand, grip, offset, rotation} of grips) {
        assert.ok(hand.getWorldPosition(new Vector3()).distanceTo(grip.localToWorld(offset.clone())) < .005, 'hand lost grip contact');
        assert.ok(hand.getWorldQuaternion(new Quaternion()).normalize().angleTo(grip.getWorldQuaternion(new Quaternion()).multiply(rotation).normalize()) < 1e-5, 'wrist twist accumulated');
      }
    }
  }
});
