"use client"

import { useEffect, useState } from "react"
import { getWorkers, type Worker } from "@/app/actions/workers"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent } from "@/components/PageHeader"

// ── URL builders ────────────────────────────────────────────────────────────

function googleMapsUrl(origin: string, dest: string) {
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=transit`
}
function yahooTransitUrl(origin: string, dest: string) {
  return `https://transit.yahoo.co.jp/search/result?from=${encodeURIComponent(origin)}&to=${encodeURIComponent(dest)}`
}

// ── Types ────────────────────────────────────────────────────────────────────

type Station = {
  name: string
  line: string
  distance: string
  prev: string
  next: string
  x: string
  y: string
}

type BusStop = {
  name: string
  distanceM: number
}

// ── Geocode address → {lat, lon} via Nominatim ───────────────────────────────

async function geocode(address: string): Promise<{ lat: number; lon: number } | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1`
  const res = await fetch(url, { headers: { "Accept-Language": "ja" } })
  const data = await res.json()
  if (!data[0]) return null
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
}

// ── Nearest train stations via HeartRails Express ────────────────────────────

async function fetchStations(lat: number, lon: number): Promise<Station[]> {
  const url = `https://express.heartrails.com/api/json?method=getStations&x=${lon}&y=${lat}`
  const res = await fetch(url)
  const data = await res.json()
  return (data?.response?.station ?? []) as Station[]
}

// ── Nearby bus stops via Overpass ────────────────────────────────────────────

async function fetchBusStops(lat: number, lon: number): Promise<BusStop[]> {
  const radius = 500
  const query = `[out:json];node["highway"="bus_stop"](around:${radius},${lat},${lon});out body 8;`
  const res = await fetch(`https://overpass-api.de/api/interpreter?data=${encodeURIComponent(query)}`)
  const data = await res.json()
  return (data?.elements ?? []).map((el: Record<string, unknown>) => {
    const tags = (el.tags ?? {}) as Record<string, string>
    const dlat = (el.lat as number) - lat
    const dlon = (el.lon as number) - lon
    const distanceM = Math.round(Math.sqrt(dlat * dlat + dlon * dlon) * 111000)
    return { name: tags["name"] ?? tags["name:ja"] ?? "Bus stop", distanceM }
  }).sort((a: BusStop, b: BusStop) => a.distanceM - b.distanceM)
}

// ── Worker search dropdown ────────────────────────────────────────────────────

function WorkerSearch({
  workers,
  onPick,
}: {
  workers: Worker[]
  onPick: (w: Worker) => void
}) {
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
              <div className="min-w-0">
                <div className="text-sm text-[var(--text)] truncate">{w.name_latin ?? w.name_kana ?? "—"}</div>
                <div className="text-[0.65rem] text-[var(--text-3)] truncate">{w.store_name ?? ""}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Nearby lookup panel ───────────────────────────────────────────────────────

function NearbyPanel() {
  const [address, setAddress] = useState("")
  const [loading, setLoading] = useState(false)
  const [stations, setStations] = useState<Station[] | null>(null)
  const [busStops, setBusStops] = useState<BusStop[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function lookup() {
    const q = address.trim()
    if (!q) return
    setLoading(true)
    setError(null)
    setStations(null)
    setBusStops(null)
    try {
      const coords = await geocode(q)
      if (!coords) { setError("Address not found. Try adding 日本 or a city name."); setLoading(false); return }
      const [st, bs] = await Promise.all([
        fetchStations(coords.lat, coords.lon),
        fetchBusStops(coords.lat, coords.lon),
      ])
      setStations(st)
      setBusStops(bs)
    } catch {
      setError("Lookup failed. Check your connection.")
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2">
        <input
          className="flex-1 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors"
          placeholder="住所または郵便番号…"
          value={address}
          onChange={e => setAddress(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookup()}
        />
        <button
          onClick={lookup}
          disabled={loading || !address.trim()}
          className="px-4 py-2 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-40"
        >
          {loading ? "…" : "Look up"}
        </button>
      </div>

      {error && <p className="text-[0.75rem] text-red-400">{error}</p>}

      {stations !== null && (
        <div>
          <p className="label-xs mb-2">Nearest train stations</p>
          {stations.length === 0 ? (
            <p className="text-[0.75rem] text-[var(--text-3)]">No stations found nearby.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {stations.slice(0, 6).map((s, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-2)] gap-3">
                  <div className="min-w-0">
                    <span className="text-sm text-[var(--text)] font-medium">{s.name}駅</span>
                    <span className="ml-2 text-[0.68rem] text-[var(--text-3)]">{s.line}</span>
                  </div>
                  <span className="text-[0.7rem] text-[var(--text-3)] shrink-0">{s.distance}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {busStops !== null && (
        <div>
          <p className="label-xs mb-2">Nearby bus stops <span className="text-[var(--text-3)] font-normal normal-case">(within 500m)</span></p>
          {busStops.length === 0 ? (
            <p className="text-[0.75rem] text-[var(--text-3)]">No bus stops found nearby.</p>
          ) : (
            <div className="flex flex-col gap-1">
              {busStops.map((b, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 rounded bg-[var(--bg-2)]">
                  <span className="text-sm text-[var(--text)]">{b.name}</span>
                  <span className="text-[0.7rem] text-[var(--text-3)]">{b.distanceM}m</span>
                </div>
              ))}
            </div>
          )}
        </div>
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

          {/* RIGHT — nearest station + bus stops */}
          <div className="md:border-l md:border-[var(--border)] md:pl-10">
            <p className="label-xs mb-4">Nearest station &amp; bus stop</p>
            <NearbyPanel />
          </div>

        </div>
      </PageContent>
    </>
  )
}
