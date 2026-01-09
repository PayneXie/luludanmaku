import https from 'https'
import querystring from 'querystring'
import { v4 as uuidv4 } from 'uuid'
import wbi_sign from './wbi'

export const QrCodeStatus = {
  NeedScan: 0,
  NeedConfirm: 1,
  Success: 2,
}

export interface BiliCookies {
  SESSDATA?: string
  DedeUserID?: string
  DedeUserID__ckMd5?: string
  bili_jct?: string
  [key: string]: string | undefined
}

export interface QrCodeResult {
  url: string
  oauthKey: string
}

export interface CheckQrResult {
  status: number
  cookies?: BiliCookies
}

export function GetNewQrCode(): Promise<QrCodeResult> {
  return new Promise((resolve, reject) => {
    https.get(
      'https://passport.bilibili.com/x/passport-login/web/qrcode/generate',
      (res) => {
        let data = ''
        res.on('data', (chunk) => {
          data += chunk
        })
        res.on('end', () => {
          try {
            let resp = JSON.parse(data)
            resolve({
              url: resp['data']['url'],
              oauthKey: resp['data']['qrcode_key'],
            })
          } catch (e) {
            reject(e)
          }
        })
        res.on('error', (err) => {
          reject(err)
        })
      }
    )
  })
}

export function CheckQrCodeStatus(oauthKey: string): Promise<CheckQrResult> {
  return new Promise((resolve, reject) => {
    const postOptions = {
      hostname: 'passport.bilibili.com',
      path: '/x/passport-login/web/qrcode/poll?qrcode_key=' + oauthKey,
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }
    const statusReq = https.request(postOptions, (res) => {
      let dd = ''
      res.on('data', (secCheck) => {
        dd += secCheck
      })
      res.on('end', () => {
        try {
          let resp = JSON.parse(dd)
          if (resp['data']['code'] === 0) {
            let url = resp['data']['url']
            let params = querystring.parse(url.split('?')[1]) as unknown as BiliCookies
            resolve({
              status: QrCodeStatus.Success,
              cookies: params,
            })
          } else {
            if (resp['data']['code'] === 86101) {
              resolve({
                status: QrCodeStatus.NeedScan,
              })
            } else if (resp['data']['code'] === 86090) {
              resolve({
                status: QrCodeStatus.NeedConfirm,
              })
            } else {
              reject(resp)
            }
          }
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', (err) => {
        reject(err)
      })
    })
    statusReq.on('error', (err) => {
        reject(err)
    })
    statusReq.end()
  })
}

export function cookiesToString(cookies: BiliCookies): string {
  let cookieStr = ''
  if (cookies.SESSDATA) {
      cookieStr += 'SESSDATA=' + encodeURIComponent(cookies.SESSDATA) + ';'
  }
  if (cookies.DedeUserID) {
      cookieStr += 'DedeUserID=' + cookies.DedeUserID + ';'
  }
  if (cookies.DedeUserID__ckMd5) {
      cookieStr += 'DedeUserID_ckMd5=' + cookies.DedeUserID__ckMd5 + ';'
  }
  if (cookies.bili_jct) {
      cookieStr += 'bili_jct=' + cookies.bili_jct + ';'
  }
  return cookieStr
}

export function Logout(cookies: BiliCookies) {
  return new Promise((resolve, reject) => {
    let postData = 'biliCSRF=' + cookies.bili_jct
    let postOptions = {
      hostname: 'passport.bilibili.com',
      path: '/login/exit/v2',
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
        cookie: cookiesToString(cookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
    }
    let statusReq = https.request(postOptions, (res) => {
      let dd = ''
      res.on('data', (secCheck) => {
        dd += secCheck
      })
      res.on('end', () => {
        try {
          let resp = JSON.parse(dd)
          resolve(resp)
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', (err) => {
        reject(err)
      })
    })
    statusReq.write(postData)
    statusReq.end()
  })
}

export function GetDanmuInfo(cookies: BiliCookies | null, roomId: number): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const cookieStr = cookies ? cookiesToString(cookies) : ''
    
    // Use WBI sign for parameters
    let params: any = {
      id: roomId,
      type: 0
    }
    
    let queryString = ''
    try {
        queryString = await wbi_sign(params, cookieStr)
    } catch (e) {
        console.error('WBI sign failed', e)
        queryString = `id=${roomId}&type=0` // fallback
    }

    const headers: any = {
        cookie: cookieStr + (cookies && !cookieStr.includes('buvid3') ? ' buvid3=' + uuidv4() + 'infoc;' : ''),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': `https://live.bilibili.com/${roomId}`,
        'Origin': 'https://live.bilibili.com'
    }
    
    // Debug logging
    console.log('--- GetDanmuInfo Request Debug ---')
    console.log('RoomID:', roomId)
    console.log('Query:', queryString)
    console.log('Headers:', JSON.stringify(headers, null, 2))
    console.log('----------------------------------')

    const options = {
      hostname: 'api.live.bilibili.com',
      path: `/xlive/web-room/v1/index/getDanmuInfo?${queryString}`,
      method: 'GET',
      headers: headers,
    }
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const resp = JSON.parse(data)
          if (resp.code === 0) {
            resolve(resp.data)
          } else {
            reject(resp)
          }
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', (err) => {
        reject(err)
      })
    })
    req.on('error', (err) => reject(err))
    req.end()
  })
}

export function GetRoomInfo(roomId: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const req = https.get(`https://api.live.bilibili.com/room/v1/Room/get_info?room_id=${roomId}`, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const resp = JSON.parse(data)
          if (resp.code === 0) {
            resolve(resp.data)
          } else {
            reject(new Error(resp.message || 'Failed to get room info'))
          }
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', (err) => reject(err))
    })
    req.on('error', (err) => reject(err))
  })
}

export function GetSilentUserList(cookies: BiliCookies, roomId: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      room_id: roomId,
      ps: 10,
      pn: 1,
      csrf_token: cookies.bili_jct,
      csrf: cookies.bili_jct
    })

    const options = {
      hostname: 'api.live.bilibili.com',
      path: '/xlive/web-ucenter/v1/banned/GetSilentUserList',
      method: 'POST',
      headers: {
        'Cookie': cookiesToString(cookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }
    
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const resp = JSON.parse(data)
          resolve(resp) // 直接返回原始响应
        } catch (e) {
          // 如果还是非 JSON，把原始文本返回以便调试
          console.error('JSON Parse Error, raw data:', data)
          reject(e)
        }
      })
      res.on('error', (err) => {
        reject(err)
      })
    })
    
    req.on('error', (err) => reject(err))
    req.write(postData)
    req.end()
  })
}

export function AddSilentUser(cookies: BiliCookies, roomId: number, targetUid: number, hour: number): Promise<any> {
  return new Promise((resolve, reject) => {
    const postData = querystring.stringify({
      room_id: roomId,
      tuid: targetUid,
      mobile_app: 'web',
      type: 1, // 必须参数，否则可能导致禁言时长无效
      hour: hour,
      csrf_token: cookies.bili_jct,
      csrf: cookies.bili_jct
    })

    const options = {
      hostname: 'api.live.bilibili.com',
      path: '/xlive/web-ucenter/v1/banned/AddSilentUser',
      method: 'POST',
      headers: {
        'Cookie': cookiesToString(cookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData)
      }
    }
    
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => { data += chunk })
      res.on('end', () => {
        try {
          const resp = JSON.parse(data)
          resolve(resp)
        } catch (e) {
          console.error('JSON Parse Error in AddSilentUser, raw data:', data)
          reject(e)
        }
      })
      res.on('error', (err) => reject(err))
    })
    
    req.write(postData)
    req.end()
  })
}

export function GetBiliUserInfo(cookies: BiliCookies, mid: number): Promise<any> {
  return new Promise(async (resolve, reject) => {
    const cookieStr = cookiesToString(cookies)
    
    // Use WBI sign for parameters
    let params: any = {
      mid: mid
    }
    
    let queryString = ''
    try {
        queryString = await wbi_sign(params, cookieStr)
    } catch (e) {
        console.error('WBI sign failed', e)
        queryString = `mid=${mid}` // fallback
    }

    const headers: any = {
        cookie: cookieStr + (cookies && !cookieStr.includes('buvid3') ? ' buvid3=' + uuidv4() + 'infoc;' : ''),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Origin': 'https://www.bilibili.com'
    }
    
    const options = {
      hostname: 'api.bilibili.com',
      path: `/x/space/wbi/acc/info?${queryString}`,
      method: 'GET',
      headers: headers,
    }
    
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const resp = JSON.parse(data)
          if (resp.code === 0) {
            resolve(resp.data)
          } else {
            reject(new Error(resp.message || `API Error Code: ${resp.code}`))
          }
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', (err) => {
        reject(err)
      })
    })
    req.on('error', (err) => reject(err))
    req.end()
  })
}

export function GetUserInfo(cookies: BiliCookies): Promise<any> {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bilibili.com',
      path: '/x/web-interface/nav',
      method: 'GET',
      headers: {
        'Cookie': cookiesToString(cookies),
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    }
    
    const req = https.request(options, (res) => {
      let data = ''
      res.on('data', (chunk) => {
        data += chunk
      })
      res.on('end', () => {
        try {
          const resp = JSON.parse(data)
          if (resp.code === 0 && resp.data.isLogin) {
            resolve({
              uname: resp.data.uname,
              face: resp.data.face,
              mid: resp.data.mid
            })
          } else {
            reject(new Error(resp.message || 'Failed to get user info'))
          }
        } catch (e) {
          reject(e)
        }
      })
      res.on('error', (err) => {
        reject(err)
      })
    })
    req.on('error', (err) => reject(err))
    req.end()
  })
}
