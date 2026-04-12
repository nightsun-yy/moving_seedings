#!/bin/bash

# 遇到错误立即停止
set -e

echo "🚀 [1/6] 正在清理旧环境..."
rm -rf front
echo "✅ 旧环境已清理"

echo "🚀 [2/6] 创建 Vite + React + TypeScript 项目..."
# 修复点：将 --yes 放在 npm 后面，并固定使用 vite@5 版本的脚手架，防止最新版 CLI 拦截脚本并自动启动服务
npm create --yes vite@5 front -- --template react-ts
cd front

echo "🚀 [3/6] 安装依赖 (这可能需要几分钟)..."
# 生产依赖
npm install axios classnames lucide-react react-router-dom xlsx
# 开发依赖 (强制指定 Tailwind V3 版本)
npm install -D tailwindcss@3.4.17 postcss@8.4.35 autoprefixer@10.4.17 @types/node

echo "🚀 [4/6] 配置 Tailwind V3 环境..."

# 1. 写入 postcss.config.js
cat > postcss.config.js <<EOF
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# 2. 写入 tailwind.config.js
cat > tailwind.config.js <<EOF
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# 3. 写入 src/index.css
cat > src/index.css <<EOF
@tailwind base;
@tailwind components;
@tailwind utilities;
EOF

echo "🚀 [5/6] 写入测试页面代码..."
# 覆盖 App.tsx
cat > src/App.tsx <<EOF
import React from 'react';

function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      {/* 测试卡片容器 */}
      <div className="bg-white p-8 rounded-xl shadow-lg border border-gray-200 max-w-sm">
        
        {/* 标题：测试字体大小、颜色、粗细 */}
        <h1 className="text-2xl font-bold text-blue-600 mb-4">
          Tailwind 配置成功！
        </h1>
        
        {/* 内容：测试文本颜色、间距 */}
        <p className="text-gray-600 mb-6 leading-relaxed">
          如果你能看到这个带阴影的卡片，并且标题是蓝色的，说明你的环境已经完全准备好，可以开始开发 Wafer Map 组件了。
        </p>

        {/* 按钮：测试背景色、Hover 状态、圆角 */}
        <button className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-4 rounded transition-colors duration-200">
          点击开始开发
        </button>
      </div>
    </div>
  )
}

export default App
EOF

echo "🚀 [6/6] 准备就绪，正在启动服务..."
echo "🎉 如果浏览器没有自动打开，请手动访问终端显示的 Local 地址 (通常是 http://localhost:5173)"
echo "-------------------------------------------------------"

# 启动开发服务器
npm run dev