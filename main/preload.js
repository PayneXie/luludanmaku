import { contextBridge, ipcRenderer } from 'electron'

const handler = {
  send(channel, value) {
    ipcRenderer.send(channel, value)
  },
  invoke(channel, value) {
    return ipcRenderer.invoke(channel, value)
  },
  on(channel, callback) {
    const subscription = (_event, ...args) => callback(_event, ...args)
    ipcRenderer.on(channel, subscription)

    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  removeAllListeners(channel) {
    ipcRenderer.removeAllListeners(channel)
  },
}

contextBridge.exposeInMainWorld('ipc', handler)
