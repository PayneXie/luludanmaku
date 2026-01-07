import { useState, useEffect } from 'react'

const DEFAULT_FACE = 'https://i0.hdslb.com/bfs/face/member/noface.jpg'

/**
 * Hook to handle user face loading and fallback.
 * It also tries to fetch the real face from backend if the current one is default.
 * 
 * @param initialFace The face url from props
 * @param uid The user ID
 * @returns {string} The resolved face url
 */
export function useUserFace(initialFace, uid) {
  const [currentFace, setCurrentFace] = useState(initialFace || DEFAULT_FACE)

  // Reset when props change
  useEffect(() => {
    setCurrentFace(initialFace || DEFAULT_FACE)
  }, [initialFace])

  // Fetch from backend if default
  useEffect(() => {
    const isDefault = !currentFace || currentFace.includes('noface.jpg')
    
    if (isDefault && uid && window.electron) {
      let isMounted = true
      
      // Invoke IPC to fetch face (cached in backend)
      window.electron.ipcRenderer.invoke('fetch-user-face', uid)
        .then(realFace => {
          if (isMounted && realFace && realFace !== currentFace) {
            setCurrentFace(realFace)
          }
        })
        .catch(err => {
          // console.warn('Failed to fetch user face', err)
        })

      return () => { isMounted = false }
    }
  }, [uid, currentFace])

  return currentFace
}
