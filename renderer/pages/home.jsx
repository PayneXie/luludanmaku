import React, { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { createPortal } from 'react-dom'
import Head from 'next/head'
import QRCode from 'qrcode'
import { getQrCode, checkQrCode, QrCodeStatus, getDanmuInfo, getGiftConfig } from '@/lib/bilibili'
import { createDanmuEntry } from '@/lib/common/danmu-entry'
import { DanmuMessage, GiftMessage, SuperChatMessage, GuardMessage } from '@/lib/types/danmaku'
import { DanmuItem, ScItem, GiftItem } from '@/components/DanmuListItems'
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

const TitleBar = ({ title, onToggleBorderless, isBorderlessActive, onToggleAlwaysOnTop, isAlwaysOnTop }) => (
  <div style={{
    height: '32px',
    background: '#f8f9fa', // 将会被覆盖或合并，保持默认
    borderBottom: '1px solid #dee2e6',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 0 0 8px',
    WebkitAppRegion: 'drag',
    userSelect: 'none',
    flexShrink: 0,
    width: '100%',
    boxSizing: 'border-box',
    borderTopLeftRadius: '6px',
    borderTopRightRadius: '6px'
  }}>
      <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', marginLeft: '8px', pointerEvents: 'none' }}>
        {title || 'Luludanmaku'}
      </div>
      <div style={{ display: 'flex', WebkitAppRegion: 'no-drag', height: '100%' }}>
        {onToggleAlwaysOnTop && (
          <button 
            onClick={onToggleAlwaysOnTop}
            title={isAlwaysOnTop ? "取消置顶" : "置顶窗口"}
            className={styles['title-bar-btn']}
            style={{ color: isAlwaysOnTop ? '#00a1d6' : 'currentColor' }}
          >
            {isAlwaysOnTop ? (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                </svg>
            ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h2.8v-6H18v-2l-2-2z"></path>
                </svg>
            )}
          </button>
        )}
        {onToggleBorderless && (
          <button 
              onClick={onToggleBorderless} 
              title={isBorderlessActive ? "退出无边框模式" : "无边框模式"}
              className={styles['title-bar-btn']}
          >
               <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
                  <line x1="9" y1="3" x2="9" y2="21"></line>
              </svg>
          </button>
        )}
        <button onClick={() => window.ipc.send('window-min')} className={styles['title-bar-btn']} title="最小化">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
        <button onClick={() => window.ipc.send('window-max')} className={styles['title-bar-btn']} title="最大化">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
        </button>
        <button onClick={() => window.ipc.send('window-close')} className={styles['title-bar-btn-close']} title="关闭">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
        </button>
      </div>
    </div>
)

const CopyButton = ({ text, style }) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        if (window.ipc) {
            window.ipc.send('clipboard-write', text)
        } else {
            // Fallback
            navigator.clipboard.writeText(text).catch(e => console.error('Copy failed:', e))
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button 
            onClick={handleCopy}
            style={{ 
                ...style,
                background: copied ? '#4caf50' : style.background, // Green on success
                color: copied ? '#fff' : style.color,
                transition: 'all 0.2s',
                minWidth: '48px' // Prevent layout shift
            }}
        >
            {copied ? '已复制' : '复制'}
        </button>
    )
}

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
                newItem = { id: Math.random(), type: 'msg', data: new DanmuMessage({ info: msg.info }) }
                listType = 'danmu'
             } catch(e) { console.error(e); return; }
         } else if (msg.cmd === 'SEND_GIFT') {
             try {
                newItem = { id: Math.random(), type: 'gift', data: new GiftMessage(msg) }
                listType = 'gift'
             } catch(e) { console.error(e); return; }
         } else if (msg.cmd === 'SUPER_CHAT_MESSAGE') {
             try {
                newItem = { id: Math.random(), type: 'superchat', data: new SuperChatMessage(msg) }
                listType = 'sc'
             } catch(e) { console.error(e); return; }
         } else if (msg.cmd === 'USER_TOAST_MSG') {
             try {
                newItem = { id: Math.random(), type: 'gift', data: new GuardMessage(msg) }
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
  
  // 工具面板状态
  // const [showTools, setShowTools] = useState(false) // Deprecated: Moved to independent window

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
          window.ipc.send('window-set-size', { width: 1000, height: 600, animate: true })
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
  }, []) // 没有任何依赖，永远稳定
  
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
      const savedLimit = localStorage.getItem('maxDanmuLimit')
      
      if (savedScale) setUiScale(parseFloat(savedScale))
      if (savedFont) setFontSize(parseInt(savedFont))
      if (savedLimit) setMaxDanmuLimit(parseInt(savedLimit))
      
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
  const saveSettings = (scale, font, limit) => {
      setUiScale(scale)
      setFontSize(font)
      setMaxDanmuLimit(limit)
      localStorage.setItem('uiScale', scale.toString())
      localStorage.setItem('fontSize', font.toString())
      localStorage.setItem('maxDanmuLimit', limit.toString())
  }
  
  // 列宽（百分比）
  // 初始值：每列 33.33%
  const [colWidths, setColWidths] = useState([33.33, 33.33, 33.33])
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
      // Usually code -101 means Not Logged In
      if (e.code === -101 || (e.message && e.message.includes('-101'))) {
          alert('登录凭证已过期，请重新扫码登录')
          setLoggedIn(false)
          setUserInfo(null)
          initLogin()
          return
      }

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
              // Also check here if needed, but usually connectDanmu is the main gate
              if (res.error && (res.error.code === -101 || String(res.error).includes('-101'))) {
                  // Optional: Auto logout here too?
                  // Maybe just log for now, as connectDanmu is the explicit action
              }
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

  const getGuardIcon = (level) => {
      if (level === 1) return level1.src
      if (level === 2) return level2.src
      if (level === 3) return level3.src
      return level3.src
  }

  // 自动滚动/置顶逻辑
  useEffect(() => {
    // 现在的列表顺序是 [New, Old...]
    // 只要 scrollTop 在 0，用户就能看到最新的。
    // 如果用户没有滚动（或者距离顶部很近），我们强制保持在顶部。
    if (danmuListRef.current) {
        const { scrollTop } = danmuListRef.current
        if (scrollTop < 50) { 
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
          <style global jsx>{`
            body {
              margin: 0;
              padding: 0;
              overflow: hidden;
              font-family: "Microsoft YaHei", sans-serif;
              background-color: transparent;
            }
          `}</style>
          <div style={{ 
               display: 'flex', 
               flexDirection: 'column', 
               height: 'calc(100vh - 8px)', 
               margin: '4px',
               background: '#fff',
               borderRadius: '6px',
               overflow: 'hidden',
               border: '1px solid rgba(0,0,0,0.06)',
               boxShadow: '0 0 6px 0 rgba(0,0,0,0.3)',
               position: 'relative'
           }}>
            <TitleBar title="登录 - Luludanmaku" />
            <div className={loginStyles.container} style={{ flex: 1, overflow: 'auto' }}>
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
          </div>
        </React.Fragment>
      )
  }

  // 安全获取图标 URL 的辅助函数
  // (移至 DanmuListItems.jsx)

  // 已连接视图
  if (danmuStatus.startsWith('Connected')) {
      if (isBorderless) {
          return (
            <React.Fragment>
              <Head>
                <title>Danmaku - Borderless</title>
              </Head>
              <style global jsx>{`
                body {
                  margin: 0;
                  padding: 0;
                  overflow: hidden;
                  font-family: "Microsoft YaHei", sans-serif;
                  background-color: transparent;
                }
              `}</style>
              <div style={{
                  height: '100vh',
                  width: '100%',
                  backgroundColor: 'rgba(0, 0, 0, 0.2)', // 灰黑色几乎透明
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative'
              }}>
                  {/* 顶部拖拽区 */}
                  <div style={{
                      height: '24px',
                      WebkitAppRegion: 'drag',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-end',
                      paddingRight: '8px',
                      background: 'rgba(0,0,0,0.4)',
                      cursor: 'move',
                      zIndex: 1000
                  }}>
                      <button 
                          onClick={toggleBorderlessMode}
                          style={{ WebkitAppRegion: 'no-drag', cursor: 'pointer', color: '#fff', background: 'transparent', border: 'none', display: 'flex' }}
                          title="退出无边框模式"
                      >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/></svg>
                      </button>
                  </div>
                  
                  <div style={{ flex: 1, overflow: 'hidden', padding: '0 8px' }} className={styles['no-scrollbar']}>
                      {danmuList.slice().reverse().map(item => {
                          if (!shouldShowItem(item)) return null
                          
                          // 渲染 Msg
                          if (item.type === 'msg') {
                              const msg = item.data
                              const isGuard = msg.sender.medal_info && msg.sender.medal_info.guard_level > 0
                              const unameColor = isGuard ? '#ff7f9e' : (msg.sender.is_vip || msg.sender.is_svip ? '#fb7299' : '#00a1d6')
                              const bgColor = isGuard ? 'rgba(255, 234, 239, 0.8)' : 'transparent' // 增加透明度适配
                              
                              const isRead = readMessages.has(item.id)
                              const readStyle = isRead ? { filter: 'grayscale(100%)', opacity: 0.6 } : {}

                              return (
                                <div 
                                    key={item.id} 
                                    className={styles['danmu-item']}
                                    style={{ backgroundColor: bgColor, display: 'flex', flexWrap: 'wrap', alignItems: 'center', color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)', ...readStyle }} // 增加文字阴影
                                >
                                    {/* 头部容器 (勋章+舰长图标+用户名) */}
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
                                    
                                    {/* 内容 */}
                                    <span style={{ wordBreak: 'break-word', lineHeight: '1.5' }}>
                                        <Linkify>{msg.content}</Linkify>
                                    </span>
                                </div>
                              )
                          }
                          
                          // 渲染 SuperChat
                          if (item.type === 'superchat') {
                              const msg = item.data
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
                                        <img 
                                            src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
                                            alt="face" 
                                            style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '6px', verticalAlign: 'middle', cursor: 'pointer' }} 
                                            onClick={(e) => handleUserClick(e, msg.sender)}
                                            data-user-action-trigger="true"
                                        />
                                        <span 
                                            style={{fontWeight:'bold', cursor: 'pointer'}}
                                            onClick={(e) => handleUserClick(e, msg.sender)}
                                            data-user-action-trigger="true"
                                        >
                                            {msg.sender.uname}
                                        </span>
                                        <span style={{marginLeft: 'auto'}}>￥{msg.price}</span>
                                    </div>
                                    <div className={styles['sc-content']}>
                                        {msg.message}
                                    </div>
                                </div>
                              )
                          }
                          
                          // 渲染 Gift
                          if (item.type === 'gift') {
                              const msg = item.data
                              const isRead = readMessages.has(item.id)
                              const readStyle = isRead ? { filter: 'grayscale(100%)', opacity: 0.6 } : {}
                              
                              if (msg instanceof GuardMessage || msg.guard_level) {
                                  const guardName = msg.guard_level === 1 ? '总督' : msg.guard_level === 2 ? '提督' : '舰长'
                                  const priceRMB = msg.price / 1000 
                                  
                                  if (priceRMB <= minGiftPrice) return null
                                  
                                  const cardBg = msg.guard_level === 1 ? '#d32f2f' :
                                                 msg.guard_level === 2 ? '#7b1fa2' :
                                                                         '#1976d2'

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
                                          <div style={{ position: 'relative', marginRight: '12px', cursor: 'pointer' }} onClick={(e) => handleUserClick(e, msg.sender)} data-user-action-trigger="true">
                                              <img src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} alt="face" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} />
                                              <img src={getGuardIcon(msg.guard_level)} style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '18px', height: '18px' }} alt="icon" />
                                          </div>
                                          <div style={{ flex: 1 }}>
                                              <div style={{ fontSize: '15px', lineHeight: '1.2', cursor: 'pointer' }} onClick={(e) => handleUserClick(e, msg.sender)} data-user-action-trigger="true">{msg.sender.uname}</div>
                                              <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>开通了 {guardName} x{msg.num}{msg.unit}</div>
                                          </div>
                                          <div style={{ fontSize: '16px', marginLeft: '8px' }}>￥{priceRMB}</div>
                                      </div>
                                  )
                              }

                              const config = giftMap[msg.gift_info.id]
                              const price = config ? config.price : msg.gift_info.price
                              const coinType = config ? config.coin_type : (msg.gift_info.price > 0 ? 'gold' : 'silver')
                              
                              let valueRMB = 0
                              if (price > 0 && coinType === 'gold') {
                                  valueRMB = (price * msg.num) / 1000
                              }
                              
                              if (valueRMB <= minGiftPrice) return null
                              
                              const giftImg = config ? config.img : (msg.gift_info.webp || msg.gift_info.img_basic)

                              if (valueRMB <= 29) {
                                  return (
                                      <div 
                                        key={item.id} 
                                        className={styles['danmu-item']} 
                                        style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', flexWrap: 'wrap', gap: '4px', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', ...readStyle }}
                                        onDoubleClick={() => handleToggleRead(item.id)}
                                      >
                                          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                              <img src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} alt="face" style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px', cursor: 'pointer' }} onClick={(e) => handleUserClick(e, msg.sender)} data-user-action-trigger="true" />
                                              <span style={{ color: '#fff', fontWeight: 'bold', marginRight: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={(e) => handleUserClick(e, msg.sender)} data-user-action-trigger="true">{msg.sender.uname}</span>
                                          </div>
                                          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                                              <span style={{ color: '#ccc', marginRight: '4px', whiteSpace: 'nowrap' }}>投喂</span>
                                              {giftImg && <img src={giftImg} alt="gift" style={{ width: '24px', height: '24px', marginRight: '4px', objectFit: 'contain' }} />}
                                              <span style={{ color: '#00a1d6', fontWeight: 'bold', marginRight: '4px', whiteSpace: 'nowrap' }}>{msg.gift_info.name} x{msg.num}</span>
                                          </div>
                                      </div>
                                  )
                              }

                              return (
                                  <div 
                                    key={item.id} 
                                    className={styles['gift-card-anim']}
                                    style={{
                                        backgroundColor: valueRMB > 99 ? '#E8A900' : '#f085a5',
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
                                      <div style={{ position: 'relative', marginRight: '12px', cursor: 'pointer' }} onClick={(e) => handleUserClick(e, msg.sender)} data-user-action-trigger="true">
                                          <img src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} alt="face" style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} />
                                      </div>
                                      <div style={{ flex: 1 }}>
                                          <div style={{ fontSize: '15px', lineHeight: '1.2', cursor: 'pointer' }} onClick={(e) => handleUserClick(e, msg.sender)} data-user-action-trigger="true">{msg.sender.uname}</div>
                                          <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>{msg.action} {msg.gift_info.name} x{msg.num}</div>
                                      </div>
                                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '8px' }}>
                                          {giftImg && <img src={giftImg} alt="gift" style={{ width: '32px', height: '32px', marginBottom: '2px', objectFit: 'contain' }} />}
                                          <div style={{ fontSize: '14px' }}>￥{valueRMB.toFixed(1)}</div>
                                      </div>
                                  </div>
                              )
                          }
                          
                          return null
                      })}
                  </div>
              </div>
            </React.Fragment>
          )
      }

      return (
        <React.Fragment>
          <Head>
            <title>Danmaku Console - {roomId}</title>
            <meta name="referrer" content="no-referrer" />
          </Head>
          <style global jsx>{`
            body {
              margin: 0;
              padding: 0;
              overflow: hidden;
              font-family: "Microsoft YaHei", sans-serif;
              background-color: transparent;
            }
          `}</style>
          <div 
            className={styles['console-container']}
            style={{
                zoom: uiScale,
                fontSize: `${fontSize}px`,
                height: 'calc(100vh - 8px)',
                margin: '4px',
                borderRadius: '6px',
                overflow: 'hidden',
                border: '1px solid rgba(0,0,0,0.06)',
                boxShadow: '0 0 6px 0 rgba(0,0,0,0.3)',
                position: 'relative'
            }}
          >
              <TitleBar 
                  title={roomInfo ? roomInfo.title : `Luludanmaku - ${roomId}`} 
                  onToggleBorderless={toggleBorderlessMode} 
                  isBorderlessActive={isBorderless} 
                  onToggleAlwaysOnTop={toggleAlwaysOnTop}
                  isAlwaysOnTop={isAlwaysOnTop}
              />
              {/* 头部 */}
              <div className={styles['console-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', backgroundColor: '#fff', borderBottom: '1px solid #eee', fontFamily: '"Microsoft YaHei", sans-serif' }}>
                  <div className={styles['room-info']} style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                      {/* 用户头像 */}
                      {userInfo?.face && (
                          <img 
                              src={userInfo.face} 
                              alt="avatar" 
                              referrerPolicy="no-referrer"
                              onError={(e) => { e.target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }}
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

                      {/* 工具按钮（图表图标） */}
                      <button 
                        title="实用工具"
                        style={{ 
                            padding: '6px', 
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            color: '#666',
                            border: '1px solid transparent',
                            borderRadius: '4px',
                            outline: 'none',
                            transition: 'all 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                        }}
                        onClick={openToolsWindow}
                      >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="18" y1="20" x2="18" y2="10"></line>
                            <line x1="12" y1="20" x2="12" y2="4"></line>
                            <line x1="6" y1="20" x2="6" y2="14"></line>
                        </svg>
                      </button>

                      {/* 设置按钮（齿轮图标） */}
                      <div style={{ position: 'relative' }} ref={settingsBtnRef}>
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
                              <div 
                                ref={settingsPanelRef}
                                style={{
                                  position: 'fixed',
                                  top: '105px', // 调整位置，避免遮挡按钮 (Header height approx 100px)
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
                                              onChange={(e) => saveSettings(parseFloat(e.target.value), fontSize, maxDanmuLimit)}
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
                                              onChange={(e) => saveSettings(uiScale, parseInt(e.target.value), maxDanmuLimit)}
                                              style={{ flex: 1 }}
                                          />
                                          <span style={{ fontSize: '12px' }}>24</span>
                                      </div>
                                  </div>

                                  <div>
                                      <div style={{ marginBottom: 8, fontWeight: 'bold', fontSize: '14px', marginTop: 16 }}>保留弹幕数 ({maxDanmuLimit})</div>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                          <span style={{ fontSize: '12px' }}>100</span>
                                          <input 
                                              type="range" 
                                              min="100" 
                                              max="5000" 
                                              step="100" 
                                              value={maxDanmuLimit}
                                              onChange={(e) => saveSettings(uiScale, fontSize, parseInt(e.target.value))}
                                              style={{ flex: 1 }}
                                          />
                                          <span style={{ fontSize: '12px' }}>5000</span>
                                      </div>
                                  </div>
                                  
                                  <div style={{ marginTop: '16px', textAlign: 'right' }}>
                                      <button 
                                        onClick={() => saveSettings(1.0, 14, 1000)}
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

              {/* 工具面板 (已移至独立窗口) */}
              {/* {showTools && <ToolsPanel onClose={() => setShowTools(false)} />} */}

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
                        style={{ flex: 1, overflowY: 'auto' }}
                      >
                          {danmuList.map(item => { // 直接 map
                              // Filter logic moved here to avoid creating intermediate arrays
                              if (item.type !== 'msg' && item.type !== 'system') return null
                              if (!shouldShowItem(item)) return null
                              
                              return (
                                  <DanmuItem 
                                    key={item.id} 
                                    item={item} 
                                    highlightedUsers={highlightedUsers}
                                    readMessages={readMessages}
                                    onUserClick={handleUserClick}
                                    onToggleRead={handleToggleRead}
                                  />
                              )
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
                          {scList.filter(item => item.type === 'superchat' && shouldShowItem(item)).map(item => {
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
                          {scList.filter(item => item.type === 'superchat').length === 0 && (
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
                          {giftList.filter(item => item.type === 'gift' && shouldShowItem(item)).map(item => {
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

              {/* OBS 弹幕源配置悬浮按钮 */}
              <div style={{ position: 'absolute', bottom: '20px', right: '20px', zIndex: 2000 }} ref={obsHelpBtnRef}>
                  <button
                      title="OBS 弹幕源配置"
                      style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '50%',
                          backgroundColor: '#fff',
                          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                          border: '1px solid #eee',
                          cursor: 'pointer',
                          color: showObsHelp ? '#00a1d6' : '#666',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.2s',
                          outline: 'none',
                          padding: 0
                      }}
                      onClick={() => setShowObsHelp(!showObsHelp)}
                      onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}
                  >
                      <svg xmlns="http://www.w3.org/2000/svg" x="0px" y="0px" width="100%" height="100%" viewBox="0 0 50 50" fill="currentColor">
                         <path d="M25,2C12.317,2,2,12.317,2,25s10.317,23,23,23s23-10.317,23-23S37.683,2,25,2z M43.765,34.373 c1.267-3.719-0.131-8.03-3.567-10.23c-4.024-2.576-9.374-1.401-11.95,2.623h0c-1.854,2.896-1.756,6.474-0.061,9.215 c-1.009,1.556-2.369,2.917-4.07,3.931c-5.4,3.22-12.356,1.952-16.225-2.779c-0.186-0.262-0.367-0.527-0.541-0.797 c2.62,3.273,7.404,4.213,11.166,2.09c4.161-2.348,5.631-7.625,3.283-11.786v0c-1.618-2.867-4.627-4.456-7.703-4.399 c-0.994-1.792-1.563-3.852-1.563-6.047c0-5.482,3.537-10.119,8.448-11.8c0.36-0.07,0.728-0.116,1.094-0.168 c-3.321,1.208-5.698,4.384-5.698,8.123c0,4.778,3.873,8.651,8.651,8.651c3.179,0,5.949-1.719,7.453-4.274 c2.197,0.015,4.417,0.594,6.427,1.825c5.056,3.094,7.173,9.294,5.39,14.713C44.137,33.643,43.948,34.007,43.765,34.373z"></path> 
                     </svg>
                  </button>

                  {/* OBS 配置模态框 */}
                  {showObsHelp && typeof document !== 'undefined' && createPortal(
                      <div
                          ref={obsHelpPanelRef}
                          style={{
                              position: 'fixed',
                              bottom: '50px',
                              right: '20px',
                              width: '320px',
                              background: '#fff',
                              border: '1px solid #ddd',
                              borderRadius: '8px',
                              boxShadow: '0 4px 20px rgba(0,0,0,0.2)',
                              padding: '16px',
                              zIndex: 9999,
                              color: '#333',
                              textAlign: 'left',
                              fontFamily: '"Microsoft YaHei", sans-serif',
                              fontSize: '14px',
                              animation: 'fadeInUp 0.2s ease-out'
                          }}
                      >
                          <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="10"></circle>
                                  <line x1="14.31" y1="8" x2="20.05" y2="17.94"></line>
                                  <line x1="9.69" y1="8" x2="21.17" y2="8"></line>
                                  <line x1="7.38" y1="12" x2="13.12" y2="2.06"></line>
                                  <line x1="9.69" y1="16" x2="3.95" y2="6.06"></line>
                                  <line x1="14.31" y1="16" x2="2.83" y2="16"></line>
                                  <line x1="16.62" y1="12" x2="10.88" y2="21.94"></line>
                              </svg>
                              OBS 弹幕源配置
                          </div>

                          {/* 链接区域 */}
                          <div style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#555' }}>正式链接 (用于直播)</div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                  <input 
                                      readOnly 
                                      value="http://localhost:18888/obs_chat.html" 
                                      style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ddd', background: '#f9f9f9', fontSize: '12px', color: '#333' }} 
                                      onClick={(e) => e.target.select()}
                                  />
                                  <CopyButton 
                                      text="http://localhost:18888/obs_chat.html"
                                      style={{ padding: '0 12px', cursor: 'pointer', background: '#00a1d6', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px' }}
                                  />
                              </div>
                          </div>

                          <div style={{ marginBottom: '16px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '4px', color: '#555' }}>测试链接 (用于预览样式)</div>
                              <div style={{ display: 'flex', gap: '8px' }}>
                                  <input 
                                      readOnly 
                                      value="http://localhost:18888/obs_chat_wechat.html" 
                                      style={{ flex: 1, padding: '6px', borderRadius: '4px', border: '1px solid #ddd', background: '#f9f9f9', fontSize: '12px', color: '#333' }} 
                                      onClick={(e) => e.target.select()}
                                  />
                                  <CopyButton 
                                      text="http://localhost:18888/obs_chat_wechat.html"
                                      style={{ padding: '0 12px', cursor: 'pointer', background: '#f0f0f0', color: '#333', border: '1px solid #ddd', borderRadius: '4px', fontSize: '12px' }}
                                  />
                              </div>
                          </div>

                          {/* 教学区域 */}
                          <div style={{ marginBottom: '16px', padding: '12px', background: '#f0f7ff', borderRadius: '6px', border: '1px solid #cce5ff' }}>
                              <div style={{ fontWeight: 'bold', fontSize: '13px', marginBottom: '8px', color: '#0056b3' }}>使用教学:</div>
                              <ol style={{ paddingLeft: '20px', margin: 0, fontSize: '12px', color: '#444', lineHeight: '1.6' }}>
                                  <li>在 OBS 来源中点击 "+" -&gt; 选择 "浏览器"</li>
                                  <li>取消勾选 "本地文件"</li>
                                  <li>在 URL 栏粘贴上方 "正式链接"</li>
                                  <li>建议尺寸: 宽 <strong>400</strong>, 高 <strong>800</strong></li>
                                  <li>在 "自定义 CSS" 中清空内容 (可选)</li>
                              </ol>
                          </div>

                          {/* 预留配置项 */}
                          <div style={{ borderTop: '1px solid #eee', paddingTop: '12px' }}>
                              <div style={{ fontSize: '12px', fontWeight: 'bold', marginBottom: '8px', color: '#999' }}>高级配置 (开发中)</div>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', opacity: 0.5 }}>
                                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'not-allowed' }}>
                                      <input type="checkbox" disabled checked style={{ marginRight: '6px' }} /> 开启背景透明
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'not-allowed' }}>
                                      <input type="checkbox" disabled style={{ marginRight: '6px' }} /> 隐藏免费礼物
                                  </label>
                                  <label style={{ display: 'flex', alignItems: 'center', fontSize: '12px', cursor: 'not-allowed' }}>
                                      <input type="checkbox" disabled style={{ marginRight: '6px' }} /> 仅显示付费留言 (SC/舰长)
                                  </label>
                              </div>
                          </div>
                      </div>,
                      document.body
                  )}
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
      <style global jsx>{`
        body {
          margin: 0;
          padding: 0;
          overflow: hidden;
          font-family: "Microsoft YaHei", sans-serif;
          background-color: transparent;
        }
      `}</style>
      <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          height: 'calc(100vh - 8px)', 
          margin: '4px', 
          background: '#f0f2f5',
          borderRadius: '6px',
          overflow: 'hidden',
          border: '1px solid rgba(0,0,0,0.06)',
          boxShadow: '0 0 6px 0 rgba(0,0,0,0.3)',
          position: 'relative'
      }}>
        <TitleBar title="选择直播间" />
        <div className={roomSelectStyles.container} style={{ flex: 1, overflow: 'auto' }}>
            <div className={roomSelectStyles.card}>
                <div className={roomSelectStyles.header}>
                    <div className={roomSelectStyles.welcome} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                        {userInfo?.face && (
                            <img 
                                src={userInfo.face} 
                                alt="avatar" 
                                referrerPolicy="no-referrer"
                                onError={(e) => { e.target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }}
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
      </div>
    </React.Fragment>
  )
}
