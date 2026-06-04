"use client"

import { createContext, useContext, useEffect, useState } from "react"

type Theme = "dark" | "light"
type Highlight = "lime" | "pink" | "purple"

const HIGHLIGHTS: Highlight[] = ["lime", "pink", "purple"]

const ThemeContext = createContext<{
  theme: Theme
  highlight: Highlight
  toggle: () => void
  setHighlight: (h: Highlight) => void
}>({ theme: "dark", highlight: "lime", toggle: () => {}, setHighlight: () => {} })

function applyHighlight(h: Highlight) {
  document.documentElement.classList.remove(...HIGHLIGHTS.map(x => `highlight-${x}`))
  document.documentElement.classList.add(`highlight-${h}`)
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>("dark")
  const [highlight, setHighlightState] = useState<Highlight>("lime")

  useEffect(() => {
    const savedTheme = localStorage.getItem("theme") as Theme | null
    const preferred = savedTheme ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light")
    setTheme(preferred)
    document.documentElement.classList.toggle("dark", preferred === "dark")

    const savedHighlight = localStorage.getItem("highlight") as Highlight | null
    const h = savedHighlight ?? "lime"
    setHighlightState(h)
    applyHighlight(h)
  }, [])

  function toggle() {
    setTheme(prev => {
      const next = prev === "dark" ? "light" : "dark"
      localStorage.setItem("theme", next)
      document.documentElement.classList.toggle("dark", next === "dark")
      return next
    })
  }

  function setHighlight(h: Highlight) {
    localStorage.setItem("highlight", h)
    setHighlightState(h)
    applyHighlight(h)
  }

  return (
    <ThemeContext.Provider value={{ theme, highlight, toggle, setHighlight }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
