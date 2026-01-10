import React from 'react'
import styles from '@/styles/console.module.css'

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

export default TitleBar
