import React, { useEffect, useLayoutEffect, useState, useRef, useMemo, useCallback } from 'react'
import Head from 'next/head'
import QRCode from 'qrcode'
import { getQrCode, checkQrCode, QrCodeStatus, getDanmuInfo, getGiftConfig } from '@/lib/bilibili'
import { createDanmuEntry } from '@/lib/common/danmu-entry'
import { DanmuMessage, GiftMessage, SuperChatMessage, GuardMessage } from '@/lib/types/danmaku'
import { fetchGifts, fetchScs, fetchSubs } from '@/lib/cloud-api'
import moment from 'moment'

// Page Components
import LoginPage from '@/components/pages/LoginPage'
import RoomSelectPage from '@/components/pages/RoomSelectPage'
import ConsolePage from '@/components/pages/ConsolePage'

export default function HomePage() {
  const [qrImage, setQrImage] = useState('')
  const [status, setStatus] = useState('初始化中...')
  const [loggedIn, setLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const userInfoRef = useRef(userInfo)
  useEffect(() => { userInfoRef.current = userInfo }, [userInfo])
  
  // 弹幕状态
  const [roomId, setRoomId] = useState('')
  const [danmuStatus, setDanmuStatus] = useState('Disconnected')
  const [showConsole, setShowConsole] = useState(false)
  
  // 重新登录遮罩状态
  const [showReloginModal, setShowReloginModal] = useState(false)
  const [reloginQr, setReloginQr] = useState('')
  const [reloginStatus, setReloginStatus] = useState('初始化中...')
  const reloginPollTimer = useRef(null)

  // 监听 Cookie 过期事件
  useEffect(() => {
      const handleCookieExpired = () => {
          console.log('Cookie expired event received')
          if (!showReloginModal) {
              setShowReloginModal(true)
              initRelogin()
          }
      }
      window.ipc.on('cookie-expired', handleCookieExpired)
      return () => {
          window.ipc.removeAllListeners('cookie-expired')
          if (reloginPollTimer.current) clearInterval(reloginPollTimer.current)
      }
  }, [])

  const initRelogin = async () => {
      try {
          if (reloginPollTimer.current) clearInterval(reloginPollTimer.current)
          setReloginStatus('正在获取二维码...')
          setReloginQr('')
          
          const { url, oauthKey } = await getQrCode()
          const dataUrl = await QRCode.toDataURL(url)
          setReloginQr(dataUrl)
          setReloginStatus('请使用哔哩哔哩手机客户端扫码')
          
          reloginPollTimer.current = setInterval(async () => {
              try {
                  const data = await checkQrCode(oauthKey)
                  if (data.status === QrCodeStatus.Success) {
                      clearInterval(reloginPollTimer.current)
                      setReloginStatus('登录成功！')
                      setLoggedIn(true)
                      setUserInfo(data.cookies)
                      // 更新主进程 Cookies 和用户信息
                      fetchUserInfo(data.cookies)
                      
                      // 延迟关闭遮罩
                      setTimeout(() => {
                          setShowReloginModal(false)
                      }, 1000)
                  } else if (data.status === QrCodeStatus.NeedConfirm) {
                      setReloginStatus('已扫码，请在手机上确认')
                  }
              } catch (e) {
                  console.log('Relogin Poll error:', e)
                  setReloginStatus('二维码已过期，刷新中...')
                  clearInterval(reloginPollTimer.current)
                  setTimeout(initRelogin, 1000)
              }
          }, 3000)
      } catch (e) {
          console.error(e)
          setReloginStatus('错误: ' + e.message)
      }
  }

  const cancelRelogin = () => {
      setShowReloginModal(false)
      if (reloginPollTimer.current) clearInterval(reloginPollTimer.current)
  }
  
  // 数据列表拆分
  const [danmuList, setDanmuList] = useState([]) // 普通弹幕 + 系统消息 (限制长度)
  const [scList, setScList] = useState([])       // 醒目留言 (保留所有)
  const [giftList, setGiftList] = useState([])   // 礼物 + 舰长 (保留所有)
  
  const danmuListRef = useRef(null)
  const renderBuffer = useRef([]) // 渲染缓冲区
  const [maxDanmuLimit, setMaxDanmuLimit] = useState(1000) // 弹幕保留数量上限
  const [receivedDanmuCount, setReceivedDanmuCount] = useState(0) // 总接收弹幕计数

  // 定时处理渲染缓冲区 (200ms)
  useEffect(() => {
    const timer = setInterval(() => {
      const msgs = renderBuffer.current
      if (msgs.length === 0) return
      
      renderBuffer.current = [] // 清空缓冲区
      
      const newDanmu = []
      const newSc = []
      const newGift = []
      let lastOnlineCount = null
      
      msgs.forEach(msg => {
         // 处理高能榜更新
         if (msg.cmd === 'ONLINE_RANK_COUNT') {
             if (msg.data && typeof msg.data.count === 'number') {
                 lastOnlineCount = msg.data.count
             }
             return
         }
         
         let newItem = null;
         let listType = 'danmu'; 
         
         if (msg.cmd === 'DANMU_MSG') {
             try {
                // 普通弹幕ID通常在info[0][15]['id_str'] 或者 info[9]['ct'] (timestamp)
                // 这里暂时保持随机，弹幕暂不云同步去重
                newItem = { id: Math.random(), type: 'msg', data: new DanmuMessage({ info: msg.info }) }
                listType = 'danmu'
             } catch(e) { console.error(e); return; }
         } else if (msg.cmd === 'SEND_GIFT') {
             try {
                // 使用 tid 作为 ID
                const giftData = new GiftMessage(msg)
                newItem = { id: giftData.id || Math.random(), type: 'gift', data: giftData }
                listType = 'gift'
             } catch(e) { console.error(e); return; }
         } else if (msg.cmd === 'SUPER_CHAT_MESSAGE') {
             try {
                // 使用 id 作为 ID
                const scData = new SuperChatMessage(msg)
                newItem = { id: scData.id, type: 'superchat', data: scData }
                listType = 'sc'
             } catch(e) { console.error(e); return; }
         } else if (msg.cmd === 'USER_TOAST_MSG') {
             try {
                // 舰长 使用 payflow_id 作为 ID
                const guardData = new GuardMessage(msg)
                newItem = { id: guardData.id, type: 'gift', data: guardData }
                listType = 'gift'
             } catch(e) { console.error(e); return; }
         } else if (msg.cmd === 'SYSTEM_MSG') {
                newItem = { id: Math.random(), type: 'system', data: msg.msg }
                listType = 'danmu'
         }

         if (!newItem) return;

         if (listType === 'danmu') newDanmu.push(newItem)
         else if (listType === 'sc') newSc.push(newItem)
         else if (listType === 'gift') newGift.push(newItem)
      })
      
      // 批量更新状态
      if (lastOnlineCount !== null) {
          const prevCount = prevOnlineCountRef.current
          if (lastOnlineCount > prevCount) setOnlineTrend('up')
          else if (lastOnlineCount < prevCount) setOnlineTrend('down')
          
          prevOnlineCountRef.current = lastOnlineCount
          setOnlineCount(lastOnlineCount)
      }
      
      if (newDanmu.length > 0) {
          // 更新总计数
          setReceivedDanmuCount(prev => prev + newDanmu.length)
          
          setDanmuList(prev => {
              // 倒序插入，保持最新的在最前
              const updated = [...newDanmu.reverse(), ...prev]
              // 限制最大长度 (使用 state 中的配置)
              if (updated.length > maxDanmuLimit) {
                  return updated.slice(0, maxDanmuLimit)
              }
              return updated
          })
      }
      
      if (newSc.length > 0) {
           setScList(prev => {
               const updated = [...newSc.reverse(), ...prev]
               return updated.slice(0, 500) // 限制 SC 列表长度
           })
      }
      
      if (newGift.length > 0) {
           setGiftList(prev => {
               const updated = [...newGift.reverse(), ...prev]
               return updated // 不限制礼物列表长度
           })
      }
      
    }, 200) // 每秒 5 次刷新
    
    return () => clearInterval(timer)
  }, [maxDanmuLimit]) // 依赖 maxDanmuLimit 以便更新 slice 逻辑

  // 房间信息（标题、状态等）
  const [roomInfo, setRoomInfo] = useState(null)
  const [onlineCount, setOnlineCount] = useState(0) // 高能值 (Online Rank Count)
  const [onlineTrend, setOnlineTrend] = useState(null) // 'up' | 'down'
  const prevOnlineCountRef = useRef(0)
  const roomInfoTimer = useRef(null)
  
  // 是否是当前房间管理员
  const [isAdmin, setIsAdmin] = useState(false)

  const fetchRoomInfo = async (rid) => {
      try {
          const res = await window.ipc.invoke('bilibili-get-room-info', Number(rid))
          if (res.success) {
              setRoomInfo(res.data)
          }
      } catch (e) {
          console.error('Failed to fetch room info', e)
      }
  }
  
  // 礼物配置缓存
  const [giftMap, setGiftMap] = useState({}) 
  // 礼物过滤器
  const [minGiftPrice, setMinGiftPrice] = useState(0.1) // RMB
  const [enableCloudSync, setEnableCloudSync] = useState(false) // 是否开启云同步
  const [showGiftSettings, setShowGiftSettings] = useState(false)
  
  // 弹幕过滤器
  const [showDanmuFilter, setShowDanmuFilter] = useState(false)
  const [danmuFilter, setDanmuFilter] = useState({
      keyword: '',
      enableUser: true,
      enableContent: true,
      enableUid: true
  })
  
  // 调试状态
  const [showDebug, setShowDebug] = useState(false)
  
  const openToolsWindow = () => {
      window.ipc.send('open-tools-window')
  }

  // 窗口状态
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  const [isBorderless, setIsBorderless] = useState(false) // 无边框模式状态

  const toggleAlwaysOnTop = () => {
      const newState = !isAlwaysOnTop
      setIsAlwaysOnTop(newState)
      window.ipc.send('window-set-always-on-top', newState)
  }

  const toggleBorderlessMode = () => {
      const newState = !isBorderless
      setIsBorderless(newState)
      if (newState) {
          // Enter Borderless: Resize to narrow strip
          window.ipc.send('window-set-size', { width: 320, height: 700, animate: true })
      } else {
          // Exit Borderless: Restore size
          window.ipc.send('window-set-size', { width: 1080, height: 650, animate: true })
      }
  }
  
  // 界面设置
  const [showSettings, setShowSettings] = useState(false)
  const [uiScale, setUiScale] = useState(1.0)
  const [fontSize, setFontSize] = useState(14)

  // 房间历史记录
  const [roomHistory, setRoomHistory] = useState([])
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const wrapperRef = useRef(null)
  
  // 筛选器 Refs (用于点击外部收起)
  const danmuFilterRef = useRef(null)
  const giftSettingsRef = useRef(null)
  const scSettingsRef = useRef(null)
  const settingsPanelRef = useRef(null) // 设置面板 Ref
  const settingsBtnRef = useRef(null)   // 设置按钮 Ref
  const [showScSettings, setShowScSettings] = useState(false)
  
  // OBS 帮助面板状态
  const [showObsHelp, setShowObsHelp] = useState(false)
  const obsHelpPanelRef = useRef(null)
  const obsHelpBtnRef = useRef(null)

  useEffect(() => {
      const handleClickOutsidePanels = (event) => {
          if (showDanmuFilter && danmuFilterRef.current && !danmuFilterRef.current.contains(event.target)) {
              setShowDanmuFilter(false)
          }
          if (showGiftSettings && giftSettingsRef.current && !giftSettingsRef.current.contains(event.target)) {
              setShowGiftSettings(false)
          }
          if (showScSettings && scSettingsRef.current && !scSettingsRef.current.contains(event.target)) {
              setShowScSettings(false)
          }
          // 点击外部关闭设置面板
          if (showSettings && settingsPanelRef.current && !settingsPanelRef.current.contains(event.target)) {
              // 如果点击的是设置按钮本身，不要在这里关闭（交给按钮的 onClick 处理）
              if (settingsBtnRef.current && settingsBtnRef.current.contains(event.target)) {
                  return
              }
              setShowSettings(false)
          }
          // 点击外部关闭 OBS 面板
          if (showObsHelp && obsHelpPanelRef.current && !obsHelpPanelRef.current.contains(event.target)) {
              if (obsHelpBtnRef.current && obsHelpBtnRef.current.contains(event.target)) {
                  return
              }
              setShowObsHelp(false)
          }
      }
      document.addEventListener('mousedown', handleClickOutsidePanels)
      return () => document.removeEventListener('mousedown', handleClickOutsidePanels)
  }, [showDanmuFilter, showGiftSettings, showScSettings, showSettings, showObsHelp])

  // 用户操作菜单状态
  const [selectedUser, setSelectedUser] = useState(null) // { user: {uid, uname, face}, position: {x, y} }

  // 重点关注用户 (存储 UID 字符串)
  const [highlightedUsers, setHighlightedUsers] = useState(new Set())
  
  // 已读消息 (存储消息 ID)
  const [readMessages, setReadMessages] = useState(new Set())

  const handleToggleRead = useCallback((id) => {
      setReadMessages(prev => {
          const newSet = new Set(prev)
          if (newSet.has(id)) {
              newSet.delete(id)
          } else {
              newSet.add(id)
          }
          return newSet
      })
  }, [])

  const handleMarkAllRead = (type) => {
      setReadMessages(prev => {
          const newSet = new Set(prev)
          
          if (type === 'superchat') {
              scList.forEach(item => newSet.add(item.id))
          } else if (type === 'gift') {
              giftList.forEach(item => newSet.add(item.id))
          }
          
          return newSet
      })
  }

  const handleMarkAllUnread = (type) => {
      setReadMessages(prev => {
          const newSet = new Set(prev)
          
          if (type === 'superchat') {
              scList.forEach(item => newSet.delete(item.id))
          } else if (type === 'gift') {
              giftList.forEach(item => newSet.delete(item.id))
          }

          return newSet
      })
  }

  const handleHighlightUser = (user) => {
      setHighlightedUsers(prev => {
          const newSet = new Set(prev)
          const uid = String(user.uid)
          if (newSet.has(uid)) {
              newSet.delete(uid) // 再次点击取消关注
          } else {
              newSet.add(uid)
          }
          return newSet
      })
      setSelectedUser(null)
  }

  const handleMuteUser = async (targetUser, hour) => {
      try {
          if (!userInfo || !userInfo.SESSDATA) {
              addSystemMessage('禁言失败: 未登录')
              return
          }
          const res = await window.ipc.invoke('bilibili-add-silent-user', {
              cookies: userInfo,
              roomId: Number(roomId),
              targetUid: targetUser.uid,
              hour: hour
          })
          
          let durationLabel = `${hour}小时`
          if (hour === 0) durationLabel = '本场直播'
          if (hour === -1) durationLabel = '永久'
          if (hour === 168) durationLabel = '7天'
          if (hour === 720) durationLabel = '30天'
          
          if (res.success && res.data.code === 0) {
              addSystemMessage(`已禁言用户 ${targetUser.uname} (${durationLabel})`)
          } else {
              addSystemMessage(`禁言失败: ${res.data?.message || res.error}`)
          }
      } catch (e) {
          console.error(e)
          addSystemMessage('禁言操作出错')
      }
      setSelectedUser(null)
  }

  const handleUserClick = useCallback((e, user) => {
      e.stopPropagation()
      
      const rect = e.currentTarget.getBoundingClientRect()
      
      let x = rect.left
      let y = rect.bottom
      
      if (x + 280 > window.innerWidth) {
          x = window.innerWidth - 290
      }
      
      if (y + 300 > window.innerHeight) {
          y = rect.top - 300
      }
      
      setSelectedUser(prev => {
          if (prev && String(prev.user.uid) === String(user.uid)) {
              return null
          }
          return { user, position: { x, y } }
      })

      // Fetch face if missing
      if (!user.face && user.uid) {
          window.ipc.invoke('bilibili-get-user-info-details', { 
              cookies: userInfoRef.current || {}, 
              mid: user.uid 
          }).then(res => {
              if (res.success && res.data.face) {
                  setSelectedUser(current => {
                      if (current && String(current.user.uid) === String(user.uid)) {
                          return {
                              ...current,
                              user: { ...current.user, face: res.data.face }
                          }
                      }
                      return current
                  })
              }
          }).catch(err => console.error('Failed to fetch user face:', err))
      }
  }, []) 
  
  const handleFilterUser = (user) => {
      setDanmuFilter({
          keyword: String(user.uid),
          enableUser: false,
          enableContent: false,
          enableUid: true
      })
      // setShowDanmuFilter(true) // Don't auto open
      setSelectedUser(null)
  }

  const shouldShowItem = (item) => {
      // 如果没有关键词，全部显示
      if (!danmuFilter.keyword) return true
      
      const kw = danmuFilter.keyword.toLowerCase()
      
      // 系统消息
      if (item.type === 'system') {
           return item.data.toLowerCase().includes(kw)
      }
      
      let uname = '', content = '', uid = ''
      
      if (item.type === 'msg' || item.type === 'danmu') {
          uname = item.data.sender?.uname || ''
          content = item.data.content || ''
          uid = String(item.data.sender?.uid || '')
      } else if (item.type === 'superchat') {
          uname = item.data.sender?.uname || ''
          content = item.data.message || ''
          uid = String(item.data.sender?.uid || '')
      } else if (item.type === 'gift') {
          uname = item.data.sender?.uname || ''
          content = item.data.gift_info?.name || ''
          uid = String(item.data.sender?.uid || '')
      } else {
          return true
      }
      
      let match = false
      if (danmuFilter.enableUser && uname.toLowerCase().includes(kw)) match = true
      if (danmuFilter.enableContent && content.toLowerCase().includes(kw)) match = true
      if (danmuFilter.enableUid && uid === kw) match = true
      
      return match
  }

  // 加载设置和历史记录
  useEffect(() => {
      const savedScale = localStorage.getItem('uiScale')
      const savedFont = localStorage.getItem('fontSize')
      const savedLimit = localStorage.getItem('maxDanmuLimit')
      
      if (savedScale) setUiScale(parseFloat(savedScale))
      if (savedFont) setFontSize(parseInt(savedFont))
      if (savedLimit) setMaxDanmuLimit(parseInt(savedLimit))
      
      const savedHistory = localStorage.getItem('roomHistory')
      if (savedHistory) {
          const parsed = JSON.parse(savedHistory)
          setRoomHistory(parsed)
          // 自动填入最近一次的直播间 ID
          if (parsed.length > 0) {
              const last = parsed[0]
              const lastId = typeof last === 'object' ? String(last.room_id) : String(last)
              setRoomId(lastId)
          }
      } else {
          setRoomHistory(['21013446'])
      }

      const handleClickOutside = (event) => {
          if (wrapperRef.current && !wrapperRef.current.contains(event.target)) {
              setShowHistoryDropdown(false)
          }
      }
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])
  
  const saveToHistory = (roomInfo) => {
      if (!roomInfo) return
      // roomInfo 可能是纯 ID 字符串（旧数据或简单调用）或对象
      const id = typeof roomInfo === 'object' ? String(roomInfo.room_id) : String(roomInfo)
      if (!id) return

      let newHistory = roomHistory.filter(h => {
          const hId = typeof h === 'object' ? String(h.room_id) : String(h)
          return hId !== id
      })
      
      // 如果是对象，直接存；如果是 ID，尝试保留旧的对象信息（如果存在），否则存 ID
      let newItem = roomInfo
      if (typeof roomInfo !== 'object') {
          // 查找旧数据中是否有此 ID 的详细信息
          const oldItem = roomHistory.find(h => {
              const hId = typeof h === 'object' ? String(h.room_id) : String(h)
              return hId === id
          })
          if (oldItem && typeof oldItem === 'object') {
              newItem = oldItem
          }
      }

      newHistory = [newItem, ...newHistory]
      newHistory = newHistory.slice(0, 10)
      setRoomHistory(newHistory)
      localStorage.setItem('roomHistory', JSON.stringify(newHistory))
  }
  
  const deleteHistory = (e, id) => {
      e.stopPropagation()
      const newHistory = roomHistory.filter(h => {
          const hId = typeof h === 'object' ? String(h.room_id) : String(h)
          return hId !== String(id)
      })
      setRoomHistory(newHistory)
      localStorage.setItem('roomHistory', JSON.stringify(newHistory))
  }

  // 保存设置
  const saveSettings = (scale, font, limit) => {
      setUiScale(scale)
      setFontSize(font)
      setMaxDanmuLimit(limit)
      localStorage.setItem('uiScale', scale.toString())
      localStorage.setItem('fontSize', font.toString())
      localStorage.setItem('maxDanmuLimit', limit.toString())
  }
  
  // 列宽（百分比）
  // 初始值：普通弹幕 36%，剩下两列平分剩余空间 (32%)
  const [colWidths, setColWidths] = useState([36, 32, 32])
  const containerRef = useRef(null)

  // 统计信息
  const stats = useMemo(() => {
      // let danmuCount = 0 // Removed, use receivedDanmuCount instead
      let scTotal = 0
      let giftTotal = 0
      
      // 统计 SC
      scList.forEach(item => {
          if (item.type === 'superchat') {
              scTotal += item.data.price
          }
      })
      
      // 统计礼物
      giftList.forEach(item => {
          if (item.type === 'gift') {
              const msg = item.data
              // 处理舰长
              if (msg instanceof GuardMessage || msg.guard_level) {
                  giftTotal += (msg.price / 1000)
              } else {
                  // 处理普通礼物
                  const config = giftMap[msg.gift_info.id]
                  // 优先使用配置中的价格，否则使用消息中的价格
                  const price = config ? config.price : msg.gift_info.price
                  const coinType = config ? config.coin_type : (msg.gift_info.price > 0 ? 'gold' : 'silver')
                  
                  if (price > 0 && coinType === 'gold') {
                      giftTotal += (price * msg.num) / 1000
                  }
              }
          }
      })
      
      return { 
          danmuCount: receivedDanmuCount, 
          scTotal: scTotal, 
          giftTotal: giftTotal
      }
  }, [receivedDanmuCount, scList, giftList, giftMap])

  const pollTimer = useRef(null)

  // 拖拽处理
  const startResize = (index, e) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidths = [...colWidths]
      const containerWidth = containerRef.current.getBoundingClientRect().width
      
      const onMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startX
          const deltaPercent = (deltaX / containerWidth) * 100
          
          const newWidths = [...startWidths]
          // 调整当前列和下一列
          // 限制：最小宽度 10%
          const minWidth = 10
          
          let newCurrent = startWidths[index] + deltaPercent
          let newNext = startWidths[index+1] - deltaPercent
          
          if (newCurrent < minWidth) {
              const diff = minWidth - newCurrent
              newCurrent = minWidth
              newNext -= diff
          }
          if (newNext < minWidth) {
               const diff = minWidth - newNext
               newNext = minWidth
               newCurrent -= diff
          }
          
          newWidths[index] = newCurrent
          newWidths[index+1] = newNext
          
          setColWidths(newWidths)
      }
      
      const onMouseUp = () => {
          document.removeEventListener('mousemove', onMouseMove)
          document.removeEventListener('mouseup', onMouseUp)
      }
      
      document.addEventListener('mousemove', onMouseMove)
      document.addEventListener('mouseup', onMouseUp)
  }

  const handleCloudSync = useCallback(async (customStartTime = null) => {
    // Helper to send log to main process
    const logToMain = (level, message, ...args) => {
        // Send to main process via IPC
        if (window.ipc) {
            window.ipc.send('renderer-log', level, message, ...args)
        }
        // Also keep local console for devtools
        console[level](message, ...args)
    }

    logToMain('info', '[CloudSync] Starting sync...', { customStartTime })
    let startTime = customStartTime

    // Check if cloud sync is enabled
    if (!enableCloudSync && !customStartTime) {
        if (!customStartTime) {
             logToMain('info', '[CloudSync] Skipped: Feature disabled')
             return
        }
    }
    
    // Auto sync check
    if (!startTime) {
        if (!roomInfo || Number(roomInfo.room_id) !== 21013446 || roomInfo.live_status !== 1) {
            logToMain('info', '[CloudSync] Skipped: Not in target room or not live', { roomInfo })
            return
        }
        startTime = (roomInfo.live_start_time || 0) * 1000
    }
    
    if (!startTime) {
        logToMain('info', '[CloudSync] Skipped: No start time')
        return
    }

    logToMain('info', '[CloudSync] Fetching data from:', new Date(startTime).toLocaleString())

    try {
      // Parallel fetch with individual error handling to prevent total failure
      const [giftsRes, scsRes, subsRes] = await Promise.all([
        fetchGifts({ start: startTime, limit: 100 }).catch(e => {
            logToMain('warn', '[CloudSync] Fetch gifts failed', e)
            return []
        }), 
        fetchScs({ start: startTime, limit: 100 }).catch(e => {
            logToMain('warn', '[CloudSync] Fetch SCs failed', e)
            return []
        }),
        fetchSubs({ start: startTime, limit: 100 }).catch(e => {
            logToMain('warn', '[CloudSync] Fetch subs failed', e)
            return []
        })
      ])

      logToMain('info', '[CloudSync] Fetch results:', { 
          gifts: giftsRes?.length || 0, 
          scs: scsRes?.length || 0, 
          subs: subsRes?.length || 0 
      })

      setScList(prev => {
        const newItems = []
        const existingIds = new Set(prev.map(item => item.data.id))
        
        if (scsRes && Array.isArray(scsRes)) {
            for (const item of scsRes) {
                const id = item.id
                if (existingIds.has(id)) continue

                let raw = null
                if (item.originalEvent) {
                    try {
                        raw = typeof item.originalEvent === 'string' ? JSON.parse(item.originalEvent) : item.originalEvent
                    } catch (e) {}
                }

                // Basic Info
                let content = item.content || item.message
                let price = item.price
                let ts = Number(item.timestamp) || 0
                
                if (raw) {
                    if (raw.message) content = raw.message
                    if (raw.price) price = raw.price
                    if (raw.start_time) ts = Number(raw.start_time)
                }
                
                if (!ts && item.time) ts = new Date(item.time).getTime() / 1000
                if (isNaN(ts) || ts <= 0) ts = Date.now() / 1000

                // User Info
                let uinfo = { uid: 0, uname: '未知用户', face: '' }
                
                // Try from raw.uinfo first (as per user sample)
                if (raw && raw.uinfo) {
                     if (raw.uinfo.user_info) {
                         uinfo.uname = raw.uinfo.user_info.uname || uinfo.uname
                         uinfo.face = raw.uinfo.user_info.face || uinfo.face
                     } else if (raw.uinfo.base) {
                         uinfo.uname = raw.uinfo.base.name || uinfo.uname
                         uinfo.face = raw.uinfo.base.face || uinfo.face
                     }
                }
                
                // Try from raw root
                if (raw) {
                    if (raw.uid) uinfo.uid = raw.uid
                    if (!uinfo.uname || uinfo.uname === '未知用户') {
                         if (raw.user_info && raw.user_info.uname) uinfo.uname = raw.user_info.uname
                    }
                }

                // Fallback to item
                if (!uinfo.uid) {
                    if (typeof item.sender === 'number') uinfo.uid = item.sender
                    else if (item.sender && item.sender.uid) uinfo.uid = item.sender.uid
                    else if (item.uid) uinfo.uid = item.uid
                }
                
                if (!uinfo.uname || uinfo.uname === '未知用户') {
                     if (item.uname) uinfo.uname = item.uname
                }

                // Medal Info
                let medalInfo = null
                if (raw && raw.medal_info) {
                    medalInfo = raw.medal_info
                }

                const mockBody = {
                    roomid: 21013446,
                    data: {
                        id: id,
                        uid: uinfo.uid,
                        user_info: {
                            uname: uinfo.uname,
                            face: uinfo.face
                        },
                        medal_info: medalInfo,
                        message: content,
                        price: price,
                        start_time: ts
                    }
                }
                
                const msg = new SuperChatMessage(mockBody)
                msg.is_cloud = true
                newItems.push({ id: Math.random(), type: 'superchat', data: msg, sortTime: ts })
                existingIds.add(id)
            }
        }
        
        if (newItems.length === 0) return prev
        
        logToMain('info', `[CloudSync] Added ${newItems.length} SCs`)
        
        const combined = [...prev, ...newItems]
        return combined.sort((a, b) => {
             const getTs = (x) => x.sortTime || x.data.start_time || x.data.timestamp || 0
             return getTs(b) - getTs(a)
        })
      })

      // Combine Gifts and Subs processing
      setGiftList(prev => {
          const newItems = []
          const existingIds = new Set(prev.map(item => item.data.id || item.data.tid || item.data.payflow_id))
          
          // --- Process Gifts ---
          if (giftsRes && Array.isArray(giftsRes)) {
             for (const item of giftsRes) {
                 const id = item.tid || item.id
                 if (existingIds.has(id)) continue;
                 
                 // Parse originalEvent first as it contains the most complete info
                 let raw = null
                 if (item.originalEvent) {
                     try {
                         raw = typeof item.originalEvent === 'string' ? JSON.parse(item.originalEvent) : item.originalEvent
                     } catch (e) {}
                 }

                 // Filter > 29 yuan
                 // Check price from raw first if available, otherwise item.price
                 let price = item.price
                 if (raw && raw.price) price = raw.price
                 if ((price || 0) <= 29000) continue
                 
                 // User Info Extraction
                 let uinfo = { uid: item.uid, uname: item.uname || '未知用户', face: '' }
                 
                 if (raw) {
                     // Try extracting from originalEvent (most reliable based on user input)
                     if (raw.sender_uinfo && raw.sender_uinfo.base) {
                         uinfo.uid = raw.sender_uinfo.uid || raw.uid || uinfo.uid
                         uinfo.uname = raw.sender_uinfo.base.name || uinfo.uname
                         uinfo.face = raw.sender_uinfo.base.face || uinfo.face
                     } else {
                         if (raw.uid) uinfo.uid = raw.uid
                         if (raw.uname) uinfo.uname = raw.uname
                         if (raw.face) uinfo.face = raw.face
                     }
                 }
                 
                 // Fallback to item properties if still missing info
                 if (uinfo.uname === '未知用户' || !uinfo.face) {
                     if (item.sender_uinfo && item.sender_uinfo.base) {
                         uinfo = { uid: item.sender_uinfo.uid, uname: item.sender_uinfo.base.name, face: item.sender_uinfo.base.face }
                     } else if (item.user_info) {
                         uinfo = { uid: item.uid || item.user_info.uid, uname: item.user_info.uname || item.user_info.name, face: item.user_info.face }
                     } else if (item.sender && typeof item.sender === 'object') {
                         uinfo = { uid: item.sender.uid, uname: item.sender.uname, face: item.sender.face }
                     } else if (typeof item.sender === 'number' || typeof item.sender === 'string') {
                         // If sender is just ID and we didn't get info from raw
                         if (!uinfo.uid) uinfo.uid = item.sender
                     }
                 }
                 
                 // Time
                 let ts = Number(item.timestamp) || 0
                 if (!ts && item.time) ts = new Date(item.time).getTime() / 1000
                 if (raw && raw.timestamp) ts = Number(raw.timestamp) || ts
                 
                 // Ensure ts is valid number
                 if (isNaN(ts) || ts <= 0) ts = Date.now() / 1000
                 
                 // Extract medal info from raw
                 let medalInfo = null
                 if (raw) {
                     if (raw.medal_info) {
                         medalInfo = raw.medal_info
                     } else if (raw.sender_uinfo && raw.sender_uinfo.medal) {
                          // Standardize to Bilibili medal_info format
                          const m = raw.sender_uinfo.medal
                          medalInfo = {
                              medal_name: m.name,
                              medal_level: m.level,
                              is_lighted: m.is_light,
                              guard_level: m.guard_level,
                              medal_color: m.color,
                              medal_color_start: m.color_start,
                              medal_color_end: m.color_end,
                              medal_color_border: m.color_border
                          }
                     }
                 }

                 // Gift Name
                 let giftName = item.giftName || item.gift_name || item.name
                 if (raw) {
                     giftName = raw.giftName || raw.gift_name || (raw.gift_info && raw.gift_info.name) || giftName
                 }
                 if (!giftName && item.gift_info) giftName = item.gift_info.name
                 if (!giftName) giftName = '未知礼物'

                 const mockBody = {
                     data: {
                         giftId: item.giftId || (item.gift_info && item.gift_info.gift_id) || (raw && raw.giftId) || 0,
                         giftName: giftName,
                         price: price, 
                         uid: uinfo.uid,
                         uname: uinfo.uname,
                         face: uinfo.face,
                         action: '投喂',
                         num: item.num,
                         timestamp: ts,
                         tid: id,
                         sender: {
                             uid: uinfo.uid,
                             uname: uinfo.uname,
                             face: uinfo.face,
                             medal_info: medalInfo
                         }
                     }
                 }
                 const msg = new GiftMessage(mockBody)
                 msg.is_cloud = true
                 newItems.push({ id: Math.random(), type: 'gift', data: msg, sortTime: ts })
                 existingIds.add(id)
             }
          }
          
          // --- Process Subs ---
          if (subsRes && Array.isArray(subsRes)) {
             for (const item of subsRes) {
                 const id = item.id
                 if (existingIds.has(id)) continue;
                 
                 // Try to parse originalEvent for details
                 let raw = null
                 if (item.originalEvent) {
                     try {
                         raw = typeof item.originalEvent === 'string' ? JSON.parse(item.originalEvent) : item.originalEvent
                     } catch (e) {}
                 }

                 let uinfo = { uid: item.uid, uname: item.username || item.uname || '未知用户', face: '' }
                 
                 if (raw) {
                     if (raw.sender_uinfo && raw.sender_uinfo.base) {
                         uinfo.uid = raw.sender_uinfo.uid || raw.uid || uinfo.uid
                         uinfo.uname = raw.sender_uinfo.base.name || uinfo.uname
                         uinfo.face = raw.sender_uinfo.base.face || uinfo.face
                     } else if (raw.sender_uinfo) {
                         // Some formats might be direct
                         uinfo.uid = raw.sender_uinfo.uid || uinfo.uid
                     }
                 }

                 // Fallback if still missing info
                 if (!uinfo.uid || uinfo.uname === '未知用户') {
                     if (item.sender && typeof item.sender === 'object') {
                         uinfo.uid = item.sender.uid
                         uinfo.uname = item.sender.uname || uinfo.uname
                         uinfo.face = item.sender.face || uinfo.face
                     } else {
                         uinfo.uid = item.uid || item.sender
                     }
                     
                     if (item.sender_uinfo && item.sender_uinfo.base) {
                         uinfo = { uid: item.sender_uinfo.uid, uname: item.sender_uinfo.base.name, face: item.sender_uinfo.base.face }
                     }
                 }
                 
                 let ts = Number(item.timestamp) || 0
                 if (!ts && item.time) ts = new Date(item.time).getTime() / 1000
                 if (!ts && item.start_time) ts = Number(item.start_time) || 0
                 if (!ts && raw && raw.guard_info) ts = Number(raw.guard_info.start_time) || 0
                 
                 // Ensure ts is valid number
                 if (isNaN(ts) || ts <= 0) ts = Date.now() / 1000
                 
                 let gLevel = item.guard_level
                 if (!gLevel && raw && raw.guard_info) gLevel = raw.guard_info.guard_level
                 if (!gLevel && item.guard_info) gLevel = item.guard_info.guard_level
                 
                 let price = item.price
                 if (!price && raw && raw.pay_info) price = raw.pay_info.price
                 if (!price && item.pay_info) price = item.pay_info.price
                 
                 let unit = item.unit || '月'
                 if (raw && raw.pay_info && raw.pay_info.unit) unit = raw.pay_info.unit
                 if (item.pay_info && item.pay_info.unit) unit = item.pay_info.unit
                 
                 let num = item.num || 1
                 if (raw && raw.pay_info && raw.pay_info.num) num = raw.pay_info.num
                 if (item.pay_info && item.pay_info.num) num = item.pay_info.num
                 
                 const mockBody = {
                     roomid: 21013446,
                     data: {
                         payflow_id: id,
                         uid: uinfo.uid,
                         username: uinfo.uname,
                         uname: uinfo.uname, 
                         guard_level: gLevel,
                         price: price,
                         start_time: ts,
                         num: num,
                         unit: unit,
                         face: uinfo.face,
                         sender: {
                             uid: uinfo.uid,
                             uname: uinfo.uname,
                             face: uinfo.face
                         }
                     }
                 }
                 const msg = new GuardMessage(mockBody)
                 msg.is_cloud = true
                 
                 // If face is missing, try to fetch it asynchronously
                 if (!uinfo.face && uinfo.uid) {
                     window.ipc.invoke('fetch-user-face', uinfo.uid).then(faceUrl => {
                         if (faceUrl) {
                             setGiftList(current => {
                                 // Need to find this item and update it
                                 return current.map(currItem => {
                                     // Check if it's the same item (by id or tid)
                                     // GuardMessage uses 'id' property mapped from payflow_id
                                     if (currItem.type === 'gift' && currItem.data instanceof GuardMessage && currItem.data.id === id) {
                                         // Create a new instance or clone to trigger re-render
                                         const newData = Object.assign(Object.create(Object.getPrototypeOf(currItem.data)), currItem.data)
                                         newData.sender = { ...newData.sender, face: faceUrl }
                                         return { ...currItem, data: newData }
                                     }
                                     return currItem
                                 })
                             })
                         }
                     }).catch(err => console.error('[CloudSync] Failed to fetch face for guard:', err))
                 }

                 newItems.push({ id: Math.random(), type: 'gift', data: msg, sortTime: ts })
                 existingIds.add(id)
             }
          }
          
          if (newItems.length === 0) return prev
          
          logToMain('info', `[CloudSync] Added ${newItems.length} gifts/subs`)
          
          // Merge and Sort
          const combined = [...prev, ...newItems]
          // Sort descending by timestamp
          // Note: local items might not have 'sortTime' property attached directly.
          // Need to extract timestamp from item.data
          return combined.sort((a, b) => {
              const getTs = (x) => {
                  if (x.sortTime) return x.sortTime
                  // Fallback for local items
                  if (x.data.timestamp) return x.data.timestamp
                  if (x.data.start_time) return x.data.start_time // for SC/Guard
                  // GiftMessage has timestamp. GuardMessage has timestamp (mapped to start_time).
                  return 0
              }
              return getTs(b) - getTs(a)
          })
      })
      
    } catch (err) {
      logToMain('error', '[CloudSync] Failed:', err)
    }
  }, [roomInfo?.room_id, roomInfo?.live_status, roomInfo?.live_start_time])

  useEffect(() => {
    // Strict check before starting auto-sync to avoid unnecessary logs/requests
    // 1. Must have roomInfo
    // 2. Must be target room (21013446)
    // 3. Must be live (live_status === 1)
    if (!roomInfo || Number(roomInfo.room_id) !== 21013446 || roomInfo.live_status !== 1) {
        return
    }

    // Initial sync
    handleCloudSync()

    // Interval sync (3 minutes)
    const interval = setInterval(() => handleCloudSync(), 180000)
    return () => clearInterval(interval)
  }, [handleCloudSync, roomInfo])

  useEffect(() => {
    initLogin()
    return () => {
      stopPolling()
      disconnectDanmu()
    }
  }, [])

  const stopPolling = () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current)
      pollTimer.current = null
    }
    if (roomInfoTimer.current) {
        clearInterval(roomInfoTimer.current)
        roomInfoTimer.current = null
    }
  }

  const disconnectDanmu = () => {
    window.ipc.send('bilibili-disconnect-socket')
    setDanmuStatus('Disconnected')
    setShowConsole(false)
  }

  const addSystemMessage = (text) => {
      setDanmuList(prev => {
          const newItem = {
              id: Math.random(),
              type: 'system',
              data: text
          }
          const updated = [newItem, ...prev]
          // 限制最大长度 1000
          if (updated.length > 1000) {
              return updated.slice(0, 1000)
          }
          return updated
      })
  }

  const connectDanmu = async () => {
    if (!roomId) return alert('Please enter Room ID')
    if (!userInfo) return alert('Please login first')
    
    // 清空之前的列表
    setDanmuList([])
    setScList([])
    setGiftList([])
    setReceivedDanmuCount(0) // 重置计数
    setOnlineCount(0)
    
    addSystemMessage(`直播间已连接：${roomId}`)

    try {
      setDanmuStatus('Fetching Room Info...')
      const danmuInfo = await getDanmuInfo(userInfo, Number(roomId))
      
      addSystemMessage('基础信息已加载，正在建立连接…')

      // 并行获取礼物配置（非阻塞）
      getGiftConfig(Number(roomId)).then(config => {
          const map = {}
          if (config && config.list) {
              config.list.forEach(g => {
                  map[g.id] = {
                      name: g.name,
                      price: g.price,
                      coin_type: g.coin_type, // 'gold' 或 'silver'
                      img: g.webp || g.img_basic || g.gif // 优先使用 webp
                  }
              })
          }
          setGiftMap(map)
          console.log('Gift Config Loaded:', Object.keys(map).length, 'items')
      }).catch(err => console.error('Failed to load gift config:', err))

      setDanmuStatus('Connecting to WebSocket...')
      const wsInfo = {
        server: `wss://${danmuInfo.host_list[0].host}:${danmuInfo.host_list[0].wss_port}/sub`,
        room_id: Number(roomId),
        uid: Number(userInfo.DedeUserID),
        token: danmuInfo.token
      }
      
      // 通过主进程连接
      setShowConsole(true)
      window.ipc.send('bilibili-connect-socket', wsInfo)
      
      saveToHistory(roomId)
      
      // 设置监听器
      // 使用 ref 来保存监听器，以便稍后移除
      const msgHandler = (event, payload) => {
         const messages = Array.isArray(payload) ? payload : [payload]
         // 将消息推入缓冲区，由 useEffect 定时批量处理
         renderBuffer.current.push(...messages)
      }
      
      // 移除旧监听器以避免重复
      window.ipc.removeAllListeners('danmu-message')
      window.ipc.on('danmu-message', msgHandler)
      
      window.ipc.removeAllListeners('danmu-status')
      window.ipc.on('danmu-status', (event, status) => {
          setDanmuStatus(status)
          // 如果是错误，记录到系统消息，但不弹窗
          if (status.includes('Error') || status.includes('Failed') || status.includes('Closed')) {
              addSystemMessage(`[连接状态] ${status}`)
          }
      })
      
      setDanmuStatus('Connected (Main Process)')
      
      // 获取并监控房间信息
      fetchRoomInfo(roomId)
      if (roomInfoTimer.current) clearInterval(roomInfoTimer.current)
      roomInfoTimer.current = setInterval(() => fetchRoomInfo(roomId), 60000)

      // 尝试获取禁言用户列表 (仅打印日志) -> 现用于判断是否为管理员
      if (userInfo && userInfo.SESSDATA) {
          window.ipc.invoke('bilibili-get-silent-users', { cookies: userInfo, roomId: Number(roomId) })
              .then(res => {
                  if (res.success && res.data && res.data.code === 0) {
                      setIsAdmin(true)
                  } else {
                      setIsAdmin(false)
                  }
              })
              .catch(err => console.error('Failed to invoke get-silent-users:', err))
      }
      
      addSystemMessage('弹幕已加载…')

    } catch (e) {
      console.error(e)
      
      // Check for auth error (Cookie expired)
      if (e.code === -101 || (e.message && e.message.includes('-101'))) {
          setShowReloginModal(true)
          initRelogin()
          return
      }

      const errText = 'Connection Failed: ' + (e.message || 'Unknown error')
      // 如果是网络连接失败，不要退出登录，保持当前页面状态
      setDanmuStatus(errText)
      addSystemMessage(errText)
    }
  }

  const fetchUserInfo = async (cookies) => {
      try {
          const res = await window.ipc.invoke('bilibili-get-user-info', cookies)
          if (res.success) {
              setUserInfo(prev => ({
                  ...prev,
                  ...cookies,
                  uname: res.data.uname,
                  face: res.data.face,
                  mid: res.data.mid
              }))
          } else {
              console.error('Failed to fetch user info:', res.error)
          }
      } catch (e) {
          console.error('IPC error fetching user info:', e)
      }
  }

  const initLogin = async () => {
    try {
      setShowConsole(false)
      stopPolling() // 清除现有的定时器
      setStatus('正在获取二维码...')
      const { url, oauthKey } = await getQrCode()
      
      const dataUrl = await QRCode.toDataURL(url)
      setQrImage(dataUrl)
      setStatus('请使用哔哩哔哩手机客户端扫码')
      
      // 开始轮询
      pollTimer.current = setInterval(async () => {
        try {
          const data = await checkQrCode(oauthKey)
          // QrCodeStatus: NeedScan: 0, NeedConfirm: 1, Success: 2
          if (data.status === QrCodeStatus.Success) { // 成功
            stopPolling()
            setStatus('登录成功！')
            setLoggedIn(true)
            setUserInfo(data.cookies)
            // 获取详细用户信息
            fetchUserInfo(data.cookies)
          } else if (data.status === QrCodeStatus.NeedConfirm) {
            setStatus('已扫码，请在手机上确认')
          } else if (data.status === QrCodeStatus.NeedScan) {
            // 等待扫码，什么也不做
          }
        } catch (pollErr) {
             // 处理错误（可能已过期）
             console.log('Poll error:', pollErr)
             setStatus('二维码已过期或出错，正在刷新...')
             stopPolling()
             setTimeout(initLogin, 1000)
        }
      }, 3000)

    } catch (err) {
      console.error(err)
      setStatus('错误: ' + err.message)
    }
  }
  
  // 自动滚动/置顶逻辑
  const prevScrollHeightRef = useRef(0)

  useLayoutEffect(() => {
    const container = danmuListRef.current
    if (!container) return

    const currentScrollHeight = container.scrollHeight
    const prevScrollHeight = prevScrollHeightRef.current
    const heightDiff = currentScrollHeight - prevScrollHeight

    // 记录当前的 scrollHeight 供下次比较
    prevScrollHeightRef.current = currentScrollHeight

    // 如果高度没有变化，或者是首次渲染（prev为0），不需要调整
    if (heightDiff <= 0 || prevScrollHeight === 0) {
        // 如果是置顶模式且处于顶部附近，强制归零
        if (isAlwaysOnTop && container.scrollTop < 50) {
            container.scrollTop = 0
        }
        return
    }

    // 判断是否应该吸附顶部 (Stick to Top)
    // 1. 如果是置顶模式，且用户在顶部附近 (容差 50px)，则吸附
    // 2. 如果是非置顶模式，但用户紧贴顶部 (scrollTop = 0)，也吸附 (因为新消息在最上面，保持 0 就能看到最新的)
    const isAtTop = container.scrollTop < (isAlwaysOnTop ? 50 : 2);

    if (isAtTop) {
        // 吸附顶部：强制归零
        container.scrollTop = 0
    } else {
        // 锁定视觉位置：向下滚动 heightDiff
        container.scrollTop += heightDiff
    }
  }, [danmuList, isAlwaysOnTop, danmuFilter])

  // --- Render Views ---

  if (!loggedIn) {
      return (
        <LoginPage 
            qrImage={qrImage} 
            status={status} 
            onRefresh={initLogin} 
        />
      )
  }

  if (showConsole) {
      return (
        <ConsolePage
            roomId={roomId}
            roomInfo={roomInfo}
            userInfo={userInfo}
            isAdmin={isAdmin}
            onlineCount={onlineCount}
            onlineTrend={onlineTrend}
            danmuStatus={danmuStatus}
            danmuList={danmuList}
            scList={scList}
            giftList={giftList}
            stats={stats}
            colWidths={colWidths}
            
            // Actions & Handlers
            toggleBorderlessMode={toggleBorderlessMode}
            isBorderless={isBorderless}
            toggleAlwaysOnTop={toggleAlwaysOnTop}
            isAlwaysOnTop={isAlwaysOnTop}
            setShowConsole={setShowConsole}
            handleCloudSync={handleCloudSync}
            disconnectDanmu={disconnectDanmu}
            openToolsWindow={openToolsWindow}
            
            // Settings State
            uiScale={uiScale}
            fontSize={fontSize}
            maxDanmuLimit={maxDanmuLimit}
            saveSettings={saveSettings}
            showSettings={showSettings}
            setShowSettings={setShowSettings}
            enableCloudSync={enableCloudSync}
            setEnableCloudSync={setEnableCloudSync}
            
            // Debug State
            showDebug={showDebug}
            setShowDebug={setShowDebug}
            
            // Filter State
            showDanmuFilter={showDanmuFilter}
            setShowDanmuFilter={setShowDanmuFilter}
            danmuFilter={danmuFilter}
            setDanmuFilter={setDanmuFilter}
            shouldShowItem={shouldShowItem}
            
            // Gift Settings
            minGiftPrice={minGiftPrice}
            setMinGiftPrice={setMinGiftPrice}
            showGiftSettings={showGiftSettings}
            setShowGiftSettings={setShowGiftSettings}
            giftMap={giftMap}
            
            // SC Settings
            showScSettings={showScSettings}
            setShowScSettings={setShowScSettings}
            handleMarkAllRead={handleMarkAllRead}
            handleMarkAllUnread={handleMarkAllUnread}
            
            // Interaction
            highlightedUsers={highlightedUsers}
            readMessages={readMessages}
            handleUserClick={handleUserClick}
            handleToggleRead={handleToggleRead}
            
            // OBS Help
            showObsHelp={showObsHelp}
            setShowObsHelp={setShowObsHelp}
            
            // Refs
            containerRef={containerRef}
            settingsBtnRef={settingsBtnRef}
            settingsPanelRef={settingsPanelRef}
            danmuListRef={danmuListRef}
            danmuFilterRef={danmuFilterRef}
            scSettingsRef={scSettingsRef}
            giftSettingsRef={giftSettingsRef}
            obsHelpBtnRef={obsHelpBtnRef}
            obsHelpPanelRef={obsHelpPanelRef}
            startResize={startResize}
            
            // Selected User Menu
            selectedUser={selectedUser}
            setSelectedUser={setSelectedUser}
            handleFilterUser={handleFilterUser}
            handleHighlightUser={handleHighlightUser}
            handleMuteUser={handleMuteUser}
            
            // Relogin Modal
            showReloginModal={showReloginModal}
            cancelRelogin={cancelRelogin}
            reloginQr={reloginQr}
            reloginStatus={reloginStatus}
        />
      )
  }

  // Room Select
  return (
    <RoomSelectPage 
        userInfo={userInfo} 
        roomId={roomId} 
        setRoomId={setRoomId} 
        connectDanmu={connectDanmu} 
        danmuStatus={danmuStatus} 
        roomHistory={roomHistory} 
        saveToHistory={saveToHistory}
        setShowHistoryDropdown={setShowHistoryDropdown} 
        showHistoryDropdown={showHistoryDropdown} 
        deleteHistory={deleteHistory} 
        setLoggedIn={setLoggedIn} 
        setUserInfo={setUserInfo} 
        initLogin={initLogin}
        wrapperRef={wrapperRef} 
    />
  )
}
