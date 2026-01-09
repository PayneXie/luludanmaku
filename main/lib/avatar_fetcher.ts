import https from 'https'
import querystring from 'querystring'

interface AvatarApi {
  name: string
  url: string
  method: string
  buildParams: (uid: number) => string
  parseResponse: (data: any) => string | null // Returns face URL or null
  host: string
  path: string
}

interface ApiStatus {
  isAvailable: boolean
  cooldownUntil: number
}

const REQUEST_TIMEOUT = 5000 // 5 seconds
const COOLDOWN_TIME = 3 * 60 * 1000 // 3 minutes

export class AvatarFetcher {
  private apis: AvatarApi[]
  private status: Map<string, ApiStatus>
  private currentIndex: number

  constructor() {
    this.status = new Map()
    this.currentIndex = 0

    this.apis = [
      {
        name: 'UserCard',
        url: 'https://api.bilibili.com/x/web-interface/card',
        host: 'api.bilibili.com',
        path: '/x/web-interface/card',
        method: 'GET',
        buildParams: (uid) => `mid=${uid}&photo=1`,
        parseResponse: (json) => {
          if (json.code === 0 && json.data && json.data.card) {
            return json.data.card.face
          }
          return null
        }
      },
      {
        name: 'SpaceAcc',
        url: 'https://api.bilibili.com/x/space/acc/info',
        host: 'api.bilibili.com',
        path: '/x/space/acc/info',
        method: 'GET',
        buildParams: (uid) => `mid=${uid}`,
        parseResponse: (json) => {
           if (json.code === 0 && json.data) {
             return json.data.face
           }
           return null
        }
      },
      {
        name: 'GameCenter',
        url: 'https://line3-h5-mobile-api.biligame.com/game/center/h5/user/space/info',
        host: 'line3-h5-mobile-api.biligame.com',
        path: '/game/center/h5/user/space/info',
        method: 'GET',
        buildParams: (uid) => `uid=${uid}`,
        parseResponse: (json) => {
          if (json.code === 0 && json.data) {
            return json.data.face || json.data.avatar || json.data.head_url || null
          }
          return null
        }
      }
    ]

    // Initialize status
    this.apis.forEach(api => {
      this.status.set(api.name, { isAvailable: true, cooldownUntil: 0 })
    })
  }

  private getNextAvailableApi(): AvatarApi | null {
    const start = this.currentIndex
    const now = Date.now()
    
    // Loop through APIs starting from current index
    for (let i = 0; i < this.apis.length; i++) {
      const index = (start + i) % this.apis.length
      const api = this.apis[index]
      const status = this.status.get(api.name)!

      if (status.isAvailable) {
        // Don't update this.currentIndex here permanently, 
        // just return the found API. We update currentIndex only when we decide to rotate.
        // But for simplicity in rotation, let's keep it sync.
        // The issue in previous code: if we fail, we didn't rotate currentIndex for the NEXT call in the loop.
        return api
      }

      // Check if cooldown expired
      if (!status.isAvailable && now > status.cooldownUntil) {
        status.isAvailable = true
        status.cooldownUntil = 0
        console.log(`[AvatarFetcher] API ${api.name} recovered from cooldown`)
        return api
      }
    }

    console.warn('[AvatarFetcher] All APIs are in cooldown')
    return null
  }

  private rotateToNextApi() {
    this.currentIndex = (this.currentIndex + 1) % this.apis.length
  }

  private markApiUnavailable(apiName: string) {
    const status = this.status.get(apiName)
    if (status) {
      status.isAvailable = false
      status.cooldownUntil = Date.now() + COOLDOWN_TIME
      console.warn(`[AvatarFetcher] API ${apiName} marked unavailable for 3 mins (412 detected)`)
    }
  }

  public async fetchAvatar(uid: number): Promise<string | null> {
    // Try up to 3 times (switching APIs)
    for (let attempt = 0; attempt < this.apis.length; attempt++) {
      // Always get the API at current index (considering availability)
      const api = this.getNextAvailableApi()
      if (!api) return null

      try {
        const face = await this.request(api, uid)
        if (face) return face
        
        // If request returned null (e.g. code != 0 but not 412), treat as failure for this API
        // and try next one
        this.rotateToNextApi()
      } catch (error: any) {
        // Check for 412 or specific error codes
        if (error.statusCode === 412 || error.code === -412) {
           this.markApiUnavailable(api.name)
           // Automatically rotates to next via getNextAvailableApi logic on next loop
           // But we should also advance currentIndex to ensure we don't check this one again immediately
           this.rotateToNextApi() 
           continue
        }
        
        console.error(`[AvatarFetcher] Error using ${api.name}: ${error.message}`)
        // For other errors, just rotate and try next
        this.rotateToNextApi()
      }
    }
    return null
  }

  private request(api: AvatarApi, uid: number): Promise<string | null> {
    return new Promise((resolve, reject) => {
      const options = {
        hostname: api.host,
        path: `${api.path}?${api.buildParams(uid)}`,
        method: api.method,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://live.bilibili.com/'
        },
        timeout: REQUEST_TIMEOUT
      }

      const req = https.request(options, (res) => {
        if (res.statusCode === 412) {
          const err: any = new Error('Precondition Failed')
          err.statusCode = 412
          reject(err)
          return
        }

        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try {
            const json = JSON.parse(data)
            // Bilibili APIs return non-zero code for errors
            if (json.code !== 0) {
                // If code is related to blocking
                if (json.code === -412) {
                     const err: any = new Error('API Blocked')
                     err.statusCode = 412
                     reject(err)
                     return
                }
                // Some APIs return -400 for invalid user, which is not a ban
                // We resolve null for business errors
                console.warn(`[AvatarFetcher] ${api.name} returned code ${json.code}: ${json.message}`)
                resolve(null)
            } else {
                resolve(api.parseResponse(json))
            }
          } catch (e) {
            reject(e)
          }
        })
      })

      req.on('error', (err) => reject(err))
      req.on('timeout', () => {
        req.destroy()
        reject(new Error('Request Timeout'))
      })
      
      req.end()
    })
  }
}

export const avatarFetcher = new AvatarFetcher()
