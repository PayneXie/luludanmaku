import React from 'react'
import Head from 'next/head'
import TitleBar from '../common/TitleBar'
import loginStyles from '@/styles/login.module.css'

const LoginPage = ({ qrImage, status, onRefresh }) => {
    return (
        <React.Fragment>
          <Head>
            <title>哔哩哔哩扫码登录</title>
          </Head>
          <style global jsx>{`
            body {
              margin: 0;
              padding: 0;
              overflow: hidden;
              font-family: "Microsoft YaHei", sans-serif;
              background-color: transparent;
            }
          `}</style>
          <div style={{ 
               display: 'flex', 
               flexDirection: 'column', 
               height: 'calc(100vh - 8px)', 
               margin: '4px',
               background: 'linear-gradient(135deg, #f0f7fd 0%, #fdfbfd 100%)',
               borderRadius: '6px',
               overflow: 'hidden',
               border: '1px solid rgba(255,255,255,0.3)',
               boxShadow: '0 0 12px 0 rgba(0,0,0,0.1)',
               position: 'relative'
           }}>
            <TitleBar title="登录 - Luludanmaku" />
            <div className={loginStyles.container} style={{ flex: 1, overflow: 'auto' }}>
                <div className={loginStyles.card}>
                    <h1 className={loginStyles.title}>哔哩哔哩扫码登录</h1>
                    
                    <div className={loginStyles.qrContainer}>
                        {qrImage ? (
                            <img src={qrImage} alt="Login QR Code" className={loginStyles.qrImage} />
                        ) : (
                            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ccc' }}>
                                加载中...
                            </div>
                        )}
                    </div>
                    
                    <p className={loginStyles.status}>{status}</p>
                    
                    <button 
                    onClick={onRefresh}
                    className={loginStyles.btnRefresh}
                    >
                    刷新二维码
                    </button>
                </div>
            </div>
          </div>
        </React.Fragment>
      )
}

export default LoginPage
