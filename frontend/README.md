# Frontend 启动说明

这个目录是当前项目的前端部分。

它使用的技术是：

- `React`
- `TypeScript`
- `Vite`
- `Tailwind CSS`
- `Three.js`

如果你刚开始学前端，可以把它理解成：

- `React` 负责页面
- `Vite` 负责把页面跑起来
- `Tailwind CSS` 负责样式
- `Three.js` 负责 3D 画面

## 1. 启动前需要准备什么

请先安装：

- `Node.js`
- `npm`

安装完成后，在终端执行：

```bash
node -v
npm -v
```

如果能看到版本号，说明环境已经正常。

## 2. 如何启动前端

在项目根目录执行：

```bash
cd frontend
```

第一次启动前，请先安装依赖：

```bash
npm install
```

安装完成后，启动开发服务器：

```bash
npm run dev
```

## 3. 如何在网页里打开这个前端

启动成功后，终端一般会显示：

```text
Local:   http://localhost:5173/
```

这时候打开浏览器，访问：

```text
http://localhost:5173/
```

就能看到页面。

注意：

- 不要直接双击 `index.html`
- 一定要先执行 `npm run dev`
- 然后通过浏览器访问 Vite 提供的地址

## 4. 如果想让别的设备也访问这个页面

如果你想让手机或同局域网的其他电脑打开这个前端，可以执行：

```bash
npm run dev -- --host
```

然后在浏览器中访问终端显示出来的网络地址，例如：

```text
http://192.168.1.10:5173/
```

## 5. 当前前端的主要文件

### `src/main.tsx`

前端入口文件，负责把页面挂到浏览器上。

### `src/App.tsx`

当前页面主逻辑文件，负责：

- 页面布局
- 3D 场景初始化
- 机械臂动画
- 日志更新
- 模拟环境数据
- AI 巡检与出库流程

### `src/index.css`

Tailwind 样式入口。

### `vite.config.ts`

Vite 的基础配置文件。

## 6. 常用命令

```bash
npm run dev
```

- 启动开发环境

```bash
npm run build
```

- 打包前端

```bash
npm run preview
```

- 预览打包结果

## 7. 常见问题

### 启动时报 `npm` 找不到

说明 Node.js 还没有正确安装，或者终端还没有刷新。

### 打开浏览器后页面空白

先检查：

- `npm run dev` 是否还在运行
- 地址是否写对
- 终端里是否有新的报错

### 端口不是 `5173`

如果 `5173` 被占用了，Vite 会切换到其他端口，例如 `5174`。这时你应该访问终端实际输出的地址。

## 8. 下一步建议

如果你准备继续学习这个前端，建议按下面顺序看代码：

1. 先看 `src/main.tsx`
2. 再看 `src/App.tsx`
3. 最后看 `src/index.css` 和 `vite.config.ts`

如果你要先理解这个页面整体在做什么，再去读代码，可以先看：

- [`../docs/基本需求.md`](../docs/基本需求.md)
