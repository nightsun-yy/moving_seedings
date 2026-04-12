# Moving Seedlings

这个仓库当前包含两部分内容：

- `plc_monitor.py`
  - 一个 Python 版 PLC 监控脚本，用 `pymodbus` 通过 Modbus TCP 读取 PLC 数据
- `frontend/`
  - 一个基于 `React + TypeScript + Vite + Tailwind + Three.js` 的前端页面，用来演示智慧育苗搬运系统的数字孪生控制台

如果你现在主要想看网页界面，请直接看前端部分。

## 文档入口

- 前端总结文档：[`docs/基本需求.md`](docs/基本需求.md)
- 前端启动说明：[`frontend/README.md`](frontend/README.md)

## 给初学者的最快启动方式

### 1. 先准备环境

你需要先安装下面两个软件：

- `Node.js`
  - 建议安装 LTS 版本
- `npm`
  - 安装 Node.js 时会一起安装

安装完成后，在终端里执行下面两条命令确认是否成功：

```bash
node -v
npm -v
```

如果能看到版本号，就说明前端环境已经准备好了。

### 2. 进入前端目录

在项目根目录打开终端，然后执行：

```bash
cd frontend
```

### 3. 第一次先安装依赖

```bash
npm install
```

这一步会把前端需要的包安装到 `frontend/node_modules/`。

### 4. 启动前端开发服务器

```bash
npm run dev
```

正常启动后，终端会看到类似下面的输出：

```text
VITE v5.x.x ready in xxx ms

Local:   http://localhost:5173/
```

### 5. 在浏览器里打开页面

把下面这个地址复制到浏览器里打开：

```text
http://localhost:5173/
```

你就能看到当前的前端页面。

## “通过网页连接前端页面”是什么意思

这里不是直接双击 `html` 文件打开，而是：

1. 先运行 `npm run dev`
2. 让 Vite 启动本地开发服务器
3. 再在浏览器里访问 `http://localhost:5173/`

也就是说，这个前端页面是通过本地开发服务器提供给浏览器访问的。

## 如果你想让同一局域网内其他设备访问

默认情况下，`npm run dev` 只允许你自己的电脑通过 `localhost` 访问。

如果你想让手机、平板或同局域网的另一台电脑访问，可以在 `frontend/` 目录执行：

```bash
npm run dev -- --host
```

然后查看终端里显示的网络地址，再在其他设备的浏览器里访问，例如：

```text
http://192.168.1.10:5173/
```

注意：

- 你的其他设备要和这台电脑在同一个局域网
- 电脑防火墙不能拦截这个端口

## 当前前端页面大致包含什么

当前前端不是普通管理后台，而是一个带 3D 场景的演示页面，包含：

- 顶部系统状态栏
- 左侧控制面板
- 中间 3D 机械臂与育苗架场景
- 左侧运行日志
- 右下图例说明

它目前主要用于演示“AI 巡检、识别成熟苗、抓取、搬运出库”的流程。

## 常用命令

在 `frontend/` 目录下可用：

```bash
npm run dev
```

- 启动开发环境

```bash
npm run build
```

- 生成生产环境打包文件，输出到 `frontend/dist/`

```bash
npm run preview
```

- 本地预览打包后的结果

## 常见问题

### 1. `npm` 命令找不到

通常说明 Node.js 还没有安装好，或者安装后没有重新打开终端。

### 2. 页面打不开

先确认下面几件事：

- 终端里 `npm run dev` 还在运行
- 你打开的是终端里给出的地址
- 地址通常是 `http://localhost:5173/`
- 不要直接双击 `frontend/index.html`

### 3. 5173 端口被占用

如果端口被占用，Vite 会自动尝试其他端口，例如 `5174`。这时候你应该访问终端里实际显示的新地址。

## 后续如果要接真实后端

当前前端已经有页面和 3D 动画，但还没有正式接到 Python 网关或 PLC。

后续通常会在下面这个位置继续开发：

- `frontend/src/App.tsx`
  - 目前页面逻辑主要集中在这里

如果你要继续做接口联调，建议先阅读：

- [`docs/基本需求.md`](docs/基本需求.md)
- [`frontend/README.md`](frontend/README.md)
