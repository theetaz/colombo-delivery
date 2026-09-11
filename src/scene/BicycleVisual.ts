import * as THREE from "three";

import type { BicycleState, PrototypeObstacle } from "../game/bicycle";

const WHEEL_RADIUS = 0.34;
const WHEELBASE = 1.08;
const FRAME_RADIUS = 0.025;

export class BicycleVisual {
  readonly group = new THREE.Group();

  private readonly wheels: THREE.Group[] = [];
  private readonly frontAssembly = new THREE.Group();
  private readonly crank = new THREE.Group();

  constructor() {
    this.group.name = "Rider bicycle";

    const rubber = new THREE.MeshStandardMaterial({ color: 0x171a19, roughness: 0.82 });
    const metal = new THREE.MeshStandardMaterial({ color: 0xd8ddd7, roughness: 0.38, metalness: 0.7 });
    const frame = new THREE.MeshStandardMaterial({ color: 0xd85e2f, roughness: 0.54, metalness: 0.08 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x2b3532, roughness: 0.78 });
    const riderTop = new THREE.MeshStandardMaterial({ color: 0xf2c75f, roughness: 0.9 });
    const riderBottom = new THREE.MeshStandardMaterial({ color: 0x244d55, roughness: 0.88 });
    const skin = new THREE.MeshStandardMaterial({ color: 0x8b5136, roughness: 0.92 });
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.52, 20),
      new THREE.MeshBasicMaterial({ color: 0x18221f, transparent: true, opacity: 0.2, depthWrite: false }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.scale.y = 1.75;
    shadow.position.y = 0.006;
    shadow.renderOrder = 4;
    this.group.add(shadow);

    const rearZ = WHEELBASE / 2;
    const frontZ = -WHEELBASE / 2;
    const rearWheel = makeWheel(rubber, metal);
    rearWheel.position.set(0, WHEEL_RADIUS, rearZ);
    this.group.add(rearWheel);
    this.wheels.push(rearWheel);

    this.frontAssembly.position.set(0, 0, frontZ);
    const frontWheel = makeWheel(rubber, metal);
    frontWheel.position.y = WHEEL_RADIUS;
    this.frontAssembly.add(frontWheel);
    this.wheels.push(frontWheel);

    const forkCrown = new THREE.Vector3(0, 0.79, 0.08);
    this.frontAssembly.add(
      tube(new THREE.Vector3(-0.035, WHEEL_RADIUS, 0), new THREE.Vector3(-0.035, forkCrown.y, forkCrown.z), 0.018, metal),
      tube(new THREE.Vector3(0.035, WHEEL_RADIUS, 0), new THREE.Vector3(0.035, forkCrown.y, forkCrown.z), 0.018, metal),
      tube(new THREE.Vector3(0, 0.77, 0.06), new THREE.Vector3(0, 1.04, 0.13), 0.021, metal),
    );
    const handlebars = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.6, 8), dark);
    handlebars.rotation.z = Math.PI / 2;
    handlebars.position.set(0, 1.04, 0.13);
    this.frontAssembly.add(handlebars);
    this.group.add(this.frontAssembly);

    const crankPoint = new THREE.Vector3(0, 0.45, 0.06);
    const seatTubeTop = new THREE.Vector3(0, 0.84, 0.31);
    const headBottom = new THREE.Vector3(0, 0.72, frontZ + 0.08);
    this.group.add(
      tube(new THREE.Vector3(0, WHEEL_RADIUS, rearZ), crankPoint, FRAME_RADIUS, frame),
      tube(crankPoint, seatTubeTop, FRAME_RADIUS, frame),
      tube(seatTubeTop, new THREE.Vector3(0, 0.78, frontZ + 0.09), FRAME_RADIUS, frame),
      tube(crankPoint, headBottom, FRAME_RADIUS, frame),
      tube(new THREE.Vector3(0, WHEEL_RADIUS, rearZ), seatTubeTop, FRAME_RADIUS, frame),
      tube(seatTubeTop, new THREE.Vector3(0, 0.98, 0.38), 0.018, metal),
    );

    const saddle = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.055, 0.38), dark);
    saddle.position.set(0, 1.01, 0.39);
    saddle.rotation.x = -0.05;
    this.group.add(saddle);

    this.crank.position.copy(crankPoint);
    const crankAxle = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.035, 16), metal);
    crankAxle.rotation.z = Math.PI / 2;
    this.crank.add(crankAxle);
    const crankArm = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.36, 0.025), metal);
    this.crank.add(crankArm);
    const pedalA = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.035, 0.08), dark);
    pedalA.position.set(0.1, 0.18, 0);
    const pedalB = pedalA.clone();
    pedalB.position.set(-0.1, -0.18, 0);
    this.crank.add(pedalA, pedalB);
    this.group.add(this.crank);

    const hip = new THREE.Vector3(0, 1.08, 0.34);
    const shoulder = new THREE.Vector3(0, 1.58, 0.04);
    const torso = tube(hip, shoulder, 0.13, riderTop);
    torso.scale.x = 0.68;
    this.group.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.115, 14, 10), skin);
    head.position.set(0, 1.76, -0.06);
    this.group.add(head);

    const leftHand = new THREE.Vector3(-0.22, 1.04, frontZ + 0.13);
    const rightHand = new THREE.Vector3(0.22, 1.04, frontZ + 0.13);
    this.group.add(
      tube(new THREE.Vector3(-0.1, 1.5, 0), leftHand, 0.033, skin),
      tube(new THREE.Vector3(0.1, 1.5, 0), rightHand, 0.033, skin),
      tube(new THREE.Vector3(-0.065, 1.08, 0.33), new THREE.Vector3(-0.08, 0.63, 0.02), 0.045, riderBottom),
      tube(new THREE.Vector3(0.065, 1.08, 0.33), new THREE.Vector3(0.08, 0.3, 0.05), 0.045, riderBottom),
    );

    this.group.traverse((object) => {
      if (object instanceof THREE.Mesh) {
        object.castShadow = true;
        object.receiveShadow = true;
      }
    });
  }

  update(state: BicycleState): void {
    const surfaceHeight = state.surface === "road" ? 0.14 : -0.055;
    this.group.position.set(state.x, state.y + surfaceHeight, state.z);
    this.group.rotation.y = -state.heading;
    this.frontAssembly.rotation.y = -state.steering * 0.34;
    const wheelRotation = -state.distanceTravelled / WHEEL_RADIUS;
    for (const wheel of this.wheels) wheel.rotation.x = wheelRotation;
    this.crank.rotation.x = wheelRotation * 0.62;
  }
}

export function makeObstacleVisual(obstacle: PrototypeObstacle): THREE.Group {
  const group = new THREE.Group();
  group.name = obstacle.label;
  group.position.set(obstacle.x, obstacle.y - 0.075, obstacle.z);

  const warning = new THREE.MeshStandardMaterial({ color: 0xf09032, roughness: 0.74 });
  const pale = new THREE.MeshStandardMaterial({ color: 0xf8edcf, roughness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x263a35, roughness: 0.9 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(obstacle.radius * 0.9, obstacle.radius, 0.12, 16), dark);
  base.position.y = 0.06;
  group.add(base);

  const postHeight = Math.max(0.7, obstacle.radius * 1.7);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(obstacle.radius * 0.58, postHeight, 16), warning);
  cone.position.y = 0.12 + postHeight / 2;
  group.add(cone);
  const band = new THREE.Mesh(new THREE.CylinderGeometry(obstacle.radius * 0.36, obstacle.radius * 0.45, 0.12, 16), pale);
  band.position.y = 0.12 + postHeight * 0.52;
  group.add(band);

  group.traverse((object) => {
    if (object instanceof THREE.Mesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return group;
}

function makeWheel(
  rubber: THREE.MeshStandardMaterial,
  metal: THREE.MeshStandardMaterial,
): THREE.Group {
  const wheel = new THREE.Group();
  const tyre = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS, 0.025, 8, 28), rubber);
  tyre.rotation.y = Math.PI / 2;
  wheel.add(tyre);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_RADIUS - 0.035, 0.009, 6, 28), metal);
  rim.rotation.y = Math.PI / 2;
  wheel.add(rim);
  for (let index = 0; index < 10; index += 1) {
    const angle = (index / 10) * Math.PI * 2;
    wheel.add(tube(
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0, Math.cos(angle) * (WHEEL_RADIUS - 0.04), Math.sin(angle) * (WHEEL_RADIUS - 0.04)),
      0.0035,
      metal,
    ));
  }
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.12, 10), metal);
  hub.rotation.z = Math.PI / 2;
  wheel.add(hub);
  return wheel;
}

function tube(
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const midpoint = start.clone().add(end).multiplyScalar(0.5);
  const direction = end.clone().sub(start);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, direction.length(), 8), material);
  mesh.position.copy(midpoint);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  return mesh;
}
