import { type ReactNode, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import {
  Bot,
  Camera,
  Cpu,
  Crosshair,
  Hand,
  Link2,
  Monitor,
  Network,
  RotateCcw,
  SlidersHorizontal,
  Terminal,
  Thermometer,
  Unplug,
} from 'lucide-react';
import {
  AXIS_RANGE,
  DEFAULT_TRAY_ID,
  DETAIL_PANEL_DATA,
  DISPLAY_AXIS_RANGE,
  HOME_AXIS_POSITION,
  MAX_LOGS,
  SENSOR_BAR_WIDTHS,
  SENSOR_CONFIG,
  TRAY_OPTIONS,
  WATER_STATION_COORDS,
  clamp,
  createSensorSnapshot,
  formatSensorValue,
  formatTrayTarget,
  getTimestamp,
  getTrayCoords,
  internalToDisplayAxis,
  isPythonAxisOutOfRange,
  pythonToInternalAxis,
  type AxisPosition,
  type CameraDeviceState,
  type CameraKey,
  type DetailPanelKey,
  type LinkKey,
  type LinkStatusMap,
  type LogEntry,
  type LogLevel,
  type MotorDeviceState,
  type MotorKey,
  type SensorDeviceState,
  type SensorKey,
  type TrayId,
  type ViewMode,
} from './dashboardData';
import { mountDashboardScene } from './dashboardScene';

type AiMarkers = {
  scanning: boolean;
  targetLocked: boolean;
};

type RemoteAxisSnapshot = {
  connected: boolean;
  gateway?: string;
  status?: string;
  time?: string;
  x: number | null;
  y: number | null;
  z: number | null;
};

type RemoteGatewayState = 'idle' | 'gateway_offline' | 'plc_offline' | 'online';

const DEFAULT_AI_MARKERS: AiMarkers = { scanning: false, targetLocked: false };
const REMOTE_AXIS_ENDPOINT = 'http://127.0.0.1:8765/api/axis';

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

const App = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('virtual');
  const [detailPanel, setDetailPanel] = useState<DetailPanelKey | null>(null);
  const [sensorValues, setSensorValues] = useState(() => createSensorSnapshot());
  const [axis, setAxis] = useState<AxisPosition>(HOME_AXIS_POSITION);
  const [cylinderExtended, setCylinderExtended] = useState(false);
  const [cylinderLabel, setCylinderLabel] = useState('收回状态');
  const [links, setLinks] = useState<LinkStatusMap>({ sensors: true, motors: true, camera: false });
  const [sensors, setSensors] = useState<SensorDeviceState>({
    temp: true,
    hum: true,
    co2: true,
    light: true,
    ec: true,
    ph: true,
  });
  const [motors, setMotors] = useState<MotorDeviceState>({ x: true, y: true, cyl: true });
  const [cameras, setCameras] = useState<CameraDeviceState>({ cam1: false });
  const [logs, setLogs] = useState<LogEntry[]>([
    {
      time: getTimestamp(),
      module: '系统组态',
      message: '切换至 [虚拟仿真模式]',
      type: 'warn',
    },
    {
      time: getTimestamp(),
      module: '调度',
      message: `锁定维护目标：[${formatTrayTarget(DEFAULT_TRAY_ID)}]`,
      type: 'info',
    },
  ]);
  const [activeTrayId, setActiveTrayId] = useState<TrayId>(DEFAULT_TRAY_ID);
  const [eStopActive, setEStopActive] = useState(false);
  const [needsHoming, setNeedsHoming] = useState(false);
  const [isWorking, setIsWorking] = useState(false);
  const [aiRunning, setAiRunning] = useState(false);
  const [aiMarkers, setAiMarkers] = useState<AiMarkers>(DEFAULT_AI_MARKERS);
  const [yLimitWarning, setYLimitWarning] = useState(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const mountedRef = useRef(true);
  const axisRef = useRef(axis);
  const cylinderRef = useRef(cylinderExtended);
  const cameraOnlineRef = useRef(false);
  const linksRef = useRef(links);
  const motorsRef = useRef(motors);
  const activeTrayRef = useRef(activeTrayId);
  const eStopRef = useRef(eStopActive);
  const needsHomingRef = useRef(needsHoming);
  const isWorkingRef = useRef(isWorking);
  const abortAiRef = useRef(false);
  const eStopTimerRef = useRef<number | null>(null);
  const motionFrameRef = useRef<number | null>(null);
  const remotePollTimerRef = useRef<number | null>(null);
  const remoteGatewayStateRef = useRef<RemoteGatewayState>('idle');

  axisRef.current = axis;
  cylinderRef.current = cylinderExtended;
  linksRef.current = links;
  motorsRef.current = motors;
  activeTrayRef.current = activeTrayId;
  eStopRef.current = eStopActive;
  needsHomingRef.current = needsHoming;
  isWorkingRef.current = isWorking;

  const addLog = (module: string, message: string, type: LogLevel = 'info') => {
    setLogs((previous) => [...previous.slice(-(MAX_LOGS - 1)), { time: getTimestamp(), module, message, type }]);
  };

  const setAxisState = (nextAxis: AxisPosition) => {
    axisRef.current = nextAxis;
    setAxis(nextAxis);
  };

  const setCylinderState = (nextState: boolean) => {
    cylinderRef.current = nextState;
    setCylinderExtended(nextState);
    setCylinderLabel(nextState ? '伸出介入' : '缩回脱离');
  };

  const setWorkingState = (next: boolean) => {
    isWorkingRef.current = next;
    setIsWorking(next);
  };

  const stopAiUi = () => {
    setAiRunning(false);
    setWorkingState(false);
    setAiMarkers(DEFAULT_AI_MARKERS);
  };

  const finalizeAi = () => {
    abortAiRef.current = false;
    stopAiUi();
  };

  const ensureContinue = () => {
    if (!mountedRef.current || abortAiRef.current || eStopRef.current) {
      stopAiUi();
      return false;
    }

    return true;
  };

  const pause = async (ms: number) => {
    await sleep(ms);
    return ensureContinue();
  };

  const setTargetTrayById = (trayId: TrayId, options?: { force?: boolean; skipLog?: boolean }) => {
    if (isWorkingRef.current && !options?.force) {
      addLog('系统', '设备运行中，无法更改调度目标', 'warn');
      return false;
    }

    if (activeTrayRef.current === trayId) {
      return true;
    }

    activeTrayRef.current = trayId;
    setActiveTrayId(trayId);

    if (!options?.skipLog) {
      addLog('调度', `锁定维护目标：[${formatTrayTarget(trayId)}]`, 'info');
    }

    return true;
  };

  const setTargetTray = (trayId: TrayId, options?: { force?: boolean; skipLog?: boolean }) => setTargetTrayById(trayId, options);

  const smoothMoveTo = (targetX: number, targetY: number, duration = 1200) =>
    new Promise<void>((resolve) => {
      if (motionFrameRef.current !== null) {
        window.cancelAnimationFrame(motionFrameRef.current);
        motionFrameRef.current = null;
      }

      if (eStopRef.current) {
        resolve();
        return;
      }

      const startX = axisRef.current.x;
      const startY = axisRef.current.y;
      const clampedTargetX = clamp(targetX, AXIS_RANGE.x.min, AXIS_RANGE.x.max);
      const clampedTargetY = clamp(targetY, AXIS_RANGE.y.min, AXIS_RANGE.y.max);
      const startTime = performance.now();

      const step = (timestamp: number) => {
        if (!mountedRef.current || eStopRef.current || abortAiRef.current) {
          motionFrameRef.current = null;
          resolve();
          return;
        }

        const progress = Math.min(1, (timestamp - startTime) / duration);
        const ease = progress < 0.5 ? 2 * progress * progress : -1 + (4 - 2 * progress) * progress;
        const rawY = startY + (clampedTargetY - startY) * ease;
        const nextAxis = {
          x: startX + (clampedTargetX - startX) * ease,
          y: clamp(rawY, AXIS_RANGE.y.min, AXIS_RANGE.y.max),
        };

        setYLimitWarning(rawY !== nextAxis.y);
        setAxisState(nextAxis);

        if (progress < 1) {
          motionFrameRef.current = window.requestAnimationFrame(step);
          return;
        }

        motionFrameRef.current = null;
        resolve();
      };

      motionFrameRef.current = window.requestAnimationFrame(step);
    });

  const toggleCylinder = async (nextState: boolean, options?: { force?: boolean }) => {
    if (eStopRef.current) {
      return false;
    }

    if (!linksRef.current.motors || !motorsRef.current.cyl) {
      addLog('运动', '电磁阀当前离线', 'error');
      return false;
    }

    if (!options?.force && isWorkingRef.current) {
      return false;
    }

    setCylinderState(nextState);
    await sleep(800);
    return !eStopRef.current;
  };

  const moveAxis = (key: 'x' | 'y', value: number) => {
    if (viewMode !== 'virtual') {
      return;
    }

    if (key === 'x' && (!links.motors || !motors.x || isWorking || eStopActive || cylinderExtended)) {
      return;
    }

    if (key === 'y' && (!links.motors || !motors.y || isWorking || eStopActive)) {
      return;
    }

    const nextValue = clamp(value, AXIS_RANGE[key].min, AXIS_RANGE[key].max);
    setYLimitWarning(key === 'y' && nextValue !== value);
    setAxisState({ ...axisRef.current, [key]: nextValue });
  };

  const switchMode = (mode: ViewMode) => {
    if (mode === viewMode) {
      return;
    }

    setViewMode(mode);
    setDetailPanel(null);

    if (mode === 'virtual') {
      addLog('系统组态', '切换至 [虚拟仿真模式]', 'warn');
      return;
    }

    addLog('网络层', '连接实时数据流建立', 'success');
  };

  const toggleLink = (target: LinkKey) => {
    if (viewMode !== 'virtual') {
      return;
    }

    const linkLabels: Record<LinkKey, string> = {
      sensors: '传感器',
      motors: '电机',
      camera: '相机',
    };

    setLinks((previous) => {
      const nextValue = !previous[target];
      addLog('网络', `${nextValue ? '接通' : '断开'} [${linkLabels[target]}] 总线`, nextValue ? 'info' : 'error');
      return { ...previous, [target]: nextValue };
    });
  };

  const toggleDevice = (panelType: DetailPanelKey, id: string) => {
    if (viewMode !== 'virtual') {
      return;
    }

    if (panelType === 'sensors') {
      const key = id as SensorKey;
      setSensors((previous) => {
        const nextValue = !previous[key];
        addLog('配置', `单点设备 [${key}] 已${nextValue ? '连接' : '断开'}`, nextValue ? 'info' : 'warn');
        return { ...previous, [key]: nextValue };
      });
      return;
    }

    if (panelType === 'motors') {
      const key = id as MotorKey;
      setMotors((previous) => {
        const nextValue = !previous[key];
        addLog('配置', `单点设备 [${key}] 已${nextValue ? '连接' : '断开'}`, nextValue ? 'info' : 'warn');
        return { ...previous, [key]: nextValue };
      });
      return;
    }

    const key = id as CameraKey;
    setCameras((previous) => {
      const nextValue = !previous[key];
      addLog('配置', `单点设备 [${key}] 已${nextValue ? '连接' : '断开'}`, nextValue ? 'info' : 'warn');
      return { ...previous, [key]: nextValue };
    });
  };

  const getDeviceOnline = (panelType: DetailPanelKey, id: string) => {
    if (panelType === 'sensors') {
      return links.sensors && sensors[id as SensorKey];
    }

    if (panelType === 'motors') {
      return links.motors && motors[id as MotorKey];
    }

    return links.camera && cameras[id as CameraKey];
  };

  const moveToPosition = async (position: 'home') => {
    if (position !== 'home' || eStopRef.current) {
      return;
    }

    if (viewMode !== 'virtual') {
      addLog('远程监控', '远程监控模式下不启用本地回原动作', 'warn');
      return;
    }

    if (!linksRef.current.motors || !motorsRef.current.x || !motorsRef.current.y) {
      addLog('运动', '脱机失败', 'error');
      return;
    }

    if (isWorkingRef.current) {
      return;
    }

    setWorkingState(true);

    try {
      await toggleCylinder(false, { force: true });
      needsHomingRef.current = false;
      setNeedsHoming(false);
      await smoothMoveTo(axisRef.current.x, HOME_AXIS_POSITION.y, 800);

      if (!ensureContinue()) {
        return;
      }

      await smoothMoveTo(HOME_AXIS_POSITION.x, HOME_AXIS_POSITION.y, 1000);

      if (!ensureContinue()) {
        return;
      }

      addLog('运动', '原点位置已校准', 'success');
    } finally {
      setWorkingState(false);
    }
  };

  const startAIInspection = async () => {
    if (viewMode !== 'virtual') {
      addLog('远程监控', '远程监控模式下不启用本地仿真流程', 'warn');
      return;
    }

    if (isWorkingRef.current || aiRunning) {
      addLog('MES', '执行中，禁重复', 'warn');
      return;
    }

    if (eStopRef.current) {
      addLog('MES', '急停锁定中！', 'error');
      return;
    }

    if (needsHomingRef.current) {
      addLog('MES', '未校准，请先回原！', 'error');
      return;
    }

    if (!linksRef.current.motors || !motorsRef.current.x || !motorsRef.current.y || !motorsRef.current.cyl) {
      addLog('MES', '电机总线脱机！', 'error');
      return;
    }

    const targetId = activeTrayRef.current;
    const targetCoords = getTrayCoords(targetId);

    abortAiRef.current = false;
    setAiRunning(true);
    setWorkingState(true);
    setAiMarkers({ scanning: true, targetLocked: false });
    addLog('MES', `==== 开始自动化工单: 目标 ${targetId} ====`, 'success');

    if (!(await pause(1000))) {
      return;
    }

    if (cylinderRef.current) {
      await toggleCylinder(false, { force: true });
      if (!ensureContinue()) {
        return;
      }
    }

    setAiMarkers({ scanning: true, targetLocked: true });

    addLog('运动', '直线 X 移至目标列...', 'info');
    await smoothMoveTo(targetCoords.x, axisRef.current.y, 1200);
    if (!ensureContinue()) {
      return;
    }

    addLog('运动', '直线 Y 降至托盘底缝隙...', 'info');
    await smoothMoveTo(targetCoords.x, targetCoords.yBase, 1000);
    if (!ensureContinue()) {
      return;
    }

    await toggleCylinder(true, { force: true });
    if (!(await pause(80))) {
      return;
    }

    addLog('运动', '直线 Y 微升托起苗盘...', 'info');
    await smoothMoveTo(targetCoords.x, targetCoords.yLift, 800);
    if (!ensureContinue()) {
      return;
    }

    await toggleCylinder(false, { force: true });
    if (!ensureContinue()) {
      return;
    }

    addLog('运动', '直线 X 运至浇水台...', 'info');
    await smoothMoveTo(WATER_STATION_COORDS.x, targetCoords.yLift, 1500);
    if (!ensureContinue()) {
      return;
    }

    addLog('运动', '直线 Y 降至浇水台高度...', 'info');
    await smoothMoveTo(WATER_STATION_COORDS.x, WATER_STATION_COORDS.yLift, 800);
    if (!ensureContinue()) {
      return;
    }

    await toggleCylinder(true, { force: true });
    if (!ensureContinue()) {
      return;
    }

    await smoothMoveTo(WATER_STATION_COORDS.x, WATER_STATION_COORDS.yBase, 800);
    if (!ensureContinue()) {
      return;
    }

    await toggleCylinder(false, { force: true });
    if (!ensureContinue()) {
      return;
    }

    addLog('MES', '自动化补水作业中...', 'info');
    if (!(await pause(2500))) {
      return;
    }

    await toggleCylinder(true, { force: true });
    if (!ensureContinue()) {
      return;
    }

    await smoothMoveTo(WATER_STATION_COORDS.x, WATER_STATION_COORDS.yLift, 800);
    if (!ensureContinue()) {
      return;
    }

    await toggleCylinder(false, { force: true });
    if (!ensureContinue()) {
      return;
    }

    addLog('运动', '直线 Y 上升至防撞安全高度...', 'info');
    await smoothMoveTo(WATER_STATION_COORDS.x, targetCoords.yLift, 1000);
    if (!ensureContinue()) {
      return;
    }

    addLog('运动', '直线 X 回归目标列...', 'info');
    await smoothMoveTo(targetCoords.x, targetCoords.yLift, 1500);
    if (!ensureContinue()) {
      return;
    }

    await toggleCylinder(true, { force: true });
    if (!ensureContinue()) {
      return;
    }

    addLog('运动', '直线 Y 微降放入卡槽...', 'info');
    await smoothMoveTo(targetCoords.x, targetCoords.yBase, 800);
    if (!ensureContinue()) {
      return;
    }

    await toggleCylinder(false, { force: true });
    if (!ensureContinue()) {
      return;
    }

    addLog('运动', '直角梯次回原点...', 'info');
    await smoothMoveTo(targetCoords.x, HOME_AXIS_POSITION.y, 800);
    if (!ensureContinue()) {
      return;
    }

    await smoothMoveTo(HOME_AXIS_POSITION.x, HOME_AXIS_POSITION.y, 1200);
    if (!ensureContinue()) {
      return;
    }

    addLog('MES', '==== 闭环作业达成 ====', 'success');
    finalizeAi();
  };

  const emergencyStop = () => {
    if (viewMode !== 'virtual') {
      addLog('远程监控', '远程监控模式下不启用本地急停逻辑', 'warn');
      return;
    }

    if (eStopRef.current) {
      return;
    }

    abortAiRef.current = true;
    eStopRef.current = true;
    needsHomingRef.current = true;
    setEStopActive(true);
    setNeedsHoming(true);
    stopAiUi();
    addLog('安全', '!!! 急停触发，切断伺服驱动使能', 'error');

    if (eStopTimerRef.current !== null) {
      window.clearTimeout(eStopTimerRef.current);
    }

    eStopTimerRef.current = window.setTimeout(() => {
      eStopRef.current = false;
      setEStopActive(false);
      addLog('安全', '急停开关已复位，请立即点击【联动回原】', 'warn');
      eStopTimerRef.current = null;
    }, 3000);
  };

  useEffect(() => {
    const timer = window.setInterval(() => {
      setSensorValues(createSensorSnapshot());
    }, 2000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      if (eStopTimerRef.current !== null) {
        window.clearTimeout(eStopTimerRef.current);
      }

      if (motionFrameRef.current !== null) {
        window.cancelAnimationFrame(motionFrameRef.current);
      }

      if (remotePollTimerRef.current !== null) {
        window.clearTimeout(remotePollTimerRef.current);
      }
    };
  }, []);

  const cameraOnline = links.camera && cameras.cam1;
  cameraOnlineRef.current = cameraOnline;

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }

    return mountDashboardScene({
      mount: mountRef.current,
      axisRef,
      cylinderRef,
      cameraOnlineRef,
      activeTrayRef,
      onActiveTrayChange: (trayId) => {
        setTargetTrayById(trayId, { force: true, skipLog: true });
      },
      onLog: addLog,
    });
  }, []);

  useEffect(() => {
    if (viewMode !== 'remote') {
      remoteGatewayStateRef.current = 'idle';
      if (remotePollTimerRef.current !== null) {
        window.clearTimeout(remotePollTimerRef.current);
        remotePollTimerRef.current = null;
      }
      return;
    }

    let cancelled = false;

    const pollRemoteAxis = async () => {
      try {
        const response = await fetch(REMOTE_AXIS_ENDPOINT, { cache: 'no-store' });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const snapshot = (await response.json()) as RemoteAxisSnapshot;

        if (cancelled) {
          return;
        }

        if (!snapshot.connected) {
          setYLimitWarning(false);
          if (remoteGatewayStateRef.current !== 'plc_offline') {
            addLog('远程监控', 'plc_monitor.py 已启动，但 PLC 当前离线', 'warn');
            remoteGatewayStateRef.current = 'plc_offline';
          }
        } else {
          const nextAxisX =
            typeof snapshot.x === 'number' ? pythonToInternalAxis('x', snapshot.x) : axisRef.current.x;
          const nextAxisY =
            typeof snapshot.y === 'number' ? pythonToInternalAxis('y', snapshot.y) : axisRef.current.y;

          setAxisState({ x: nextAxisX, y: nextAxisY });

          if (typeof snapshot.y === 'number') {
            setYLimitWarning(isPythonAxisOutOfRange('y', snapshot.y));
          } else {
            setYLimitWarning(false);
          }

          if (snapshot.z === 0 || snapshot.z === 1) {
            setCylinderState(snapshot.z === 1);
          }

          if (remoteGatewayStateRef.current !== 'online') {
            addLog('远程监控', '已接入 plc_monitor.py 实时轴数据', 'success');
            remoteGatewayStateRef.current = 'online';
          }
        }
      } catch {
        if (cancelled) {
          return;
        }

        if (remoteGatewayStateRef.current !== 'gateway_offline') {
          addLog('远程监控', `无法连接 Python 数据接口 ${REMOTE_AXIS_ENDPOINT}`, 'error');
          remoteGatewayStateRef.current = 'gateway_offline';
        }
      } finally {
        if (!cancelled) {
          remotePollTimerRef.current = window.setTimeout(pollRemoteAxis, 500);
        }
      }
    };

    void pollRemoteAxis();

    return () => {
      cancelled = true;
      if (remotePollTimerRef.current !== null) {
        window.clearTimeout(remotePollTimerRef.current);
        remotePollTimerRef.current = null;
      }
    };
  }, [viewMode]);

  useEffect(() => {
    if (!cameraOnline) {
      setAiMarkers(DEFAULT_AI_MARKERS);
    }
  }, [cameraOnline]);

  const canMoveX = viewMode === 'virtual' && !eStopActive && !isWorking && links.motors && motors.x && !cylinderExtended;
  const canMoveY = viewMode === 'virtual' && !eStopActive && !isWorking && links.motors && motors.y;
  const canToggleCylinder = viewMode === 'virtual' && !eStopActive && !isWorking && links.motors && motors.cyl;
  const canUseVirtualActions = viewMode === 'virtual';
  const syncStatusClass = viewMode === 'virtual' ? 'ml-3 text-xs text-yellow-400' : 'ml-3 text-xs text-green-400';
  const syncStatusText = viewMode === 'virtual' ? '脱机仿真/拓扑构建中' : 'PLC 虚实连动中';
  const axisDisplay = {
    x: internalToDisplayAxis('x', axis.x),
    y: internalToDisplayAxis('y', axis.y),
  };
  const pcPlcLedClass = viewMode === 'virtual' ? 'status-warn' : 'status-on';
  const getLeafLedClass = (key: LinkKey) =>
    links[key] ? (viewMode === 'virtual' ? 'status-warn' : 'status-on') : 'status-off';

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#0b1120] text-sm text-slate-200">
      <header className="z-20 flex h-14 shrink-0 items-center justify-between border-b border-slate-700 bg-slate-900 px-6 shadow-lg">
        <div className="flex items-center gap-4">
          <div className="rounded-lg border border-blue-500/30 bg-blue-500/10 p-2">
            <Network className="h-7 w-7 text-blue-400 drop-shadow-[0_0_10px_rgba(59,130,246,0.8)]" />
          </div>
          <div className="flex items-center gap-3">
            <h1 className="bg-gradient-to-r from-blue-400 via-cyan-300 to-blue-500 bg-clip-text text-2xl font-bold tracking-[0.2em] text-transparent">
              云融孪生 控制系统
            </h1>
            <span className="rounded-full border border-slate-600 px-2 py-0.5 text-xs text-slate-400">
              工业级立体穿梭车(AS/RS)专版
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 rounded-lg border border-slate-600 bg-slate-800 p-1.5 shadow-inner">
          <button
            type="button"
            onClick={() => switchMode('virtual')}
            className={classNames(
              'flex items-center gap-2 rounded-md px-5 py-1.5 text-sm font-bold transition-all',
              viewMode === 'virtual'
                ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]'
                : 'text-slate-400 hover:text-white',
            )}
          >
            <Monitor className="h-4 w-4" />
            虚拟仿真模式
          </button>
          <button
            type="button"
            onClick={() => switchMode('remote')}
            className={classNames(
              'flex items-center gap-2 rounded-md px-5 py-1.5 text-sm font-bold transition-all',
              viewMode === 'remote'
                ? 'bg-blue-600 text-white shadow-[0_0_10px_rgba(37,99,235,0.5)]'
                : 'text-slate-400 hover:text-white',
            )}
          >
            <Network className="h-4 w-4" />
            远程监控模式
          </button>
        </div>
      </header>

      <main className="grid min-h-0 flex-1 grid-cols-12 gap-3 overflow-hidden p-3">
        <div className="col-span-3 flex h-full min-h-0 flex-col gap-3">
          <section className="glass-panel flex h-[52%] min-h-0 flex-col">
            <PanelHeader
              title="制造执行系统 (MES)"
              icon={<Cpu className="h-4 w-4 text-indigo-400" />}
              accent="border-l-indigo-500"
            />
            <div className="flex min-h-0 flex-1 flex-col p-3">
              <button
                type="button"
                onClick={() => void startAIInspection()}
                disabled={!canUseVirtualActions || isWorking || eStopActive}
                className={classNames(
                  'group relative flex w-full shrink-0 items-center justify-center gap-2 overflow-hidden rounded border border-indigo-400/50 bg-gradient-to-r from-indigo-600 to-purple-600 py-2 font-bold text-white shadow-[0_0_10px_rgba(79,70,229,0.5)] transition-all',
                  (!canUseVirtualActions || isWorking || eStopActive) && 'cursor-not-allowed opacity-50',
                )}
              >
                <div className="absolute inset-0 h-full w-full -translate-x-full bg-white/20 group-hover:animate-[shimmer_1s_forwards]" />
                <Bot className="relative z-10 h-5 w-5" />
                <span className="relative z-10">一键 AI 自动巡检与移载出库</span>
              </button>

              <div className="mt-2 flex shrink-0 gap-2">
                <button
                  type="button"
                  onClick={() => void moveToPosition('home')}
                  disabled={!canUseVirtualActions}
                  className={classNames(
                    'flex flex-1 items-center justify-center gap-1 rounded border border-blue-500 bg-blue-700/80 py-1.5 text-xs text-white shadow-md transition-all hover:bg-blue-600',
                    needsHoming && canUseVirtualActions && 'animate-pulse ring-2 ring-red-500',
                    !canUseVirtualActions && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  联动回原
                </button>
                <button
                  type="button"
                  onClick={emergencyStop}
                  disabled={!canUseVirtualActions}
                  className={classNames(
                    'flex flex-1 items-center justify-center gap-1 rounded border border-red-500 bg-red-700/80 py-1.5 text-xs text-white shadow-md transition-colors hover:bg-red-600',
                    !canUseVirtualActions && 'cursor-not-allowed opacity-50',
                  )}
                >
                  <Hand className="h-3.5 w-3.5" />
                  紧急停止
                </button>
              </div>

              <div className="mt-4 flex min-h-0 flex-1 flex-col border-t border-slate-700 pt-3">
                <div className="mb-2 flex shrink-0 items-center justify-between">
                  <span className="text-[11px] text-slate-400">
                    <Crosshair className="mr-1 inline h-3.5 w-3.5 text-blue-400" />
                    苗盘工单指派：
                  </span>
                  <span className="rounded border border-blue-500/50 bg-blue-900/30 px-1 text-[10px] font-bold text-blue-300">
                    目标: {formatTrayTarget(activeTrayId)}
                  </span>
                </div>
                <div className="grid min-h-0 flex-1 grid-cols-3 gap-1.5">
                  {TRAY_OPTIONS.map((tray) => (
                    <button
                      key={tray.id}
                      type="button"
                      onClick={() => setTargetTray(tray.id)}
                      className={classNames(
                        'rounded py-1 text-[10px] transition-colors',
                        activeTrayId === tray.id
                          ? 'bg-blue-600 text-white shadow-[0_0_5px_#3b82f6]'
                          : 'bg-slate-800 text-slate-400 hover:bg-slate-600',
                      )}
                    >
                      {tray.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel flex h-[48%] min-h-0 flex-col">
            <PanelHeader
              title="执行机构监控"
              icon={<SlidersHorizontal className="h-4 w-4 text-green-400" />}
              accent="border-l-green-500"
              extra={
                <div className="flex gap-1.5 text-[10px]">
                  <span>
                    <span className={classNames('motor-led', !eStopActive && links.motors ? 'bg-green-500' : 'bg-slate-500')} />
                    使能
                  </span>
                  <span>
                    <span className={classNames('motor-led', !eStopActive && links.motors ? 'bg-yellow-500' : 'bg-slate-500')} />
                    就绪
                  </span>
                  <span>
                    <span className={classNames('motor-led', eStopActive ? 'bg-red-500 animate-pulse' : 'bg-slate-500')} />
                    报警
                  </span>
                </div>
              }
            />
            <div className="custom-scrollbar flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3">
              <AxisControlCard
                label="轴 (水平平移)"
                value={axis.x}
                displayValue={axisDisplay.x}
                min={AXIS_RANGE.x.min}
                max={AXIS_RANGE.x.max}
                colorClass="text-red-400"
                accentColor="#ef4444"
                disabled={!canMoveX}
                onChange={(value) => moveAxis('x', value)}
                warning={cylinderExtended ? '互锁：货叉伸出时禁移 X 轴' : null}
              />

              <AxisControlCard
                label="轴 (垂直升降)"
                value={axis.y}
                displayValue={axisDisplay.y}
                min={AXIS_RANGE.y.min}
                max={AXIS_RANGE.y.max}
                colorClass="text-green-400"
                accentColor="#22c55e"
                disabled={!canMoveY}
                onChange={(value) => moveAxis('y', value)}
                warning={yLimitWarning ? '限位保护：已触达安全物理极值' : null}
              />

              <div className="rounded border border-slate-700 bg-slate-800 p-2">
                <div className="mb-1.5 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-yellow-400">单段伸缩货叉</span>
                  <span className="lcd-text rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-[11px] text-white">
                    {cylinderLabel}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleCylinder(false)}
                    disabled={!canToggleCylinder}
                    className={classNames(
                      'flex-1 rounded py-1.5 text-[10px] transition-colors',
                      !cylinderExtended ? 'bg-yellow-600 text-white shadow-inner' : 'bg-slate-700 text-slate-300',
                      !canToggleCylinder && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    退入框内 (0)
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleCylinder(true)}
                    disabled={!canToggleCylinder}
                    className={classNames(
                      'flex-1 rounded py-1.5 text-[10px] transition-colors',
                      cylinderExtended ? 'bg-yellow-600 text-white shadow-inner' : 'bg-slate-700 text-slate-300',
                      !canToggleCylinder && 'cursor-not-allowed opacity-50',
                    )}
                  >
                    伸入插槽 (1)
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>

        <div className="col-span-6 flex h-full min-h-0 flex-col gap-3">
          <section className="glass-panel relative flex min-h-0 flex-1 flex-col">
            <div className="pointer-events-none absolute left-3 top-3 z-10 rounded-lg border border-slate-600 bg-slate-900/80 px-3 py-1.5 backdrop-blur-sm">
              <span className="font-bold text-blue-300">云融三维引擎工作区</span>
              <span className={syncStatusClass}>
                <span className="mr-1 inline-flex align-middle">
                  {viewMode === 'virtual' ? <Unplug className="h-3 w-3" /> : <Link2 className="h-3 w-3" />}
                </span>
                {syncStatusText}
              </span>
            </div>

            <div ref={mountRef} className="h-full w-full rounded-md bg-[radial-gradient(circle_at_center,_#1e293b_0%,_#0f172a_100%)]" />

            <div className="pointer-events-none absolute right-3 top-3 rounded border border-slate-600 bg-slate-900/75 px-2 py-1 font-mono text-[10px] text-cyan-300 backdrop-blur-sm">
              Y = {DISPLAY_AXIS_RANGE.y.top} mm
            </div>
            <div className="pointer-events-none absolute bottom-3 left-3 rounded border border-cyan-500/60 bg-slate-900/80 px-2 py-1 font-mono text-[10px] text-cyan-200 shadow-lg backdrop-blur-sm">
              (0,0)
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded border border-slate-600 bg-slate-900/75 px-2 py-1 font-mono text-[10px] text-rose-300 backdrop-blur-sm">
              X = {DISPLAY_AXIS_RANGE.x.right} mm
            </div>

            <div className="pointer-events-none absolute bottom-3 left-1/2 flex w-max -translate-x-1/2 items-center gap-2 rounded-full border border-slate-700 bg-slate-900/60 px-4 py-1.5 text-[11px] text-slate-300 shadow-lg backdrop-blur-sm">
              <Monitor className="h-3.5 w-3.5 text-blue-400" />
              <span>物理防碰：货叉已降低绝对高度，严格低于苗盘且强制受限，确保只进不出错。</span>
            </div>
          </section>

          <section className="glass-panel flex h-[22%] min-h-[120px] flex-col">
            <PanelHeader
              title="综合微环境感知阵列"
              icon={<Thermometer className="h-4 w-4 text-orange-400" />}
              accent="border-l-orange-500"
            />
            <div className="custom-scrollbar grid min-h-0 flex-1 grid-cols-3 gap-2 overflow-y-auto p-2">
              {SENSOR_CONFIG.map((sensor) => {
                const online = links.sensors && sensors[sensor.id];
                const value = sensorValues[sensor.id];

                return (
                  <div
                    key={sensor.id}
                    className="relative flex h-full flex-col items-center justify-center overflow-hidden rounded border border-slate-700 bg-slate-800/80 p-2"
                  >
                    <div className="mb-1 text-[10px] text-slate-400">{sensor.label}</div>
                    <div className={classNames('lcd-text text-lg font-bold', online ? sensor.accentClass : 'text-slate-500')}>
                      {online ? formatSensorValue(value, sensor.precision) : '--'}
                      <span className="ml-1 text-[9px] text-slate-500">{sensor.unit}</span>
                    </div>
                    <div className={classNames('absolute bottom-0 left-0 h-1', sensor.barClass)} style={{ width: SENSOR_BAR_WIDTHS[sensor.id] }} />
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <div className="col-span-3 flex h-full min-h-0 flex-col gap-3">
          <section className="glass-panel relative flex h-[46%] min-h-0 flex-col">
            <PanelHeader
              title="工业网络拓扑"
              icon={<Cpu className="h-4 w-4 text-purple-400" />}
              accent="border-l-purple-500"
              extra={
                viewMode === 'virtual' ? (
                  <span className="rounded border border-yellow-700 bg-yellow-900/50 px-2 py-0.5 text-[10px] text-yellow-400 animate-pulse">
                    点击连线交互
                  </span>
                ) : null
              }
            />

            <div
              className={classNames(
                'relative flex min-h-0 flex-1 flex-col items-center justify-start overflow-hidden bg-slate-900/40 p-1 py-2',
                viewMode === 'virtual' && 'virtual-edit-mode',
              )}
            >
              {detailPanel ? (
                <div className="absolute inset-1 z-50 flex flex-col rounded border border-slate-600 bg-slate-900/95 p-3 shadow-2xl backdrop-blur-md">
                  <div className="mb-2 flex shrink-0 items-center justify-between border-b border-slate-700 pb-2">
                    <span className="font-bold text-blue-400">
                      <Terminal className="mr-2 inline h-4 w-4" />
                      {DETAIL_PANEL_DATA[detailPanel].title}
                    </span>
                    <button
                      type="button"
                      onClick={() => setDetailPanel(null)}
                      className="rounded bg-slate-800 px-2 py-0.5 text-slate-400 hover:text-white"
                    >
                      关
                    </button>
                  </div>
                  <ul className="custom-scrollbar min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
                    {DETAIL_PANEL_DATA[detailPanel].items.map((item) => {
                      const online = getDeviceOnline(detailPanel, item.id);
                      const canToggle = viewMode === 'virtual' && links[detailPanel];

                      return (
                        <li
                          key={item.id}
                          className="flex items-center justify-between rounded border border-slate-700 bg-slate-800 p-2 text-xs"
                        >
                          <div className="flex items-center gap-2">
                            <item.Icon className="h-4 w-4 text-slate-300" />
                            <div>
                              <div>{item.name}</div>
                              <div className="text-[10px] text-slate-500">{item.address}</div>
                            </div>
                          </div>
                          <div className={classNames('flex flex-col items-end', online ? 'text-green-400' : 'text-red-500')}>
                            <span>{online ? '在线' : '断开'}</span>
                            {canToggle ? (
                              <button
                                type="button"
                                onClick={() => toggleDevice(detailPanel, item.id)}
                                className={classNames(
                                  'mt-1 rounded px-1.5 py-0.5 text-[9px] shadow',
                                  online ? 'bg-slate-700 text-red-400' : 'bg-slate-700 text-green-400',
                                )}
                              >
                                {online ? '断开' : '连接'}
                              </button>
                            ) : null}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ) : null}

              <TopologyNodeCard
                label="上位机"
                icon={<Monitor className="mb-1 h-7 w-7 text-blue-400" />}
                ledClass={pcPlcLedClass}
                borderClass="border-blue-500/50 hover:bg-slate-800"
                onClick={() => setDetailPanel(null)}
              />
              <div className="topo-link topo-link-active h-3 w-0.5" />
              <TopologyNodeCard
                label="主站 PLC"
                icon={<Cpu className="mb-1 h-8 w-8 text-green-400" />}
                ledClass={pcPlcLedClass}
                borderClass="border-green-500/50 bg-slate-800 hover:bg-slate-700"
                onClick={() => setDetailPanel(null)}
              />
              <div className="topo-link topo-link-active h-4 w-0.5" />

              <div className="relative h-0.5 w-[85%]">
                <div className="topo-link topo-link-active absolute left-0 top-0 h-0.5 w-full" />
                {(['sensors', 'motors', 'camera'] as LinkKey[]).map((key, index) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleLink(key)}
                    disabled={viewMode !== 'virtual'}
                    className={classNames(
                      'topo-link absolute top-0 z-10 h-5 w-1 cursor-pointer',
                      links[key] ? 'topo-link-active' : 'topo-link-broken',
                      index === 0 ? 'left-0' : index === 1 ? 'left-1/2 -translate-x-1/2' : 'right-0',
                    )}
                  />
                ))}
              </div>

              <div className="mt-4 flex w-full justify-between px-1">
                <TopologyLeafCard
                  label="传感器"
                  icon={<Thermometer className="mb-1 h-5 w-5 text-yellow-400" />}
                  ledClass={getLeafLedClass('sensors')}
                  borderClass="border-yellow-500/30"
                  onClick={() => setDetailPanel('sensors')}
                />
                <TopologyLeafCard
                  label="伺服/气动"
                  icon={<SlidersHorizontal className="mb-1 h-5 w-5 text-red-400" />}
                  ledClass={getLeafLedClass('motors')}
                  borderClass="border-red-500/30"
                  onClick={() => setDetailPanel('motors')}
                />
                <TopologyLeafCard
                  label="相机"
                  icon={<Camera className="mb-1 h-5 w-5 text-purple-400" />}
                  ledClass={getLeafLedClass('camera')}
                  borderClass="border-purple-500/30"
                  onClick={() => setDetailPanel('camera')}
                />
              </div>
            </div>
          </section>

          <section className="glass-panel flex h-[54%] min-h-0 flex-col">
            <PanelHeader
              title="系统诊断与视觉"
              icon={<Terminal className="h-4 w-4 text-yellow-400" />}
              accent="border-l-yellow-500"
            />
            <div className="flex min-h-0 flex-1 flex-col gap-2 p-2">
              <div className="relative h-28 shrink-0 overflow-hidden rounded border border-slate-600 bg-black shadow-inner">
                {cameraOnline ? (
                  <>
                    <div className="absolute left-1 top-1 z-10 rounded bg-green-600 px-1 py-0.5 text-[10px] text-white shadow-[0_0_5px_#16a34a]">
                      CAM 01 监控中
                    </div>
                    <div className="camera-grid absolute inset-0" />
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(34,197,94,0.22),transparent_28%),linear-gradient(180deg,rgba(6,78,59,0.22),rgba(2,6,23,0.94)_78%)]" />
                    {aiMarkers.targetLocked ? (
                      <div className="absolute left-[30%] top-[20%] h-12 w-12 border border-green-500 bg-green-500/10">
                        <span className="absolute -top-3.5 left-0 bg-green-500 px-1 text-[8px] font-bold text-black">Target</span>
                      </div>
                    ) : null}
                    <div className="absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-blue-400/50" />
                    <div className="absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-blue-400/50" />
                    <div className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-blue-400">
                      <div className="h-1 w-1 rounded-full bg-blue-400" />
                    </div>
                    <div className="absolute bottom-1 right-1 text-right font-mono text-[8px] text-green-300">
                      <div className="animate-pulse">REC 1080P</div>
                      <div>
                        POS: X:{axisDisplay.x.toFixed(1)} Y:{axisDisplay.y.toFixed(1)}
                      </div>
                    </div>
                    {aiMarkers.scanning ? <div className="camera-scan-line absolute inset-0" /> : null}
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <div className="absolute left-1 top-1 rounded bg-red-600 px-1 py-0.5 text-[10px] text-white animate-pulse">CAM 01 离线</div>
                    <Camera className="mb-1 h-8 w-8 text-slate-600" />
                  </div>
                )}
              </div>

              <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded border border-slate-700 bg-slate-900 p-2 font-mono text-[10px]">
                {logs.map((log, index) => (
                  <div key={`${log.time}-${index}`} className="mb-1">
                    <span className="text-slate-500">[{log.time}]</span>{' '}
                    <span className="text-blue-400">[{log.module}]</span>{' '}
                    <span
                      className={classNames(
                        log.type === 'success'
                          ? 'text-green-400'
                          : log.type === 'warn'
                            ? 'text-yellow-400'
                            : log.type === 'error'
                              ? 'text-red-400'
                              : 'text-slate-300',
                      )}
                    >
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `
            .glass-panel {
              background: rgba(15, 23, 42, 0.75);
              border: 1px solid rgba(51, 65, 85, 0.8);
              box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5), 0 4px 6px rgba(0, 0, 0, 0.3);
              backdrop-filter: blur(10px);
              border-radius: 0.5rem;
            }

            .panel-header {
              background: linear-gradient(90deg, rgba(30, 41, 59, 0.9) 0%, rgba(15, 23, 42, 0) 100%);
              border-bottom: 1px solid rgba(51, 65, 85, 0.5);
              border-left-width: 4px;
            }

            .topo-node {
              background: rgba(30, 41, 59, 0.9);
              border: 1px solid #475569;
              border-radius: 0.5rem;
              padding: 0.4rem;
              display: flex;
              flex-direction: column;
              align-items: center;
              justify-content: center;
              z-index: 10;
              width: 100px;
              box-shadow: 0 4px 10px rgba(0, 0, 0, 0.5);
              transition: all 0.2s ease;
              cursor: pointer;
            }

            .topo-node:hover {
              border-color: #3b82f6;
              box-shadow: 0 0 15px rgba(59, 130, 246, 0.5);
            }

            .topo-link {
              transition: all 0.3s ease;
            }

            .topo-link-active {
              background: rgba(59, 130, 246, 0.8);
              box-shadow: 0 0 5px rgba(59, 130, 246, 0.8);
            }

            .topo-link-broken {
              background: rgba(239, 68, 68, 0.8);
              border-left: 2px dashed #ef4444;
              width: 0 !important;
            }

            .virtual-edit-mode .topo-link:hover {
              filter: brightness(1.5) drop-shadow(0 0 4px white);
            }

            .motor-led {
              display: inline-block;
              width: 8px;
              height: 8px;
              margin-right: 4px;
              border-radius: 50%;
              transition: background-color 0.3s;
            }

            .custom-scrollbar::-webkit-scrollbar {
              width: 6px;
            }

            .custom-scrollbar::-webkit-scrollbar-track {
              background: rgba(30, 41, 59, 0.5);
            }

            .custom-scrollbar::-webkit-scrollbar-thumb {
              background: #475569;
              border-radius: 3px;
            }

            .custom-scrollbar::-webkit-scrollbar-thumb:hover {
              background: #64748b;
            }

            .lcd-text {
              font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
            }

            input[type='range']:disabled {
              filter: grayscale(1);
              opacity: 0.4;
              cursor: not-allowed;
            }

            @keyframes flash-green {
              0%, 100% { box-shadow: 0 0 8px #22c55e, inset 0 0 5px #22c55e; background-color: #22c55e; }
              50% { box-shadow: 0 0 18px #22c55e, inset 0 0 10px #22c55e; background-color: #4ade80; }
            }

            @keyframes flash-red {
              0%, 100% { box-shadow: 0 0 8px #ef4444, inset 0 0 5px #ef4444; background-color: #ef4444; }
              50% { box-shadow: 0 0 18px #ef4444, inset 0 0 10px #ef4444; background-color: #f87171; }
            }

            @keyframes flash-yellow {
              0%, 100% { box-shadow: 0 0 8px #eab308; background-color: #eab308; }
              50% { box-shadow: 0 0 18px #eab308; background-color: #facc15; }
            }

            @keyframes shimmer {
              100% { transform: translateX(100%); }
            }

            @keyframes cameraSweep {
              0% { transform: translateY(-120%); }
              100% { transform: translateY(220%); }
            }

            .status-on {
              animation: flash-green 1.5s infinite;
            }

            .status-off {
              animation: flash-red 1s infinite;
            }

            .status-warn {
              animation: flash-yellow 1s infinite;
            }

            .camera-grid {
              background-image:
                linear-gradient(rgba(14, 165, 233, 0.08) 1px, transparent 1px),
                linear-gradient(90deg, rgba(14, 165, 233, 0.08) 1px, transparent 1px);
              background-position: center center;
              background-size: 22px 22px;
            }

            .camera-scan-line {
              background: linear-gradient(to bottom, transparent, rgba(96, 165, 250, 0.22), transparent);
              animation: cameraSweep 2s linear infinite;
            }
          `,
        }}
      />
    </div>
  );
};

const PanelHeader = ({
  title,
  icon,
  accent,
  extra,
}: {
  title: string;
  icon: ReactNode;
  accent: string;
  extra?: ReactNode;
}) => (
  <div className={classNames('panel-header flex items-center justify-between gap-2 px-3 py-1.5', accent)}>
    <div className="flex items-center gap-2">
      {icon}
      <span className="font-bold text-slate-200">{title}</span>
    </div>
    {extra}
  </div>
);

const AxisControlCard = ({
  label,
  value,
  displayValue,
  min,
  max,
  colorClass,
  accentColor,
  disabled,
  onChange,
  warning,
}: {
  label: string;
  value: number;
  displayValue?: number;
  min: number;
  max: number;
  colorClass: string;
  accentColor: string;
  disabled: boolean;
  onChange: (value: number) => void;
  warning: string | null;
}) => (
  <div className="rounded border border-slate-700 bg-slate-800 p-2">
    <div className="mb-1 flex items-center justify-between">
      <span className={classNames('text-[11px] font-bold', colorClass)}>{label}</span>
      <span className="lcd-text rounded border border-slate-600 bg-slate-900 px-2 py-0.5 text-[11px] text-white">
        {(typeof displayValue === 'number' ? displayValue : value).toFixed(1)} mm
      </span>
    </div>
    <input
      type="range"
      min={min}
      max={max}
      value={value}
      onChange={(event) => onChange(Number(event.target.value))}
      disabled={disabled}
      style={{ accentColor }}
      className="h-1.5 w-full cursor-pointer rounded-lg bg-slate-600"
    />
    <div className={classNames('mt-0.5 text-[9px] text-yellow-500', !warning && 'hidden')}>{warning ?? ''}</div>
  </div>
);

const TopologyNodeCard = ({
  label,
  icon,
  ledClass,
  borderClass,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  ledClass: string;
  borderClass: string;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className={classNames('topo-node relative', borderClass)}>
    <span className={classNames('absolute -right-1 -top-1 h-3 w-3 rounded-full', ledClass)} />
    {icon}
    <span className="text-xs font-bold text-slate-200">{label}</span>
  </button>
);

const TopologyLeafCard = ({
  label,
  icon,
  ledClass,
  borderClass,
  onClick,
}: {
  label: string;
  icon: ReactNode;
  ledClass: string;
  borderClass: string;
  onClick: () => void;
}) => (
  <button type="button" onClick={onClick} className={classNames('topo-node relative origin-top scale-[0.85]', borderClass)}>
    <span className={classNames('absolute -right-1 -top-1 h-3 w-3 rounded-full', ledClass)} />
    {icon}
    <span className="text-[10px] font-bold text-slate-300">{label}</span>
  </button>
);

export default App;
