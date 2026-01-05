import React, { useState, useRef, useEffect } from 'react'

export default function DebugPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('danmu')
  const [position, setPosition] = useState({ x: window.innerWidth - 320, y: window.innerHeight - 400 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0 })
  const panelRef = useRef(null)

  const [formData, setFormData] = useState({
    uname: 'DebugUser',
    content: 'Test Content',
    price: 30,
    giftName: '辣条',
    num: 1,
    guardLevel: 3 // 1:总督, 2:提督, 3:舰长
  })

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
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
        {['danmu', 'sc', 'gift', 'guard'].map(tab => (
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
              color: activeTab === tab ? '#228be6' : '#666'
            }}
          >
            {tab === 'danmu' ? '弹幕' : tab === 'sc' ? 'SC' : tab === 'gift' ? '礼物' : '上舰'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Common: Username */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>用户名</label>
            <input 
                name="uname" 
                value={formData.uname} 
                onChange={handleChange}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
        </div>

        {activeTab === 'danmu' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>内容</label>
                <textarea 
                    name="content" 
                    value={formData.content} 
                    onChange={handleChange}
                    style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd', minHeight: '60px' }}
                />
            </div>
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
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>礼物名称</label>
                    <input 
                        name="giftName" 
                        value={formData.giftName} 
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
