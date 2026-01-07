import React from 'react'
import styles from '@/styles/console.module.css'
import Linkify from '@/components/Linkify'
import level1 from '../public/images/level1.png'
import level2 from '../public/images/level2.png'
import level3 from '../public/images/level3.png'
import { useUserFace } from '../hooks/useUserFace'

// 安全获取图标 URL 的辅助函数
const getGuardIcon = (level) => {
    if (level === 1) return level1.src || level1
    if (level === 2) return level2.src || level2
    if (level === 3) return level3.src || level3
    return ''
}

// 使用 Bilibili 标准等级颜色作为勋章颜色
const getMedalColor = (level) => {
    if (level >= 1 && level <= 20) return '#61c05a' // 绿色 (1-20)
    if (level >= 21 && level <= 40) return '#5896de' // 蓝色 (21-40)
    if (level >= 41 && level <= 60) return '#a068f1' // 紫色 (41-60)
    if (level >= 61) return '#f08c00' // 金色 (>60)
    return '#61c05a' // 默认
}

// 提取的 Memoized 弹幕组件
export const DanmuItem = React.memo(({ item, highlightedUsers, readMessages, onUserClick, onToggleRead }) => {
    // 即使是普通弹幕，我们也尝试用 hook 优化头像（虽然普通弹幕目前没有头像显示，但如果未来加了头像可以用）
    // 目前 DanmuItem 只有文字，没有头像，所以这里暂时不用 hook。
    // 如果你想给普通弹幕也加头像，可以在这里用。
    
    if (item.type === 'msg') {
        const msg = item.data
        const guardLevel = msg.sender.medal_info ? msg.sender.medal_info.guard_level : 0
        const isGuard = guardLevel > 0
        
        const isHighlighted = highlightedUsers.has(String(msg.sender.uid))
        
        let bgColor = 'transparent'
        if (guardLevel === 3) bgColor = 'rgba(0, 176, 255, 0.15)'   // 舰长 (Light Blue)
        if (guardLevel === 2) bgColor = 'rgba(224, 64, 251, 0.2)'   // 提督 (Purple)
        if (guardLevel === 1) bgColor = 'rgba(255, 215, 0, 0.25)'   // 总督 (Gold)
        
        if (isHighlighted) {
            bgColor = 'rgba(255, 50, 50, 0.2)' // Red for highlighted
        }

        // 用户名颜色区分
        let unameColor = '#333' // 普通用户黑色
        if (guardLevel === 3) unameColor = '#00a1d6' // 舰长 (蓝色)
        if (guardLevel === 2) unameColor = '#E040FB' // 提督 (紫色)
        if (guardLevel === 1) unameColor = '#FF3232' // 总督 (红色)
        
        const isRead = readMessages.has(item.id)
        const readStyle = isRead ? { filter: 'grayscale(100%)', opacity: 0.6 } : {}

        return (
          <div 
              className={styles['danmu-item']}
              style={{ backgroundColor: bgColor, display: 'flex', flexWrap: 'wrap', alignItems: 'center', ...readStyle }}
          >
              {/* 头部容器 (勋章+舰长图标+用户名) 整体不换行 */}
              <div style={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap', marginRight: '4px' }}>
                  {/* 勋章 */}
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
                  
                  {/* 舰长图标 */}
                  {isGuard && (
                      <img 
                          src={getGuardIcon(msg.sender.medal_info.guard_level)}
                          className={styles['guard-icon']}
                          alt="guard"
                      />
                  )}
                  
                  {/* 发送者 */}
                  <span 
                      className={`${styles['uname']} ${isGuard ? styles['uname-guard'] : styles['uname-normal']}`}
                      onClick={(e) => onUserClick(e, msg.sender)}
                      style={{ cursor: 'pointer', color: unameColor, fontWeight: 'bold' }}
                      data-user-action-trigger="true"
                  >
                      {msg.sender.uname}:
                  </span>
              </div>
              
              {/* 内容 (允许换行) */}
              <span style={{ wordBreak: 'break-word', lineHeight: '1.5' }}>
                  {msg.emoji_content ? (
                      <img 
                          src={msg.emoji_content.url}
                          alt="emoji"
                          style={{
                              height: 'calc((var(--danmu-size) + 32px) * 0.5)',
                              width: 'auto',
                              verticalAlign: 'middle',
                              display: 'inline-block'
                          }}
                      />
                  ) : (
                      <Linkify>{msg.content}</Linkify>
                  )}
              </span>
          </div>
        )
    } else if (item.type === 'system') {
        return (
            <div className={styles['danmu-system']}>
                {item.data}
            </div>
        )
    }
    return null
}, (prev, next) => {
    // 自定义比较函数（如果需要），通常 React.memo 的浅比较足够
    // 但这里 props 包含复杂对象，且父组件可能会生成新的 Set
    // 所以我们需要确保只在真正变化时更新
    // 关键：item 是 immutable 的（id 不变内容不变）。highlightedUsers 和 readMessages 是 Set。
    // 如果 item.id 在 prev.readMessages 和 next.readMessages 中的状态一样，且 user.uid 在 highlightedUsers 中的状态一样，就不需要渲染。
    
    // 简单起见，如果 highlightedUsers 或 readMessages 引用变了，可能需要重新检查。
    // 为了极致性能，我们可以手动比较：
    
    if (prev.item !== next.item) return false // 不同的弹幕对象
    if (prev.onUserClick !== next.onUserClick) return false
    
    // 检查高亮状态是否改变
    if (prev.item.type === 'msg') {
        const uid = String(prev.item.data.sender.uid)
        const prevHigh = prev.highlightedUsers.has(uid)
        const nextHigh = next.highlightedUsers.has(uid)
        if (prevHigh !== nextHigh) return false
    }

    // 检查已读状态是否改变
    const prevRead = prev.readMessages.has(prev.item.id)
    const nextRead = next.readMessages.has(next.item.id)
    if (prevRead !== nextRead) return false
    
    return true
})

// Memoized SC 组件
export const ScItem = React.memo(({ item, readMessages, onUserClick, onToggleRead }) => {
    const msg = item.data
    const currentFace = useUserFace(msg.sender.face, msg.sender.uid)
    
    const levelColor = msg.price >= 2000 ? 'var(--sc-level-5)' :
                       msg.price >= 1000 ? 'var(--sc-level-4)' :
                       msg.price >= 500  ? 'var(--sc-level-3)' :
                       msg.price >= 100  ? 'var(--sc-level-2)' :
                       msg.price >= 50   ? 'var(--sc-level-1)' :
                                           'var(--sc-level-0)'
    
    const isRead = readMessages.has(item.id)
    const readStyle = isRead ? { filter: 'grayscale(100%)', opacity: 0.6 } : {}

    return (
      <div 
          className={styles['sc-card']} 
          style={{ borderColor: levelColor, ...readStyle }}
          onDoubleClick={() => onToggleRead(item.id)}
      >
          <div 
              className={styles['sc-header']} 
              style={{ backgroundColor: levelColor }}
          >
              <img 
                  src={currentFace} 
                  alt="face" 
                  style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '6px', verticalAlign: 'middle', cursor: 'pointer' }} 
                  onClick={(e) => onUserClick(e, msg.sender)}
                  data-user-action-trigger="true"
                  onError={(e) => { e.target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }}
              />
              
              {msg.sender.medal_info && msg.sender.medal_info.is_lighted === 1 && (
                  <span 
                    className={styles['medal-badge']}
                    style={{
                      borderColor: getMedalColor(msg.sender.medal_info.medal_level),
                      backgroundColor: getMedalColor(msg.sender.medal_info.medal_level),
                      backgroundImage: 'none',
                      marginRight: '6px',
                      transform: 'none',
                      lineHeight: '14px',
                      display: 'flex',
                      alignItems: 'center',
                      height: '16px'
                    }}
                  >
                      {msg.sender.medal_info.medal_name}|{msg.sender.medal_info.medal_level}
                  </span>
              )}

              <span 
                  style={{fontWeight:'bold', cursor: 'pointer'}}
                  onClick={(e) => onUserClick(e, msg.sender)}
                  data-user-action-trigger="true"
              >
                  {msg.sender.uname}
              </span>
              <span style={{marginLeft: 'auto'}}>￥{msg.price}</span>
          </div>
          <div className={styles['sc-body']}>
              <Linkify>{msg.message}</Linkify>
          </div>
      </div>
    )
}, (prev, next) => {
    if (prev.item !== next.item) return false
    if (prev.readMessages.has(prev.item.id) !== next.readMessages.has(next.item.id)) return false
    return true
})

// Memoized Gift 组件
export const GiftItem = React.memo(({ item, readMessages, onUserClick, onToggleRead, giftMap, minGiftPrice }) => {
    const msg = item.data
    const isRead = readMessages.has(item.id)
    const readStyle = isRead ? { filter: 'grayscale(100%)', opacity: 0.6 } : {}
    
    // 使用 hook 获取最新头像
    const currentFace = useUserFace(msg.sender.face, msg.sender.uid)
    
    // Guard
    if (msg.guard_level) { // GuardMessage or similar structure
        const guardName = msg.guard_level === 1 ? '总督' : msg.guard_level === 2 ? '提督' : '舰长'
        const priceRMB = msg.price / 1000 
        
        if (priceRMB <= minGiftPrice) return null
        
        const cardBg = msg.guard_level === 1 ? '#d32f2f' :
                       msg.guard_level === 2 ? '#7b1fa2' :
                                               '#1976d2'

        return (
            <div 
              className={styles['gift-card-anim']}
              style={{ 
                  backgroundColor: cardBg,
                  color: '#fff',
                  borderRadius: '8px',
                  padding: '10px 12px',
                  marginBottom: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
                  fontWeight: 'bold',
                  border: 'none',
                  ...readStyle
              }}
              onDoubleClick={() => onToggleRead(item.id)}
            >
                <div 
                  style={{ position: 'relative', marginRight: '12px', cursor: 'pointer' }}
                  onClick={(e) => onUserClick(e, msg.sender)}
                  data-user-action-trigger="true"
                >
                    <img 
                        src={currentFace} 
                        alt="face" 
                        referrerPolicy="no-referrer"
                        onError={(e) => { e.target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }}
                        style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} 
                    />
                    <img 
                        src={getGuardIcon(msg.guard_level)}
                        style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '18px', height: '18px' }}
                        alt="icon"
                    />
                </div>
                
                <div style={{ flex: 1 }}>
                <div 
                    style={{ fontSize: '15px', lineHeight: '1.2', cursor: 'pointer' }}
                    onClick={(e) => onUserClick(e, msg.sender)}
                    data-user-action-trigger="true"
                >
                    {msg.sender.uname}
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                    开通了 {guardName} x{msg.num}{msg.unit}
                </div>
            </div>
                
                <div style={{ fontSize: '16px', marginLeft: '8px' }}>
                    ￥{priceRMB}
                </div>
            </div>
        )
    }

    const config = giftMap[msg.gift_info.id]
    
    // 计算价值
    let valueRMB = 0
    let valueText = ''
    const price = config ? config.price : msg.gift_info.price
    const coinType = config ? config.coin_type : (msg.gift_info.price > 0 ? 'gold' : 'silver')
    
    if (price > 0) {
        const total = price * msg.num
        if (coinType === 'gold') {
            valueRMB = total / 1000
            valueText = `￥${valueRMB >= 1 ? valueRMB.toFixed(1) : valueRMB}` 
        }
    }

    if (valueRMB <= minGiftPrice) return null
    
    const giftImg = config ? config.img : (msg.gift_info.webp || msg.gift_info.img_basic)

    // Small Gift
    if (valueRMB <= 29) {
        return (
             <div 
               className={styles['danmu-item']} 
               style={{ display: 'flex', alignItems: 'center', padding: '4px 8px', flexWrap: 'wrap', gap: '4px', backgroundColor: 'rgba(0,0,0,0.3)', color: '#fff', ...readStyle }}
               onDoubleClick={() => onToggleRead(item.id)}
             >
                 <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                     <img 
                         src={currentFace} 
                         alt="face" 
                         style={{ width: '24px', height: '24px', borderRadius: '50%', marginRight: '8px', cursor: 'pointer' }} 
                         onClick={(e) => onUserClick(e, msg.sender)}
                         data-user-action-trigger="true"
                         onError={(e) => { e.target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }}
                     />
                     
                     {msg.sender.medal_info && msg.sender.medal_info.is_lighted === 1 && (
                         <span 
                           className={styles['medal-badge']}
                           style={{
                             borderColor: getMedalColor(msg.sender.medal_info.medal_level),
                             backgroundColor: getMedalColor(msg.sender.medal_info.medal_level),
                             backgroundImage: 'none',
                             marginRight: '6px',
                             whiteSpace: 'nowrap'
                           }}
                         >
                             {msg.sender.medal_info.medal_name}|{msg.sender.medal_info.medal_level}
                         </span>
                     )}
                     
                     <span 
                         style={{ color: '#fff', fontWeight: 'bold', marginRight: '6px', cursor: 'pointer', whiteSpace: 'nowrap' }}
                         onClick={(e) => onUserClick(e, msg.sender)}
                         data-user-action-trigger="true"
                     >
                         {msg.sender.uname}
                     </span>
                 </div>
                 
                 <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'nowrap' }}>
                     <span style={{ color: '#ccc', marginRight: '4px', whiteSpace: 'nowrap' }}>投喂</span>

                     {giftImg && (
                         <img 
                             src={giftImg} 
                             alt="gift" 
                             style={{ width: '24px', height: '24px', marginRight: '4px', objectFit: 'contain' }} 
                         />
                     )}
                     
                     <span style={{ color: '#00a1d6', fontWeight: 'bold', marginRight: '4px', whiteSpace: 'nowrap' }}>
                         {msg.gift_info.name} x{msg.num}
                     </span>
                     
                     {valueText && (
                         <span style={{ color: '#00a1d6', fontWeight: 'bold', whiteSpace: 'nowrap' }}>
                             ({valueText})
                         </span>
                     )}
                 </div>
             </div>
        )
    }

    // Big Gift
    return (
        <div 
          className={styles['gift-card-anim']}
          style={{
              backgroundColor: valueRMB > 99 ? '#E8A900' : '#f085a5',
              color: '#fff',
              borderRadius: '8px',
              padding: '10px 12px',
              marginBottom: '8px',
              display: 'flex',
              alignItems: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
              fontWeight: 'bold',
              border: 'none',
              ...readStyle
          }}
          onDoubleClick={() => onToggleRead(item.id)}
        >
            <div 
              style={{ position: 'relative', marginRight: '12px', cursor: 'pointer' }}
              onClick={(e) => onUserClick(e, msg.sender)}
              data-user-action-trigger="true"
            >
                <img 
                    src={currentFace} 
                    alt="face" 
                    style={{ width: '40px', height: '40px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)' }} 
                    onError={(e) => { e.target.src = 'https://i0.hdslb.com/bfs/face/member/noface.jpg' }}
                />
            </div>
            
            <div style={{ flex: 1 }}>
                <div 
                    style={{ fontSize: '15px', lineHeight: '1.2', cursor: 'pointer' }}
                    onClick={(e) => onUserClick(e, msg.sender)}
                    data-user-action-trigger="true"
                >
                    {msg.sender.uname}
                </div>
                <div style={{ fontSize: '13px', opacity: 0.9, marginTop: '4px' }}>
                    {msg.action} {msg.gift_info.name} x{msg.num}
                </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginLeft: '8px' }}>
                {giftImg && (
                    <img 
                        src={giftImg} 
                        alt="gift" 
                        style={{ width: '32px', height: '32px', marginBottom: '2px', objectFit: 'contain' }} 
                    />
                )}
                <div style={{ fontSize: '14px' }}>￥{valueRMB.toFixed(1)}</div>
            </div>
        </div>
    )
}, (prev, next) => {
    if (prev.item !== next.item) return false
    if (prev.readMessages.has(prev.item.id) !== next.readMessages.has(next.item.id)) return false
    if (prev.minGiftPrice !== next.minGiftPrice) return false
    // giftMap 可能会变（虽然不频繁）
    if (prev.giftMap !== next.giftMap) return false
    return true
})
