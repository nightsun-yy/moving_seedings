import { type ReactNode, useEffect, useRef, useState } from 'react';
import classNames from 'classnames';
import {
  Camera,
  CheckCircle2,
  Cpu,
  House,
  Link2,
  Monitor,
  Network,
  Radar,
  SlidersHorizontal,
  Terminal,
  Thermometer,
  Unplug,
  XCircle,
} from 'lucide-react';
import {
  AXIS_RANGE,
  DETAIL_PANEL_DATA,
  MAX_LOGS,
  NODE_TONE_META,
  SENSOR_CONFIG,
  createSensorSnapshot,
  formatSensorValue,
  getTimestamp,
  mapRange,
  type AxisKey,
  type AxisPosition,
  type CameraDeviceState,
  type CameraKey,
  type DetailPanelKey,
  type LinkKey,
  type LinkStatusMap,
  type LogEntry,
  type LogLevel,
  type MacroPosition,
  type MotorDeviceState,
  type MotorKey,
  type NodeTone,
  type SensorDeviceState,
  type SensorKey,
  type ViewMode,
} from './dashboardData';
import { mountDashboardScene } from './dashboardScene';

const App = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('virtual');
  const [modelState, setModelState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [detailPanel, setDetailPanel] = useState<DetailPanelKey | null>(null);
  const [sensorValues, setSensorValues] = useState(() => createSensorSnapshot());
  const [axis, setAxis] = useState<AxisPosition>({ x: 0, y: 0, z: 0 });
  const [cylinder, setCylinder] = useState(false);
  const [links, setLinks] = useState<LinkStatusMap>({ sensors: true, motors: true, camera: false });
  const [sensors, setSensors] = useState<SensorDeviceState>({
    temp: true,
    hum: true,
    co2: true,
    light: true,
    ec: true,
    ph: true,
  });
  const [motors, setMotors] = useState<MotorDeviceState>({ x: true, y: true, z: true, cyl: true });
  const [cameras, setCameras] = useState<CameraDeviceState>({ cam1: false });
  const [logs, setLogs] = useState<LogEntry[]>([
    { time: getTimestamp(), module: '云融核心', message: '云融孪生控制台启动完成。', type: 'success' },
    { time: getTimestamp(), module: '模式切换', message: '当前处于虚拟仿真模式。', type: 'warn' },
  ]);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const axisRef = useRef(axis);
  const cylinderRef = useRef(cylinder);
  axisRef.current = axis;
  cylinderRef.current = cylinder;

  const addLog = (module: string, message: string, type: LogLevel = 'info') => {
    setLogs((prev) => [...prev.slice(-(MAX_LOGS - 1)), { time: getTimestamp(), module, message, type }]);
  };

  useEffect(() => {
    const timer = window.setInterval(() => setSensorValues(createSensorSnapshot()), 2000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mountRef.current) {
      return;
    }
    return mountDashboardScene({
      mount: mountRef.current,
      axisRef,
      cylinderRef,
      onModelState: setModelState,
    });
  }, []);

  const canX = links.motors && motors.x;
  const canY = links.motors && motors.y;
  const canZ = links.motors && motors.z;
  const canCylinder = links.motors && motors.cyl;
  const cameraOnline = links.camera && cameras.cam1;

  const hostTone: NodeTone = viewMode === 'virtual' ? 'virtual' : 'online';
  const linkLabelMap: Record<LinkKey, string> = {
    sensors: '传感器总线',
    motors: '伺服/气动总线',
    camera: '视觉相机总线',
  };
  const macroLabelMap: Record<Exclude<MacroPosition, 'home'>, string> = {
    bottom: '底层巡检',
    middle: '中层巡检',
    top: '顶层巡检',
  };
  const busTone = {
    sensors: links.sensors ? hostTone : 'offline',
    motors: links.motors ? hostTone : 'offline',
    camera: links.camera ? hostTone : 'offline',
  } as const;

  const toggleMode = (mode: ViewMode) => {
    if (mode === viewMode) {
      return;
    }
    setViewMode(mode);
    setDetailPanel(null);
    addLog(
      mode === 'virtual' ? '模式切换' : '网络层',
      mode === 'virtual' ? '已切换至虚拟仿真模式，可编辑拓扑连线。' : '已切换至远程监控模式，正在等待 PLC 链路握手。',
      mode === 'virtual' ? 'warn' : 'success',
    );
  };

  const toggleLink = (key: LinkKey) => {
    if (viewMode !== 'virtual') {
      return;
    }
    setLinks((prev) => {
      const next = !prev[key];
      addLog('网络拓扑', `${next ? '已接通' : '已断开'}${linkLabelMap[key]}。`, next ? 'info' : 'error');
      return { ...prev, [key]: next };
    });
  };

  const toggleDevice = (panel: DetailPanelKey, id: string) => {
    if (viewMode !== 'virtual') {
      return;
    }

    if (panel === 'sensors') {
      setSensors((prev) => ({ ...prev, [id as SensorKey]: !prev[id as SensorKey] }));
    } else if (panel === 'motors') {
      setMotors((prev) => ({ ...prev, [id as MotorKey]: !prev[id as MotorKey] }));
    } else {
      setCameras((prev) => ({ ...prev, [id as CameraKey]: !prev[id as CameraKey] }));
    }

    addLog('设备管理', `已切换设备 [${id.toUpperCase()}] 的连接状态。`, 'info');
  };

  const moveAxis = (key: AxisKey, value: number) => {
    if ((key === 'x' && !canX) || (key === 'y' && !canY) || (key === 'z' && !canZ)) {
      return;
    }
    setAxis((prev) => ({ ...prev, [key]: value }));
  };

  const moveMacro = (target: MacroPosition) => {
    if (!canX || !canY) {
      addLog('运动控制', '宏指令执行失败，存在离线轴未满足联动条件。', 'error');
      return;
    }

    if (target === 'home') {
      setAxis({ x: 0, y: 0, z: 0 });
      setCylinder(false);
      addLog('运动控制', '执行一键回零流程。', 'warn');
      return;
    }

    const y = target === 'bottom' ? 25 : target === 'middle' ? 75 : 130;
    setAxis((prev) => ({ ...prev, x: 0, y }));
    addLog('运动控制', `执行预设动作：${macroLabelMap[target as Exclude<MacroPosition, 'home'>]}。`, 'info');
  };

  const syncClass =
    viewMode === 'virtual'
      ? 'border-amber-500/30 bg-amber-500/12 text-amber-200'
      : 'border-emerald-500/30 bg-emerald-500/12 text-emerald-200';

  const modelClass =
    modelState === 'loading'
      ? 'border-cyan-500/30 bg-cyan-500/10 text-cyan-200'
      : modelState === 'ready'
        ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200'
        : 'border-rose-500/30 bg-rose-500/10 text-rose-200';

  const getDeviceOnline = (panel: DetailPanelKey, id: string) => {
    if (panel === 'sensors') {
      return links.sensors && sensors[id as SensorKey];
    }
    if (panel === 'motors') {
      return links.motors && motors[id as MotorKey];
    }
    return links.camera && cameras[id as CameraKey];
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#06101b] text-slate-200">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(34,211,238,0.16),_transparent_34%),radial-gradient(circle_at_bottom_right,_rgba(34,197,94,0.12),_transparent_24%),linear-gradient(180deg,_#081221_0%,_#050b14_100%)]" />

      <header className="relative z-10 flex items-center justify-between border-b border-slate-800/80 bg-slate-950/72 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex items-center gap-4">
          <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-2.5">
            <Network className="h-6 w-6 text-cyan-300" />
          </div>
          <div>
            <h1 className="bg-gradient-to-r from-cyan-300 via-sky-200 to-blue-400 bg-clip-text text-lg font-bold tracking-[0.28em] text-transparent md:text-2xl">
              云融孪生控制系统
            </h1>
            <p className="mt-1 text-xs text-slate-400 md:text-sm">需求 2.0 页面方案，装配模型已替换接入</p>
          </div>
        </div>

        <div className="flex gap-3 rounded-xl border border-slate-700 bg-slate-900/88 p-1.5 shadow-inner">
          <button
            onClick={() => toggleMode('virtual')}
            className={classNames('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors', viewMode === 'virtual' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}
          >
            <Monitor className="h-4 w-4" />
            虚拟仿真模式
          </button>
          <button
            onClick={() => toggleMode('remote')}
            className={classNames('flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors', viewMode === 'remote' ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white')}
          >
            <Radar className="h-4 w-4" />
            远程监控模式
          </button>
        </div>
      </header>

      <main className="relative z-10 h-[calc(100vh-4rem)] p-3 md:p-4">
        <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[19rem_minmax(0,1fr)_21rem]">
          <section className="flex min-h-[24rem] flex-col gap-3 xl:min-h-0">
            <div className="glass-panel flex min-h-0 flex-[0_0_45%] flex-col">
              <Header title="综合微环境监测阵列" icon={<Thermometer className="h-4 w-4 text-cyan-300" />} />
              <div className="grid flex-1 grid-cols-2 gap-2 overflow-y-auto p-3 custom-scrollbar">
                {SENSOR_CONFIG.map((item) => {
                  const online = links.sensors && sensors[item.id];
                  return (
                    <div key={item.id} className="rounded-xl border border-slate-700 bg-slate-900/82 p-3">
                      <div className="mb-2 flex items-start justify-between">
                        <div className="text-xs text-slate-400">{item.label}</div>
                        <div className="rounded-lg border border-slate-700 bg-slate-950/90 p-1.5">
                          <item.Icon className={classNames('h-3.5 w-3.5', online ? item.accentClass : 'text-slate-500')} />
                        </div>
                      </div>
                      <div className={classNames('lcd-text text-2xl font-semibold', online ? item.accentClass : 'text-slate-500')}>
                        {online ? formatSensorValue(sensorValues[item.id], item.precision) : '--'}
                        <span className="ml-1 text-xs text-slate-500">{item.unit}</span>
                      </div>
                      <div className="mt-3 h-1.5 rounded-full bg-slate-800">
                        <div
                          className={classNames('h-full rounded-full transition-[width] duration-500', online ? item.barClass : 'bg-slate-600')}
                          style={{ width: `${online ? Math.round(mapRange(sensorValues[item.id], item.min, item.max, 16, 100)) : 12}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="glass-panel flex min-h-0 flex-[0_0_55%] flex-col">
              <Header
                title="执行机构运动监控"
                icon={<SlidersHorizontal className="h-4 w-4 text-emerald-300" />}
                accent="border-l-emerald-500"
                extra={<div className="text-[10px] text-slate-400">使能 / 仿真 / 离线</div>}
              />
              <div className="custom-scrollbar flex flex-1 flex-col gap-2 overflow-y-auto p-3">
                <div className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800/80 bg-slate-950/65 p-2">
                  {(['x', 'y', 'z'] as AxisKey[]).map((key) => (
                    <div key={key} className="rounded-lg border border-slate-800 bg-slate-950/90 p-2 text-center">
                      <div className="text-[10px] text-slate-500">{key.toUpperCase()}</div>
                      <div className={classNames('mt-1 font-mono text-sm font-semibold', key === 'x' ? 'text-rose-300' : key === 'y' ? 'text-emerald-300' : 'text-cyan-300')}>
                        {axis[key].toFixed(1)} mm
                      </div>
                    </div>
                  ))}
                </div>

                {(['x', 'y', 'z'] as AxisKey[]).map((key) => (
                  <div key={key} className="rounded-xl border border-slate-700 bg-slate-900/82 p-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className={classNames('text-xs font-semibold', key === 'x' ? 'text-rose-300' : key === 'y' ? 'text-emerald-300' : 'text-cyan-300')}>
                        {key.toUpperCase()} 轴
                      </span>
                      <span className="lcd-text rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200">
                        {axis[key].toFixed(1)} mm
                      </span>
                    </div>
                    <input
                      type="range"
                      min={AXIS_RANGE[key].min}
                      max={AXIS_RANGE[key].max}
                      step={1}
                      value={axis[key]}
                      disabled={(key === 'x' && !canX) || (key === 'y' && !canY) || (key === 'z' && !canZ)}
                      onChange={(event) => moveAxis(key, Number(event.target.value))}
                      className="w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-45"
                    />
                  </div>
                ))}

                <div className="rounded-xl border border-slate-700 bg-slate-900/80 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <span className="text-xs font-semibold text-yellow-300">推料气缸控制</span>
                    <span className="lcd-text rounded-md border border-slate-700 bg-slate-950 px-2 py-1 text-[11px] text-slate-200">
                      {cylinder ? '伸出' : '缩回'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      disabled={!canCylinder}
                      onClick={() => (canCylinder ? setCylinder(false) : addLog('运动控制', '推料气缸当前离线，无法执行缩回。', 'error'))}
                      className={classNames('rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-45', !cylinder ? 'border-yellow-400/70 bg-yellow-500 text-slate-950' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700')}
                    >
                      缩回
                    </button>
                    <button
                      disabled={!canCylinder}
                      onClick={() => (canCylinder ? setCylinder(true) : addLog('运动控制', '推料气缸当前离线，无法执行伸出。', 'error'))}
                      className={classNames('rounded-lg border px-3 py-2 text-xs font-semibold transition-colors disabled:opacity-45', cylinder ? 'border-yellow-400/70 bg-yellow-500 text-slate-950' : 'border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700')}
                    >
                      伸出
                    </button>
                  </div>
                </div>

                <div className="mt-auto border-t border-slate-800 pt-3">
                  <div className="grid grid-cols-3 gap-2">
                    {(['bottom', 'middle', 'top'] as const).map((preset) => (
                      <button
                        key={preset}
                        disabled={!canX || !canY}
                        onClick={() => moveMacro(preset)}
                        className="rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-2 text-xs font-semibold text-slate-200 transition-colors hover:bg-emerald-700/45 disabled:opacity-45"
                      >
                        {macroLabelMap[preset]}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => moveMacro('home')}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-blue-500/25 bg-slate-900/75 px-3 py-2 text-xs font-semibold text-blue-300 transition-colors hover:bg-slate-800"
                  >
                    <House className="h-4 w-4" />
                    一键回零
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-panel relative min-h-[30rem] overflow-hidden xl:min-h-0">
            <div className="absolute left-3 top-3 z-10 flex flex-wrap items-center gap-2">
              <span className="rounded-lg border border-slate-700 bg-slate-950/80 px-3 py-1.5 text-xs font-semibold text-sky-200">云融三维引擎工作区</span>
              <span className={classNames('rounded-lg border px-3 py-1.5 text-xs font-semibold', syncClass)}>
                {viewMode === 'virtual' ? (
                  <span className="inline-flex items-center gap-1"><Unplug className="h-3.5 w-3.5" />虚拟仿真链路</span>
                ) : (
                  <span className="inline-flex items-center gap-1"><Link2 className="h-3.5 w-3.5" />PLC 远程联机</span>
                )}
              </span>
            </div>
            <div className="absolute right-3 top-3 z-10">
              <span className={classNames('rounded-lg border px-3 py-1.5 text-xs font-semibold', modelClass)}>
                {modelState === 'loading' ? '模型加载中' : modelState === 'ready' ? '模型已就绪' : '模型加载失败'}
              </span>
            </div>
            <div ref={mountRef} className="h-full w-full bg-[radial-gradient(circle_at_center,_rgba(30,41,59,0.82),_rgba(8,15,26,0.98)_70%)]" />
            <div className="pointer-events-none absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full border border-slate-700 bg-slate-950/65 px-4 py-1.5 text-xs text-slate-300">
              左键旋转 | 右键平移 | 滚轮缩放
            </div>
            <div className="pointer-events-none absolute bottom-3 right-3 rounded-xl border border-slate-800 bg-slate-950/55 px-3 py-2 text-[11px] text-slate-400">
              docs/模型/ImageToStl.com_装配.gltf
            </div>
          </section>

          <section className="flex min-h-[28rem] flex-col gap-3 xl:min-h-0">
            <div className="glass-panel relative flex min-h-0 flex-[0_0_55%] flex-col">
              <Header
                title="工业控制网络拓扑"
                icon={<Cpu className="h-4 w-4 text-fuchsia-300" />}
                accent="border-l-fuchsia-500"
                extra={viewMode === 'virtual' ? <span className="rounded-full border border-amber-500/35 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200 animate-pulse">点击连线断开 / 重连</span> : null}
              />
              <div className="relative flex-1 overflow-hidden bg-slate-900/45 p-3">
                {detailPanel ? (
                  <div className="absolute inset-2 z-20 flex flex-col rounded-xl border border-slate-600 bg-slate-950/95 p-3 shadow-2xl">
                    <div className="mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
                      <div className="flex items-center gap-2 text-sm font-semibold text-sky-200"><Terminal className="h-4 w-4" />{DETAIL_PANEL_DATA[detailPanel].title}</div>
                      <button onClick={() => setDetailPanel(null)} className="rounded-md border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">关闭</button>
                    </div>
                    <div className="custom-scrollbar flex-1 space-y-2 overflow-y-auto pr-1">
                      {DETAIL_PANEL_DATA[detailPanel].items.map((item) => {
                        const online = getDeviceOnline(detailPanel, item.id);
                        return (
                          <div key={item.id} className="grid grid-cols-[auto,1fr,auto] items-center gap-3 rounded-lg border border-slate-800 bg-slate-900/85 px-3 py-2">
                            <div className="rounded-lg border border-slate-700 bg-slate-950/80 p-2"><item.Icon className="h-4 w-4 text-slate-300" /></div>
                            <div>
                              <div className="text-sm font-semibold text-slate-100">{item.name}</div>
                              <div className="mt-1 text-[11px] text-slate-500">{item.address}</div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <div className={classNames('inline-flex items-center gap-1 text-[11px]', online ? 'text-emerald-300' : 'text-rose-300')}>
                                {online ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                                {online ? (viewMode === 'virtual' ? '连接中(仿真)' : '在线') : '离线'}
                              </div>
                              {viewMode === 'virtual' && links[detailPanel] ? (
                                <button onClick={() => toggleDevice(detailPanel, item.id)} className={classNames('rounded-md border px-2 py-1 text-[10px] font-semibold', online ? 'border-rose-500/30 bg-rose-500/10 text-rose-200' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200')}>
                                  {online ? '断开' : '连接'}
                                </button>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : null}

                <div className={classNames('relative flex h-full flex-col items-center justify-start py-2', viewMode === 'virtual' && 'virtual-edit-mode')}>
                  <Node label="云融上位机" sub="HMI / 数据中枢" tone={hostTone} icon={<Monitor className="h-6 w-6 text-cyan-300" />} />
                  <div className="h-3 w-[2px] bg-sky-400/70" />
                  <Node label="S7-1200 主站" sub="运动主控 PLC" tone={hostTone} icon={<Cpu className="h-7 w-7 text-emerald-300" />} />
                  <div className="h-4 w-[2px] bg-sky-400/70" />
                  <div className="relative h-5 w-[85%]">
                    <div className="absolute inset-x-0 top-0 h-[2px] bg-sky-400/70" />
                    {(['sensors', 'motors', 'camera'] as LinkKey[]).map((key, index) => (
                      <button
                        key={key}
                        onClick={() => toggleLink(key)}
                        className={classNames(
                          'topo-link-branch absolute top-0 h-5 w-[4px] rounded-full',
                          index === 0 ? 'left-0' : index === 1 ? 'left-1/2 -translate-x-1/2' : 'right-0',
                          links[key]
                            ? 'bg-sky-400 shadow-[0_0_8px_rgba(56,189,248,0.7)]'
                            : "bg-rose-400/90 before:absolute before:inset-y-0 before:left-1/2 before:w-px before:-translate-x-1/2 before:border-l before:border-dashed before:border-rose-100/80 before:content-['']",
                        )}
                      />
                    ))}
                  </div>
                  <div className="mt-4 flex w-full justify-between gap-2 px-1">
                    <Leaf label="传感总线" tone={busTone.sensors} icon={<Thermometer className="h-5 w-5 text-yellow-300" />} onClick={() => setDetailPanel('sensors')} />
                    <Leaf label="伺服/气动" tone={busTone.motors} icon={<SlidersHorizontal className="h-5 w-5 text-rose-300" />} onClick={() => setDetailPanel('motors')} />
                    <Leaf label="视觉相机" tone={busTone.camera} icon={<Camera className="h-5 w-5 text-fuchsia-300" />} onClick={() => setDetailPanel('camera')} />
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-panel flex min-h-0 flex-[0_0_45%] flex-col">
              <Header title="诊断日志与视觉" icon={<Terminal className="h-4 w-4 text-yellow-300" />} accent="border-l-yellow-500" />
              <div className="flex min-h-0 flex-1 flex-col gap-2 p-3">
                <div className="relative h-32 overflow-hidden rounded-xl border border-slate-700 bg-black shadow-inner">
                  <div className={classNames('absolute left-2 top-2 z-10 rounded px-2 py-1 text-[10px] font-semibold text-white', cameraOnline ? 'bg-emerald-600' : 'animate-pulse bg-rose-600')}>
                    {cameraOnline ? 'CAM 01 在线' : 'CAM 01 离线'}
                  </div>
                  {cameraOnline ? (
                    <>
                      <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_25%,rgba(34,197,94,0.22),transparent_28%),linear-gradient(180deg,rgba(6,78,59,0.22),rgba(2,6,23,0.94)_78%)]" />
                      <div className="absolute inset-x-4 bottom-4 top-10 rounded-[1.5rem] border border-emerald-300/20 bg-emerald-400/8" />
                      <div className="camera-scan-line absolute inset-x-0 top-0 h-14 bg-gradient-to-b from-transparent via-cyan-300/18 to-transparent" />
                    </>
                  ) : (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-500">
                      <Camera className="h-8 w-8" />
                      <span className="text-xs">无视频流信号</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[{ label: '模式', value: viewMode === 'virtual' ? '仿真' : '远控', tone: viewMode === 'virtual' ? 'virtual' : 'online' }, { label: '总线', value: `${Object.values(links).filter(Boolean).length}/3`, tone: links.camera ? 'online' : 'virtual' }, { label: '相机', value: cameraOnline ? '在线' : '离线', tone: cameraOnline ? 'online' : 'offline' }].map((item) => (
                    <div key={item.label} className={classNames('rounded-xl border px-3 py-2', NODE_TONE_META[item.tone as NodeTone].panel)}>
                      <div className="text-[10px] text-slate-500">{item.label}</div>
                      <div className={classNames('mt-1 text-sm font-semibold', NODE_TONE_META[item.tone as NodeTone].text)}>{item.value}</div>
                    </div>
                  ))}
                </div>

                <div className="custom-scrollbar min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/80 p-3 font-mono text-[11px]">
                  {logs.map((log, index) => (
                    <div key={`${log.time}-${index}`} className="border-b border-slate-900/80 pb-2 pt-2 first:pt-0 last:border-none">
                      <div className="flex items-center gap-2 text-slate-500">
                        <span>[{log.time}]</span>
                        <span className="text-sky-400">[{log.module}]</span>
                      </div>
                      <div className={classNames('mt-1 leading-5', log.type === 'success' ? 'text-emerald-300' : log.type === 'warn' ? 'text-amber-300' : log.type === 'error' ? 'text-rose-300' : 'text-slate-300')}>
                        {log.message}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      <style
        dangerouslySetInnerHTML={{
          __html: `.glass-panel{display:flex;border-radius:1rem;border:1px solid rgba(51,65,85,.82);background:linear-gradient(180deg,rgba(15,23,42,.86),rgba(2,6,23,.78)),radial-gradient(circle at top,rgba(56,189,248,.08),transparent 35%);box-shadow:inset 0 1px 0 rgba(255,255,255,.03),0 24px 60px rgba(0,0,0,.28);backdrop-filter:blur(18px)}.custom-scrollbar::-webkit-scrollbar{width:6px}.custom-scrollbar::-webkit-scrollbar-thumb{background:#334155;border-radius:999px}.lcd-text{font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace;letter-spacing:.08em}.camera-scan-line{animation:cameraSweep 2.2s linear infinite}.virtual-edit-mode .topo-link-branch:hover{filter:brightness(1.45) drop-shadow(0 0 4px rgba(255,255,255,.65));transform:translateY(-1px)}input[type=range]{-webkit-appearance:none;appearance:none;background:transparent}input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:999px;background:linear-gradient(90deg,rgba(51,65,85,.95),rgba(71,85,105,.95))}input[type=range]::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;margin-top:-5px;height:16px;width:16px;border-radius:999px;border:2px solid rgba(8,15,26,.95);background:linear-gradient(180deg,#7dd3fc,#38bdf8);box-shadow:0 0 0 4px rgba(56,189,248,.16)}@keyframes cameraSweep{0%{transform:translateY(-120%)}100%{transform:translateY(220%)}}`,
        }}
      />
    </div>
  );
};

const Header = ({ title, icon, accent = 'border-l-cyan-500', extra }: { title: string; icon: ReactNode; accent?: string; extra?: ReactNode }) => (
  <div className={classNames('flex items-center justify-between gap-3 border-b border-slate-800/80 bg-gradient-to-r from-slate-900/95 to-slate-900/10 px-4 py-3 border-l-4', accent)}>
    <div className="flex items-center gap-2">
      {icon}
      <span className="text-sm font-semibold tracking-[0.12em] text-slate-100">{title}</span>
    </div>
    {extra}
  </div>
);

const Node = ({ label, sub, tone, icon }: { label: string; sub: string; tone: NodeTone; icon: ReactNode }) => (
  <div className={classNames('relative flex w-[7.6rem] flex-col items-center rounded-xl border p-3 text-center shadow-lg', NODE_TONE_META[tone].panel)}>
    <span className={classNames('absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full', NODE_TONE_META[tone].dot)} />
    <div className="mb-2">{icon}</div>
    <div className="text-xs font-semibold text-slate-100">{label}</div>
    <div className="mt-1 text-[10px] text-slate-400">{sub}</div>
  </div>
);

const Leaf = ({ label, tone, icon, onClick }: { label: string; tone: NodeTone; icon: ReactNode; onClick: () => void }) => (
  <button onClick={onClick} className={classNames('relative flex w-[6.5rem] scale-[0.92] flex-col items-center rounded-xl border px-2 py-3 text-center shadow-lg transition-transform hover:-translate-y-0.5', NODE_TONE_META[tone].panel)}>
    <span className={classNames('absolute -right-1.5 -top-1.5 h-3 w-3 rounded-full', NODE_TONE_META[tone].dot)} />
    <div className="mb-2">{icon}</div>
    <div className="text-[11px] font-semibold text-slate-100">{label}</div>
    <div className="mt-1 text-[9px] text-slate-400">查看 / 编辑</div>
  </button>
);

export default App;
