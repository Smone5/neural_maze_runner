import {
  BoxGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshLambertMaterial,
  MeshPhongMaterial,
  MeshStandardMaterial,
  RepeatWrapping,
  SRGBColorSpace,
  SphereGeometry,
  Sprite,
  SpriteMaterial,
  Texture,
} from "three";

/**
 * Creates a "Bot" character mesh group.
 * The bot has a body, a head, and an antenna.
 */
export function createBotMesh(color: string): Group {
  const group = new Group();

  // Body
  const bodyGeo = new CylinderGeometry(0.3, 0.25, 0.4, 16);
  const bodyMat = new MeshStandardMaterial({
    color: color,
    roughness: 0.3,
    metalness: 0.1,
  });
  const body = new Mesh(bodyGeo, bodyMat);
  body.position.y = 0.2;
  group.add(body);

  // Head
  const headGeo = new SphereGeometry(0.22, 32, 32);
  const headMat = new MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.2,
    metalness: 0.1,
  });
  const head = new Mesh(headGeo, headMat);
  head.position.y = 0.55;
  group.add(head);

  // Eyes
  const eyeGeo = new SphereGeometry(0.05, 16, 16);
  const eyeMat = new MeshStandardMaterial({
    color: 0x222222,
    emissive: 0x00ffcc,
    emissiveIntensity: 0.5 // Reduced from 2.0
  });

  const leftEye = new Mesh(eyeGeo, eyeMat);
  leftEye.position.set(0.1, 0.6, 0.15);
  group.add(leftEye);

  const rightEye = new Mesh(eyeGeo, eyeMat);
  rightEye.position.set(-0.1, 0.6, 0.15);
  group.add(rightEye);



  // Antenna
  const stickGeo = new CylinderGeometry(0.02, 0.02, 0.2);
  const stick = new Mesh(stickGeo, new MeshStandardMaterial({ color: 0x888888 }));
  stick.position.y = 0.8;
  group.add(stick);

  const bulbGeo = new SphereGeometry(0.06);
  const bulb = new Mesh(bulbGeo, new MeshStandardMaterial({ color: color, emissive: color, emissiveIntensity: 0.5 }));
  bulb.position.y = 0.9;
  group.add(bulb);

  return group;
}

import { MeshBasicMaterial } from "three";

/**
 * Creates the "Energy Core" goal.
 */
export function createGoalMesh(): Group {
  const group = new Group();

  // Core
  const coreGeo = new SphereGeometry(0.25, 16, 16); // Low poly look?
  const coreMat = new MeshStandardMaterial({
    color: 0xffdd00,
    emissive: 0xffaa00,
    emissiveIntensity: 2.5,
    roughness: 0.2,
    wireframe: true,
  });
  const core = new Mesh(coreGeo, coreMat);
  group.add(core);

  // Inner glow
  const innerGeo = new SphereGeometry(0.15, 32, 32);
  const innerMat = new MeshBasicMaterial({ color: 0xffffff });
  const inner = new Mesh(innerGeo, innerMat);
  group.add(inner);

  return group;
}

/**
 * Creates a "Hex-Glass" wall material.
 */
export function createWallMaterial(): MeshStandardMaterial {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new MeshStandardMaterial({ color: 0x4444ff });

  // Dark Glass Background (Slightly lighter)
  const gradient = ctx.createLinearGradient(0, 0, size, size);
  gradient.addColorStop(0, "#0a1025");
  gradient.addColorStop(1, "#101835");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  // Hex Pattern
  ctx.strokeStyle = "#00ffff";
  ctx.lineWidth = 2;
  ctx.shadowBlur = 4;
  ctx.shadowColor = "#00ffff";

  const hexSize = 64;
  for (let r = -1; r < 10; r++) {
    for (let c = -1; c < 10; c++) {
      const x = c * hexSize * 1.5;
      const y = r * hexSize * Math.sqrt(3) + (c % 2 === 0 ? 0 : (hexSize * Math.sqrt(3)) / 2);
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i;
        ctx.lineTo(x + hexSize * Math.cos(ang), y + hexSize * Math.sin(ang));
      }
      ctx.closePath();
      // Randomly fill some hexes for "data" effect
      if (Math.random() > 0.9) {
        ctx.fillStyle = "rgba(0, 255, 255, 0.1)";
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.stroke();
      }
    }
  }

  // Strong Neon Edge
  ctx.lineWidth = 8;
  ctx.strokeStyle = "#0088ff";
  ctx.shadowBlur = 15;
  ctx.strokeRect(0, 0, size, size);

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;

  return new MeshStandardMaterial({
    map: texture,
    color: 0xffffff,
    roughness: 0.2, // Glassy
    metalness: 0.8,
    emissive: 0x0044aa,
    emissiveIntensity: 0.5, // Bloom relies on this
    transparent: true,
    opacity: 0.95
  });
}

/**
 * Creates the floor material with a glowing grid
 */
/**
 * Creates the floor material with a glowing "Reactive Grid".
 */
export function createFloorMaterial(size: number): MeshStandardMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Mirror-like Dark Floor (Slightly Lighter)
    ctx.fillStyle = "#02020a";
    ctx.fillRect(0, 0, 512, 512);

    // Faint sub-grid
    ctx.strokeStyle = "#0a0a20";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }

    // Primary glowing grid - Neon Blue
    ctx.strokeStyle = "#0088ff";
    ctx.lineWidth = 3;
    ctx.shadowBlur = 10;
    ctx.shadowColor = "#0088ff";
    const step = 256;
    for (let i = 0; i <= 512; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }

    // Cross-intersections
    ctx.fillStyle = "#ffffff";
    ctx.shadowBlur = 20;
    ctx.shadowColor = "#ffffff";
    for (let r = 0; r <= 512; r += step) {
      for (let c = 0; c <= 512; c += step) {
        ctx.beginPath();
        ctx.arc(c, r, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(size / 2, size / 2);
  tex.colorSpace = SRGBColorSpace;

  return new MeshStandardMaterial({
    map: tex,
    roughness: 0.1, // Highly reflective
    metalness: 0.9,
    emissive: 0x002244,
    emissiveIntensity: 0.4
  });
}

/**
 * Creates a "Holographic Fire" effect using Sprites.
 */
export function createFireGroup(): Group {
  const group = new Group();

  // Create a fire texture
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0, "rgba(255, 200, 50, 1)");
    grad.addColorStop(0.4, "rgba(255, 100, 0, 0.8)");
    grad.addColorStop(1, "rgba(100, 0, 0, 0)");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;

  const material = new SpriteMaterial({
    map: texture,
    color: 0xffaa00,
    transparent: true,
    blending: 2, // AdditiveBlending (Normal=1, Additive=2)
  });

  // Create 5-8 particles
  const count = 12;
  for (let i = 0; i < count; i++) {
    const sprite = new Sprite(material);
    // Random initial positions within the cell
    sprite.position.set(
      (Math.random() - 0.5) * 0.5,
      Math.random() * 0.6 + 0.1,
      (Math.random() - 0.5) * 0.5
    );
    sprite.scale.set(0.4, 0.4, 0.4);

    // Store random offset for animation in userData
    sprite.userData = {
      offset: Math.random() * 100,
      speed: 0.003 + Math.random() * 0.004,
      amp: 0.05 + Math.random() * 0.05,
      baseScale: 0.4
    };
    group.add(sprite);
  }

  // Add a base "coal" bed - intense glow
  const coalGeo = new BoxGeometry(0.6, 0.05, 0.6);
  const coalMat = new MeshStandardMaterial({
    color: 0x000000,
    emissive: 0xff4400,
    emissiveIntensity: 4.0, // Very bright base
  });
  const coal = new Mesh(coalGeo, coalMat);
  coal.position.y = 0.025;
  group.add(coal);

  return group;
}

/**
 * Creates a water pool mesh.
 */
export function createWaterMesh(): Group {
  const group = new Group();

  // Deep Water
  const deepGeo = new BoxGeometry(0.9, 0.5, 0.9);
  deepGeo.translate(0, -0.3, 0);
  const deepMat = new MeshStandardMaterial({
    color: 0x004488, // Much brighter blue
    emissive: 0x002244,
    emissiveIntensity: 0.8,
    roughness: 0.1,
    metalness: 0.8,
  });
  group.add(new Mesh(deepGeo, deepMat));

  // Surface
  const surfaceGeo = new BoxGeometry(0.9, 0.05, 0.9);
  const surfaceMat = new MeshStandardMaterial({
    color: 0x44ccff, // Brighter cyan
    emissive: 0x0066cc,
    emissiveIntensity: 1.0, // Stronger glow
    transparent: true,
    opacity: 0.8, // More opaque
    roughness: 0.0,
    metalness: 0.9,
  });
  surfaceGeo.translate(0, -0.05, 0);

  const surface = new Mesh(surfaceGeo, surfaceMat);
  // Mark for animation
  surface.userData = { isWaterSurface: true };
  group.add(surface);

  return group;
}

/**
 * Creates an ice patch mesh.
 */
export function createIceMesh(): Mesh {
  const geo = new BoxGeometry(0.9, 0.05, 0.9);
  const mat = new MeshStandardMaterial({
    color: 0xaaddff,
    emissive: 0x88ccff,
    emissiveIntensity: 0.2,
    roughness: 0.1,
    metalness: 0.7,
    transparent: true,
    opacity: 0.85,
  });
  const mesh = new Mesh(geo, mat);
  mesh.position.y = 0.025;
  return mesh;
}

/**
 * Creates a hole mesh (void).
 */
export function createHoleGroup(): Group {
  const group = new Group();

  // The "Void" - deep black box
  const voidGeo = new BoxGeometry(0.92, 0.9, 0.92);
  const voidMat = new MeshBasicMaterial({ color: 0x000000 });
  const voidMesh = new Mesh(voidGeo, voidMat);
  voidMesh.position.y = -0.46;
  group.add(voidMesh);

  // The Rim - slightly raised edge to hide potential Z-fighting with floor
  const rimGeo = new BoxGeometry(1, 0.05, 1);
  const rimMat = new MeshStandardMaterial({
    color: 0x333344,
    roughness: 1,
    metalness: 0.1
  });

  // Top/Bottom rims
  const rimTB = new BoxGeometry(1, 0.04, 0.05);
  const top = new Mesh(rimTB, rimMat);
  top.position.set(0, 0.02, -0.475);
  group.add(top);

  const bottom = new Mesh(rimTB, rimMat);
  bottom.position.set(0, 0.02, 0.475);
  group.add(bottom);

  // Left/Right rims
  const rimLR = new BoxGeometry(0.05, 0.04, 0.9);
  const left = new Mesh(rimLR, rimMat);
  left.position.set(-0.475, 0.02, 0);
  group.add(left);

  const right = new Mesh(rimLR, rimMat);
  right.position.set(0.475, 0.02, 0);
  group.add(right);

  return group;
}
