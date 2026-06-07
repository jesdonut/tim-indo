"use client"

import { useEffect } from "react"

export default function NoRightClick() {
  useEffect(() => {
    const block = (e: MouseEvent) => e.preventDefault()
    document.addEventListener("contextmenu", block)
    return () => document.removeEventListener("contextmenu", block)
  }, [])
  return null
}
