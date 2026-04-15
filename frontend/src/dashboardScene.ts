import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { AXIS_RANGE, MODEL_FALLBACK_PALETTE, MODEL_URL, mapRange, type AxisPosition } from './dashboardData';

export type MotionRig = {
  root: THREE.Group;
  xCarriage: THREE.Group;
  yCarriage: THREE.Group;
  zCarriage: THREE.Group;
  cylinderRod: THREE.Mesh;
  pulseRing: THREE.Mesh;
  xRange: [number, number];
  yRange: [number, number];
  zRange: [number, number];
  cylinderRange: [number, number];
};

type ModelState = 'loading' | 'ready' | 'error';

type MountSceneOptions = {
  mount: HTMLDivElement;
  axisRef: { current: AxisPosition };
  cylinderRef: { current: boolean };
  onModelState: (state: ModelState) => void;
};

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
};

const needsDisplayColor = (object: THREE.Object3D) => {
  let materialCount = 0;
  let grayscaleCount = 0;
  const uniqueColors = new Set<string>();

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      const candidate = material as THREE.Material & { color?: THREE.Color };
      if (!candidate.color) {
        return;
      }

      materialCount += 1;
      uniqueColors.add(candidate.color.getHexString());
      const maxChannel = Math.max(candidate.color.r, candidate.color.g, candidate.color.b);
      const minChannel = Math.min(candidate.color.r, candidate.color.g, candidate.color.b);
      if (maxChannel - minChannel < 0.08) {
        grayscaleCount += 1;
      }
    });
  });

  return materialCount > 0 && uniqueColors.size <= 3 && grayscaleCount / materialCount > 0.7;
};

const colorizeMaterial = (material: THREE.Material, colorHex: number) => {
  const color = new THREE.Color(colorHex);
  const cloned = material.clone() as THREE.Material & {
    color?: THREE.Color;
    emissive?: THREE.Color;
    metalness?: number;
    roughness?: number;
    emissiveIntensity?: number;
  };

  if (cloned.color) {
    cloned.color.lerp(color, 0.78);
  }

  if (cloned.emissive) {
    cloned.emissive.copy(color).multiplyScalar(0.04);
    cloned.emissiveIntensity = 0.7;
  }

  if (typeof cloned.metalness === 'number') {
    cloned.metalness = Math.min(cloned.metalness, 0.12);
  }

  if (typeof cloned.roughness === 'number') {
    cloned.roughness = Math.max(cloned.roughness, 0.58);
  }

  return cloned;
};

const applyDisplayPalette = (object: THREE.Object3D) => {
  let index = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const color = MODEL_FALLBACK_PALETTE[index % MODEL_FALLBACK_PALETTE.length];
    child.material = Array.isArray(child.material)
      ? child.material.map((material) => colorizeMaterial(material, color))
      : colorizeMaterial(child.material, color);
    index += 1;
  });
};

const normalizeModel = (object: THREE.Object3D, targetMaxSize: number) => {
  const bounds = new THREE.Box3().setFromObject(object);
  const size = bounds.getSize(new THREE.Vector3());
  const maxDimension = Math.max(size.x, size.y, size.z, 1);
  const scale = targetMaxSize / maxDimension;

  object.scale.setScalar(scale);
  object.position.set(
    -((bounds.min.x + bounds.max.x) * scale) / 2,
    -(bounds.min.y * scale),
    -((bounds.min.z + bounds.max.z) * scale) / 2,
  );

  return new THREE.Box3().setFromObject(object);
};

const fitCamera = (camera: THREE.PerspectiveCamera, controls: OrbitControls, object: THREE.Object3D, aspect: number) => {
  const bounds = new THREE.Box3().setFromObject(object);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 1);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (radius / Math.sin(fov / 2)) * 1.12;

  camera.aspect = aspect;
  camera.near = Math.max(0.1, distance / 80);
  camera.far = distance * 16;
  camera.position.set(sphere.center.x + distance * 0.9, sphere.center.y + radius * 0.65, sphere.center.z + distance * 0.95);
  controls.target.copy(sphere.center);
  controls.update();
  camera.updateProjectionMatrix();
};

const buildMotionRig = (bounds: THREE.Box3): MotionRig => {
  const size = bounds.getSize(new THREE.Vector3());
  const trackSpan = Math.max(size.x * 0.88, 7.2);
  const verticalDrop = Math.max(size.y * 0.78, 6.2);
  const depthTravel = Math.max(size.z * 0.46, 4.6);

  const root = new THREE.Group();
  root.position.set(0, bounds.max.y + size.y * 0.12, 0);

  const shellMaterial = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.18, roughness: 0.34 });
  const highlightMaterial = new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x38bdf8, emissiveIntensity: 0.36, metalness: 0.15, roughness: 0.26 });
  const liftMaterial = new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.28, metalness: 0.12, roughness: 0.3 });
  const depthMaterial = new THREE.MeshStandardMaterial({ color: 0xf59e0b, emissive: 0xf59e0b, emissiveIntensity: 0.22, metalness: 0.14, roughness: 0.3 });
  const cylinderMaterial = new THREE.MeshStandardMaterial({ color: 0xeab308, emissive: 0xeab308, emissiveIntensity: 0.3, metalness: 0.12, roughness: 0.25 });

  root.add(new THREE.Mesh(new THREE.BoxGeometry(trackSpan, 0.22, 0.36), shellMaterial));

  const leftSupport = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.8, 0.24), shellMaterial);
  leftSupport.position.set(-trackSpan * 0.48, -0.42, 0);
  root.add(leftSupport);
  const rightSupport = leftSupport.clone();
  rightSupport.position.x = trackSpan * 0.48;
  root.add(rightSupport);

  const xCarriage = new THREE.Group();
  xCarriage.add(new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 0.55), highlightMaterial));
  const mast = new THREE.Mesh(new THREE.BoxGeometry(0.18, verticalDrop, 0.18), shellMaterial);
  mast.position.set(0, -verticalDrop * 0.5, 0);
  xCarriage.add(mast);
  root.add(xCarriage);

  const yCarriage = new THREE.Group();
  yCarriage.position.set(0, -verticalDrop * 0.18, 0);
  yCarriage.add(new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.52, 0.62), liftMaterial));
  const depthBeam = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.18, depthTravel), depthMaterial);
  depthBeam.position.set(0, 0, depthTravel * 0.5);
  yCarriage.add(depthBeam);
  xCarriage.add(yCarriage);

  const zCarriage = new THREE.Group();
  zCarriage.position.set(0, 0, depthTravel * 0.1);
  zCarriage.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.46, 0.5), depthMaterial));
  const nozzle = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.7, 16), shellMaterial);
  nozzle.position.set(0, -0.94, 0.2);
  zCarriage.add(nozzle);
  const cylinderRod = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 1.35), cylinderMaterial);
  cylinderRod.position.set(0, -0.94, 0.28);
  zCarriage.add(cylinderRod);
  const pulseRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.045, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0x67e8f9, transparent: true, opacity: 0.45 }),
  );
  pulseRing.rotation.x = Math.PI / 2;
  pulseRing.position.set(0, -1.74, 0.88);
  zCarriage.add(pulseRing);
  yCarriage.add(zCarriage);

  return {
    root,
    xCarriage,
    yCarriage,
    zCarriage,
    cylinderRod,
    pulseRing,
    xRange: [-trackSpan * 0.44, trackSpan * 0.44],
    yRange: [-verticalDrop * 0.88, -verticalDrop * 0.12],
    zRange: [-depthTravel * 0.08, depthTravel * 0.66],
    cylinderRange: [0.28, 1.2],
  };
};

export const mountDashboardScene = ({ mount, axisRef, cylinderRef, onModelState }: MountSceneOptions) => {
  onModelState('loading');

  let disposed = false;
  let frameId = 0;
  let motionRig: MotionRig | null = null;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x071321, 18, 58);

  const camera = new THREE.PerspectiveCamera(40, (mount.clientWidth || 800) / (mount.clientHeight || 600), 0.1, 1000);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(mount.clientWidth || 800, mount.clientHeight || 600);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.08;
  renderer.domElement.style.touchAction = 'none';
  mount.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.autoRotate = false;
  controls.minDistance = 9;
  controls.maxDistance = 42;
  controls.minPolarAngle = Math.PI * 0.16;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.screenSpacePanning = true;
  controls.target.set(0, 4, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.9));
  scene.add(new THREE.HemisphereLight(0x93c5fd, 0x020617, 1.15));

  const keyLight = new THREE.DirectionalLight(0xffffff, 1.45);
  keyLight.position.set(14, 18, 12);
  keyLight.castShadow = true;
  keyLight.shadow.mapSize.set(2048, 2048);
  keyLight.shadow.bias = -0.0002;
  scene.add(keyLight);

  const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.95);
  fillLight.position.set(-12, 9, -10);
  scene.add(fillLight);

  const stage = new THREE.Group();
  scene.add(stage);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(19, 96), new THREE.MeshStandardMaterial({ color: 0x08111d, metalness: 0.08, roughness: 0.94 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  stage.add(floor);

  const grid = new THREE.GridHelper(32, 20, 0x1d4ed8, 0x0f172a);
  grid.position.y = 0.02;
  (grid.material as THREE.Material).transparent = true;
  (grid.material as THREE.Material).opacity = 0.18;
  stage.add(grid);

  const halo = new THREE.Mesh(
    new THREE.RingGeometry(8.8, 13.2, 64),
    new THREE.MeshBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.11, side: THREE.DoubleSide }),
  );
  halo.rotation.x = -Math.PI / 2;
  halo.position.y = 0.03;
  stage.add(halo);

  const modelRoot = new THREE.Group();
  stage.add(modelRoot);

  new GLTFLoader().load(
    MODEL_URL,
    (gltf) => {
      if (disposed) {
        return;
      }

      gltf.scene.traverse((child) => {
        if (!(child instanceof THREE.Mesh)) {
          return;
        }

        child.castShadow = true;
        child.receiveShadow = true;
        const materials = Array.isArray(child.material) ? child.material : [child.material];
        materials.forEach((material) => {
          const candidate = material as THREE.Material & { map?: THREE.Texture };
          if (candidate.map) {
            candidate.map.colorSpace = THREE.SRGBColorSpace;
          }
          candidate.needsUpdate = true;
        });
      });

      if (needsDisplayColor(gltf.scene)) {
        applyDisplayPalette(gltf.scene);
      }

      const bounds = normalizeModel(gltf.scene, 18);
      modelRoot.add(gltf.scene);
      motionRig = buildMotionRig(bounds);
      stage.add(motionRig.root);
      fitCamera(camera, controls, stage, (mount.clientWidth || 800) / (mount.clientHeight || 600));
      onModelState('ready');
    },
    undefined,
    () => {
      if (disposed) {
        return;
      }

      const fallback = new THREE.Mesh(
        new THREE.BoxGeometry(14, 8, 8),
        new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.12, roughness: 0.68, wireframe: true }),
      );
      fallback.position.y = 4;
      modelRoot.add(fallback);
      motionRig = buildMotionRig(new THREE.Box3(new THREE.Vector3(-7, 0, -4), new THREE.Vector3(7, 8, 4)));
      stage.add(motionRig.root);
      fitCamera(camera, controls, stage, (mount.clientWidth || 800) / (mount.clientHeight || 600));
      onModelState('error');
    },
  );

  const resize = () => {
    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 600;
    renderer.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  };

  const animate = () => {
    frameId = window.requestAnimationFrame(animate);

    if (motionRig) {
      motionRig.xCarriage.position.x = THREE.MathUtils.lerp(motionRig.xCarriage.position.x, mapRange(axisRef.current.x, AXIS_RANGE.x.min, AXIS_RANGE.x.max, motionRig.xRange[0], motionRig.xRange[1]), 0.12);
      motionRig.yCarriage.position.y = THREE.MathUtils.lerp(motionRig.yCarriage.position.y, mapRange(axisRef.current.y, AXIS_RANGE.y.min, AXIS_RANGE.y.max, motionRig.yRange[0], motionRig.yRange[1]), 0.12);
      motionRig.zCarriage.position.z = THREE.MathUtils.lerp(motionRig.zCarriage.position.z, mapRange(axisRef.current.z, AXIS_RANGE.z.min, AXIS_RANGE.z.max, motionRig.zRange[0], motionRig.zRange[1]), 0.12);
      motionRig.cylinderRod.position.z = THREE.MathUtils.lerp(motionRig.cylinderRod.position.z, cylinderRef.current ? motionRig.cylinderRange[1] : motionRig.cylinderRange[0], 0.18);
      motionRig.pulseRing.rotation.z += 0.018;
      (motionRig.pulseRing.material as THREE.MeshBasicMaterial).opacity = 0.22 + (Math.sin(performance.now() * 0.003) + 1) * 0.14;
    }

    controls.update();
    renderer.render(scene, camera);
  };

  animate();
  window.addEventListener('resize', resize);

  return () => {
    disposed = true;
    window.cancelAnimationFrame(frameId);
    window.removeEventListener('resize', resize);
    controls.dispose();
    stage.traverse((child) => {
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
