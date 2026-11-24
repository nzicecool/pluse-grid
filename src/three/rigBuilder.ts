import * as THREE from 'three';
import {
  BoardHeaderDisplay,
  createBoardPanelTexture,
  createBrushedMetalTexture,
  createContactShadowTexture,
  createFloorGridTexture,
  createPodGlyphTexture,
} from './textures';

export interface PodVisual {
  index: number;
  row: number;
  col: number;
  root: THREE.Group;
  buttonGroup: THREE.Group;
  domeMaterial: THREE.MeshPhysicalMaterial;
  coreMaterial: THREE.MeshStandardMaterial;
  haloMaterial: THREE.ShaderMaterial;
  glyphMesh: THREE.Mesh;
  glyphMaterial: THREE.MeshBasicMaterial;
  hitMesh: THREE.Mesh;
  worldCenter: THREE.Vector3;
  worldNormal: THREE.Vector3;
  pressOffset: number;
  pressVelocity: number;
  flashIntensity: number;
}

export interface ReflexRigResult {
  rootGroup: THREE.Group;
  pods: PodVisual[];
  hitMeshes: THREE.Mesh[];
  headerDisplay: BoardHeaderDisplay;
  glyphTextures: Record<string, THREE.CanvasTexture>;
  sequenceLine: THREE.Line;
  sequenceLineGeometry: THREE.BufferGeometry;
  sequenceLineMaterial: THREE.LineBasicMaterial;
  dispose: () => void;
}

const HALO_VERTEX_SHADER = `
  varying vec2 vLocalPos;
  void main() {
    vLocalPos = position.xy;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const HALO_FRAGMENT_SHADER = `
  uniform float uProgress;
  uniform float uIntensity;
  uniform vec3 uColor;
  uniform float uSegments;
  varying vec2 vLocalPos;

  void main() {
    // Clockwise from 12 o'clock (0, 1)
    float angle = atan(vLocalPos.x, vLocalPos.y);
    float normAngle = mod(angle / 6.28318530718 + 1.0, 1.0);

    // Segment divider gaps
    float segPhase = fract(normAngle * uSegments);
    float segMask = smoothstep(0.06, 0.14, segPhase) * (1.0 - smoothstep(0.86, 0.94, segPhase));

    float activeMask = step(normAngle, uProgress);
    vec3 offCol = vec3(0.06, 0.08, 0.12);
    vec3 litCol = uColor * (0.85 + 1.35 * uIntensity);

    vec3 finalCol = mix(offCol, litCol, activeMask * segMask);
    float alpha = mix(0.45 * segMask, 0.98, activeMask * segMask);
    if (uIntensity <= 0.02) {
      finalCol = offCol;
      alpha = 0.32 * segMask;
    }

    gl_FragColor = vec4(finalCol, alpha);
  }
`;

function createBeveledPanelGeometry(width: number, height: number, depth: number, radius: number): THREE.ExtrudeGeometry {
  const hw = width / 2;
  const hh = height / 2;
  const r = Math.min(radius, hw * 0.4, hh * 0.4);

  const shape = new THREE.Shape();
  shape.moveTo(-hw + r, -hh);
  shape.lineTo(hw - r, -hh);
  shape.quadraticCurveTo(hw, -hh, hw, -hh + r);
  shape.lineTo(hw, hh - r);
  shape.quadraticCurveTo(hw, hh, hw - r, hh);
  shape.lineTo(-hw + r, hh);
  shape.quadraticCurveTo(-hw, hh, -hw, hh - r);
  shape.lineTo(-hw, -hh + r);
  shape.quadraticCurveTo(-hw, -hh, -hw + r, -hh);

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.025,
    bevelSize: 0.025,
    bevelSegments: 3,
    curveSegments: 8,
  });
  geo.center();
  return geo;
}

export function buildReflexArenaAndRig(
  scene: THREE.Scene,
  maxAnisotropy: number,
  enableShadows: boolean,
): ReflexRigResult {
  const disposables: Array<{ dispose: () => void }> = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  // Procedural textures
  const boardTex = track(createBoardPanelTexture(maxAnisotropy));
  const metalTex = track(createBrushedMetalTexture(maxAnisotropy));
  const floorTex = track(createFloorGridTexture(maxAnisotropy));
  const shadowTex = track(createContactShadowTexture());
  const headerDisplay = track(new BoardHeaderDisplay(maxAnisotropy));

  // Shared glyph texture cache (reused across pods to avoid per-frame allocations)
  const glyphCache = new Map<string, THREE.CanvasTexture>();
  const getGlyphTex = (key: string, label: string, hex: string): THREE.CanvasTexture => {
    const existing = glyphCache.get(key);
    if (existing) return existing;
    const tex = track(createPodGlyphTexture(label, hex));
    glyphCache.set(key, tex);
    return tex;
  };
  // Pre-warm common glyph keys for zero-GC runtime swapping
  const glyphTextures: Record<string, THREE.CanvasTexture> = {
    empty: getGlyphTex('empty', '', '#00f0ff'),
    'seq-1': getGlyphTex('seq-1', '1', '#a855f7'),
    'seq-2': getGlyphTex('seq-2', '2', '#a855f7'),
    'seq-3': getGlyphTex('seq-3', '3', '#a855f7'),
    'seq-4': getGlyphTex('seq-4', '4', '#a855f7'),
    double: getGlyphTex('double', '×2', '#ffaa00'),
    hazard: getGlyphTex('hazard', '✕', '#ff2a55'),
  };

  // --- Studio Arena Floor ---
  const floorGeo = track(new THREE.PlaneGeometry(36, 36));
  const floorMat = track(
    new THREE.MeshStandardMaterial({
      map: floorTex,
      roughness: 0.78,
      metalness: 0.12,
    }),
  );
  const floorMesh = new THREE.Mesh(floorGeo, floorMat);
  floorMesh.rotation.x = -Math.PI / 2;
  floorMesh.position.y = 0;
  floorMesh.receiveShadow = enableShadows;
  scene.add(floorMesh);

  // Subtle recessed athletic training zone ring on floor (offset +0.02 Y to avoid Z-fighting)
  const zoneRingGeo = track(new THREE.RingGeometry(2.6, 2.66, 64));
  const zoneRingMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x0ea5e9,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    }),
  );
  const zoneRing = new THREE.Mesh(zoneRingGeo, zoneRingMat);
  zoneRing.rotation.x = -Math.PI / 2;
  zoneRing.position.set(0, 0.02, 0.4);
  scene.add(zoneRing);

  // Soft radial contact shadow beneath the rig stand
  const contactGeo = track(new THREE.PlaneGeometry(5.6, 3.2));
  const contactMat = track(
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.55,
      depthWrite: false,
    }),
  );
  const contactPlane = new THREE.Mesh(contactGeo, contactMat);
  contactPlane.rotation.x = -Math.PI / 2;
  contactPlane.position.set(0, 0.015, -0.1);
  scene.add(contactPlane);

  // --- Root Rig Group (Bottom-center grounded at y = 0) ---
  const rootGroup = new THREE.Group();
  rootGroup.position.set(0, 0, 0);
  scene.add(rootGroup);

  // Materials with explicit roughness/metalness contrast (>= 0.25 variance between adjacent parts)
  const brushedSteelMat = track(
    new THREE.MeshStandardMaterial({
      map: metalTex,
      color: 0x9aa8bd,
      metalness: 0.88,
      roughness: 0.28,
    }),
  );
  const darkAnodizedMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x19202d,
      metalness: 0.72,
      roughness: 0.42,
    }),
  );
  const rubberMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0c0f15,
      metalness: 0.04,
      roughness: 0.88,
    }),
  );
  const boardFaceMat = track(
    new THREE.MeshStandardMaterial({
      map: boardTex,
      metalness: 0.18,
      roughness: 0.68,
    }),
  );
  const accentCyanTrimMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x0ea5e9,
      emissive: 0x0284c7,
      emissiveIntensity: 0.5,
      metalness: 0.3,
      roughness: 0.35,
    }),
  );

  // 1. Structural H-Base Stand & Rubber Leveling Feet (grounded flush at y = 0)
  const baseGroup = new THREE.Group();
  rootGroup.add(baseGroup);

  const footGeo = track(new THREE.CylinderGeometry(0.11, 0.13, 0.04, 16));
  const footOffsets = [
    [-1.45, 0.02, 0.68],
    [1.45, 0.02, 0.68],
    [-1.45, 0.02, -0.92],
    [1.45, 0.02, -0.92],
  ];
  footOffsets.forEach(([x, y, z]) => {
    const pad = new THREE.Mesh(footGeo, rubberMat);
    pad.position.set(x, y, z);
    pad.castShadow = enableShadows;
    pad.receiveShadow = enableShadows;
    baseGroup.add(pad);
  });

  const runnerGeo = track(createBeveledPanelGeometry(0.16, 0.09, 1.75, 0.03));
  [-1.45, 1.45].forEach((x) => {
    const runner = new THREE.Mesh(runnerGeo, darkAnodizedMat);
    runner.position.set(x, 0.085, -0.12);
    runner.castShadow = enableShadows;
    runner.receiveShadow = enableShadows;
    baseGroup.add(runner);
  });

  const crossbarGeo = track(createBeveledPanelGeometry(2.96, 0.08, 0.16, 0.02));
  const frontCrossbar = new THREE.Mesh(crossbarGeo, brushedSteelMat);
  frontCrossbar.position.set(0, 0.085, -0.34);
  frontCrossbar.castShadow = enableShadows;
  frontCrossbar.receiveShadow = enableShadows;
  baseGroup.add(frontCrossbar);

  // Vertical Twin Columns & Angled Rear Brace Struts
  const colGeo = track(new THREE.CylinderGeometry(0.065, 0.075, 3.55, 20));
  const braceGeo = track(new THREE.CylinderGeometry(0.038, 0.038, 1.55, 16));
  const collarRingGeo = track(new THREE.CylinderGeometry(0.1, 0.11, 0.12, 20));

  [-1.45, 1.45].forEach((x) => {
    const col = new THREE.Mesh(colGeo, brushedSteelMat);
    col.position.set(x, 1.84, -0.34);
    col.castShadow = enableShadows;
    col.receiveShadow = enableShadows;
    baseGroup.add(col);

    const flange = new THREE.Mesh(collarRingGeo, darkAnodizedMat);
    flange.position.set(x, 0.15, -0.34);
    baseGroup.add(flange);

    const brace = new THREE.Mesh(braceGeo, darkAnodizedMat);
    brace.position.set(x, 0.72, -0.64);
    brace.rotation.x = 0.42;
    brace.castShadow = enableShadows;
    baseGroup.add(brace);
  });

  // Rear Controller Housing Box with heatsink ribs
  const ctrlBoxGeo = track(createBeveledPanelGeometry(1.15, 0.62, 0.24, 0.04));
  const ctrlBox = new THREE.Mesh(ctrlBoxGeo, darkAnodizedMat);
  ctrlBox.position.set(0, 1.78, -0.32);
  ctrlBox.castShadow = enableShadows;
  baseGroup.add(ctrlBox);

  // 2. Main Target Board Chassis (Center flat bay + Left/Right angled ergonomic wings)
  const boardAssembly = new THREE.Group();
  boardAssembly.position.set(0, 2.02, -0.08);
  rootGroup.add(boardAssembly);

  // Center Bay (holds columns 1 & 2, 6 pods)
  const centerFrameGeo = track(createBeveledPanelGeometry(2.26, 2.52, 0.16, 0.08));
  const centerFrame = new THREE.Mesh(centerFrameGeo, darkAnodizedMat);
  centerFrame.castShadow = enableShadows;
  centerFrame.receiveShadow = enableShadows;
  boardAssembly.add(centerFrame);

  const centerFaceGeo = track(new THREE.BoxGeometry(2.1, 2.36, 0.04));
  const centerFace = new THREE.Mesh(centerFaceGeo, boardFaceMat);
  centerFace.position.z = 0.085;
  centerFace.receiveShadow = enableShadows;
  boardAssembly.add(centerFace);

  // Ergonomic Wing Bays (left & right angled 10 degrees inward toward player!)
  const wingAngle = 0.175; // ~10 degrees
  const wingFrameGeo = track(createBeveledPanelGeometry(1.18, 2.52, 0.16, 0.08));
  const wingFaceGeo = track(new THREE.BoxGeometry(1.04, 2.36, 0.04));
  const wingTrimGeo = track(new THREE.BoxGeometry(0.035, 2.28, 0.03));

  const leftWingGroup = new THREE.Group();
  leftWingGroup.position.set(-1.69, 0, 0.105);
  leftWingGroup.rotation.y = wingAngle;
  boardAssembly.add(leftWingGroup);

  const rightWingGroup = new THREE.Group();
  rightWingGroup.position.set(1.69, 0, 0.105);
  rightWingGroup.rotation.y = -wingAngle;
  boardAssembly.add(rightWingGroup);

  [
    { grp: leftWingGroup, side: -1 },
    { grp: rightWingGroup, side: 1 },
  ].forEach(({ grp, side }) => {
    const wf = new THREE.Mesh(wingFrameGeo, darkAnodizedMat);
    wf.castShadow = enableShadows;
    wf.receiveShadow = enableShadows;
    grp.add(wf);

    const wFace = new THREE.Mesh(wingFaceGeo, boardFaceMat);
    wFace.position.z = 0.085;
    wFace.receiveShadow = enableShadows;
    grp.add(wFace);

    const edgeTrim = new THREE.Mesh(wingTrimGeo, accentCyanTrimMat);
    edgeTrim.position.set(side * 0.55, 0, 0.095);
    grp.add(edgeTrim);
  });

  // Top & Bottom Horizontal Brushed Rail Bars
  const railGeo = track(createBeveledPanelGeometry(2.3, 0.08, 0.19, 0.02));
  [1.26, -1.26].forEach((y) => {
    const rail = new THREE.Mesh(railGeo, brushedSteelMat);
    rail.position.set(0, y, 0.01);
    boardAssembly.add(rail);
  });

  // 3. Top Digital Telemetry Header Marquee
  const headerGroup = new THREE.Group();
  headerGroup.position.set(0, 1.56, 0.06);
  boardAssembly.add(headerGroup);

  const bracketGeo = track(new THREE.CylinderGeometry(0.03, 0.03, 0.34, 12));
  [-0.78, 0.78].forEach((bx) => {
    const br = new THREE.Mesh(bracketGeo, brushedSteelMat);
    br.position.set(bx, -0.16, -0.02);
    headerGroup.add(br);
  });

  const headerHousingGeo = track(createBeveledPanelGeometry(2.14, 0.44, 0.14, 0.04));
  const headerHousing = new THREE.Mesh(headerHousingGeo, darkAnodizedMat);
  headerHousing.castShadow = enableShadows;
  headerGroup.add(headerHousing);

  const headerScreenGeo = track(new THREE.PlaneGeometry(1.98, 0.34));
  const headerScreenMat = track(
    new THREE.MeshBasicMaterial({
      map: headerDisplay.texture,
    }),
  );
  const headerScreen = new THREE.Mesh(headerScreenGeo, headerScreenMat);
  headerScreen.position.z = 0.096;
  headerGroup.add(headerScreen);

  // 4. Shared Pod Geometries (Lathe profiles for machined collar & curved polycarbonate dome)
  const collarPoints = [
    new THREE.Vector2(0.245, 0.0),
    new THREE.Vector2(0.325, 0.0),
    new THREE.Vector2(0.325, 0.032),
    new THREE.Vector2(0.295, 0.052),
    new THREE.Vector2(0.255, 0.052),
    new THREE.Vector2(0.245, 0.012),
  ];
  const collarGeo = track(new THREE.LatheGeometry(collarPoints, 32));
  collarGeo.rotateX(Math.PI / 2);

  const gasketGeo = track(new THREE.TorusGeometry(0.242, 0.018, 12, 32));

  // Smooth domed cap profile
  const domePoints: THREE.Vector2[] = [];
  const domeSteps = 10;
  for (let i = 0; i <= domeSteps; i++) {
    const t = i / domeSteps;
    const r = t * 0.228;
    const h = Math.cos(t * Math.PI * 0.48) * 0.068 + 0.025;
    domePoints.push(new THREE.Vector2(r, h));
  }
  domePoints.push(new THREE.Vector2(0.228, 0.0));
  const domeGeo = track(new THREE.LatheGeometry(domePoints, 32));
  domeGeo.rotateX(Math.PI / 2);

  const coreGeo = track(new THREE.CylinderGeometry(0.205, 0.205, 0.02, 28));
  coreGeo.rotateX(Math.PI / 2);

  const haloGeo = track(new THREE.RingGeometry(0.335, 0.382, 48));
  const glyphGeo = track(new THREE.PlaneGeometry(0.26, 0.26));
  const hitGeo = track(new THREE.CylinderGeometry(0.385, 0.385, 0.18, 18));
  hitGeo.rotateX(Math.PI / 2);

  // 5. Build 12 Tactile Light Pods (4 Columns × 3 Rows)
  const pods: PodVisual[] = [];
  const hitMeshes: THREE.Mesh[] = [];
  const boltPositions: THREE.Matrix4[] = [];
  const dummy = new THREE.Object3D();

  // Row & Column layout
  const rowYs = [0.76, 0.0, -0.76];
  const colConfigs = [
    { col: 0, parent: leftWingGroup, localX: 0.0, zBase: 0.11 },
    { col: 1, parent: boardAssembly, localX: -0.54, zBase: 0.11 },
    { col: 2, parent: boardAssembly, localX: 0.54, zBase: 0.11 },
    { col: 3, parent: rightWingGroup, localX: 0.0, zBase: 0.11 },
  ];

  let podIdx = 0;
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 4; col++) {
      const cfg = colConfigs[col];
      const podRoot = new THREE.Group();
      // Slight athletic stagger on middle columns for organic hand-eye reachability
      const yOffset = col === 0 || col === 3 ? rowYs[row] * 0.94 : rowYs[row];
      podRoot.position.set(cfg.localX, yOffset, cfg.zBase);
      cfg.parent.add(podRoot);

      // Part 1: Machined Collar
      const collar = new THREE.Mesh(collarGeo, brushedSteelMat);
      collar.castShadow = enableShadows;
      collar.receiveShadow = enableShadows;
      podRoot.add(collar);

      // Part 2: Rubber Shock Gasket
      const gasket = new THREE.Mesh(gasketGeo, rubberMat);
      gasket.position.z = 0.036;
      podRoot.add(gasket);

      // Part 3: Spring-loaded Button Dome Group
      const buttonGroup = new THREE.Group();
      buttonGroup.position.z = 0.015;
      podRoot.add(buttonGroup);

      const coreMat = track(
        new THREE.MeshStandardMaterial({
          color: 0x1e293b,
          emissive: 0x000000,
          emissiveIntensity: 0.0,
          roughness: 0.4,
          metalness: 0.1,
        }),
      );
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.z = 0.014;
      buttonGroup.add(coreMesh);

      const domeMat = track(
        new THREE.MeshPhysicalMaterial({
          color: 0x334155,
          emissive: 0x000000,
          emissiveIntensity: 0.0,
          roughness: 0.2,
          metalness: 0.06,
          clearcoat: 1.0,
          clearcoatRoughness: 0.12,
          transparent: true,
          opacity: 0.88,
        }),
      );
      const domeMesh = new THREE.Mesh(domeGeo, domeMat);
      domeMesh.castShadow = enableShadows;
      buttonGroup.add(domeMesh);

      // Overlay Glyph Plane
      const glyphMat = track(
        new THREE.MeshBasicMaterial({
          map: getGlyphTex('empty', '', '#00f0ff'),
          transparent: true,
          opacity: 0.0,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -2,
          polygonOffsetUnits: -2,
        }),
      );
      const glyphMesh = new THREE.Mesh(glyphGeo, glyphMat);
      glyphMesh.position.z = 0.098;
      glyphMesh.visible = false;
      buttonGroup.add(glyphMesh);

      // Part 4: Segmented LED Countdown Halo Ring
      const haloMat = track(
        new THREE.ShaderMaterial({
          vertexShader: HALO_VERTEX_SHADER,
          fragmentShader: HALO_FRAGMENT_SHADER,
          transparent: true,
          depthWrite: false,
          polygonOffset: true,
          polygonOffsetFactor: -1,
          polygonOffsetUnits: -1,
          uniforms: {
            uProgress: { value: 1.0 },
            uIntensity: { value: 0.0 },
            uColor: { value: new THREE.Color(0x00f0ff) },
            uSegments: { value: 24.0 },
          },
        }),
      );
      const haloMesh = new THREE.Mesh(haloGeo, haloMat);
      haloMesh.position.z = 0.008;
      podRoot.add(haloMesh);

      // Part 5: Enlarged Invisible Raycast Hit Cylinder (Layer 1)
      const hitMat = track(new THREE.MeshBasicMaterial({ visible: false }));
      const hitMesh = new THREE.Mesh(hitGeo, hitMat);
      hitMesh.position.z = 0.05;
      hitMesh.layers.set(1);
      hitMesh.userData.podIndex = podIdx;
      podRoot.add(hitMesh);
      hitMeshes.push(hitMesh);

      // Record 4 perimeter mounting bolt transforms around each pod collar (48 total -> InstancedMesh!)
      podRoot.updateMatrixWorld(true);
      for (let b = 0; b < 4; b++) {
        const ang = (b * Math.PI) / 2 + Math.PI / 4;
        const bx = Math.cos(ang) * 0.29;
        const by = Math.sin(ang) * 0.29;
        dummy.position.set(bx, by, 0.044);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.scale.setScalar(1);
        dummy.updateMatrix();
        const worldMat = new THREE.Matrix4().multiplyMatrices(podRoot.matrixWorld, dummy.matrix);
        boltPositions.push(worldMat);
      }

      // Cache pod world center & normal for spark bursts and sequence guide line
      const worldCenter = new THREE.Vector3(0, 0, 0.09);
      podRoot.localToWorld(worldCenter);
      const worldNormal = new THREE.Vector3(0, 0, 1);
      worldNormal.transformDirection(podRoot.matrixWorld).normalize();

      pods.push({
        index: podIdx,
        row,
        col,
        root: podRoot,
        buttonGroup,
        domeMaterial: domeMat,
        coreMaterial: coreMat,
        haloMaterial: haloMat,
        glyphMesh,
        glyphMaterial: glyphMat,
        hitMesh,
        worldCenter,
        worldNormal,
        pressOffset: 0,
        pressVelocity: 0,
        flashIntensity: 0,
      });

      podIdx++;
    }
  }

  // InstancedMesh for all 48 machined hex bolts
  const boltGeo = track(new THREE.CylinderGeometry(0.016, 0.016, 0.016, 6));
  const boltMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xd1dae8,
      metalness: 0.92,
      roughness: 0.22,
    }),
  );
  const boltInstances = new THREE.InstancedMesh(boltGeo, boltMat, boltPositions.length);
  boltPositions.forEach((mat, i) => boltInstances.setMatrixAt(i, mat));
  boltInstances.instanceMatrix.needsUpdate = true;
  boltInstances.computeBoundingSphere();
  scene.add(boltInstances);

  // Sequence Laser Guide Line (connects sequence pods in 3D space)
  const sequenceLineGeometry = track(new THREE.BufferGeometry());
  const initialPts = new Float32Array(12 * 3);
  sequenceLineGeometry.setAttribute('position', new THREE.BufferAttribute(initialPts, 3));
  sequenceLineGeometry.setDrawRange(0, 0);

  const sequenceLineMaterial = track(
    new THREE.LineBasicMaterial({
      color: 0xc084fc,
      transparent: true,
      opacity: 0.85,
    }),
  );
  const sequenceLine = new THREE.Line(sequenceLineGeometry, sequenceLineMaterial);
  sequenceLine.frustumCulled = false;
  scene.add(sequenceLine);

  return {
    rootGroup,
    pods,
    hitMeshes,
    headerDisplay,
    glyphTextures,
    sequenceLine,
    sequenceLineGeometry,
    sequenceLineMaterial,
    dispose: () => {
      disposables.forEach((d) => d.dispose());
    },
  };
}
