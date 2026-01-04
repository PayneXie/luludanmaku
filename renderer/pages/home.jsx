import React, { useEffect, useState, useRef } from 'react'
import Head from 'next/head'
import QRCode from 'qrcode'
import { getQrCode, checkQrCode, QrCodeStatus, getDanmuInfo, getGiftConfig } from '@/lib/bilibili'
import { createDanmuEntry } from '@/lib/common/danmu-entry'
import { DanmuMessage, GiftMessage, SuperChatMessage } from '@/lib/types/danmaku'
import { levelToIconURL } from '@/lib/utils'
import moment from 'moment'
import styles from '@/styles/console.module.css' // Import CSS Module
import DebugPanel from '@/components/DebugPanel' // Import Debug Panel

import level1 from '../public/images/level1.jpg'
import level2 from '../public/images/level2.png'
import level3 from '../public/images/level3.png'

export default function HomePage() {
  const [qrImage, setQrImage] = useState('')
  const [status, setStatus] = useState('Initializing...')
  const [loggedIn, setLoggedIn] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  
  // Danmu state
  const [roomId, setRoomId] = useState('')
  const [danmuStatus, setDanmuStatus] = useState('Disconnected')
  const [danmuList, setDanmuList] = useState([])
  const danmuListRef = useRef(null)
  
  // Gift Config Cache
  const [giftMap, setGiftMap] = useState({}) 
  
  // Debug State
  const [showDebug, setShowDebug] = useState(false)
  
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

  const connectDanmu = async () => {
    if (!roomId) return alert('Please enter Room ID')
    if (!userInfo) return alert('Please login first')

    try {
      setDanmuStatus('Fetching Room Info...')
      const danmuInfo = await getDanmuInfo(userInfo, Number(roomId))
      
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

    } catch (e) {
      console.error(e)
      setDanmuStatus('Connection Failed: ' + (e.message || 'Unknown error'))
    }
  }

  const initLogin = async () => {
    try {
      stopPolling() // Clear existing timer if any
      setStatus('Getting QR Code...')
      const { url, oauthKey } = await getQrCode()
      
      const dataUrl = await QRCode.toDataURL(url)
      setQrImage(dataUrl)
      setStatus('Please scan the QR code with Bilibili App')
      
      // Start polling
      pollTimer.current = setInterval(async () => {
        try {
          const data = await checkQrCode(oauthKey)
          // QrCodeStatus: NeedScan: 0, NeedConfirm: 1, Success: 2
          if (data.status === QrCodeStatus.Success) { // Success
            stopPolling()
            setStatus('Login Successful!')
            setLoggedIn(true)
            setUserInfo(data.cookies)
          } else if (data.status === QrCodeStatus.NeedConfirm) {
            setStatus('Scanned! Please confirm on your phone')
          } else if (data.status === QrCodeStatus.NeedScan) {
            // Waiting for scan, do nothing
          }
        } catch (pollErr) {
             // Handle error (likely expired)
             console.log('Poll error:', pollErr)
             setStatus('QR Code expired or error. Refreshing...')
             stopPolling()
             setTimeout(initLogin, 1000)
        }
      }, 3000)

    } catch (err) {
      console.error(err)
      setStatus('Error: ' + err.message)
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
            <title>Bilibili Login - Nextron</title>
          </Head>
          <div style={{ 
            display: 'flex', 
            flexDirection: 'column', 
            alignItems: 'center', 
            justifyContent: 'center', 
            height: '100vh',
            fontFamily: 'sans-serif'
          }}>
            <h1>Bilibili Login</h1>
            <div style={{ textAlign: 'center' }}>
                {qrImage && (
                  <div style={{ margin: '20px' }}>
                    <img src={qrImage} alt="Login QR Code" style={{ width: 200, height: 200 }} />
                  </div>
                )}
                <p style={{ fontSize: '1.2rem', color: '#666' }}>{status}</p>
                <button 
                  onClick={initLogin}
                  style={{
                    marginTop: '10px',
                    padding: '8px 16px',
                    cursor: 'pointer'
                  }}
                >
                  Refresh QR Code
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
          <div className={styles['console-container']}>
              {/* Header */}
              <div className={styles['console-header']}>
                  <div className={styles['room-info']}>
                      <strong>Room: {roomId}</strong>
                      <span>User: {userInfo?.DedeUserID}</span>
                  </div>
                  <button className={styles['btn-disconnect']} onClick={disconnectDanmu}>Disconnect</button>
                  <button 
                    style={{ marginLeft: '10px', padding: '6px 12px', cursor: 'pointer' }}
                    onClick={() => setShowDebug(!showDebug)}
                  >
                    Debug
                  </button>
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
                      <div className={styles['col-header']}>Danmaku Stream</div>
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
                      <div className={styles['col-header']} style={{ color: 'var(--sc-level-4)' }}>SuperChats</div>
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
                                  No SuperChats yet
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
                      <div className={styles['col-header']} style={{ color: 'var(--accent-yellow)' }}>Gifts</div>
                      <div className={styles['col-content']}>
                          {danmuList.filter(item => item.type === 'gift').slice(-50).reverse().map(item => {
                              const msg = item.data
                              const config = giftMap[msg.gift_info.id]
                              
                              // Calculate Value
                              let valueText = ''
                              // Prefer config, fallback to msg.gift_info.price
                              const price = config ? config.price : msg.gift_info.price
                              const coinType = config ? config.coin_type : (msg.gift_info.price > 0 ? 'gold' : 'silver') // Assumption
                              
                              if (price > 0) {
                                  const total = price * msg.num
                                  if (coinType === 'gold') {
                                      // 1000 Gold = 1 RMB
                                      const rmb = total / 1000
                                      valueText = `￥${rmb >= 1 ? rmb.toFixed(1) : rmb}` 
                                  } else {
                                      // Silver or unknown
                                      // valueText = `${total} Silver`
                                  }
                              }

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
        <title>Select Room - Nextron</title>
      </Head>
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '100vh',
        fontFamily: 'sans-serif'
      }}>
        <h2>Welcome, {userInfo?.DedeUserID}</h2>
        <div style={{ marginTop: '20px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h3>Enter Room ID</h3>
            <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                <input 
                    type="number" 
                    placeholder="Room ID (e.g. 21484828)" 
                    value={roomId}
                    onChange={e => setRoomId(e.target.value)}
                    style={{ padding: '8px', width: '200px' }}
                />
                <button 
                    onClick={connectDanmu} 
                    disabled={danmuStatus.startsWith('Connecting')}
                    style={{ padding: '8px 16px', cursor: 'pointer', background: '#00a1d6', color: '#fff', border: 'none', borderRadius: '4px' }}
                >
                    {danmuStatus.startsWith('Connecting') ? 'Connecting...' : 'Connect'}
                </button>
            </div>
            <p style={{ marginTop: '10px', color: danmuStatus.startsWith('Connection Failed') ? 'red' : '#666' }}>
                {danmuStatus !== 'Disconnected' ? danmuStatus : ''}
            </p>
        </div>
        <button 
            onClick={() => {
            setLoggedIn(false)
            setUserInfo(null)
            initLogin()
            }}
            style={{
            marginTop: '40px',
            color: '#666',
            background: 'none',
            border: 'none',
            textDecoration: 'underline',
            cursor: 'pointer'
            }}
        >
            Logout
        </button>
      </div>
    </React.Fragment>
  )
}
