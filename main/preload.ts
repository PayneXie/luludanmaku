import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron'

const handler = {
  send(channel: string, value: any) {
    ipcRenderer.send(channel, value)
  },
  invoke(channel: string, value: any) {
    return ipcRenderer.invoke(channel, value)
  },
  on(channel: string, callback: (event: IpcRendererEvent, ...args: any[]) => void) {
    const subscription = (_event: IpcRendererEvent, ...args: any[]) => callback(_event, ...args)
    ipcRenderer.on(channel, subscription)

    return () => {
      ipcRenderer.removeListener(channel, subscription)
    }
  },
  removeAllListeners(channel: string) {
    ipcRenderer.removeAllListeners(channel)
  },
}

contextBridge.exposeInMainWorld('ipc', handler)

export type IpcHandler = typeof handler
