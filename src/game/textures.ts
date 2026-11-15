import * as THREE from 'three';

export interface GameMaterialLibrary {
  porcelainFloor: THREE.MeshStandardMaterial;
  jadeFloor: THREE.MeshStandardMaterial;
  citadelFloor: THREE.MeshStandardMaterial;
  obsidianFloor: THREE.MeshStandardMaterial;
  astralFloor: THREE.MeshStandardMaterial;
  abyssFloor: THREE.MeshStandardMaterial;
  ashFloor: THREE.MeshStandardMaterial;
  ironFloor: THREE.MeshStandardMaterial;
  crimsonFloor: THREE.MeshStandardMaterial;
  sanctumFloor: THREE.MeshStandardMaterial;
  stoneTrim: THREE.MeshStandardMaterial;
  charredStone: THREE.MeshStandardMaterial;
  emberCrack: THREE.MeshStandardMaterial;
  parkourStone: THREE.MeshStandardMaterial;
  parkourBridge: THREE.MeshStandardMaterial;
  streamWater: THREE.MeshPhysicalMaterial;
  streamWaterTex: THREE.CanvasTexture;
  streamWaterNormalTex: THREE.CanvasTexture;
  updateWater: (elapsed: number) => void;
  lavaStream: THREE.MeshStandardMaterial;
  lavaStreamTex: THREE.CanvasTexture;
  treeBark: THREE.MeshStandardMaterial;
  treeCanopy: THREE.MeshStandardMaterial;
  brushedTitanium: THREE.MeshStandardMaterial;
  vermilionLacquer: THREE.MeshStandardMaterial;
  heroWhiteArmor: THREE.MeshStandardMaterial;
  heroCobaltCloth: THREE.MeshStandardMaterial;
  heroSteelBlade: THREE.MeshPhysicalMaterial;
  heroBladeGlow: THREE.MeshBasicMaterial;
  enemySlateArmor: THREE.MeshStandardMaterial;
  enemyCrimsonArmor: THREE.MeshStandardMaterial;
  enemyObsidianArmor: THREE.MeshStandardMaterial;
  enemyGoldTrim: THREE.MeshStandardMaterial;
  enemyBladeSteel: THREE.MeshStandardMaterial;
  bambooStalk: THREE.MeshStandardMaterial;
  blossomCanopy: THREE.MeshStandardMaterial;
  checkpointIdle: THREE.MeshStandardMaterial;
  checkpointActive: THREE.MeshStandardMaterial;
  contactShadow: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function makeCeramicTileTexture(
  baseHex: string,
  groutHex: string,
  accentHex: string,
  maxAniso: number,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Subtle mineral stone grain
  for (let i = 0; i < 1600; i++) {
    const x = (i * 73) % size;
    const y = (i * 139) % size;
    ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.22)' : 'rgba(20,30,45,0.035)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Architectural slab grid
  ctx.strokeStyle = groutHex;
  ctx.lineWidth = 3;
  const step = 64;
  for (let p = 0; p <= size; p += step) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p, size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p);
    ctx.stroke();
  }

  // Futuristic hairline inlay
  ctx.strokeStyle = accentHex;
  ctx.lineWidth = 1;
  ctx.strokeRect(8, 8, size - 16, size - 16);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 22);
  tex.anisotropy = maxAniso;
  return tex;
}

function makeWaterTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  // Rich depth gradient: darker bank transitions to luminous turquoise center channel
  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#075985');
  grad.addColorStop(0.18, '#0284c7');
  grad.addColorStop(0.5, '#0ea5e9');
  grad.addColorStop(0.82, '#0284c7');
  grad.addColorStop(1, '#075985');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Flowing multi-layered current streaks & subtle caustic ribbons
  for (let i = 0; i < 150; i++) {
    const x = ((i * 53) % (size - 16)) + 8;
    const y = (i * 97) % size;
    const len = 24 + ((i * 19) % 48);
    ctx.fillStyle =
      i % 4 === 0
        ? 'rgba(224, 242, 254, 0.34)'
        : i % 2 === 0
          ? 'rgba(125, 211, 252, 0.24)'
          : 'rgba(12, 74, 110, 0.22)';
    ctx.fillRect(x, y, 1.5 + (i % 3), len);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1, 16);
  tex.anisotropy = maxAniso;
  return tex;
}

function makeWaterNormalTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(size, size);
  const data = img.data;
  const twoPi = Math.PI * 2;

  // Seamless periodic multi-octave heightfield converted to tangent-space normals
  const heightAt = (u: number, v: number) => {
    const w1 = Math.sin(twoPi * (u * 3 + v * 2));
    const w2 = Math.cos(twoPi * (u * 5 - v * 4)) * 0.55;
    const w3 = Math.sin(twoPi * (u * 8 + v * 7)) * 0.28;
    const w4 = Math.cos(twoPi * (u * 2 + v * 11)) * 0.22;
    return w1 + w2 + w3 + w4;
  };

  const eps = 1 / size;
  for (let y = 0; y < size; y++) {
    const v = y / size;
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const dhdu = (heightAt(u + eps, v) - heightAt(u - eps, v)) * 0.55;
      const dhdv = (heightAt(u, v + eps) - heightAt(u, v - eps)) * 0.55;
      let nx = -dhdu;
      let ny = -dhdv;
      let nz = 1.0;
      const invLen = 1 / Math.sqrt(nx * nx + ny * ny + nz * nz);
      nx *= invLen;
      ny *= invLen;
      nz *= invLen;

      const idx = (y * size + x) * 4;
      data[idx] = Math.round((nx * 0.5 + 0.5) * 255);
      data[idx + 1] = Math.round((ny * 0.5 + 0.5) * 255);
      data[idx + 2] = Math.round((nz * 0.5 + 0.5) * 255);
      data[idx + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.NoColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 20);
  tex.anisotropy = maxAniso;
  return tex;
}

function makeInfernalFloorTexture(
  baseHex: string,
  scorchHex: string,
  crackHexA: string,
  crackHexB: string,
  maxAniso: number,
): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);

  // Blast scorch marks & soot patches
  for (let i = 0; i < 24; i++) {
    const cx = (i * 89 + 31) % size;
    const cy = (i * 143 + 17) % size;
    const rad = 18 + ((i * 29) % 36);
    const g = ctx.createRadialGradient(cx, cy, 2, cx, cy, rad);
    g.addColorStop(0, scorchHex);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
  }

  // Broken basalt slab cracks
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.72)';
  ctx.lineWidth = 3;
  for (let p = 0; p <= size; p += 64) {
    ctx.beginPath();
    ctx.moveTo(p, 0);
    ctx.lineTo(p + ((p % 128 === 0 ? 1 : -1) * 5), size);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, p);
    ctx.lineTo(size, p + ((p % 128 === 0 ? -1 : 1) * 4));
    ctx.stroke();
  }

  // Jagged glowing magma fissures
  const fissures = [
    [12, 24, 58, 76, 44, 128, 96, 178],
    [138, 8, 172, 62, 152, 118, 214, 168],
    [74, 196, 122, 164, 184, 214, 244, 192],
    [22, 162, 78, 148, 114, 218, 158, 248],
  ];
  fissures.forEach((pts, idx) => {
    ctx.strokeStyle = idx % 2 === 0 ? crackHexA : crackHexB;
    ctx.lineWidth = 3.2;
    ctx.beginPath();
    ctx.moveTo(pts[0], pts[1]);
    ctx.lineTo(pts[2], pts[3]);
    ctx.lineTo(pts[4], pts[5]);
    ctx.lineTo(pts[6], pts[7]);
    ctx.stroke();

    ctx.strokeStyle = 'rgba(255, 244, 214, 0.75)';
    ctx.lineWidth = 1.0;
    ctx.stroke();
  });

  // Scattered glowing ash specks
  for (let i = 0; i < 180; i++) {
    const x = (i * 71) % size;
    const y = (i * 137) % size;
    ctx.fillStyle = i % 5 === 0 ? crackHexB : 'rgba(255, 255, 255, 0.04)';
    ctx.fillRect(x, y, 2, 2);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(8, 20);
  tex.anisotropy = maxAniso;
  return tex;
}

function makeLavaTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const grad = ctx.createLinearGradient(0, 0, size, 0);
  grad.addColorStop(0, '#9a3412');
  grad.addColorStop(0.35, '#ea580c');
  grad.addColorStop(0.5, '#f97316');
  grad.addColorStop(0.68, '#ea580c');
  grad.addColorStop(1, '#7c2d12');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // Flowing molten streaks & cooled dark crust veins
  for (let i = 0; i < 95; i++) {
    const x = ((i * 59) % (size - 18)) + 6;
    const y = (i * 97) % size;
    const len = 28 + ((i * 23) % 48);
    ctx.fillStyle =
      i % 4 === 0
        ? 'rgba(254, 240, 138, 0.58)'
        : i % 3 === 0
          ? 'rgba(251, 146, 60, 0.45)'
          : 'rgba(24, 10, 12, 0.48)';
    ctx.fillRect(x, y, 3 + (i % 4), len);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 16);
  tex.anisotropy = maxAniso;
  return tex;
}

function makeBrushedMetalTexture(maxAniso: number): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#dde3ea';
  ctx.fillRect(0, 0, size, size);

  for (let y = 0; y < size; y += 2) {
    const alpha = 0.04 + ((y * 17) % 11) * 0.008;
    ctx.fillStyle = y % 4 === 0 ? `rgba(255,255,255,${alpha})` : `rgba(40,55,75,${alpha})`;
    ctx.fillRect(0, y, size, 1);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = maxAniso;
  return tex;
}

function makeContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(size / 2, size / 2, 6, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(15, 23, 42, 0.55)');
  grad.addColorStop(0.55, 'rgba(15, 23, 42, 0.22)');
  grad.addColorStop(1, 'rgba(15, 23, 42, 0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createMaterialLibrary(renderer: THREE.WebGLRenderer): GameMaterialLibrary {
  const maxAniso = Math.min(4, renderer.capabilities.getMaxAnisotropy());

  const porcelainTex = makeCeramicTileTexture('#f2f4f8', '#d5dce5', 'rgba(2, 132, 199, 0.18)', maxAniso);
  const jadeTex = makeCeramicTileTexture('#e7f0ee', '#c5d7d4', 'rgba(13, 148, 136, 0.22)', maxAniso);
  const citadelTex = makeCeramicTileTexture('#f6f7fa', '#d8dde6', 'rgba(225, 45, 57, 0.20)', maxAniso);
  const obsidianTex = makeCeramicTileTexture('#e5e9f4', '#c1c9de', 'rgba(99, 102, 241, 0.24)', maxAniso);
  const astralTex = makeCeramicTileTexture('#efeaf8', '#d2c7e6', 'rgba(139, 92, 246, 0.28)', maxAniso);
  const abyssTex = makeInfernalFloorTexture('#21131a', 'rgba(8, 3, 6, 0.85)', '#e12d39', '#f97316', maxAniso);
  const ashTex = makeCeramicTileTexture('#dfdad4', '#bcb4aa', 'rgba(245, 158, 11, 0.28)', maxAniso);
  const ironTex = makeCeramicTileTexture('#cbd5e1', '#94a3b8', 'rgba(220, 38, 38, 0.25)', maxAniso);
  const crimsonTex = makeCeramicTileTexture('#2b2434', '#493c58', 'rgba(225, 45, 57, 0.36)', maxAniso);
  const sanctumTex = makeInfernalFloorTexture('#180b0e', 'rgba(5, 2, 4, 0.9)', '#f97316', '#fbbf24', maxAniso);
  const streamWaterTex = makeWaterTexture(maxAniso);
  const streamWaterNormalTex = makeWaterNormalTexture(maxAniso);
  const lavaStreamTex = makeLavaTexture(maxAniso);
  const brushedTex = makeBrushedMetalTexture(maxAniso);
  const contactTex = makeContactShadowTexture();

  const porcelainFloor = new THREE.MeshStandardMaterial({
    map: porcelainTex,
    roughness: 0.42,
    metalness: 0.08,
  });

  const jadeFloor = new THREE.MeshStandardMaterial({
    map: jadeTex,
    roughness: 0.36,
    metalness: 0.12,
  });

  const citadelFloor = new THREE.MeshStandardMaterial({
    map: citadelTex,
    roughness: 0.32,
    metalness: 0.14,
  });

  const obsidianFloor = new THREE.MeshStandardMaterial({
    map: obsidianTex,
    roughness: 0.26,
    metalness: 0.24,
  });

  const astralFloor = new THREE.MeshStandardMaterial({
    map: astralTex,
    roughness: 0.24,
    metalness: 0.2,
  });

  const abyssFloor = new THREE.MeshStandardMaterial({
    map: abyssTex,
    roughness: 0.72,
    metalness: 0.16,
  });

  const ashFloor = new THREE.MeshStandardMaterial({
    map: ashTex,
    roughness: 0.48,
    metalness: 0.14,
  });

  const ironFloor = new THREE.MeshStandardMaterial({
    map: ironTex,
    roughness: 0.28,
    metalness: 0.36,
  });

  const crimsonFloor = new THREE.MeshStandardMaterial({
    map: crimsonTex,
    roughness: 0.26,
    metalness: 0.32,
  });

  const sanctumFloor = new THREE.MeshStandardMaterial({
    map: sanctumTex,
    roughness: 0.68,
    metalness: 0.18,
  });

  const stoneTrim = new THREE.MeshStandardMaterial({
    color: 0xdbe1ea,
    roughness: 0.68,
    metalness: 0.08,
  });

  const charredStone = new THREE.MeshStandardMaterial({
    color: 0x241a1e,
    roughness: 0.9,
    metalness: 0.1,
  });

  const emberCrack = new THREE.MeshStandardMaterial({
    color: 0xf97316,
    emissive: 0xea580c,
    emissiveIntensity: 1.45,
    roughness: 0.32,
    metalness: 0.12,
  });

  const parkourStone = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    roughness: 0.46,
    metalness: 0.18,
  });

  const parkourBridge = new THREE.MeshStandardMaterial({
    color: 0xb45309,
    roughness: 0.52,
    metalness: 0.14,
  });

  const waterTimeUniform = { value: 0 };
  const streamWater = new THREE.MeshPhysicalMaterial({
    map: streamWaterTex,
    normalMap: streamWaterNormalTex,
    normalScale: new THREE.Vector2(0.95, 0.95),
    color: 0x0ea5e9,
    roughness: 0.11,
    metalness: 0.08,
    clearcoat: 0.92,
    clearcoatRoughness: 0.07,
    reflectivity: 0.92,
    transparent: true,
    opacity: 0.87,
  });
  streamWater.customProgramCacheKey = () => 'sakiro_water_v1';
  streamWater.onBeforeCompile = (shader) => {
    shader.uniforms.uWaterTime = waterTimeUniform;
    shader.vertexShader = shader.vertexShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uWaterTime;
varying vec2 vWaterUv;
varying float vWaveCrest;`,
      )
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
vWaterUv = uv;
float w1 = sin(position.x * 0.72 + uWaterTime * 2.2) * cos(position.y * 0.65 - uWaterTime * 1.9);
float w2 = sin((position.x * 1.35 - position.y * 1.15) + uWaterTime * 3.2) * 0.45;
transformed.z += (w1 + w2) * 0.055;
vWaveCrest = clamp((w1 + w2) * 0.5 + 0.5, 0.0, 1.0);`,
      );

    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uWaterTime;
varying vec2 vWaterUv;
varying float vWaveCrest;`,
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
float shoreMask = 1.0 - smoothstep(0.0, 0.14, min(vWaterUv.x, 1.0 - vWaterUv.x));
float caustic = sin(vWaterUv.x * 26.0 + uWaterTime * 2.1) * sin(vWaterUv.y * 110.0 - uWaterTime * 3.4);
float shimmer = smoothstep(0.52, 0.96, caustic * 0.5 + 0.5);
vec3 deepTint = vec3(0.02, 0.24, 0.42);
vec3 crestTint = vec3(0.32, 0.84, 0.98);
diffuseColor.rgb = mix(diffuseColor.rgb * 0.76 + deepTint * 0.34, crestTint, vWaveCrest * 0.34);
diffuseColor.rgb += vec3(0.45, 0.9, 1.0) * shimmer * 0.14;
float foamNoise = sin(vWaterUv.y * 140.0 - uWaterTime * 4.2) * 0.5 + 0.5;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.92, 0.98, 1.0), shoreMask * (0.36 + foamNoise * 0.32));
diffuseColor.a = clamp(diffuseColor.a + shoreMask * 0.11, 0.78, 0.96);`,
      );
  };

  const lavaStream = new THREE.MeshStandardMaterial({
    map: lavaStreamTex,
    emissiveMap: lavaStreamTex,
    emissive: 0xff5a1f,
    emissiveIntensity: 1.15,
    roughness: 0.35,
    metalness: 0.05,
  });

  const treeBark = new THREE.MeshStandardMaterial({
    color: 0x6b4f3a,
    roughness: 0.88,
    metalness: 0.02,
  });

  const treeCanopy = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.72,
    metalness: 0.04,
  });

  const brushedTitanium = new THREE.MeshStandardMaterial({
    map: brushedTex,
    color: 0xd0d7e2,
    roughness: 0.26,
    metalness: 0.85,
  });

  const vermilionLacquer = new THREE.MeshStandardMaterial({
    color: 0xd92b3a,
    roughness: 0.24,
    metalness: 0.22,
  });

  const heroWhiteArmor = new THREE.MeshStandardMaterial({
    color: 0xf4f6f9,
    roughness: 0.28,
    metalness: 0.48,
  });

  const heroCobaltCloth = new THREE.MeshStandardMaterial({
    color: 0x1e3a5f,
    roughness: 0.82,
    metalness: 0.04,
  });

  const heroSteelBlade = new THREE.MeshPhysicalMaterial({
    color: 0xf1f5f9,
    roughness: 0.12,
    metalness: 0.96,
    clearcoat: 0.8,
    clearcoatRoughness: 0.1,
  });

  const heroBladeGlow = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
  });

  const enemySlateArmor = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.44,
    metalness: 0.52,
  });

  const enemyCrimsonArmor = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    roughness: 0.32,
    metalness: 0.48,
  });

  const enemyObsidianArmor = new THREE.MeshStandardMaterial({
    color: 0x1e2430,
    roughness: 0.36,
    metalness: 0.65,
  });

  const enemyGoldTrim = new THREE.MeshStandardMaterial({
    color: 0xd99b26,
    roughness: 0.22,
    metalness: 0.9,
  });

  const enemyBladeSteel = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.16,
    metalness: 0.92,
  });

  const bambooStalk = new THREE.MeshStandardMaterial({
    color: 0x6ea88b,
    roughness: 0.56,
    metalness: 0.05,
  });

  const blossomCanopy = new THREE.MeshStandardMaterial({
    color: 0xf8dce4,
    roughness: 0.78,
    metalness: 0.02,
  });

  const checkpointIdle = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    emissive: 0x0284c7,
    emissiveIntensity: 0.75,
    roughness: 0.2,
    metalness: 0.4,
  });

  const checkpointActive = new THREE.MeshStandardMaterial({
    color: 0x10b981,
    emissive: 0x10b981,
    emissiveIntensity: 1.0,
    roughness: 0.2,
    metalness: 0.4,
  });

  const contactShadow = new THREE.MeshBasicMaterial({
    map: contactTex,
    transparent: true,
    depthWrite: false,
    opacity: 0.55,
  });

  const allMaterials = [
    porcelainFloor,
    jadeFloor,
    citadelFloor,
    obsidianFloor,
    astralFloor,
    abyssFloor,
    ashFloor,
    ironFloor,
    crimsonFloor,
    sanctumFloor,
    stoneTrim,
    charredStone,
    emberCrack,
    parkourStone,
    parkourBridge,
    streamWater,
    lavaStream,
    treeBark,
    treeCanopy,
    brushedTitanium,
    vermilionLacquer,
    heroWhiteArmor,
    heroCobaltCloth,
    heroSteelBlade,
    heroBladeGlow,
    enemySlateArmor,
    enemyCrimsonArmor,
    enemyObsidianArmor,
    enemyGoldTrim,
    enemyBladeSteel,
    bambooStalk,
    blossomCanopy,
    checkpointIdle,
    checkpointActive,
    contactShadow,
  ];
  const allTextures = [
    porcelainTex,
    jadeTex,
    citadelTex,
    obsidianTex,
    astralTex,
    abyssTex,
    ashTex,
    ironTex,
    crimsonTex,
    sanctumTex,
    streamWaterTex,
    streamWaterNormalTex,
    lavaStreamTex,
    brushedTex,
    contactTex,
  ];

  return {
    porcelainFloor,
    jadeFloor,
    citadelFloor,
    obsidianFloor,
    astralFloor,
    abyssFloor,
    ashFloor,
    ironFloor,
    crimsonFloor,
    sanctumFloor,
    stoneTrim,
    charredStone,
    emberCrack,
    parkourStone,
    parkourBridge,
    streamWater,
    streamWaterTex,
    streamWaterNormalTex,
    updateWater: (elapsed: number) => {
      waterTimeUniform.value = elapsed;
    },
    lavaStream,
    lavaStreamTex,
    treeBark,
    treeCanopy,
    brushedTitanium,
    vermilionLacquer,
    heroWhiteArmor,
    heroCobaltCloth,
    heroSteelBlade,
    heroBladeGlow,
    enemySlateArmor,
    enemyCrimsonArmor,
    enemyObsidianArmor,
    enemyGoldTrim,
    enemyBladeSteel,
    bambooStalk,
    blossomCanopy,
    checkpointIdle,
    checkpointActive,
    contactShadow,
    dispose: () => {
      allMaterials.forEach((m) => m.dispose());
      allTextures.forEach((t) => t.dispose());
    },
  };
}
