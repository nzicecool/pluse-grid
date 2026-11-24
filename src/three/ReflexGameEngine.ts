import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { soundEngine } from '../audio/soundEngine';
import {
  CameraPreset,
  GamePhase,
  HudSnapshot,
  PatternName,
  PodKind,
  ReactionGrade,
} from '../types/game';
import { getPersonalBest } from '../utils/leaderboard';
import { buildReflexArenaAndRig, PodVisual, ReflexRigResult } from './rigBuilder';

// Pre-allocated module-scope math helpers (Zero-GC render loop)
const _vec3 = new THREE.Vector3();
const _vec3B = new THREE.Vector3();
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _color = new THREE.Color();
const _pointerNdc = new THREE.Vector2();

const COLOR_OFF = new THREE.Color(0x1b2434);
const COLOR_CYAN = new THREE.Color(0x00f0ff);
const COLOR_AMBER = new THREE.Color(0xffaa00);
const COLOR_VIOLET = new THREE.Color(0xa855f7);
const COLOR_HAZARD = new THREE.Color(0xff2a55);
const COLOR_SUCCESS = new THREE.Color(0x34d399);
const COLOR_TELEGRAPH = new THREE.Color(0x60a5fa);

interface ActivePodState {
  kind: PodKind;
  duration: number;
  elapsed: number;
  tapsRemaining: number;
  sequenceOrder: number; // 1-based for trace sequence
  activatedAtMs: number;
  telegraphDelay: number; // Wait before becoming clickable
}

interface SparkParticle {
  active: boolean;
  life: number;
  maxLife: number;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  color: THREE.Color;
  size: number;
}

const SPARK_POOL_SIZE = 160;
const MAX_LIVES = 3;

const CAMERA_PRESETS: Record<CameraPreset, { pos: [number, number, number]; look: [number, number, number] }> = {
  front: { pos: [0, 2.15, 5.15], look: [0, 2.02, 0] },
  angled: { pos: [1.55, 2.35, 4.95], look: [0, 1.98, 0] },
  wide: { pos: [-1.15, 2.45, 5.85], look: [0, 1.95, 0] },
};

export class ReflexGameEngine {
  private readonly container: HTMLElement;
  private readonly onHudUpdate: (snapshot: HudSnapshot) => void;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.PerspectiveCamera;
  private readonly rig: ReflexRigResult;
  private readonly raycaster: THREE.Raycaster;
  private readonly isSoftwareGl: boolean;

  private readonly sparkMesh: THREE.InstancedMesh;
  private readonly sparks: SparkParticle[] = [];
  private sparkCursor = 0;

  private readonly podStates: ActivePodState[];

  private frameId = 0;
  private lastTimeMs = performance.now();
  private totalElapsed = 0;
  private lastHoverCheckMs = 0;
  private disposed = false;

  // Game state
  private phase: GamePhase = 'title';
  private cameraPreset: CameraPreset = 'front';
  private camPos = new THREE.Vector3(...CAMERA_PRESETS.front.pos);
  private camLook = new THREE.Vector3(...CAMERA_PRESETS.front.look);
  private shakeIntensity = 0;

  private score = 0;
  private highScore = getPersonalBest();
  private wave = 1;
  private patternName: PatternName = 'SINGLE PULSE';
  private combo = 0;
  private maxCombo = 0;
  private lives = MAX_LIVES;
  private hits = 0;
  private totalAttempts = 0;
  private reactionSumMs = 0;
  private lastReactionMs: number | null = null;
  private reactionGrade: ReactionGrade = '';
  private gradeTimestamp = 0;

  // Wave / pattern scheduler
  private waveRoundsDone = 0;
  private waveRoundsTarget = 8;
  private nextSpawnTimer = 0;
  private lastSide = 0; // -1 left, 1 right for cross-sweep alternation
  private sequenceNextExpected = 1;
  private sequenceTotalSteps = 0;
  private sequencePods: number[] = [];
  private waveClearBannerTimer = 0;

  private lastHudPushMs = 0;

  constructor(container: HTMLElement, onHudUpdate: (snapshot: HudSnapshot) => void) {
    this.container = container;
    this.onHudUpdate = onHudUpdate;

    // 1. Software WebGL detection (only affects rendering cost, never scene content/logic)
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return false;
      }
    })();

    // 2. Renderer setup
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.style.touchAction = 'none';
    container.appendChild(this.renderer.domElement);

    // 3. Scene & Studio PMREM Environment
    this.scene = new THREE.Scene();
    const bgColor = new THREE.Color(0x070a10);
    this.scene.background = bgColor;
    this.scene.fog = new THREE.FogExp2(0x070a10, 0.045);

    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // 4. Camera
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(44, aspect, 0.1, 60);
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camLook);

    // 5. Balanced 3-Point Warm/Cool Studio Lighting Rig
    const hemiLight = new THREE.HemisphereLight(0x7dd3fc, 0x1e293b, 0.78);
    this.scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff1de, 2.2);
    keyLight.position.set(4.5, 7.2, 5.8);
    keyLight.castShadow = !this.isSoftwareGl;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 1;
    keyLight.shadow.camera.far = 22;
    keyLight.shadow.camera.left = -4.2;
    keyLight.shadow.camera.right = 4.2;
    keyLight.shadow.camera.top = 4.2;
    keyLight.shadow.camera.bottom = -4.2;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.35);
    rimLight.position.set(-4.2, 4.5, -4.5);
    this.scene.add(rimLight);

    // 6. Build Reflex Arena & Composite Rig
    const maxAnisotropy = this.renderer.capabilities.getMaxAnisotropy();
    this.rig = buildReflexArenaAndRig(this.scene, maxAnisotropy, !this.isSoftwareGl);

    // 7. Pooled 3D Spark Particles (InstancedMesh)
    const sparkGeo = new THREE.OctahedronGeometry(0.032, 0);
    const sparkMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.95,
    });
    this.sparkMesh = new THREE.InstancedMesh(sparkGeo, sparkMat, SPARK_POOL_SIZE);
    this.sparkMesh.frustumCulled = false;
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      this.sparks.push({
        active: false,
        life: 0,
        maxLife: 0.4,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        color: new THREE.Color(0x00f0ff),
        size: 1,
      });
      _mat4.makeScale(0, 0, 0);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, COLOR_CYAN);
    }
    this.sparkMesh.instanceMatrix.needsUpdate = true;
    if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    this.scene.add(this.sparkMesh);

    // 8. Pod States & Raycaster (Layer 1 only)
    this.podStates = this.rig.pods.map(() => ({
      kind: 'idle',
      duration: 1.5,
      elapsed: 0,
      tapsRemaining: 0,
      sequenceOrder: 0,
      activatedAtMs: 0,
      telegraphDelay: 0,
    }));

    this.raycaster = new THREE.Raycaster();
    this.raycaster.layers.set(1);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind events
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('resize', this.handleResize);

    this.pushHudSnapshot(true);
    this.scheduleNextTick();
  }

  public startGame(): void {
    soundEngine.unlock();
    soundEngine.playUiClick();

    this.score = 0;
    this.highScore = Math.max(this.highScore, getPersonalBest());
    this.wave = 1;
    this.combo = 0;
    this.maxCombo = 0;
    this.lives = MAX_LIVES;
    this.hits = 0;
    this.totalAttempts = 0;
    this.reactionSumMs = 0;
    this.lastReactionMs = null;
    this.reactionGrade = '';
    this.gradeTimestamp = 0;
    this.waveClearBannerTimer = 0;

    this.clearAllPods();
    this.configureWave(1);
    this.phase = 'playing';
    this.nextSpawnTimer = 0.45;
    this.pushHudSnapshot(true);
  }

  public togglePause(): void {
    if (this.phase === 'playing') {
      this.phase = 'paused';
      soundEngine.playUiClick();
      this.pushHudSnapshot(true);
    } else if (this.phase === 'paused') {
      this.phase = 'playing';
      this.lastTimeMs = performance.now();
      soundEngine.playUiClick();
      this.pushHudSnapshot(true);
    }
  }

  public returnToTitle(): void {
    this.phase = 'title';
    this.clearAllPods();
    this.pushHudSnapshot(true);
  }

  public setCameraPreset(preset: CameraPreset): void {
    this.cameraPreset = preset;
    soundEngine.playUiClick();
  }

  public refreshHighScore(): void {
    this.highScore = Math.max(this.highScore, getPersonalBest());
    this.pushHudSnapshot(true);
  }

  private getPatternForWave(wave: number): PatternName {
    if (wave === 1) return 'SINGLE PULSE';
    if (wave === 2) return 'CROSS SWEEP';
    if (wave === 3) return 'DUAL SYNC';
    if (wave === 4) return 'DOUBLE TAP';
    if (wave === 5) return 'TRACE SEQUENCE';
    if (wave === 6) return 'HAZARD BLITZ';
    return 'HYPER MATRIX';
  }

  private configureWave(wave: number): void {
    this.wave = wave;
    this.patternName = this.getPatternForWave(wave);
    this.waveRoundsDone = 0;
    if (wave === 1) this.waveRoundsTarget = 8;
    else if (wave === 2) this.waveRoundsTarget = 10;
    else if (wave === 3) this.waveRoundsTarget = 7;
    else if (wave === 4) this.waveRoundsTarget = 9;
    else if (wave === 5) this.waveRoundsTarget = 6;
    else if (wave === 6) this.waveRoundsTarget = 10;
    else this.waveRoundsTarget = 10 + Math.min(wave - 6, 6);
  }

  private getSpeedFactor(): number {
    return 1 + (this.wave - 1) * 0.22 + Math.min(this.waveRoundsDone, 10) * 0.025;
  }

  private clearAllPods(): void {
    for (let i = 0; i < this.podStates.length; i++) {
      this.podStates[i].kind = 'idle';
      this.podStates[i].elapsed = 0;
      this.podStates[i].tapsRemaining = 0;
      this.podStates[i].sequenceOrder = 0;
      this.podStates[i].telegraphDelay = 0;
    }
    this.sequencePods = [];
    this.sequenceNextExpected = 1;
    this.sequenceTotalSteps = 0;
    this.rig.sequenceLineGeometry.setDrawRange(0, 0);
  }

  private hasActiveTargetPods(): boolean {
    return this.podStates.some(
      (s) => s.kind === 'standard' || s.kind === 'double' || s.kind === 'sequence' || s.kind === 'telegraph',
    );
  }

  private pickIdlePods(count: number, filterFn?: (pod: PodVisual) => boolean): number[] {
    const candidates = this.rig.pods
      .filter((pod, idx) => this.podStates[idx].kind === 'idle' && (!filterFn || filterFn(pod)))
      .map((p) => p.index);

    // Shuffle Fisher-Yates
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, count);
  }

  private activatePod(
    index: number,
    kind: PodKind,
    duration: number,
    tapsRemaining = 1,
    sequenceOrder = 0,
    telegraphDelay = 0,
  ): void {
    const st = this.podStates[index];
    st.kind = telegraphDelay > 0 ? 'telegraph' : kind;
    st.duration = duration;
    st.elapsed = 0;
    st.tapsRemaining = tapsRemaining;
    st.sequenceOrder = sequenceOrder;
    st.telegraphDelay = telegraphDelay;
    st.activatedAtMs = performance.now() + telegraphDelay * 1000;
  }

  private spawnNextPatternRound(): void {
    const speed = this.getSpeedFactor();
    const baseWindow = Math.max(0.68, 1.92 / Math.pow(speed, 0.78));
    const nowWave = this.wave;

    // Choose sub-pattern
    let mode = this.patternName;
    if (mode === 'HYPER MATRIX') {
      const pool: PatternName[] = ['CROSS SWEEP', 'DUAL SYNC', 'DOUBLE TAP', 'TRACE SEQUENCE', 'HAZARD BLITZ'];
      mode = pool[this.waveRoundsDone % pool.length];
    }

    if (mode === 'SINGLE PULSE') {
      const [id] = this.pickIdlePods(1);
      if (id !== undefined) {
        this.activatePod(id, 'standard', baseWindow, 1);
      }
      return;
    }

    if (mode === 'CROSS SWEEP') {
      this.lastSide = this.lastSide === -1 ? 1 : -1;
      const sideFilter = (pod: PodVisual) => (this.lastSide === -1 ? pod.col <= 1 : pod.col >= 2);
      const [id] = this.pickIdlePods(1, sideFilter);
      if (id !== undefined) {
        this.activatePod(id, 'standard', baseWindow * 0.94, 1);
      }
      return;
    }

    if (mode === 'DUAL SYNC') {
      const ids = this.pickIdlePods(2);
      ids.forEach((id) => {
        this.activatePod(id, 'standard', baseWindow * 1.28, 1);
      });
      return;
    }

    if (mode === 'DOUBLE TAP') {
      const makeDouble = this.waveRoundsDone % 2 === 0;
      const [id] = this.pickIdlePods(1);
      if (id !== undefined) {
        if (makeDouble) {
          this.activatePod(id, 'double', baseWindow * 1.24, 2);
        } else {
          this.activatePod(id, 'standard', baseWindow * 0.92, 1);
        }
      }
      return;
    }

    if (mode === 'TRACE SEQUENCE') {
      const stepCount = nowWave >= 7 ? 4 : 3;
      const ids = this.pickIdlePods(stepCount);
      if (ids.length >= 2) {
        this.sequencePods = ids;
        this.sequenceTotalSteps = ids.length;
        this.sequenceNextExpected = 1;
        const seqDuration = baseWindow * (1.25 + ids.length * 0.36);

        ids.forEach((id, idx) => {
          const order = idx + 1;
          // Brief progressive telegraph sweep (0.11s per node) so eye reads 1->2->3
          this.activatePod(id, 'sequence', seqDuration, 1, order, idx * 0.11);
          soundEngine.playTelegraphTick(idx);
        });
        this.updateSequenceGuideLine();
      }
      return;
    }

    if (mode === 'HAZARD BLITZ') {
      const targetCount = nowWave >= 7 ? 2 : 1;
      const hazardCount = 1 + (this.waveRoundsDone % 3 === 0 ? 1 : 0);
      const chosen = this.pickIdlePods(targetCount + hazardCount);
      chosen.slice(0, targetCount).forEach((id) => {
        this.activatePod(id, 'standard', baseWindow * 1.08, 1);
      });
      chosen.slice(targetCount).forEach((id) => {
        this.activatePod(id, 'hazard', baseWindow * 1.12, 1);
      });
    }
  }

  private updateSequenceGuideLine(): void {
    const remaining = this.sequencePods.filter((id) => {
      const st = this.podStates[id];
      return (st.kind === 'sequence' || st.kind === 'telegraph') && st.sequenceOrder >= this.sequenceNextExpected;
    });

    if (remaining.length < 2) {
      this.rig.sequenceLineGeometry.setDrawRange(0, 0);
      return;
    }

    const posAttr = this.rig.sequenceLineGeometry.getAttribute('position') as THREE.BufferAttribute;
    remaining.forEach((podId, idx) => {
      const p = this.rig.pods[podId].worldCenter;
      posAttr.setXYZ(idx, p.x, p.y, p.z + 0.04);
    });
    posAttr.needsUpdate = true;
    this.rig.sequenceLineGeometry.setDrawRange(0, remaining.length);
  }

  private spawnSparks(pod: PodVisual, color: THREE.Color, count = 18): void {
    for (let i = 0; i < count; i++) {
      const sp = this.sparks[this.sparkCursor];
      this.sparkCursor = (this.sparkCursor + 1) % SPARK_POOL_SIZE;

      sp.active = true;
      sp.life = 0;
      sp.maxLife = 0.28 + Math.random() * 0.22;
      sp.pos.copy(pod.worldCenter);
      sp.vel
        .copy(pod.worldNormal)
        .multiplyScalar(1.8 + Math.random() * 2.6)
        .add(
          _vec3.set(
            (Math.random() - 0.5) * 3.8,
            (Math.random() - 0.35) * 3.8,
            (Math.random() - 0.5) * 1.4,
          ),
        );
      sp.color.copy(color);
      sp.size = 0.65 + Math.random() * 0.9;
    }
  }

  private handlePointerMove = (e: PointerEvent): void => {
    const now = performance.now();
    if (now - this.lastHoverCheckMs < 35) return;
    this.lastHoverCheckMs = now;

    if (this.phase !== 'playing') {
      this.renderer.domElement.style.cursor = 'default';
      return;
    }

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    const hits = this.raycaster.intersectObjects(this.rig.hitMeshes, false);

    if (hits.length > 0) {
      const podIdx = hits[0].object.userData.podIndex as number;
      const st = this.podStates[podIdx];
      this.renderer.domElement.style.cursor = st.kind !== 'idle' ? 'pointer' : 'default';
    } else {
      this.renderer.domElement.style.cursor = 'default';
    }
  };

  private handlePointerDown = (e: PointerEvent): void => {
    soundEngine.unlock();
    if (this.phase !== 'playing') return;

    const rect = this.renderer.domElement.getBoundingClientRect();
    _pointerNdc.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    _pointerNdc.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    this.raycaster.setFromCamera(_pointerNdc, this.camera);
    const intersects = this.raycaster.intersectObjects(this.rig.hitMeshes, false);
    if (intersects.length === 0) return;

    const podIdx = intersects[0].object.userData.podIndex as number;
    this.onPodPressed(podIdx);
  };

  private onPodPressed(podIdx: number): void {
    const pod = this.rig.pods[podIdx];
    const st = this.podStates[podIdx];

    // Physical spring button strike impulse on any pod pressed
    pod.pressVelocity = -0.85;
    pod.pressOffset = -0.025;

    if (st.kind === 'idle') {
      // Harmless empty press (does not penalize lives, keeps tactile responsiveness crisp)
      soundEngine.playUiClick();
      return;
    }

    if (st.kind === 'telegraph') {
      // Allow eager player hits on step 1 even at the tail of telegraph
      if (st.sequenceOrder === 1) {
        st.kind = 'sequence';
      } else {
        return;
      }
    }

    // 1. Hazard hit!
    if (st.kind === 'hazard') {
      this.totalAttempts++;
      this.combo = 0;
      this.lives = Math.max(0, this.lives - 1);
      st.kind = 'idle';
      pod.flashIntensity = 1.0;
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.085);
      this.spawnSparks(pod, COLOR_HAZARD, 22);
      soundEngine.playHazard();
      this.setReactionGrade('HAZARD', null);
      this.checkGameOverOrWave();
      this.pushHudSnapshot(true);
      return;
    }

    // 2. Sequence order check
    if (st.kind === 'sequence' && st.sequenceOrder !== this.sequenceNextExpected) {
      // Out-of-order strike breaks combo & costs a shield
      this.totalAttempts++;
      this.combo = 0;
      this.lives = Math.max(0, this.lives - 1);
      pod.flashIntensity = 0.8;
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.075);
      this.spawnSparks(pod, COLOR_HAZARD, 16);
      soundEngine.playHazard();
      this.setReactionGrade('MISS', null);
      this.clearAllPods();
      this.nextSpawnTimer = 0.45;
      this.checkGameOverOrWave();
      this.pushHudSnapshot(true);
      return;
    }

    // 3. Double-tap first strike
    if (st.kind === 'double' && st.tapsRemaining > 1) {
      st.tapsRemaining -= 1;
      st.duration += 0.35; // Slight grace window for the second strike
      pod.flashIntensity = 0.85;
      this.spawnSparks(pod, COLOR_AMBER, 12);
      soundEngine.playDoubleTapFirst();
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.02);
      return;
    }

    // 4. Valid Pod Hit!
    const reactionMs = Math.max(85, Math.round(performance.now() - st.activatedAtMs));
    this.hits++;
    this.totalAttempts++;
    this.reactionSumMs += reactionMs;
    this.lastReactionMs = reactionMs;

    this.combo++;
    if (this.combo > this.maxCombo) this.maxCombo = this.combo;

    const multiplier = this.getMultiplier();
    const speedBonus = reactionMs < 360 ? 65 : reactionMs < 550 ? 35 : 15;
    const typeBonus = st.kind === 'double' ? 140 : st.kind === 'sequence' ? 120 : 100;
    this.score += Math.round((typeBonus + speedBonus) * multiplier);
    if (this.score > this.highScore) this.highScore = this.score;

    const isLightning = reactionMs < 380;
    const grade: ReactionGrade = isLightning ? 'LIGHTNING' : reactionMs < 620 ? 'SHARP' : 'GOOD';
    this.setReactionGrade(grade, reactionMs);

    const sparkCol =
      st.kind === 'double' ? COLOR_AMBER : st.kind === 'sequence' ? COLOR_VIOLET : COLOR_SUCCESS;
    this.spawnSparks(pod, sparkCol, isLightning ? 24 : 16);
    pod.flashIntensity = 1.0;
    this.shakeIntensity = Math.max(this.shakeIntensity, isLightning ? 0.036 : 0.022);
    soundEngine.playHit(this.combo, isLightning);

    const wasSeq = st.kind === 'sequence';
    st.kind = 'idle';
    st.tapsRemaining = 0;

    if (wasSeq) {
      this.sequenceNextExpected++;
      // Activate next step immediately if still in telegraph
      this.sequencePods.forEach((id) => {
        if (this.podStates[id].kind === 'telegraph' && this.podStates[id].sequenceOrder === this.sequenceNextExpected) {
          this.podStates[id].kind = 'sequence';
          this.podStates[id].activatedAtMs = performance.now();
        }
      });
      this.updateSequenceGuideLine();
      if (this.sequenceNextExpected > this.sequenceTotalSteps) {
        this.score += Math.round(150 * multiplier);
        this.advanceWaveRound();
      }
    } else if (!this.hasActiveTargetPods()) {
      // Clear any leftover hazards cleanly when all valid targets in round are cleared
      for (let i = 0; i < this.podStates.length; i++) {
        if (this.podStates[i].kind === 'hazard') this.podStates[i].kind = 'idle';
      }
      this.advanceWaveRound();
    }

    this.pushHudSnapshot(true);
  }

  private setReactionGrade(grade: ReactionGrade, reactionMs: number | null): void {
    this.reactionGrade = grade;
    this.gradeTimestamp = performance.now();
    if (reactionMs !== null) {
      this.lastReactionMs = reactionMs;
    }
  }

  private advanceWaveRound(): void {
    this.waveRoundsDone++;
    if (this.waveRoundsDone >= this.waveRoundsTarget) {
      const nextWave = this.wave + 1;
      this.configureWave(nextWave);
      this.waveClearBannerTimer = 1.15;
      this.nextSpawnTimer = 1.05;
      this.setReactionGrade('WAVE CLEAR', null);
      soundEngine.playWaveClear();
      // Bonus life recovery up to max on every 2nd wave cleared
      if (nextWave % 2 === 1 && this.lives < MAX_LIVES) {
        this.lives++;
      }
    } else {
      const gap = Math.max(0.14, 0.36 - (this.wave - 1) * 0.035);
      this.nextSpawnTimer = gap;
    }
  }

  private checkGameOverOrWave(): void {
    if (this.lives <= 0) {
      this.phase = 'gameover';
      this.clearAllPods();
      soundEngine.playGameOver();
    }
  }

  private getMultiplier(): number {
    return 1 + Math.min(4, Math.floor(this.combo / 5)) * 0.5;
  }

  private handleResize = (): void => {
    if (this.disposed) return;
    const width = this.container.clientWidth || window.innerWidth;
    const height = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
  };

  private updateSimulation(dt: number): void {
    this.totalElapsed += dt;

    if (this.phase === 'title') {
      this.updateTitleAttractMode();
    } else if (this.phase === 'playing') {
      this.updateActiveGameplay(dt);
    }

    this.updatePodVisualsAndSprings(dt);
    this.updateSparks(dt);
    this.updateCamera(dt);
    this.updateHeaderDisplay();

    if (performance.now() - this.lastHudPushMs > 60) {
      this.pushHudSnapshot(false);
    }
  }

  private updateTitleAttractMode(): void {
    // Clean, rhythmic diagonal light wave on the 12-pod physical rig
    const t = this.totalElapsed * 2.1;
    for (let i = 0; i < this.rig.pods.length; i++) {
      const pod = this.rig.pods[i];
      const wave = Math.sin(t - (pod.col * 0.65 + pod.row * 0.45));
      const st = this.podStates[i];
      if (wave > 0.55) {
        st.kind = (pod.col + pod.row) % 3 === 0 ? 'double' : 'standard';
        st.duration = 1.0;
        st.elapsed = (1.0 - wave) * 0.8;
      } else {
        st.kind = 'idle';
        st.elapsed = 0;
      }
    }
  }

  private updateActiveGameplay(dt: number): void {
    if (this.waveClearBannerTimer > 0) {
      this.waveClearBannerTimer = Math.max(0, this.waveClearBannerTimer - dt);
    }

    let expiredValidCount = 0;
    let sequenceExpired = false;

    for (let i = 0; i < this.podStates.length; i++) {
      const st = this.podStates[i];
      if (st.kind === 'idle') continue;

      st.elapsed += dt;

      if (st.kind === 'telegraph') {
        if (st.elapsed >= st.telegraphDelay) {
          st.kind = 'sequence';
          st.elapsed = 0;
          st.activatedAtMs = performance.now();
        }
        continue;
      }

      if (st.elapsed >= st.duration) {
        if (st.kind === 'hazard') {
          // Hazard ignored cleanly!
          st.kind = 'idle';
          st.elapsed = 0;
        } else {
          if (st.kind === 'sequence') sequenceExpired = true;
          st.kind = 'idle';
          st.elapsed = 0;
          expiredValidCount++;
        }
      }
    }

    if (sequenceExpired) {
      // Clear remaining steps in broken sequence
      for (let i = 0; i < this.podStates.length; i++) {
        if (this.podStates[i].kind === 'sequence' || this.podStates[i].kind === 'telegraph') {
          this.podStates[i].kind = 'idle';
        }
      }
      this.rig.sequenceLineGeometry.setDrawRange(0, 0);
    }

    if (expiredValidCount > 0) {
      this.totalAttempts++;
      this.combo = 0;
      this.lives = Math.max(0, this.lives - 1);
      this.shakeIntensity = Math.max(this.shakeIntensity, 0.065);
      soundEngine.playMiss();
      this.setReactionGrade('MISS', null);
      // Clear leftover hazards on round failure
      for (let i = 0; i < this.podStates.length; i++) {
        if (this.podStates[i].kind === 'hazard') this.podStates[i].kind = 'idle';
      }
      this.checkGameOverOrWave();
      if (this.phase === 'playing') {
        this.nextSpawnTimer = 0.35;
      }
      this.pushHudSnapshot(true);
      return;
    }

    // Spawn next pattern round if board is clear
    if (!this.hasActiveTargetPods()) {
      this.nextSpawnTimer -= dt;
      if (this.nextSpawnTimer <= 0) {
        this.spawnNextPatternRound();
        this.nextSpawnTimer = 0.25;
      }
    }
  }

  private updatePodVisualsAndSprings(dt: number): void {
    const stiffness = 380;
    const damping = 26;

    for (let i = 0; i < this.rig.pods.length; i++) {
      const pod = this.rig.pods[i];
      const st = this.podStates[i];

      // Spring physics for physical dome press/rebound
      const force = -stiffness * pod.pressOffset - damping * pod.pressVelocity;
      pod.pressVelocity += force * dt;
      pod.pressOffset += pod.pressVelocity * dt;
      pod.buttonGroup.position.z = 0.015 + pod.pressOffset;

      if (pod.flashIntensity > 0) {
        pod.flashIntensity = Math.max(0, pod.flashIntensity - dt * 4.5);
      }

      // Compute target visual emissive & halo ring state
      let targetColor = COLOR_OFF;
      let emissiveIntensity = 0;
      let haloProgress = 0;
      let haloIntensity = 0;
      let glyphKey = 'empty';

      if (st.kind === 'standard') {
        targetColor = COLOR_CYAN;
        const remain = Math.max(0, 1 - st.elapsed / st.duration);
        emissiveIntensity = 1.45 + Math.sin(this.totalElapsed * 14) * 0.12;
        haloProgress = remain;
        haloIntensity = 1.0;
      } else if (st.kind === 'double') {
        targetColor = COLOR_AMBER;
        const remain = Math.max(0, 1 - st.elapsed / st.duration);
        emissiveIntensity = st.tapsRemaining === 2 ? 1.65 : 2.15;
        haloProgress = remain;
        haloIntensity = 1.05;
        glyphKey = st.tapsRemaining === 2 ? 'double' : 'empty';
      } else if (st.kind === 'sequence') {
        targetColor = COLOR_VIOLET;
        const remain = Math.max(0, 1 - st.elapsed / st.duration);
        const isCurrent = st.sequenceOrder === this.sequenceNextExpected;
        emissiveIntensity = isCurrent ? 1.85 : 0.72;
        haloProgress = remain;
        haloIntensity = isCurrent ? 1.15 : 0.45;
        glyphKey = `seq-${Math.min(4, Math.max(1, st.sequenceOrder))}`;
      } else if (st.kind === 'telegraph') {
        targetColor = COLOR_TELEGRAPH;
        emissiveIntensity = 0.65;
        haloProgress = 1.0;
        haloIntensity = 0.45;
        glyphKey = `seq-${Math.min(4, Math.max(1, st.sequenceOrder))}`;
      } else if (st.kind === 'hazard') {
        targetColor = COLOR_HAZARD;
        const remain = Math.max(0, 1 - st.elapsed / st.duration);
        emissiveIntensity = 1.55 + Math.sin(this.totalElapsed * 22) * 0.25;
        haloProgress = remain;
        haloIntensity = 1.0;
        glyphKey = 'hazard';
      }

      // Apply flash boost
      if (pod.flashIntensity > 0.02) {
        _color.copy(targetColor).lerp(COLOR_SUCCESS, pod.flashIntensity * 0.65);
        emissiveIntensity = Math.max(emissiveIntensity, pod.flashIntensity * 2.6);
      } else {
        _color.copy(targetColor);
      }

      const isLit = st.kind !== 'idle' || pod.flashIntensity > 0.02;
      pod.domeMaterial.color.copy(isLit ? _color : COLOR_OFF);
      pod.domeMaterial.emissive.copy(isLit ? _color : COLOR_OFF);
      pod.domeMaterial.emissiveIntensity = isLit ? emissiveIntensity * 0.55 : 0;

      pod.coreMaterial.color.copy(isLit ? _color : COLOR_OFF);
      pod.coreMaterial.emissive.copy(isLit ? _color : COLOR_OFF);
      pod.coreMaterial.emissiveIntensity = isLit ? emissiveIntensity * 1.45 : 0;

      pod.haloMaterial.uniforms.uProgress.value = haloProgress;
      pod.haloMaterial.uniforms.uIntensity.value = haloIntensity;
      (pod.haloMaterial.uniforms.uColor.value as THREE.Color).copy(_color);

      // Update glyph overlay cleanly without allocation
      if (glyphKey !== 'empty' && this.rig.glyphTextures[glyphKey]) {
        pod.glyphMesh.visible = true;
        pod.glyphMaterial.map = this.rig.glyphTextures[glyphKey];
        pod.glyphMaterial.opacity = st.kind === 'telegraph' ? 0.72 : 0.96;
      } else {
        pod.glyphMesh.visible = false;
      }
    }
  }

  private updateSparks(dt: number): void {
    let anyChanged = false;
    for (let i = 0; i < SPARK_POOL_SIZE; i++) {
      const sp = this.sparks[i];
      if (!sp.active) continue;
      anyChanged = true;
      sp.life += dt;
      if (sp.life >= sp.maxLife) {
        sp.active = false;
        _mat4.makeScale(0, 0, 0);
        this.sparkMesh.setMatrixAt(i, _mat4);
        continue;
      }

      sp.vel.y -= 7.2 * dt; // Gravity
      sp.vel.multiplyScalar(Math.max(0, 1 - 2.6 * dt)); // Air drag
      sp.pos.addScaledVector(sp.vel, dt);

      const s = sp.size * (1 - sp.life / sp.maxLife);
      _quat.setFromEuler(
        new THREE.Euler(sp.life * 10, sp.life * 14, 0),
      );
      _scale.set(s, s, s);
      _mat4.compose(sp.pos, _quat, _scale);
      this.sparkMesh.setMatrixAt(i, _mat4);
      this.sparkMesh.setColorAt(i, sp.color);
    }

    if (anyChanged) {
      this.sparkMesh.instanceMatrix.needsUpdate = true;
      if (this.sparkMesh.instanceColor) this.sparkMesh.instanceColor.needsUpdate = true;
    }
  }

  private updateCamera(dt: number): void {
    const preset = CAMERA_PRESETS[this.cameraPreset];
    if (this.phase === 'title') {
      // Gentle cinematic showcase sway while on Title Screen
      const orbitX = Math.sin(this.totalElapsed * 0.35) * 0.95;
      const orbitY = 2.15 + Math.cos(this.totalElapsed * 0.25) * 0.14;
      _vec3.set(orbitX, orbitY, 5.25);
      _vec3B.set(0, 2.02, 0);
    } else {
      _vec3.set(...preset.pos);
      _vec3B.set(...preset.look);
    }

    this.camPos.x = THREE.MathUtils.damp(this.camPos.x, _vec3.x, 5.5, dt);
    this.camPos.y = THREE.MathUtils.damp(this.camPos.y, _vec3.y, 5.5, dt);
    this.camPos.z = THREE.MathUtils.damp(this.camPos.z, _vec3.z, 5.5, dt);

    this.camLook.x = THREE.MathUtils.damp(this.camLook.x, _vec3B.x, 6.0, dt);
    this.camLook.y = THREE.MathUtils.damp(this.camLook.y, _vec3B.y, 6.0, dt);
    this.camLook.z = THREE.MathUtils.damp(this.camLook.z, _vec3B.z, 6.0, dt);

    this.camera.position.copy(this.camPos);

    if (this.shakeIntensity > 0.001) {
      this.camera.position.x += (Math.random() - 0.5) * this.shakeIntensity;
      this.camera.position.y += (Math.random() - 0.5) * this.shakeIntensity;
      this.shakeIntensity = THREE.MathUtils.damp(this.shakeIntensity, 0, 18, dt);
    }

    this.camera.lookAt(this.camLook);
  }

  private updateHeaderDisplay(): void {
    if (this.phase === 'title') {
      this.rig.headerDisplay.update('PULSE GRID 3D', 'ATTRACT MODE', this.highScore, '#00f0ff');
    } else if (this.phase === 'paused') {
      this.rig.headerDisplay.update(`WAVE ${this.wave}`, 'PAUSED', this.score, '#ffaa00');
    } else if (this.phase === 'gameover') {
      this.rig.headerDisplay.update(`PEAK WAVE ${this.wave}`, 'SESSION COMPLETE', this.score, '#ff2a55');
    } else {
      const accent =
        this.patternName === 'DOUBLE TAP'
          ? '#ffaa00'
          : this.patternName === 'TRACE SEQUENCE'
            ? '#a855f7'
            : this.patternName === 'HAZARD BLITZ'
              ? '#ff2a55'
              : '#00f0ff';
      this.rig.headerDisplay.update(`WAVE ${this.wave}`, this.patternName, this.score, accent);
    }
  }

  private pushHudSnapshot(force: boolean): void {
    const now = performance.now();
    if (!force && now - this.lastHudPushMs < 60) return;
    this.lastHudPushMs = now;

    const avgReactionMs = this.hits > 0 ? Math.round(this.reactionSumMs / this.hits) : 0;
    const accuracy = this.totalAttempts > 0 ? Math.round((this.hits / this.totalAttempts) * 100) : 100;

    this.onHudUpdate({
      phase: this.phase,
      score: this.score,
      highScore: this.highScore,
      wave: this.wave,
      patternName: this.patternName,
      combo: this.combo,
      maxCombo: this.maxCombo,
      multiplier: this.getMultiplier(),
      lives: this.lives,
      maxLives: MAX_LIVES,
      avgReactionMs,
      lastReactionMs: this.lastReactionMs,
      accuracy,
      hits: this.hits,
      totalAttempts: this.totalAttempts,
      waveProgress: this.waveRoundsTarget > 0 ? this.waveRoundsDone / this.waveRoundsTarget : 0,
      speedFactor: Number(this.getSpeedFactor().toFixed(2)),
      reactionGrade: this.reactionGrade,
      gradeTimestamp: this.gradeTimestamp,
    });
  }

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
    gl.flush();
    if (!sync) {
      this.frameId = window.setTimeout(cb, 80);
      return;
    }
    const poll = () => {
      if (this.disposed) {
        gl.deleteSync(sync);
        return;
      }
      const state = gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  private scheduleNextTick(): void {
    if (this.disposed) return;
    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  }

  private tick = (): void => {
    if (this.disposed) return;

    const now = performance.now();
    const rawDt = (now - this.lastTimeMs) / 1000;
    this.lastTimeMs = now;
    const dt = Math.min(Math.max(rawDt, 0.001), 0.05);

    this.updateSimulation(dt);
    this.renderer.render(this.scene, this.camera);
    this.scheduleNextTick();
  };

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    this.renderer.domElement.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('resize', this.handleResize);

    this.sparkMesh.geometry.dispose();
    (this.sparkMesh.material as THREE.Material).dispose();
    this.rig.dispose();
    this.renderer.dispose();

    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
