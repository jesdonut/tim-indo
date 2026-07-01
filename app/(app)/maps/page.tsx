"use client"

import { useEffect, useState, useTransition } from "react"
import { getWorkers, type Worker } from "@/app/actions/workers"
import { geocodeAddress, fetchNearbyTransit, type Station, type BusStop } from "@/app/actions/maps"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent } from "@/components/PageHeader"

// ── URL builders ────────────────────────────────────────────────────────────

function googleMapsUrl(origin: string, dest: string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=transit`
}
function yahooTransitUrl(origin: string, dest: string) {
  return `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(dest)}`
}

// ── Worker search dropdown ────────────────────────────────────────────────────

function WorkerSearch({ workers, onPick }: { workers: Worker[]; onPick: (w: Worker) => void }) {
  const [search, setSearch] = useState("")
  const [open, setOpen] = useState(false)
  const [picked, setPicked] = useState<Worker | null>(null)

  const filtered = search.trim()
    ? workers.filter(w => {
        const q = search.toLowerCase()
        return (
          (w.worker_id ?? "").toLowerCase().includes(q) ||
          (w.name_latin ?? "").toLowerCase().includes(q) ||
          (w.name_kana ?? "").toLowerCase().includes(q)
        )
      }).slice(0, 8)
    : []

  function pick(w: Worker) {
    setPicked(w)
    setSearch(w.name_latin ?? w.name_kana ?? w.worker_id ?? "")
    setOpen(false)
    onPick(w)
  }

  return (
    <div className="relative">
      <input
        className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors"
        placeholder="Search worker by name or ID…"
        value={search}
        onChange={e => { setSearch(e.target.value); setOpen(true); setPicked(null) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {picked && (
        <button
          onClick={() => { setPicked(null); setSearch("") }}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] hover:text-[var(--text)] text-xs"
        >✕</button>
      )}
      {open && filtered.length > 0 && (
        <div className="absolute z-20 top-full mt-1 w-full bg-[var(--bg)] border border-[var(--border)] rounded shadow-lg overflow-hidden">
          {filtered.map(w => (
            <button
              key={w.id}
              onMouseDown={() => pick(w)}
              className="w-full text-left px-3 py-2 flex items-center gap-3 hover:bg-[var(--bg-2)] transition-colors"
            >
              <span className="text-[0.65rem] font-mono text-[var(--text-3)] w-8 shrink-0">{w.worker_id ?? "—"}</span>
              <div className="min-w-0 flex-1">
                <div className="text-sm text-[var(--text)] truncate">{w.name_latin ?? w.name_kana ?? "—"}</div>
                <div className="text-[0.65rem] text-[var(--text-3)] flex gap-2">
                  <span className="truncate">{w.store_name ?? ""}</span>
                  {!w.housing_address && <span className="text-amber-400 shrink-0">no home addr</span>}
                  {!w.store_address && <span className="text-amber-400 shrink-0">no work addr</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Nearby transit section ────────────────────────────────────────────────────

type NearbyState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; stations: Station[]; busStops: BusStop[] }

function NearbySection({ label, address }: { label: string; address: string }) {
  const [state, setState] = useState<NearbyState>({ status: "idle" })
  const [, startTransition] = useTransition()

  useEffect(() => {
    if (!address.trim()) { setState({ status: "idle" }); return }
    setState({ status: "loading" })
    startTransition(async () => {
      const coords = await geocodeAddress(address)
      if (!coords) {
        setState({ status: "error", message: "Address not found — try adding the full address with prefecture" })
        return
      }
      const { stations, busStops } = await fetchNearbyTransit(coords.lat, coords.lon)
      setState({ status: "done", stations, busStops })
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address])

  return (
    <div className="flex flex-col gap-3">
      <p className="label-xs">{label}</p>

      {state.status === "idle" && (
        <p className="text-[0.75rem] text-[var(--text-3)]">Load a worker or enter an address to see nearby transit.</p>
      )}
      {state.status === "loading" && (
        <p className="text-[0.75rem] text-[var(--text-3)] animate-pulse">Looking up…</p>
      )}
      {state.status === "error" && (
        <p className="text-[0.75rem] text-amber-400">{state.message}</p>
      )}
      {state.status === "done" && (
        <>
          <div className="flex flex-col gap-1">
            {state.stations.length === 0 ? (
              <p className="text-[0.75rem] text-[var(--text-3)]">No stations found nearby.</p>
            ) : state.stations.slice(0, 4).map((s, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-2)] gap-3">
                <div className="min-w-0">
                  <span className="text-sm text-[var(--text)] font-medium">{s.name}駅</span>
                  <span className="ml-2 text-[0.68rem] text-[var(--text-3)]">{s.line}</span>
                </div>
                <span className="text-[0.7rem] text-[var(--text-3)] shrink-0">{s.distance}</span>
              </div>
            ))}
          </div>

          {state.busStops.length > 0 && (
            <div className="flex flex-col gap-1">
              <p className="label-xs mt-1">Bus stops <span className="text-[var(--text-3)] font-normal normal-case">(600m)</span></p>
              {state.busStops.slice(0, 4).map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-2)]">
                  <span className="text-sm text-[var(--text)]">{b.name}</span>
                  <span className="text-[0.7rem] text-[var(--text-3)]">{b.distanceM}m</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function MapsPage() {
  const [workers, setWorkers] = useState<Worker[]>([])
  const [origin, setOrigin] = useState("")
  const [dest, setDest] = useState("")

  useEffect(() => { getWorkers().then(setWorkers) }, [])

  function handleWorkerPick(w: Worker) {
    setOrigin(w.housing_address ?? "")
    setDest(w.store_address ?? "")
  }

  const routeReady = origin.trim() && dest.trim()

  return (
    <>
      <PageHeader title="Maps" />
      <PageContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-8">

          {/* LEFT — route lookup */}
          <div className="flex flex-col gap-5">
            <div>
              <p className="label-xs mb-2">Load from worker</p>
              <WorkerSearch workers={workers} onPick={handleWorkerPick} />
            </div>

            <div className="flex flex-col gap-3">
              <div>
                <p className="label-xs mb-1.5">From (home)</p>
                <input
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors"
                  placeholder="住所を入力…"
                  value={origin}
                  onChange={e => setOrigin(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 border-t border-dashed border-[var(--border)]" />
                <span className="text-[0.7rem] text-[var(--text-3)]">↓</span>
                <div className="flex-1 border-t border-dashed border-[var(--border)]" />
              </div>

              <div>
                <p className="label-xs mb-1.5">To (workplace)</p>
                <input
                  className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors"
                  placeholder="店舗住所を入力…"
                  value={dest}
                  onChange={e => setDest(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <a
                href={routeReady ? googleMapsUrl(origin, dest) : undefined}
                target="_blank" rel="noopener noreferrer"
                className={cn(
                  "flex-1 text-center px-4 py-2.5 rounded text-[0.8rem] font-medium transition-all",
                  routeReady ? "bg-[var(--text)] text-[var(--bg)] hover:opacity-80" : "bg-[var(--bg-2)] text-[var(--text-3)] pointer-events-none"
                )}
              >
                Google Maps
              </a>
              <a
                href={routeReady ? yahooTransitUrl(origin, dest) : undefined}
                target="_blank" rel="noopener noreferrer"
                className={cn(
                  "flex-1 text-center px-4 py-2.5 rounded text-[0.8rem] font-medium transition-all border",
                  routeReady ? "border-[var(--border)] text-[var(--text)] hover:bg-[var(--bg-2)]" : "border-[var(--border)] text-[var(--text-3)] pointer-events-none"
                )}
              >
                Yahoo Transit
              </a>
            </div>

          </div>

          {/* RIGHT — nearest transit (auto from worker) */}
          <div className="md:border-l md:border-[var(--border)] md:pl-10 flex flex-col gap-7">
            <NearbySection label="Nearest to home 自宅" address={origin} />
            <div className="border-t border-[var(--border-soft)]" />
            <NearbySection label="Nearest to workplace 職場" address={dest} />
          </div>

        </div>
      </PageContent>
    </>
  )
}
