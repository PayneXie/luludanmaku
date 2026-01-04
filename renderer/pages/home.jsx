import React, { useEffect, useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import Head from 'next/head'
import QRCode from 'qrcode'
import { getQrCode, checkQrCode, QrCodeStatus, getDanmuInfo, getGiftConfig } from '@/lib/bilibili'
import { createDanmuEntry } from '@/lib/common/danmu-entry'
import { DanmuMessage, GiftMessage, SuperChatMessage } from '@/lib/types/danmaku'
import { levelToIconURL } from '@/lib/utils'
import moment from 'moment'
import styles from '@/styles/console.module.css' // Import CSS Module
import loginStyles from '@/styles/login.module.css' // Import Login CSS Module
import roomSelectStyles from '@/styles/room-select.module.css' // Import Room Select CSS Module
import DebugPanel from '@/components/DebugPanel' // Import Debug Panel

import level1 from '../public/images/level1.png'
import level2 from '../public/images/level2.png'
import level3 from '../public/images/level3.png'

export default function HomePage() {
  const [qrImage, setQrImage] = useState('')
  const [status, setStatus] = useState('初始化中...')
  const [loggedIn, setLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  
  // Danmu state
  const [roomId, setRoomId] = useState('')
  const [danmuStatus, setDanmuStatus] = useState('Disconnected')
  const [danmuList, setDanmuList] = useState([])
  const danmuListRef = useRef(null)
  
  // Gift Config Cache
  const [giftMap, setGiftMap] = useState({}) 
  // Gift Filter
  const [minGiftPrice, setMinGiftPrice] = useState(0) // RMB
  const [showGiftSettings, setShowGiftSettings] = useState(false)
  
  // Debug State
  const [showDebug, setShowDebug] = useState(false)
  
  // Window State
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false)
  const toggleAlwaysOnTop = () => {
      const newState = !isAlwaysOnTop
      setIsAlwaysOnTop(newState)
      window.ipc.send('window-set-always-on-top', newState)
  }
  
  // UI Settings
  const [showSettings, setShowSettings] = useState(false)
  const [uiScale, setUiScale] = useState(1.0)
  const [fontSize, setFontSize] = useState(14)

  // Room History
  const [roomHistory, setRoomHistory] = useState([])
  const [showHistoryDropdown, setShowHistoryDropdown] = useState(false)
  const wrapperRef = useRef(null)

  // Load Settings & History
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

  // Save Settings
  const saveSettings = (scale, font) => {
      setUiScale(scale)
      setFontSize(font)
      localStorage.setItem('uiScale', scale.toString())
      localStorage.setItem('fontSize', font.toString())
  }
  
  // Column Widths (in percent)
  // Initial: 33.33% each.
  const [colWidths, setColWidths] = useState([33.33, 33.33, 33.33])
  const containerRef = useRef(null)

  const pollTimer = useRef(null)

  // Drag Handling
  const startResize = (index, e) => {
      e.preventDefault()
      const startX = e.clientX
      const startWidths = [...colWidths]
      const containerWidth = containerRef.current.getBoundingClientRect().width
      
      const onMouseMove = (moveEvent) => {
          const deltaX = moveEvent.clientX - startX
          const deltaPercent = (deltaX / containerWidth) * 100
          
          const newWidths = [...startWidths]
          // Adjust current column and next column
          // Constraint: Minimum 10% width
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
          if (updated.length > 2000) return updated.slice(-2000)
          return updated
      })
  }

  const connectDanmu = async () => {
    if (!roomId) return alert('Please enter Room ID')
    if (!userInfo) return alert('Please login first')
    
    // Clear previous list
    setDanmuList([])
    
    addSystemMessage(`直播间已连接：${roomId}`)

    try {
      setDanmuStatus('Fetching Room Info...')
      const danmuInfo = await getDanmuInfo(userInfo, Number(roomId))
      
      addSystemMessage('基础信息已加载，正在建立连接…')

      // Fetch Gift Config in parallel (non-blocking)
      getGiftConfig(Number(roomId)).then(config => {
          const map = {}
          if (config && config.list) {
              config.list.forEach(g => {
                  map[g.id] = {
                      name: g.name,
                      price: g.price,
                      coin_type: g.coin_type // 'gold' or 'silver'
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
      
      // Connect via Main Process
      window.ipc.send('bilibili-connect-socket', wsInfo)
      
      saveToHistory(roomId)
      
      // Setup listener
      // We use a ref to hold the listener so we can remove it later
      const msgHandler = (event, msg) => {
         // Keep max 500 total messages to prevent memory issues, but filter logic in render handles separation
         // We'll just append and slice if too big
         setDanmuList(prev => {
             const newList = [...prev, { 
                id: Math.random(), 
                type: 'msg',
                data: null // will be set below
            }]
            // However, since we have different types, we should construct the object first
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
            } else if (msg.cmd === 'SYSTEM_MSG') {
                   newItem = { id: Math.random(), type: 'system', data: msg.msg }
            }

            if (!newItem) return prev;
            
            // Limit total history to 1000 to avoid crash, but that should be enough for "persistence" during session
            const updated = [...prev, newItem]
            if (updated.length > 2000) return updated.slice(-2000)
            return updated
         })
      }
      
      // Remove old listener to avoid duplicates
      window.ipc.removeAllListeners('danmu-message')
      window.ipc.on('danmu-message', msgHandler)
      
      setDanmuStatus('Connected (Main Process)')
      
      addSystemMessage('弹幕已加载…')

    } catch (e) {
      console.error(e)
      const errText = 'Connection Failed: ' + (e.message || 'Unknown error')
      setDanmuStatus(errText)
      addSystemMessage(errText)
    }
  }

  const initLogin = async () => {
    try {
      stopPolling() // Clear existing timer if any
      setStatus('正在获取二维码...')
      const { url, oauthKey } = await getQrCode()
      
      const dataUrl = await QRCode.toDataURL(url)
      setQrImage(dataUrl)
      setStatus('请使用哔哩哔哩手机客户端扫码')
      
      // Start polling
      pollTimer.current = setInterval(async () => {
        try {
          const data = await checkQrCode(oauthKey)
          // QrCodeStatus: NeedScan: 0, NeedConfirm: 1, Success: 2
          if (data.status === QrCodeStatus.Success) { // Success
            stopPolling()
            setStatus('登录成功！')
            setLoggedIn(true)
            setUserInfo(data.cookies)
          } else if (data.status === QrCodeStatus.NeedConfirm) {
            setStatus('已扫码，请在手机上确认')
          } else if (data.status === QrCodeStatus.NeedScan) {
            // Waiting for scan, do nothing
          }
        } catch (pollErr) {
             // Handle error (likely expired)
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

  // Use Bilibili standard level colors for medals instead of the raw color which can be dark
  const getMedalColor = (level) => {
      if (level >= 1 && level <= 20) return '#61c05a' // Green (1-20)
      if (level >= 21 && level <= 40) return '#5896de' // Blue (21-40)
      if (level >= 41 && level <= 60) return '#a068f1' // Purple (41-60)
      if (level >= 61) return '#f08c00' // Gold (>60)
      return '#61c05a' // Default
  }

  // Auto scroll/top logic
  // We want: Newest at top.
  // Unless user scrolls down, keep at top.
  useEffect(() => {
    if (danmuListRef.current) {
        // Since we are reversing the list (flex-direction column, but mapping reverse),
        // scrollTop 0 is actually the top (newest).
        // If user scrolls down (scrollTop > 0), we stop auto-scrolling to top.
        
        // Wait, standard behavior for "Newest at Top":
        // 1. Render list as [New, Old, Older...]
        // 2. Container scrollTop = 0 means we are at the newest.
        // 3. If user scrolls down (scrollTop > threshold), we don't force it back to 0.
        // 4. If scrollTop is near 0, we keep it at 0.
        
        const { scrollTop } = danmuListRef.current
        if (scrollTop < 50) { // Threshold
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

  // Helper to safely get icon URL
  const getGuardIcon = (level) => {
    if (level === 1) return level1.src || level1
    if (level === 2) return level2.src || level2
    if (level === 3) return level3.src || level3
    return ''
  }

  // Connected View
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
              {/* Header */}
              <div className={styles['console-header']} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 15px' }}>
                  <div className={styles['room-info']} style={{ display: 'flex', flexDirection: 'column' }}>
                      <strong style={{ fontSize: '14px' }}>直播间: {roomId}</strong>
                      <span style={{ fontSize: '12px', color: '#888' }}>用户: {userInfo?.DedeUserID}</span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {/* Always on Top Button (Pin Icon) */}
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
                            // Pinned (Solid)
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                                <path d="M16,12V4H17V2H7V4H8V12L6,14V16H11.2V22H12.8V16H18V14L16,12Z" />
                            </svg>
                        ) : (
                            // Unpinned (Outline)
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 12V4h1V2H7v2h1v8l-2 2v2h5.2v6h2.8v-6H18v-2l-2-2z"></path>
                            </svg>
                        )}
                      </button>

                      {/* Debug Button (Bug Icon) */}
                      <button 
                        title="调试工具"
                        style={{ 
                            padding: '6px', 
                            cursor: 'pointer',
                            backgroundColor: showDebug ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
                            color: showDebug ? '#333' : '#666',
                            border: '1px solid transparent',
                            borderRadius: '4px',
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

                      {/* Settings Button (Gear Icon) */}
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
                          
                          {/* Settings Modal (Portal) */}
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
                                  fontFamily: 'sans-serif', // Reset font
                                  fontSize: '14px' // Reset font size
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

                      {/* Disconnect Button (Power Icon) */}
                      <button 
                        title="断开连接"
                        className={styles['btn-disconnect']} 
                        onClick={disconnectDanmu}
                        style={{
                            padding: '6px',
                            cursor: 'pointer',
                            backgroundColor: 'transparent',
                            color: '#ff4d4f', // Red for disconnect
                            border: '1px solid transparent',
                            borderRadius: '4px',
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

              {/* Debug Panel */}
              {showDebug && <DebugPanel onClose={() => setShowDebug(false)} />}

              {/* Main Content - 3 Columns */}
              <div className={styles['console-body']} ref={containerRef}>
                  
                  {/* Left: Danmu List (Scrollable) */}
                  <div 
                    className={`${styles['column']} ${styles['col-danmu']}`}
                    style={{ width: `${colWidths[0]}%` }}
                  >
                      <div className={styles['col-header']}>弹幕列表</div>
                      <div 
                        ref={danmuListRef}
                        className={styles['col-content']}
                        style={{ flex: 1, overflowY: 'auto' }} // Ensure it scrolls
                      >
                          {danmuList.filter(item => item.type === 'msg' || item.type === 'system').slice().reverse().map(item => {
                              if (item.type === 'msg') {
                                  const msg = item.data
                                  const isGuard = msg.sender.medal_info && msg.sender.medal_info.guard_level > 0
                                  return (
                                    <div key={item.id} className={styles['danmu-item']}>
                                        {/* Medal */}
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
                                        
                                        {/* Guard Icon */}
                                        {isGuard && (
                                            <img 
                                                src={getGuardIcon(msg.sender.medal_info.guard_level)}
                                                className={styles['guard-icon']}
                                                alt="guard"
                                            />
                                        )}
                                        
                                        {/* Sender */}
                                        <span className={`${styles['uname']} ${isGuard ? styles['uname-guard'] : styles['uname-normal']}`}>
                                            {msg.sender.uname}:
                                        </span>
                                        
                                        {/* Content */}
                                        <span>{msg.content}</span>
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

                  {/* Resizer 1 */}
                  <div 
                    className={styles['resizer']} 
                    onMouseDown={(e) => startResize(0, e)}
                  />

                  {/* Middle: SuperChats (Sticky) */}
                  <div 
                    className={`${styles['column']} ${styles['col-sc']}`}
                    style={{ width: `${colWidths[1]}%` }}
                  >
                      <div className={styles['col-header']} style={{ color: 'var(--sc-level-4)' }}>醒目留言</div>
                      <div className={styles['col-content']}>
                          {danmuList.filter(item => item.type === 'superchat').reverse().map(item => {
                              const msg = item.data
                              // Bilibili SC Color Levels
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
                              return (
                                <div key={item.id} className={styles['sc-card']} style={{ borderColor: levelColor }}>
                                    <div className={styles['sc-header']} style={{ backgroundColor: levelColor }}>
                                        {/* SC User Avatar */}
                                        <img 
                                            src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
                                            alt="face" 
                                            style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '6px', verticalAlign: 'middle' }} 
                                        />
                                        
                                        {/* SC Medal (Similar to Danmu) */}
                                        {msg.sender.medal_info && msg.sender.medal_info.is_lighted === 1 && (
                                            <span 
                                              className={styles['medal-badge']}
                                              style={{
                                                borderColor: getMedalColor(msg.sender.medal_info.medal_level),
                                                backgroundColor: getMedalColor(msg.sender.medal_info.medal_level),
                                                backgroundImage: 'none',
                                                marginRight: '6px',
                                                transform: 'none', // Reset transform for flex alignment
                                                lineHeight: '14px', // Adjust line height for better centering
                                                display: 'flex', // Use flex to center text inside badge
                                                alignItems: 'center',
                                                height: '16px' // Fixed height matching icon
                                              }}
                                            >
                                                {msg.sender.medal_info.medal_name}|{msg.sender.medal_info.medal_level}
                                            </span>
                                        )}

                                        <span style={{fontWeight:'bold'}}>{msg.sender.uname}</span>
                                        <span style={{marginLeft: 'auto'}}>￥{msg.price}</span>
                                    </div>
                                    <div className={styles['sc-body']}>
                                        {msg.message}
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

                  {/* Resizer 2 */}
                  <div 
                    className={styles['resizer']} 
                    onMouseDown={(e) => startResize(1, e)}
                  />

                  {/* Right: Gifts */}
                  <div 
                    className={`${styles['column']} ${styles['col-gift']}`}
                    style={{ width: `${colWidths[2]}%` }}
                  >
                      <div className={styles['col-header']} style={{ color: 'var(--accent-yellow)', display: 'flex', justifyContent: 'space-between', position: 'relative' }}>
                          <span>礼物列表</span>
                          
                          {/* Settings Icon (SVG) */}
                          <div 
                            style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            onClick={() => setShowGiftSettings(!showGiftSettings)}
                          >
                             <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                 <circle cx="12" cy="12" r="3"></circle>
                                 <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                             </svg>
                          </div>

                          {/* Settings Popover (Native) */}
                          {showGiftSettings && (
                              <div style={{
                                  position: 'absolute',
                                  top: '40px',
                                  right: '10px',
                                  width: '240px',
                                  background: '#fff',
                                  border: '1px solid #ddd',
                                  borderRadius: '6px',
                                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                                  padding: '12px',
                                  zIndex: 1000,
                                  color: '#333'
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
                                      低于 ￥{minGiftPrice} 的礼物将被隐藏。
                                  </div>
                                  {/* Close overlay/click-outside handler is simplified here */}
                              </div>
                          )}
                      </div>
                      <div className={styles['col-content']}>
                          {danmuList.filter(item => item.type === 'gift').slice(-50).reverse().map(item => {
                              const msg = item.data
                              const config = giftMap[msg.gift_info.id]
                              
                              // Calculate Value
                              let valueRMB = 0
                              let valueText = ''
                              // Prefer config, fallback to msg.gift_info.price
                              const price = config ? config.price : msg.gift_info.price
                              const coinType = config ? config.coin_type : (msg.gift_info.price > 0 ? 'gold' : 'silver') // Assumption
                              
                              if (price > 0) {
                                  const total = price * msg.num
                                  if (coinType === 'gold') {
                                      // 1000 Gold = 1 RMB
                                      valueRMB = total / 1000
                                      valueText = `￥${valueRMB >= 1 ? valueRMB.toFixed(1) : valueRMB}` 
                                  } else {
                                      // Silver or unknown
                                      // valueText = `${total} Silver`
                                  }
                              }

                              // Filter Logic
                              if (valueRMB < minGiftPrice) return null

                              return (
                                  <div key={item.id} className={styles['gift-card']}>
                                      <div className={styles['gift-row-top']}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <img 
                                                src={msg.sender.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
                                                alt="face" 
                                                style={{ width: '20px', height: '20px', borderRadius: '50%' }} 
                                            />
                                            <span style={{ color: 'var(--accent-yellow)', fontWeight: 'bold' }}>{msg.sender.uname}</span>
                                          </div>
                                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                                              <span style={{ color: 'var(--text-secondary)' }}>{moment(msg.timestamp*1000).format('HH:mm:ss')}</span>
                                              {valueText && <span style={{ color: 'var(--accent-pink)', fontWeight: 'bold', fontSize: '12px' }}>{valueText}</span>}
                                          </div>
                                      </div>
                                      <div className={styles['gift-row-bot']}>
                                          <span style={{ color: 'var(--text-secondary)' }}>{msg.action}</span>
                                          <span className={styles['gift-name']}>{msg.gift_info.name}</span>
                                          <span style={{ fontWeight: 'bold' }}>x {msg.num}</span>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </div>

              </div>
          </div>
        </React.Fragment>
      )
  }

  // Room Selection View (Logged in but not connected)
  return (
    <React.Fragment>
      <Head>
        <title>选择直播间 - Luludanmaku</title>
      </Head>
      <div className={roomSelectStyles.container}>
        <div className={roomSelectStyles.card}>
            <div className={roomSelectStyles.header}>
                <div className={roomSelectStyles.welcome}>
                    欢迎回来, <span className={roomSelectStyles.username}>{userInfo?.DedeUserID}</span>
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
