// Code from: https://socialsisteryi.github.io/bilibili-API-collect/docs/misc/sign/wbi.html#javascript

import md5 from 'md5'
import https from 'https'

const mixinKeyEncTab = [
  46, 47, 18, 2, 53, 8, 23, 32, 15, 50, 10, 31, 58, 3, 45, 35, 27, 43, 5, 49,
  33, 9, 42, 19, 29, 28, 14, 39, 12, 38, 41, 13, 37, 48, 7, 16, 24, 55, 40, 61,
  26, 17, 0, 1, 60, 51, 30, 4, 22, 25, 54, 21, 56, 59, 6, 63, 57, 62, 11, 36,
  20, 34, 44, 52,
]

// 对 imgKey 和 subKey 进行字符顺序打乱编码
const getMixinKey = (orig) =>
  mixinKeyEncTab
    .map((n) => orig[n])
    .join('')
    .slice(0, 32)

// 为请求参数进行 wbi 签名
function encWbi(params, img_key, sub_key) {
  const mixin_key = getMixinKey(img_key + sub_key),
    curr_time = Math.round(Date.now() / 1000),
    chr_filter = /[!'()*]/g

  Object.assign(params, { wts: curr_time }) // 添加 wts 字段
  // 按照 key 重排参数
  const query = Object.keys(params)
    .sort()
    .map((key) => {
      // 过滤 value 中的 "!'()*" 字符
      const value = params[key].toString().replace(chr_filter, '')
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`
    })
    .join('&')

  const wbi_sign = md5(query + mixin_key) // 计算 w_rid

  return query + '&w_rid=' + wbi_sign
}

// 获取最新的 img_key 和 sub_key
async function getWbiKeys(cookiesStr) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.bilibili.com',
      path: '/x/web-interface/nav',
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.bilibili.com/',
        'Cookie': cookiesStr || ''
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
          if (resp.data && resp.data.wbi_img) {
            const img_url = resp.data.wbi_img.img_url
            const sub_url = resp.data.wbi_img.sub_url
            resolve({
              img_key: img_url.slice(
                img_url.lastIndexOf('/') + 1,
                img_url.lastIndexOf('.')
              ),
              sub_key: sub_url.slice(
                sub_url.lastIndexOf('/') + 1,
                sub_url.lastIndexOf('.')
              ),
            })
          } else {
             // Fallback or retry logic if needed, but for now reject
             reject(new Error('Failed to get wbi keys'))
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

let web_keys = null
let last_update_time = 0

export default async function wbi_sign(param, cookiesStr) {
  const now = Date.now()
  // Cache keys for a while (e.g. 10 minutes) or fetch if null
  if (!web_keys || now - last_update_time > 600 * 1000) {
    try {
        web_keys = await getWbiKeys(cookiesStr)
        last_update_time = now
    } catch(e) {
        console.error('Failed to update WBI keys, using cache if available', e)
        if (!web_keys) throw e
    }
  }
  const img_key = web_keys.img_key,
    sub_key = web_keys.sub_key
  return encWbi(param, img_key, sub_key)
}
