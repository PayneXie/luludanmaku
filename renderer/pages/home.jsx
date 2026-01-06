import React, { useEffect, useState, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import Head from 'next/head'
import QRCode from 'qrcode'
import { getQrCode, checkQrCode, QrCodeStatus, getDanmuInfo, getGiftConfig } from '@/lib/bilibili'
import { createDanmuEntry } from '@/lib/common/danmu-entry'
import { DanmuMessage, GiftMessage, SuperChatMessage, GuardMessage } from '@/lib/types/danmaku'
import { levelToIconURL } from '@/lib/utils'
import moment from 'moment'
import styles from '@/styles/console.module.css' // 引入 CSS 模块
import loginStyles from '@/styles/login.module.css' // 引入登录 CSS 模块
import roomSelectStyles from '@/styles/room-select.module.css' // 引入房间选择 CSS 模块
import DebugPanel from '@/components/DebugPanel' // 引入调试面板
import UserActionMenu from '@/components/UserActionMenu' // 引入用户操作菜单
import Linkify from '@/components/Linkify' // 引入链接识别组件
import LiveTimer from '@/components/LiveTimer' // 引入直播计时组件
import FlipCounter from '@/components/FlipCounter' // 引入翻页计数器组件

import level1 from '../public/images/level1.png'
import level2 from '../public/images/level2.png'
import level3 from '../public/images/level3.png'

export default function HomePage() {
  const [qrImage, setQrImage] = useState('')
  const [status, setStatus] = useState('初始化中...')
  const [loggedIn, setLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  
  // 弹幕状态
  const [roomId, setRoomId] = useState('')
  const [danmuStatus, setDanmuStatus] = useState('Disconnected')
  const [danmuList, setDanmuList] = useState([])
  const danmuListRef = useRef(null)
  
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
  
  const getLiveStartMoment = (time) => {
      if (typeof time === 'string') return moment(time)
      return moment.unix(time)
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

  // 礼物配置缓存
  const [giftMap, setGiftMap] = useState({}) 
  // 礼物过滤器
  const [minGiftPrice, setMinGiftPrice] = useState(0) // RMB
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
  
  // 窗口状态
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  const toggleAlwaysOnTop = () => {
      const newState = !isAlwaysOnTop
      setIsAlwaysOnTop(newState)
      window.ipc.send('window-set-always-on-top', newState)
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
  const [showScSettings, setShowScSettings] = useState(false)

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
      }
      document.addEventListener('mousedown', handleClickOutsidePanels)
      return () => document.removeEventListener('mousedown', handleClickOutsidePanels)
  }, [showDanmuFilter, showGiftSettings, showScSettings])

  // 用户操作菜单状态
  const [selectedUser, setSelectedUser] = useState(null) // { user: {uid, uname, face}, position: {x, y} }

  // 重点关注用户 (存储 UID 字符串)
  const [highlightedUsers, setHighlightedUsers] = useState(new Set())
  
  // 已读消息 (存储消息 ID)
  const [readMessages, setReadMessages] = useState(new Set())

  const handleToggleRead = (id) => {
      setReadMessages(prev => {
          const newSet = new Set(prev)
          if (newSet.has(id)) {
              newSet.delete(id)
          } else {
              newSet.add(id)
          }
          return newSet
      })
  }

  const handleMarkAllRead = (type) => {
      setReadMessages(prev => {
          const newSet = new Set(prev)
          danmuList.forEach(item => {
              if (
                  (type === 'superchat' && item.type === 'superchat') || 
                  (type === 'gift' && item.type === 'gift')
              ) {
                  newSet.add(item.id)
              }
          })
          return newSet
      })
  }

  const handleMarkAllUnread = (type) => {
      setReadMessages(prev => {
          const newSet = new Set(prev)
          danmuList.forEach(item => {
              if (
                  (type === 'superchat' && item.type === 'superchat') || 
                  (type === 'gift' && item.type === 'gift')
              ) {
                  newSet.delete(item.id)
              }
          })
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

  const handleUserClick = (e, user) => {
      e.stopPropagation()
      
      // Toggle logic: If clicking the same user, close the menu
      if (selectedUser && String(selectedUser.user.uid) === String(user.uid)) {
          setSelectedUser(null)
          return
      }

      // 获取点击元素的矩形位置，以实现精确对齐
      const rect = e.currentTarget.getBoundingClientRect()
      
      let x = rect.left
      let y = rect.bottom
      
      // 边界检查
      if (x + 280 > window.innerWidth) {
          x = window.innerWidth - 290
      }
      
      // 如果下方空间不足 (假设菜单高度约 300px)，则显示在上方
      if (y + 300 > window.innerHeight) {
          y = rect.top - 300
      }
      
      setSelectedUser({ user, position: { x, y } })
  }
  
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

  // 加载设置和历史记录
  useEffect(() => {
      const savedScale = localStorage.getItem('uiScale')
      const savedFont = localStorage.getItem('fontSize')
      if (savedScale) setUiScale(parseFloat(savedScale))
      if (savedFont) setFontSize(parseInt(savedFont))
      
      const savedHistory = localStorage.getItem('roomHistory')
      if (savedHistory) {
          setRoomHistory(JSON.parse(savedHistory))
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
  
  const saveToHistory = (id) => {
      if (!id) return
      let newHistory = [id, ...roomHistory.filter(h => h !== id)]
      newHistory = newHistory.slice(0, 10)
      setRoomHistory(newHistory)
      localStorage.setItem('roomHistory', JSON.stringify(newHistory))
  }
  
  const deleteHistory = (e, id) => {
      e.stopPropagation()
      const newHistory = roomHistory.filter(h => h !== id)
      setRoomHistory(newHistory)
      localStorage.setItem('roomHistory', JSON.stringify(newHistory))
  }

  // 保存设置
  const saveSettings = (scale, font) => {
      setUiScale(scale)
      setFontSize(font)
      localStorage.setItem('uiScale', scale.toString())
      localStorage.setItem('fontSize', font.toString())
  }
  
  // 列宽（百分比）
  // 初始值：每列 33.33%
  const [colWidths, setColWidths] = useState([33.33, 33.33, 33.33])
  const containerRef = useRef(null)

  // 统计信息
  const stats = useMemo(() => {
      let danmuCount = 0
      let scTotal = 0
      let giftTotal = 0
      
      danmuList.forEach(item => {
          if (item.type === 'msg') {
              danmuCount++
          } else if (item.type === 'superchat') {
              scTotal += item.data.price
          } else if (item.type === 'gift') {
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
          danmuCount, 
          scTotal: scTotal, 
          giftTotal: giftTotal
      }
  }, [danmuList, giftMap])

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
  }

  const addSystemMessage = (text) => {
      setDanmuList(prev => {
          const newItem = {
              id: Math.random(),
              type: 'system',
              data: text
          }
          const updated = [...prev, newItem]
          return updated
      })
  }

  const connectDanmu = async () => {
    if (!roomId) return alert('Please enter Room ID')
    if (!userInfo) return alert('Please login first')
    
    // 清空之前的列表
    setDanmuList([])
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
      window.ipc.send('bilibili-connect-socket', wsInfo)
      
      saveToHistory(roomId)
      
      // 设置监听器
      // 使用 ref 来保存监听器，以便稍后移除
      const msgHandler = (event, msg) => {
         // Handle High Energy Update
         if (msg.cmd === 'ONLINE_RANK_COUNT') {
             if (msg.data && typeof msg.data.count === 'number') {
                 const newCount = msg.data.count
                 const prevCount = prevOnlineCountRef.current
                 
                 if (newCount > prevCount) {
                     setOnlineTrend('up')
                 } else if (newCount < prevCount) {
                     setOnlineTrend('down')
                 }
                 
                 prevOnlineCountRef.current = newCount
                 setOnlineCount(newCount)
             }
             return
         }

         // 根据要求保留所有消息
         setDanmuList(prev => {
             const newList = [...prev, { 
                id: Math.random(), 
                type: 'msg',
                data: null // 将在下面设置
            }]
            // 由于有不同的类型，应该先构造对象
            let newItem = null;
            
            if (msg.cmd === 'DANMU_MSG') {
                try {
                   newItem = { id: Math.random(), type: 'msg', data: new DanmuMessage({ info: msg.info }) }
                } catch(e) { console.error(e); return prev; }
            } else if (msg.cmd === 'SEND_GIFT') {
                try {
                   newItem = { id: Math.random(), type: 'gift', data: new GiftMessage(msg) }
                } catch(e) { console.error(e); return prev; }
            } else if (msg.cmd === 'SUPER_CHAT_MESSAGE') {
                try {
                   newItem = { id: Math.random(), type: 'superchat', data: new SuperChatMessage(msg) }
                } catch(e) { console.error(e); return prev; }
            } else if (msg.cmd === 'USER_TOAST_MSG') {
                try {
                   newItem = { id: Math.random(), type: 'gift', data: new GuardMessage(msg) }
                } catch(e) { console.error(e); return prev; }
            } else if (msg.cmd === 'SYSTEM_MSG') {
                   newItem = { id: Math.random(), type: 'system', data: msg.msg }
            }

            if (!newItem) return prev;
            
            // 保留所有数据
            const updated = [...prev, newItem]
            return updated
         })
      }
      
      // 移除旧监听器以避免重复
      window.ipc.removeAllListeners('danmu-message')
      window.ipc.on('danmu-message', msgHandler)
      
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
      const errText = 'Connection Failed: ' + (e.message || 'Unknown error')
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

  // 使用 Bilibili 标准等级颜色作为勋章颜色
  const getMedalColor = (level) => {
      if (level >= 1 && level <= 20) return '#61c05a' // 绿色 (1-20)
      if (level >= 21 && level <= 40) return '#5896de' // 蓝色 (21-40)
      if (level >= 41 && level <= 60) return '#a068f1' // 紫色 (41-60)
      if (level >= 61) return '#f08c00' // 金色 (>60)
      return '#61c05a' // 默认
  }

  // 自动滚动/置顶逻辑
  // 最新的在顶部。
  // 除非向下滚动，否则保持在顶部。
  useEffect(() => {
    if (danmuListRef.current) {
        // 因为反转了列表（flex-direction column，但映射反转），
        // scrollTop 0 实际上是顶部（最新的）。
        // 如果用户向下滚动 (scrollTop > 0)，我们停止自动滚动到顶部。
        
        // 等等，“最新的在顶部”的标准行为：
        // 1. 渲染列表为 [新, 旧, 更旧...]
        // 2. 容器 scrollTop = 0 意味着在最新的位置。
        // 3. 如果用户向下滚动 (scrollTop > 阈值)，不会强制将其返回到 0。
        // 4. 如果 scrollTop 接近 0，将其保持在 0。
        
        const { scrollTop } = danmuListRef.current
        if (scrollTop < 50) { // 阈值
            danmuListRef.current.scrollTop = 0
        }
    }
  }, [danmuList])

  if (!loggedIn) {
      return (
        <React.Fragment>
          <Head>
            <title>哔哩哔哩扫码登录</title>
          </Head>
          <div className={loginStyles.container}>
            <div className={loginStyles.card}>
                <h1 className={loginStyles.title}>哔哩哔哩扫码登录</h1>
                
                <div className={loginStyles.qrContainer}>
                    {qrImage ? (
                        <img src={qrImage} alt="Login QR Code" className={loginStyles.qrImage} />
                    ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                            加载中...
                        </div>
                    )}
                </div>
                
                <p className={loginStyles.status}>{status}</p>
                
                <button 
                  onClick={initLogin}
                  className={loginStyles.btnRefresh}
                >
                  刷新二维码
                </button>
            </div>
          </div>
        </React.Fragment>
      )
  }

  // 安全获取图标 URL 的辅助函数
  const getGuardIcon = (level) => {
    if (level === 1) return level1.src || level1
    if (level === 2) return level2.src || level2
    if (level === 3) return level3.src || level3
    return ''
  }

  // 已连接视图
  if (danmuStatus.startsWith('Connected')) {
      return (
        <React.Fragment>
          <Head>
            <title>Danmaku Console - {roomId}</title>
            <meta name="referrer" content="no-referrer" />
          </Head>
          <div 
            className={styles['console-container']}
            style={{
                zoom: uiScale,
                fontSize: `${fontSize}px`
            }}
          >
              {/* 头部 */}
              <div className={styles['console-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', backgroundColor: '#fff', borderBottom: '1px solid #eee' }}>
                  <div className={styles['room-info']} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* 用户头像 */}
                      {userInfo?.face && (
                          <img 
                              src={userInfo.face} 
                              alt="avatar" 
                              style={{ width: '44px', height: '44px', borderRadius: '50%', border: '2px solid #f0f0f0' }} 
                          />
                      )}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {/* 标题行 */}
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', lineHeight: '1.2' }}>
                              {roomInfo ? roomInfo.title : `直播间: ${roomId}`}
                          </div>
                          
                          {/* 信息行 */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '12px', color: '#666' }}>
                              <span>直播间: {roomId}</span>
                              
                              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <span>用户: {userInfo?.uname || userInfo?.DedeUserID}</span>
                                  {isAdmin && (
                                      <span style={{ 
                                          fontSize: '10px', color: '#fff', backgroundColor: '#fb7299', 
                                          padding: '1px 4px', borderRadius: '3px', lineHeight: '14px' 
                                      }}>
                                          管理员
                                      </span>
                                  )}
                              </div>
                              
                              {/* 高能数值 */}
                              {onlineCount > 0 && (
                                  <>
                                      <div style={{ width: '1px', height: '10px', backgroundColor: '#ddd' }}></div>
                                      <span style={{ color: '#000', fontWeight: 'normal', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                          高能: <FlipCounter value={onlineCount} />
                                          {onlineTrend === 'up' && (
                                              <svg width="12" height="12" viewBox="0 0 24 24" fill="#e53935">
                                                  <path d="M12 4l-8 8h16z" />
                                              </svg>
                                          )}
                                          {onlineTrend === 'down' && (
                                              <svg width="12" height="12" viewBox="0 0 24 24" fill="#43a047">
                                                  <path d="M12 20l-8-8h16z" />
                                              </svg>
                                          )}
                                      </span>
                                  </>
                              )}

                              {/* 直播状态 */}
                              {roomInfo && (
                                  <>
                                      <div style={{ width: '1px', height: '10px', backgroundColor: '#ddd' }}></div>
                                      {roomInfo.live_status === 1 ? (
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                              <span style={{ color: '#fff', backgroundColor: '#fb7299', padding: '0 6px', borderRadius: '3px', fontSize: '11px', lineHeight: '18px' }}>直播中</span>
                                              {roomInfo.live_time && (
                                                  <div style={{ 
                                                       fontSize: '14px', fontWeight: 'bold', color: '#fb7299',
                                                       backgroundColor: '#fff0f6', padding: '0 6px', borderRadius: '4px',
                                                       fontFamily: '"Microsoft YaHei", sans-serif'
                                                  }}>
                                                       <LiveTimer startTime={roomInfo.live_time} />
                                                  </div>
                                              )}
                                          </div>
                                      ) : (
                                          <span style={{ color: '#999', border: '1px solid #999', padding: '0 6px', borderRadius: '3px', fontSize: '11px' }}>未开播</span>
                                      )}
                                  </>
                              )}
                          </div>
                      </div>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* 置顶按钮（图钉图标） */}
                      <button 
                        title={isAlwaysOnTop ? "取消置顶" : "置顶窗口"}
                        style={{ 
                            padding: '6px', 
                            cursor: 'pointer',
                            backgroundColor: isAlwaysOnTop ? 'rgba(0, 161, 214, 0.1)' : 'transparent',
                            color: isAlwaysOnTop ? '#00a1d6' : '#666',
                            border: '1px solid transparent',
                            borderColor: isAlwaysOnTop ? '#00a1d6' : 'transparent',
                            borderRadius: '4px',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onClick={toggleAlwaysOnTop}
                      >
                        {isAlwaysOnTop ? (
                            // 已置顶（实心）
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                            </svg>
                        ) : (
                            // 未置顶（轮廓）
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h2.8v-6H18v-2l-2-2z"></path>
                            </svg>
                        )}
                      </button>

                      {/* 调试按钮（Bug 图标） */}
                      <button 
                        title="调试工具"
                        style={{ 
                            padding: '6px', 
                            cursor: 'pointer',
                            backgroundColor: showDebug ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                            color: showDebug ? '#333' : '#666',
                            border: '1px solid transparent',
                            borderRadius: '4px',
                            outline: 'none',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onClick={() => setShowDebug(!showDebug)}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="8" y="9" width="8" height="8" rx="4"></rect>
                            <path d="M6 13h2M16 13h2M9 7l1 2M15 7l-1 2M8 17l-2 2M16 17l2 2"></path>
                        </svg>
                      </button>

                      {/* 设置按钮（齿轮图标） */}
                      <div style={{ position: 'relative' }}>
                          <button 
                            title="界面设置"
                            style={{ 
                                padding: '6px', 
                                cursor: 'pointer',
                                backgroundColor: showSettings ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                                color: showSettings ? '#333' : '#666',
                                border: '1px solid transparent',
                                borderRadius: '4px',
                                transition: 'all 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}
                            onClick={() => setShowSettings(!showSettings)}
                          >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="3"></circle>
                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                            </svg>
                          </button>
                          
                          {/* 设置模态框（Portal） */}
                          {showSettings && typeof document !== 'undefined' && createPortal(
                              <div style={{
                                  position: 'fixed',
                                  top: '60px',
                                  right: '20px',
                                  width: '260px',
                                  background: '#fff',
                                  border: '1px solid #ddd',
                                  borderRadius: '6px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  padding: '16px',
                                  zIndex: 9999,
                                  color: '#333',
                                  textAlign: 'left',
                                  fontFamily: 'sans-serif', // 重置字体
                                  fontSize: '14px' // 重置字体大小
                              }}>
                                  <div style={{ marginBottom: 16 }}>
                                      <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: '14px' }}>界面缩放 ({(uiScale * 100).toFixed(0)}%)</div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                          <span style={{ fontSize: '12px' }}>50%</span>
                                          <input 
                                              type="range" 
                                              min="0.5" 
                                              max="2.0" 
                                              step="0.1" 
                                              value={uiScale}
                                              onChange={(e) => saveSettings(parseFloat(e.target.value), fontSize)}
                                              style={{ flex: 1 }}
                                          />
                                          <span style={{ fontSize: '12px' }}>200%</span>
                                      </div>
                                  </div>
                                  
                                  <div>
                                      <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: '14px' }}>字体大小 ({fontSize}px)</div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                          <span style={{ fontSize: '12px' }}>12</span>
                                          <input 
                                              type="range" 
                                              min="12" 
                                              max="24" 
                                              step="1" 
                                              value={fontSize}
                                              onChange={(e) => saveSettings(uiScale, parseInt(e.target.value))}
                                              style={{ flex: 1 }}
                                          />
                                          <span style={{ fontSize: '12px' }}>24</span>
                                      </div>
                                  </div>
                                  
                                  <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                      <button 
                                        onClick={() => saveSettings(1.0, 14)}
                                        style={{ fontSize: '12px', color: '#00a1d6', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
                                      >
                                          恢复默认
                                      </button>
                                  </div>
                              </div>,
                              document.body
                          )}
                      </div>

                      {/* 断开连接按钮（电源图标） */}
                      <button 
                        title="断开连接"
                        className={styles['btn-disconnect']} 
                        onClick={disconnectDanmu}
                        style={{
                            padding: '6px',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            color: '#ff4d4f', // 红色表示断开连接
                            border: '1px solid transparent',
                            borderRadius: '4px',
                            outline: 'none',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path>
                            <line x1="12" y1="2" x2="12" y2="12"></line>
                        </svg>
                      </button>
                  </div>
              </div>

              {/* 调试面板 */}
              {showDebug && <DebugPanel onClose={() => setShowDebug(false)} />}

              {/* 主要内容 - 3 列 */}
              <div className={styles['console-body']} ref={containerRef}>
                  
                  {/* 左侧：弹幕列表（可滚动） */}
                  <div 
                    className={`${styles['column']} ${styles['col-danmu']}`}
                    style={{ width: `${colWidths[0]}%` }}
                  >
                      <div className={styles['col-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
                          <span>弹幕列表 ({stats.danmuCount})</span>
                          
                          <div style={{ position: 'relative' }} ref={danmuFilterRef}>
                              {/* 筛选按钮 */}
                              <div 
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                onClick={() => setShowDanmuFilter(!showDanmuFilter)}
                                title="弹幕筛选"
                              >
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                     <line x1="4" y1="21" x2="4" y2="14"></line>
                                     <line x1="4" y1="10" x2="4" y2="3"></line>
                                     <line x1="12" y1="21" x2="12" y2="12"></line>
                                     <line x1="12" y1="8" x2="12" y2="3"></line>
                                     <line x1="20" y1="21" x2="20" y2="16"></line>
                                     <line x1="20" y1="12" x2="20" y2="3"></line>
                                     <line x1="1" y1="14" x2="7" y2="14"></line>
                                     <line x1="9" y1="8" x2="15" y2="8"></line>
                                     <line x1="17" y1="16" x2="23" y2="16"></line>
                                 </svg>
                              </div>

                              {/* 筛选面板 */}
                              {showDanmuFilter && (
                                  <div style={{
                                      position: 'absolute',
                                      top: '30px',
                                      right: '-5px',
                                      width: '260px',
                                      background: '#fff',
                                      border: '1px solid #ddd',
                                      borderRadius: '6px',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                      padding: '12px',
                                      zIndex: 1000,
                                      color: '#333',
                                      fontSize: '14px'
                                  }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                                          <input 
                                              type="text" 
                                              placeholder="搜索关键词..."
                                              value={danmuFilter.keyword}
                                              onChange={(e) => setDanmuFilter({ ...danmuFilter, keyword: e.target.value })}
                                              style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ddd', outline: 'none' }}
                                          />
                                          {danmuFilter.keyword && (
                                              <button 
                                                  onClick={() => setDanmuFilter({ ...danmuFilter, keyword: '' })}
                                                  title="清除"
                                                  style={{ 
                                                      background: '#f1f3f5', 
                                                      border: 'none', 
                                                      borderRadius: '4px', 
                                                      width: '28px', 
                                                      height: '28px', 
                                                      cursor: 'pointer',
                                                      color: '#868e96',
                                                      display: 'flex',
                                                      alignItems: 'center',
                                                      justifyContent: 'center',
                                                      fontSize: '16px'
                                                  }}
                                              >
                                                  ×
                                              </button>
                                          )}
                                      </div>
                                      
                                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                              <input 
                                                  type="checkbox" 
                                                  checked={danmuFilter.enableUser}
                                                  onChange={(e) => setDanmuFilter({ ...danmuFilter, enableUser: e.target.checked })}
                                                  style={{ marginRight: '4px' }}
                                              /> 用户名
                                          </label>
                                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                              <input 
                                                  type="checkbox" 
                                                  checked={danmuFilter.enableContent}
                                                  onChange={(e) => setDanmuFilter({ ...danmuFilter, enableContent: e.target.checked })}
                                                  style={{ marginRight: '4px' }}
                                              /> 内容
                                          </label>
                                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                                              <input 
                                                  type="checkbox" 
                                                  checked={danmuFilter.enableUid}
                                                  onChange={(e) => setDanmuFilter({ ...danmuFilter, enableUid: e.target.checked })}
                                                  style={{ marginRight: '4px' }}
                                              /> UID(精确)
                                          </label>
                                      </div>
                                  </div>
                              )}
                          </div>
                      </div>
                      <div 
                        ref={danmuListRef}
                        className={styles['col-content']}
                        style={{ flex: 1, overflowY: 'auto' }} // 确保可滚动
                      >
                          {danmuList.filter(item => {
                              // Basic Type Filter
                              if (item.type !== 'msg' && item.type !== 'system') return false
                              
                              return shouldShowItem(item)
                          }).slice().reverse().map(item => {
                              if (item.type === 'msg') {
                                  const msg = item.data
                                  const guardLevel = msg.sender.medal_info ? msg.sender.medal_info.guard_level : 0
                                  const isGuard = guardLevel > 0
                                  
                                  // 会员背景色
                                  // 舰长(3): 淡蓝色 (保持一致)
                                  // 提督(2): 淡紫色
                                  // 总督(1): 淡金色
                                  // 重点关注: 淡红色 (覆盖其他背景)
                                  
                                  const isHighlighted = highlightedUsers.has(String(msg.sender.uid))
                                  
                                  let bgColor = 'transparent'
                                  if (guardLevel === 3) bgColor = 'rgba(0, 176, 255, 0.15)'   // 舰长 (Light Blue)
                                  if (guardLevel === 2) bgColor = 'rgba(224, 64, 251, 0.2)'   // 提督 (Purple)
                                  if (guardLevel === 1) bgColor = 'rgba(255, 215, 0, 0.25)'   // 总督 (Gold)
                                  
                                  if (isHighlighted) {
                                      bgColor = 'rgba(255, 50, 50, 0.2)' // Red for highlighted
                                  }

                                  // 用户名颜色区分
                                  let unameColor = '#333' // 普通用户黑色
                                  if (guardLevel === 3) unameColor = '#00a1d6' // 舰长 (蓝色)
                                  if (guardLevel === 2) unameColor = '#E040FB' // 提督 (紫色)
                                  if (guardLevel === 1) unameColor = '#FF3232' // 总督 (红色)

                                  return (
                                    <div 
                                        key={item.id} 
                                        className={styles['danmu-item']}
                                        style={{ backgroundColor: bgColor, display: 'flex', flexWrap: 'wrap', alignItems: 'center' }}
                                    >
                                        {/* 头部容器 (勋章+舰长图标+用户名) 整体不换行 */}
                                        <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', marginRight: '4px' }}>
                                            {/* 勋章 */}
                                            {msg.sender.medal_info && msg.sender.medal_info.is_lighted === 1 && (
                                                <span 
                                                  className={styles['medal-badge']}
                                                  style={{
                                                    borderColor: getMedalColor(msg.sender.medal_info.medal_level),
                                                    backgroundColor: getMedalColor(msg.sender.medal_info.medal_level),
                                                    backgroundImage: 'none'
                                                  }}
                                                >
                                                    {msg.sender.medal_info.medal_name}|{msg.sender.medal_info.medal_level}
                                                </span>
                                            )}
                                            
                                            {/* 舰长图标 */}
                                            {isGuard && (
                                                <img 
                                                    src={getGuardIcon(msg.sender.medal_info.guard_level)}
                                                    className={styles['guard-icon']}
                                                    alt="guard"
                                                />
                                            )}
                                            
                                            {/* 发送者 */}
                                            <span 
                                                className={`${styles['uname']} ${isGuard ? styles['uname-guard'] : styles['uname-normal']}`}
                                                onClick={(e) => handleUserClick(e, msg.sender)}
                                                style={{ cursor: 'pointer', color: unameColor, fontWeight: 'bold' }}
                                                data-user-action-trigger="true"
                                            >
                                                {msg.sender.uname}:
                                            </span>
                                        </div>
                                        
                                        {/* 内容 (允许换行) */}
                                        <span style={{ wordBreak: 'break-word', lineHeight: '1.5' }}>
                                            <Linkify>{msg.content}</Linkify>
                                        </span>
                                    </div>
                                  )
                              } else if (item.type === 'system') {
                                  return (
                                      <div key={item.id} className={styles['danmu-system']}>
                                          {item.data}
                                      </div>
                                  )
                              }
                              return null
                          })}
                      </div>
                  </div>

                  {/* 调整大小 1 */}
                  <div 
                    className={styles['resizer']} 
                    onMouseDown={(e) => startResize(0, e)}
                  />

                  {/* 中间：醒目留言（Sticky） */}
                  <div 
                    className={`${styles['column']} ${styles['col-sc']}`}
                    style={{ width: `${colWidths[1]}%` }}
                  >
                      <div className={styles['col-header']} style={{ color: '#333', display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                          <span>醒目留言 (￥{stats.scTotal.toFixed(1)})</span>
                          
                          <div style={{ position: 'relative' }} ref={scSettingsRef}>
                              <div 
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                onClick={() => setShowScSettings(!showScSettings)}
                                title="留言管理"
                              >
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                     <line x1="4" y1="21" x2="4" y2="14"></line>
                                     <line x1="4" y1="10" x2="4" y2="3"></line>
                                     <line x1="12" y1="21" x2="12" y2="12"></line>
                                     <line x1="12" y1="8" x2="12" y2="3"></line>
                                     <line x1="20" y1="21" x2="20" y2="16"></line>
                                     <line x1="20" y1="12" x2="20" y2="3"></line>
                                     <line x1="1" y1="14" x2="7" y2="14"></line>
                                     <line x1="9" y1="8" x2="15" y2="8"></line>
                                     <line x1="17" y1="16" x2="23" y2="16"></line>
                                 </svg>
                              </div>

                              {showScSettings && (
                                  <div style={{
                                      position: 'absolute',
                                      top: '30px',
                                      right: '-5px',
                                      width: '140px',
                                      background: '#fff',
                                      border: '1px solid #ddd',
                                      borderRadius: '6px',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                      padding: '8px',
                                      zIndex: 1000,
                                      color: '#333',
                                      fontSize: '14px',
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: '8px'
                                  }}>
                                      <button 
                                          onClick={() => { handleMarkAllRead('superchat'); setShowScSettings(false) }}
                                          style={{ padding: '8px', cursor: 'pointer', border: 'none', background: '#f1f3f5', borderRadius: '4px', color: '#495057', fontWeight: '500' }}
                                      >
                                          全部已读
                                      </button>
                                      <button 
                                          onClick={() => { handleMarkAllUnread('superchat'); setShowScSettings(false) }}
                                          style={{ padding: '8px', cursor: 'pointer', border: 'none', background: '#f1f3f5', borderRadius: '4px', color: '#495057', fontWeight: '500' }}
                                      >
                                          全部未读
                                      </button>
                                  </div>
                              )}
                          </div>
                      </div>
                      <div className={styles['col-content']}>
                          {danmuList.filter(item => item.type === 'superchat' && shouldShowItem(item)).reverse().map(item => {
                              const msg = item.data
                              // Bilibili SC 颜色等级
                              // < 50: Dark Blue (Level 0)
                              // 50 - 99: Light Blue (Level 1)
                              // 100 - 499: Yellow (Level 2)
                              // 500 - 999: Orange (Level 3)
                              // 1000 - 1999: Light Red (Level 4)
                              // >= 2000: Dark Red (Level 5)
                              const levelColor = msg.price >= 2000 ? 'var(--sc-level-5)' :
                                                 msg.price >= 1000 ? 'var(--sc-level-4)' :
                                                 msg.price >= 500  ? 'var(--sc-level-3)' :
                                                 msg.price >= 100  ? 'var(--sc-level-2)' :
                                                 msg.price >= 50   ? 'var(--sc-level-1)' :
                                                                     'var(--sc-level-0)'
                              
                              const isRead = readMessages.has(item.id)
                              const readStyle = isRead ? { filter: 'grayscale(100%)', opacity: 0.6 } : {}

                              return (
                                <div 
                                    key={item.id} 
                                    className={styles['sc-card']} 
                                    style={{ borderColor: levelColor, ...readStyle }}
                                    onDoubleClick={() => handleToggleRead(item.id)}
                                >
                                    <div 
                                        className={styles['sc-header']} 
                                        style={{ backgroundColor: levelColor }}
                                    >
                                        {/* SC 用户头像 */}
                                        <img 
                                            src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
                                            alt="face" 
                                            style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '6px', verticalAlign: 'middle', cursor: 'pointer' }} 
                                            onClick={(e) => handleUserClick(e, msg.sender)}
                                            data-user-action-trigger="true"
                                        />
                                        
                                        {/* SC 勋章（类似于弹幕） */}
                                        {msg.sender.medal_info && msg.sender.medal_info.is_lighted === 1 && (
                                            <span 
                                              className={styles['medal-badge']}
                                              style={{
                                                borderColor: getMedalColor(msg.sender.medal_info.medal_level),
                                                backgroundColor: getMedalColor(msg.sender.medal_info.medal_level),
                                                backgroundImage: 'none',
                                                marginRight: '6px',
                                                transform: 'none', // 重置 transform 以进行 flex 对齐
                                                lineHeight: '14px', // 调整行高以更好地居中
                                                display: 'flex', // 使用 flex 在徽章内居中文本
                                                alignItems: 'center',
                                                height: '16px' // 固定高度匹配图标
                                              }}
                                            >
                                                {msg.sender.medal_info.medal_name}|{msg.sender.medal_info.medal_level}
                                            </span>
                                        )}

                                        <span 
                                            style={{fontWeight:'bold', cursor: 'pointer'}}
                                            onClick={(e) => handleUserClick(e, msg.sender)}
                                            data-user-action-trigger="true"
                                        >
                                            {msg.sender.uname}
                                        </span>
                                        <span style={{marginLeft: 'auto'}}>￥{msg.price}</span>
                                    </div>
                                    <div className={styles['sc-body']}>
                                        <Linkify>{msg.message}</Linkify>
                                    </div>
                                </div>
                              )
                          })}
                          {danmuList.filter(item => item.type === 'superchat').length === 0 && (
                              <div style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '40px', fontSize: '12px' }}>
                                  暂无醒目留言
                              </div>
                          )}
                      </div>
                  </div>

                  {/* 调整大小 2 */}
                  <div 
                    className={styles['resizer']} 
                    onMouseDown={(e) => startResize(1, e)}
                  />

                  {/* 右侧：礼物 */}
                  <div 
                    className={`${styles['column']} ${styles['col-gift']}`}
                    style={{ width: `${colWidths[2]}%` }}
                  >
                      <div className={styles['col-header']} style={{ color: '#333', display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                          <span>礼物列表 (￥{stats.giftTotal.toFixed(1)})</span>
                          
                          <div style={{ position: 'relative' }} ref={giftSettingsRef}>
                              {/* 设置图标 (SVG) -> 改为 Filter 图标 */}
                              <div 
                                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                                onClick={() => setShowGiftSettings(!showGiftSettings)}
                                title="礼物筛选"
                              >
                                 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                     <line x1="4" y1="21" x2="4" y2="14"></line>
                                     <line x1="4" y1="10" x2="4" y2="3"></line>
                                     <line x1="12" y1="21" x2="12" y2="12"></line>
                                     <line x1="12" y1="8" x2="12" y2="3"></line>
                                     <line x1="20" y1="21" x2="20" y2="16"></line>
                                     <line x1="20" y1="12" x2="20" y2="3"></line>
                                     <line x1="1" y1="14" x2="7" y2="14"></line>
                                     <line x1="9" y1="8" x2="15" y2="8"></line>
                                     <line x1="17" y1="16" x2="23" y2="16"></line>
                                 </svg>
                              </div>

                              {/* 设置弹出窗口 (Native) */}
                              {showGiftSettings && (
                                  <div style={{
                                      position: 'absolute',
                                      top: '30px',
                                      right: '-5px',
                                      width: '240px',
                                      background: '#fff',
                                      border: '1px solid #ddd',
                                      borderRadius: '6px',
                                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                      padding: '12px',
                                      zIndex: 1000,
                                      color: '#333',
                                      fontSize: '14px'
                                  }}>
                                  <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: '14px' }}>最低金额 (元)</div>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                      <input 
                                          type="range" 
                                          min="0" 
                                          max="100" 
                                          step="0.1" 
                                          value={minGiftPrice}
                                          onChange={(e) => setMinGiftPrice(parseFloat(e.target.value))}
                                          style={{ flex: 1 }}
                                      />
                                      <input 
                                          type="number" 
                                          min="0" 
                                          max="10000" 
                                          step="0.1" 
                                          value={minGiftPrice}
                                          onChange={(e) => setMinGiftPrice(parseFloat(e.target.value))}
                                          style={{ width: '60px', padding: '4px' }}
                                      />
                                  </div>
                                  <div style={{ fontSize: '12px', color: '#888', marginTop: 8 }}>
                                      低于或等于 ￥{minGiftPrice} 的礼物将被隐藏。
                                  </div>
                                  <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                      <button 
                                          onClick={() => { handleMarkAllRead('gift'); setShowGiftSettings(false) }}
                                          style={{ padding: '8px', cursor: 'pointer', border: 'none', background: '#f1f3f5', borderRadius: '4px', color: '#495057', fontWeight: '500' }}
                                      >
                                          全部已读
                                      </button>
                                      <button 
                                          onClick={() => { handleMarkAllUnread('gift'); setShowGiftSettings(false) }}
                                          style={{ padding: '8px', cursor: 'pointer', border: 'none', background: '#f1f3f5', borderRadius: '4px', color: '#495057', fontWeight: '500' }}
                                      >
                                          全部未读
                                      </button>
                                  </div>
                                  {/* 这里简化了关闭覆盖层/点击外部的处理程序 */}
                              </div>
                          )}
                          </div>
                      </div>
                      <div className={styles['col-content']}>
                          {danmuList.filter(item => item.type === 'gift' && shouldShowItem(item)).slice().reverse().map(item => {
                              const msg = item.data
                              const isRead = readMessages.has(item.id)
                              const readStyle = isRead ? { filter: 'grayscale(100%)', opacity: 0.6 } : {}
                              
                              // Handle GuardMessage (Captain/Admiral/Governor)
                              if (msg instanceof GuardMessage || msg.guard_level) {
                                  const guardName = msg.guard_level === 1 ? '总督' : msg.guard_level === 2 ? '提督' : '舰长'
                                  const priceRMB = msg.price / 1000 
                                  
                                  if (priceRMB <= minGiftPrice) return null
                                  
                                  // Premium Card for Guard
                                  const cardBg = msg.guard_level === 1 ? '#d32f2f' : // Governor Red
                                                 msg.guard_level === 2 ? '#7b1fa2' : // Admiral Purple
                                                                         '#1976d2'   // Captain Blue

                                  return (
                                      <div 
                                        key={item.id} 
                                        className={styles['gift-card-anim']}
                                        style={{ 
                                            backgroundColor: cardBg,
                                            color: '#fff',
                                            borderRadius: '8px',
                                            padding: '10px 12px',
                                            marginBottom: '8px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                            fontWeight: 'bold',
                                            border: 'none',
                                            ...readStyle
                                        }}
                                        onDoubleClick={() => handleToggleRead(item.id)}
                                      >
                                          <div 
                                            style={{ position: 'relative', marginRight: '12px', cursor: 'pointer' }}
                                            onClick={(e) => handleUserClick(e, msg.sender)}
                                            data-user-action-trigger="true"
                                          >
                                              <img 
                                                  src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
                                                  alt="face" 
                                                  style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} 
                                              />
                                              <img 
                                                  src={getGuardIcon(msg.guard_level)}
                                                  style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '18px', height: '18px' }}
                                                  alt="icon"
                                              />
                                          </div>
                                          
                                          <div style={{ flex: 1 }}>
                                          <div 
                                              style={{ fontSize: '15px', lineHeight: '1.2', cursor: 'pointer' }}
                                              onClick={(e) => handleUserClick(e, msg.sender)}
                                              data-user-action-trigger="true"
                                          >
                                              {msg.sender.uname}
                                          </div>
                                          <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                                              开通了 {guardName} x{msg.num}{msg.unit}
                                          </div>
                                      </div>
                                          
                                          <div style={{ fontSize: '16px', marginLeft: '8px' }}>
                                              ￥{priceRMB}
                                          </div>
                                      </div>
                                  )
                              }

                              const config = giftMap[msg.gift_info.id]
                              
                              // 计算价值
                              let valueRMB = 0
                              let valueText = ''
                              // 优先使用配置，回退到 msg.gift_info.price
                              const price = config ? config.price : msg.gift_info.price
                              const coinType = config ? config.coin_type : (msg.gift_info.price > 0 ? 'gold' : 'silver') // 假设
                              
                              if (price > 0) {
                                  const total = price * msg.num
                                  if (coinType === 'gold') {
                                      // 1000 金瓜子 = 1 人民币
                                      valueRMB = total / 1000
                                      valueText = `￥${valueRMB >= 1 ? valueRMB.toFixed(1) : valueRMB}` 
                                  } else {
                                      // 银瓜子或未知
                                      // valueText = `${total} Silver`
                                  }
                              }
  
                              // 过滤逻辑
                              if (valueRMB <= minGiftPrice) return null

                              const isHighValue = valueRMB > 500
                              
                              // 获取图片 URL
                              const giftImg = config ? config.img : (msg.gift_info.webp || msg.gift_info.img_basic)

                              // 如果价值 <= 29，使用单行显示 (和弹幕类似)
                              if (valueRMB <= 29) {
                                  return (
                                       <div 
                                         key={item.id} 
                                         className={styles['danmu-item']} // 复用弹幕行样式
                                         style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', flexWrap: 'wrap', gap: '4px', ...readStyle }}
                                         onDoubleClick={() => handleToggleRead(item.id)}
                                       >
                                           <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                               {/* 头像 */}
                                               <img 
                                                   src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
                                                   alt="face" 
                                                   style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px', cursor: 'pointer' }} 
                                                   onClick={(e) => handleUserClick(e, msg.sender)}
                                                   data-user-action-trigger="true"
                                               />
                                               
                                               {/* 勋章 */}
                                               {msg.sender.medal_info && msg.sender.medal_info.is_lighted === 1 && (
                                                   <span 
                                                     className={styles['medal-badge']}
                                                     style={{
                                                       borderColor: getMedalColor(msg.sender.medal_info.medal_level),
                                                       backgroundColor: getMedalColor(msg.sender.medal_info.medal_level),
                                                       backgroundImage: 'none',
                                                       marginRight: '6px',
                                                       whiteSpace: 'nowrap'
                                                     }}
                                                   >
                                                       {msg.sender.medal_info.medal_name}|{msg.sender.medal_info.medal_level}
                                                   </span>
                                               )}
                                               
                                               {/* 用户名 (黑色加粗) */}
                                               <span 
                                                   style={{ color: '#333', fontWeight: 'bold', marginRight: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                                                   onClick={(e) => handleUserClick(e, msg.sender)}
                                                   data-user-action-trigger="true"
                                               >
                                                   {msg.sender.uname}
                                               </span>
                                           </div>
                                           
                                           <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                                               <span style={{ color: '#666', marginRight: '4px', whiteSpace: 'nowrap' }}>投喂</span>
     
                                               {/* 礼物图片 */}
                                               {giftImg && (
                                                   <img 
                                                       src={giftImg} 
                                                       alt="gift" 
                                                       style={{ width: '24px', height: '24px', marginRight: '4px', objectFit: 'contain' }} 
                                                   />
                                               )}
                                               
                                               {/* 礼物名称 (蓝色) */}
                                               <span style={{ color: '#00a1d6', fontWeight: 'bold', marginRight: '4px', whiteSpace: 'nowrap' }}>
                                                   {msg.gift_info.name} x{msg.num}
                                               </span>
                                               
                                               {/* 价值 */}
                                               {valueText && (
                                                   <span style={{ color: '#00a1d6', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                                                       ({valueText})
                                                   </span>
                                               )}
                                           </div>
                                       </div>
                                  )
                              }

                              return (
                                  <div 
                                    key={item.id} 
                                    className={styles['gift-card-anim']}
                                    style={{
                                        backgroundColor: valueRMB > 99 ? '#E8A900' : '#f085a5', // 金色 (>99) 或 粉色
                                        color: '#fff',
                                        borderRadius: '8px',
                                        padding: '10px 12px',
                                        marginBottom: '8px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                                        fontWeight: 'bold',
                                        border: 'none',
                                        ...readStyle
                                    }}
                                    onDoubleClick={() => handleToggleRead(item.id)}
                                  >
                                      <div 
                                        style={{ position: 'relative', marginRight: '12px', cursor: 'pointer' }}
                                        onClick={(e) => handleUserClick(e, msg.sender)}
                                        data-user-action-trigger="true"
                                      >
                                          <img 
                                              src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
                                              alt="face" 
                                              style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} 
                                          />
                                      </div>
                                      
                                      <div style={{ flex: 1 }}>
                                          <div 
                                              style={{ fontSize: '15px', lineHeight: '1.2', cursor: 'pointer' }}
                                              onClick={(e) => handleUserClick(e, msg.sender)}
                                              data-user-action-trigger="true"
                                          >
                                              {msg.sender.uname}
                                          </div>
                                          <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                                              {msg.action} {msg.gift_info.name} x{msg.num}
                                          </div>
                                      </div>
                                      
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '8px' }}>
                                          {giftImg && (
                                              <img 
                                                  src={giftImg} 
                                                  alt="gift" 
                                                  style={{ width: '32px', height: '32px', marginBottom: '2px', objectFit: 'contain' }} 
                                              />
                                          )}
                                          <div style={{ fontSize: '14px' }}>￥{valueRMB.toFixed(1)}</div>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </div>

              </div>
              
              {/* 用户操作菜单 (Portal) */}
              {selectedUser && (
                  <UserActionMenu 
                      user={selectedUser.user} 
                      position={selectedUser.position} 
                      onClose={() => setSelectedUser(null)} 
                      onFilter={handleFilterUser}
                      onHighlight={handleHighlightUser}
                      isHighlighted={highlightedUsers.has(String(selectedUser.user.uid))}
                      isAdmin={isAdmin}
                      onMute={handleMuteUser}
                  />
              )}
          </div>
        </React.Fragment>
      )
  }

  // 房间选择视图（已登录但未连接）
  return (
    <React.Fragment>
      <Head>
        <title>选择直播间 - Luludanmaku</title>
      </Head>
      <div className={roomSelectStyles.container}>
        <div className={roomSelectStyles.card}>
            <div className={roomSelectStyles.header}>
                <div className={roomSelectStyles.welcome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    {userInfo?.face && (
                        <img 
                            src={userInfo.face} 
                            alt="avatar" 
                            style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid #fff', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} 
                        />
                    )}
                    <div>
                        欢迎回来, <span className={roomSelectStyles.username}>{userInfo?.uname || userInfo?.DedeUserID}</span>
                    </div>
                </div>
                <h2 className={roomSelectStyles.title}>请输入直播间 ID</h2>
            </div>
            
            <div className={roomSelectStyles.formGroup}>
                <div className={roomSelectStyles.inputWrapper} ref={wrapperRef}>
                    <input 
                         type="number" 
                         className={roomSelectStyles.input}
                         placeholder="例如: 21013446" 
                         value={roomId}
                         onChange={e => setRoomId(e.target.value)}
                         onKeyDown={e => {
                             if (e.key === 'Enter') connectDanmu()
                             if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault()
                         }}
                         onFocus={() => setShowHistoryDropdown(true)}
                     />
                    {showHistoryDropdown && roomHistory.length > 0 && (
                        <div className={roomSelectStyles.dropdown}>
                            {roomHistory.map(histId => (
                                <div 
                                    key={histId} 
                                    className={roomSelectStyles.dropdownItem}
                                    onClick={() => {
                                        setRoomId(histId)
                                        setShowHistoryDropdown(false)
                                    }}
                                >
                                    <span>{histId}</span>
                                    <span 
                                        className={roomSelectStyles.deleteBtn}
                                        onClick={(e) => deleteHistory(e, histId)}
                                        title="删除"
                                    >
                                        ×
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button 
                    className={roomSelectStyles.btnConnect}
                    onClick={connectDanmu} 
                    disabled={danmuStatus.startsWith('Connecting') || danmuStatus.startsWith('Fetching')}
                >
                    {danmuStatus.startsWith('Connecting') || danmuStatus.startsWith('Fetching') ? '连接中...' : '连接'}
                </button>
            </div>
            
            <p className={`${roomSelectStyles.status} ${danmuStatus.startsWith('Connection Failed') ? roomSelectStyles.statusError : ''}`}>
                {danmuStatus !== 'Disconnected' ? danmuStatus : ''}
            </p>

            <button 
                className={roomSelectStyles.btnLogout}
                onClick={() => {
                    setLoggedIn(false)
                    setUserInfo(null)
                    initLogin()
                }}
            >
                退出登录
            </button>
        </div>
      </div>
    </React.Fragment>
  )
}
