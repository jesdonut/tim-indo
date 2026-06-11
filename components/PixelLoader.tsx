"use client"

import { useEffect, useState } from "react"
import { getTeamData } from "@/app/actions/teams"

const FALLBACK_NAMES = ["Jessica", "Ben", "Dimas"]

const CHAR_MS   = 80
const PAUSE_MS  = 300
const FADE_WAIT = 600

export default function PixelLoader() {
  const [names, setNames] = useState<string[] | null>(null)
  const [revealed, setRevealed] = useState<number[]>([])
  const [done, setDone] = useState(false)
  const [fading, setFading] = useState(false)

  // Fetch real team member first names, fall back to hardcoded
  useEffect(() => {
    getTeamData().then(data => {
      if (data?.profiles?.length) {
        const firstNames = data.profiles.map(p =>
          (p.name ?? "").split(/\s+/)[0] || p.name || "?"
        )
        setNames(firstNames)
      } else {
        setNames(FALLBACK_NAMES)
      }
    }).catch(() => setNames(FALLBACK_NAMES))
  }, [])

  // Start typing animation once names are known
  useEffect(() => {
    if (!names) return
    setRevealed(names.map(() => 0))
    const timers: ReturnType<typeof setTimeout>[] = []
    let elapsed = 0

    names.forEach((name, ni) => {
      for (let c = 1; c <= name.length; c++) {
        const t = elapsed
        timers.push(setTimeout(() => {
          setRevealed(prev => prev.map((v, i) => i === ni ? c : v))
        }, t))
        elapsed += CHAR_MS
      }
      elapsed += PAUSE_MS
    })

    const total = elapsed
    timers.push(setTimeout(() => setDone(true), total))
    timers.push(setTimeout(() => setFading(true), total + FADE_WAIT))

    return () => timers.forEach(clearTimeout)
  }, [names])

  return (
    <div
      className="absolute inset-0 z-50 flex items-center justify-center bg-[var(--bg)] transition-opacity duration-500"
      style={{ opacity: fading ? 0 : 1, pointerEvents: fading ? "none" : "auto" }}
    >
      {names && (
        <div className="flex flex-col gap-3 select-none">
          {names.map((name, ni) => {
            const chars = revealed[ni] ?? 0
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
                  {isComplete && !done && ni === names.length - 1 && (
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
