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

  // Eyes (simple textured or just small spheres)
  const eyeGeo = new SphereGeometry(0.05, 16, 16);
  const eyeMat = new MeshBasicMaterial({ color: 0x222222 });

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
    emissiveIntensity: 0.8,
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
 * Creates a "Tron-like" wall material.
 */
export function createWallMaterial(): MeshStandardMaterial {
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");

  if (!ctx) return new MeshStandardMaterial({ color: 0x4444ff });

  // Deep Blue Background
  ctx.fillStyle = "#0a0a20";
  ctx.fillRect(0, 0, size, size);

  // Sub-Grid
  ctx.strokeStyle = "rgba(0, 212, 255, 0.1)";
  ctx.lineWidth = 1;
  const subStep = 64;
  for (let i = 0; i < size; i += subStep) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, size); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(size, i); ctx.stroke();
  }

  // Hex / Circuit Detail
  ctx.strokeStyle = "#00d4ff";
  ctx.lineWidth = 3;
  ctx.shadowBlur = 10;
  ctx.shadowColor = "#00d4ff";

  // Hexagon Pattern
  const hexSize = 120;
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const x = c * hexSize * 1.5;
      const y = r * hexSize * Math.sqrt(3) + (c % 2 === 0 ? 0 : (hexSize * Math.sqrt(3)) / 2);

      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const ang = (Math.PI / 3) * i;
        ctx.lineTo(x + hexSize * Math.cos(ang), y + hexSize * Math.sin(ang));
      }
      ctx.closePath();
      ctx.stroke();
    }
  }

  // Circuit Lines
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(0, size * 0.5); ctx.lineTo(size * 0.3, size * 0.5);
  ctx.lineTo(size * 0.4, size * 0.6); ctx.lineTo(size, size * 0.6);
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.colorSpace = SRGBColorSpace;

  return new MeshStandardMaterial({
    map: texture,
    roughness: 0.15,
    metalness: 0.8,
    emissive: 0x0044aa,
    emissiveIntensity: 0.25
  });
}

/**
 * Creates the floor material with a glowing grid
 */
export function createFloorMaterial(size: number): MeshStandardMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    // Dark metallic floor
    ctx.fillStyle = "#050510";
    ctx.fillRect(0, 0, 512, 512);

    // Faint sub-grid
    ctx.strokeStyle = "#101025";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 512; i += 32) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }

    // Primary glowing grid
    ctx.strokeStyle = "#1f3a60";
    ctx.lineWidth = 4;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#00d4ff33";
    const step = 256;
    for (let i = 0; i <= 512; i += step) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
  }

  const tex = new CanvasTexture(canvas);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.repeat.set(size / 2, size / 2);
  tex.colorSpace = SRGBColorSpace;

  return new MeshStandardMaterial({
    map: tex,
    roughness: 0.4,
    metalness: 0.5
  });
}
