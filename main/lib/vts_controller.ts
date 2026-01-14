import WebSocket from 'ws'
import Store from 'electron-store'
import log from 'electron-log/main'
import { BrowserWindow } from 'electron'

const store = new Store()
const VTS_TOKEN_KEY = 'vts_auth_token'

interface VTSRequest {
  apiName: string
  apiVersion: string
  requestID: string
  messageType: string
  data?: any
}

export class VTSController {
  private ws: WebSocket | null = null
  private url: string = 'ws://172.16.2.16:8001'
  public isConnected: boolean = false
  public isAuthenticated: boolean = false
  private pluginName = 'LuluDanmaku'
  private pluginDeveloper = 'Payne'

  constructor() {
    // Silent by default
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)) {
        log.info('[VTS] Already connecting or connected')
        return
    }

    log.info('[VTS] Connecting to ' + this.url)
    this.notifyStatus('Connecting')
    
    try {
      this.ws = new WebSocket(this.url)
      
      this.ws.on('open', () => {
        log.info('[VTS] WebSocket Connected')
        this.isConnected = true
        this.notifyStatus('Connected')
        // Start Auth Flow
        this.authenticate()
      })

      this.ws.on('close', (code, reason) => {
        log.warn(`[VTS] Disconnected: ${code} ${reason}`)
        this.cleanup()
        this.notifyStatus('Disconnected')
      })

      this.ws.on('error', (err) => {
        log.error('[VTS] Socket Error:', err)
        this.notifyStatus('Error')
        // Force cleanup on error to ensure we can retry
        this.cleanup()
      })

      this.ws.on('message', (data) => {
        try {
            const response = JSON.parse(data.toString())
            this.handleResponse(response)
        } catch (e) {
            log.error('[VTS] Failed to parse message:', e)
        }
      })

    } catch (e) {
      log.error('[VTS] Connection failed:', e)
      this.notifyStatus('Error')
      this.cleanup()
    }
  }

  public disconnect() {
    if (this.ws) {
      log.info('[VTS] Manual Disconnect')
      // Remove listeners to avoid "Disconnected" log spam if we closed it intentionally
      this.ws.removeAllListeners()
      this.ws.close()
      this.cleanup()
      this.notifyStatus('Disconnected')
    }
  }

  public getStatus() {
      if (this.isAuthenticated) return 'Authenticated'
      if (this.isConnected) return 'Connected'
      return 'Disconnected'
  }

  private cleanup() {
    this.ws = null
    this.isConnected = false
    this.isAuthenticated = false
  }

  private notifyStatus(status: string) {
    // Broadcast to all windows just in case
    BrowserWindow.getAllWindows().forEach(win => {
        if (!win.isDestroyed()) {
            win.webContents.send('vts-status', status)
        }
    })
  }

  private send(request: VTSRequest) {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.send(JSON.stringify(request))
      }
  }

  public triggerTestItem(show: boolean) {
      if (!this.isAuthenticated) {
          log.warn('[VTS] Cannot trigger item: Not authenticated')
          return
      }

      const fileName = 'beverage_Soda_Cola (@7MDigital).png'
      
      if (show) {
          log.info('[VTS] Loading test item: ' + fileName)
          this.send({
              apiName: 'VTubeStudioPublicAPI',
              apiVersion: '1.0',
              requestID: 'LoadItemRequest',
              messageType: 'ItemLoadRequest',
              data: {
                  fileName: fileName,
                  positionX: 0,
                  positionY: 0,
                  size: 0.3,
                  animation: true,
                  fadeTime: 0.5,
                  order: 10,
                  failIfOrderTaken: false,
                  smoothing: 0.2,
                  censored: false,
                  flipped: false,
                  locked: false,
                  unload: false
              }
          })
      } else {
          log.info('[VTS] Unloading test item: ' + fileName)
          // Unload by filename pattern (unloads all instances of this file)
          this.send({
              apiName: 'VTubeStudioPublicAPI',
              apiVersion: '1.0',
              requestID: 'UnloadItemRequest',
              messageType: 'ItemUnloadRequest',
              data: {
                  unloadAllInScene: false,
                  unloadAllLoadedByThisPlugin: false,
                  allowLoadingWhenUnloading: true,
                  fileNames: [fileName]
              }
          })
      }
  }

  private authenticate() {
      const token = store.get(VTS_TOKEN_KEY) as string
      if (token) {
          log.info('[VTS] Found existing token, attempting login...')
          this.send({
              apiName: 'VTubeStudioPublicAPI',
              apiVersion: '1.0',
              requestID: 'AuthenticationRequest',
              messageType: 'AuthenticationRequest',
              data: {
                  pluginName: this.pluginName,
                  pluginDeveloper: this.pluginDeveloper,
                  authenticationToken: token
              }
          })
      } else {
          log.info('[VTS] No token found, requesting new token...')
          this.send({
              apiName: 'VTubeStudioPublicAPI',
              apiVersion: '1.0',
              requestID: 'AuthenticationTokenRequest',
              messageType: 'AuthenticationTokenRequest',
              data: {
                  pluginName: this.pluginName,
                  pluginDeveloper: this.pluginDeveloper,
                  pluginIcon: '' // Optional
              }
          })
      }
  }

  private handleResponse(response: any) {
      const type = response.messageType
      const reqID = response.requestID

      if (type === 'AuthenticationTokenResponse') {
          if (response.data?.authenticationToken) {
              log.info('[VTS] Received new authentication token')
              store.set(VTS_TOKEN_KEY, response.data.authenticationToken)
              // Immediately use it
              this.authenticate()
          } else {
              log.warn('[VTS] Authentication token request denied or failed')
              this.notifyStatus('Auth Denied')
          }
      } else if (type === 'AuthenticationResponse') {
          if (response.data?.authenticated) {
              log.info('[VTS] Authentication Successful!')
              this.isAuthenticated = true
              this.notifyStatus('Authenticated')
          } else {
              log.warn('[VTS] Authentication Failed (Token invalid?)')
              store.delete(VTS_TOKEN_KEY) // Clear invalid token
              this.notifyStatus('Auth Failed')
              // Maybe retry getting a new token?
              // For now, let user manually retry to avoid loops
          }
      }
  }
}

export const vtsController = new VTSController()
