import {
  ACESFilmicToneMapping,
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  FogExp2,
  Group,
  HemisphereLight,
  InstancedMesh,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Sprite,
  Vector2,
  Vector3,
  WebGLRenderer,
} from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { Action, Direction, EnvState, StepResult } from "../core/env";
import { MazeChar, MazeLayout } from "../core/maze_types";
import { easeInOut, pingPong } from "./animations";
import { createBotMesh, createFireGroup, createFloorMaterial, createGoalMesh, createHoleGroup, createIceMesh, createWallMaterial, createWaterMesh } from "./renderer_utils";

interface Transition {
  from: EnvState;
  to: EnvState;
  action: Action;
  bump: boolean;
  startedAt: number;
  durationMs: number;
}

export type ThreeViewMode = "orbit" | "top" | "first";

function dirYaw(dir: Direction): number {
  if (dir === 0) return Math.PI;
  if (dir === 1) return -Math.PI / 2;
  if (dir === 2) return 0;
  return Math.PI / 2;
}

function dirVec(dir: Direction): { x: number; z: number } {
  if (dir === 0) return { x: 0, z: -1 };
  if (dir === 1) return { x: 1, z: 0 };
  if (dir === 2) return { x: 0, z: 1 };
  return { x: -1, z: 0 };
}

function isHazardTile(cell: MazeChar): cell is "I" | "W" | "F" | "H" {
  return cell === "I" || cell === "W" || cell === "F" || cell === "H";
}

export class ThreeMazeViewer {
  private container: HTMLElement;
  private overlay!: HTMLDivElement;
  private renderer: WebGLRenderer;
  private composer!: EffectComposer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private root = new Group();
  private layout: MazeLayout;
  private wallGroup = new Group();
  private hazardGroup = new Group();
  private markerGroup = new Group();
  private floorMesh: InstancedMesh | null = null;
  private wallGeo = new BoxGeometry(1, 1, 1);
  private collectibleGeo = new BoxGeometry(0.16, 0.05, 0.16);
  private startGeo = new BoxGeometry(0.74, 0.04, 0.74);
  private wallMaterial!: MeshStandardMaterial;
  private collectibleMaterial = new MeshStandardMaterial({
    color: 0xfef08a,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.55,
    roughness: 0.25,
    metalness: 0.15,
  });
  private startMaterial = new MeshStandardMaterial({
    color: 0x86efac,
    emissive: 0x22c55e,
    emissiveIntensity: 0.26,
    transparent: true,
    opacity: 0.88,
    roughness: 0.45,
    metalness: 0.1,
  });
  private collectibleMeshes = new Map<string, Mesh>();
  private fireTiles: Group[] = [];
  private goalGroup: Group | null = null;
  private agentGroup: Group;
  private ghostGroup: Group;
  private transition: Transition | null = null;
  private ghostTransition: Transition | null = null;
  private lastState!: EnvState;
  private cameraState!: EnvState;
  private lastGhostState: EnvState | null = null;
  private raf = 0;
  private lastGoalAt = 0;
  private headlamp!: PointLight;
  private enabled = true;

  private viewMode: ThreeViewMode = "orbit";
  private orbitSpeed = 0.00018;
  private orbitAzimuth = Math.PI * 0.15;
  private orbitElevation = 0.9;
  private orbitDistance = 0;
  private orbitDistanceMin = 0;
  private orbitDistanceMax = 0;
  private autoOrbit = true;
  private dragging = false;
  private dragX = 0;
  private dragY = 0;
  private fpEyeHeight = 0.6;
  private fpNearOffset = 0.08;
  private fpLookDistance = 2.6;
  private fpBasePitch = -0.28;
  private fpYawCalibration = 0;
  private fpYawOffset = 0;
  private fpPitchOffset = 0;
  private fpLookDragging = false;
  private fpLookPointerId: number | null = null;
  private fpTouchLookEnabled = false;

  readonly ready: boolean;

  constructor(container: HTMLElement, layout: MazeLayout) {
    this.container = container;
    this.layout = layout;

    this.scene = new Scene();
    // High-Tech Noir Background
    this.scene.background = new Color("#000510");
    this.scene.fog = new FogExp2(0x000510, 0.02); // Reduced fog density significantly

    this.camera = new PerspectiveCamera(58, 1, 0.1, 1000);
    this.lastState = {
      row: layout.start.row,
      col: layout.start.col,
      dir: 1,
    };
    this.cameraState = { ...this.lastState };
    this.resetOrbitDefaults();
    this.applyCamera(performance.now());

    // Create the "Bot"
    this.agentGroup = createBotMesh("#ff5a36");

    // Create the Ghost Bot
    this.ghostGroup = createBotMesh("#2f78ff");
    // Make ghost transparent
    this.ghostGroup.traverse((child) => {
      if (child instanceof Mesh) {
        child.material = child.material.clone();
        child.material.transparent = true;
        child.material.opacity = 0.5;
      }
    });

    try {
      this.renderer = new WebGLRenderer({ antialias: true, alpha: true });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      this.renderer.toneMapping = ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 2.0; // Increased exposure further
      this.renderer.shadowMap.enabled = true;
      this.renderer.shadowMap.type = PCFSoftShadowMap;

      // Post-Processing Setup
      this.composer = new EffectComposer(this.renderer);

      // 1. Render Pass
      const renderPass = new RenderPass(this.scene, this.camera);
      this.composer.addPass(renderPass);

      // 2. Bloom Pass
      // Resolution, Strength, Radius, Threshold
      const bloomPass = new UnrealBloomPass(
        new Vector2(window.innerWidth, window.innerHeight),
        0.3,  // Strength - Further reduced from 0.6
        0.1,  // Radius - Tighter bloom
        0.9   // Threshold - Only brightest pixels glow
      );
      this.composer.addPass(bloomPass);

      // 3. Output Pass (Tone Mapping)
      const outputPass = new OutputPass();
      this.composer.addPass(outputPass);

      this.ready = true;
    } catch (err) {
      console.warn("Three.js renderer unavailable", err);
      this.renderer = null as unknown as WebGLRenderer;
      this.ready = false;
      return;
    }

    const canvasEl = this.renderer.domElement;
    // Keep the display size locked to the container. Without this, high-DPI
    // mobile screens can show a clipped oversized first-person view.
    canvasEl.style.width = "100%";
    canvasEl.style.height = "100%";
    canvasEl.style.display = "block";
    this.container.appendChild(canvasEl);

    // Hazard Overlay
    this.overlay = document.createElement("div");
    this.overlay.style.position = "absolute";
    this.overlay.style.top = "0";
    this.overlay.style.left = "0";
    this.overlay.style.width = "100%";
    this.overlay.style.height = "100%";
    this.overlay.style.pointerEvents = "none";
    this.overlay.style.opacity = "0";
    this.overlay.style.transition = "opacity 0.2s ease-out";
    this.container.appendChild(this.overlay);

    // Lighting
    const hemi = new HemisphereLight(0xffffff, 0x222244, 1.5); // Signficantly boosted ambient light
    this.scene.add(hemi);

    const light = new DirectionalLight(0xffffff, 3.0); // Boosted Key Light
    light.position.set(5, 12, 8);
    this.scene.add(light);

    // Rim Light (Pink/Purple) for style
    const rimLight = new DirectionalLight(0xff00cc, 0.6);
    rimLight.position.set(-5, 5, -5);
    this.scene.add(rimLight);

    // Dynamic Headlamp (Attached to camera in applyCamera)
    this.headlamp = new PointLight(0xffffff, 1.2, 8);
    this.headlamp.castShadow = true;
    this.scene.add(this.headlamp);

    // Sub-glow for atmosphere
    const accentLight = new PointLight(0x00d4ff, 0.5, 15);
    accentLight.position.set(layout.size / 2, 2, layout.size / 2);
    this.scene.add(accentLight);

    this.root.add(this.agentGroup, this.ghostGroup);
    this.scene.add(this.root);

    // Wall Material
    this.wallMaterial = createWallMaterial();
    /* REMOVE OLD MATERIALS */

    this.lastState = {
      row: layout.start.row,
      col: layout.start.col,
      dir: 1,
    };
    this.cameraState = { ...this.lastState };

    this.buildMaze(layout);
    this.placeAgent(this.lastState, false);
    this.ghostGroup.visible = false;
    this.resize(this.container.clientWidth, this.container.clientHeight);
    this.bindCameraInput();

    this.renderLoop = this.renderLoop.bind(this);
    this.raf = requestAnimationFrame(this.renderLoop);

    window.addEventListener("resize", () => {
      this.resize(this.container.clientWidth, this.container.clientHeight);
    });
  }

  destroy(): void {
    if (!this.ready) return;
    cancelAnimationFrame(this.raf);
    this.wallGeo.dispose();
    this.collectibleGeo.dispose();
    this.startGeo.dispose();
    this.collectibleMaterial.dispose();
    this.startMaterial.dispose();
    /* REMOVE OLD DISPOSE */
    this.renderer.dispose();
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.container.style.display = enabled ? "block" : "none";
    this.resize(this.container.clientWidth, this.container.clientHeight);
  }

  setLayout(layout: MazeLayout): void {
    this.layout = layout;
    this.resetOrbitDefaults();
    this.lastState = {
      row: layout.start.row,
      col: layout.start.col,
      dir: 1,
    };
    this.cameraState = { ...this.lastState };
    this.transition = null;
    this.ghostTransition = null;
    this.lastGhostState = null;
    this.ghostGroup.visible = false;
    this.buildMaze(layout);
    this.placeAgent(this.lastState, false);
    this.resize(this.container.clientWidth, this.container.clientHeight);
  }

  setViewMode(mode: ThreeViewMode): void {
    this.viewMode = mode;
    const firstPerson = mode === "first";
    if (firstPerson) {
      this.resetFirstPersonLook();
    }
    // Hide the player's own meshes in first person so they don't block view.
    this.agentGroup.visible = !firstPerson;
    this.applyCamera(performance.now());
  }

  setFirstPersonTouchLookEnabled(enabled: boolean): void {
    this.fpTouchLookEnabled = enabled;
    if (!enabled) {
      this.fpLookDragging = false;
      this.fpLookPointerId = null;
      this.resetFirstPersonLook();
      this.applyCamera(performance.now());
    }
  }

  setFirstPersonCalibration(yawRadians: number): void {
    this.fpYawCalibration = yawRadians;
    this.applyCamera(performance.now());
  }

  setZoomPercent(percent: number): void {
    const p = Math.max(0, Math.min(1, percent));
    this.orbitDistance = this.orbitDistanceMin + p * (this.orbitDistanceMax - this.orbitDistanceMin);
  }

  setAutoOrbit(enabled: boolean): void {
    this.autoOrbit = enabled;
  }

  setAgentState(state: EnvState): void {
    this.transition = null;
    this.resetCollectibles();
    this.lastState = { ...state };
    this.cameraState = { ...state };
    this.placeAgent(state, false);
    this.collectAt(state.row, state.col);
  }

  setGhostState(state: EnvState): void {
    this.ghostTransition = null;
    this.lastGhostState = { ...state };
    this.ghostGroup.visible = true;
    this.placeAgent(state, true);
  }

  clearGhost(): void {
    this.lastGhostState = null;
    this.ghostTransition = null;
    this.ghostGroup.visible = false;
  }

  private collectAt(row: number, col: number): void {
    const marker = this.collectibleMeshes.get(`${row},${col}`);
    if (marker) {
      marker.visible = false;
    }
  }

  private resetCollectibles(): void {
    for (const marker of this.collectibleMeshes.values()) {
      marker.visible = true;
    }
  }

  stepTransition(step: StepResult, durationMs: number): void {
    if (!step.bump && (step.prevState.row !== step.state.row || step.prevState.col !== step.state.col)) {
      this.collectAt(step.state.row, step.state.col);
    }
    this.transition = {
      from: step.prevState,
      to: step.state,
      action: step.action,
      bump: step.bump,
      startedAt: performance.now(),
      durationMs: Math.max(70, durationMs),
    };
    if (step.success) {
      this.lastGoalAt = performance.now();
    }
  }

  stepGhostTransition(step: StepResult, durationMs: number): void {
    this.ghostTransition = {
      from: step.prevState,
      to: step.state,
      action: step.action,
      bump: step.bump,
      startedAt: performance.now(),
      durationMs: Math.max(70, durationMs),
    };
    this.ghostGroup.visible = true;
  }

  private resetOrbitDefaults(): void {
    this.orbitDistanceMin = this.layout.size * 0.8;
    this.orbitDistanceMax = this.layout.size * 2.8;
    this.orbitDistance = this.layout.size * 1.2;
    this.orbitAzimuth = Math.PI * 0.15;
    this.orbitElevation = 0.9;
  }

  private bindCameraInput(): void {
    const el = this.renderer.domElement;
    el.style.touchAction = "none";
    el.addEventListener("contextmenu", (event) => {
      if (this.viewMode === "first") {
        event.preventDefault();
      }
    });

    el.addEventListener("pointerdown", (event) => {
      if (this.viewMode === "first") {
        const isTouchLike = event.pointerType === "touch" || event.pointerType === "pen";
        const allowLook = isTouchLike ? this.fpTouchLookEnabled : event.button === 2;
        if (!allowLook) {
          return;
        }
        this.fpLookDragging = true;
        this.fpLookPointerId = event.pointerId;
        this.dragX = event.clientX;
        this.dragY = event.clientY;
        try {
          el.setPointerCapture(event.pointerId);
        } catch {
          // ignore capture issues
        }
        return;
      }
      this.dragging = true;
      this.autoOrbit = false;
      this.dragX = event.clientX;
      this.dragY = event.clientY;
      try {
        el.setPointerCapture(event.pointerId);
      } catch {
        // ignore capture issues
      }
    });

    el.addEventListener("pointermove", (event) => {
      if (this.viewMode === "first") {
        if (!this.fpLookDragging || (this.fpLookPointerId != null && event.pointerId !== this.fpLookPointerId)) {
          return;
        }
        const dx = event.clientX - this.dragX;
        const dy = event.clientY - this.dragY;
        this.dragX = event.clientX;
        this.dragY = event.clientY;
        this.fpYawOffset -= dx * 0.006;
        this.fpPitchOffset = Math.max(-0.32, Math.min(0.32, this.fpPitchOffset - dy * 0.004));
        return;
      }
      if (!this.dragging) {
        return;
      }
      const dx = event.clientX - this.dragX;
      const dy = event.clientY - this.dragY;
      this.dragX = event.clientX;
      this.dragY = event.clientY;

      this.orbitAzimuth -= dx * 0.006;
      this.orbitElevation = Math.max(0.2, Math.min(1.45, this.orbitElevation - dy * 0.004));
    });

    const stopDrag = () => {
      this.dragging = false;
      this.fpLookDragging = false;
      this.fpLookPointerId = null;
    };
    el.addEventListener("pointerup", stopDrag);
    el.addEventListener("pointercancel", stopDrag);
    el.addEventListener("pointerleave", stopDrag);

    el.addEventListener(
      "wheel",
      (event) => {
        if (this.viewMode === "first") {
          return;
        }
        event.preventDefault();
        this.autoOrbit = false;
        const next = this.orbitDistance + event.deltaY * 0.01;
        this.orbitDistance = Math.max(this.orbitDistanceMin, Math.min(this.orbitDistanceMax, next));
      },
      { passive: false }
    );

    el.addEventListener("dblclick", () => {
      if (this.viewMode === "first") {
        this.resetFirstPersonLook();
        return;
      }
      this.autoOrbit = true;
    });
  }

  private resetFirstPersonLook(): void {
    this.fpYawOffset = 0;
    this.fpPitchOffset = 0;
  }

  private cellToWorld(row: number, col: number): Vector3 {
    return new Vector3(col, 0, row); // Y = 0 ground level
  }

  private placeAgent(state: EnvState, ghost: boolean): void {
    const group = ghost ? this.ghostGroup : this.agentGroup;
    const pos = this.cellToWorld(state.row, state.col);
    group.position.copy(pos);
    // Rotate the group to face direction
    group.rotation.y = dirYaw(state.dir);
  }

  private buildMaze(layout: MazeLayout): void {
    this.root.remove(this.wallGroup);
    this.root.remove(this.hazardGroup);
    this.root.remove(this.markerGroup);
    this.wallGroup = new Group();
    this.hazardGroup = new Group();
    this.markerGroup = new Group();
    this.collectibleMeshes.clear();
    this.fireTiles = [];

    // Rebuild Floor (Instanced Tiles)
    if (this.floorMesh) {
      this.root.remove(this.floorMesh);
      this.floorMesh.dispose();
      this.floorMesh = null;
    }

    const floorGeo = new PlaneGeometry(1, 1);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = createFloorMaterial(2); // Assume size 2 to get initial repeat 0.5? No, let's fix texture.
    if (floorMat.map) floorMat.map.repeat.set(1, 1);

    const count = layout.size * layout.size;
    this.floorMesh = new InstancedMesh(floorGeo, floorMat, count);
    this.floorMesh.instanceMatrix.setUsage(35048); // DynamicDrawUsage? No, Static is default.

    let instanceIdx = 0;
    const dummy = new Object3D();

    for (let r = 0; r < layout.size; r += 1) {
      for (let c = 0; c < layout.size; c += 1) {
        const cell = layout.grid[r][c];

        // Floor Logic: Skip if Hole or Water
        // Note: Wall also needs floor? Or does Wall sit ON floor? 
        // Walls are opaque blocks. We can skip floor under them to save fill rate,
        // but keeping it is safer against gaps.
        // Holes (H) and Water (W) DEFINITELY need gaps.
        if (cell !== "H" && cell !== "W") {
          dummy.position.set(c, 0, r);
          dummy.updateMatrix();
          this.floorMesh.setMatrixAt(instanceIdx++, dummy.matrix);
        }

        if (cell === "#") {
          const wall = new Mesh(this.wallGeo, this.wallMaterial);
          wall.position.set(c, 0.5, r);
          this.wallGroup.add(wall);
          continue;
        }

        if (cell === "S") {
          const startPad = new Mesh(this.startGeo, this.startMaterial);
          startPad.position.set(c, 0.025, r);
          this.markerGroup.add(startPad);
        } else if (!isHazardTile(cell) && cell !== "G") {
          const collectible = new Mesh(this.collectibleGeo, this.collectibleMaterial);
          collectible.position.set(c, 0.05, r);
          this.markerGroup.add(collectible);
          this.collectibleMeshes.set(`${r},${c}`, collectible);
        }

        if (!isHazardTile(cell)) {
          continue;
        }

        if (cell === "H") {
          const hole = createHoleGroup();
          hole.position.set(c, 0, r);
          this.hazardGroup.add(hole);
          continue;
        }

        if (cell === "I") {
          const ice = createIceMesh();
          ice.position.set(c, 0, r);
          this.hazardGroup.add(ice);
          continue;
        }

        if (cell === "W") {
          const water = createWaterMesh();
          water.position.set(c, 0, r);
          // Add random phase for wave animation
          water.userData = { phase: Math.random() * 100 };
          this.hazardGroup.add(water);
          continue;
        }

        if (cell === "F") {
          const fire = createFireGroup();
          fire.position.set(c, 0, r);
          fire.userData.isFireTile = true;
          this.hazardGroup.add(fire);

          // Add a local point light for fire
          const fireLight = new PointLight(0xff6600, 0.8, 4);
          fireLight.position.set(0, 0.5, 0);
          // Animate intensity
          fireLight.userData = { baseIntensity: 0.8 };
          fire.add(fireLight);
          this.fireTiles.push(fire);
        }
      }
    }

    this.floorMesh.count = instanceIdx;
    this.floorMesh.instanceMatrix.needsUpdate = true;
    this.root.add(this.floorMesh);

    if (this.goalGroup) {
      this.root.remove(this.goalGroup);
    }
    this.goalGroup = createGoalMesh();
    this.goalGroup.position.set(layout.goal.col, 0.35, layout.goal.row);
    this.root.add(this.goalGroup);

    this.root.add(this.markerGroup);
    this.root.add(this.hazardGroup);
    this.root.add(this.wallGroup);

    this.collectAt(layout.start.row, layout.start.col);
  }

  public resize(width: number, height: number): void {
    if (!this.ready || !this.enabled) return;
    this.renderer.setSize(width, height, false);
    if (this.composer) {
      this.composer.setSize(width, height);
    }
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private renderLoop(now: number): void {
    if (!this.ready) return;

    if (this.enabled) {
      this.animateAgent(now, false);
      this.animateAgent(now, true);
      this.animateHazards(now);
      this.applyCamera(now);
      this.animateGoal(now);
      if (this.composer) {
        this.composer.render();
      } else {
        this.renderer.render(this.scene, this.camera);
      }
    }

    this.raf = requestAnimationFrame(this.renderLoop);
  }

  private animateGoal(now: number): void {
    if (!this.goalGroup) return;
    const pulse = 0.5 + 0.5 * Math.sin((now - this.lastGoalAt) * 0.003);
    const scale = 1 + pulse * 0.1;
    this.goalGroup.scale.set(scale, scale, scale);
    this.goalGroup.rotation.y += 0.01;
    this.goalGroup.rotation.z = Math.sin(now * 0.002) * 0.1;
  }

  private applyCamera(now: number): void {
    const center = (this.layout.size - 1) / 2;

    if (this.viewMode === "first") {
      const vec = dirVec(this.cameraState.dir);
      const baseYaw = Math.atan2(vec.x, vec.z);
      const yaw = baseYaw + this.fpYawCalibration + this.fpYawOffset;
      const pitch = Math.max(-0.72, Math.min(0.25, this.fpBasePitch + this.fpPitchOffset));
      const forwardX = Math.sin(yaw) * Math.cos(pitch);
      const forwardZ = Math.cos(yaw) * Math.cos(pitch);
      const forwardY = Math.sin(pitch);
      const eyeX = this.cameraState.col + vec.x * this.fpNearOffset;
      const eyeZ = this.cameraState.row + vec.z * this.fpNearOffset;
      const eyeY = this.fpEyeHeight;
      this.camera.position.set(eyeX, eyeY, eyeZ);
      this.camera.lookAt(
        eyeX + forwardX * this.fpLookDistance,
        eyeY + forwardY * this.fpLookDistance,
        eyeZ + forwardZ * this.fpLookDistance
      );
      if (this.headlamp) this.headlamp.position.copy(this.camera.position);
      return;
    }

    if (this.viewMode === "top") {
      const topY = Math.max(8, this.orbitDistance * 1.45);
      this.camera.position.set(center, topY, center + 0.001);
      this.camera.lookAt(center, 0, center);
      if (this.headlamp) this.headlamp.position.copy(this.camera.position);
      return;
    }

    if (this.autoOrbit && !this.dragging) {
      this.orbitAzimuth += this.orbitSpeed * (now > 0 ? 16 : 0);
    }

    const x = center + Math.cos(this.orbitAzimuth) * Math.cos(this.orbitElevation) * this.orbitDistance;
    const z = center + Math.sin(this.orbitAzimuth) * Math.cos(this.orbitElevation) * this.orbitDistance;
    const y = Math.sin(this.orbitElevation) * this.orbitDistance + 0.4;
    this.camera.position.set(x, y, z);
    this.camera.lookAt(center, 0, center);
    if (this.headlamp) this.headlamp.position.copy(this.camera.position);
  }

  private animateAgent(now: number, ghost: boolean): void {
    const transition = ghost ? this.ghostTransition : this.transition;
    const fallback = ghost ? this.lastGhostState : this.lastState;
    if (!transition) {
      if (fallback) {
        this.placeAgent(fallback, ghost);
        if (!ghost) {
          this.cameraState = { ...fallback };
        }
      }
      return;
    }

    const elapsed = now - transition.startedAt;
    const t = Math.min(1, elapsed / transition.durationMs);
    const eased = easeInOut(t);

    let row = transition.from.row + (transition.to.row - transition.from.row) * eased;
    let col = transition.from.col + (transition.to.col - transition.from.col) * eased;
    let dir = t < 0.5 ? transition.from.dir : transition.to.dir;

    if (transition.bump && transition.action === 0) {
      const amount = 0.18 * pingPong(eased);
      if (transition.from.dir === 0) row -= amount;
      if (transition.from.dir === 1) col += amount;
      if (transition.from.dir === 2) row += amount;
      if (transition.from.dir === 3) col -= amount;
      dir = transition.from.dir;
    }

    const visualState = { row, col, dir } as EnvState;
    this.placeAgent(visualState, ghost);
    if (!ghost) {
      this.cameraState = { ...visualState };
    }

    if (t >= 1) {
      if (ghost) {
        this.lastGhostState = { ...transition.to };
        this.ghostTransition = null;
      } else {
        this.lastState = { ...transition.to };
        this.transition = null;
      }
    }
  }
  private animateHazards(now: number): void {
    // Animate Fire
    this.fireTiles.forEach((fireParams) => {
      // Animate Light
      fireParams.children.forEach((child) => {
        if (child instanceof PointLight) {
          const base = (child.userData.baseIntensity as number) || 0.8;
          child.intensity = base + Math.sin(now * 0.01) * 0.3 + (Math.random() - 0.5) * 0.2;
        }
        // Animate Sprites (Particles)
        if (child instanceof Sprite && child.userData.speed) {
          const ud = child.userData;
          const y = (now * ud.speed + ud.offset) % 1;

          // Rise
          const h = 0.8;
          child.position.y = 0.1 + y * h;

          // Fade and Scale
          // 0 -> 1 -> 0 alpha? Or just fade out at top
          // Scale: Starts small, grows, then shrinks
          let s = ud.baseScale;
          if (y < 0.2) s *= y * 5; // Grow
          else s *= (1 - (y - 0.2) * 1.25); // Shrink

          child.scale.set(s, s, s);

          // Wiggle
          child.position.x = Math.sin(now * 0.005 + ud.offset) * ud.amp;
          child.position.z = Math.cos(now * 0.003 + ud.offset) * ud.amp;
        }
      });
    });

    // Animate Water (in hazardGroup)
    this.hazardGroup.children.forEach((group) => {
      // If the Group has a phase (set in buildMaze), use it
      if (group.userData.phase !== undefined) {
        // Find the surface mesh
        group.children.forEach((child) => {
          if (child.userData.isWaterSurface) {
            const phase = group.userData.phase;
            // Texture offset or simple vertex displacement simulation via scale/pos
            // "Breathing" water
            child.position.y = -0.05 + Math.sin(now * 0.002 + phase) * 0.01;
          }
        });
      }
    });
  }

  public triggerHazardEffect(type: "F" | "W" | "I" | "H"): void {
    if (!this.overlay) return;

    // Reset
    this.overlay.style.transition = "none";
    this.overlay.style.opacity = "0.8";

    if (type === "F") {
      this.overlay.style.backgroundColor = "#ff4400"; // Red/Orange
    } else if (type === "W") {
      this.overlay.style.backgroundColor = "#0066ff"; // Blue
    } else if (type === "I") {
      this.overlay.style.backgroundColor = "#ccffff"; // Ice Cyan
    } else if (type === "H") {
      this.overlay.style.backgroundColor = "#000000"; // Black
      this.overlay.style.opacity = "1.0";
    }

    // Fade out
    setTimeout(() => {
      this.overlay.style.transition = "opacity 0.6s ease-out";
      this.overlay.style.opacity = "0";
    }, 50);
  }
}
