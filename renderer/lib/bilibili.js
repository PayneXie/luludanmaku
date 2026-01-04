
export const QrCodeStatus = {
  NeedScan: 0,
  NeedConfirm: 1,
  Success: 2,
}

/**
 * Get a new QR Code for Bilibili login
 * @returns {Promise<{url: string, oauthKey: string}>}
 */
export async function getQrCode() {
  const res = await window.ipc.invoke('bilibili-get-qrcode')
  if (!res.success) throw new Error(res.error)
  return res.data
}

/**
 * Check the status of the QR Code
 * @param {string} oauthKey
 * @returns {Promise<{status: number, cookies?: object}>}
 */
export async function checkQrCode(oauthKey) {
  const res = await window.ipc.invoke('bilibili-check-qrcode', oauthKey)
  if (!res.success) throw new Error(res.error)
  return res.data
}

/**
 * Get Danmu Info (Token and Server List)
 * @param {object} cookies
 * @param {number} roomId
 * @returns {Promise<object>}
 */
export async function getDanmuInfo(cookies, roomId) {
  const res = await window.ipc.invoke('bilibili-get-danmu-info', { cookies, roomId })
  if (!res.success) throw new Error(res.error)
  return res.data
}

/**
 * Get Gift Configuration (Price map)
 * @param {number} roomId
 * @returns {Promise<object>}
 */
export async function getGiftConfig(roomId) {
  const res = await window.ipc.invoke('bilibili-get-gift-config', { roomId })
  if (!res.success) throw new Error(res.error)
  return res.data
}
