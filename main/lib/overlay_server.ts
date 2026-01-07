import express from 'express'
import http from 'http'
import { Server } from 'socket.io'
import cors from 'cors'
import path from 'path'

// 定义端口
const PORT = 18888

let io: Server | null = null
let app: express.Express | null = null
let server: http.Server | null = null

/**
 * 初始化本地 Overlay 服务器
 */
export function initOverlayServer() {
  if (server) return // 防止重复初始化

  app = express()
  server = http.createServer(app)
  
  // 允许跨域，方便调试
  app.use(cors())
  
  // 托管静态文件 (overlay 目录)
  // 智能判断路径：
  // 1. 开发环境：process.cwd()/overlay
  // 2. 生产环境：process.resourcesPath/overlay (由 electron-builder extraResources 复制)
  const isProd = process.env.NODE_ENV === 'production'
  const overlayPath = isProd 
      ? path.join(process.resourcesPath, 'overlay')
      : path.join(process.cwd(), 'overlay')
      
  console.log('[Overlay Server] Serving static files from:', overlayPath)
  app.use(express.static(overlayPath))

  // 初始化 Socket.io
  io = new Server(server, {
    cors: {
      origin: "*", // 允许任何来源连接
      methods: ["GET", "POST"]
    }
  })

  io.on('connection', (socket) => {
    console.log('[Overlay Server] Client connected:', socket.id)

    socket.on('disconnect', () => {
      // console.log('[Overlay Server] Client disconnected:', socket.id)
    })
  })

  // 简单的测试路由
  app.get('/', (req, res) => {
    res.send('Luludanmaku Overlay Server is Running!')
  })

  // 启动监听
  server.listen(PORT, () => {
    console.log(`[Overlay Server] Running on http://localhost:${PORT}`)
  })
}

/**
 * 广播消息给所有连接的客户端 (OBS 等)
 * @param event 事件名称 (e.g. 'danmu-message')
 * @param data 数据载荷
 */
export function broadcastToOverlay(event: string, data: any) {
  if (io) {
    io.emit(event, data)
  }
}

/**
 * 关闭服务器
 */
export function closeOverlayServer() {
  if (io) {
    io.close()
    io = null
  }
  if (server) {
    server.close()
    server = null
  }
  app = null
  console.log('[Overlay Server] Stopped')
}
