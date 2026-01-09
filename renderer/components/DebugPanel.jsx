import React, { useState, useRef, useEffect } from 'react'

export default function DebugPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('danmu')
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: window.innerHeight - 400 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const panelRef = useRef(null)

  const [formData, setFormData] = useState({
    uname: 'DebugUser',
    uid: '12345',
    content: 'Test Content',
    price: 30,
    giftName: '辣条',
    giftPrice: 100, // 金瓜子
    num: 1,
    guardLevel: 3 // 1:总督, 2:提督, 3:舰长
  })

  const GIFT_OPTIONS = [
    { name: '辣条', price: 100, label: '辣条 (0.1元)' },
    { name: '小心心', price: 0, label: '小心心 (免费)' },
    { name: '牛哇牛哇', price: 1000, label: '牛哇牛哇 (1元)' },
    { name: '打call', price: 5000, label: '打call (5元)' },
    { name: 'B坷垃', price: 9900, label: 'B坷垃 (9.9元)' },
    { name: '告白气球', price: 52000, label: '告白气球 (52元)' },
    { name: '火箭', price: 100000, label: '火箭 (100元)' },
    { name: '摩天大楼', price: 450000, label: '摩天大楼 (450元)' },
    { name: '小电视飞船', price: 1245000, label: '小电视飞船 (1245元)' }
  ]

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleGiftChange = (e) => {
    const selected = GIFT_OPTIONS.find(g => g.name === e.target.value)
    if (selected) {
        setFormData({ 
            ...formData, 
            giftName: selected.name, 
            giftPrice: selected.price 
        })
    } else {
        setFormData({ ...formData, giftName: e.target.value })
    }
  }

  const handleSend = () => {
    window.ipc.send('bilibili-debug-send', {
        type: activeTab,
        data: formData
    })
  }

  const handleMouseDown = (e) => {
    if (e.target.tagName === 'BUTTON' || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
  }

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      setPosition({
        x: e.clientX - dragStartRef.current.x,
        y: e.clientY - dragStartRef.current.y
      })
    }

    const handleMouseUp = () => {
      setIsDragging(false)
    }

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  return (
    <div 
      ref={panelRef}
      style={{
        position: 'fixed',
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '300px',
        backgroundColor: 'white',
        border: '1px solid #ccc',
        borderRadius: '8px',
        boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'sans-serif',
        fontSize: '14px',
        color: '#333',
        userSelect: 'none'
      }}
    >
      {/* Header */}
      <div 
        onMouseDown={handleMouseDown}
        style={{
          padding: '10px',
          borderBottom: '1px solid #eee',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: '#f8f9fa',
          borderTopLeftRadius: '8px',
          borderTopRightRadius: '8px',
          cursor: isDragging ? 'grabbing' : 'grab'
        }}
      >
        <strong style={{ margin: 0 }}>Debug Console</strong>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        {['danmu', 'sc', 'gift', 'guard', 'stress'].map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              background: activeTab === tab ? 'white' : '#f1f3f5',
              cursor: 'pointer',
              fontWeight: activeTab === tab ? 'bold' : 'normal',
              color: activeTab === tab ? '#228be6' : '#666',
              fontSize: tab === 'stress' ? '12px' : '14px'
            }}
          >
            {tab === 'danmu' ? '弹幕' : tab === 'sc' ? 'SC' : tab === 'gift' ? '礼物' : tab === 'guard' ? '上舰' : '压测'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Common: Username & UID (Hide for stress test) */}
        {activeTab !== 'stress' && (
        <div style={{ display: 'flex', gap: '10px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 2, minWidth: 0 }}>
                <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>用户名</label>
                <input 
                    name="uname" 
                    value={formData.uname} 
                    onChange={handleChange}
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0 }}>
                <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>UID</label>
                <input 
                    name="uid" 
                    value={formData.uid} 
                    onChange={handleChange}
                    style={{ width: '100%', padding: '6px', borderRadius: '4px', border: '1px solid #ddd', boxSizing: 'border-box' }}
                />
            </div>
        </div>
        )}

        {activeTab === 'stress' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>
                    警告: 压力测试可能导致软件卡顿或闪退，请谨慎使用。
                </div>
                
                <button 
                    onClick={() => window.ipc.send('bilibili-debug-stress', { action: 'start-flood' })}
                    style={{ padding: '8px', backgroundColor: '#e03131', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    开始弹幕洪流 (1000条/秒)
                </button>
                
                <button 
                    onClick={() => window.ipc.send('bilibili-debug-stress', { action: 'stop-flood' })}
                    style={{ padding: '8px', backgroundColor: '#868e96', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    停止弹幕洪流
                </button>
                
                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }}></div>
                
                <button 
                    onClick={() => window.ipc.send('bilibili-debug-stress', { action: 'flood-face' })}
                    style={{ padding: '8px', backgroundColor: '#fd7e14', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    泛洪头像缓存 (1000请求)
                </button>
                
                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }}></div>
                
                <button 
                    onClick={() => window.ipc.send('bilibili-debug-stress', { action: 'crash-main-sync' })}
                    style={{ padding: '8px', backgroundColor: '#000', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    模拟主进程崩溃 (Uncaught)
                </button>

                <button 
                    onClick={() => window.ipc.send('bilibili-debug-stress', { action: 'crash-main-async' })}
                    style={{ padding: '8px', backgroundColor: '#343a40', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    模拟主进程 Rejection
                </button>

                <button 
                    onClick={() => window.ipc.send('bilibili-debug-stress', { action: 'crash-renderer' })}
                    style={{ padding: '8px', backgroundColor: '#c92a2a', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    模拟渲染进程崩溃 (Renderer Crash)
                </button>

                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }}></div>

                <button 
                    onClick={() => window.ipc.send('bilibili-debug-stress', { action: 'crash-socket-hangup' })}
                    style={{ padding: '8px', backgroundColor: '#862e9c', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    验证 Socket Hang Up (修复后应弹窗)
                </button>

                <div style={{ height: '1px', background: '#eee', margin: '4px 0' }}></div>

                <button 
                    onClick={() => window.ipc.send('bilibili-debug-stress', { action: 'simulate-ws-close' })}
                    style={{ padding: '8px', backgroundColor: '#e67700', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                >
                    模拟 WebSocket 断线
                </button>
            </div>
        )}

        {activeTab === 'danmu' && (
            <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>发送者身份</label>
                    <select
                        name="senderGuardLevel"
                        value={formData.senderGuardLevel}
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '8px' }}
                    >
                        <option value={0}>普通用户</option>
                        <option value={3}>舰长</option>
                        <option value={2}>提督</option>
                        <option value={1}>总督</option>
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>内容</label>
                    <textarea 
                        name="content" 
                        value={formData.content} 
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }}
                    />
                </div>
            </>
        )}

        {activeTab === 'sc' && (
            <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>价格 (￥)</label>
                    <input 
                        type="number"
                        name="price" 
                        value={formData.price} 
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>内容</label>
                    <textarea 
                        name="content" 
                        value={formData.content} 
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }}
                    />
                </div>
            </>
        )}

        {activeTab === 'gift' && (
            <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>礼物选择</label>
                    <select
                        name="giftName"
                        value={formData.giftName}
                        onChange={handleGiftChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', marginBottom: '8px' }}
                    >
                        {GIFT_OPTIONS.map(g => (
                            <option key={g.name} value={g.name}>{g.label}</option>
                        ))}
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>单价 (金瓜子, 1000=1元)</label>
                    <input 
                        type="number"
                        name="giftPrice" 
                        value={formData.giftPrice} 
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>数量</label>
                    <input 
                        type="number"
                        name="num" 
                        value={formData.num} 
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
            </>
        )}

        {activeTab === 'guard' && (
            <>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>等级</label>
                    <select
                        name="guardLevel"
                        value={formData.guardLevel}
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    >
                        <option value={3}>舰长 (198元)</option>
                        <option value={2}>提督 (1998元)</option>
                        <option value={1}>总督 (19998元)</option>
                    </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>数量 (月)</label>
                    <input 
                        type="number"
                        name="num" 
                        value={formData.num} 
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
            </>
        )}

        <button 
            onClick={handleSend}
            style={{ 
                marginTop: '10px', 
                padding: '8px', 
                backgroundColor: '#228be6', 
                color: 'white', 
                border: 'none', 
                borderRadius: '4px', 
                cursor: 'pointer',
                fontWeight: 'bold'
            }}
        >
            发送 {activeTab === 'danmu' ? '弹幕' : activeTab === 'sc' ? 'SC' : activeTab === 'gift' ? '礼物' : '上舰'}
        </button>

      </div>
    </div>
  )
}
