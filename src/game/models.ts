import * as THREE from 'three';
import { GameMaterialLibrary } from './textures';
import { EnemyArchetype } from './types';

export interface ArticulatedSamuraiRig {
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  head: THREE.Group;
  rightShoulder: THREE.Group;
  rightForearm: THREE.Group;
  leftShoulder: THREE.Group;
  leftForearm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  haori: THREE.Mesh;
  weaponPivot: THREE.Group;
  bladeGlowMesh: THREE.Mesh;
  offhandWeapon?: THREE.Group;
  shadowDisc: THREE.Mesh;
}

// Shared low-poly, crisp procedural geometries so multiple actors share GPU buffers
const sharedGeos = {
  bladeGeo: (() => {
    const shape = new THREE.Shape();
    shape.moveTo(0, 0);
    shape.lineTo(0.032, 0.04);
    shape.quadraticCurveTo(0.055, 0.55, 0.018, 1.05);
    shape.lineTo(0, 1.12);
    shape.lineTo(-0.012, 1.03);
    shape.quadraticCurveTo(0.015, 0.55, -0.015, 0.02);
    shape.closePath();

    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.008,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 1,
    });
    geo.center();
    // Re-pivot so y=0 is at the hilt base and blade extends +Y
    geo.translate(0, 0.54, 0);
    return geo;
  })(),

  crestGeo: (() => {
    const shape = new THREE.Shape();
    shape.moveTo(-0.24, 0.14);
    shape.quadraticCurveTo(0, -0.02, 0.24, 0.14);
    shape.quadraticCurveTo(0, 0.06, -0.24, 0.14);
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: 0.018,
      bevelEnabled: true,
      bevelThickness: 0.005,
      bevelSize: 0.004,
      bevelSegments: 1,
    });
    geo.translate(0, 0, -0.009);
    return geo;
  })(),

  torsoGeo: new THREE.BoxGeometry(0.46, 0.52, 0.28),
  chestPlateGeo: new THREE.BoxGeometry(0.5, 0.34, 0.32),
  pauldronsGeo: new THREE.BoxGeometry(0.18, 0.14, 0.26),
  hakamaGeo: new THREE.CylinderGeometry(0.24, 0.31, 0.44, 8),
  legGeo: new THREE.BoxGeometry(0.15, 0.46, 0.16),
  upperArmGeo: new THREE.BoxGeometry(0.13, 0.28, 0.13),
  forearmGeo: new THREE.BoxGeometry(0.11, 0.26, 0.11),
  headGeo: new THREE.BoxGeometry(0.24, 0.24, 0.24),
  kabutoDomeGeo: new THREE.CylinderGeometry(0.16, 0.23, 0.16, 8),
  kasaHatGeo: new THREE.ConeGeometry(0.36, 0.18, 10),
  visorGeo: new THREE.BoxGeometry(0.2, 0.045, 0.04),
  hiltGeo: new THREE.CylinderGeometry(0.02, 0.022, 0.26, 6),
  tsubaGeo: new THREE.CylinderGeometry(0.065, 0.065, 0.018, 10),
  bladeEdgeGeo: new THREE.BoxGeometry(0.014, 1.05, 0.018),
  kanaboGeo: new THREE.CylinderGeometry(0.065, 0.032, 1.35, 8),
  haoriGeo: new THREE.BoxGeometry(0.42, 0.58, 0.04),
  shadowDiscGeo: new THREE.PlaneGeometry(1.35, 1.35),
};

export function createHeroSamuraiRig(mats: GameMaterialLibrary): ArticulatedSamuraiRig {
  return buildSamuraiRig({
    armorMat: mats.heroWhiteArmor,
    clothMat: mats.heroCobaltCloth,
    accentMat: mats.vermilionLacquer,
    trimMat: mats.brushedTitanium,
    bladeMat: mats.heroSteelBlade,
    glowMat: mats.heroBladeGlow.clone(),
    shadowMat: mats.contactShadow,
    style: 'hero',
    scale: 1,
  });
}

export function createEnemySamuraiRig(
  mats: GameMaterialLibrary,
  archetype: EnemyArchetype,
  isBoss: boolean,
): ArticulatedSamuraiRig {
  const scale = isBoss ? 1.18 : archetype === 'enforcer' ? 1.14 : archetype === 'shinobi' ? 0.96 : 1.0;
  const armorMat =
    isBoss
      ? mats.enemyObsidianArmor
      : archetype === 'enforcer'
        ? mats.enemyCrimsonArmor
        : archetype === 'shinobi'
          ? mats.enemyObsidianArmor
          : mats.enemySlateArmor;

  const glowMat = new THREE.MeshBasicMaterial({
    color: isBoss ? 0xe12d39 : archetype === 'shinobi' ? 0x0284c7 : 0xf59e0b,
  });

  return buildSamuraiRig({
    armorMat,
    clothMat: mats.enemyObsidianArmor,
    accentMat: isBoss ? mats.vermilionLacquer : mats.enemyGoldTrim,
    trimMat: isBoss ? mats.enemyGoldTrim : mats.brushedTitanium,
    bladeMat: mats.enemyBladeSteel,
    glowMat,
    shadowMat: mats.contactShadow,
    style: archetype,
    scale,
  });
}

function buildSamuraiRig(opts: {
  armorMat: THREE.Material;
  clothMat: THREE.Material;
  accentMat: THREE.Material;
  trimMat: THREE.Material;
  bladeMat: THREE.Material;
  glowMat: THREE.MeshBasicMaterial;
  shadowMat: THREE.Material;
  style: 'hero' | EnemyArchetype;
  scale: number;
}): ArticulatedSamuraiRig {
  const root = new THREE.Group();
  root.scale.setScalar(opts.scale);

  // Contact shadow disc grounded at y = 0.015
  const shadowDisc = new THREE.Mesh(sharedGeos.shadowDiscGeo, opts.shadowMat);
  shadowDisc.rotation.x = -Math.PI / 2;
  shadowDisc.position.y = 0.018;
  root.add(shadowDisc);

  // Hips pivot at waist height (~0.88m)
  const hips = new THREE.Group();
  hips.position.y = 0.88;
  root.add(hips);

  // Hakama skirt
  const hakama = new THREE.Mesh(sharedGeos.hakamaGeo, opts.clothMat);
  hakama.position.y = -0.14;
  hakama.castShadow = true;
  hakama.receiveShadow = true;
  hips.add(hakama);

  // Legs
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.13, -0.18, 0);
  const leftLegMesh = new THREE.Mesh(sharedGeos.legGeo, opts.clothMat);
  leftLegMesh.position.y = -0.28;
  leftLegMesh.castShadow = true;
  leftLeg.add(leftLegMesh);
  hips.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.13, -0.18, 0);
  const rightLegMesh = new THREE.Mesh(sharedGeos.legGeo, opts.clothMat);
  rightLegMesh.position.y = -0.28;
  rightLegMesh.castShadow = true;
  rightLeg.add(rightLegMesh);
  hips.add(rightLeg);

  // Torso
  const torso = new THREE.Group();
  torso.position.y = 0.05;
  hips.add(torso);

  const torsoCore = new THREE.Mesh(sharedGeos.torsoGeo, opts.clothMat);
  torsoCore.position.y = 0.24;
  torsoCore.castShadow = true;
  torsoCore.receiveShadow = true;
  torso.add(torsoCore);

  const chestArmor = new THREE.Mesh(sharedGeos.chestPlateGeo, opts.armorMat);
  chestArmor.position.y = 0.28;
  chestArmor.castShadow = true;
  chestArmor.receiveShadow = true;
  torso.add(chestArmor);

  // Dynamic back Haori/Scarf accent
  const haori = new THREE.Mesh(sharedGeos.haoriGeo, opts.accentMat);
  haori.position.set(0, 0.22, 0.18);
  haori.rotation.x = 0.16;
  haori.castShadow = true;
  torso.add(haori);

  // Head & Helmet
  const head = new THREE.Group();
  head.position.y = 0.56;
  torso.add(head);

  const headMesh = new THREE.Mesh(sharedGeos.headGeo, opts.clothMat);
  headMesh.position.y = 0.11;
  headMesh.castShadow = true;
  head.add(headMesh);

  const visor = new THREE.Mesh(sharedGeos.visorGeo, opts.glowMat);
  visor.position.set(0, 0.12, -0.125);
  head.add(visor);

  if (opts.style === 'ronin') {
    const kasa = new THREE.Mesh(sharedGeos.kasaHatGeo, opts.trimMat);
    kasa.position.y = 0.24;
    kasa.castShadow = true;
    head.add(kasa);
  } else {
    const kabuto = new THREE.Mesh(sharedGeos.kabutoDomeGeo, opts.armorMat);
    kabuto.position.y = 0.22;
    kabuto.castShadow = true;
    head.add(kabuto);

    if (opts.style === 'hero' || opts.style === 'boss' || opts.style === 'enforcer') {
      const crest = new THREE.Mesh(sharedGeos.crestGeo, opts.trimMat);
      crest.position.set(0, 0.26, -0.15);
      crest.castShadow = true;
      head.add(crest);
    }
  }

  // Right Arm + Main Weapon
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.32, 0.44, 0);
  torso.add(rightShoulder);

  const rPauldron = new THREE.Mesh(sharedGeos.pauldronsGeo, opts.armorMat);
  rPauldron.position.set(0.04, 0.02, 0);
  rPauldron.rotation.z = -0.22;
  rPauldron.castShadow = true;
  rightShoulder.add(rPauldron);

  const rUpper = new THREE.Mesh(sharedGeos.upperArmGeo, opts.clothMat);
  rUpper.position.y = -0.14;
  rUpper.castShadow = true;
  rightShoulder.add(rUpper);

  const rightForearm = new THREE.Group();
  rightForearm.position.y = -0.28;
  rightShoulder.add(rightForearm);

  const rFore = new THREE.Mesh(sharedGeos.forearmGeo, opts.armorMat);
  rFore.position.y = -0.12;
  rFore.castShadow = true;
  rightForearm.add(rFore);

  const weaponPivot = new THREE.Group();
  weaponPivot.position.set(0, -0.25, -0.04);
  weaponPivot.rotation.x = -Math.PI / 2;
  rightForearm.add(weaponPivot);

  let bladeGlowMesh: THREE.Mesh;
  if (opts.style === 'enforcer') {
    const kanabo = new THREE.Mesh(sharedGeos.kanaboGeo, opts.armorMat);
    kanabo.position.y = 0.56;
    kanabo.castShadow = true;
    weaponPivot.add(kanabo);

    bladeGlowMesh = new THREE.Mesh(sharedGeos.bladeEdgeGeo, opts.glowMat);
    bladeGlowMesh.position.set(0, 0.62, 0);
    bladeGlowMesh.scale.set(2.4, 0.9, 2.4);
    bladeGlowMesh.visible = false;
    weaponPivot.add(bladeGlowMesh);
  } else {
    const hilt = new THREE.Mesh(sharedGeos.hiltGeo, opts.clothMat);
    hilt.position.y = -0.06;
    weaponPivot.add(hilt);

    const tsuba = new THREE.Mesh(sharedGeos.tsubaGeo, opts.trimMat);
    tsuba.position.y = 0.07;
    weaponPivot.add(tsuba);

    const blade = new THREE.Mesh(sharedGeos.bladeGeo, opts.bladeMat);
    blade.position.y = 0.08;
    blade.castShadow = true;
    if (opts.style === 'boss') {
      blade.scale.set(1.15, 1.24, 1.15);
    } else if (opts.style === 'shinobi') {
      blade.scale.set(0.9, 0.78, 0.9);
    }
    weaponPivot.add(blade);

    bladeGlowMesh = new THREE.Mesh(sharedGeos.bladeEdgeGeo, opts.glowMat);
    bladeGlowMesh.position.set(0, 0.62, -0.01);
    bladeGlowMesh.scale.set(0.65, opts.style === 'boss' ? 1.22 : opts.style === 'shinobi' ? 0.75 : 1.0, 0.65);
    bladeGlowMesh.visible = opts.style === 'hero';
    weaponPivot.add(bladeGlowMesh);
  }

  // Left Arm (with optional offhand wakizashi for Shinobi)
  const leftShoulder = new THREE.Group();
  leftShoulder.position.set(-0.32, 0.44, 0);
  torso.add(leftShoulder);

  const lPauldron = new THREE.Mesh(sharedGeos.pauldronsGeo, opts.armorMat);
  lPauldron.position.set(-0.04, 0.02, 0);
  lPauldron.rotation.z = 0.22;
  lPauldron.castShadow = true;
  leftShoulder.add(lPauldron);

  const lUpper = new THREE.Mesh(sharedGeos.upperArmGeo, opts.clothMat);
  lUpper.position.y = -0.14;
  lUpper.castShadow = true;
  leftShoulder.add(lUpper);

  const leftForearm = new THREE.Group();
  leftForearm.position.y = -0.28;
  leftShoulder.add(leftForearm);

  const lFore = new THREE.Mesh(sharedGeos.forearmGeo, opts.armorMat);
  lFore.position.y = -0.12;
  lFore.castShadow = true;
  leftForearm.add(lFore);

  let offhandWeapon: THREE.Group | undefined;
  if (opts.style === 'shinobi') {
    offhandWeapon = new THREE.Group();
    offhandWeapon.position.set(0, -0.25, -0.04);
    offhandWeapon.rotation.x = -Math.PI / 2;
    const hilt2 = new THREE.Mesh(sharedGeos.hiltGeo, opts.clothMat);
    hilt2.scale.setScalar(0.8);
    const blade2 = new THREE.Mesh(sharedGeos.bladeGeo, opts.bladeMat);
    blade2.scale.set(0.85, 0.68, 0.85);
    blade2.position.y = 0.06;
    offhandWeapon.add(hilt2, blade2);
    leftForearm.add(offhandWeapon);
  }

  return {
    root,
    hips,
    torso,
    head,
    rightShoulder,
    rightForearm,
    leftShoulder,
    leftForearm,
    leftLeg,
    rightLeg,
    haori,
    weaponPivot,
    bladeGlowMesh,
    offhandWeapon,
    shadowDisc,
  };
}

export function createNeoToriiGate(
  mats: GameMaterialLibrary,
  scale = 1,
  accentMat?: THREE.Material,
): THREE.Group {
  const group = new THREE.Group();
  group.scale.setScalar(scale);
  const topMat = accentMat ?? mats.vermilionLacquer;

  const pillarGeo = new THREE.CylinderGeometry(0.28, 0.34, 5.4, 10);
  const baseGeo = new THREE.CylinderGeometry(0.46, 0.52, 0.45, 10);

  [-2.6, 2.6].forEach((x) => {
    const base = new THREE.Mesh(baseGeo, mats.stoneTrim);
    base.position.set(x, 0.225, 0);
    base.castShadow = true;
    base.receiveShadow = true;
    group.add(base);

    const pillar = new THREE.Mesh(pillarGeo, mats.brushedTitanium);
    pillar.position.set(x, 2.7, 0);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  });

  // Lower tie beam (Nuki)
  const nuki = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.32, 0.36), mats.brushedTitanium);
  nuki.position.y = 4.35;
  nuki.castShadow = true;
  group.add(nuki);

  // Upper lintel (Kasagi)
  const kasagi = new THREE.Mesh(new THREE.BoxGeometry(8.2, 0.46, 0.62), topMat);
  kasagi.position.y = 5.45;
  kasagi.castShadow = true;
  group.add(kasagi);

  // Center plaque
  const plaque = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.85, 0.45), topMat);
  plaque.position.y = 4.9;
  group.add(plaque);

  return group;
}

export interface CheckpointBeaconObj {
  group: THREE.Group;
  crystal: THREE.Mesh;
  ring: THREE.Mesh;
  activate: () => void;
}

export function createCheckpointBeacon(mats: GameMaterialLibrary): CheckpointBeaconObj {
  const group = new THREE.Group();

  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.82, 0.35, 8), mats.stoneTrim);
  plinth.position.y = 0.175;
  plinth.receiveShadow = true;
  plinth.castShadow = true;
  group.add(plinth);

  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.48, 0.16, 8), mats.brushedTitanium);
  collar.position.y = 0.42;
  group.add(collar);

  const crystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mats.checkpointIdle);
  crystal.position.y = 1.15;
  group.add(crystal);

  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.54, 0.03, 6, 20), mats.checkpointIdle);
  ring.position.y = 1.15;
  ring.rotation.x = Math.PI / 2.4;
  group.add(ring);

  const activate = () => {
    crystal.material = mats.checkpointActive;
    ring.material = mats.checkpointActive;
  };

  return { group, crystal, ring, activate };
}
