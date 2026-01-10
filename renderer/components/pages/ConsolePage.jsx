import React from 'react'
import Head from 'next/head'
import { createPortal } from 'react-dom'
import TitleBar from '../common/TitleBar'
import CopyButton from '../common/CopyButton'
import { DanmuItem, ScItem, GiftItem } from '@/components/DanmuListItems'
import DebugPanel from '@/components/DebugPanel'
import UserActionMenu from '@/components/UserActionMenu'
import Linkify from '@/components/Linkify'
import LiveTimer from '@/components/LiveTimer'
import FlipCounter from '@/components/FlipCounter'
import styles from '@/styles/console.module.css'



// Helper to check if item should be shown
const ConsolePage = ({
    roomId,
    roomInfo,
    userInfo,
    isAdmin,
    onlineCount,
    onlineTrend,
    danmuStatus,
    danmuList,
    scList,
    giftList,
    stats,
    colWidths,
    // Actions & Handlers
    toggleBorderlessMode,
    isBorderless,
    toggleAlwaysOnTop,
    isAlwaysOnTop,
    setShowConsole,
    handleCloudSync,
    disconnectDanmu,
    openToolsWindow,
    // Settings State
    uiScale,
    fontSize,
    maxDanmuLimit,
    saveSettings,
    showSettings,
    setShowSettings,
    enableCloudSync,
    setEnableCloudSync,
    // Debug State
    showDebug,
    setShowDebug,
    // Filter State
    showDanmuFilter,
    setShowDanmuFilter,
    danmuFilter,
    setDanmuFilter,
    shouldShowItem,
    // Gift Settings
    minGiftPrice,
    setMinGiftPrice,
    showGiftSettings,
    setShowGiftSettings,
    giftMap,
    // SC Settings
    showScSettings,
    setShowScSettings,
    handleMarkAllRead,
    handleMarkAllUnread,
    // Interaction
    highlightedUsers,
    readMessages,
    handleUserClick,
    handleToggleRead,
    // OBS Help
    showObsHelp,
    setShowObsHelp,
    // Refs
    containerRef,
    settingsBtnRef,
    settingsPanelRef,
    danmuListRef,
    danmuFilterRef,
    scSettingsRef,
    giftSettingsRef,
    obsHelpBtnRef,
    obsHelpPanelRef,
    startResize,
    // Selected User Menu
    selectedUser,
    setSelectedUser,
    handleFilterUser,
    handleHighlightUser,
    handleMuteUser,
    // Relogin Modal
    showReloginModal,
    cancelRelogin,
    reloginQr,
    reloginStatus
}) => {

    // Render Borderless Mode
    if (isBorderless) {
        return (
            <React.Fragment>
              <Head>
                <title>Danmaku Overlay - {roomId}</title>
              </Head>
              <style global jsx>{`
                body {
                  margin: 0;
                  padding: 0;
                  overflow: hidden;
                  font-family: "Microsoft YaHei", sans-serif;
                  background-color: transparent;
                }
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                .spinner {
                    animation: spin 1s linear infinite;
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
                  {/* 断线重连遮罩 */}
                  {!danmuStatus.startsWith('Connected') && (
                      <div style={{
                          position: 'absolute',
                          top: 0, left: 0, right: 0, bottom: 0,
                          backgroundColor: 'rgba(0, 0, 0, 0.6)',
                          color: '#fff',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          zIndex: 2000,
                          fontSize: '14px',
                          pointerEvents: 'auto' // 允许点击按钮
                      }}>
                          <div style={{ marginBottom: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                              <svg className="spinner" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px', color: '#fff' }}>
                                  <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                              </svg>
                              <div>{danmuStatus === 'Disconnected' ? '已断开连接' : danmuStatus}</div>
                          </div>
                          <button 
                              onClick={() => setShowConsole(false)}
                              style={{
                                  padding: '4px 8px',
                                  fontSize: '12px',
                                  background: 'rgba(255,255,255,0.2)',
                                  border: '1px solid rgba(255,255,255,0.5)',
                                  color: '#fff',
                                  borderRadius: '4px',
                                  cursor: 'pointer'
                              }}
                          >
                              返回房间选择
                          </button>
                      </div>
                  )}

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
                              return (
                                  <DanmuItem 
                                    key={item.id}
                                    item={item}
                                    highlightedUsers={highlightedUsers}
                                    readMessages={readMessages}
                                    onUserClick={handleUserClick}
                                    onToggleRead={handleToggleRead}
                                    style={{ color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.8)' }}
                                    variant="overlay"
                                  />
                              )
                          }
                          
                          // 渲染 SuperChat
                          if (item.type === 'superchat') {
                              return (
                                <ScItem 
                                    key={item.id}
                                    item={item}
                                    readMessages={readMessages}
                                    onUserClick={handleUserClick}
                                    onToggleRead={handleToggleRead}
                                />
                              )
                          }
                          
                          // 渲染 Gift
                          if (item.type === 'gift') {
                              return (
                                  <GiftItem 
                                      key={item.id}
                                      item={item} 
                                      readMessages={readMessages}
                                      onUserClick={handleUserClick}
                                      onToggleRead={handleToggleRead}
                                      giftMap={giftMap}
                                      minGiftPrice={minGiftPrice}
                                  />
                              )
                          }
                          
                          return null
                      })}
                  </div>
              </div>
            </React.Fragment>
        )
    }

    // Render Normal Console
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
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
            .spinner {
                animation: spin 1s linear infinite;
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
              
              {/* 断线重连遮罩 (主界面) */}
              {!danmuStatus.startsWith('Connected') && (
                  <div style={{
                      position: 'absolute',
                      top: '32px', // Below TitleBar
                      left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(255, 255, 255, 0.8)', // 白色半透明
                      backdropFilter: 'blur(2px)',
                      color: '#333',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      zIndex: 2000,
                      fontSize: '14px'
                  }}>
                      <div style={{ marginBottom: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                          <svg className="spinner" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#00a1d6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: '12px' }}>
                              <path d="M21 12a9 9 0 1 1-6.219-8.56"></path>
                          </svg>
                          <div style={{ fontWeight: 'bold', fontSize: '15px' }}>
                              {danmuStatus === 'Disconnected' ? '已断开连接' : danmuStatus}
                          </div>
                      </div>
                      
                      <button 
                          onClick={() => setShowConsole(false)}
                          style={{
                              padding: '6px 16px',
                              fontSize: '13px',
                              background: '#fff',
                              border: '1px solid #d9d9d9',
                              color: '#666',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              boxShadow: '0 2px 0 rgba(0,0,0,0.02)',
                              transition: 'all 0.3s'
                          }}
                          onMouseEnter={e => { e.target.style.color = '#40a9ff'; e.target.style.borderColor = '#40a9ff'; }}
                          onMouseLeave={e => { e.target.style.color = '#666'; e.target.style.borderColor = '#d9d9d9'; }}
                      >
                          返回房间选择
                      </button>
                  </div>
              )}

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

                                  <div style={{ marginTop: 16 }}>
                                      <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', fontWeight: 'bold', fontSize: '14px' }}>
                                          <input 
                                              type="checkbox" 
                                              checked={enableCloudSync}
                                              onChange={(e) => setEnableCloudSync(e.target.checked)}
                                              style={{ marginRight: '8px' }}
                                          />
                                          开启云同步 (礼物/SC补漏)
                                      </label>
                                      <div style={{ fontSize: '12px', color: '#666', marginTop: '4px', marginLeft: '20px' }}>
                                          开启后将定期从服务器同步遗漏的礼物和SC。默认关闭。
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
              {showDebug && <DebugPanel onClose={() => setShowDebug(false)} onManualSync={handleCloudSync} />}

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
                        style={{ 
                            flex: 1, 
                            overflowY: 'auto',
                            // 禁用浏览器默认的锚定，完全由 JS 接管控制
                            overflowAnchor: 'none'
                        }}
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
                              return (
                                <ScItem 
                                    key={item.id}
                                    item={item}
                                    readMessages={readMessages}
                                    onUserClick={handleUserClick}
                                    onToggleRead={handleToggleRead}
                                />
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
                          {giftList.filter(item => item.type === 'gift' && shouldShowItem(item)).map(item => (
                              <GiftItem 
                                  key={item.id}
                                  item={item} 
                                  readMessages={readMessages}
                                  onUserClick={handleUserClick}
                                  onToggleRead={handleToggleRead}
                                  giftMap={giftMap}
                                  minGiftPrice={minGiftPrice}
                              />
                          ))}
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

              {/* 重新登录遮罩 (Portal) */}
              {showReloginModal && createPortal(
                  <div style={{
                      position: 'fixed',
                      top: 0, left: 0, right: 0, bottom: 0,
                      backgroundColor: 'rgba(0, 0, 0, 0.7)',
                      zIndex: 9999,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backdropFilter: 'blur(4px)'
                  }}>
                      <div style={{
                          background: '#fff',
                          borderRadius: '12px',
                          padding: '24px',
                          width: '320px',
                          boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          position: 'relative'
                      }}>
                          <button 
                              onClick={cancelRelogin}
                              style={{
                                  position: 'absolute',
                                  top: '12px',
                                  right: '12px',
                                  border: 'none',
                                  background: 'none',
                                  fontSize: '20px',
                                  color: '#999',
                                  cursor: 'pointer'
                              }}
                          >×</button>
                          
                          <h3 style={{ margin: '0 0 16px 0', color: '#333' }}>登录已过期</h3>
                          <p style={{ margin: '0 0 20px 0', color: '#666', fontSize: '14px', textAlign: 'center' }}>
                              您的登录凭证已失效，请重新扫码登录以恢复头像显示和弹幕发送功能。
                          </p>
                          
                          <div style={{
                              width: '180px',
                              height: '180px',
                              background: '#f5f5f5',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              borderRadius: '8px',
                              overflow: 'hidden',
                              marginBottom: '16px'
                          }}>
                              {reloginQr ? (
                                  <img src={reloginQr} alt="Login QR Code" style={{ width: '100%', height: '100%' }} />
                              ) : (
                                  <div style={{ color: '#999', fontSize: '12px' }}>正在加载二维码...</div>
                              )}
                          </div>
                          
                          <div style={{ fontSize: '14px', color: '#00a1d6', fontWeight: 'bold' }}>
                              {reloginStatus}
                          </div>
                      </div>
                  </div>,
                  document.body
              )}
          </div>
        </React.Fragment>
    )
}

export default ConsolePage
