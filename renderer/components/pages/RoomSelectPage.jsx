import React from 'react'
import Head from 'next/head'
import TitleBar from '../common/TitleBar'
import roomSelectStyles from '@/styles/room-select.module.css'

const RoomSelectPage = ({ 
    userInfo, 
    roomId, 
    setRoomId, 
    connectDanmu, 
    danmuStatus, 
    roomHistory, 
    setShowHistoryDropdown, 
    showHistoryDropdown, 
    deleteHistory, 
    setLoggedIn, 
    setUserInfo, 
    initLogin,
    wrapperRef 
}) => {
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

export default RoomSelectPage
