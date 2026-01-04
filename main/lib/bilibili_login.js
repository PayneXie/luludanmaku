import https from 'https'
import querystring from 'querystring'

export const QrCodeStatus = {
  NeedScan: 0,
  NeedConfirm: 1,
  Success: 2,
}

export function GetNewQrCode() {
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

export function CheckQrCodeStatus(oauthKey) {
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
            let params = querystring.parse(url.split('?')[1])
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
    statusReq.end()
  })
}

export function cookiesToString(cookies) {
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

export function Logout(cookies) {
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

import wbi_sign from './wbi'

export function GetDanmuInfo(cookies, roomId) {
  return new Promise(async (resolve, reject) => {
    const cookieStr = cookies ? cookiesToString(cookies) : ''
    
    // Use WBI sign for parameters
    let params = {
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

    const headers = {
        cookie: cookieStr + (cookies && !cookieStr.includes('buvid3') ? ' buvid3=' + require('uuid').v4() + 'infoc;' : ''),
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
    req.end()
  })
}
