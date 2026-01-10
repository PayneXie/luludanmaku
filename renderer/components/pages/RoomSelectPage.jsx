import React, { useState, useEffect, useRef } from 'react'
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
    saveToHistory,
    setShowHistoryDropdown, 
    showHistoryDropdown, 
    deleteHistory, 
    setLoggedIn, 
    setUserInfo, 
    initLogin,
    wrapperRef 
}) => {
    // 最终选定的房间（变为卡片展示）
    const [selectedRoom, setSelectedRoom] = useState(null)
    
    // 搜索预览结果（展示在下拉菜单中）
    const [previewRoom, setPreviewRoom] = useState(null)
    const [isLoadingInfo, setIsLoadingInfo] = useState(false)
    const fetchTimerRef = useRef(null)

    // 自动补全历史记录信息
    useEffect(() => {
        if (!roomHistory || roomHistory.length === 0) return

        // 如果是首次加载且未选中，尝试自动选中最近一个
        if (!selectedRoom && roomId && roomHistory.length > 0) {
            const last = roomHistory[0]
            const lastId = typeof last === 'object' ? String(last.room_id) : String(last)
            
            if (String(roomId) === lastId) {
                // 构造选中对象
                if (typeof last === 'object') {
                    setSelectedRoom(last)
                } else {
                    setSelectedRoom({
                        room_id: last,
                        uname: '加载中...',
                        face: '',
                        title: ''
                    })
                }
            }
        }

        const fetchMissingInfo = async () => {
            let hasUpdates = false
            const updates = []

            for (const item of roomHistory) {
                // 判断是否需要更新：是纯 ID，或者缺少关键信息
                const isLegacy = typeof item !== 'object'
                const isIncomplete = typeof item === 'object' && (!item.face || !item.uname)
                
                if (isLegacy || isIncomplete) {
                    const id = isLegacy ? item : item.room_id
                    try {
                        // 1. Get Room Info
                        const res = await window.ipc.invoke('bilibili-get-room-info', Number(id))
                        if (res.success && res.data) {
                            const roomData = res.data
                            let face = roomData.user_cover
                            let uname = roomData.title
                            
                            // 2. Get User Info
                            if (roomData.uid) {
                                try {
                                    const userRes = await window.ipc.invoke('bilibili-get-user-info-details', { 
                                        cookies: userInfo || {}, 
                                        mid: roomData.uid 
                                    })
                                    if (userRes.success && userRes.data) {
                                        face = userRes.data.face
                                        uname = userRes.data.name
                                    }
                                } catch (e) { console.error(e) }
                            }

                            updates.push({
                                room_id: id,
                                title: roomData.title,
                                uid: roomData.uid,
                                uname: uname,
                                face: face,
                                cover: roomData.user_cover
                            })
                            hasUpdates = true
                        }
                    } catch (e) {
                        console.error('Failed to enrich history for', id, e)
                    }
                }
            }

            if (hasUpdates) {
                updates.forEach(newItem => {
                    saveToHistory(newItem)
                })
            }
        }

        const timer = setTimeout(fetchMissingInfo, 1000)
        return () => clearTimeout(timer)
    }, [roomHistory.length])

    // 当输入 ID 变化时，延迟获取房间信息作为预览
    useEffect(() => {
        if (selectedRoom) return;

        if (!roomId || roomId.length < 3) {
            setPreviewRoom(null)
            setIsLoadingInfo(false)
            return
        }

        setShowHistoryDropdown(true)

        if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
        
        setIsLoadingInfo(true)
        fetchTimerRef.current = setTimeout(async () => {
            try {
                // 1. Get Room Info
                const res = await window.ipc.invoke('bilibili-get-room-info', Number(roomId))
                if (res.success && res.data) {
                    const roomData = res.data
                    
                    let face = roomData.user_cover
                    let uname = roomData.title
                    
                    if (roomData.uid) {
                        try {
                            const userRes = await window.ipc.invoke('bilibili-get-user-info-details', { 
                                cookies: userInfo || {}, 
                                mid: roomData.uid 
                            })
                            if (userRes.success && userRes.data) {
                                face = userRes.data.face
                                uname = userRes.data.name
                            }
                        } catch (e) {
                            console.error('Failed to fetch anchor info', e)
                        }
                    }

                    setPreviewRoom({
                        room_id: roomId,
                        title: roomData.title,
                        uid: roomData.uid,
                        uname: uname,
                        face: face,
                        cover: roomData.user_cover
                    })
                    setShowHistoryDropdown(true)
                } else {
                    setPreviewRoom(null)
                }
            } catch (e) {
                console.error(e)
                setPreviewRoom(null)
            } finally {
                setIsLoadingInfo(false)
            }
        }, 500)

        return () => {
            if (fetchTimerRef.current) clearTimeout(fetchTimerRef.current)
        }
    }, [roomId, selectedRoom, setShowHistoryDropdown])

    const confirmSelection = (room) => {
        setSelectedRoom(room)
        setRoomId(String(room.room_id))
        setShowHistoryDropdown(false)
        setPreviewRoom(null) 
    }

    const clearSelection = (e) => {
        e.stopPropagation()
        setRoomId('')
        setSelectedRoom(null)
        setPreviewRoom(null)
    }

    const handleConnect = () => {
        if (selectedRoom) {
            saveToHistory(selectedRoom)
        } else if (previewRoom && String(previewRoom.room_id) === roomId) {
            saveToHistory(previewRoom)
        }
        connectDanmu()
    }

    const handleHistoryClick = (item) => {
        if (typeof item === 'object') {
            confirmSelection(item)
        } else {
            setRoomId(String(item))
            setSelectedRoom({
                room_id: item,
                uname: '加载中...',
                face: '', 
                title: ''
            })
        }
    }

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
                            {/* 如果有选中的房间，显示卡片；否则显示输入框 */}
                            {selectedRoom ? (
                                <div className={roomSelectStyles.selectedCard} onClick={() => {}}>
                                    <div className={roomSelectStyles.cardInfo}>
                                        <img 
                                            src={selectedRoom.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
                                            alt={selectedRoom.uname} 
                                            className={roomSelectStyles.cardAvatar}
                                            referrerPolicy="no-referrer"
                                        />
                                        <div className={roomSelectStyles.cardText}>
                                            <div className={roomSelectStyles.cardName} title={selectedRoom.uname}>
                                                {selectedRoom.uname}
                                            </div>
                                            <div className={roomSelectStyles.cardId}>
                                                {selectedRoom.room_id}
                                            </div>
                                        </div>
                                    </div>
                                    <div 
                                        className={roomSelectStyles.cardClose} 
                                        onClick={clearSelection}
                                        title="清除"
                                    >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <line x1="18" y1="6" x2="6" y2="18"></line>
                                            <line x1="6" y1="6" x2="18" y2="18"></line>
                                        </svg>
                                    </div>
                                </div>
                            ) : (
                                <input 
                                        type="number" 
                                        className={roomSelectStyles.input}
                                        placeholder="例如: 21013446" 
                                        value={roomId}
                                        onChange={e => setRoomId(e.target.value)}
                                        onKeyDown={e => {
                                            if (e.key === 'Enter') handleConnect()
                                            if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault()
                                        }}
                                        onFocus={() => setShowHistoryDropdown(true)}
                                    />
                            )}
                            
                            {/* 下拉菜单：展示 Loading / 搜索结果 (不再展示历史记录) */}
                            {showHistoryDropdown && !selectedRoom && (isLoadingInfo || previewRoom) && (
                                <div className={roomSelectStyles.dropdown}>
                                    {(isLoadingInfo || previewRoom) && (
                                        <React.Fragment>
                                            <div style={{ padding: '8px 16px', fontSize: '12px', color: '#999', background: '#f9f9f9' }}>
                                                {isLoadingInfo ? '搜索中...' : '搜索结果'}
                                            </div>
                                            
                                            {isLoadingInfo ? (
                                                <div className={roomSelectStyles.dropdownLoading}>
                                                    <div className={roomSelectStyles.loadingSpinner}></div>
                                                    正在获取直播间信息...
                                                </div>
                                            ) : (
                                                <div 
                                                    className={roomSelectStyles.dropdownItem}
                                                    onClick={() => confirmSelection(previewRoom)}
                                                    style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
                                                >
                                                    <img 
                                                        src={previewRoom.face} 
                                                        alt={previewRoom.uname} 
                                                        style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                                                        referrerPolicy="no-referrer"
                                                    />
                                                    <div style={{ flex: 1, overflow: 'hidden' }}>
                                                        <div style={{ fontWeight: 'bold', fontSize: '14px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                            {previewRoom.uname}
                                                        </div>
                                                        <div style={{ fontSize: '12px', color: '#666' }}>
                                                            {previewRoom.room_id}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </React.Fragment>
                                    )}
                                </div>
                            )}
                        </div>
                        <button 
                            className={roomSelectStyles.btnConnect}
                            onClick={handleConnect} 
                            disabled={danmuStatus.startsWith('Connecting') || danmuStatus.startsWith('Fetching')}
                        >
                            {danmuStatus.startsWith('Connecting') || danmuStatus.startsWith('Fetching') ? '连接中...' : '连接'}
                        </button>
                    </div>

                    {/* 历史记录胶囊区域 (连接按钮下方) */}
                    {roomHistory.length > 0 && (
                        <div className={roomSelectStyles.historySection}>
                            <div className={roomSelectStyles.historyLabel}>最近访问</div>
                            <div className={roomSelectStyles.historyList}>
                                {roomHistory.slice(0, 5).map((item, index) => {
                                    const isObject = typeof item === 'object'
                                    const id = isObject ? item.room_id : item
                                    const uname = isObject && item.uname ? item.uname : `直播间 ${id}`
                                    const face = isObject && item.face ? item.face : 'https://i0.hdslb.com/bfs/face/member/noface.jpg'

                                    return (
                                        <div 
                                            key={id} 
                                            className={roomSelectStyles.historyCapsule}
                                            onClick={() => handleHistoryClick(item)}
                                            title={uname}
                                        >
                                            <img 
                                                src={face} 
                                                alt={uname}
                                                className={roomSelectStyles.historyAvatar}
                                                referrerPolicy="no-referrer"
                                                onError={(e) => { e.target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }}
                                            />
                                            <span className={roomSelectStyles.historyName}>{uname}</span>
                                            <div 
                                                className={roomSelectStyles.historyDelete}
                                                onClick={(e) => deleteHistory(e, id)}
                                                title="删除记录"
                                            >
                                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                                </svg>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}

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
