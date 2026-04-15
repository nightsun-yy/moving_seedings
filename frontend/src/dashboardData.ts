import {
  Camera,
  Cloud,
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
export type MotorKey = 'x' | 'y' | 'cyl';
export type CameraKey = 'cam1';
export type DetailPanelKey = LinkKey;
export type TrayId = `${1 | 2 | 3}-${1 | 2 | 3}`;

export type AxisPosition = {
  x: number;
  y: number;
};

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

export type TrayOption = {
  id: TrayId;
  row: 1 | 2 | 3;
  col: 1 | 2 | 3;
  label: string;
};

export type TrayCoords = {
  x: number;
  yBase: number;
  yLift: number;
  rack3DX: number;
  rack3DY: number;
};

export const MAX_LOGS = 24;
export const DEFAULT_TRAY_ID: TrayId = '3-2';

export const AXIS_RANGE = {
  x: { min: -120, max: 70 },
  y: { min: 12, max: 105 },
} as const;

export const WATER_STATION_COORDS = { x: -100, yBase: 14, yLift: 20 } as const;

export const TRAY_OPTIONS: TrayOption[] = [
  { id: '3-1', row: 3, col: 1, label: '3层-1列' },
  { id: '3-2', row: 3, col: 2, label: '3层-2列' },
  { id: '3-3', row: 3, col: 3, label: '3层-3列' },
  { id: '2-1', row: 2, col: 1, label: '2层-1列' },
  { id: '2-2', row: 2, col: 2, label: '2层-2列' },
  { id: '2-3', row: 2, col: 3, label: '2层-3列' },
  { id: '1-1', row: 1, col: 1, label: '1层-1列' },
  { id: '1-2', row: 1, col: 2, label: '1层-2列' },
  { id: '1-3', row: 1, col: 3, label: '1层-3列' },
];

export const SENSOR_CONFIG: SensorConfig[] = [
  {
    id: 'temp',
    label: '栽培区温度',
    unit: '℃',
    accentClass: 'text-orange-400',
    barClass: 'bg-orange-500',
    base: 24.5,
    variance: 1.1,
    min: 18,
    max: 35,
    precision: 1,
    Icon: Thermometer,
  },
  {
    id: 'hum',
    label: '环境湿度',
    unit: '%',
    accentClass: 'text-cyan-400',
    barClass: 'bg-cyan-500',
    base: 65.2,
    variance: 2.8,
    min: 30,
    max: 95,
    precision: 1,
    Icon: Droplets,
  },
  {
    id: 'co2',
    label: '二氧化碳浓度',
    unit: 'ppm',
    accentClass: 'text-slate-200',
    barClass: 'bg-slate-400',
    base: 455,
    variance: 16,
    min: 300,
    max: 900,
    precision: 0,
    Icon: Cloud,
  },
  {
    id: 'light',
    label: 'LED 光照强度',
    unit: 'Lx',
    accentClass: 'text-yellow-400',
    barClass: 'bg-yellow-500',
    base: 1210,
    variance: 24,
    min: 0,
    max: 1800,
    precision: 0,
    Icon: SunMedium,
  },
  {
    id: 'ec',
    label: '营养液 EC值',
    unit: 'mS',
    accentClass: 'text-purple-400',
    barClass: 'bg-purple-500',
    base: 1.82,
    variance: 0.08,
    min: 0.8,
    max: 2.8,
    precision: 2,
    Icon: FlaskConical,
  },
  {
    id: 'ph',
    label: '基质 pH值',
    unit: 'pH',
    accentClass: 'text-green-400',
    barClass: 'bg-green-500',
    base: 6.18,
    variance: 0.08,
    min: 4.5,
    max: 7.5,
    precision: 2,
    Icon: Leaf,
  },
];

export const DETAIL_PANEL_DATA: Record<DetailPanelKey, { title: string; items: DetailItem[] }> = {
  sensors: {
    title: '传感器明细',
    items: [
      { id: 'temp', name: '温度', address: '40001', Icon: Thermometer },
      { id: 'hum', name: '湿度', address: '40002', Icon: Droplets },
      { id: 'co2', name: 'CO2', address: '40003', Icon: Cloud },
      { id: 'light', name: '光照', address: '40004', Icon: SunMedium },
      { id: 'ec', name: 'EC', address: '40005', Icon: FlaskConical },
      { id: 'ph', name: 'pH', address: '40006', Icon: Leaf },
    ],
  },
  motors: {
    title: '伺服网明细',
    items: [
      { id: 'x', name: 'X轴', address: 'ID:1', Icon: MoveHorizontal },
      { id: 'y', name: 'Y轴', address: 'ID:2', Icon: MoveVertical },
      { id: 'cyl', name: '执行气缸', address: 'Q0.0', Icon: Zap },
    ],
  },
  camera: {
    title: '相机明细',
    items: [{ id: 'cam1', name: 'CAM-01', address: 'IP:192.168.1.100', Icon: Camera }],
  },
};

export const SENSOR_BAR_WIDTHS: Record<SensorKey, string> = {
  temp: '60%',
  hum: '75%',
  co2: '40%',
  light: '80%',
  ec: '55%',
  ph: '65%',
};

export const formatTrayTarget = (trayId: TrayId) => {
  const [row, col] = trayId.split('-');
  return `${row}层-${col}列`;
};

export const getTrayCoords = (trayId: TrayId): TrayCoords => {
  const [row, col] = trayId.split('-').map(Number) as [1 | 2 | 3, 1 | 2 | 3];
  const uiYBases = [14, 54, 94];
  const uiXs = [-50, 0, 50];
  const rack3DXs = [-15, 0, 15];
  const rack3DYs = [4.5, 16.5, 28.5];

  return {
    x: uiXs[col - 1],
    yBase: uiYBases[row - 1],
    yLift: uiYBases[row - 1] + 6,
    rack3DX: rack3DXs[col - 1],
    rack3DY: rack3DYs[row - 1],
  };
};

export const getTimestamp = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export const createSensorSnapshot = (): SensorSnapshot =>
  SENSOR_CONFIG.reduce((snapshot, config) => {
    const random = config.base + (Math.random() - 0.5) * config.variance * 2;
    const clamped = clamp(random, config.min, config.max);
    snapshot[config.id] = Number(clamped.toFixed(config.precision));
    return snapshot;
  }, {} as SensorSnapshot);

export const formatSensorValue = (value: number, precision: number) =>
  precision === 0 ? Math.round(value).toString() : value.toFixed(precision);
