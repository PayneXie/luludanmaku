import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

const UserActionMenu = ({ user, position, onClose, onFilter, onHighlight, isHighlighted }) => {
  const menuRef = useRef(null)

  useEffect(() => {
    const handleClickOutside = (event) => {
      // 如果点击的是菜单内部，或者是触发菜单的按钮（通过 data 属性识别），则不关闭
      if (menuRef.current && !menuRef.current.contains(event.target) && !event.target.closest('[data-user-action-trigger]')) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  if (!user || !position) return null

  // Calculate position to keep menu within viewport
  // This is a simple implementation, can be improved
  const style = {
    position: 'fixed',
    left: position.x,
    top: position.y,
    zIndex: 9999,
  }

  return createPortal(
    <div 
      ref={menuRef}
      style={{
        ...style,
        width: '280px',
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        backdropFilter: 'blur(10px)',
        borderRadius: '8px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
        border: '1px solid rgba(0, 0, 0, 0.05)',
        overflow: 'hidden',
        fontFamily: 'sans-serif',
        animation: 'fadeIn 0.1s ease-out'
      }}
    >
      {/* Header: User Info */}
      <div style={{ 
          padding: '16px', 
          display: 'flex', 
          alignItems: 'center', 
          borderBottom: '1px solid rgba(0,0,0,0.05)',
          background: 'linear-gradient(to bottom, rgba(255,255,255,0.5), rgba(255,255,255,0.8))'
      }}>
        <img 
          src={user.face || 'https://i0.hdslb.com/bfs/face/member/noface.jpg'} 
          alt={user.uname}
          style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid white', marginRight: '12px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
        />
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#333', marginBottom: '4px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {user.uname}
          </div>
          <div style={{ fontSize: '12px', color: '#ff8e29' }}>
            UID: {user.uid}
          </div>
        </div>
      </div>

      {/* Action List */}
      <div style={{ padding: '8px 0' }}>
        <MenuButton 
            icon="🔍" 
            label="筛选此人" 
            onClick={() => {
                if (onFilter) onFilter(user)
                onClose()
            }} 
        />
        <MenuButton 
            icon={isHighlighted ? "🌟" : "⭐"} 
            label={isHighlighted ? "取消关注" : "重点关注"} 
            onClick={() => {
                if (onHighlight) onHighlight(user)
                onClose()
            }}
            style={isHighlighted ? { color: '#ff8e29', fontWeight: 'bold', backgroundColor: 'rgba(255, 142, 41, 0.1)' } : {}}
        />
        
        <div style={{ height: '1px', backgroundColor: 'rgba(0,0,0,0.05)', margin: '8px 16px' }}></div>
        <div style={{ padding: '0 16px 8px 16px', fontSize: '12px', color: '#999' }}>外部功能</div>
        
        <MenuButton 
            icon="🔗" 
            label="哔哩哔哩空间..." 
            onClick={() => {
                const url = `https://space.bilibili.com/${user.uid}`
                if (window.ipc) {
                    window.ipc.send('open-external', url)
                } else {
                    window.open(url, '_blank')
                }
            }} 
        />
      </div>
    </div>,
    document.body
  )
}

const MenuButton = ({ icon, label, onClick, style }) => {
  const [hover, setHover] = React.useState(false)
  
  return (
    <div 
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        cursor: 'pointer',
        backgroundColor: hover ? 'rgba(0, 0, 0, 0.05)' : 'transparent',
        transition: 'background-color 0.1s',
        fontSize: '14px',
        color: '#333',
        ...style
      }}
    >
      <span style={{ marginRight: '12px', fontSize: '16px', width: '20px', textAlign: 'center' }}>{icon}</span>
      <span>{label}</span>
    </div>
  )
}

export default UserActionMenu
