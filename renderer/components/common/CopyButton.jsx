import React, { useState } from 'react'

const CopyButton = ({ text, style }) => {
    const [copied, setCopied] = useState(false)

    const handleCopy = () => {
        if (window.ipc) {
            window.ipc.send('clipboard-write', text)
        } else {
            // Fallback
            navigator.clipboard.writeText(text).catch(e => console.error('Copy failed:', e))
        }
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    return (
        <button 
            onClick={handleCopy}
            style={{ 
                ...style,
                background: copied ? '#4caf50' : style.background, // Green on success
                color: copied ? '#fff' : style.color,
                transition: 'all 0.2s',
                minWidth: '48px' // Prevent layout shift
            }}
        >
            {copied ? '已复制' : '复制'}
        </button>
    )
}

export default CopyButton
