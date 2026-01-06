import React, { memo } from 'react'
import styles from '@/styles/FlipCounter.module.css'

const Digit = memo(({ value }) => {
  return (
    <div className={styles.digitWindow}>
      <div 
        className={styles.digitStrip} 
        style={{ transform: `translateY(-${value * 10}%)` }}
      >
        {[0,1,2,3,4,5,6,7,8,9].map(n => (
          <div key={n} className={styles.digit}>{n}</div>
        ))}
      </div>
    </div>
  )
})

export default function FlipCounter({ value }) {
  const digits = String(value).split('').map(Number)
  return (
    <div className={styles.counterWrapper}>
      {digits.map((d, i) => (
        // Using index as key is acceptable here as long as length change is handled gracefully.
        // Usually, we want stable keys from right to left for numbers (e.g. 1s place, 10s place)
        // but for simple display, index from left is fine.
        <Digit key={i} value={d} />
      ))}
    </div>
  )
}
