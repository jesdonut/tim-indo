"use client"

import { useEffect, useRef, useState } from "react"
import { getTeamData } from "@/app/actions/teams"

const FALLBACK_NAMES = ["Jessica", "Ben", "Dimas"]
const CACHE_KEY = "pixelloader_names"

const CHAR_MS   = 80
const CHAR_FAST = 18   // speed used when data is already ready
const PAUSE_MS  = 300
const FADE_WAIT = 400

function readCache(): string[] | null {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) ?? "null") } catch { return null }
}
function writeCache(names: string[]) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(names)) } catch {}
}

// ready = data has finished loading. When false, the loader waits after
// the animation completes. When it flips to true mid-animation, the
// remaining characters are typed at CHAR_FAST so it finishes quickly.
export default function PixelLoader({ ready = true }: { ready?: boolean }) {
  const [names, setNames]     = useState<string[] | null>(null)
  const [revealed, setRevealed] = useState<number[]>([])
  const [animDone, setAnimDone] = useState(false)
  const [fading, setFading]   = useState(false)
  const [speedup, setSpeedup] = useState(false)
  const revealedRef = useRef<number[]>([])
  const timersRef   = useRef<ReturnType<typeof setTimeout>[]>([])

  useEffect(() => {
    // Start animation immediately with cached names (instant on repeat visits)
    const cached = readCache()
    if (cached) setNames(cached)

    // Fetch fresh in background; update + re-cache if the list changed
    getTeamData().then(data => {
      const fresh = data?.profiles?.length
        ? data.profiles.map(p => (p.name ?? "").split(/\s+/)[0] || p.name || "?")
        : FALLBACK_NAMES
      writeCache(fresh)
      setNames(prev =>
        JSON.stringify(prev) === JSON.stringify(fresh) ? prev : fresh
      )
    }).catch(() => setNames(prev => prev ?? FALLBACK_NAMES))
  }, [])

  // Kick off (or redo) the typing animation whenever names load or speedup toggles
  useEffect(() => {
    if (!names) return

    // Cancel any pending timers from a previous run
    timersRef.current.forEach(clearTimeout)
    timersRef.current = []

    const charMs = speedup ? CHAR_FAST : CHAR_MS

    // On speedup, continue from where we left off; on first run, start fresh
    const startFrom = speedup ? revealedRef.current : names.map(() => 0)
    if (!speedup) {
      setRevealed(names.map(() => 0))
      revealedRef.current = names.map(() => 0)
    }
    setAnimDone(false)

    let elapsed = 0
    names.forEach((name, ni) => {
      const from = startFrom[ni] ?? 0
      for (let c = from + 1; c <= name.length; c++) {
        const t = elapsed
        timersRef.current.push(setTimeout(() => {
          setRevealed(prev => {
            const next = prev.map((v, i) => i === ni ? c : v)
            revealedRef.current = next
            return next
          })
        }, t))
        elapsed += charMs
      }
      elapsed += speedup ? 60 : PAUSE_MS
    })

    timersRef.current.push(setTimeout(() => setAnimDone(true), elapsed))

    return () => timersRef.current.forEach(clearTimeout)
  }, [names, speedup])

  // When data becomes ready mid-animation → speed up; when both done → fade
  useEffect(() => {
    if (!ready) return
    if (!animDone) {
      setSpeedup(true)
    } else {
      const t = setTimeout(() => setFading(true), FADE_WAIT)
      return () => clearTimeout(t)
    }
  }, [ready, animDone])

  // Also trigger fade when animation finishes and data is already ready
  useEffect(() => {
    if (animDone && ready) {
      const t = setTimeout(() => setFading(true), FADE_WAIT)
      return () => clearTimeout(t)
    }
  }, [animDone, ready])

  // Hard timeout: if ready never fires (e.g. server action fails), force fade after 8s
  useEffect(() => {
    const t = setTimeout(() => setFading(true), 8000)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg)] transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      {names && (
        <div className="flex flex-col gap-3 select-none">
          {names.map((name, ni) => {
            const chars      = revealed[ni] ?? 0
            const isActive   = chars > 0 && chars < name.length
            const isComplete = chars === name.length
            return (
              <div key={ni} className="flex items-center gap-2.5">
                <div
                  className="w-1.5 h-1.5 rounded-none transition-all duration-300"
                  style={{
                    background: isComplete ? "var(--highlight)" : isActive ? "var(--text-3)" : "var(--border)",
                  }}
                />
                <span
                  className="font-mono transition-all duration-200"
                  style={{
                    fontSize: "0.78rem",
                    letterSpacing: "0.18em",
                    color: isComplete ? "var(--text)" : "var(--text-3)",
                  }}
                >
                  {name.slice(0, chars).toUpperCase()}
                  {isActive && (
                    <span
                      className="inline-block w-[0.55em] h-[0.85em] ml-0.5 align-middle"
                      style={{ background: "var(--highlight)", animation: "pixel-blink 0.7s step-end infinite" }}
                    />
                  )}
                  {isComplete && !animDone && ni === names.length - 1 && (
                    <span
                      className="inline-block w-[0.55em] h-[0.85em] ml-0.5 align-middle"
                      style={{ background: "var(--highlight)" }}
                    />
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <style>{`
        @keyframes pixel-blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  )
}
