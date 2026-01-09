import mysql from 'mysql2/promise'
import fs from 'fs-extra'
import path from 'path'
import { app } from 'electron'

interface DbConfig {
  host: string
  port: number
  user: string
  password?: string
  database: string
  connectionLimit?: number
}

interface AvatarRecord {
  uid: number
  avatar_url: string
  update_time: Date
}

export class AvatarDatabase {
  private pool: mysql.Pool | null = null
  private pendingWrites: Map<number, string> = new Map()
  private flushInterval: NodeJS.Timeout | null = null
  private isConnected: boolean = false
  private configPath: string
  
  // Circuit Breaker & Performance Control
  private isHealthy: boolean = true
  private consecutiveErrors: number = 0
  private recoveryTime: number = 0
  private readonly QUERY_TIMEOUT = 100 // 100ms max for DB read
  private readonly ERROR_THRESHOLD = 5 // Stop querying after 5 consecutive errors
  private readonly RECOVERY_COOLDOWN = 30000 // Retry after 30 seconds

  constructor() {
    // Determine config path (UserData in prod, local in dev)
    if (process.env.NODE_ENV === 'production') {
       this.configPath = path.join(app.getPath('userData'), 'db_config.json')
    } else {
       this.configPath = path.join(process.cwd(), 'main/db_config.json')
    }
  }

  public async init() {
    try {
      if (!fs.existsSync(this.configPath)) {
        console.warn('[DB] Config file not found, skipping DB init')
        return
      }

      let config: any = await fs.readJson(this.configPath)
      
      // Support nested "mysql" key if present (Adapting to user's config format)
      if (config.mysql) {
          config = config.mysql
      }

      this.pool = mysql.createPool({
        host: config.host,
        port: Number(config.port) || 3306, // Ensure port is number
        user: config.user,
        password: config.password,
        database: config.database,
        waitForConnections: true,
        connectionLimit: 5, // Limit connections to avoid resource hogging
        queueLimit: 0,
        connectTimeout: 2000 // Fast fail on connection
      })

      // Test connection with timeout
      await this.withTimeout(this.pool.getConnection(), 2000)
      console.log('[DB] Connected to MySQL')
      
      // Init Table (Fire and forget init if connection worked, or await it fast)
      const connection = await this.pool.getConnection()
      await connection.query(`
        CREATE TABLE IF NOT EXISTS avatar_cache (
          uid BIGINT PRIMARY KEY,
          avatar_url VARCHAR(512) NOT NULL,
          update_time DATETIME NOT NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
      `)
      
      connection.release()
      this.isConnected = true
      this.isHealthy = true

      // Start Flush Timer (Every 10 seconds)
      this.flushInterval = setInterval(() => this.flush(), 10000)

    } catch (error: any) {
      console.error('[DB] Failed to initialize database (will run without DB):', error.message)
      this.isConnected = false
    }
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) => 
            setTimeout(() => reject(new Error('DB_TIMEOUT')), ms)
        )
    ])
  }

  public async get(uid: number): Promise<string | null> {
    // 1. Fast Checks
    if (!this.isConnected || !this.pool) return null
    
    // 2. Circuit Breaker Check
    if (!this.isHealthy) {
        if (Date.now() > this.recoveryTime) {
            // Try to recover (allow one request through)
            // We don't set isHealthy=true yet, we wait for success
        } else {
            return null // Fail fast
        }
    }

    // 3. L1.5 Cache (Memory Pending)
    if (this.pendingWrites.has(uid)) {
      return this.pendingWrites.get(uid)!
    }

    try {
      // 4. Query with strict timeout
      // We explicitly cast the result to any to access rows safely
      const result = await this.withTimeout(
        this.pool.execute('SELECT avatar_url FROM avatar_cache WHERE uid = ?', [uid]),
        this.QUERY_TIMEOUT
      )
      
      // Reset breaker on success
      if (!this.isHealthy) {
          this.isHealthy = true
          this.consecutiveErrors = 0
          console.log('[DB] Recovered and healthy')
      }

      const rows = result[0] as any[]
      if (rows.length > 0) {
        return rows[0].avatar_url
      }
    } catch (e: any) {
      this.handleError(e)
    }
    return null
  }

  private handleError(e: any) {
      this.consecutiveErrors++
      
      // Log only occasional errors to avoid spam
      if (this.consecutiveErrors === 1 || this.consecutiveErrors % 10 === 0) {
          console.warn(`[DB] Error/Timeout (${this.consecutiveErrors}): ${e.message}`)
      }

      // Trip Circuit Breaker
      if (this.isHealthy && this.consecutiveErrors >= this.ERROR_THRESHOLD) {
          this.isHealthy = false
          this.recoveryTime = Date.now() + this.RECOVERY_COOLDOWN
          console.error(`[DB] Circuit Breaker Tripped! DB disabled for ${this.RECOVERY_COOLDOWN}ms`)
      }
  }

  public put(uid: number, url: string) {
    // Allow writes even if unhealthy? 
    // Maybe better to accumulate them, hoping DB comes back.
    // But limit size to avoid OOM.
    if (!this.isConnected) return
    
    this.pendingWrites.set(uid, url)
    
    // If pending grows too large, force flush or drop
    if (this.pendingWrites.size > 2000) {
        if (this.isHealthy) {
            this.flush()
        } else {
            // If DB is down and buffer full, we must drop data to save memory
            // Clear half of the buffer? Or just clear all.
            // Simple strategy: Clear all. It's just a cache.
            console.warn('[DB] Buffer full and DB down. Dropping pending writes.')
            this.pendingWrites.clear()
        }
    }
  }

  private async flush() {
    if (!this.isConnected || !this.pool || this.pendingWrites.size === 0) return
    
    // If unhealthy, try a "ping" or just skip flushing this round?
    // Let's try to flush. If it fails, it will update breaker.
    if (!this.isHealthy && Date.now() < this.recoveryTime) return

    const batch = new Map(this.pendingWrites)
    this.pendingWrites.clear()
    
    const entries = Array.from(batch.entries())
    if (entries.length === 0) return

    // console.log(`[DB] Flushing ${entries.length} avatars...`)

    try {
      const connection = await this.pool.getConnection()
      try {
        const values: any[] = []
        const placeholders: string[] = []
        
        entries.forEach(([uid, url]) => {
            placeholders.push('(?, ?, NOW())')
            values.push(uid, url)
        })

        const query = `
          INSERT INTO avatar_cache (uid, avatar_url, update_time)
          VALUES ${placeholders.join(', ')}
          ON DUPLICATE KEY UPDATE 
            avatar_url = VALUES(avatar_url),
            update_time = VALUES(update_time)
        `
        
        // Give flush more time (3s), but still timeout
        await this.withTimeout(connection.execute(query, values), 3000)
        
        // Success implies health
        if (!this.isHealthy) {
            this.isHealthy = true
            this.consecutiveErrors = 0
            console.log('[DB] Flush successful, DB recovered')
        }

      } finally {
        connection.release()
      }
    } catch (e: any) {
      console.error('[DB] Flush failed:', e.message)
      this.handleError(e)
      // We lost this batch. That's acceptable for a cache.
    }
  }

  public async close() {
    if (this.flushInterval) clearInterval(this.flushInterval)
    if (this.pool) await this.pool.end()
  }
}

export const avatarDb = new AvatarDatabase()
