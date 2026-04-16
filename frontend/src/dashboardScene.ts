import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { AXIS_RANGE, TRAY_OPTIONS, WATER_STATION_COORDS, getTrayCoords, type AxisPosition, type LogLevel, type TrayId } from './dashboardData';

type SceneRef<T> = {
  current: T;
};

type TrayPhysicalState = 'rack' | 'fork' | 'station';

type TrayGroup = THREE.Group & {
  userData: {
    trayId: TrayId;
    trayBase: THREE.Mesh;
    physicalState: TrayPhysicalState;
  };
};

type MountSceneOptions = {
  mount: HTMLDivElement;
  axisRef: SceneRef<AxisPosition>;
  cylinderRef: SceneRef<boolean>;
  cameraOnlineRef: SceneRef<boolean>;
  activeTrayRef: SceneRef<TrayId>;
  onActiveTrayChange: (trayId: TrayId) => void;
  onLog: (module: string, message: string, type?: LogLevel) => void;
};

const SCENE_AXIS_SCALE = 0.3;

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
};

export const mountDashboardScene = ({
  mount,
  axisRef,
  cylinderRef,
  cameraOnlineRef,
  activeTrayRef,
  onActiveTrayChange,
  onLog,
}: MountSceneOptions) => {
  let frameId = 0;
  let highlightedTrayId: TrayId | null = null;
  let carriedTray: TrayGroup | null = null;

  const allTrays = new Map<TrayId, TrayGroup>();

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0b1120, 90, 180);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth || 800, mount.clientHeight || 600);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  mount.appendChild(renderer.domElement);

  const camera = new THREE.PerspectiveCamera(45, (mount.clientWidth || 800) / (mount.clientHeight || 600), 0.1, 1000);
  camera.position.set(40, 40, 60);
  camera.lookAt(0, 10, 0);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 10, 0);
  controls.minDistance = 18;
  controls.maxDistance = 120;
  controls.minPolarAngle = Math.PI * 0.16;
  controls.maxPolarAngle = Math.PI * 0.48;

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));

  const keyLight = new THREE.DirectionalLight(0xffffff, 0.9);
  keyLight.position.set(20, 40, 20);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4);
  fillLight.position.set(-20, 12, -18);
  scene.add(fillLight);

  scene.add(new THREE.GridHelper(120, 60, 0x3b82f6, 0x1e293b));

  const aluminumMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.6, roughness: 0.3 });
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 });
  const trayHighlightMat = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    roughness: 0.3,
    emissive: 0x1d4ed8,
    emissiveIntensity: 0.4,
  });
  const leafMat = new THREE.MeshStandardMaterial({ color: 0x22c55e, roughness: 0.8 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.48 });
  const frameMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.3, roughness: 0.35 });
  const forkMat = new THREE.MeshStandardMaterial({ color: 0xeab308, roughness: 0.28, metalness: 0.18 });

  const rackGroup = new THREE.Group();
  rackGroup.position.set(0, 0, -12);
  scene.add(rackGroup);

  ([
    [-20, 17.5, -7.5],
    [20, 17.5, -7.5],
    [-20, 17.5, 7.5],
    [20, 17.5, 7.5],
  ] as const).forEach((position) => {
    const pillar = new THREE.Mesh(new THREE.BoxGeometry(1, 35, 1), aluminumMat);
    pillar.position.set(position[0], position[1], position[2]);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    rackGroup.add(pillar);
  });

  const layerHeights = [4.5, 16.5, 28.5];
  layerHeights.forEach((y, layerIndex) => {
    const frontBeam = new THREE.Mesh(new THREE.BoxGeometry(41, 1, 1), aluminumMat);
    frontBeam.position.set(0, y - 0.5, 7.5);
    rackGroup.add(frontBeam);

    const backBeam = new THREE.Mesh(new THREE.BoxGeometry(41, 1, 1), aluminumMat);
    backBeam.position.set(0, y - 0.5, -7.5);
    rackGroup.add(backBeam);

    [[-19.5, -10.5], [-4.5, 4.5], [10.5, 19.5]].forEach(([leftX, rightX]) => {
      const leftSlide = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 14), aluminumMat);
      leftSlide.position.set(leftX, y - 0.25, 0);
      rackGroup.add(leftSlide);

      const rightSlide = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 14), aluminumMat);
      rightSlide.position.set(rightX, y - 0.25, 0);
      rackGroup.add(rightSlide);
    });

    TRAY_OPTIONS.filter((tray) => tray.row === layerIndex + 1).forEach((trayOption) => {
      const trayId = trayOption.id;
      const trayCoords = getTrayCoords(trayId);
      const trayGroup = new THREE.Group() as TrayGroup;
      trayGroup.position.set(trayCoords.rack3DX, trayCoords.rack3DY, 0);

      const trayBase = new THREE.Mesh(new THREE.BoxGeometry(10, 0.5, 13), trayMat);
      trayBase.position.set(0, 0.75, 0);
      trayBase.castShadow = true;
      trayBase.receiveShadow = true;
      trayGroup.add(trayBase);

      const runnerLeft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 13), trayMat);
      runnerLeft.position.set(-4.5, 0.25, 0);
      trayGroup.add(runnerLeft);

      const runnerRight = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 13), trayMat);
      runnerRight.position.set(4.5, 0.25, 0);
      trayGroup.add(runnerRight);

      for (let px = -2; px <= 2; px += 4) {
        for (let pz = -4; pz <= 4; pz += 4) {
          const plant = new THREE.Mesh(new THREE.DodecahedronGeometry(1.2), leafMat);
          plant.position.set(px, 1.5, pz);
          plant.castShadow = true;
          trayGroup.add(plant);
        }
      }

      trayGroup.userData = {
        trayId,
        trayBase,
        physicalState: 'rack',
      };

      allTrays.set(trayId, trayGroup);
      rackGroup.add(trayGroup);
    });
  });

  const waterStationGroup = new THREE.Group();
  waterStationGroup.position.set(-30, 0, -12);
  scene.add(waterStationGroup);

  ([
    [-5, 3, -6],
    [5, 3, -6],
    [-5, 3, 6],
    [5, 3, 6],
  ] as const).forEach((position) => {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(1, 6, 1), darkMat);
    leg.position.set(position[0], position[1], position[2]);
    waterStationGroup.add(leg);
  });

  const stationLeft = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 14), aluminumMat);
  stationLeft.position.set(-4.5, 4.5, 0);
  waterStationGroup.add(stationLeft);

  const stationRight = new THREE.Mesh(new THREE.BoxGeometry(1, 0.5, 14), aluminumMat);
  stationRight.position.set(4.5, 4.5, 0);
  waterStationGroup.add(stationRight);

  const sprinkler = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 0.5, 16), new THREE.MeshStandardMaterial({ color: 0x3b82f6 }));
  sprinkler.position.set(0, 15, 0);
  waterStationGroup.add(sprinkler);

  const proxyRobot = new THREE.Group();
  proxyRobot.position.set(0, 0, 5);
  scene.add(proxyRobot);

  const track = new THREE.Mesh(new THREE.BoxGeometry(70, 1, 6), darkMat);
  track.position.set(-5, 0.5, 0);
  proxyRobot.add(track);

  const axisXPart = new THREE.Group();
  axisXPart.position.set(0, 1, 0);
  proxyRobot.add(axisXPart);

  const xBaseMesh = new THREE.Mesh(new THREE.BoxGeometry(17.5, 1.5, 17.5), frameMat);
  xBaseMesh.position.set(0, 0.75, 0);
  axisXPart.add(xBaseMesh);

  const pillarGeometry = new THREE.BoxGeometry(1.5, 36, 1.5);
  [-8, 8].forEach((x) => {
    [-8, 8].forEach((z) => {
      const pillar = new THREE.Mesh(pillarGeometry, frameMat);
      pillar.position.set(x, 18, z);
      axisXPart.add(pillar);
    });
  });

  [
    { geometry: new THREE.BoxGeometry(17.5, 1.5, 1.5), position: [0, 36.75, -8] as const },
    { geometry: new THREE.BoxGeometry(17.5, 1.5, 1.5), position: [0, 36.75, 8] as const },
    { geometry: new THREE.BoxGeometry(1.5, 1.5, 17.5), position: [-8, 36.75, 0] as const },
    { geometry: new THREE.BoxGeometry(1.5, 1.5, 17.5), position: [8, 36.75, 0] as const },
  ].forEach(({ geometry, position }) => {
    const beam = new THREE.Mesh(geometry, frameMat);
    beam.position.set(position[0], position[1], position[2]);
    axisXPart.add(beam);
  });

  const axisYPart = new THREE.Group();
  axisYPart.position.set(0, AXIS_RANGE.y.min * SCENE_AXIS_SCALE, 0);
  axisXPart.add(axisYPart);

  const liftFrame = new THREE.Mesh(new THREE.BoxGeometry(14, 1.5, 14), new THREE.MeshStandardMaterial({ color: 0x22c55e }));
  liftFrame.position.set(0, -1, 0);
  axisYPart.add(liftFrame);

  const cylBase = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 8), darkMat);
  cylBase.position.set(0, -0.2, 0);
  axisYPart.add(cylBase);

  const cylinderPart = new THREE.Mesh(new THREE.BoxGeometry(8, 0.4, 14), forkMat);
  cylinderPart.position.set(0, 0.5, 0);
  cylinderPart.castShadow = true;
  cylinderPart.receiveShadow = true;
  axisYPart.add(cylinderPart);

  const cameraGroup = new THREE.Group();
  const cameraBody = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.2, 2.5), darkMat);
  const cameraLens = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.8, 16), new THREE.MeshStandardMaterial({ color: 0x0f172a }));
  cameraLens.rotation.x = Math.PI / 2;
  cameraLens.position.z = 1.25;
  const cameraIndicatorLight = new THREE.Mesh(
    new THREE.SphereGeometry(0.15, 8, 8),
    new THREE.MeshBasicMaterial({ color: 0xef4444 }),
  );
  cameraIndicatorLight.position.set(0.5, 0.6, 1);
  cameraGroup.add(cameraBody, cameraLens, cameraIndicatorLight);
  cameraGroup.position.set(20, 30, 20);
  cameraGroup.lookAt(-10, 5, -5);
  scene.add(cameraGroup);

  const updateActiveTrayHighlight = (nextTrayId: TrayId) => {
    if (highlightedTrayId === nextTrayId) {
      return;
    }

    if (highlightedTrayId) {
      const previousTray = allTrays.get(highlightedTrayId);
      if (previousTray) {
        previousTray.userData.trayBase.material = trayMat;
      }
    }

    const nextTray = allTrays.get(nextTrayId);
    if (nextTray) {
      nextTray.userData.trayBase.material = trayHighlightMat;
    }

    highlightedTrayId = nextTrayId;
  };

  const syncCameraIndicator = () => {
    (cameraIndicatorLight.material as THREE.MeshBasicMaterial).color.setHex(cameraOnlineRef.current ? 0x22c55e : 0xef4444);
  };

  const carryTrayFromRack = (tray: TrayGroup, trayId: TrayId) => {
    cylinderPart.attach(tray);
    tray.position.set(0, -0.4, 0);
    tray.rotation.set(0, 0, 0);
    tray.userData.physicalState = 'fork';
    carriedTray = tray;
    onActiveTrayChange(trayId);
    onLog('物理', `[${trayId}] 苗盘已被平稳托起。`, 'success');
  };

  const returnTrayToRack = (tray: TrayGroup, trayId: TrayId) => {
    const coords = getTrayCoords(trayId);
    rackGroup.attach(tray);
    tray.position.set(coords.rack3DX, coords.rack3DY, 0);
    tray.rotation.set(0, 0, 0);
    tray.userData.physicalState = 'rack';
    carriedTray = null;
    onLog('物理', `[${trayId}] 苗盘安全放入槽内。`, 'success');
  };

  const placeTrayOnStation = (tray: TrayGroup) => {
    waterStationGroup.attach(tray);
    tray.position.set(0, 4.5, 0);
    tray.rotation.set(0, 0, 0);
    tray.userData.physicalState = 'station';
    carriedTray = null;
    onLog('物理', '苗盘平稳放置于加水台。', 'success');
  };

  const pickTrayFromStation = (tray: TrayGroup) => {
    cylinderPart.attach(tray);
    tray.position.set(0, -0.4, 0);
    tray.rotation.set(0, 0, 0);
    tray.userData.physicalState = 'fork';
    carriedTray = tray;
    onLog('物理', '从加水台重新接管苗盘。', 'success');
  };

  const updatePhysicsInteraction = () => {
    if (!cylinderRef.current) {
      return;
    }

    const vx = axisRef.current.x;
    const vy = axisRef.current.y;

    for (const [trayId, tray] of allTrays) {
      const coords = getTrayCoords(trayId);

      if (Math.abs(vx - coords.x) <= 2) {
        if (vy > coords.yBase + 1 && vy < coords.yBase + 10 && tray.userData.physicalState === 'rack' && !carriedTray) {
          carryTrayFromRack(tray, trayId);
          continue;
        }

        if (vy <= coords.yBase + 1 && tray.userData.physicalState === 'fork' && carriedTray === tray) {
          returnTrayToRack(tray, trayId);
          continue;
        }
      }

      if (Math.abs(vx - WATER_STATION_COORDS.x) <= 2) {
        if (vy <= WATER_STATION_COORDS.yBase + 1 && tray.userData.physicalState === 'fork' && carriedTray === tray) {
          placeTrayOnStation(tray);
          continue;
        }

        if (
          vy > WATER_STATION_COORDS.yBase + 1 &&
          vy < WATER_STATION_COORDS.yBase + 10 &&
          tray.userData.physicalState === 'station' &&
          !carriedTray
        ) {
          pickTrayFromStation(tray);
        }
      }
    }
  };

  updateActiveTrayHighlight(activeTrayRef.current);
  syncCameraIndicator();

  const resize = () => {
    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 600;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const animate = () => {
    frameId = window.requestAnimationFrame(animate);

    axisXPart.position.x = THREE.MathUtils.lerp(axisXPart.position.x, axisRef.current.x * SCENE_AXIS_SCALE, 0.12);
    axisYPart.position.y = THREE.MathUtils.lerp(axisYPart.position.y, axisRef.current.y * SCENE_AXIS_SCALE, 0.12);
    cylinderPart.position.z = THREE.MathUtils.lerp(cylinderPart.position.z, cylinderRef.current ? -14 : 0, 0.18);

    updateActiveTrayHighlight(activeTrayRef.current);
    syncCameraIndicator();

    if (cylinderRef.current || carriedTray) {
      updatePhysicsInteraction();
    }

    controls.update();
    renderer.render(scene, camera);
  };

  animate();
  window.addEventListener('resize', resize);

  return () => {
    window.cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    controls.dispose();
    scene.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        disposeMaterial(child.material);
      }
    });
    renderer.dispose();
    if (mount.contains(renderer.domElement)) {
      mount.removeChild(renderer.domElement);
    }
  };
};
