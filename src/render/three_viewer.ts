import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  HemisphereLight,
  Mesh,
  MeshLambertMaterial,
  MeshStandardMaterial,
  PerspectiveCamera,
  PlaneGeometry,
  PointLight,
  Scene,
  Vector3,
  WebGLRenderer,
} from "three";
import { Action, Direction, EnvState, StepResult } from "../core/env";
import { MazeLayout } from "../core/maze_types";
import { easeInOut, pingPong } from "./animations";
import { createBotMesh, createFloorMaterial, createGoalMesh, createWallMaterial } from "./renderer_utils";

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

export class ThreeMazeViewer {
  private container: HTMLElement;
  private renderer: WebGLRenderer;
  private scene: Scene;
  private camera: PerspectiveCamera;
  private root = new Group();
  private layout: MazeLayout;
  private wallGroup = new Group();
  private wallGeo = new BoxGeometry(1, 1, 1);
  private wallMaterial!: MeshStandardMaterial;
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
    this.scene.background = new Color("#111116"); // Darker sci-fi background

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
      this.ready = true;
    } catch (err) {
      console.warn("Three.js renderer unavailable", err);
      this.renderer = null as unknown as WebGLRenderer;
      this.ready = false;
      return;
    }

    this.container.appendChild(this.renderer.domElement);

    // Lighting
    const hemi = new HemisphereLight(0xffffff, 0x080820, 0.4); // Softer sky
    this.scene.add(hemi);

    const light = new DirectionalLight(0xffffff, 1.0);
    light.position.set(5, 12, 8);
    this.scene.add(light);

    // Dynamic Headlamp (Attached to camera in applyCamera)
    this.headlamp = new PointLight(0xffffff, 1.2, 8);
    this.headlamp.castShadow = true;
    this.scene.add(this.headlamp);

    // Sub-glow for atmosphere
    const accentLight = new PointLight(0x00d4ff, 0.5, 15);
    accentLight.position.set(layout.size / 2, 2, layout.size / 2);
    this.scene.add(accentLight);

    // Floor
    const floorMat = createFloorMaterial(layout.size);
    const floor = new Mesh(new PlaneGeometry(layout.size, layout.size), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set((layout.size - 1) / 2, -0.001, (layout.size - 1) / 2);
    this.root.add(floor);

    this.root.add(this.agentGroup, this.ghostGroup);
    this.scene.add(this.root);

    // Wall Material
    this.wallMaterial = createWallMaterial();

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
    this.wallMaterial.map?.dispose();
    this.wallMaterial.dispose();
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

  setZoomPercent(percent: number): void {
    const p = Math.max(0, Math.min(1, percent));
    this.orbitDistance = this.orbitDistanceMin + p * (this.orbitDistanceMax - this.orbitDistanceMin);
  }

  setAutoOrbit(enabled: boolean): void {
    this.autoOrbit = enabled;
  }

  setAgentState(state: EnvState): void {
    this.transition = null;
    this.lastState = { ...state };
    this.cameraState = { ...state };
    this.placeAgent(state, false);
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

  stepTransition(step: StepResult, durationMs: number): void {
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
    this.wallGroup = new Group();

    for (let r = 0; r < layout.size; r += 1) {
      for (let c = 0; c < layout.size; c += 1) {
        if (layout.grid[r][c] !== "#") continue;
        const wall = new Mesh(this.wallGeo, this.wallMaterial);
        wall.position.set(c, 0.5, r);
        this.wallGroup.add(wall);
      }
    }

    if (this.goalGroup) {
      this.root.remove(this.goalGroup);
    }
    this.goalGroup = createGoalMesh();
    this.goalGroup.position.set(layout.goal.col, 0.35, layout.goal.row);
    this.root.add(this.goalGroup);

    this.root.add(this.wallGroup);
  }

  public resize(width: number, height: number): void {
    if (!this.ready || !this.enabled) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }

  private renderLoop(now: number): void {
    if (!this.ready) return;

    if (this.enabled) {
      this.animateAgent(now, false);
      this.animateAgent(now, true);
      this.applyCamera(now);
      this.animateGoal(now);
      this.renderer.render(this.scene, this.camera);
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
      const yaw = baseYaw + this.fpYawOffset;
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
}
