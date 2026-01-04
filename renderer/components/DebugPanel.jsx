import React, { useState } from 'react'

export default function DebugPanel({ onClose }) {
  const [activeTab, setActiveTab] = useState('danmu')
  const [formData, setFormData] = useState({
    uname: 'DebugUser',
    content: 'Test Content',
    price: 30,
    giftName: '辣条',
    num: 1
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

  return (
    <div style={{
      position: 'fixed',
      bottom: '20px',
      right: '20px',
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
      color: '#333'
    }}>
      {/* Header */}
      <div style={{
        padding: '10px',
        borderBottom: '1px solid #eee',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: '#f8f9fa',
        borderTopLeftRadius: '8px',
        borderTopRightRadius: '8px'
      }}>
        <strong style={{ margin: 0 }}>Debug Console</strong>
        <button onClick={onClose} style={{ border: 'none', background: 'none', cursor: 'pointer', fontSize: '16px' }}>×</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid #eee' }}>
        {['danmu', 'sc', 'gift'].map(tab => (
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
            {tab === 'danmu' ? 'Danmu' : tab === 'sc' ? 'SC' : 'Gift'}
          </button>
        ))}
      </div>

      {/* Body */}
      <div style={{ padding: '15px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        
        {/* Common: Username */}
        <div style={{ display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>Username</label>
            <input 
                name="uname" 
                value={formData.uname} 
                onChange={handleChange}
                style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
            />
        </div>

        {activeTab === 'danmu' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
                <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>Content</label>
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
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>Price (￥)</label>
                    <input 
                        type="number"
                        name="price" 
                        value={formData.price} 
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>Content</label>
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
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>Gift Name</label>
                    <input 
                        name="giftName" 
                        value={formData.giftName} 
                        onChange={handleChange}
                        style={{ padding: '6px', borderRadius: '4px', border: '1px solid #ddd' }}
                    />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '12px', marginBottom: '4px', color: '#666' }}>Count</label>
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
            Send {activeTab.toUpperCase()}
        </button>

      </div>
    </div>
  )
}
