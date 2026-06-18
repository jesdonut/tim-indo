"use client"

import { useEffect, useState } from "react"
import { PageHeader, PageContent } from "@/components/PageHeader"
import PixelLoader from "@/components/PixelLoader"

export default function DispatchPage() {
  const [loading, setLoading] = useState(true)
  useEffect(() => { setLoading(false) }, [])

  return (
    <div className="relative flex flex-col h-[calc(100dvh-48px)]">
      {loading && <PixelLoader />}
      <PageHeader title="送り込みシート" />
      <PageContent>
        <p className="text-sm text-[var(--text-3)]">Coming soon.</p>
      </PageContent>
    </div>
  )
}
