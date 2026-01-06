import path from 'path'
import { app, ipcMain, Menu, BrowserWindow, shell } from 'electron'
import serve from 'electron-serve'
import { createWindow } from './helpers'
import { GetNewQrCode, CheckQrCodeStatus, GetDanmuInfo, BiliCookies, GetUserInfo, GetRoomInfo, GetSilentUserList, AddSilentUser } from './lib/bilibili_login'
import { BiliWebSocket, WsInfo, PackResult } from './lib/bilibili_socket'

const isProd = process.env.NODE_ENV === 'production'
let activeBiliSocket: BiliWebSocket | null = null

if (isProd) {
  serve({ directory: 'app' })
} else {
  app.setPath('userData', `${app.getPath('userData')} (development)`)
}

;(async () => {
  await app.whenReady()

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
  app.quit()
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
  
  try {
    activeBiliSocket = new BiliWebSocket(wsInfo, (packet: PackResult) => {
       // Filter for DANMU_MSG or other interest
       packet.body.forEach(msg => {
          // console.log('Forwarding MSG:', msg.cmd) // Debug
          if (msg.cmd === 'DANMU_MSG') {
            event.reply('danmu-message', msg)
          } else if (msg.cmd === 'INTERACT_WORD' || msg.cmd === 'INTERACT_WORD_V2' || msg.cmd === 'ENTRY_EFFECT') {
            // Someone entered or followed
            event.reply('danmu-message', msg)
          } else if (msg.cmd === 'SEND_GIFT') {
            event.reply('danmu-message', msg)
          } else if (msg.cmd === 'SUPER_CHAT_MESSAGE') {
            event.reply('danmu-message', msg)
          } else if (msg.cmd === 'ONLINE_RANK_COUNT') {
             // High Energy / Online Count Update
             event.reply('danmu-message', msg)
          } else if (msg.cmd === 'STOP_LIVE_ROOM_LIST') {
             // System message, ignore in production
             // console.log('Ignored system msg:', msg.cmd)
          }
       })
    })
    activeBiliSocket.Connect()
  } catch (e) {
    console.error('Failed to init socket', e)
  }
})

ipcMain.on('bilibili-disconnect-socket', () => {
  if (activeBiliSocket) {
    activeBiliSocket.Disconnect()
    activeBiliSocket = null
  }
})

// Debug IPC for custom messages
ipcMain.on('bilibili-debug-send', (event, { type, data }) => {
  const uid = Number(data.uid) || 12345
  if (type === 'danmu') {
     const senderGuardLevel = Number(data.senderGuardLevel) || 0
     const mockMsg = {
        cmd: 'DANMU_MSG',
        info: [
           // info[0]: [0, 1, 25, 16777215, 1704380000, 0, 0, "", 0, 0, 0, 0, 0, {}, {}, { ... }]
           [
             0, 1, 25, 16777215, 1704380000, 0, 0, "", 0, 0, 0, 0, 0, 
             {}, // 13: emoji_content (null or object)
             {}, // 14: real_name?
             { "user_hash": "0", "log_id": "0", "reply_uname": "" } // 15: extra_info
           ], 
           data.content || "Test Danmaku", 
           [uid, data.uname || "TestUser", 0, 0, 0, 10000, 1, ""], 
           [5, "TestMedal", "TestAnchor", 123, 0x5896de, "", 0, 6809855, 2951253, 10329087, senderGuardLevel, 1], 
           [0,0,9868950,">50000"], 
           ["title-531-1", "title-531-1"], 
           0, 0, null, { "ts": 1704380000, "ct": "A76F3C90" }, 0, 0, null, null, 0, 210
        ]
     }
     event.reply('danmu-message', mockMsg)
  } else if (type === 'sc') {
    const price = Number(data.price) || 30
    const mockSC = {
        cmd: 'SUPER_CHAT_MESSAGE',
        data: {
            id: Math.floor(Math.random() * 100000),
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
            ts: 1704380000,
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
            start_time: 1704380000,
            end_time: 1704380060,
            gift: { gift_id: 12000, gift_name: "醒目留言", num: 1 }
        },
        roomid: 123
    }
    event.reply('danmu-message', mockSC)
  } else if (type === 'gift') {
    const giftPrice = Number(data.giftPrice) || 100
    const num = Number(data.num) || 1
    // Use a random ID to avoid collision with real gift config (which might force coin_type to silver)
    const randomGiftId = 99000 + Math.floor(Math.random() * 1000)
    
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
            rnd: "1704380000",
            send_master: null,
            silver: 0,
            super: 0,
            super_batch_gift_num: 1,
            super_gift_num: 1,
            svga_resources: "",
            tag_image: "",
            tid: "1704380000",
            timestamp: Math.floor(Date.now() / 1000),
            top_list: null,
            total_coin: giftPrice * num,
            uid: uid,
            uname: data.uname || "TestGift_User"
        }
    }
    event.reply('danmu-message', mockGift)
  } else if (type === 'guard') {
    // Mock USER_TOAST_MSG (Guard)
    const level = Number(data.guardLevel) || 3
    const num = Number(data.num) || 1
    // Price map: 1=19998, 2=1998, 3=198 (RMB) -> *1000 for gold
    let price = 198000
    if (level === 1) price = 19998000
    if (level === 2) price = 1998000
    price = price * num

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
            payflow_id: "mock_payflow_" + Date.now(),
            roomid: 123
        }
    }
    event.reply('danmu-message', mockGuard)
  }
})

ipcMain.handle('bilibili-get-danmu-info', async (event, { cookies, roomId }: { cookies: BiliCookies, roomId: number }) => {
  try {
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

ipcMain.handle('bilibili-get-room-info', async (event, roomId: number) => {
  try {
    const result = await GetRoomInfo(roomId)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to get room info:', error)
    return { success: false, error: error.message || error }
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
    const result = await GetUserInfo(cookies)
    return { success: true, data: result }
  } catch (error: any) {
    console.error('Failed to get user info:', error)
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
