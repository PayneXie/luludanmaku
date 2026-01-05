import WebSocket from 'ws'
import pako from 'pako'
import brotli from 'brotli'

export type WsInfo = {
  server: string
  room_id: number
  uid: number
  token: string
}

export type PackResult = {
  packetLen: number
  headerLen: number
  ver: number
  op: number
  seq: number
  body: any[]
}

export enum MessageOP {
  KEEP_ALIVE = 2,
  KEEP_ALIVE_REPLY = 3,
  SEND_MSG = 4,
  SEND_MSG_REPLY = 5,
  AUTH = 7,
  AUTH_REPLY = 8,
}

export enum WsBodyVer {
  NORMAL = 0,
  HEARTBEAT = 1,
  DEFLATE = 2,
  BROTLI = 3,
}

class BiliWsMessage {
  private _buffer: Uint8Array
  private _text_encoder: TextEncoder
  private _text_decoder: TextDecoder

  constructor(op?: number, str?: string) {
    this._text_encoder = new TextEncoder()
    this._text_decoder = new TextDecoder()
    if (!op) {
      this._buffer = new Uint8Array(0)
      return
    }
    const header = new Uint8Array([
      0, 0, 0, 0, 0, 16, 0, 1, 0, 0, 0, op, 0, 0, 0, 1,
    ])
    const data = this._text_encoder.encode(str || '')
    const packet_len = header.length + data.byteLength
    // Set data into buffer
    this._buffer = new Uint8Array(packet_len)
    this._buffer.set(header, 0)
    this._buffer.set(data, header.length)
    // Update packet_len in header
    this.writeInt(this._buffer, 0, 4, packet_len)
  }

  SetBuffer(buffer: Uint8Array) {
    this._buffer = buffer
    return this
  }

  GetBuffer() {
    return this._buffer
  }

  // ToPack decodes buffer into PackResult
  ToPack(): PackResult {
    const result: PackResult = {
      packetLen: 0,
      headerLen: 0,
      ver: 0,
      op: 0,
      seq: 0,
      body: [],
    }
    result.packetLen = this.readInt(this._buffer, 0, 4)
    result.headerLen = this.readInt(this._buffer, 4, 2)
    result.ver = this.readInt(this._buffer, 6, 2)
    result.op = this.readInt(this._buffer, 8, 4)
    result.seq = this.readInt(this._buffer, 12, 4)
    
    // Debug log for every packet
    if (result.op !== MessageOP.KEEP_ALIVE_REPLY) {
       console.log(`[Socket] Received Packet: op=${result.op}, ver=${result.ver}, len=${result.packetLen}`)
    }

    switch (result.op) {
      case MessageOP.AUTH_REPLY: {
        console.log('Received auth reply, Auth Success!')
        break
      }
      case MessageOP.KEEP_ALIVE_REPLY: {
        console.log('Received keepalive reply')
        result.body = [
          {
            count: this.readInt(this._buffer, 16, 4),
          },
        ]
        break
      }
      case MessageOP.SEND_MSG_REPLY: {
        result.body = []
        switch (result.ver) {
          case WsBodyVer.NORMAL: {
            const data = this._buffer.slice(result.headerLen, result.packetLen)
            const body = this._text_decoder.decode(data)
            try {
              const jsonBody = JSON.parse(body)
              console.log('[Socket] Normal Body:', jsonBody.cmd)
              result.body.push(jsonBody)
            } catch (e) {
              console.error('JSON Parse error', e)
            }
            break
          }
          case WsBodyVer.DEFLATE: {
            try {
              const bufferSlice = this._buffer.slice(result.headerLen, result.packetLen)
              // pako.inflate returns Uint8Array or string based on options, default is Uint8Array
              const next_buffer = pako.inflate(bufferSlice) as Uint8Array 
              console.log(`[Socket] Inflated size: ${next_buffer.length}`)
              result.body = this.parseDecompressed(next_buffer)
            } catch (e) {
               console.error('Deflate error', e)
            }
            break
          }
          case WsBodyVer.BROTLI: {
            try {
              const body_buffer = Buffer.from(
                this._buffer.slice(result.headerLen, result.packetLen)
              )
              const decompressed_body = brotli.decompress(
                body_buffer,
                result.packetLen
              )
              // console.log('Brotli decompressed size:', decompressed_body.length)
              result.body = this.parseDecompressed(decompressed_body)
            } catch (e) {
               console.error('Brotli error', e)
            }
            break
          }
          default: {
            console.error('Unknown message body ver', { ver: result.ver })
          }
        }
        break
      }
      default: {
        // console.error('Message op known', { op: result.op })
      }
    }
    return result
  }

  parseDecompressed(buffer: Uint8Array) {
    let bodys = []
    let offset = 0
    // Buffer might be a Node Buffer or Uint8Array, handle generic array-like
    const bufLen = buffer.length || buffer.byteLength
    
    while (offset < bufLen) {
      const packetLen = this.readInt(buffer, offset, 4)
      const headerLen = 16 
      // console.log(`Sub-packet: offset=${offset}, len=${packetLen}`) // Debug

      if (packetLen <= 0 || offset + packetLen > bufLen) {
        console.error(`[Socket] Invalid packet len: ${packetLen}, offset: ${offset}, total: ${bufLen}`)
        break
      }

      const data = buffer.slice(offset + headerLen, offset + packetLen)
      const body = this._text_decoder.decode(data)
      if (body) {
        try {
          const jsonBody = JSON.parse(body)
          console.log('[Socket] Decompressed CMD:', jsonBody.cmd) // Debug log cmd
          bodys.push(jsonBody)
        } catch (e) {
          // ignore
          console.error('[Socket] JSON parse failed for body chunk', e)
        }
      }
      offset += packetLen
    }
    return bodys
  }

  readInt(buffer: Uint8Array, start: number, len: number) {
    let result = 0
    for (let i = len - 1; i >= 0; i--) {
      result += Math.pow(256, len - i - 1) * buffer[start + i]
    }
    return result
  }

  writeInt(buffer: Uint8Array, start: number, len: number, value: number) {
    let i = 0
    while (i < len) {
      buffer[start + i] = value / Math.pow(256, len - i - 1)
      i++
    }
  }
}

export class BiliWebSocket {
  private _ws_info: WsInfo
  public ws: BiliInternalWebSocket
  private _is_manual_close: boolean

  constructor(ws_info: WsInfo, onMessage: (packet: PackResult) => void) {
    this._ws_info = ws_info
    this.ws = new BiliInternalWebSocket(this._ws_info)
    this.ws.close_handler = this.reconnect.bind(this)
    this.ws.msg_handler = onMessage
    this._is_manual_close = false
  }

  Connect() {
    this._is_manual_close = false
    this.ws.Connect()
  }

  Disconnect() {
    this._is_manual_close = true
    this.ws.Disconnect()
  }

  reconnect() {
    if (this._is_manual_close) {
      return
    }
    setTimeout(() => {
      if (this._is_manual_close) {
        return
      }
      console.log('Reconnecting to room websocket')
      this.Connect()
    }, 5000)
  }
}

class BiliInternalWebSocket {
  private _ws_info: WsInfo
  private _ws: WebSocket | null
  private _heartbeat_task: any // NodeJS.Timeout
  public msg_handler: ((packet: PackResult) => void) | null
  public close_handler: (() => void) | null

  constructor(ws_info: WsInfo) {
    this._ws_info = ws_info
    this._ws = null
    this._heartbeat_task = null
    this.msg_handler = null
    this.close_handler = null
  }

  Connect() {
    console.log('Connecting to room websocket', this._ws_info.room_id)
    console.log('Server URL:', this._ws_info.server) // Debug
    this.Disconnect()

    this._ws = new WebSocket(this._ws_info.server)
    
    this._ws.on('open', () => {
      // Prepare auth info
      const auth_info = {
        uid: Number(this._ws_info.uid),
        roomid: Number(this._ws_info.room_id),
        protover: 2, // 3 for brotli, 2 for deflate
        type: 2,
        platform: 'web',
        key: this._ws_info.token,
      }
      const auth_msg = new BiliWsMessage(
        MessageOP.AUTH,
        JSON.stringify(auth_info)
      )
      this._ws!.send(auth_msg.GetBuffer())

      // Setup task for heart beating
      const heart_msg = new BiliWsMessage(MessageOP.KEEP_ALIVE, '')
      const heartBuffer = heart_msg.GetBuffer()
      this._ws!.send(heartBuffer)
      console.log('[Socket] Initial Heartbeat sent')

      this._heartbeat_task = setInterval(() => {
        if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
          return
        }
        this._ws.send(heartBuffer)
        console.log('[Socket] Heartbeat sent')
      }, 30 * 1000)
    })

    this._ws.on('message', (data: any) => {
      const msg = new BiliWsMessage().SetBuffer(new Uint8Array(data))
      if (this.msg_handler) {
        this.msg_handler(msg.ToPack())
      }
    })

    this._ws.on('close', () => {
      console.log('Websocket closed')
      if (this._heartbeat_task) {
        clearInterval(this._heartbeat_task)
        this._heartbeat_task = null
      }
      if (this.close_handler) {
        this.close_handler()
      }
    })
    
    this._ws.on('error', (err: Error) => {
      console.error('Websocket error', err)
    })
  }

  Disconnect() {
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }
    if (this._heartbeat_task) {
      clearInterval(this._heartbeat_task)
      this._heartbeat_task = null
    }
  }
}
