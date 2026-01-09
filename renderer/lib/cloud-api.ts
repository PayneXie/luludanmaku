export const API_HOST = 'https://live-worker.shizukululu.cn'
// export const API_HOST = 'http://localhost:3000'

export interface PaginationQuery {
  start?: number
  end?: number
  order?: string
  limit?: number
  offset?: number
}

export interface GiftsQuery extends PaginationQuery {
  minPrice?: number
}

export interface GiftsAndSubsQuery extends GiftsQuery {}

export interface ScItem {
  id: string
  uid: number
  uname: string
  price: number
  message: string
  timestamp: number
  [key: string]: any
}

export interface GiftItem {
  tid: string
  uid: number
  uname: string
  giftName: string
  price: number
  num: number
  timestamp: number
  [key: string]: any
}

export interface SubItem {
  id: string
  uid: number
  username: string
  guard_level: number
  price: number
  start_time: number
  num: number
  unit: string
  [key: string]: any
}

export type ScsResponse = ScItem[]
export type GiftsResponse = GiftItem[]
export type SubsResponse = SubItem[]
export type GiftsAndSubsResponse = {
  gifts: GiftItem[]
  subs: SubItem[]
}

export type FetchListParams = Partial<Omit<PaginationQuery, 'start' | 'end'>> & {
  start?: number
  end?: number
}

export type FetchGiftsParams = Partial<Omit<GiftsQuery, 'start' | 'end'>> & {
  start?: number
  end?: number
}

export type FetchGiftsAndSubsParams = Partial<Omit<GiftsAndSubsQuery, 'start' | 'end'>> & {
  start?: number
  end?: number
}

const buildQueryString = (params: FetchListParams): string => {
  const searchParams = new URLSearchParams()
  if (params.start !== undefined) searchParams.set('start', String(params.start))
  if (params.end !== undefined) searchParams.set('end', String(params.end))
  if (params.order) searchParams.set('order', params.order)
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit))
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset))
  return searchParams.toString()
}

const buildGiftsQueryString = (params: FetchGiftsParams): string => {
  const searchParams = new URLSearchParams()
  if (params.start !== undefined) searchParams.set('start', String(params.start))
  if (params.end !== undefined) searchParams.set('end', String(params.end))
  if (params.order) searchParams.set('order', params.order)
  if (params.limit !== undefined) searchParams.set('limit', String(params.limit))
  if (params.offset !== undefined) searchParams.set('offset', String(params.offset))
  if (params.minPrice !== undefined) searchParams.set('minPrice', String(params.minPrice))
  return searchParams.toString()
}

const fetchWithProxy = async (url: string, options: RequestInit = {}, timeout = 10000) => {
  // Use IPC to call main process proxy
  // This bypasses CORS and other browser restrictions
  if (typeof window !== 'undefined' && (window as any).ipc) {
      // Add timeout for IPC call
      return Promise.race([
          (window as any).ipc.invoke('proxy-request', url, options),
          new Promise((_, reject) => setTimeout(() => reject(new Error('IPC Request Timeout')), timeout))
      ])
  }
  
  // Fallback for dev/browser (might fail due to CORS)
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), timeout)
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal
    })
    clearTimeout(id)
    if (!res.ok) {
        throw new Error(`Failed to fetch: ${res.status}`)
    }
    return res.json()
  } catch (error) {
    clearTimeout(id)
    throw error
  }
}

export const fetchGifts = async (params: FetchGiftsParams = {}): Promise<GiftsResponse> => {
  const query = buildGiftsQueryString(params)
  const result = await fetchWithProxy(`${API_HOST}/api/gifts${query ? `?${query}` : ''}`)
  // Extract data array if response is wrapped in { data: [...] }
  return Array.isArray(result) ? result : (result.data || [])
}

export const fetchScs = async (params: FetchListParams = {}): Promise<ScsResponse> => {
  const query = buildQueryString(params)
  const result = await fetchWithProxy(`${API_HOST}/api/scs${query ? `?${query}` : ''}`)
  return Array.isArray(result) ? result : (result.data || [])
}

export const fetchSubs = async (params: FetchListParams = {}): Promise<SubsResponse> => {
  const query = buildQueryString(params)
  const result = await fetchWithProxy(`${API_HOST}/api/subs${query ? `?${query}` : ''}`)
  return Array.isArray(result) ? result : (result.data || [])
}

export const fetchGiftsAndSubs = async (params: FetchGiftsAndSubsParams = {}): Promise<GiftsAndSubsResponse> => {
  const query = buildGiftsQueryString(params)
  const result = await fetchWithProxy(`${API_HOST}/api/giftsAndSubs${query ? `?${query}` : ''}`)
  return result
}
