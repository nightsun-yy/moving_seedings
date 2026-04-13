import { type ReactNode, useEffect, useRef, useState } from 'react';
import {
  Activity,
  Camera,
  Droplets,
  Power,
  RefreshCw,
  Search,
  ShieldCheck,
  Sun,
  Thermometer,
} from 'lucide-react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import directoryModelUrl from '../../docs/0413.gltf?url';

type SystemMode = 'AUTO' | 'MANUAL' | 'SCANNING';
type LogType = 'info' | 'success' | 'error';
type RackStatus = 0 | 1 | 2 | 3;
type DeviceState = 'online' | 'standby' | 'active' | 'offline';
type LinkState = 'online' | 'active' | 'alert';
type Tone = 'online' | 'active' | 'alert';
type NodeId = 'ipc' | 'plc' | 'xAxis' | 'yAxis' | 'zAxis' | 'camera';

type SysLogEntry = {
  time: string;
  msg: string;
  type: LogType;
};

type EnvDataState = {
  temp: number;
  humidity: number;
  light: number;
};

type ArmPosition = {
  x: number;
  y: number;
  z: number;
};

type RackSlot = {
  id: string;
  x: number;
  y: number;
  status: RackStatus;
};

type MotionBounds = {
  minX: number;
  maxX: number;
  minDepth: number;
  maxDepth: number;
  minHeight: number;
  maxHeight: number;
};

type TwinObjects = {
  xCarriage: THREE.Group;
  yCarriage: THREE.Group;
  zEffector: THREE.Group;
  scanCone: THREE.Object3D;
  motionBounds: MotionBounds | null;
};

type TopologyNode = {
  id: NodeId;
  label: string;
  short: string;
  role: string;
  x: number;
  y: number;
  status: DeviceState;
};

type TopologyLink = {
  id: string;
  from: NodeId;
  to: NodeId;
  label: string;
  detail: string;
  status: LinkState;
};

type EnvDataProps = {
  icon: ReactNode;
  val: string;
};

type MetricCardProps = {
  label: string;
  value: string;
  tone: Tone;
};

type StatusPillProps = {
  label: string;
  tone: Tone;
};

type TopologyNodeCardProps = {
  node: TopologyNode;
};

type LinkStatusRowProps = {
  link: TopologyLink;
};

const INITIAL_LOGS: SysLogEntry[] = [
  {
    time: new Date().toLocaleTimeString(),
    msg: '系统初始化完成，3D 引擎与 PLC 通讯链路已就绪。',
    type: 'info',
  },
];

const INITIAL_RACK_STATE: RackSlot[] = [
  { id: 'A1', x: 0, y: 2, status: 2 },
  { id: 'A2', x: 1, y: 2, status: 1 },
  { id: 'A3', x: 2, y: 2, status: 0 },
  { id: 'B1', x: 0, y: 1, status: 2 },
  { id: 'B2', x: 1, y: 1, status: 1 },
  { id: 'B3', x: 2, y: 1, status: 3 },
  { id: 'C1', x: 0, y: 0, status: 0 },
  { id: 'C2', x: 1, y: 0, status: 0 },
  { id: 'C3', x: 2, y: 0, status: 0 },
];

const DIRECTORY_MODEL_URL = directoryModelUrl;
const AXIS_LIMITS = {
  x: 2,
  y: 2,
  z: 1,
} as const;
const Z_TRAVEL_MM = 180;
const DIRECTORY_DISPLAY_PALETTE = [0x475569, 0x64748b, 0x38bdf8, 0x22c55e, 0xf59e0b, 0x0f766e];

const STATUS_PILL_STYLES: Record<Tone, string> = {
  online: 'border-cyan-500/30 bg-cyan-500/12 text-cyan-200',
  active: 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200',
  alert: 'border-amber-500/30 bg-amber-500/12 text-amber-200',
};

const METRIC_STYLES: Record<Tone, string> = {
  online: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',
  active: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
  alert: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
};

const NODE_STATUS_META: Record<
  DeviceState,
  { label: string; border: string; dot: string; text: string }
> = {
  online: {
    label: '在线',
    border: 'border-cyan-500/30 bg-cyan-500/10',
    dot: 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]',
    text: 'text-cyan-200',
  },
  standby: {
    label: '待机',
    border: 'border-slate-600/70 bg-slate-800/90',
    dot: 'bg-slate-400 shadow-[0_0_12px_rgba(148,163,184,0.45)]',
    text: 'text-slate-200',
  },
  active: {
    label: '活跃',
    border: 'border-emerald-500/35 bg-emerald-500/12',
    dot: 'bg-emerald-400 shadow-[0_0_14px_rgba(74,222,128,0.9)]',
    text: 'text-emerald-200',
  },
  offline: {
    label: '离线',
    border: 'border-red-500/30 bg-red-500/12',
    dot: 'bg-red-400 shadow-[0_0_12px_rgba(248,113,113,0.75)]',
    text: 'text-red-200',
  },
};

const LINK_STATUS_META: Record<
  LinkState,
  { label: string; badge: string; stroke: string; dot: string; dashArray?: string }
> = {
  online: {
    label: '在线',
    badge: 'border-cyan-500/25 bg-cyan-500/10 text-cyan-200',
    stroke: '#38bdf8',
    dot: 'bg-cyan-400',
  },
  active: {
    label: '活跃',
    badge: 'border-emerald-500/25 bg-emerald-500/10 text-emerald-200',
    stroke: '#22c55e',
    dot: 'bg-emerald-400',
    dashArray: '5 4',
  },
  alert: {
    label: '告警',
    badge: 'border-amber-500/25 bg-amber-500/10 text-amber-200',
    stroke: '#f59e0b',
    dot: 'bg-amber-400',
    dashArray: '6 4',
  },
};

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const mapRange = (value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) => {
  if (inputMax === inputMin) {
    return outputMin;
  }

  const ratio = (clamp(value, inputMin, inputMax) - inputMin) / (inputMax - inputMin);
  return outputMin + (outputMax - outputMin) * ratio;
};

const modelNeedsDisplayColor = (object: THREE.Object3D) => {
  const uniqueColors = new Set<string>();
  let materialCount = 0;
  let grayscaleCount = 0;

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      if (!(material instanceof THREE.MeshStandardMaterial)) {
        return;
      }

      materialCount += 1;
      uniqueColors.add(material.color.getHexString());

      const maxChannel = Math.max(material.color.r, material.color.g, material.color.b);
      const minChannel = Math.min(material.color.r, material.color.g, material.color.b);
      if (maxChannel - minChannel < 0.08) {
        grayscaleCount += 1;
      }
    });
  });

  return materialCount > 0 && uniqueColors.size <= 3 && grayscaleCount / materialCount > 0.8;
};

const colorizeMaterial = (material: THREE.Material, colorHex: number) => {
  const color = new THREE.Color(colorHex);
  const cloned = material.clone();

  if (cloned instanceof THREE.MeshStandardMaterial) {
    cloned.color.lerp(color, 0.82);
    cloned.emissive.copy(color).multiplyScalar(0.035);
    cloned.metalness = Math.min(cloned.metalness, 0.16);
    cloned.roughness = Math.max(cloned.roughness, 0.62);
    return cloned;
  }

  return new THREE.MeshStandardMaterial({
    color,
    emissive: color.clone().multiplyScalar(0.035),
    metalness: 0.1,
    roughness: 0.7,
  });
};

const applyDirectoryDisplayColors = (object: THREE.Object3D) => {
  const globalBounds = new THREE.Box3().setFromObject(object);
  const globalSize = globalBounds.getSize(new THREE.Vector3());
  const globalCenter = globalBounds.getCenter(new THREE.Vector3());
  const meshes: Array<{ mesh: THREE.Mesh; center: THREE.Vector3; size: THREE.Vector3 }> = [];

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) {
      return;
    }

    const meshBounds = new THREE.Box3().setFromObject(child);
    meshes.push({
      mesh: child,
      center: meshBounds.getCenter(new THREE.Vector3()),
      size: meshBounds.getSize(new THREE.Vector3()),
    });
  });

  meshes.sort(
    (left, right) => left.center.x - right.center.x || left.center.z - right.center.z || right.size.y - left.size.y,
  );

  meshes.forEach(({ mesh, center, size }, index) => {
    const isTall = size.y > globalSize.y * 0.42;
    const isLowerDeck = center.y < globalBounds.min.y + globalSize.y * 0.3;
    const isRightSide = center.x > globalCenter.x;
    const isFarSide = center.z > globalCenter.z;

    let colorHex = DIRECTORY_DISPLAY_PALETTE[index % DIRECTORY_DISPLAY_PALETTE.length];
    if (isTall) {
      colorHex = isFarSide ? 0x16a34a : 0x22c55e;
    } else if (isLowerDeck) {
      colorHex = isRightSide ? 0x334155 : 0x475569;
    } else if (isRightSide) {
      colorHex = 0xf59e0b;
    } else {
      colorHex = 0x38bdf8;
    }

    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((material) => colorizeMaterial(material, colorHex));
      return;
    }

    mesh.material = colorizeMaterial(mesh.material, colorHex);
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

const fitCameraToObject = (
  camera: THREE.PerspectiveCamera,
  object: THREE.Object3D,
  aspect: number,
  controls?: OrbitControls,
) => {
  const bounds = new THREE.Box3().setFromObject(object);
  const sphere = bounds.getBoundingSphere(new THREE.Sphere());
  const radius = Math.max(sphere.radius, 1);
  const fov = THREE.MathUtils.degToRad(camera.fov);
  const distance = (radius / Math.sin(fov / 2)) * 1.1;

  camera.aspect = aspect;
  camera.near = Math.max(0.1, distance / 100);
  camera.far = distance * 12;
  camera.position.set(
    sphere.center.x + distance * 0.85,
    sphere.center.y + radius * 0.55,
    sphere.center.z + distance * 0.9,
  );
  if (controls) {
    controls.target.copy(sphere.center);
    controls.update();
  } else {
    camera.lookAt(sphere.center.x, sphere.center.y, sphere.center.z);
  }
  camera.updateProjectionMatrix();
};

const App = () => {
  const [systemMode, setSystemMode] = useState<SystemMode>('AUTO');
  const [sysLog, setSysLog] = useState<SysLogEntry[]>(INITIAL_LOGS);
  const [envData, setEnvData] = useState<EnvDataState>({ temp: 24.5, humidity: 62, light: 850 });
  const [armPos, setArmPos] = useState<ArmPosition>({ x: 0, y: 0, z: 0 });
  const [rackState, setRackState] = useState<RackSlot[]>(INITIAL_RACK_STATE);

  const isConnected = true;
  const mountRef = useRef<HTMLDivElement | null>(null);
  const twinRef = useRef<TwinObjects | null>(null);
  const motionTargetRef = useRef<ArmPosition>({ x: 0, y: 0, z: 0 });

  const addLog = (msg: string, type: LogType = 'info') => {
    setSysLog((prev) => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 6));
  };

  const plcOnline = isConnected;
  const axisBusOnline = plcOnline;
  const cameraBusOnline = plcOnline;
  const zExtended = armPos.z > 0.05;

  const topologyNodes: TopologyNode[] = [
    {
      id: 'ipc',
      label: '工控机 IPC',
      short: 'IPC',
      role: '上位机 / HMI',
      x: 14,
      y: 18,
      status: plcOnline ? 'online' : 'offline',
    },
    {
      id: 'plc',
      label: 'PLC 控制器',
      short: 'PLC',
      role: '运动控制主站',
      x: 44,
      y: 40,
      status: plcOnline ? (systemMode === 'SCANNING' ? 'active' : 'online') : 'offline',
    },
    {
      id: 'xAxis',
      label: 'X 轴伺服',
      short: 'X',
      role: `${(armPos.x * 300).toFixed(0)} mm`,
      x: 82,
      y: 16,
      status: axisBusOnline ? (systemMode === 'SCANNING' || armPos.x > 0 ? 'active' : 'standby') : 'offline',
    },
    {
      id: 'yAxis',
      label: 'Y 轴伺服',
      short: 'Y',
      role: `${(armPos.y * 250).toFixed(0)} mm`,
      x: 84,
      y: 42,
      status: axisBusOnline ? (systemMode === 'SCANNING' || armPos.y > 0 ? 'active' : 'standby') : 'offline',
    },
    {
      id: 'zAxis',
      label: 'Z 轴执行端',
      short: 'Z',
      role: armPos.z === 1 ? '伸出取苗' : '原点待机',
      x: 80,
      y: 72,
      status: axisBusOnline ? (armPos.z === 1 ? 'active' : 'standby') : 'offline',
    },
    {
      id: 'camera',
      label: '视觉相机',
      short: 'CAM',
      role: systemMode === 'SCANNING' ? '图像采集中' : '待触发',
      x: 18,
      y: 74,
      status: cameraBusOnline ? (systemMode === 'SCANNING' ? 'active' : 'online') : 'offline',
    },
  ];

  const topologyLinks: TopologyLink[] = [
    {
      id: 'ipc-plc',
      from: 'ipc',
      to: 'plc',
      label: '电脑 <-> PLC',
      detail: plcOnline ? '工业以太网已建立，HMI 通讯稳定。' : '上位机与 PLC 链路中断。',
      status: plcOnline ? (systemMode === 'SCANNING' ? 'active' : 'online') : 'alert',
    },
    {
      id: 'plc-x',
      from: 'plc',
      to: 'xAxis',
      label: 'PLC <-> X 轴',
      detail: axisBusOnline
        ? `伺服在线，当前位置 ${(armPos.x * 300).toFixed(0)} mm。`
        : 'X 轴伺服离线。',
      status: axisBusOnline ? (systemMode === 'SCANNING' || armPos.x > 0 ? 'active' : 'online') : 'alert',
    },
    {
      id: 'plc-y',
      from: 'plc',
      to: 'yAxis',
      label: 'PLC <-> Y 轴',
      detail: axisBusOnline
        ? `伺服在线，当前位置 ${(armPos.y * 250).toFixed(0)} mm。`
        : 'Y 轴伺服离线。',
      status: axisBusOnline ? (systemMode === 'SCANNING' || armPos.y > 0 ? 'active' : 'online') : 'alert',
    },
    {
      id: 'plc-z',
      from: 'plc',
      to: 'zAxis',
      label: 'PLC <-> Z 轴',
      detail: axisBusOnline ? (armPos.z === 1 ? '抓取执行中，伸缩机构已动作。' : 'Z 轴回零待机。') : 'Z 轴执行端离线。',
      status: axisBusOnline ? (armPos.z === 1 ? 'active' : 'online') : 'alert',
    },
    {
      id: 'plc-camera',
      from: 'plc',
      to: 'camera',
      label: 'PLC <-> 视觉相机',
      detail: cameraBusOnline ? (systemMode === 'SCANNING' ? '触发采集中，图像回传正常。' : '触发链路待机。') : '视觉触发链路异常。',
      status: cameraBusOnline ? (systemMode === 'SCANNING' ? 'active' : 'online') : 'alert',
    },
  ];

  const topologyHealthTone: Tone =
    topologyLinks.some((link) => link.status === 'alert')
      ? 'alert'
      : topologyLinks.some((link) => link.status === 'active')
        ? 'active'
        : 'online';

  const onlineLinkCount = topologyLinks.filter((link) => link.status !== 'alert').length;
  const activeLinkCount = topologyLinks.filter((link) => link.status === 'active').length;
  const alertLinkCount = topologyLinks.filter((link) => link.status === 'alert').length;

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x020617);
    scene.fog = new THREE.FogExp2(0x020617, 0.012);

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 1000);
    camera.position.set(18, 10, 18);
    camera.lookAt(0, 3, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.domElement.style.touchAction = 'none';
    mount.appendChild(renderer.domElement);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.enablePan = false;
    controls.rotateSpeed = 0.72;
    controls.zoomSpeed = 0.85;
    controls.minDistance = 10;
    controls.maxDistance = 38;
    controls.minPolarAngle = Math.PI * 0.18;
    controls.maxPolarAngle = Math.PI * 0.48;

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.9);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x020617, 1.15);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xffffff, 1.6);
    keyLight.position.set(14, 18, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(2048, 2048);
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0x38bdf8, 1.2);
    rimLight.position.set(-16, 8, -12);
    scene.add(rimLight);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(18, 80),
      new THREE.MeshStandardMaterial({
        color: 0x0f172a,
        metalness: 0.08,
        roughness: 0.92,
      }),
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.02;
    floor.receiveShadow = true;
    scene.add(floor);

    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      transparent: true,
      opacity: 0.12,
      side: THREE.DoubleSide,
    });
    const halo = new THREE.Mesh(new THREE.RingGeometry(8.5, 13.5, 64), haloMat);
    halo.rotation.x = -Math.PI / 2;
    halo.position.y = 0.03;
    scene.add(halo);

    const modelPivot = new THREE.Group();
    scene.add(modelPivot);

    const xCarriage = new THREE.Group();
    const yCarriage = new THREE.Group();
    const zEffector = new THREE.Group();
    modelPivot.add(xCarriage);
    xCarriage.add(yCarriage);
    yCarriage.add(zEffector);

    const effectorBodyMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x67e8f9,
      emissiveIntensity: 0.72,
      metalness: 0.16,
      roughness: 0.28,
    });
    const effectorShellMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.22,
      roughness: 0.36,
    });
    const effectorPlate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 1.1), effectorShellMat);
    effectorPlate.position.y = 0.24;
    zEffector.add(effectorPlate);

    const effectorBody = new THREE.Mesh(new THREE.SphereGeometry(0.28, 24, 24), effectorBodyMat);
    zEffector.add(effectorBody);

    const effectorRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.48, 0.045, 12, 36),
      new THREE.MeshBasicMaterial({
        color: 0x22d3ee,
        transparent: true,
        opacity: 0.68,
      }),
    );
    effectorRing.rotation.x = Math.PI / 2;
    zEffector.add(effectorRing);

    const downLink = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 1.8, 18), effectorShellMat);
    downLink.position.y = -0.9;
    zEffector.add(downLink);

    const scanConeMat = new THREE.MeshBasicMaterial({
      color: 0x67e8f9,
      transparent: true,
      opacity: 0.14,
      side: THREE.DoubleSide,
    });
    const scanCone = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.8, 32, 1, true), scanConeMat);
    scanCone.rotation.z = Math.PI;
    scanCone.position.set(0, -2.15, 0);
    scanCone.visible = false;
    zEffector.add(scanCone);

    const twinObjects: TwinObjects = {
      xCarriage,
      yCarriage,
      zEffector,
      scanCone,
      motionBounds: null,
    };
    twinRef.current = twinObjects;

    let reqId = 0;
    let disposed = false;
    let modelReady = false;
    let framedObject: THREE.Object3D | null = null;
    const loader = new GLTFLoader();
    loader.load(
      DIRECTORY_MODEL_URL,
      (gltf) => {
        if (disposed) {
          return;
        }

        const layout = gltf.scene;
        layout.rotation.y = Math.PI * 0.75;

        layout.traverse((child) => {
          if (!(child instanceof THREE.Mesh)) {
            return;
          }

          child.castShadow = true;
          child.receiveShadow = true;

          if (!child.geometry.getAttribute('normal')) {
            child.geometry.computeVertexNormals();
          }

          if (Array.isArray(child.material)) {
            child.material.forEach((material) => {
              if (material instanceof THREE.MeshStandardMaterial) {
                material.metalness = Math.min(material.metalness, 0.12);
                material.roughness = Math.max(material.roughness, 0.68);
              }
            });
            return;
          }

          if (child.material instanceof THREE.MeshStandardMaterial) {
            child.material.metalness = Math.min(child.material.metalness, 0.12);
            child.material.roughness = Math.max(child.material.roughness, 0.68);
          }
        });

        if (modelNeedsDisplayColor(layout)) {
          applyDirectoryDisplayColors(layout);
        }

        modelPivot.add(layout);
        const normalizedBounds = normalizeModel(layout, 18);
        const topGuideY = normalizedBounds.max.y + 2.6;
        const workHeight = normalizedBounds.max.y + 0.75;
        const motionBounds: MotionBounds = {
          minX: normalizedBounds.min.x + 1.4,
          maxX: normalizedBounds.max.x - 1.4,
          minDepth: normalizedBounds.min.z + 1.1,
          maxDepth: normalizedBounds.max.z - 1.1,
          minHeight: workHeight - topGuideY,
          maxHeight: 0,
        };

        xCarriage.position.y = topGuideY;
        twinObjects.motionBounds = motionBounds;

        const xRailMat = new THREE.LineBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35,
        });
        const yRailMat = new THREE.LineBasicMaterial({
          color: 0x22d3ee,
          transparent: true,
          opacity: 0.32,
        });

        const xRail = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(motionBounds.minX, topGuideY, 0),
            new THREE.Vector3(motionBounds.maxX, topGuideY, 0),
          ]),
          xRailMat,
        );
        modelPivot.add(xRail);

        const yRail = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([
            new THREE.Vector3(0, 0, motionBounds.minDepth),
            new THREE.Vector3(0, 0, motionBounds.maxDepth),
          ]),
          yRailMat,
        );
        xCarriage.add(yRail);

        xCarriage.position.x = mapRange(motionTargetRef.current.x, 0, AXIS_LIMITS.x, motionBounds.minX, motionBounds.maxX);
        yCarriage.position.z = mapRange(
          motionTargetRef.current.y,
          0,
          AXIS_LIMITS.y,
          motionBounds.minDepth,
          motionBounds.maxDepth,
        );
        zEffector.position.y = mapRange(
          motionTargetRef.current.z,
          0,
          AXIS_LIMITS.z,
          motionBounds.maxHeight,
          motionBounds.minHeight,
        );

        framedObject = layout;
        fitCameraToObject(camera, layout, width / height, controls);
        modelReady = true;
      },
      undefined,
      (error) => {
        console.error('Failed to load directory layout model.', error);
      },
    );

    const animate = () => {
      reqId = window.requestAnimationFrame(animate);
      const elapsed = performance.now() * 0.001;
      haloMat.opacity = 0.11 + Math.sin(elapsed * 1.4) * 0.02;
      scanConeMat.opacity = scanCone.visible ? 0.2 + Math.sin(elapsed * 6) * 0.05 : 0.14;
      effectorBodyMat.emissiveIntensity = scanCone.visible ? 0.95 : 0.72;
      effectorRing.scale.setScalar(scanCone.visible ? 1 + Math.sin(elapsed * 6) * 0.03 : 1);

      if (modelReady && twinObjects.motionBounds) {
        const targetX = mapRange(
          motionTargetRef.current.x,
          0,
          AXIS_LIMITS.x,
          twinObjects.motionBounds.minX,
          twinObjects.motionBounds.maxX,
        );
        const targetDepth = mapRange(
          motionTargetRef.current.y,
          0,
          AXIS_LIMITS.y,
          twinObjects.motionBounds.minDepth,
          twinObjects.motionBounds.maxDepth,
        );
        const targetHeight = mapRange(
          motionTargetRef.current.z,
          0,
          AXIS_LIMITS.z,
          twinObjects.motionBounds.maxHeight,
          twinObjects.motionBounds.minHeight,
        );

        xCarriage.position.x += (targetX - xCarriage.position.x) * 0.08;
        yCarriage.position.z += (targetDepth - yCarriage.position.z) * 0.08;
        zEffector.position.y += (targetHeight - zEffector.position.y) * 0.12;
      }

      controls.update();
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      width = mount.clientWidth;
      height = mount.clientHeight;
      renderer.setSize(width, height);
      if (modelReady && framedObject) {
        fitCameraToObject(camera, framedObject, width / height, controls);
        return;
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(reqId);
      disposed = true;
      twinRef.current = null;
      controls.dispose();

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
          object.geometry.dispose();
          disposeMaterial(object.material);
        }
      });

      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    motionTargetRef.current = armPos;
  }, [armPos]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setEnvData((prev) => ({
        temp: prev.temp + (Math.random() * 0.4 - 0.2),
        humidity: prev.humidity + (Math.random() - 0.5),
        light: prev.light + (Math.random() * 10 - 5),
      }));
    }, 2000);

    return () => window.clearInterval(timer);
  }, []);

  const sendCmdToPython = (cmd: string, payload: Record<string, unknown>) => {
    console.log(`[Python Interface] Executing: ${cmd}`, payload);
  };

  const setManualAxis = (axis: keyof ArmPosition, value: number) => {
    if (systemMode === 'SCANNING') {
      return;
    }

    const axisMax = AXIS_LIMITS[axis];
    const nextValue = clamp(value, 0, axisMax);

    setSystemMode('MANUAL');
    setArmPos((prev) => ({ ...prev, [axis]: nextValue }));
  };

  const handleResumeAuto = () => {
    if (systemMode === 'SCANNING') {
      return;
    }

    setSystemMode('AUTO');
    addLog('已恢复自动待机，保留当前位姿。', 'info');
    /*
    addLog('宸叉仮澶嶈嚜鍔ㄥ緟鏈猴紝褰撳墠浣嶇疆宸蹭繚鐣欍€?, 'info');
    */
  };

  const handleSmartPick = async () => {
    if (systemMode === 'SCANNING') {
      return;
    }

    setSystemMode('SCANNING');
    addLog('开始 AI 智能巡检，进入视觉扫描流程。', 'info');

    const path: Array<Pick<ArmPosition, 'x' | 'y'>> = [
      { x: 0, y: 2 },
      { x: 1, y: 2 },
      { x: 2, y: 2 },
      { x: 2, y: 1 },
      { x: 1, y: 1 },
      { x: 0, y: 1 },
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 2, y: 0 },
    ];

    const twin = twinRef.current;
    if (twin) {
      twin.scanCone.visible = true;
    }

    for (const pos of path) {
      setArmPos({ x: pos.x, y: pos.y, z: 0 });
      sendCmdToPython('MOVE_XY', { x: pos.x, y: pos.y });

      await sleep(1000);

      const currentSlot = rackState.find((slot) => slot.x === pos.x && slot.y === pos.y);
      if (!currentSlot) {
        addLog(`未找到仓位坐标 [${pos.x}, ${pos.y}]。`, 'error');
        continue;
      }

      if (currentSlot.status === 2) {
        addLog(`识别成功: [${currentSlot.id}] 为成熟幼苗，执行抓取。`, 'success');
        sendCmdToPython('AI_DETECT_RESULT', { id: currentSlot.id, result: 'MATURE' });

        setArmPos({ x: pos.x, y: pos.y, z: 1 });
        sendCmdToPython('MOVE_Z', { action: 'EXTEND' });
        await sleep(800);

        setRackState((prev) =>
          prev.map((slot) => (slot.id === currentSlot.id ? { ...slot, status: 0 } : slot)),
        );

        setArmPos({ x: pos.x, y: pos.y, z: 0 });
        sendCmdToPython('MOVE_Z', { action: 'RETRACT' });
        await sleep(800);

        addLog('正在搬运至一楼出库口。', 'info');
        setArmPos({ x: 0, y: 0, z: 0 });
        sendCmdToPython('MOVE_XY', { x: 0, y: 0 });
        await sleep(1500);

        addLog(`[${currentSlot.id}] 幼苗出库完成。`, 'success');

        if (twin) {
          twin.scanCone.visible = false;
        }
        setSystemMode('AUTO');
        return;
      }

      if (currentSlot.status === 3) {
        addLog(`告警: [${currentSlot.id}] 发现异常病苗或缺水状态。`, 'error');
      }
    }

    addLog('巡检完毕，未发现可出库幼苗。', 'info');
    if (twin) {
      twin.scanCone.visible = false;
    }
    setSystemMode('AUTO');
  };

  const handleReset = () => {
    setSystemMode('AUTO');
    setArmPos({ x: 0, y: 0, z: 0 });
    addLog('伺服电机回零 (Home)。', 'info');
    sendCmdToPython('HOME', {});
  };

  const nodeLookup = {} as Record<NodeId, TopologyNode>;
  for (const node of topologyNodes) {
    nodeLookup[node.id] = node;
  }

  return (
    <div className="flex h-screen w-full flex-col overflow-hidden bg-slate-950 text-slate-200">
      <header className="relative z-10 flex h-16 shrink-0 items-center justify-between border-b border-slate-800 bg-slate-900/80 px-6 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="rounded-lg border border-blue-500/30 bg-blue-600/20 p-2">
            <ShieldCheck className="h-6 w-6 text-blue-400" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-white">智慧农业 3D 数字孪生控制台</h1>
            <p className="font-mono text-xs text-slate-400">ID: JSG2026-AGRI-01 | Python 网关在线</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex gap-4">
            <EnvData icon={<Thermometer className="h-4 w-4 text-orange-500" />} val={`${envData.temp.toFixed(1)}°C`} />
            <EnvData icon={<Droplets className="h-4 w-4 text-blue-500" />} val={`${envData.humidity.toFixed(1)}%`} />
            <EnvData icon={<Sun className="h-4 w-4 text-yellow-500" />} val={`${Math.round(envData.light)} Lx`} />
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {plcOnline && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex h-3 w-3 rounded-full ${plcOnline ? 'bg-green-500' : 'bg-red-500'}`}
              ></span>
            </span>
            <span className="text-sm font-bold text-slate-300">工控网络</span>
          </div>
        </div>
      </header>

      <div className="relative flex min-h-0 flex-1">
        <div className="absolute bottom-6 left-6 top-6 z-10 flex w-80 max-w-[calc(100%-3rem)] flex-col gap-4">
          <div className="rounded-xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-2xl backdrop-blur-md">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-400">
              <Activity className="h-4 w-4" /> 制造执行系统 (MES)
            </h2>

            <div className="space-y-3">
              <button
                onClick={handleSmartPick}
                disabled={systemMode === 'SCANNING'}
                className="flex w-full items-center justify-center gap-2 overflow-hidden rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 py-3 text-sm font-bold text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:from-emerald-500 hover:to-teal-500 disabled:opacity-50"
              >
                {systemMode === 'SCANNING' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
                {systemMode === 'SCANNING' ? 'AI 视觉巡检中...' : '一键 AI 巡检与出库'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-800 py-2 text-sm text-slate-300 transition-colors hover:bg-slate-700"
                >
                  <RefreshCw className="h-4 w-4" /> 原点复位
                </button>
                <button className="flex flex-1 items-center justify-center gap-2 rounded-lg border border-red-800/50 bg-red-900/30 py-2 text-sm text-red-400 transition-colors hover:bg-red-900/50">
                  <Power className="h-4 w-4" /> 硬件急停
                </button>
              </div>
            </div>

            <div className="mt-4 border-t border-slate-700/50 pt-4">
              <div className="mb-2 flex justify-between text-xs text-slate-400">
                <span>三轴伺服坐标反馈 (mm)</span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center font-mono">
                <div className="rounded border border-slate-800 bg-slate-950 p-2">
                  <span className="block text-[10px] text-slate-500">X-Axis</span>
                  <span className="text-blue-400">{(armPos.x * 300).toFixed(0)}</span>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-2">
                  <span className="block text-[10px] text-slate-500">Y-Axis</span>
                  <span className="text-blue-400">{(armPos.y * 250).toFixed(0)}</span>
                </div>
                <div className="rounded border border-slate-800 bg-slate-950 p-2">
                  <span className="block text-[10px] text-slate-500">Z-Axis</span>
                  <span className={zExtended ? 'text-green-400' : 'text-slate-400'}>
                    {(armPos.z * Z_TRAVEL_MM).toFixed(0)}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-xl border border-slate-800 bg-slate-950/70 p-3">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold tracking-[0.18em] text-slate-500">XYZ MANUAL</span>
                  <button
                    onClick={handleResumeAuto}
                    disabled={systemMode === 'SCANNING'}
                    className="rounded border border-cyan-500/30 px-2 py-1 text-[10px] font-semibold text-cyan-300 transition-colors hover:bg-cyan-500/10 disabled:opacity-50"
                  >
                    AUTO
                  </button>
                </div>

                <div className="space-y-3">
                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>X 轴</span>
                      <span className="font-mono text-cyan-300">{(armPos.x * 300).toFixed(0)} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={AXIS_LIMITS.x}
                      step={0.01}
                      value={armPos.x}
                      onChange={(event) => setManualAxis('x', Number(event.target.value))}
                      disabled={systemMode === 'SCANNING'}
                      className="h-2 w-full cursor-pointer accent-cyan-400 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Y 轴</span>
                      <span className="font-mono text-cyan-300">{(armPos.y * 250).toFixed(0)} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={AXIS_LIMITS.y}
                      step={0.01}
                      value={armPos.y}
                      onChange={(event) => setManualAxis('y', Number(event.target.value))}
                      disabled={systemMode === 'SCANNING'}
                      className="h-2 w-full cursor-pointer accent-cyan-400 disabled:cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <div className="mb-1 flex items-center justify-between text-[11px] text-slate-400">
                      <span>Z 轴</span>
                      <span className="font-mono text-cyan-300">{(armPos.z * Z_TRAVEL_MM).toFixed(0)} mm</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={AXIS_LIMITS.z}
                      step={1}
                      value={armPos.z}
                      onChange={(event) => setManualAxis('z', Number(event.target.value))}
                      disabled={systemMode === 'SCANNING'}
                      className="h-2 w-full cursor-pointer accent-cyan-400 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col rounded-xl border border-slate-700/50 bg-slate-900/80 p-5 shadow-2xl backdrop-blur-md">
            <h2 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-400">
              <Camera className="h-4 w-4" /> 边缘节点运行日志
            </h2>
            <div className="custom-scrollbar flex-1 space-y-3 overflow-y-auto pr-2 font-mono text-xs">
              {sysLog.map((log, index) => (
                <div key={index} className="flex flex-col gap-1 border-b border-slate-800/50 pb-2">
                  <span className="text-slate-500">[{log.time}]</span>
                  <span
                    className={
                      log.type === 'success'
                        ? 'text-green-400'
                        : log.type === 'error'
                          ? 'text-red-400'
                          : 'text-blue-300'
                    }
                  >
                    {log.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div ref={mountRef} className="absolute inset-0 cursor-grab active:cursor-grabbing"></div>

        <div className="absolute right-6 top-6 z-10 w-[27rem] max-w-[calc(100%-3rem)]">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-900/82 p-5 shadow-2xl backdrop-blur-md">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-slate-200">组态网络 / 通讯拓扑</h2>
                <p className="mt-1 text-xs leading-5 text-slate-400">
                  展示工控机、PLC、XYZ 三轴与视觉节点的实时连接状态。
                </p>
              </div>
              <StatusPill
                tone={topologyHealthTone}
                label={topologyHealthTone === 'alert' ? '存在告警' : topologyHealthTone === 'active' ? '通讯活跃' : '链路正常'}
              />
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <MetricCard label="在线链路" value={`${onlineLinkCount}/${topologyLinks.length}`} tone="online" />
              <MetricCard label="活跃链路" value={`${activeLinkCount}`} tone="active" />
              <MetricCard label="异常链路" value={`${alertLinkCount}`} tone="alert" />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-800 bg-[radial-gradient(circle_at_top,_rgba(56,189,248,0.12),_rgba(2,6,23,0.15)_38%,_rgba(2,6,23,0.92)_90%)] p-4">
              <div className="relative h-[18rem] overflow-hidden rounded-xl border border-slate-800/80 bg-slate-950/75">
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
                  {topologyLinks.map((link) => {
                    const fromNode = nodeLookup[link.from];
                    const toNode = nodeLookup[link.to];
                    const meta = LINK_STATUS_META[link.status];
                    const midX = (fromNode.x + toNode.x) / 2;
                    const midY = (fromNode.y + toNode.y) / 2;

                    return (
                      <g key={link.id}>
                        <line
                          x1={fromNode.x}
                          y1={fromNode.y}
                          x2={toNode.x}
                          y2={toNode.y}
                          stroke={meta.stroke}
                          strokeWidth={2.1}
                          strokeOpacity={0.9}
                          strokeDasharray={meta.dashArray}
                          className={link.status === 'active' ? 'topology-line-active' : undefined}
                        />
                        <circle cx={midX} cy={midY} r={1.2} fill={meta.stroke} className={link.status === 'active' ? 'topology-pulse' : undefined} />
                      </g>
                    );
                  })}
                </svg>

                {topologyNodes.map((node) => (
                  <TopologyNodeCard key={node.id} node={node} />
                ))}
              </div>
            </div>

            <div className="mt-4 space-y-2">
              {topologyLinks.map((link) => (
                <LinkStatusRow key={link.id} link={link} />
              ))}
            </div>
          </div>
        </div>

        <div className="pointer-events-none absolute bottom-6 right-6 z-10 rounded-xl border border-slate-800 bg-slate-900/60 p-4 shadow-xl backdrop-blur-md">
          <h3 className="mb-3 text-xs font-bold uppercase text-slate-500">AI 识别状态图例</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-green-500 shadow-[0_0_8px_#22c55e]"></div>
              <span className="text-slate-300">成熟期 (可采摘)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-yellow-500 shadow-[0_0_8px_#eab308]"></div>
              <span className="text-slate-300">生长中期</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-red-500 shadow-[0_0_8px_#ef4444]"></div>
              <span className="text-slate-300">缺水 / 病害预警</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-sm bg-slate-700"></div>
              <span className="text-slate-500">仓位空置</span>
            </div>
          </div>
        </div>
      </div>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .custom-scrollbar::-webkit-scrollbar { width: 4px; }
            .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
            .custom-scrollbar::-webkit-scrollbar-thumb { background: #334155; border-radius: 4px; }

            .topology-line-active {
              animation: topologyDash 2.2s linear infinite;
            }

            .topology-pulse {
              transform-origin: center;
              animation: topologyPulse 1.4s ease-in-out infinite;
            }

            .topology-beacon {
              animation: topologyBeacon 1.6s ease-in-out infinite;
            }

            @keyframes topologyDash {
              to {
                stroke-dashoffset: -18;
              }
            }

            @keyframes topologyPulse {
              0%, 100% {
                opacity: 0.35;
                transform: scale(1);
              }
              50% {
                opacity: 1;
                transform: scale(1.8);
              }
            }

            @keyframes topologyBeacon {
              0%, 100% {
                transform: scale(1);
                opacity: 0.9;
              }
              50% {
                transform: scale(1.28);
                opacity: 1;
              }
            }
          `,
        }}
      />
    </div>
  );
};

const EnvData = ({ icon, val }: EnvDataProps) => (
  <div className="flex items-center gap-1.5 rounded-md border border-slate-800 bg-slate-950 px-3 py-1.5">
    {icon}
    <span className="font-mono text-sm text-slate-300">{val}</span>
  </div>
);

const MetricCard = ({ label, value, tone }: MetricCardProps) => (
  <div className={`rounded-xl border px-3 py-3 ${METRIC_STYLES[tone]}`}>
    <div className="text-[11px] text-slate-400">{label}</div>
    <div className="mt-1 text-lg font-semibold">{value}</div>
  </div>
);

const StatusPill = ({ label, tone }: StatusPillProps) => (
  <div className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${STATUS_PILL_STYLES[tone]}`}>
    {label}
  </div>
);

const TopologyNodeCard = ({ node }: TopologyNodeCardProps) => {
  const meta = NODE_STATUS_META[node.status];

  return (
    <div
      className="absolute w-[6.75rem] -translate-x-1/2 -translate-y-1/2"
      style={{ left: `${node.x}%`, top: `${node.y}%` }}
    >
      <div className={`rounded-2xl border p-3 shadow-lg backdrop-blur-sm ${meta.border}`}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[10px] font-semibold tracking-[0.24em] text-slate-500">{node.short}</span>
          <span className={`h-2.5 w-2.5 rounded-full ${meta.dot} ${node.status === 'active' ? 'topology-beacon' : ''}`}></span>
        </div>
        <div className="mt-2 text-sm font-semibold text-white">{node.label}</div>
        <div className="mt-1 min-h-[2rem] text-[11px] leading-4 text-slate-400">{node.role}</div>
        <div className={`mt-3 inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${meta.text}`}>
          {meta.label}
        </div>
      </div>
    </div>
  );
};

const LinkStatusRow = ({ link }: LinkStatusRowProps) => {
  const meta = LINK_STATUS_META[link.status];

  return (
    <div className="grid grid-cols-[auto,1fr,auto] items-start gap-3 rounded-xl border border-slate-800 bg-slate-950/65 px-3 py-3">
      <span className={`mt-1 h-2.5 w-2.5 rounded-full ${meta.dot}`}></span>
      <div>
        <div className="text-sm font-medium text-slate-200">{link.label}</div>
        <div className="mt-1 text-xs leading-5 text-slate-400">{link.detail}</div>
      </div>
      <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${meta.badge}`}>{meta.label}</span>
    </div>
  );
};

export default App;
