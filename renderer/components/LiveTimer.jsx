import React, { useState, useEffect } from 'react'
import moment from 'moment'

export default function LiveTimer({ startTime }) {
    const [duration, setDuration] = useState('00:00:00')

    useEffect(() => {
        if (!startTime) return

        const updateTimer = () => {
            const now = moment()
            // Support both unix timestamp (seconds) and date string
            let start
            if (typeof startTime === 'string') {
                start = moment(startTime)
            } else {
                start = moment.unix(startTime)
            }
            
            const diff = now.diff(start)
            
            // Format duration
            const durationObj = moment.duration(diff)
            const hours = Math.floor(durationObj.asHours())
            const minutes = durationObj.minutes()
            const seconds = durationObj.seconds()
            
            const fmt = (n) => n < 10 ? '0' + n : n
            setDuration(`${fmt(hours)}:${fmt(minutes)}:${fmt(seconds)}`)
        }

        updateTimer()
        const timer = setInterval(updateTimer, 1000)
        return () => clearInterval(timer)
    }, [startTime])

    return <span>{duration}</span>
}
