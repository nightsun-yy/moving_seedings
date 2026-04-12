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

type SystemMode = 'AUTO' | 'MANUAL' | 'SCANNING';
type LogType = 'info' | 'success' | 'error';
type RackStatus = 0 | 1 | 2 | 3;

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

type PlantMesh = THREE.Mesh<THREE.SphereGeometry, THREE.MeshStandardMaterial>;

type TwinObjects = {
  xCarriage: THREE.Group;
  yCarriage: THREE.Group;
  zEffector: THREE.Group;
  scanCone: THREE.Mesh<THREE.ConeGeometry, THREE.MeshBasicMaterial>;
  plantMeshes: Record<string, PlantMesh>;
  getPlantMat: (status: RackStatus) => THREE.MeshStandardMaterial;
};

const INITIAL_LOGS: SysLogEntry[] = [
  {
    time: new Date().toLocaleTimeString(),
    msg: '系统初始化完成，3D引擎加载成功。',
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

const INITIAL_TARGET = { x: 1.5, y: 2.1, z: 0 };

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const disposeMaterial = (material: THREE.Material | THREE.Material[]) => {
  if (Array.isArray(material)) {
    material.forEach((item) => item.dispose());
    return;
  }

  material.dispose();
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
  const motionTargetRef = useRef(INITIAL_TARGET);

  const addLog = (msg: string, type: LogType = 'info') => {
    setSysLog((prev) => [{ time: new Date().toLocaleTimeString(), msg, type }, ...prev].slice(0, 5));
  };

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) {
      return;
    }

    let width = mount.clientWidth;
    let height = mount.clientHeight;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0f172a);
    scene.fog = new THREE.FogExp2(0x0f172a, 0.02);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(15, 12, 20);
    camera.lookAt(5, 4, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    mount.appendChild(renderer.domElement);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = true;
    scene.add(dirLight);

    const spotLight = new THREE.SpotLight(0x3b82f6, 2);
    spotLight.position.set(-5, 10, 15);
    spotLight.lookAt(5, 4, 0);
    scene.add(spotLight);

    const matAluminum = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.8,
      roughness: 0.3,
    });
    const matDark = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.5,
      roughness: 0.5,
    });
    const matRail = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      metalness: 0.9,
      roughness: 0.1,
    });

    const matEmpty = new THREE.MeshStandardMaterial({ color: 0x334155 });
    const matGrowing = new THREE.MeshStandardMaterial({
      color: 0xeab308,
      emissive: 0xeab308,
      emissiveIntensity: 0.2,
    });
    const matMature = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x22c55e,
      emissiveIntensity: 0.2,
    });
    const matAlert = new THREE.MeshStandardMaterial({
      color: 0xef4444,
      emissive: 0xef4444,
      emissiveIntensity: 0.4,
    });

    const getPlantMat = (status: RackStatus) => {
      if (status === 1) {
        return matGrowing;
      }
      if (status === 2) {
        return matMature;
      }
      if (status === 3) {
        return matAlert;
      }
      return matEmpty;
    };

    const models = new THREE.Group();
    scene.add(models);

    const tableGeo = new THREE.BoxGeometry(20, 0.5, 10);
    const table = new THREE.Mesh(tableGeo, matDark);
    table.position.set(5, -0.25, 0);
    table.receiveShadow = true;
    models.add(table);

    const rackGroup = new THREE.Group();
    rackGroup.position.set(5, 0, -2);
    models.add(rackGroup);

    const buildFrame = () => {
      const frameGeoH = new THREE.BoxGeometry(10, 0.2, 0.2);
      const frameGeoV = new THREE.BoxGeometry(0.2, 8, 0.2);
      const frameGeoD = new THREE.BoxGeometry(0.2, 0.2, 3);

      for (const x of [0, 9]) {
        for (const z of [0, 2]) {
          const pillar = new THREE.Mesh(frameGeoV, matAluminum);
          pillar.position.set(x, 4, z);
          rackGroup.add(pillar);
        }
      }

      for (const y of [2, 4.5, 7]) {
        for (const z of [0, 2]) {
          const beam = new THREE.Mesh(frameGeoH, matAluminum);
          beam.position.set(4.5, y, z);
          rackGroup.add(beam);
        }

        for (const x of [0, 3, 6, 9]) {
          const depthBeam = new THREE.Mesh(frameGeoD, matAluminum);
          depthBeam.position.set(x, y, 1);
          rackGroup.add(depthBeam);
        }
      }
    };
    buildFrame();

    const plantMeshes: Record<string, PlantMesh> = {};
    const trayGeo = new THREE.BoxGeometry(2, 0.1, 2);
    const plantGeo = new THREE.SphereGeometry(0.6, 16, 16);

    INITIAL_RACK_STATE.forEach((slot) => {
      const px = slot.x * 3 + 1.5;
      const py = slot.y * 2.5 + 2.1;

      const tray = new THREE.Mesh(trayGeo, matDark);
      tray.position.set(px, py, 1);
      rackGroup.add(tray);

      const plant = new THREE.Mesh(plantGeo, getPlantMat(slot.status));
      plant.position.set(px, py + 0.4, 1);
      plant.scale.y = slot.status === 1 ? 0.5 : slot.status === 0 ? 0.01 : 1;
      rackGroup.add(plant);
      plantMeshes[slot.id] = plant;
    });

    const robotGroup = new THREE.Group();
    robotGroup.position.set(0, 0, 2);
    models.add(robotGroup);

    const xRailGeo = new THREE.BoxGeometry(11, 0.4, 1);
    const xRail = new THREE.Mesh(xRailGeo, matAluminum);
    xRail.position.set(4.5, 0.2, 0);
    robotGroup.add(xRail);

    const xCarriage = new THREE.Group();
    xCarriage.position.x = motionTargetRef.current.x;
    robotGroup.add(xCarriage);

    const xBase = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 1.5), matDark);
    xBase.position.set(0, 0.6, 0);
    xCarriage.add(xBase);

    const yPillar = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8, 0.6), matAluminum);
    yPillar.position.set(0, 4.6, 0);
    xCarriage.add(yPillar);

    const yCarriage = new THREE.Group();
    yCarriage.position.y = motionTargetRef.current.y;
    xCarriage.add(yCarriage);

    const yBase = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1.2), matDark);
    yBase.position.set(0, 0, 0);
    yCarriage.add(yBase);

    const zArm = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 3), matRail);
    zArm.position.set(0, 0, -1);
    yCarriage.add(zArm);

    const zEffector = new THREE.Group();
    zEffector.position.z = motionTargetRef.current.z;
    yCarriage.add(zEffector);

    const fork = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.1, 2), matAluminum);
    fork.position.set(0, -0.2, -2.5);
    zEffector.add(fork);

    const cameraBody = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.3, 0.4),
      new THREE.MeshStandardMaterial({ color: 0x000000 }),
    );
    cameraBody.position.set(0, 0.2, -1.8);
    zEffector.add(cameraBody);

    const cameraLens = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.2),
      new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        emissive: 0x3b82f6,
        emissiveIntensity: 0.5,
      }),
    );
    cameraLens.rotation.x = Math.PI / 2;
    cameraLens.position.set(0, 0.2, -2);
    zEffector.add(cameraLens);

    const scanConeGeo = new THREE.ConeGeometry(1, 2, 16);
    const scanConeMat = new THREE.MeshBasicMaterial({
      color: 0x06b6d4,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const scanCone = new THREE.Mesh(scanConeGeo, scanConeMat);
    scanCone.rotation.x = -Math.PI / 2;
    scanCone.position.set(0, 0.2, -3);
    scanCone.visible = false;
    zEffector.add(scanCone);

    twinRef.current = { xCarriage, yCarriage, zEffector, scanCone, plantMeshes, getPlantMat };

    let reqId = 0;

    const animate = () => {
      reqId = window.requestAnimationFrame(animate);

      xCarriage.position.x += (motionTargetRef.current.x - xCarriage.position.x) * 0.05;
      yCarriage.position.y += (motionTargetRef.current.y - yCarriage.position.y) * 0.05;
      zEffector.position.z += (motionTargetRef.current.z - zEffector.position.z) * 0.08;

      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      width = mount.clientWidth;
      height = mount.clientHeight;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      window.cancelAnimationFrame(reqId);
      twinRef.current = null;

      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }

      scene.traverse((object: THREE.Object3D) => {
        if (object instanceof THREE.Mesh) {
          object.geometry.dispose();
          disposeMaterial(object.material);
        }
      });

      renderer.dispose();
    };
  }, []);

  useEffect(() => {
    motionTargetRef.current = {
      x: armPos.x * 3 + 1.5,
      y: armPos.y * 2.5 + 2.1,
      z: armPos.z === 1 ? -1 : 0,
    };
  }, [armPos]);

  useEffect(() => {
    const twin = twinRef.current;
    if (!twin) {
      return;
    }

    rackState.forEach((slot) => {
      const mesh = twin.plantMeshes[slot.id];
      if (!mesh) {
        return;
      }

      mesh.material = twin.getPlantMat(slot.status);
      mesh.scale.y = slot.status === 1 ? 0.5 : slot.status === 0 ? 0.01 : 1;
    });
  }, [rackState]);

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

  const handleSmartPick = async () => {
    if (systemMode !== 'AUTO') {
      return;
    }

    setSystemMode('SCANNING');
    addLog('开始 AI 智能寻苗巡检...', 'info');

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

        addLog('正在搬运至一楼出库口...', 'info');
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
        addLog(`警告: [${currentSlot.id}] 发现异常病苗/缺水！`, 'error');
      }
    }

    addLog('巡检完毕，未发现可出库幼苗。', 'info');
    if (twin) {
      twin.scanCone.visible = false;
    }
    setSystemMode('AUTO');
  };

  const handleReset = () => {
    setArmPos({ x: 0, y: 0, z: 0 });
    addLog('伺服电机归零 (Home)。', 'info');
    sendCmdToPython('HOME', {});
  };

  return (
    <div className="w-full h-screen bg-slate-950 text-slate-200 font-sans flex flex-col overflow-hidden">
      <header className="h-16 bg-slate-900/80 backdrop-blur border-b border-slate-800 flex items-center justify-between px-6 shrink-0 relative z-10">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600/20 p-2 rounded-lg border border-blue-500/30">
            <ShieldCheck className="text-blue-400 w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wider text-white">智慧农业 3D数字孪生控制台</h1>
            <p className="text-xs text-slate-400 font-mono">ID: JSG2026-AGRI-01 | Python 网关在线</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
          <div className="flex gap-4">
            <EnvData icon={<Thermometer className="text-orange-500 w-4 h-4" />} val={`${envData.temp.toFixed(1)}°C`} />
            <EnvData icon={<Droplets className="text-blue-500 w-4 h-4" />} val={`${envData.humidity.toFixed(1)}%`} />
            <EnvData icon={<Sun className="text-yellow-500 w-4 h-4" />} val={`${Math.round(envData.light)} Lx`} />
          </div>
          <div className="h-8 w-px bg-slate-700"></div>
          <div className="flex items-center gap-2">
            <span className="relative flex h-3 w-3">
              {isConnected && (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              )}
              <span
                className={`relative inline-flex rounded-full h-3 w-3 ${isConnected ? 'bg-green-500' : 'bg-red-500'}`}
              ></span>
            </span>
            <span className="text-sm font-bold text-slate-300">PLC Link</span>
          </div>
        </div>
      </header>

      <div className="flex-1 relative flex">
        <div className="absolute left-6 top-6 bottom-6 w-80 flex flex-col gap-4 z-10">
          <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-5 shadow-2xl">
            <h2 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> 制造执行系统 (MES)
            </h2>

            <div className="space-y-3">
              <button
                onClick={handleSmartPick}
                disabled={systemMode === 'SCANNING'}
                className="w-full relative group overflow-hidden bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white py-3 rounded-lg text-sm font-bold shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 transition-all flex items-center justify-center gap-2"
              >
                {systemMode === 'SCANNING' ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {systemMode === 'SCANNING' ? 'AI 视觉巡检中...' : '一键 AI 寻苗与出库'}
              </button>

              <div className="flex gap-2">
                <button
                  onClick={handleReset}
                  className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" /> 原点复位
                </button>
                <button className="flex-1 bg-red-900/30 hover:bg-red-900/50 border border-red-800/50 text-red-400 py-2 rounded-lg text-sm transition-colors flex items-center justify-center gap-2">
                  <Power className="w-4 h-4" /> 硬件急停
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-slate-700/50">
              <div className="flex justify-between text-xs text-slate-400 mb-2">
                <span>三轴伺服坐标反馈 (mm)</span>
              </div>
              <div className="grid grid-cols-3 gap-2 font-mono text-center">
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-[10px] block text-slate-500">X-Axis</span>
                  <span className="text-blue-400">{(armPos.x * 300).toFixed(0)}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-[10px] block text-slate-500">Y-Axis</span>
                  <span className="text-blue-400">{(armPos.y * 250).toFixed(0)}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded border border-slate-800">
                  <span className="text-[10px] block text-slate-500">Z-Axis</span>
                  <span className={armPos.z === 1 ? 'text-green-400' : 'text-slate-400'}>
                    {armPos.z === 1 ? 'EXT' : 'RET'}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-slate-900/80 backdrop-blur-md rounded-xl border border-slate-700/50 p-5 shadow-2xl flex-1 flex flex-col">
            <h2 className="text-sm font-bold text-slate-400 mb-4 flex items-center gap-2">
              <Camera className="w-4 h-4" /> 边缘节点运行日志
            </h2>
            <div className="flex-1 overflow-y-auto space-y-3 font-mono text-xs pr-2 custom-scrollbar">
              {sysLog.map((log, i) => (
                <div key={i} className="flex flex-col gap-1 border-b border-slate-800/50 pb-2">
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

        <div ref={mountRef} className="absolute inset-0 cursor-crosshair"></div>

        <div className="absolute right-6 bottom-6 bg-slate-900/60 backdrop-blur-md rounded-xl border border-slate-800 p-4 shadow-xl z-10 pointer-events-none">
          <h3 className="text-xs font-bold text-slate-500 mb-3 uppercase">AI 识别状态图例</h3>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-sm shadow-[0_0_8px_#22c55e]"></div>
              <span className="text-slate-300">成熟期 (可采摘)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-sm shadow-[0_0_8px_#eab308]"></div>
              <span className="text-slate-300">生长中期</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-sm shadow-[0_0_8px_#ef4444]"></div>
              <span className="text-slate-300">缺水/病害预警</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-slate-700 rounded-sm"></div>
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
          `,
        }}
      />
    </div>
  );
};

type EnvDataProps = {
  icon: ReactNode;
  val: string;
};

const EnvData = ({ icon, val }: EnvDataProps) => (
  <div className="flex items-center gap-1.5 bg-slate-950 px-3 py-1.5 rounded-md border border-slate-800">
    {icon}
    <span className="text-sm font-mono text-slate-300">{val}</span>
  </div>
);

export default App;
