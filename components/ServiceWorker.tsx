'use client'
import { useEffect } from 'react'

export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    // In development the SW caches build chunks whose names change on every
    // edit, so it ends up serving dead files → ChunkLoadError → reload loop.
    // Unregister it (and drop its caches) instead of registering.
    if (process.env.NODE_ENV !== 'production') {
      navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister()))
      if ('caches' in window) caches.keys().then(ks => ks.forEach(k => caches.delete(k)))
      return
    }

    navigator.serviceWorker.register('/sw.js')
  }, [])
  return null
}
