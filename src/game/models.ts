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
  leftKnee: THREE.Group;
  rightKnee: THREE.Group;
  leftFoot: THREE.Group;
  rightFoot: THREE.Group;
  haori: THREE.Mesh;
  headRibbon?: THREE.Mesh;
  headRibbon2?: THREE.Mesh;
  weaponPivot: THREE.Group;
  bladeGlowMesh: THREE.Mesh;
  offhandWeapon?: THREE.Group;
  backBow?: THREE.Group;
  drawnBow?: THREE.Group;
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
  chestRidgeGeo: new THREE.BoxGeometry(0.16, 0.28, 0.35),
  obiGeo: new THREE.BoxGeometry(0.49, 0.11, 0.31),
  obiKnotGeo: new THREE.BoxGeometry(0.14, 0.13, 0.08),
  kusazuriFrontGeo: new THREE.BoxGeometry(0.2, 0.24, 0.045),
  kusazuriSideGeo: new THREE.BoxGeometry(0.05, 0.25, 0.26),
  collarGeo: new THREE.BoxGeometry(0.32, 0.08, 0.28),
  pauldronsGeo: new THREE.BoxGeometry(0.19, 0.12, 0.28),
  sodeLowerGeo: new THREE.BoxGeometry(0.17, 0.11, 0.24),
  hakamaGeo: new THREE.CylinderGeometry(0.24, 0.31, 0.44, 8),
  legGeo: new THREE.BoxGeometry(0.145, 0.34, 0.15),
  kneeGuardGeo: new THREE.BoxGeometry(0.14, 0.11, 0.06),
  shinGeo: new THREE.BoxGeometry(0.128, 0.25, 0.145),
  footGeo: new THREE.BoxGeometry(0.165, 0.11, 0.31),
  footSoleGeo: new THREE.BoxGeometry(0.17, 0.025, 0.32),
  footStrapGeo: new THREE.BoxGeometry(0.172, 0.055, 0.11),
  sayaGeo: new THREE.CylinderGeometry(0.024, 0.02, 0.96, 8),
  ribbonGeo: new THREE.BoxGeometry(0.075, 0.024, 0.48),
  ribbonTailGeo: new THREE.BoxGeometry(0.058, 0.02, 0.42),
  upperArmGeo: new THREE.BoxGeometry(0.13, 0.28, 0.13),
  forearmGeo: new THREE.BoxGeometry(0.115, 0.26, 0.115),
  bracerGeo: new THREE.BoxGeometry(0.132, 0.17, 0.132),
  headGeo: new THREE.BoxGeometry(0.24, 0.24, 0.24),
  menpoGeo: new THREE.BoxGeometry(0.22, 0.095, 0.06),
  kabutoDomeGeo: new THREE.CylinderGeometry(0.16, 0.23, 0.16, 8),
  shikoroGeo: new THREE.CylinderGeometry(0.23, 0.29, 0.12, 8, 1, true, Math.PI * 0.68, Math.PI * 1.64),
  kasaHatGeo: new THREE.ConeGeometry(0.36, 0.18, 10),
  visorGeo: new THREE.BoxGeometry(0.2, 0.042, 0.04),
  hiltGeo: new THREE.CylinderGeometry(0.02, 0.022, 0.26, 6),
  tsubaGeo: new THREE.CylinderGeometry(0.065, 0.065, 0.018, 10),
  bladeEdgeGeo: new THREE.BoxGeometry(0.014, 1.05, 0.018),
  kanaboGeo: new THREE.CylinderGeometry(0.065, 0.032, 1.35, 8),
  haoriGeo: new THREE.BoxGeometry(0.44, 0.62, 0.042),
  shadowDiscGeo: new THREE.PlaneGeometry(1.35, 1.35),
  bowCurveGeo: (() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.72, 0.14),
      new THREE.Vector3(0, -0.36, -0.08),
      new THREE.Vector3(0, 0.04, -0.14),
      new THREE.Vector3(0, 0.45, -0.05),
      new THREE.Vector3(0, 0.82, 0.18),
    ]);
    return new THREE.TubeGeometry(curve, 18, 0.024, 6, false);
  })(),
  bowGripGeo: new THREE.CylinderGeometry(0.034, 0.034, 0.2, 8),
  bowTipGeo: new THREE.ConeGeometry(0.032, 0.1, 6),
  bowStringGeo: new THREE.CylinderGeometry(0.005, 0.005, 1.54, 4),
  bowArrowShaftGeo: new THREE.CylinderGeometry(0.011, 0.011, 0.92, 6),
  bowArrowTipGeo: new THREE.ConeGeometry(0.034, 0.12, 6),
};

function createYumiBowGroup(
  limbMat: THREE.Material,
  gripMat: THREE.Material,
  trimMat: THREE.Material,
  stringMat: THREE.Material,
  withNockedArrow: boolean,
): THREE.Group {
  const bow = new THREE.Group();
  const limbs = new THREE.Mesh(sharedGeos.bowCurveGeo, limbMat);
  limbs.castShadow = true;
  bow.add(limbs);

  const grip = new THREE.Mesh(sharedGeos.bowGripGeo, gripMat);
  grip.position.set(0, 0.02, -0.13);
  bow.add(grip);

  const upperTip = new THREE.Mesh(sharedGeos.bowTipGeo, trimMat);
  upperTip.position.set(0, 0.84, 0.19);
  upperTip.rotation.x = 0.55;
  bow.add(upperTip);

  const lowerTip = new THREE.Mesh(sharedGeos.bowTipGeo, trimMat);
  lowerTip.position.set(0, -0.74, 0.15);
  lowerTip.rotation.x = Math.PI - 0.55;
  bow.add(lowerTip);

  const stringMesh = new THREE.Mesh(sharedGeos.bowStringGeo, stringMat);
  stringMesh.position.set(0, 0.05, 0.16);
  bow.add(stringMesh);

  if (withNockedArrow) {
    const shaft = new THREE.Mesh(sharedGeos.bowArrowShaftGeo, trimMat);
    shaft.rotation.x = Math.PI / 2;
    shaft.position.set(0, 0.05, -0.22);
    bow.add(shaft);

    const tip = new THREE.Mesh(sharedGeos.bowArrowTipGeo, stringMat);
    tip.rotation.x = -Math.PI / 2;
    tip.position.set(0, 0.05, -0.72);
    bow.add(tip);
  }

  return bow;
}

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

  // Hakama skirt + Obi sash + left-hip Saya scabbard
  const hakama = new THREE.Mesh(sharedGeos.hakamaGeo, opts.clothMat);
  hakama.position.y = -0.14;
  hakama.castShadow = true;
  hakama.receiveShadow = true;
  hips.add(hakama);

  const obi = new THREE.Mesh(sharedGeos.obiGeo, opts.accentMat);
  obi.position.y = 0.04;
  obi.castShadow = true;
  hips.add(obi);

  // Obi knot & Kusazuri armored waist tassets (layered lamellar plates)
  const obiKnot = new THREE.Mesh(sharedGeos.obiKnotGeo, opts.trimMat);
  obiKnot.position.set(0, 0.04, -0.155);
  hips.add(obiKnot);

  if (opts.style === 'hero' || opts.style === 'boss') {
    [-0.13, 0.13].forEach((kx) => {
      const kFront = new THREE.Mesh(sharedGeos.kusazuriFrontGeo, opts.armorMat);
      kFront.position.set(kx, -0.11, -0.175);
      kFront.rotation.x = -0.16;
      kFront.castShadow = true;
      hips.add(kFront);
    });
    [-0.27, 0.27].forEach((kx) => {
      const kSide = new THREE.Mesh(sharedGeos.kusazuriSideGeo, opts.armorMat);
      kSide.position.set(kx, -0.12, 0);
      kSide.rotation.z = kx < 0 ? 0.14 : -0.14;
      kSide.castShadow = true;
      hips.add(kSide);
    });
  }

  if (opts.style !== 'enforcer') {
    const saya = new THREE.Mesh(sharedGeos.sayaGeo, opts.clothMat);
    saya.position.set(-0.26, -0.02, 0.14);
    saya.rotation.set(1.18, 0.12, -0.18);
    saya.castShadow = true;
    hips.add(saya);
  }

  // Articulated legs with knee joints (leftKnee/rightKnee), ankle pivots (leftFoot/rightFoot), knee guards & tabi feet
  const leftLeg = new THREE.Group();
  leftLeg.position.set(-0.14, -0.18, 0);
  const leftLegMesh = new THREE.Mesh(sharedGeos.legGeo, opts.clothMat);
  leftLegMesh.position.y = -0.17;
  leftLegMesh.castShadow = true;
  const leftKnee = new THREE.Group();
  leftKnee.position.y = -0.34;
  const leftKneeGuard = new THREE.Mesh(sharedGeos.kneeGuardGeo, opts.trimMat);
  leftKneeGuard.position.set(0, 0.01, -0.08);
  leftKneeGuard.castShadow = true;
  const leftShinMesh = new THREE.Mesh(sharedGeos.shinGeo, opts.armorMat);
  leftShinMesh.position.set(0, -0.13, -0.005);
  leftShinMesh.castShadow = true;

  const leftFoot = new THREE.Group();
  leftFoot.position.set(0, -0.25, 0);
  const leftFootMesh = new THREE.Mesh(
    sharedGeos.footGeo,
    opts.style === 'hero' ? opts.armorMat : opts.trimMat,
  );
  leftFootMesh.position.set(0, -0.055, -0.065);
  leftFootMesh.castShadow = true;
  leftFootMesh.receiveShadow = true;
  const leftFootSole = new THREE.Mesh(sharedGeos.footSoleGeo, opts.clothMat);
  leftFootSole.position.set(0, -0.097, -0.065);
  const leftFootStrap = new THREE.Mesh(sharedGeos.footStrapGeo, opts.accentMat);
  leftFootStrap.position.set(0, -0.075, -0.165);
  leftFoot.add(leftFootMesh, leftFootSole, leftFootStrap);
  leftKnee.add(leftKneeGuard, leftShinMesh, leftFoot);
  leftLeg.add(leftLegMesh, leftKnee);
  hips.add(leftLeg);

  const rightLeg = new THREE.Group();
  rightLeg.position.set(0.14, -0.18, 0);
  const rightLegMesh = new THREE.Mesh(sharedGeos.legGeo, opts.clothMat);
  rightLegMesh.position.y = -0.17;
  rightLegMesh.castShadow = true;
  const rightKnee = new THREE.Group();
  rightKnee.position.y = -0.34;
  const rightKneeGuard = new THREE.Mesh(sharedGeos.kneeGuardGeo, opts.trimMat);
  rightKneeGuard.position.set(0, 0.01, -0.08);
  rightKneeGuard.castShadow = true;
  const rightShinMesh = new THREE.Mesh(sharedGeos.shinGeo, opts.armorMat);
  rightShinMesh.position.set(0, -0.13, -0.005);
  rightShinMesh.castShadow = true;

  const rightFoot = new THREE.Group();
  rightFoot.position.set(0, -0.25, 0);
  const rightFootMesh = new THREE.Mesh(
    sharedGeos.footGeo,
    opts.style === 'hero' ? opts.armorMat : opts.trimMat,
  );
  rightFootMesh.position.set(0, -0.055, -0.065);
  rightFootMesh.castShadow = true;
  rightFootMesh.receiveShadow = true;
  const rightFootSole = new THREE.Mesh(sharedGeos.footSoleGeo, opts.clothMat);
  rightFootSole.position.set(0, -0.097, -0.065);
  const rightFootStrap = new THREE.Mesh(sharedGeos.footStrapGeo, opts.accentMat);
  rightFootStrap.position.set(0, -0.075, -0.165);
  rightFoot.add(rightFootMesh, rightFootSole, rightFootStrap);
  rightKnee.add(rightKneeGuard, rightShinMesh, rightFoot);
  rightLeg.add(rightLegMesh, rightKnee);
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

  if (opts.style === 'hero' || opts.style === 'boss') {
    const chestRidge = new THREE.Mesh(sharedGeos.chestRidgeGeo, opts.trimMat);
    chestRidge.position.set(0, 0.29, 0);
    torso.add(chestRidge);
  }

  const collarMesh = new THREE.Mesh(sharedGeos.collarGeo, opts.accentMat);
  collarMesh.position.set(0, 0.48, 0);
  collarMesh.castShadow = true;
  torso.add(collarMesh);

  // Dynamic back Haori/Scarf accent
  const haori = new THREE.Mesh(sharedGeos.haoriGeo, opts.accentMat);
  haori.position.set(0, 0.22, 0.185);
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
  visor.position.set(0, 0.135, -0.125);
  head.add(visor);

  if (opts.style === 'hero' || opts.style === 'boss') {
    const menpo = new THREE.Mesh(sharedGeos.menpoGeo, opts.trimMat);
    menpo.position.set(0, 0.05, -0.11);
    head.add(menpo);
  }

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

    if (opts.style === 'hero' || opts.style === 'boss') {
      const shikoro = new THREE.Mesh(sharedGeos.shikoroGeo, opts.armorMat);
      shikoro.position.set(0, 0.15, 0.03);
      shikoro.castShadow = true;
      head.add(shikoro);
    }

    if (opts.style === 'hero' || opts.style === 'boss' || opts.style === 'enforcer') {
      const crest = new THREE.Mesh(sharedGeos.crestGeo, opts.trimMat);
      crest.position.set(0, 0.26, -0.15);
      crest.castShadow = true;
      head.add(crest);
    }
  }

  let headRibbon: THREE.Mesh | undefined;
  let headRibbon2: THREE.Mesh | undefined;
  if (opts.style === 'hero') {
    headRibbon = new THREE.Mesh(sharedGeos.ribbonGeo, opts.accentMat);
    headRibbon.position.set(-0.045, 0.15, 0.31);
    headRibbon.rotation.y = 0.1;
    headRibbon.castShadow = true;
    head.add(headRibbon);

    headRibbon2 = new THREE.Mesh(sharedGeos.ribbonTailGeo, opts.trimMat);
    headRibbon2.position.set(0.05, 0.13, 0.28);
    headRibbon2.rotation.y = -0.12;
    headRibbon2.castShadow = true;
    head.add(headRibbon2);
  }

  // Right Arm + Main Weapon
  const rightShoulder = new THREE.Group();
  rightShoulder.position.set(0.32, 0.44, 0);
  torso.add(rightShoulder);

  const rPauldron = new THREE.Mesh(sharedGeos.pauldronsGeo, opts.armorMat);
  rPauldron.position.set(0.04, 0.03, 0);
  rPauldron.rotation.z = -0.22;
  rPauldron.castShadow = true;
  rightShoulder.add(rPauldron);

  if (opts.style === 'hero' || opts.style === 'boss') {
    const rSodeLow = new THREE.Mesh(sharedGeos.sodeLowerGeo, opts.accentMat);
    rSodeLow.position.set(0.06, -0.07, 0);
    rSodeLow.rotation.z = -0.34;
    rSodeLow.castShadow = true;
    rightShoulder.add(rSodeLow);
  }

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

  if (opts.style === 'hero') {
    const rBracer = new THREE.Mesh(sharedGeos.bracerGeo, opts.trimMat);
    rBracer.position.set(0, -0.13, 0);
    rightForearm.add(rBracer);
  }

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
  lPauldron.position.set(-0.04, 0.03, 0);
  lPauldron.rotation.z = 0.22;
  lPauldron.castShadow = true;
  leftShoulder.add(lPauldron);

  if (opts.style === 'hero' || opts.style === 'boss') {
    const lSodeLow = new THREE.Mesh(sharedGeos.sodeLowerGeo, opts.accentMat);
    lSodeLow.position.set(-0.06, -0.07, 0);
    lSodeLow.rotation.z = 0.34;
    lSodeLow.castShadow = true;
    leftShoulder.add(lSodeLow);
  }

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

  if (opts.style === 'hero') {
    const lBracer = new THREE.Mesh(sharedGeos.bracerGeo, opts.trimMat);
    lBracer.position.set(0, -0.13, 0);
    leftForearm.add(lBracer);
  }

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

  let backBow: THREE.Group | undefined;
  let drawnBow: THREE.Group | undefined;
  if (opts.style === 'hero') {
    const stringGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    backBow = createYumiBowGroup(opts.clothMat, opts.accentMat, opts.trimMat, stringGlowMat, false);
    backBow.position.set(-0.04, 0.28, 0.22);
    backBow.rotation.set(0.1, 0.08, -0.52);
    backBow.scale.setScalar(0.86);
    backBow.visible = false;
    torso.add(backBow);

    drawnBow = createYumiBowGroup(opts.clothMat, opts.accentMat, opts.trimMat, stringGlowMat, true);
    drawnBow.position.set(0.02, -0.24, -0.06);
    drawnBow.rotation.set(-Math.PI / 2 + 0.1, 0, 0);
    drawnBow.scale.setScalar(0.95);
    drawnBow.visible = false;
    leftForearm.add(drawnBow);
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
    leftKnee,
    rightKnee,
    leftFoot,
    rightFoot,
    haori,
    headRibbon,
    headRibbon2,
    weaponPivot,
    bladeGlowMesh,
    offhandWeapon,
    backBow,
    drawnBow,
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

export function createRuinedToriiGate(
  mats: GameMaterialLibrary,
  scale = 1,
  variant = 0,
): THREE.Group {
  const group = new THREE.Group();
  group.scale.setScalar(scale);

  const flip = variant % 2 === 0 ? 1 : -1;
  const baseGeo = new THREE.CylinderGeometry(0.48, 0.56, 0.46, 8);

  // Intact-but-scorched tilted main pillar
  const intactX = 2.6 * flip;
  const baseA = new THREE.Mesh(baseGeo, mats.charredStone);
  baseA.position.set(intactX, 0.23, 0);
  baseA.castShadow = true;
  baseA.receiveShadow = true;
  group.add(baseA);

  const pillarA = new THREE.Mesh(
    new THREE.CylinderGeometry(0.27, 0.34, 4.9, 8),
    mats.charredStone,
  );
  pillarA.position.set(intactX, 2.45, 0);
  pillarA.rotation.z = flip * 0.07;
  pillarA.castShadow = true;
  pillarA.receiveShadow = true;
  group.add(pillarA);

  // Shattered stump pillar on the opposite side
  const brokenX = -2.6 * flip;
  const baseB = new THREE.Mesh(baseGeo, mats.charredStone);
  baseB.position.set(brokenX, 0.23, 0);
  baseB.castShadow = true;
  baseB.receiveShadow = true;
  group.add(baseB);

  const stumpB = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.35, 2.15, 7),
    mats.charredStone,
  );
  stumpB.position.set(brokenX, 1.1, 0.08);
  stumpB.rotation.z = -flip * 0.1;
  stumpB.rotation.x = 0.06;
  stumpB.castShadow = true;
  group.add(stumpB);

  // Glowing ember fracture core atop the snapped pillar stump
  const stumpGlow = new THREE.Mesh(
    new THREE.DodecahedronGeometry(0.24, 0),
    mats.emberCrack,
  );
  stumpGlow.position.set(brokenX + flip * 0.1, 2.15, 0.14);
  group.add(stumpGlow);

  // Half-collapsed broken upper lintel resting skewed on remaining pillar
  const brokenBeam = new THREE.Mesh(
    new THREE.BoxGeometry(5.1, 0.42, 0.56),
    mats.charredStone,
  );
  brokenBeam.position.set(flip * 1.15, 4.05, 0.05);
  brokenBeam.rotation.z = flip * 0.34;
  brokenBeam.rotation.y = flip * 0.08;
  brokenBeam.castShadow = true;
  group.add(brokenBeam);

  // Glowing ember crack strip along the ruined beam
  const beamCrack = new THREE.Mesh(
    new THREE.BoxGeometry(1.4, 0.14, 0.6),
    mats.emberCrack,
  );
  beamCrack.position.set(flip * 0.1, 3.68, 0.05);
  beamCrack.rotation.z = flip * 0.34;
  group.add(beamCrack);

  // Fallen shattered lintel chunk lying on the ground near the broken pillar (kept outside center walkway)
  const fallenBeam = new THREE.Mesh(
    new THREE.BoxGeometry(2.8, 0.38, 0.54),
    mats.charredStone,
  );
  fallenBeam.position.set(brokenX - flip * 0.9, 0.22, 0.85);
  fallenBeam.rotation.set(0.18, flip * 0.45, -flip * 0.12);
  fallenBeam.castShadow = true;
  group.add(fallenBeam);

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

export interface InfernalPortalGateObj {
  group: THREE.Group;
  vortexMesh: THREE.Mesh;
  coreMesh: THREE.Mesh;
  veilMesh: THREE.Mesh;
  sealMesh: THREE.Mesh;
  ringA: THREE.Mesh;
  ringB: THREE.Mesh;
  brazierFlames: THREE.Mesh[];
  portalLight: THREE.PointLight;
}

export function createInfernalPortalGate(mats: GameMaterialLibrary): InfernalPortalGateObj {
  const group = new THREE.Group();

  // Obsidian stepped dais
  const dais1 = new THREE.Mesh(new THREE.BoxGeometry(11.4, 0.36, 4.6), mats.charredStone);
  dais1.position.y = 0.18;
  dais1.receiveShadow = true;
  group.add(dais1);

  const dais2 = new THREE.Mesh(new THREE.BoxGeometry(9.2, 0.28, 3.2), mats.charredStone);
  dais2.position.y = 0.46;
  dais2.receiveShadow = true;
  group.add(dais2);

  // Glowing magma threshold line
  const threshold = new THREE.Mesh(new THREE.BoxGeometry(6.8, 0.06, 0.45), mats.emberCrack);
  threshold.position.set(0, 0.62, 1.35);
  group.add(threshold);

  // Flanking ritual braziers with animated infernal flames
  const brazierGeo = new THREE.CylinderGeometry(0.42, 0.56, 0.9, 6);
  const flameGeo = new THREE.OctahedronGeometry(0.36, 0);
  const brazierFlames: THREE.Mesh[] = [];
  [-4.45, 4.45].forEach((bx) => {
    const brazier = new THREE.Mesh(brazierGeo, mats.charredStone);
    brazier.position.set(bx, 0.78, 1.65);
    brazier.castShadow = true;
    brazier.receiveShadow = true;
    group.add(brazier);

    const flameMat = new THREE.MeshBasicMaterial({
      color: 0xff6b1a,
      transparent: true,
      opacity: 0.92,
    });
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(bx, 1.52, 1.65);
    flame.scale.set(0.85, 1.55, 0.85);
    group.add(flame);
    brazierFlames.push(flame);
  });

  // Massive jagged obsidian pillars
  const pillarGeo = new THREE.BoxGeometry(1.18, 6.8, 1.24);
  const hornGeo = new THREE.ConeGeometry(0.65, 2.1, 5);
  [-3.45, 3.45].forEach((px, idx) => {
    const pillar = new THREE.Mesh(pillarGeo, mats.charredStone);
    pillar.position.set(px, 3.7, 0);
    pillar.rotation.z = idx === 0 ? -0.07 : 0.07;
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);

    const fissure = new THREE.Mesh(new THREE.BoxGeometry(0.18, 5.4, 1.3), mats.emberCrack);
    fissure.position.set(px, 3.7, 0);
    fissure.rotation.z = idx === 0 ? -0.07 : 0.07;
    group.add(fissure);

    const horn = new THREE.Mesh(hornGeo, mats.vermilionLacquer);
    horn.position.set(px * 1.12, 7.6, 0);
    horn.rotation.z = idx === 0 ? 0.34 : -0.34;
    horn.castShadow = true;
    group.add(horn);
  });

  // Heavy horned infernal lintel
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(9.8, 0.85, 1.45), mats.charredStone);
  lintel.position.set(0, 6.85, 0);
  lintel.castShadow = true;
  group.add(lintel);

  const crestBar = new THREE.Mesh(new THREE.BoxGeometry(10.8, 0.36, 1.15), mats.vermilionLacquer);
  crestBar.position.set(0, 7.42, 0);
  crestBar.castShadow = true;
  group.add(crestBar);

  // Center demonic diamond sigil
  const sealMat = new THREE.MeshBasicMaterial({
    color: 0xff7b29,
  });
  const sealMesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.66, 0), sealMat);
  sealMesh.position.set(0, 6.9, 0.58);
  group.add(sealMesh);

  // Swirling volcanic portal vortex + glowing inner core + dimensional veil inside the archway
  const vortexMat = new THREE.MeshBasicMaterial({
    color: 0xff4518,
    transparent: true,
    opacity: 0.62,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const vortexMesh = new THREE.Mesh(new THREE.CircleGeometry(2.75, 28), vortexMat);
  vortexMesh.position.set(0, 3.55, 0);
  vortexMesh.scale.set(0.95, 1.18, 1);
  group.add(vortexMesh);

  const coreMat = new THREE.MeshBasicMaterial({
    color: 0xfef08a,
    transparent: true,
    opacity: 0.45,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coreMesh = new THREE.Mesh(new THREE.CircleGeometry(1.45, 24), coreMat);
  coreMesh.position.set(0, 3.55, 0.03);
  coreMesh.scale.set(0.85, 1.15, 1);
  group.add(coreMesh);

  const veilMat = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
    wireframe: true,
  });
  const veilMesh = new THREE.Mesh(new THREE.TorusGeometry(2.22, 0.34, 8, 24), veilMat);
  veilMesh.position.set(0, 3.55, 0.05);
  group.add(veilMesh);

  const ringMatA = new THREE.MeshBasicMaterial({
    color: 0xfb923c,
    transparent: true,
    opacity: 0.9,
  });
  const ringA = new THREE.Mesh(new THREE.TorusGeometry(2.55, 0.09, 8, 32), ringMatA);
  ringA.position.set(0, 3.55, 0.06);
  group.add(ringA);

  const ringMatB = new THREE.MeshBasicMaterial({
    color: 0xe12d39,
    transparent: true,
    opacity: 0.85,
  });
  const ringB = new THREE.Mesh(new THREE.TorusGeometry(1.95, 0.07, 8, 28), ringMatB);
  ringB.position.set(0, 3.55, -0.06);
  group.add(ringB);

  const portalLight = new THREE.PointLight(0xff4d1a, 14, 30, 1.35);
  portalLight.position.set(0, 3.4, 1.8);
  group.add(portalLight);

  return {
    group,
    vortexMesh,
    coreMesh,
    veilMesh,
    sealMesh,
    ringA,
    ringB,
    brazierFlames,
    portalLight,
  };
}
