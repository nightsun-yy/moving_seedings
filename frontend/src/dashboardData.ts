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
export type TrayId = '1-1' | '1-2' | '1-3' | '2-1' | '2-2' | '2-3' | '3-1' | '3-2' | '3-3';
export type TrayRow = 1 | 2 | 3;
export type TrayCol = 1 | 2 | 3;

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
  row: TrayRow;
  col: TrayCol;
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

export const DISPLAY_AXIS_RANGE = {
  x: { left: 0, right: 588 },
  y: { bottom: 0, top: 348 },
} as const;

export const HOME_AXIS_POSITION: AxisPosition = {
  x: AXIS_RANGE.x.min,
  y: AXIS_RANGE.y.min,
};

export const WATER_STATION_COORDS = { x: -100, yBase: 14, yLift: 20 } as const;

type CalibrationPoint = {
  input: number;
  output: number;
};

type TrayCalibration = TrayOption & TrayCoords & { displayX: number; displayY: number };

const TRAY_CALIBRATION: Record<TrayId, TrayCalibration> = {
  '1-1': {
    id: '1-1',
    row: 1,
    col: 1,
    label: '1层-1列',
    displayX: 195,
    displayY: 0,
    x: -50,
    yBase: 14,
    yLift: 20,
    rack3DX: -15,
    rack3DY: 4.5,
  },
  '1-2': {
    id: '1-2',
    row: 1,
    col: 2,
    label: '1层-2列',
    displayX: 390,
    displayY: 0,
    x: 0,
    yBase: 14,
    yLift: 20,
    rack3DX: 0,
    rack3DY: 4.5,
  },
  '1-3': {
    id: '1-3',
    row: 1,
    col: 3,
    label: '1层-3列',
    displayX: 581.1,
    displayY: 0,
    x: 50,
    yBase: 14,
    yLift: 20,
    rack3DX: 15,
    rack3DY: 4.5,
  },
  '2-1': {
    id: '2-1',
    row: 2,
    col: 1,
    label: '2层-1列',
    displayX: 195,
    displayY: 172.3,
    x: -50,
    yBase: 54,
    yLift: 60,
    rack3DX: -15,
    rack3DY: 16.5,
  },
  '2-2': {
    id: '2-2',
    row: 2,
    col: 2,
    label: '2层-2列',
    displayX: 390,
    displayY: 172.3,
    x: 0,
    yBase: 54,
    yLift: 60,
    rack3DX: 0,
    rack3DY: 16.5,
  },
  '2-3': {
    id: '2-3',
    row: 2,
    col: 3,
    label: '2层-3列',
    displayX: 581.1,
    displayY: 172.3,
    x: 50,
    yBase: 54,
    yLift: 60,
    rack3DX: 15,
    rack3DY: 16.5,
  },
  '3-1': {
    id: '3-1',
    row: 3,
    col: 1,
    label: '3层-1列',
    displayX: 195,
    displayY: 283,
    x: -50,
    yBase: 94,
    yLift: 100,
    rack3DX: -15,
    rack3DY: 28.5,
  },
  '3-2': {
    id: '3-2',
    row: 3,
    col: 2,
    label: '3层-2列',
    displayX: 390,
    displayY: 283,
    x: 0,
    yBase: 94,
    yLift: 100,
    rack3DX: 0,
    rack3DY: 28.5,
  },
  '3-3': {
    id: '3-3',
    row: 3,
    col: 3,
    label: '3层-3列',
    displayX: 581.1,
    displayY: 283,
    x: 50,
    yBase: 94,
    yLift: 100,
    rack3DX: 15,
    rack3DY: 28.5,
  },
};

const INTERNAL_DISPLAY_AXIS_POINTS: Record<'x' | 'y', readonly CalibrationPoint[]> = {
  x: [
    { input: HOME_AXIS_POSITION.x, output: DISPLAY_AXIS_RANGE.x.left },
    { input: TRAY_CALIBRATION['1-1'].x, output: TRAY_CALIBRATION['1-1'].displayX },
    { input: TRAY_CALIBRATION['1-2'].x, output: TRAY_CALIBRATION['1-2'].displayX },
    { input: TRAY_CALIBRATION['1-3'].x, output: TRAY_CALIBRATION['1-3'].displayX },
    { input: AXIS_RANGE.x.max, output: DISPLAY_AXIS_RANGE.x.right },
  ],
  y: [
    { input: HOME_AXIS_POSITION.y, output: DISPLAY_AXIS_RANGE.y.bottom },
    { input: TRAY_CALIBRATION['1-1'].yBase, output: TRAY_CALIBRATION['1-1'].displayY },
    { input: TRAY_CALIBRATION['2-1'].yBase, output: TRAY_CALIBRATION['2-1'].displayY },
    { input: TRAY_CALIBRATION['3-1'].yBase, output: TRAY_CALIBRATION['3-1'].displayY },
    { input: AXIS_RANGE.y.max, output: DISPLAY_AXIS_RANGE.y.top },
  ],
};

const DISPLAY_INTERNAL_AXIS_POINTS: Record<'x' | 'y', readonly CalibrationPoint[]> = {
  x: [...INTERNAL_DISPLAY_AXIS_POINTS.x]
    .map(({ input, output }) => ({ input: output, output: input }))
    .sort((left, right) => left.input - right.input),
  y: [...INTERNAL_DISPLAY_AXIS_POINTS.y]
    .map(({ input, output }) => ({ input: output, output: input }))
    .sort((left, right) => left.input - right.input),
};

const PYTHON_DISPLAY_AXIS_POINTS: Record<'x' | 'y', readonly CalibrationPoint[]> = {
  x: [
    { input: 261, output: 55.7 },
    { input: 4141, output: 195 },
    { input: 8021, output: 390 },
    { input: 11901, output: 581.1 },
  ],
  y: [
    { input: 0, output: 0 },
    { input: 89, output: 0 },
    { input: 3610, output: 172.3 },
    { input: 7131, output: 283 },
  ],
};

export const TRAY_OPTIONS: TrayOption[] = [
  TRAY_CALIBRATION['3-1'],
  TRAY_CALIBRATION['3-2'],
  TRAY_CALIBRATION['3-3'],
  TRAY_CALIBRATION['2-1'],
  TRAY_CALIBRATION['2-2'],
  TRAY_CALIBRATION['2-3'],
  TRAY_CALIBRATION['1-1'],
  TRAY_CALIBRATION['1-2'],
  TRAY_CALIBRATION['1-3'],
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
    title: '执行机构明细',
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
  const tray = TRAY_CALIBRATION[trayId];
  return {
    x: tray.x,
    yBase: tray.yBase,
    yLift: tray.yLift,
    rack3DX: tray.rack3DX,
    rack3DY: tray.rack3DY,
  };
};

export const getTimestamp = () => new Date().toLocaleTimeString('zh-CN', { hour12: false });

export const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const interpolate = (
  value: number,
  inputStart: number,
  inputEnd: number,
  outputStart: number,
  outputEnd: number,
) => {
  if (inputStart === inputEnd) {
    return outputStart;
  }

  const ratio = (value - inputStart) / (inputEnd - inputStart);
  return outputStart + ratio * (outputEnd - outputStart);
};

const interpolateByPoints = (value: number, points: readonly CalibrationPoint[]) => {
  if (points.length === 0) {
    return value;
  }

  if (value <= points[0].input) {
    return points[0].output;
  }

  for (let index = 1; index < points.length; index += 1) {
    const start = points[index - 1];
    const end = points[index];

    if (value <= end.input) {
      return interpolate(value, start.input, end.input, start.output, end.output);
    }
  }

  return points[points.length - 1].output;
};

const isOutsideCalibrationRange = (value: number, points: readonly CalibrationPoint[]) =>
  value < points[0].input || value > points[points.length - 1].input;

export const internalToDisplayAxis = (key: 'x' | 'y', value: number) => {
  const clamped = clamp(value, AXIS_RANGE[key].min, AXIS_RANGE[key].max);
  return interpolateByPoints(clamped, INTERNAL_DISPLAY_AXIS_POINTS[key]);
};

export const displayToInternalAxis = (key: 'x' | 'y', value: number) => {
  if (key === 'x') {
    const clamped = clamp(value, DISPLAY_AXIS_RANGE.x.left, DISPLAY_AXIS_RANGE.x.right);
    return interpolateByPoints(clamped, DISPLAY_INTERNAL_AXIS_POINTS.x);
  }

  const clamped = clamp(value, DISPLAY_AXIS_RANGE.y.bottom, DISPLAY_AXIS_RANGE.y.top);
  return interpolateByPoints(clamped, DISPLAY_INTERNAL_AXIS_POINTS.y);
};

export const pythonToDisplayAxis = (key: 'x' | 'y', value: number) => interpolateByPoints(value, PYTHON_DISPLAY_AXIS_POINTS[key]);

export const pythonToInternalAxis = (key: 'x' | 'y', value: number) => {
  if (key === 'x') {
    return displayToInternalAxis('x', pythonToDisplayAxis('x', value));
  }

  return interpolateByPoints(value, [
    { input: 0, output: HOME_AXIS_POSITION.y },
    { input: 89, output: TRAY_CALIBRATION['1-1'].yBase },
    { input: 3610, output: TRAY_CALIBRATION['2-1'].yBase },
    { input: 7131, output: TRAY_CALIBRATION['3-1'].yBase },
  ]);
};

export const isPythonAxisOutOfRange = (key: 'x' | 'y', value: number) =>
  isOutsideCalibrationRange(value, PYTHON_DISPLAY_AXIS_POINTS[key]);

export const createSensorSnapshot = (): SensorSnapshot =>
  SENSOR_CONFIG.reduce((snapshot, config) => {
    const random = config.base + (Math.random() - 0.5) * config.variance * 2;
    const clamped = clamp(random, config.min, config.max);
    snapshot[config.id] = Number(clamped.toFixed(config.precision));
    return snapshot;
  }, {} as SensorSnapshot);

export const formatSensorValue = (value: number, precision: number) =>
  precision === 0 ? Math.round(value).toString() : value.toFixed(precision);
