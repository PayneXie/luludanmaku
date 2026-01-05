# Luludanmaku - Bilibili Live Danmaku Assistant

一个基于 Electron + Next.js 构建的哔哩哔哩直播弹幕助手。

## 🛠️ 技术栈

- **框架**: [Electron](https://www.electronjs.org/) + [Next.js](https://nextjs.org/) ([Nextron](https://github.com/saltyshiomix/nextron))
- **语言**: TypeScript (Main Process) + JavaScript/React (Renderer Process)
- **核心协议**: WebSocket + ProtoBuf (Pako/Brotli 解压)

## 🚀 快速开始

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

### 打包构建

```bash
npm run build
```

构建产物将位于 `dist` 目录下。

## 📝 目录结构

- `main/`: Electron 主进程代码（负责 WebSocket 连接、API 请求、WBI 签名）。
- `renderer/`: Next.js 渲染进程代码（负责界面展示、状态管理）。
- `resources/`: 应用图标等静态资源。

## 🙏 致谢

- **[bilibili-API-collect](https://github.com/SocialSisterYi/bilibili-API-collect)**: 感谢该项目提供的 API 文档支持，本项目使用了其中的 WBI 签名算法及 WebSocket 协议分析。

## 📄 License

MIT
