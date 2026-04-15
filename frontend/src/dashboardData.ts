import {
  Camera,
  Cloud,
  Disc3,
  Droplets,
  FlaskConical,
  Leaf,
  MoveHorizontal,
  MoveVertical,
  SunMedium,
  Thermometer,
  Zap,
  type LucideIcon,
} from 'lucide-react';

export type ViewMode = 'virtual' | 'remote';
export type LogLevel = 'info' | 'success' | 'warn' | 'error';
export type LinkKey = 'sensors' | 'motors' | 'camera';
export type SensorKey = 'temp' | 'hum' | 'co2' | 'light' | 'ec' | 'ph';
export type MotorKey = 'x' | 'y' | 'z' | 'cyl';
export type CameraKey = 'cam1';
export type AxisKey = 'x' | 'y' | 'z';
export type MacroPosition = 'bottom' | 'middle' | 'top' | 'home';
export type DetailPanelKey = LinkKey;
export type NodeTone = 'online' | 'virtual' | 'offline';

export type LogEntry = {
  time: string;
  module: string;
  message: string;
  type: LogLevel;
};

export type SensorConfig = {
  id: SensorKey;
  label: string;
  unit: string;
  accentClass: string;
  barClass: string;
  base: number;
  variance: number;
  min: number;
  max: number;
  precision: number;
  Icon: LucideIcon;
};

export type SensorSnapshot = Record<SensorKey, number>;
export type AxisPosition = Record<AxisKey, number>;
export type LinkStatusMap = Record<LinkKey, boolean>;
export type SensorDeviceState = Record<SensorKey, boolean>;
export type MotorDeviceState = Record<MotorKey, boolean>;
export type CameraDeviceState = Record<CameraKey, boolean>;

export type DetailItem = {
  id: string;
  name: string;
  address: string;
  Icon: LucideIcon;
};

export const MODEL_URL = '/models/assembly-layout.gltf';
export const MAX_LOGS = 14;
export const MODEL_FALLBACK_PALETTE = [0x38bdf8, 0x22c55e, 0xf59e0b, 0x14b8a6, 0x64748b, 0xf97316];

export const AXIS_RANGE = {
  x: { min: -100, max: 100 },
  y: { min: 0, max: 150 },
  z: { min: 0, max: 120 },
} as const;

export const SENSOR_CONFIG: SensorConfig[] = [
  { id: 'temp', label: '栽培区温度', unit: '℃', accentClass: 'text-orange-300', barClass: 'bg-orange-500', base: 24.8, variance: 0.9, min: 18, max: 35, precision: 1, Icon: Thermometer },
  { id: 'hum', label: '环境湿度', unit: '%', accentClass: 'text-cyan-300', barClass: 'bg-cyan-500', base: 65, variance: 3, min: 30, max: 95, precision: 1, Icon: Droplets },
  { id: 'co2', label: '二氧化碳浓度', unit: 'ppm', accentClass: 'text-slate-200', barClass: 'bg-slate-400', base: 455, variance: 18, min: 300, max: 900, precision: 0, Icon: Cloud },
  { id: 'light', label: 'LED 光照强度', unit: 'Lx', accentClass: 'text-yellow-300', barClass: 'bg-yellow-500', base: 1210, variance: 32, min: 0, max: 1800, precision: 0, Icon: SunMedium },
  { id: 'ec', label: '营养液 EC 值', unit: 'mS', accentClass: 'text-fuchsia-300', barClass: 'bg-fuchsia-500', base: 1.82, variance: 0.08, min: 0.8, max: 2.8, precision: 2, Icon: FlaskConical },
  { id: 'ph', label: '基质 pH 值', unit: 'pH', accentClass: 'text-emerald-300', barClass: 'bg-emerald-500', base: 6.18, variance: 0.1, min: 4.5, max: 7.5, precision: 2, Icon: Leaf },
];

export const DETAIL_PANEL_DATA: Record<DetailPanelKey, { title: string; items: DetailItem[] }> = {
  sensors: {
    title: '传感器总线明细',
    items: [
      { id: 'temp', name: '综合温度传感器', address: 'Modbus 40001', Icon: Thermometer },
      { id: 'hum', name: '综合湿度传感器', address: 'Modbus 40002', Icon: Droplets },
      { id: 'co2', name: 'CO2 浓度变送器', address: 'Modbus 40003', Icon: Cloud },
      { id: 'light', name: 'LED 光照传感器', address: 'Modbus 40004', Icon: SunMedium },
      { id: 'ec', name: '营养液 EC 传感器', address: 'Modbus 40005', Icon: FlaskConical },
      { id: 'ph', name: '基质 pH 传感器', address: 'Modbus 40006', Icon: Leaf },
    ],
  },
  motors: {
    title: '伺服与执行机构明细',
    items: [
      { id: 'x', name: 'X 轴水平步进驱动器', address: 'EtherCAT ID: 1', Icon: MoveHorizontal },
      { id: 'y', name: 'Y 轴垂直伺服驱动器', address: 'EtherCAT ID: 2', Icon: MoveVertical },
      { id: 'z', name: 'Z 轴伸缩执行机构', address: 'EtherCAT ID: 3', Icon: Disc3 },
      { id: 'cyl', name: '推料气缸控制电磁阀', address: 'DO: Q0.0', Icon: Zap },
    ],
  },
  camera: {
    title: '视觉相机网络明细',
    items: [{ id: 'cam1', name: 'CAM-01 多光谱主相机', address: 'IP: 192.168.1.100', Icon: Camera }],
  },
};

export const NODE_TONE_META: Record<
  NodeTone,
  { label: string; dot: string; panel: string; badge: string; text: string }
> = {
  online: {
    label: '在线',
    dot: 'bg-emerald-400 shadow-[0_0_12px_rgba(74,222,128,0.85)]',
    panel: 'border-emerald-500/35 bg-emerald-500/10',
    badge: 'border-emerald-500/35 bg-emerald-500/12 text-emerald-200',
    text: 'text-emerald-200',
  },
  virtual: {
    label: '仿真',
    dot: 'bg-amber-400 shadow-[0_0_12px_rgba(250,204,21,0.78)]',
    panel: 'border-amber-500/30 bg-amber-500/10',
    badge: 'border-amber-500/35 bg-amber-500/12 text-amber-200',
    text: 'text-amber-200',
  },
  offline: {
    label: '离线',
    dot: 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]',
    panel: 'border-rose-500/30 bg-rose-500/10',
    badge: 'border-rose-500/35 bg-rose-500/12 text-rose-200',
    text: 'text-rose-200',
  },
};

export const getTimestamp = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const mapRange = (value: number, inputMin: number, inputMax: number, outputMin: number, outputMax: number) => {
  if (inputMax === inputMin) {
    return outputMin;
  }

  const ratio = (clamp(value, inputMin, inputMax) - inputMin) / (inputMax - inputMin);
  return outputMin + (outputMax - outputMin) * ratio;
};

export const createSensorSnapshot = (): SensorSnapshot =>
  SENSOR_CONFIG.reduce((snapshot, config) => {
    const random = config.base + (Math.random() - 0.5) * config.variance * 2;
    snapshot[config.id] = Number(random.toFixed(config.precision));
    return snapshot;
  }, {} as SensorSnapshot);

export const formatSensorValue = (value: number, precision: number) =>
  precision === 0 ? Math.round(value).toString() : value.toFixed(precision);
