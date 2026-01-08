import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'

const COLORS = ['#F87171', '#60A5FA', '#FBBF24', '#34D399', '#A78BFA', '#F472B6', '#fbbf24', '#22d3ee']

const LuckyWheel = () => {
    const [inputStr, setInputStr] = useState("今天吃什么\n早点睡\n再来一局")
    const [options, setOptions] = useState([])
    const [isSpinning, setIsSpinning] = useState(false)
    const [isStopping, setIsStopping] = useState(false)
    const [rotation, setRotation] = useState(0)
    const [result, setResult] = useState(null)
    const [wheelSize, setWheelSize] = useState(0)
    
    const canvasRef = useRef(null)
    const requestRef = useRef()
    const speedRef = useRef(0)
    const rotationRef = useRef(0)
    const containerRef = useRef(null)

    useEffect(() => {
        const list = inputStr.split('\n').filter(s => s.trim() !== '')
        setOptions(list.length > 0 ? list : ['选项1', '选项2'])
    }, [inputStr])

    useEffect(() => {
        drawWheel()
        window.addEventListener('resize', drawWheel)
        return () => window.removeEventListener('resize', drawWheel)
    }, [options])

    useEffect(() => {
        if (!containerRef.current) return
        const resizeObserver = new ResizeObserver(() => {
            drawWheel()
        })
        resizeObserver.observe(containerRef.current)
        return () => resizeObserver.disconnect()
    }, [options])

    const drawWheel = () => {
        const canvas = canvasRef.current
        const container = containerRef.current
        if (!canvas || !container) return

        const size = Math.min(container.clientWidth, container.clientHeight) - 10 
        if (size !== wheelSize) {
            setWheelSize(size)
        }
        const dpr = window.devicePixelRatio || 1
        canvas.width = size * dpr
        canvas.height = size * dpr
        
        canvas.style.width = `${size}px`
        canvas.style.height = `${size}px`

        const ctx = canvas.getContext('2d')
        ctx.scale(dpr, dpr)

        const width = size
        const height = size
        const centerX = width / 2
        const centerY = height / 2
        const radius = size / 2 - 20 

        ctx.clearRect(0, 0, width, height)
        
        const len = options.length
        const arc = Math.PI * 2 / len

        ctx.beginPath()
        ctx.arc(centerX, centerY, radius + 8, 0, Math.PI * 2)
        ctx.fillStyle = '#f3f4f6'
        ctx.fill()
        
        ctx.beginPath()
        ctx.arc(centerX, centerY, radius + 4, 0, Math.PI * 2)
        ctx.fillStyle = '#ffffff'
        ctx.fill()

        for (let i = 0; i < len; i++) {
            const startAngle = i * arc
            const endAngle = (i + 1) * arc

            ctx.beginPath()
            ctx.moveTo(centerX, centerY)
            ctx.arc(centerX, centerY, radius, startAngle, endAngle)
            ctx.fillStyle = COLORS[i % COLORS.length]
            ctx.fill()
            ctx.strokeStyle = '#fff'
            ctx.lineWidth = 3
            ctx.stroke()
            ctx.save()

            ctx.translate(centerX, centerY)
            ctx.rotate(startAngle + arc / 2)
            ctx.textAlign = 'right'
            ctx.fillStyle = '#fff'
            ctx.font = `bold ${Math.max(14, size / 22)}px "Microsoft YaHei"`
            ctx.shadowColor = 'rgba(0,0,0,0.1)'
            ctx.shadowBlur = 4
            ctx.fillText(options[i], radius - 30, 5)
            ctx.restore()
        }
    }

    const animate = () => {
        if (isSpinning) {
            speedRef.current = 15 + Math.random() * 5
        } else if (isStopping) {
            speedRef.current *= 0.985
            if (speedRef.current < 0.1) {
                speedRef.current = 0
                setIsStopping(false)
                calculateResult()
                return
            }
        } else {
            return
        }

        rotationRef.current += speedRef.current
        setRotation(rotationRef.current)
        requestRef.current = requestAnimationFrame(animate)
    }

    const calculateResult = () => {
        const len = options.length
        const deg = rotationRef.current % 360
        const pointerDeg = (360 - deg) % 360
        const arcDeg = 360 / len
        const index = Math.floor(pointerDeg / arcDeg)
        setResult(options[index])
    }

    useEffect(() => {
        if (isSpinning || isStopping) {
            requestRef.current = requestAnimationFrame(animate)
        }
        return () => cancelAnimationFrame(requestRef.current)
    }, [isSpinning, isStopping])

    const handleStart = () => {
        if (isStopping) return
        if (isSpinning) {
            setIsSpinning(false)
            setIsStopping(true)
        } else {
            setResult(null)
            setIsSpinning(true)
            setIsStopping(false)
            speedRef.current = 10
        }
    }

    return (
        <div className="flex gap-6 h-full">
            <div className="w-64 flex flex-col shrink-0 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-shadow hover:shadow-xl">
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-blue-100 text-blue-500 flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="8" y1="6" x2="21" y2="6"></line>
                                <line x1="8" y1="12" x2="21" y2="12"></line>
                                <line x1="8" y1="18" x2="21" y2="18"></line>
                                <line x1="3" y1="6" x2="3.01" y2="6"></line>
                                <line x1="3" y1="12" x2="3.01" y2="12"></line>
                                <line x1="3" y1="18" x2="3.01" y2="18"></line>
                            </svg>
                        </div>
                        选项列表
                    </label>
                </div>
                <div className="flex-1 p-4 flex flex-col">
                    <textarea 
                        className="flex-1 w-full p-0 border-none bg-transparent text-sm resize-none focus:outline-none focus:ring-0 text-gray-600 leading-relaxed"
                        placeholder="每行输入一个选项..."
                        value={inputStr}
                        onChange={(e) => setInputStr(e.target.value)}
                        style={{ fontFamily: 'inherit' }}
                    />
                    <div className="mt-2 pt-2 border-t border-gray-100 text-xs text-gray-400 text-center flex items-center justify-center gap-1">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"></polyline><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>
                        每行一个选项
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center min-w-0 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full opacity-30 pointer-events-none">
                    <div className="absolute -top-20 -right-20 w-64 h-64 bg-blue-50 rounded-full blur-3xl"></div>
                    <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-pink-50 rounded-full blur-3xl"></div>
                </div>

                <div className="relative w-full flex-1 flex flex-col items-center justify-center min-h-[300px]">
                    <div 
                        ref={containerRef}
                        className="relative w-full h-full flex items-center justify-center"
                    >
                        <div className="absolute top-1/2 right-[50%] translate-x-[50%] -translate-y-1/2 z-20 pointer-events-none" 
                                style={{ 
                                    width: wheelSize + 30,
                                    height: 0,
                                    display: 'flex',
                                    justifyContent: 'flex-end',
                                    alignItems: 'center'
                                }}
                        >
                            <div className="w-0 h-0 border-t-[14px] border-t-transparent border-b-[14px] border-b-transparent border-r-[26px] border-r-red-500 drop-shadow-lg translate-x-[-12px] filter drop-shadow-md"></div>
                        </div>

                        <div 
                            className="absolute rounded-full shadow-2xl z-0"
                            style={{ width: wheelSize, height: wheelSize, boxShadow: '0 10px 40px -10px rgba(0,0,0,0.2)' }}
                        />

                        <div 
                            style={{ 
                                transform: `rotate(${rotation}deg)`,
                                transition: 'transform 0s linear',
                            }}
                            className="flex items-center justify-center relative z-10"
                        >
                            <canvas ref={canvasRef} />
                            <div className="absolute w-8 h-8 bg-white rounded-full shadow-lg z-20 flex items-center justify-center border-2 border-gray-100">
                                <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-4 text-center w-full z-10 pb-4">
                    <div className={`h-10 mb-2 flex items-center justify-center transition-all duration-300 ${result ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'}`}>
                        <span className="text-gray-400 mr-3 text-lg">结果是:</span>
                        <span className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-600">
                            {result || ''}
                        </span>
                    </div>
                    
                    <button 
                        onClick={handleStart}
                        disabled={isStopping}
                        className={`
                            px-12 py-3 text-lg font-bold text-white rounded-2xl shadow-lg shadow-blue-500/20 
                            transition-all duration-200 active:scale-95 flex items-center justify-center gap-2 mx-auto
                            ${isSpinning 
                                ? 'bg-red-500 hover:bg-red-600 shadow-red-500/20' 
                                : isStopping 
                                    ? 'bg-gray-400 cursor-not-allowed' 
                                    : 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 hover:-translate-y-0.5'
                            }
                        `}
                    >
                        {isSpinning ? (
                            <>
                                <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                </svg>
                                停 止
                            </>
                        ) : (isStopping ? '...' : '开 始')}
                    </button>
                </div>
            </div>
        </div>
    )
}

const DanmuVote = () => {
    const [optionsStr, setOptionsStr] = useState("选项A\n选项B\n选项C")
    const [duration, setDuration] = useState(60)
    const [voteStatus, setVoteStatus] = useState('idle') // idle, voting, finished
    const [timeLeft, setTimeLeft] = useState(60)
    const [results, setResults] = useState([])
    const [totalVotes, setTotalVotes] = useState(0)
    
    // Refs for event listener access
    const resultsRef = useRef([])
    const votedUidsRef = useRef(new Set())
    const isVotingRef = useRef(false)
    const timerRef = useRef(null)

    // 初始化选项
    useEffect(() => {
        if (voteStatus === 'idle') {
            const list = optionsStr.split('\n').filter(s => s.trim() !== '')
            const initialResults = list.map((label, idx) => ({
                id: `opt-${idx}`, // Add stable ID
                label: label.trim(),
                count: 0,
                color: COLORS[idx % COLORS.length]
            }))
            setResults(initialResults)
            resultsRef.current = initialResults
            setTotalVotes(0)
            votedUidsRef.current.clear()
        }
    }, [optionsStr, voteStatus])

    // 同步状态到 Ref
    useEffect(() => {
        isVotingRef.current = voteStatus === 'voting'
    }, [voteStatus])

    // 弹幕监听
    useEffect(() => {
        const handler = (event, batch) => {
            // 注意：这里需要放宽校验，因为 Debug 模式可能不需要 isVotingRef.current 检查，或者我们需要在界面上允许调试
            // 但为了逻辑严谨，还是保留 isVotingRef.current 检查。用户需要先点击"开始投票"。
            if (!isVotingRef.current) return
            
            // 使用函数式更新来确保没有闭包陷阱，或者使用 Ref
            const currentResults = [...resultsRef.current]
            const currentUids = votedUidsRef.current
            let hasUpdate = false
            let newTotal = 0
            
            // 批量处理
            batch.forEach(msg => {
                // 支持普通弹幕和 SC
                if (msg.cmd === 'DANMU_MSG' || msg.cmd === 'SUPER_CHAT_MESSAGE') {
                    let content = ''
                    let uid = 0
                    
                    if (msg.cmd === 'DANMU_MSG') {
                        content = msg.info[1]
                        uid = msg.info[2][0]
                    } else {
                        // SC
                        content = msg.data.message
                        uid = msg.data.uid
                    }
                    
                    // Debug 消息处理
                    const isDebug = uid === 12345
                    
                    console.log('[Tools] Received MSG:', content, 'UID:', uid, 'IsDebug:', isDebug) // Add Log

                    if (!isDebug && currentUids.has(uid)) {
                        console.log('[Tools] Skip duplicate vote for UID:', uid)
                        return 
                    }
                    
                    // 简单的包含匹配
                    for (let i = 0; i < currentResults.length; i++) {
                        const opt = currentResults[i]
                        // 忽略大小写
                        if (content.toLowerCase().includes(opt.label.toLowerCase())) {
                            console.log('[Tools] Matched Option:', opt.label) // Add Log
                            if (!isDebug) currentUids.add(uid)
                            currentResults[i].count += 1
                            hasUpdate = true
                            break // 只投第一个匹配的
                        }
                    }
                }
            })
            
            if (hasUpdate) {
                // 排序：票数多的在前面
                currentResults.sort((a, b) => b.count - a.count)
                
                // 计算总票数
                newTotal = currentResults.reduce((acc, curr) => acc + curr.count, 0)
                setResults(currentResults)
                setTotalVotes(newTotal)
                resultsRef.current = currentResults // 更新 ref
            }
        }
        
        if (typeof window !== 'undefined' && window.ipc) {
            window.ipc.on('danmu-message', handler)
        }
        return () => {
            if (typeof window !== 'undefined' && window.ipc) {
                window.ipc.removeAllListeners('danmu-message')
            }
        }
    }, [])

    const startVote = () => {
        setVoteStatus('voting')
        setTimeLeft(duration)
        setTotalVotes(0)
        votedUidsRef.current.clear()
        
        // 重置计数
        const list = optionsStr.split('\n').filter(s => s.trim() !== '')
        const initialResults = list.map((label, idx) => ({
            id: `opt-${idx}`,
            label: label.trim(),
            count: 0,
            color: COLORS[idx % COLORS.length]
        }))
        setResults(initialResults)
        resultsRef.current = initialResults

        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    stopVote()
                    return 0
                }
                return prev - 1
            })
        }, 1000)
    }

    const stopVote = () => {
        setVoteStatus('finished')
        if (timerRef.current) {
            clearInterval(timerRef.current)
            timerRef.current = null
        }
    }

    const resetVote = () => {
        stopVote()
        setVoteStatus('idle')
        setTimeLeft(duration)
        setTotalVotes(0)
    }

    // 计算最大值用于进度条
    const maxCount = Math.max(...results.map(r => r.count), 1)

    return (
        <div className="flex gap-6 h-full">
            {/* 左侧配置 */}
            <div className="w-64 flex flex-col shrink-0 bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-shadow hover:shadow-xl">
                <div className="p-4 bg-gray-50 border-b border-gray-100">
                    <label className="text-sm font-bold text-gray-700 flex items-center gap-2">
                        <div className="w-6 h-6 rounded-md bg-purple-100 text-purple-500 flex items-center justify-center">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path>
                                <path d="M22 12A10 10 0 0 0 12 2v10z"></path>
                            </svg>
                        </div>
                        投票设置
                    </label>
                </div>
                
                <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">
                    <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">选项列表</label>
                        <textarea 
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all min-h-[120px]"
                            placeholder="每行一个选项..."
                            value={optionsStr}
                            onChange={(e) => setOptionsStr(e.target.value)}
                            disabled={voteStatus === 'voting'}
                        />
                    </div>

                    <div>
                        <label className="text-xs font-semibold text-gray-500 mb-1.5 block">统计时长 (秒)</label>
                        <input 
                            type="number"
                            className="w-full p-3 rounded-xl border border-gray-200 bg-gray-50 text-sm focus:outline-none focus:ring-2 focus:ring-purple-100 focus:border-purple-400 transition-all"
                            value={duration}
                            onChange={(e) => setDuration(Number(e.target.value))}
                            disabled={voteStatus === 'voting'}
                        />
                    </div>
                </div>

                <div className="p-4 border-t border-gray-100 bg-gray-50 flex gap-2">
                    {voteStatus === 'voting' ? (
                        <button 
                            onClick={stopVote}
                            className="flex-1 py-2.5 bg-red-500 hover:bg-red-600 text-white rounded-xl font-bold shadow-lg shadow-red-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>
                            停止
                        </button>
                    ) : (
                        <button 
                            onClick={startVote}
                            className="flex-1 py-2.5 bg-purple-500 hover:bg-purple-600 text-white rounded-xl font-bold shadow-lg shadow-purple-500/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            {voteStatus === 'finished' ? '重新开始' : '开始投票'}
                        </button>
                    )}
                    {voteStatus !== 'idle' && (
                        <button 
                            onClick={resetVote}
                            className="px-4 py-2.5 bg-white border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-all active:scale-95"
                            title="重置"
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 4v6h-6"></path><path d="M1 20v-6h6"></path><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>
                        </button>
                    )}
                </div>
            </div>

            {/* 右侧结果 */}
            <div className="flex-1 flex flex-col min-w-0 bg-white rounded-2xl shadow-lg border border-gray-100 p-6 relative overflow-hidden">
                {/* 背景装饰 */}
                <div className="absolute top-0 right-0 w-full h-full opacity-30 pointer-events-none overflow-hidden">
                    <div className="absolute -top-10 -right-10 w-96 h-96 bg-purple-50 rounded-full blur-3xl"></div>
                </div>

                {/* 顶部倒计时 */}
                <div className="flex flex-col items-center justify-center mb-8 z-10">
                    <div className="text-sm text-gray-400 font-medium mb-1 uppercase tracking-wider">Time Remaining</div>
                    <div className={`text-6xl font-black tabular-nums transition-colors duration-300 ${timeLeft <= 10 && voteStatus === 'voting' ? 'text-red-500 animate-pulse' : 'text-gray-800'}`}>
                        {Math.floor(timeLeft / 60)}:{(timeLeft % 60).toString().padStart(2, '0')}
                    </div>
                    <div className="text-sm text-gray-500 mt-2 font-medium bg-gray-100 px-3 py-1 rounded-full">
                        总票数: {totalVotes}
                    </div>
                </div>

                {/* 柱状图列表 - 动态排序 Racing Bar Chart */}
                <div className="flex-1 flex flex-col z-10 relative mt-4 overflow-hidden">
                    {/* 纵轴 (垂直线) */}
                    <div className="absolute left-24 top-0 bottom-6 w-px bg-gray-200 z-0"></div>
                    
                    {/* 滚动区域 */}
                    <div className="flex-1 overflow-y-auto custom-scrollbar relative pr-6">
                        <div className="relative w-full" style={{ height: results.length * 40 + 'px' }}>
                            {results.map((opt, idx) => (
                                <div 
                                    key={opt.id} 
                                    className="absolute w-full transition-all duration-700 ease-in-out flex items-center"
                                    style={{ 
                                        top: `${idx * 40}px`, 
                                        height: '32px',
                                        zIndex: results.length - idx
                                    }}
                                >
                                    {/* 左侧 Label */}
                                    <div className="w-24 pr-4 text-right font-bold text-gray-700 truncate text-xs shrink-0 flex items-center justify-end h-full">
                                        {opt.label}
                                    </div>
                                    
                                    {/* 右侧 Bar 容器 */}
                                    <div className="flex-1 h-full flex items-center relative">
                                        {/* 刻度线 (每个Bar都有，连起来就像网格) - 可选 */}
                                        {/* <div className="absolute left-0 w-px h-full bg-gray-200"></div> */}

                                        <div className="h-6 w-full bg-gray-100/50 rounded-r-full rounded-l-sm overflow-visible relative flex items-center">
                                            {/* 动态 Bar */}
                                            <div 
                                                className="h-full rounded-r-full rounded-l-sm transition-all duration-700 ease-out shadow-sm relative flex items-center"
                                                style={{ 
                                                    width: `${maxCount > 0 ? (opt.count / maxCount) * 100 : 0}%`,
                                                    backgroundColor: opt.color,
                                                    minWidth: opt.count > 0 ? '4px' : '0'
                                                }}
                                            >
                                                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-b from-white/20 to-transparent pointer-events-none rounded-r-full rounded-l-sm"></div>
                                            </div>
                                            
                                            {/* 票数跟随显示 */}
                                            <span 
                                                className="absolute ml-2 font-bold text-gray-700 tabular-nums transition-all duration-700 text-xs"
                                                style={{ 
                                                    left: `${maxCount > 0 ? (opt.count / maxCount) * 100 : 0}%`,
                                                    opacity: 1
                                                }}
                                            >
                                                {opt.count}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                    
                    {/* 底部横轴 (刻度) */}
                    <div className="h-6 flex items-center w-full pl-24 mt-1 border-t border-gray-200 text-xs text-gray-400">
                        <div className="flex-1 flex justify-between px-0 relative">
                           <span>0</span>
                           <span className="absolute left-1/4 -translate-x-1/2 hidden sm:block">{Math.floor(maxCount * 0.25)}</span>
                           <span className="absolute left-1/2 -translate-x-1/2">{Math.floor(maxCount * 0.5)}</span>
                           <span className="absolute left-3/4 -translate-x-1/2 hidden sm:block">{Math.floor(maxCount * 0.75)}</span>
                           <span>{maxCount}</span>
                        </div>
                    </div>
                </div>
                
                {voteStatus === 'idle' && (
                    <div className="absolute inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-20">
                        <div className="text-gray-400 font-medium flex flex-col items-center">
                            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mb-2 opacity-50"><path d="M21.21 15.89A10 10 0 1 1 8 2.83"></path><path d="M22 12A10 10 0 0 0 12 2v10z"></path></svg>
                            请点击开始投票
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ToolsPage() {
    const [activeTab, setActiveTab] = useState('wheel')

    return (
        <React.Fragment>
            <Head>
                <title>实用工具箱</title>
                {/* 引入 Tailwind CDN */}
                <script src="https://cdn.tailwindcss.com"></script>
                <style>{`
                    .custom-scrollbar::-webkit-scrollbar {
                        width: 6px;
                    }
                    .custom-scrollbar::-webkit-scrollbar-track {
                        background: transparent;
                    }
                    .custom-scrollbar::-webkit-scrollbar-thumb {
                        background-color: #e5e7eb;
                        border-radius: 20px;
                    }
                `}</style>
            </Head>
            
            {/* 整个页面容器，使用 Tailwind 类名 */}
            <div className="flex flex-col h-screen bg-gray-50 text-gray-800 font-sans select-none overflow-hidden">
                {/* 标题栏 (可拖拽) */}
                <div 
                    className="flex items-center justify-between px-5 py-4 bg-white border-b border-gray-100 shadow-sm"
                    style={{ WebkitAppRegion: 'drag' }}
                >
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center text-blue-500">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="20" x2="18" y2="10"></line>
                                <line x1="12" y1="20" x2="12" y2="4"></line>
                                <line x1="6" y1="20" x2="6" y2="14"></line>
                            </svg>
                        </div>
                        <span className="font-bold text-lg text-gray-800">实用工具箱</span>
                    </div>
                    {/* 关闭按钮 */}
                    <button 
                        onClick={() => window.close()}
                        className="w-8 h-8 flex items-center justify-center rounded-md text-gray-400 hover:bg-red-50 hover:text-red-500 transition-colors duration-200"
                        style={{ WebkitAppRegion: 'no-drag' }}
                    >
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex px-5 border-b border-gray-100 gap-6 bg-white">
                    <button
                        className={`py-3 text-sm font-medium transition-colors relative top-[1px] ${
                            activeTab === 'wheel' 
                                ? 'text-blue-600 border-b-2 border-blue-600' 
                                : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                        }`}
                        onClick={() => setActiveTab('wheel')}
                    >
                        幸运转盘
                    </button>
                    <button
                        className={`py-3 text-sm font-medium transition-colors relative top-[1px] ${
                            activeTab === 'vote' 
                                ? 'text-purple-600 border-b-2 border-purple-600' 
                                : 'text-gray-500 hover:text-gray-700 border-b-2 border-transparent'
                        }`}
                        onClick={() => setActiveTab('vote')}
                    >
                        弹幕投票
                    </button>
                </div>

                {/* 内容区域 */}
                <div className="flex-1 p-5 overflow-hidden bg-gray-50/50">
                    {activeTab === 'wheel' && <LuckyWheel />}
                    {activeTab === 'vote' && <DanmuVote />}
                </div>
            </div>
        </React.Fragment>
    )
}
