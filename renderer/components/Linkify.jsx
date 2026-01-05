import React from 'react'

const Linkify = ({ children }) => {
  if (typeof children !== 'string') return children

  // Regex to match:
  // 1. URLs (http/https)
  // 2. AV numbers (av12345, case insensitive)
  // 3. BV numbers (BV1234567890, case insensitive for prefix mostly but BV is standard)
  const regex = /(https?:\/\/[^\s]+|(?:av|AV)\d+|BV[a-zA-Z0-9]{10})/g
  
  const parts = children.split(regex)

  return (
    <>
      {parts.map((part, i) => {
        if (!part) return null 

        // Check if part matches our pattern
        if (part.match(regex)) {
            let url = part
            // Construct Bilibili URL if it's AV/BV
            // Check for AV or BV pattern
            if (/^(av|AV)\d+$/.test(part) || /^BV[a-zA-Z0-9]{10}$/.test(part)) {
                url = `https://www.bilibili.com/video/${part}`
            }

            return (
                <a
                  key={i}
                  href={url}
                  onClick={(e) => {
                    e.preventDefault()
                    e.stopPropagation()
                    if (window.ipc) {
                      window.ipc.send('open-external', url)
                    } else {
                      window.open(url, '_blank')
                    }
                  }}
                  style={{ 
                    color: '#00a1d6', 
                    textDecoration: 'underline', 
                    cursor: 'pointer',
                    wordBreak: 'break-all' 
                  }}
                  title="在浏览器中打开"
                >
                  {part}
                </a>
            )
        }
        return <span key={i}>{part}</span>
      })}
    </>
  )
}

export default Linkify
