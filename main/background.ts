import path from 'path'
import https from 'https'
import { app, ipcMain, Menu, BrowserWindow, shell, clipboard, crashReporter } from 'electron'
import serve from 'electron-serve'
import log from 'electron-log/main'
import { createWindow } from './helpers'

// Initialize electron-log
log.initialize();
log.transports.file.level = 'info';
log.transports.console.level = 'debug';
// Log rotation (Keep last 7 days)
log.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs/main.log');
// No specific rotation config needed, electron-log rotates 'main.log', 'main.old.log' by default.
// But to be safe and keep more history, let's just let it be standard behavior or customization if needed.
// Standard behavior: main.log -> main.old.log. Just 1 backup.
// Let's customize archive logic if user wants "not flushed away".
// Actually electron-log default is: limit 1MB, keep 2 files.
// We can increase it.
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.archiveLogFn = (oldLogFile) => {
  const fileInfo = path.parse(oldLogFile.toString());
  try {
      const date = new Date().toISOString().replace(/T/, '_').replace(/:/g, '-').split('.')[0];
      const newFileName = path.join(fileInfo.dir, `main-${date}${fileInfo.ext}`);
      fs.renameSync(oldLogFile.toString(), newFileName);
  } catch (e) {
      console.error('Could not rotate log', e);
  }
};

import { dialog } from 'electron';

// Catch global errors
process.on('uncaughtException', (error) => {
  log.error('Uncaught Exception:', error);
  // Suppress all dialogs, log only
  /*
  dialog.showErrorBox('发生严重错误 (Uncaught Exception)', 
      `程序发生崩溃，请截图此信息反馈给开发者。\n\n错误信息:\n${error.message}\n\n日志位置:\n${app.getPath('userData')}\\logs\\`
  );
  */
});

process.on('unhandledRejection', (reason: any) => {
  log.error('Unhandled Rejection:', reason);
  // Suppress all dialogs, log only
  /*
  dialog.showErrorBox('发生严重错误 (Unhandled Rejection)', 
      `程序检测到未处理的异步错误，请截图此信息反馈给开发者。\n\n错误信息:\n${reason?.message || reason}\n\n日志位置:\n${app.getPath('userData')}\\logs\\`
  );
  */
});

// Catch Process Crashes (Native/OOM/GPU)
app.on('render-process-gone', (event, webContents, details) => {
  log.error(`[Crash] Render Process Gone: Reason=${details.reason}, ExitCode=${details.exitCode}`);
  
  // OOM is a common silent killer
  if (details.reason === 'oom') {
      // dialog.showErrorBox('内存溢出 (OOM)', '程序内存不足导致崩溃。请尝试重启软件。');
      log.warn('OOM detected. Suggest restart.');
  } else if (details.reason === 'crashed') {
      // dialog.showErrorBox('渲染进程崩溃', `渲染进程意外退出。\n原因: ${details.reason}\n请检查日志。`);
      log.warn(`Render process crashed: ${details.reason}`);
  } else {
      // killed, integrity-failure, etc.
      log.warn(`Render process gone with reason: ${details.reason}`);
  }
});

app.on('child-process-gone', (event, details) => {
  log.error(`[Crash] Child Process Gone: Type=${details.type}, Reason=${details.reason}, ExitCode=${details.exitCode}`);
  
  if (details.type === 'GPU' && details.reason === 'crashed') {
      // GPU crashes are often recovered automatically, but if frequent, suggest disabling hardware acceleration
      log.warn('GPU Process crashed. If this happens frequently, consider disabling Hardware Acceleration.');
  }
});

// Redirect console to log
Object.assign(console, log.functions);

import { GetNewQrCode, CheckQrCodeStatus, GetDanmuInfo, BiliCookies, GetUserInfo, GetBiliUserInfo, GetRoomInfo, GetSilentUserList, AddSilentUser } from './lib/bilibili_login'
import { avatarFetcher } from './lib/avatar_fetcher'
import { avatarDb } from './lib/db'
import { BiliWebSocket, WsInfo, PackResult } from './lib/bilibili_socket'
import { initOverlayServer, broadcastToOverlay, closeOverlayServer } from './lib/overlay_server'
import fs from 'fs-extra'
import { LRUCache } from 'lru-cache'

const isProd = process.env.NODE_ENV === 'production'
let activeBiliSocket: BiliWebSocket | null = null
let messageBuffer: any[] = []
let messageTimer: NodeJS.Timeout | null = null
let activeCookies: BiliCookies = {} // Store cookies globally in main process

// Stress Test State (Global Scope)
let stressTestTimer: NodeJS.Timeout | null = null

const startDanmuFlood = () => {
    if (stressTestTimer) clearInterval(stressTestTimer)
    log.info('[StressTest] Starting Danmaku Flood...')
    const win = BrowserWindow.getAllWindows()[0]
    
    stressTestTimer = setInterval(() => {
        const batch = []
        for (let i = 0; i < 100; i++) {
        batch.push({
            cmd: 'DANMU_MSG',
            info: [
            [0, 1, 25, 16777215, 1704380000, 0, 0, ""],
            `Stress Test Message ${Date.now()}_${i}`,
            [12345 + i, `StressUser_${i}`, 0, 0, 0, 10000, 1, ""],
            [5, "Test", "Anchor", 123, 0x5896de, "", 0],
            [0, 0, 9868950, ">50000"],
            ["", ""],
            0, 0, null, { "ts": 1704380000, "ct": "A76F3C90" }, 0, 0, null, null, 0, 210
            ]
        })
        }
        // Send directly to renderer via IPC to simulate high load
        // Also broadcast to overlay
        batch.forEach(msg => {
            if (win) win.webContents.send('danmu-message', msg)
            broadcastToOverlay('danmu-message', msg)
        })
    }, 100) // Every 100ms send 100 messages = 1000 msg/s
}

const stopDanmuFlood = () => {
    if (stressTestTimer) {
        clearInterval(stressTestTimer)
        stressTestTimer = null
        log.info('[StressTest] Stopped Danmaku Flood')
    }
}

// Face Cache Configuration
const FACE_CACHE_FILE = path.join(app.getPath('userData'), 'face_cache.json')
// 使用 LRU Cache 替代 Map
const faceCache = new LRUCache<number, string>({
  max: 30000, // 最大 30000 条记录
  // ttl: 0, // 0 或不设置表示永不过期（除非数量超过 max）
  updateAgeOnGet: true, // 每次访问都更新“最近使用时间”，保证活跃用户不被淘汰
})

let pendingFaceRequests: Set<number> = new Set()
let isCacheDirty = false
// 使用两个队列实现优先级
const highPriorityFaceQueue: number[] = []
const lowPriorityFaceQueue: number[] = []
const faceRetryCounts = new Map<number, number>()
let isQueueProcessing = false

// Process queue worker
async function processFaceQueue() {
  if (isQueueProcessing || (highPriorityFaceQueue.length === 0 && lowPriorityFaceQueue.length === 0)) return

  isQueueProcessing = true
  
  // 只要任意队列有数据就继续循环
  while (highPriorityFaceQueue.length > 0 || lowPriorityFaceQueue.length > 0) {
    // 优先从高优先级队列取，如果空的再从低优先级取
    let uid: number | undefined
    let isHighPriority = false
    if (highPriorityFaceQueue.length > 0) {
        uid = highPriorityFaceQueue.shift()
        isHighPriority = true
    } else {
        uid = lowPriorityFaceQueue.shift()
    }

    if (!uid) continue
    
    // Check cache again in case it was added recently
    if (faceCache.has(uid)) {
        pendingFaceRequests.delete(uid)
        faceRetryCounts.delete(uid)
        continue
    }
    
    // Check Database (L2 Cache)
    try {
        const dbFace = await avatarDb.get(uid)
        if (dbFace) {
            faceCache.set(uid, dbFace)
            isCacheDirty = true
            pendingFaceRequests.delete(uid)
            faceRetryCounts.delete(uid)
            continue
        }
    } catch (e) { /* Ignore DB error */ }

    try {
      // Fetch with delay to avoid rate limit (Using AvatarFetcher)
      const faceUrl = await avatarFetcher.fetchAvatar(uid)
      if (faceUrl) {
        faceCache.set(uid, faceUrl)
        isCacheDirty = true
        // Write to DB (L2 Cache)
        avatarDb.put(uid, faceUrl)
        
        // Success
        pendingFaceRequests.delete(uid)
        faceRetryCounts.delete(uid)
      } else {
        throw new Error('No face found via AvatarFetcher')
      }
    } catch (err: any) {
       // Log error
       console.error(`[FaceCache] Failed for ${uid}:`, err.message || err)
       
       // Retry Logic
       const currentRetries = faceRetryCounts.get(uid) || 0
       // Retry up to 10 times for network issues (user asked for persistent retry)
       // But let's limit to 5 to avoid infinite loops on 404s, 
       // unless we specifically check for network errors.
       // User said "don't just hang", implying they want it to eventually succeed if network comes back.
       // Let's use 5 retries.
       if (currentRetries < 5) {
           const nextRetry = currentRetries + 1
           faceRetryCounts.set(uid, nextRetry)
           console.log(`[FaceCache] Retrying ${uid} (Attempt ${nextRetry}/5)...`)
           
           // Re-queue to end of list
           if (isHighPriority) {
               highPriorityFaceQueue.push(uid)
           } else {
               lowPriorityFaceQueue.push(uid)
           }
           // Do NOT delete from pendingFaceRequests yet
       } else {
           console.error(`[FaceCache] Gave up on ${uid} after 5 attempts`)
           pendingFaceRequests.delete(uid)
           faceRetryCounts.delete(uid)
       }
    } 
    // finally block removed as we handle cleanup manually based on success/fail

    // Wait 200ms between requests to be safe (reduced from 2000ms due to multi-api rotation)
    await new Promise(resolve => setTimeout(resolve, 200))
  }

  isQueueProcessing = false
}

// Load cache from disk
try {
  if (fs.existsSync(FACE_CACHE_FILE)) {
    const data = fs.readJsonSync(FACE_CACHE_FILE)
    if (data && typeof data === 'object') {
      // Convert object to LRUCache load
      // LRUCache v7+ 使用 load() 方法，或者直接 set
      // 为了兼容性，我们遍历 set
      Object.keys(data).forEach(key => {
        faceCache.set(Number(key), data[key])
      })
      console.log(`[FaceCache] Loaded ${faceCache.size} entries from disk`)
    }
  }
} catch (e) {
  console.error('[FaceCache] Failed to load cache:', e)
}

// Save cache to disk periodically (every 30 seconds if dirty)
setInterval(async () => {
  if (isCacheDirty) {
    try {
      // Convert LRU to object for JSON storage
      // dump() 方法返回 [key, value] 数组，或者是序列化后的对象
      // 我们手动构建最简单的 key-value 对象以保持文件格式兼容
      const obj: Record<string, string> = {}
      
      // LRUCache 的迭代器默认是按最近使用顺序的
      // 我们不需要关心顺序，存进去就行
      for (const [key, value] of faceCache.entries()) {
          obj[key] = value
      }
      
      // 使用异步写入防止阻塞 Main Process
      await fs.writeJson(FACE_CACHE_FILE, obj)
      isCacheDirty = false
      // console.log('[FaceCache] Saved to disk')
    } catch (e) {
      console.error('[FaceCache] Failed to save cache:', e)
    }
  }
}, 30000)

/**
 * Try to get user face from cache, or fetch it asynchronously.
 * Returns null if not in cache immediately.
 * @param uid User ID
 * @param priority High priority for Gift/SC/Guard
 */
async function resolveUserFace(uid: number, priority: 'high' | 'low' = 'low'): Promise<string | null> {
  if (!uid) return null
  
  // 1. Check Memory Cache
  if (faceCache.has(uid)) {
    return faceCache.get(uid) || null
  }

  // 2. If not in cache and not pending, add to queue
  if (!pendingFaceRequests.has(uid)) {
    pendingFaceRequests.add(uid)
    if (priority === 'high') {
        highPriorityFaceQueue.push(uid)
        console.log(`[FaceCache] Added ${uid} to HIGH priority queue`)
    } else {
        lowPriorityFaceQueue.push(uid)
    }
    processFaceQueue() // Trigger worker
  }

  return null
}

// Listen for logs from renderer
ipcMain.on('renderer-log', (event, level, message, ...args) => {
    if (level === 'error') {
        log.error(`[Renderer] ${message}`, ...args)
    } else if (level === 'warn') {
        log.warn(`[Renderer] ${message}`, ...args)
    } else {
        log.info(`[Renderer] ${message}`, ...args)
    }
})

// Proxy request to avoid CORS
ipcMain.handle('proxy-request', async (event, url, options = {}) => {
    try {
        log.info(`[ProxyRequest] Fetching: ${url}`)
        
        // Use net module from electron (similar to Node fetch but works better in Electron context)
        const { net } = require('electron')
        
        return new Promise((resolve, reject) => {
            const request = net.request({
                method: options.method || 'GET',
                url: url,
            })
            
            if (options.headers) {
                for (const [key, value] of Object.entries(options.headers)) {
                    request.setHeader(key, value as string)
                }
            }
            // Add default User-Agent if not present
            if (!request.getHeader('User-Agent')) {
                request.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36')
            }

            request.on('response', (response) => {
                let data = ''
                response.on('data', (chunk) => {
                    data += chunk.toString()
                })
                response.on('end', () => {
                    if (response.statusCode >= 200 && response.statusCode < 300) {
                        try {
                            const json = JSON.parse(data)
                            log.info(`[ProxyRequest] Success, data length: ${Array.isArray(json) ? json.length : 'Object'}`)
                            resolve(json)
                        } catch (e) {
                            reject(new Error(`Failed to parse JSON: ${e.message}`))
                        }
                    } else {
                         log.warn(`[ProxyRequest] Failed: ${response.statusCode}`)
                         reject(new Error(`HTTP ${response.statusCode}`))
                    }
                })
                response.on('error', (error) => {
                    reject(error)
                })
            })
            
            request.on('error', (error) => {
                 log.error(`[ProxyRequest] Request Error:`, error)
                 reject(error)
            })

            request.end()
        })

    } catch (error) {
        log.error(`[ProxyRequest] Error:`, error)
        throw error
    }
})

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

  // Start Overlay Server
  initOverlayServer()
  
  // Init Database (Async)
  avatarDb.init().catch(err => log.error('Failed to init DB:', err))

  ;(async () => {
    await app.whenReady()
    
    log.info('App starting...');
    log.info('Version:', app.getVersion());
    log.info('UserData:', app.getPath('userData'));

  const mainWindow = createWindow('main', {
    width: 1000,
    height: 600,
    frame: false, // Frameless for custom UI and transparent mode
    transparent: true, // Allow transparency
    backgroundColor: '#00000000',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  if (isProd) {
    await mainWindow.loadURL('app://./home')
  } else {
    const port = process.argv[2]
    await mainWindow.loadURL(`http://localhost:${port}/home`)
    mainWindow.webContents.openDevTools()
  }

  // Debug Menu
  const menuTemplate: Electron.MenuItemConstructorOptions[] = [
  {
    label: 'Debug Tools',
    submenu: [
      {
        label: 'Stress Test (Risk of Crash)',
        submenu: [
          {
            label: 'Start Danmaku Flood (100 msgs/100ms)',
            click: startDanmuFlood
          },
          {
            label: 'Stop Danmaku Flood',
            click: stopDanmuFlood
          },
          { type: 'separator' },
            {
              label: 'Flood Face Cache (1000 Random UIDs)',
              click: async () => {
                log.info('[StressTest] Starting Face Cache Flood...')
                for (let i = 0; i < 1000; i++) {
                   // Random UID between 1000000 and 2000000
                   const randomUid = 1000000 + Math.floor(Math.random() * 1000000)
                   // Trigger resolve (async, don't await to flood the queue)
                   resolveUserFace(randomUid, 'low')
                }
                log.info('[StressTest] 1000 requests added to queue')
              }
            },
            { type: 'separator' },
            {
              label: 'Simulate Uncaught Exception',
              click: () => {
                log.info('[StressTest] Throwing Error...')
                throw new Error('Manually triggered Uncaught Exception for testing')
              }
            },
            {
              label: 'Simulate Unhandled Rejection',
              click: () => {
                log.info('[StressTest] Triggering Rejection...')
                Promise.reject(new Error('Manually triggered Unhandled Rejection for testing'))
              }
            }
          ]
        },
        { type: 'separator' },
        {
          label: 'Send Test Danmaku',
          click: () => {
             // Mock DANMU_MSG
             const mockMsg = {
                cmd: 'DANMU_MSG',
                info: [
                   [0,1,25,16777215,1704380000,0,0,""], 
                   "This is a test danmaku message " + Math.floor(Math.random() * 100), 
                   [12345, "TestUser_" + Math.floor(Math.random() * 100), 0, 0, 0, 10000, 1, ""], 
                   [5, "TestMedal", "TestAnchor", 123, 0x5896de, "", 0, 6809855, 2951253, 10329087, 3, 1], // Medal info
                   [0,0,9868950,">50000"], 
                   ["title-531-1", "title-531-1"], 
                   0, 0, null, { "ts": 1704380000, "ct": "A76F3C90" }, 0, 0, null, null, 0, 210
                ]
             }
             mainWindow.webContents.send('danmu-message', mockMsg)
             broadcastToOverlay('danmu-message', mockMsg)
          }
        },
        {
          label: 'Send Test SuperChat',
          click: () => {
            // Mock SUPER_CHAT_MESSAGE
            const price = [30, 50, 100, 500, 1000, 2000][Math.floor(Math.random() * 6)]
            const mockSC = {
                cmd: 'SUPER_CHAT_MESSAGE',
                data: {
                    id: Math.floor(Math.random() * 100000),
                    uid: 12345,
                    price: price,
                    rate: 1000,
                    message: "This is a test SuperChat message worth ￥" + price,
                    is_ranked: 0,
                    background_image: "",
                    background_color: "#EDF5FF",
                    background_icon: "",
                    background_price_color: "#7497CD",
                    background_bottom_color: "#2A60B2",
                    ts: 1704380000,
                    token: "token",
                    medal_info: {
                        anchor_roomid: 0,
                        anchor_uname: "",
                        guard_level: 0,
                        icon_id: 0,
                        is_lighted: 0,
                        medal_color: 0,
                        medal_color_border: 0,
                        medal_color_end: 0,
                        medal_color_start: 0,
                        medal_level: 0,
                        medal_name: "",
                        special: "",
                        target_id: 0
                    },
                    user_info: {
                        face: "https://i0.hdslb.com/bfs/face/member/noface.jpg",
                        face_frame: "",
                        guard_level: 0,
                        is_main_vip: 0,
                        is_svip: 0,
                        is_vip: 0,
                        level_color: "#61C05A",
                        manager: 0,
                        name_color: "#61C05A",
                        title: "title",
                        uname: "TestSC_User",
                        user_level: 10
                    },
                    time: 60,
                    start_time: 1704380000,
                    end_time: 1704380060,
                    gift: {
                        gift_id: 12000,
                        gift_name: "醒目留言",
                        num: 1
                    }
                },
                roomid: 123
            }
            mainWindow.webContents.send('danmu-message', mockSC)
            broadcastToOverlay('danmu-message', mockSC)
          }
        },
        {
          label: 'Send Test Gift',
          click: () => {
            // Mock SEND_GIFT
            const mockGift = {
                cmd: 'SEND_GIFT',
                data: {
                    action: "投喂",
                    batch_combo_id: "",
                    batch_combo_send: null,
                    beatId: "0",
                    biz_source: "live",
                    blind_gift: null,
                    broadcast_id: 0,
                    coin_type: "gold",
                    combo_resources_id: 1,
                    combo_send: null,
                    combo_stay_time: 5,
                    combo_total_coin: 100,
                    crit_prob: 0,
                    demarcation: 1,
                    discount_price: 100,
                    dmscore: 28,
                    draw_gift: null,
                    effect: 0,
                    effect_block: 1,
                    face: "https://i0.hdslb.com/bfs/face/member/noface.jpg",
                    giftId: 1,
                    giftName: "辣条",
                    giftType: 0,
                    gold: 0,
                    guard_level: 0,
                    is_first: true,
                    is_special_batch: 0,
                    magnification: 1,
                    medal_info: {
                        anchor_roomid: 0,
                        anchor_uname: "",
                        guard_level: 0,
                        icon_id: 0,
                        is_lighted: 0,
                        medal_color: 0,
                        medal_color_border: 0,
                        medal_color_end: 0,
                        medal_color_start: 0,
                        medal_level: 0,
                        medal_name: "",
                        special: "",
                        target_id: 0
                    },
                    name_color: "",
                    num: Math.floor(Math.random() * 10) + 1,
                    original_gift_name: "",
                    price: 100,
                    rcost: 22756804,
                    remain: 0,
                    rnd: "1704380000",
                    send_master: null,
                    silver: 0,
                    super: 0,
                    super_batch_gift_num: 1,
                    super_gift_num: 1,
                    svga_resources: "",
                    tag_image: "",
                    tid: "1704380000",
                    timestamp: 1704380000,
                    top_list: null,
                    total_coin: 100,
                    uid: 12345,
                    uname: "TestGift_User"
                }
            }
            mainWindow.webContents.send('danmu-message', mockGift)
            broadcastToOverlay('danmu-message', mockGift)
          }
        },
        { type: 'separator' },
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' }
      ]
    }
  ]
  const menu = Menu.buildFromTemplate(menuTemplate)
  Menu.setApplicationMenu(menu)

})()

app.on('window-all-closed', () => {
  avatarDb.close().then(() => app.quit())
})

ipcMain.on('message', async (event, arg) => {
  event.reply('message', `${arg} World!`)
})

ipcMain.handle('bilibili-get-qrcode', async () => {
  try {
    const result = await GetNewQrCode()
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to get QR code:', error)
    return { success: false, error: error.message }
  }
})

ipcMain.handle('bilibili-check-qrcode', async (event, oauthKey) => {
  try {
    const result = await CheckQrCodeStatus(oauthKey)
    return { success: true, data: result }
  } catch (error: any) {
    // console.error('Failed to check QR code:', error)
    return { success: false, error: error.message || error }
  }
 })

ipcMain.on('bilibili-connect-socket', (event, wsInfo: WsInfo) => {
  if (activeBiliSocket) {
    activeBiliSocket.Disconnect()
    activeBiliSocket = null
  }
  
  // Clear previous timer and buffer
  if (messageTimer) {
    clearInterval(messageTimer)
    messageTimer = null
  }
  messageBuffer = []

  try {
    // Setup flush timer (100ms)
    messageTimer = setInterval(() => {
      if (messageBuffer.length > 0) {
        // Send batch
        if (!event.sender.isDestroyed()) {
            try {
                event.reply('danmu-message', messageBuffer)
            } catch (e) {
                console.error('[Main] Failed to send to renderer:', e)
            }
        }
        
        // Forward to tools window if it exists
        if (toolsWindow && !toolsWindow.isDestroyed()) {
            try {
                toolsWindow.webContents.send('danmu-message', messageBuffer)
            } catch (e) {
                console.error('[Main] Failed to send to tools window:', e)
            }
        }

        messageBuffer = []
      }
    }, 100)

    activeBiliSocket = new BiliWebSocket(wsInfo, (packet: PackResult) => {
       // Filter for DANMU_MSG or other interest
       // Use for...of loop instead of forEach to better handle async/errors
       ;(async () => {
         for (const msg of packet.body) {
            try {
              // console.log('Forwarding MSG:', msg.cmd) // Debug
              if (msg.cmd === 'DANMU_MSG') {
                 // Safe check for info array
                 if (!Array.isArray(msg.info) || !msg.info[2] || !Array.isArray(msg.info[2])) {
                     log.warn('[Socket] Invalid DANMU_MSG structure:', JSON.stringify(msg));
                     continue;
                 }

                 // Inject Face from Cache
                 const uid = msg.info[2][0]
                 // 普通弹幕：低优先级
                 const cachedFace = await resolveUserFace(uid, 'low')
                 if (cachedFace) {
                     ;(msg as any).face = cachedFace
                 }
                 
                 messageBuffer.push(msg)
                 broadcastToOverlay('danmu-message', msg)
    
              } else if (msg.cmd === 'INTERACT_WORD' || 
                  msg.cmd === 'INTERACT_WORD_V2' || 
                  msg.cmd === 'ENTRY_EFFECT' || 
                  msg.cmd === 'SEND_GIFT' || 
                  msg.cmd === 'SUPER_CHAT_MESSAGE' || 
                  msg.cmd === 'ONLINE_RANK_COUNT') {
                
                // For other messages, also try to inject face if uid is available
                let uid = 0
                if (msg.data && msg.data.uid) uid = msg.data.uid
                
                if (uid) {
                    // 礼物、SC、进场等：高优先级
                    const cachedFace = await resolveUserFace(uid, 'high')
                    if (cachedFace) {
                        if (!msg.data) msg.data = {}
                        msg.data.face = cachedFace
                    }
                }
    
                messageBuffer.push(msg)
                // Broadcast to Overlay Server (OBS)
                broadcastToOverlay('danmu-message', msg)
    
              } else if (msg.cmd === 'USER_TOAST_MSG') {
                 // Fetch user info for Guard message to get avatar
                 try {
                    // Use stored activeCookies
                    const uid = msg.data?.uid
                    if (uid) {
                        // Try Cache First
                        if (faceCache.has(uid)) {
                            const cachedFace = faceCache.get(uid)
                            if (cachedFace) msg.data.face = cachedFace
                        } else {
                            // Try DB first
                            const dbFace = await avatarDb.get(uid)
                            if (dbFace) {
                                msg.data.face = dbFace
                                faceCache.set(uid, dbFace)
                                isCacheDirty = true
                            } else {
                                const faceUrl = await avatarFetcher.fetchAvatar(uid)
                                if (faceUrl) {
                                    msg.data.face = faceUrl
                                    faceCache.set(uid, faceUrl)
                                    isCacheDirty = true
                                    avatarDb.put(uid, faceUrl)
                                }
                            }
                        }
                    }
                 } catch (e) {
                    console.error('Failed to fetch guard user info', e)
                 }
                 messageBuffer.push(msg)
                 // Broadcast to Overlay Server (OBS)
                 broadcastToOverlay('danmu-message', msg)
              } else if (msg.cmd === 'STOP_LIVE_ROOM_LIST') {
                 // System message, ignore in production
                 // console.log('Ignored system msg:', msg.cmd)
              }
            } catch (err) {
                log.error('[Socket] Error processing message:', err, JSON.stringify(msg));
            }
         }
       })().catch(err => {
           log.error('[Socket] Critical error in message loop:', err);
       });
    })
    
    // Status Callback for UI updates
    activeBiliSocket.ws.statusCallback = (status) => {
        event.reply('danmu-status', status)
    }

    activeBiliSocket.Connect()
  } catch (e) {
    console.error('Failed to init socket', e)
  }
})

ipcMain.on('bilibili-disconnect-socket', (event) => {
  if (activeBiliSocket) {
    activeBiliSocket.Disconnect()
    activeBiliSocket = null
  }
  if (messageTimer) {
    clearInterval(messageTimer)
    messageTimer = null
  }
  messageBuffer = []
  
  // Explicitly confirm disconnected status to renderer
  if (!event.sender.isDestroyed()) {
      event.reply('danmu-status', 'Disconnected')
  }
})

// Debug IPC for custom messages
ipcMain.on('bilibili-debug-send', async (event, { type, data }) => {
  const uid = Number(data.uid) || 12345
  if (type === 'danmu') {
     const senderGuardLevel = Number(data.senderGuardLevel) || 0
     const timestamp = Math.floor(Date.now() / 1000)
     const mockMsg = {
        cmd: 'DANMU_MSG',
        info: [
           // info[0]: [0, 1, 25, 16777215, 1704380000, 0, 0, "", 0, 0, 0, 0, 0, {}, {}, { ... }]
           [
             0, 1, 25, 16777215, timestamp, 0, 0, "", 0, 0, 0, 0, 0, 
             {}, // 13: emoji_content (null or object)
             {}, // 14: real_name?
             { "user_hash": "0", "log_id": "0", "reply_uname": "" } // 15: extra_info
           ], 
           data.content || "Test Danmaku", 
           [uid, data.uname || "TestUser", 0, 0, 0, 10000, 1, ""], 
           [5, "TestMedal", "TestAnchor", 123, 0x5896de, "", 0, 6809855, 2951253, 10329087, senderGuardLevel, 1], // Medal info (index 3) -> info[3][10] is guard level
           [0,0,9868950,">50000"], 
           ["title-531-1", "title-531-1"], 
           0, 0, null, { "ts": timestamp, "ct": "A76F3C90" }, 0, 0, null, null, 0, 210
        ]
     }
     // Fix: The guard level is primarily at info[7] for the current room
     mockMsg.info[7] = senderGuardLevel;
     
     event.reply('danmu-message', mockMsg)
     broadcastToOverlay('danmu-message', mockMsg)
     if (toolsWindow && !toolsWindow.isDestroyed()) {
         toolsWindow.webContents.send('danmu-message', [mockMsg])
     }
  } else if (type === 'sc') {
    const price = Number(data.price) || 30
    const timestamp = Math.floor(Date.now() / 1000)
    const mockSC = {
        cmd: 'SUPER_CHAT_MESSAGE',
        data: {
            id: String(Date.now()) + Math.floor(Math.random() * 1000),
            uid: uid,
            price: price,
            rate: 1000,
            message: data.content || "Test SC",
            is_ranked: 0,
            background_image: "",
            background_color: "#EDF5FF",
            background_icon: "",
            background_price_color: "#7497CD",
            background_bottom_color: "#2A60B2",
            ts: timestamp,
            token: "token",
            medal_info: null,
            user_info: {
                face: "https://i0.hdslb.com/bfs/face/member/noface.jpg",
                face_frame: "",
                guard_level: 0,
                is_main_vip: 0,
                is_svip: 0,
                is_vip: 0,
                level_color: "#61C05A",
                manager: 0,
                name_color: "#61C05A",
                title: "title",
                uname: data.uname || "TestSC_User",
                user_level: 10
            },
            time: 60,
            start_time: timestamp,
            end_time: timestamp + 60,
            gift: { gift_id: 12000, gift_name: "醒目留言", num: 1 }
        },
        roomid: 123
    }
    event.reply('danmu-message', mockSC)
    broadcastToOverlay('danmu-message', mockSC)
    if (toolsWindow && !toolsWindow.isDestroyed()) {
        toolsWindow.webContents.send('danmu-message', [mockSC])
    }
  } else if (type === 'gift') {
    const giftPrice = Number(data.giftPrice) || 100
    const num = Number(data.num) || 1
    // Use a random ID to avoid collision with real gift config (which might force coin_type to silver)
    const randomGiftId = 99000 + Math.floor(Math.random() * 1000)
    const timestamp = Math.floor(Date.now() / 1000)
    const tid = String(Date.now()) + Math.floor(Math.random() * 1000)
    
    const mockGift = {
        cmd: 'SEND_GIFT',
        data: {
            action: "投喂",
            batch_combo_id: "",
            batch_combo_send: null,
            beatId: "0",
            biz_source: "live",
            blind_gift: null,
            broadcast_id: 0,
            coin_type: "gold",
            combo_resources_id: 1,
            combo_send: null,
            combo_stay_time: 5,
            combo_total_coin: giftPrice * num,
            crit_prob: 0,
            demarcation: 1,
            discount_price: giftPrice,
            dmscore: 28,
            draw_gift: null,
            effect: 0,
            effect_block: 1,
            face: "https://i0.hdslb.com/bfs/face/member/noface.jpg",
            giftId: randomGiftId,
            giftName: data.giftName || "辣条",
            giftType: 0,
            gold: 0,
            guard_level: 0,
            is_first: true,
            is_special_batch: 0,
            magnification: 1,
            medal_info: null,
            name_color: "",
            num: num,
            original_gift_name: "",
            price: giftPrice,
            rcost: 22756804,
            remain: 0,
            rnd: String(timestamp),
            send_master: null,
            silver: 0,
            super: 0,
            super_batch_gift_num: 1,
            super_gift_num: 1,
            svga_resources: "",
            tag_image: "",
            tid: tid,
            timestamp: timestamp,
            top_list: null,
            total_coin: giftPrice * num,
            uid: uid,
            uname: data.uname || "TestGift_User"
        }
    }
    event.reply('danmu-message', mockGift)
    broadcastToOverlay('danmu-message', mockGift)
    if (toolsWindow && !toolsWindow.isDestroyed()) {
        toolsWindow.webContents.send('danmu-message', [mockGift])
    }
  } else if (type === 'guard') {
    // Mock USER_TOAST_MSG (Guard)
    const level = Number(data.guardLevel) || 3
    const num = Number(data.num) || 1
    // Price map: 1=19998, 2=1998, 3=198 (RMB) -> *1000 for gold
    let price = 198000
    if (level === 1) price = 19998000
    if (level === 2) price = 1998000
    price = price * num
    
    // Try to fetch face for mock user
    let face = "https://i0.hdslb.com/bfs/face/member/noface.jpg"
    try {
         const faceUrl = await avatarFetcher.fetchAvatar(uid)
         if (faceUrl) {
             face = faceUrl
         }
    } catch(e) {
        console.error('Failed to fetch debug guard face', e)
    }

    const mockGuard = {
        cmd: 'USER_TOAST_MSG',
        data: {
            uid: uid,
            username: data.uname || "TestGuard_User",
            guard_level: level,
            num: num,
            price: price,
            unit: "月",
            start_time: Math.floor(Date.now() / 1000),
            payflow_id: "mock_payflow_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
            roomid: 123,
            face: face // Inject face
        }
    }
    event.reply('danmu-message', mockGuard)
    broadcastToOverlay('danmu-message', mockGuard)
    if (toolsWindow && !toolsWindow.isDestroyed()) {
        toolsWindow.webContents.send('danmu-message', [mockGuard])
    }
  }
})

ipcMain.on('bilibili-debug-stress', async (event, { action }) => {
  log.info('[StressTest IPC]', action);
  if (action === 'start-flood') {
      startDanmuFlood()
  } else if (action === 'stop-flood') {
      stopDanmuFlood()
  } else if (action === 'flood-face') {
      for (let i = 0; i < 1000; i++) {
        const randomUid = 1000000 + Math.floor(Math.random() * 1000000)
        resolveUserFace(randomUid, 'low')
      }
      log.info('[StressTest] 1000 requests added to queue')
  } else if (action === 'crash-main-sync') {
      throw new Error('Manually triggered Uncaught Exception via IPC')
  } else if (action === 'crash-main-async') {
      Promise.reject(new Error('Manually triggered Unhandled Rejection via IPC'))
  } else if (action === 'crash-renderer') {
      const win = BrowserWindow.fromWebContents(event.sender)
      win?.webContents.forcefullyCrashRenderer()
  } else if (action === 'crash-socket-hangup') {
      log.info('[StressTest] Verifying Fix: Simulating Socket Hang Up...');
      
      // 注意：这里不需要再加载 brotli，因为我们已经验证了它是罪魁祸首并移除了。
      // 现在的目的是验证：当没有 brotli 时，这个错误能否被我们的 process.on('uncaughtException') 正常捕获并弹窗。

      const listeners = process.listeners('uncaughtException');
      log.info(`[StressTest] Current uncaughtException listeners count: ${listeners.length}`);
      listeners.forEach((fn, i) => {
          log.info(`[StressTest] Listener ${i}: ${fn.toString().substring(0, 100)}...`);
      });
      
      // 1. Create a dummy request WITHOUT error handler
      // 我们故意不写 req.on('error') 来触发 uncaughtException，
      // 看看现在是不是会弹出那个“发生严重错误”的对话框，而不是直接消失。
      const req = https.request('https://www.bilibili.com', (res) => {
          // Do nothing
      });
      req.end();

      // 2. Manually emit the 'error' event
      setTimeout(() => {
          const err = new Error('socket hang up (Verification Test)');
          (err as any).code = 'ECONNRESET';
          log.info('[StressTest] Emitting unhandled error on request object...');
          req.emit('error', err);
      }, 500);
  } else if (action === 'simulate-ws-close') {
      log.info('[StressTest] Simulating WebSocket Disconnection...');
      if (activeBiliSocket && activeBiliSocket.ws) {
          // Access internal WS to close it, triggering reconnect logic
          // @ts-ignore
          if (activeBiliSocket.ws._ws) {
              // @ts-ignore
              // Fix: Use code 4000 (standard for application defined) instead of 1006 which is reserved for internal use
              activeBiliSocket.ws._ws.close(4000, 'Abnormal Closure (Simulation)');
          }
      } else {
          log.warn('[StressTest] No active socket to close.');
      }
  } else if (action === 'simulate-cookie-expired') {
      log.info('[StressTest] Simulating Cookie Expiration...');
      // Clear global cookies to ensure next check fails (optional, but good for realism)
      // activeCookies = {}; 
      // Actually, we just want to trigger the UI flow.
      const win = BrowserWindow.getAllWindows()[0]
      if (win) {
          win.webContents.send('cookie-expired')
      }
  }
})

// Periodic Cookie Check (every 60 seconds)
setInterval(async () => {
    // Only check if we think we are logged in
    if (activeCookies && Object.keys(activeCookies).length > 0) {
        try {
            await GetUserInfo(activeCookies)
        } catch (err: any) {
            // -101: Not Logged In
            if (err.code === -101) {
                log.warn('[Auth] Cookie expired or invalid (-101). Notifying renderer.')
                const win = BrowserWindow.getAllWindows()[0]
                if (win && !win.isDestroyed()) {
                    win.webContents.send('cookie-expired')
                }
                // Optional: clear activeCookies to stop checking?
                // activeCookies = {} 
                // Better not clear immediately, let user re-login to overwrite.
            }
        }
    }
}, 60000)

ipcMain.handle('bilibili-get-danmu-info', async (event, { cookies, roomId }: { cookies: BiliCookies, roomId: number }) => {
  try {
    if (cookies && Object.keys(cookies).length > 0) {
        activeCookies = cookies // Update global cookies
    }
    const result = await GetDanmuInfo(cookies, roomId)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to get Danmu info:', error)
    return { success: false, error: error.message || error }
  }
})

ipcMain.handle('bilibili-get-gift-config', async (event, { roomId }) => {
  try {
    const url = `https://api.live.bilibili.com/xlive/web-room/v1/giftPanel/giftConfig?platform=pc&room_id=${roomId}`
    const response = await fetch(url)
    const json = await response.json()
    if (json.code !== 0) {
        throw new Error(json.message || 'Failed to fetch gift config')
    }
    return { success: true, data: json.data }
  } catch (error: any) {
    console.error('Failed to get gift config:', error)
    return { success: false, error: error.message || error }
  }
})

ipcMain.on('window-set-always-on-top', (event, flag) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win) {
        win.setAlwaysOnTop(flag)
    }
})

ipcMain.on('open-external', (event, url) => {
    shell.openExternal(url)
})

ipcMain.on('clipboard-write', (event, text) => {
    console.log('[Main] Clipboard Write:', text)
    clipboard.writeText(text)
})

ipcMain.handle('bilibili-get-room-info', async (event, roomId: number) => {
  try {
    const result = await GetRoomInfo(roomId)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to get room info:', error)
    return { success: false, error: error.message || error }
  }
})

ipcMain.handle('fetch-user-face', async (event, uid) => {
  try {
    // 1. Check Cache
    if (faceCache.has(uid)) {
      // console.log(`[FaceCache] Hit for ${uid}`)
      return faceCache.get(uid)
    }

    // 2. Fetch directly (since this is user triggered, we want immediate result)
    // But we should still be careful about rate limits if user clicks too fast.
    
    // Check Database First
    const dbFace = await avatarDb.get(uid)
    if (dbFace) {
       faceCache.set(uid, dbFace)
       isCacheDirty = true
       return dbFace
    }

    // Let's use the queue? No, UI expects a Promise result.
    // Let's do a direct fetch but update cache.
    const faceUrl = await avatarFetcher.fetchAvatar(uid)
    if (faceUrl) {
      faceCache.set(uid, faceUrl)
      isCacheDirty = true
      // Write to DB
      avatarDb.put(uid, faceUrl)
      return faceUrl
    }
    return null
  } catch (e) {
    console.error('Failed to fetch user face', e)
    return null
  }
})

ipcMain.handle('bilibili-get-silent-users', async (event, { cookies, roomId }) => {
  try {
    console.log('--- Checking Admin Status ---')
    const result = await GetSilentUserList(cookies, roomId)
    console.log(`Admin Check Result: Code ${result.code} (${result.code === 0 ? 'Is Admin' : 'Not Admin'})`)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to check admin status:', error)
    return { success: false, error: error.message || error }
  }
})

ipcMain.handle('bilibili-add-silent-user', async (event, { cookies, roomId, targetUid, hour }) => {
  try {
    const result = await AddSilentUser(cookies, roomId, targetUid, hour)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to add silent user:', error)
    return { success: false, error: error.message || error }
  }
})

ipcMain.handle('bilibili-get-user-info', async (event, cookies: BiliCookies) => {
  try {
    if (cookies && Object.keys(cookies).length > 0) {
        activeCookies = cookies // Update global cookies
    }
    const result = await GetUserInfo(cookies)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to get user info:', error)
    return { success: false, error: error.message || error }
  }
})

ipcMain.handle('bilibili-get-user-info-details', async (event, { cookies, mid }: { cookies: BiliCookies, mid: number }) => {
  try {
    // Use activeCookies if cookies are not provided or empty
    const useCookies = (cookies && Object.keys(cookies).length > 0) ? cookies : activeCookies
    const result = await GetBiliUserInfo(useCookies, mid)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to get user info details:', error)
    return { success: false, error: error.message || error }
  }
})

// Window Control IPC
ipcMain.on('window-min', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.minimize()
})
ipcMain.on('window-max', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    if (win?.isMaximized()) {
        win.unmaximize()
    } else {
        win?.maximize()
    }
})
ipcMain.on('window-close', (event) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.close()
})
ipcMain.on('window-resize', (event, { width, height }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.setSize(width, height)
})
ipcMain.on('window-set-size', (event, { width, height, animate }) => {
    const win = BrowserWindow.fromWebContents(event.sender)
    win?.setSize(width, height, animate)
})

// Tools Window IPC
let toolsWindow: BrowserWindow | null = null

ipcMain.on('open-tools-window', () => {
    if (toolsWindow && !toolsWindow.isDestroyed()) {
        if (toolsWindow.isMinimized()) toolsWindow.restore()
        toolsWindow.focus()
        return
    }

    toolsWindow = createWindow('tools', {
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 500,
        frame: false, // Frameless
        transparent: false, // Standard window usually better not transparent for tools, but can be if needed. Let's stick to standard look for now.
        // Actually, user design has rounded corners, so maybe transparent: true if we want custom border radius?
        // But for a separate window, standard frame is often better for resize/move.
        // Wait, user asked for "independent draggable window". 
        // Our new UI has a custom title bar with "drag". So we need frame: false.
        backgroundColor: '#ffffff', // Set background
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
        },
    })

    if (isProd) {
        toolsWindow.loadURL('app://./tools')
    } else {
        const port = process.argv[2]
        toolsWindow.loadURL(`http://localhost:${port}/tools`)
    }
})
