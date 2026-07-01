"use server"

export type Station = { name: string; line: string; distance: string }
export type BusStop = { name: string; distanceM: number }

// Strip apartment/building name from Japanese address.
// Keeps everything up to the house number (e.g. "1-2-3", "1丁目2番3号", "1番地").
function stripBuildingName(addr: string): string {
  const m = addr.match(/^(.+?(?:\d+丁目\d+番\d+号|\d+番地\d+号|\d+番\d+号|\d+番地|\d+-\d+-\d+|\d+-\d+))/)
  return m ? m[1].trim() : addr
}

async function nominatimSearch(q: string): Promise<{ lat: number; lon: number } | null> {
  const query = q.includes("日本") ? q : `${q} 日本`
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=jp`
  const res = await fetch(url, { headers: { "Accept-Language": "ja", "User-Agent": "TimIndoApp/1.0" } })
  if (!res.ok) return null
  const data = await res.json()
  if (!data?.[0]) return null
  return { lat: parseFloat(data[0].lat), lon: parseFloat(data[0].lon) }
}

export async function geocodeAddress(
  address: string,
  postalCode?: string | null,
): Promise<{ lat: number; lon: number } | null> {
  if (!address.trim() && !postalCode?.trim()) return null

  const pc = postalCode?.replace(/[^0-9]/g, "")

  // 1. Postal code → zipcloud → get clean prefecture+city+town → Nominatim
  //    More reliable than full address because building names are stripped automatically
  if (pc && pc.length === 7) {
    try {
      const zres = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${pc}`)
      if (zres.ok) {
        const zd = await zres.json()
        const r = zd?.results?.[0]
        if (r?.address1) {
          const normalized = [r.address1, r.address2, r.address3].filter(Boolean).join("")
          const coords = await nominatimSearch(normalized)
          if (coords) return coords
        }
      }
    } catch { /* fall through */ }
  }

  // 2. Full address with building name stripped → Nominatim
  //    If that fails, retry with just the town/district (drop the house number too).
  //    Town-level precision is enough to find the nearest station.
  if (!address.trim()) return null
  try {
    const cleaned = stripBuildingName(address)
    const coords = await nominatimSearch(cleaned)
    if (coords) return coords

    // Drop trailing house number (e.g. "小杉陣屋町2-17-7" → "小杉陣屋町")
    const withoutNumber = cleaned.replace(/[\d]+[-－ー][\d]+([-－ー][\d]+)?[\s]*$/, "").trim()
    if (withoutNumber && withoutNumber !== cleaned) {
      return await nominatimSearch(withoutNumber)
    }
    return null
  } catch {
    return null
  }
}

export async function fetchNearbyTransit(
  lat: number,
  lon: number
): Promise<{ stations: Station[]; busStops: BusStop[] }> {
  const [stations, busStops] = await Promise.all([
    fetchStations(lat, lon),
    fetchBusStops(lat, lon),
  ])
  return { stations, busStops }
}

async function fetchStations(lat: number, lon: number): Promise<Station[]> {
  // Primary: HeartRails Express (best data for Japan — line names + distance)
  try {
    const url = `https://express.heartrails.com/api/json?method=getStations&x=${lon}&y=${lat}`
    const res = await fetch(url, { signal: AbortSignal.timeout(6000) })
    if (res.ok) {
      const data = await res.json()
      const stations = data?.response?.station ?? []
      if (stations.length > 0) return stations as Station[]
    }
  } catch { /* fall through to OSM */ }

  // Fallback: OpenStreetMap via Overpass (no line names, but always reachable)
  try {
    const radius = 1000
    const query = `[out:json][timeout:10];node["railway"~"station|stop"]["name"](around:${radius},${lat},${lon});out body 8;`
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.elements ?? []).map((el: Record<string, unknown>) => {
      const tags = (el.tags ?? {}) as Record<string, string>
      const dlat = (el.lat as number) - lat
      const dlon = (el.lon as number) - lon
      const dm = Math.round(Math.sqrt(dlat * dlat + dlon * dlon) * 111000)
      return {
        name: tags["name"] ?? tags["name:en"] ?? "駅",
        line: tags["operator"] ?? "",
        distance: `${dm}m`,
      } as Station
    }).sort((a: Station, b: Station) => parseInt(a.distance) - parseInt(b.distance))
  } catch {
    return []
  }
}

async function fetchBusStops(lat: number, lon: number): Promise<BusStop[]> {
  try {
    const radius = 600
    const query = `[out:json][timeout:10];node["highway"="bus_stop"](around:${radius},${lat},${lon});out body 10;`
    const res = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      body: `data=${encodeURIComponent(query)}`,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
    })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.elements ?? [])
      .map((el: Record<string, unknown>) => {
        const tags = (el.tags ?? {}) as Record<string, string>
        const dlat = (el.lat as number) - lat
        const dlon = (el.lon as number) - lon
        const distanceM = Math.round(Math.sqrt(dlat * dlat + dlon * dlon) * 111000)
        return { name: tags["name"] ?? tags["name:ja"] ?? "Bus stop", distanceM }
      })
      .sort((a: BusStop, b: BusStop) => a.distanceM - b.distanceM)
  } catch {
    return []
  }
}

// ── Train line → operator lookup ──────────────────────────────────────────────

export type LineInfo = { line: string; operator: string; operatorEn: string; type: string }

const LINE_MAP: Record<string, { operator: string; operatorEn: string; type: string }> = {
  // JR East
  "山手線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "中央線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "中央・総武線": { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "総武線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "京浜東北線":   { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "埼京線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "横浜線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "常磐線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "東海道本線":   { operator: "JR東日本/JR東海/JR西日本", operatorEn: "JR East/Central/West", type: "JR" },
  "高崎線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "宇都宮線":     { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "武蔵野線":     { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "南武線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "横須賀線":     { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "湘南新宿ライン": { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "上野東京ライン": { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "外房線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "内房線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "京葉線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "成田線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "相模線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "八高線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "川越線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "日光線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "仙石線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  "仙山線":       { operator: "JR東日本", operatorEn: "JR East", type: "JR" },
  // JR Central
  "東海道新幹線": { operator: "JR東海", operatorEn: "JR Central", type: "JR新幹線" },
  "中央本線":     { operator: "JR東海/JR東日本", operatorEn: "JR Central/East", type: "JR" },
  "身延線":       { operator: "JR東海", operatorEn: "JR Central", type: "JR" },
  "御殿場線":     { operator: "JR東海", operatorEn: "JR Central", type: "JR" },
  "飯田線":       { operator: "JR東海", operatorEn: "JR Central", type: "JR" },
  // JR West
  "大阪環状線":   { operator: "JR西日本", operatorEn: "JR West", type: "JR" },
  "阪和線":       { operator: "JR西日本", operatorEn: "JR West", type: "JR" },
  "山陽本線":     { operator: "JR西日本", operatorEn: "JR West", type: "JR" },
  "大和路線":     { operator: "JR西日本", operatorEn: "JR West", type: "JR" },
  "おおさか東線": { operator: "JR西日本", operatorEn: "JR West", type: "JR" },
  "JRゆめ咲線":  { operator: "JR西日本", operatorEn: "JR West", type: "JR" },
  // Shinkansen
  "東北新幹線":   { operator: "JR東日本", operatorEn: "JR East", type: "JR新幹線" },
  "上越新幹線":   { operator: "JR東日本", operatorEn: "JR East", type: "JR新幹線" },
  "北陸新幹線":   { operator: "JR東日本/JR西日本", operatorEn: "JR East/West", type: "JR新幹線" },
  "山陽新幹線":   { operator: "JR西日本", operatorEn: "JR West", type: "JR新幹線" },
  "九州新幹線":   { operator: "JR九州", operatorEn: "JR Kyushu", type: "JR新幹線" },
  // Tokyo Metro
  "銀座線":       { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  "丸ノ内線":     { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  "日比谷線":     { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  "東西線":       { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  "千代田線":     { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  "有楽町線":     { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  "半蔵門線":     { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  "南北線":       { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  "副都心線":     { operator: "東京メトロ", operatorEn: "Tokyo Metro", type: "地下鉄" },
  // Toei
  "浅草線":       { operator: "都営", operatorEn: "Toei", type: "地下鉄" },
  "三田線":       { operator: "都営", operatorEn: "Toei", type: "地下鉄" },
  "新宿線":       { operator: "都営", operatorEn: "Toei", type: "地下鉄" },
  "大江戸線":     { operator: "都営", operatorEn: "Toei", type: "地下鉄" },
  // Private Tokyo area
  "東横線":       { operator: "東急", operatorEn: "Tokyu", type: "私鉄" },
  "目黒線":       { operator: "東急", operatorEn: "Tokyu", type: "私鉄" },
  "田園都市線":   { operator: "東急", operatorEn: "Tokyu", type: "私鉄" },
  "大井町線":     { operator: "東急", operatorEn: "Tokyu", type: "私鉄" },
  "池上線":       { operator: "東急", operatorEn: "Tokyu", type: "私鉄" },
  "東急多摩川線": { operator: "東急", operatorEn: "Tokyu", type: "私鉄" },
  "小田原線":     { operator: "小田急", operatorEn: "Odakyu", type: "私鉄" },
  "多摩線":       { operator: "小田急", operatorEn: "Odakyu", type: "私鉄" },
  "江ノ島線":     { operator: "小田急", operatorEn: "Odakyu", type: "私鉄" },
  "京王線":       { operator: "京王", operatorEn: "Keio", type: "私鉄" },
  "井の頭線":     { operator: "京王", operatorEn: "Keio", type: "私鉄" },
  "相模原線":     { operator: "京王", operatorEn: "Keio", type: "私鉄" },
  "池袋線":       { operator: "西武", operatorEn: "Seibu", type: "私鉄" },
  "西武新宿線":   { operator: "西武", operatorEn: "Seibu", type: "私鉄" },
  "秩父線":       { operator: "西武", operatorEn: "Seibu", type: "私鉄" },
  "東上線":       { operator: "東武", operatorEn: "Tobu", type: "私鉄" },
  "スカイツリーライン": { operator: "東武", operatorEn: "Tobu", type: "私鉄" },
  "東武日光線":   { operator: "東武", operatorEn: "Tobu", type: "私鉄" },
  "東武伊勢崎線": { operator: "東武", operatorEn: "Tobu", type: "私鉄" },
  "京急本線":     { operator: "京急", operatorEn: "Keikyu", type: "私鉄" },
  "空港線":       { operator: "京急", operatorEn: "Keikyu", type: "私鉄" },
  "逗子線":       { operator: "京急", operatorEn: "Keikyu", type: "私鉄" },
  "久里浜線":     { operator: "京急", operatorEn: "Keikyu", type: "私鉄" },
  "京成本線":     { operator: "京成", operatorEn: "Keisei", type: "私鉄" },
  "スカイライナー": { operator: "京成", operatorEn: "Keisei", type: "私鉄" },
  "つくばエクスプレス": { operator: "首都圏新都市鉄道", operatorEn: "TX (Tsukuba Express)", type: "私鉄" },
  "りんかい線":   { operator: "東京臨海高速鉄道", operatorEn: "TWR (Rinkai Line)", type: "私鉄" },
  "ゆりかもめ":   { operator: "ゆりかもめ", operatorEn: "Yurikamome", type: "新交通" },
  "東京モノレール": { operator: "東京モノレール", operatorEn: "Tokyo Monorail", type: "モノレール" },
  "多摩モノレール": { operator: "多摩都市モノレール", operatorEn: "Tama Monorail", type: "モノレール" },
  // Osaka Metro
  "御堂筋線":       { operator: "Osaka Metro", operatorEn: "Osaka Metro", type: "地下鉄" },
  "谷町線":         { operator: "Osaka Metro", operatorEn: "Osaka Metro", type: "地下鉄" },
  "四つ橋線":       { operator: "Osaka Metro", operatorEn: "Osaka Metro", type: "地下鉄" },
  "大阪メトロ中央線": { operator: "Osaka Metro", operatorEn: "Osaka Metro", type: "地下鉄" },
  "千日前線":       { operator: "Osaka Metro", operatorEn: "Osaka Metro", type: "地下鉄" },
  "堺筋線":         { operator: "Osaka Metro", operatorEn: "Osaka Metro", type: "地下鉄" },
  "長堀鶴見緑地線": { operator: "Osaka Metro", operatorEn: "Osaka Metro", type: "地下鉄" },
  "今里筋線":       { operator: "Osaka Metro", operatorEn: "Osaka Metro", type: "地下鉄" },
  // Private Osaka/Kansai area
  "神戸線":       { operator: "阪急", operatorEn: "Hankyu", type: "私鉄" },
  "宝塚線":       { operator: "阪急", operatorEn: "Hankyu", type: "私鉄" },
  "京都線":       { operator: "阪急", operatorEn: "Hankyu", type: "私鉄" },
  "阪神本線":     { operator: "阪神", operatorEn: "Hanshin", type: "私鉄" },
  "南海本線":     { operator: "南海", operatorEn: "Nankai", type: "私鉄" },
  "高野線":       { operator: "南海", operatorEn: "Nankai", type: "私鉄" },
  "近鉄奈良線":   { operator: "近鉄", operatorEn: "Kintetsu", type: "私鉄" },
  "近鉄大阪線":   { operator: "近鉄", operatorEn: "Kintetsu", type: "私鉄" },
  "近鉄京都線":   { operator: "近鉄", operatorEn: "Kintetsu", type: "私鉄" },
  "近鉄名古屋線": { operator: "近鉄", operatorEn: "Kintetsu", type: "私鉄" },
  "京阪本線":     { operator: "京阪", operatorEn: "Keihan", type: "私鉄" },
  // Nagoya area
  "名古屋市営地下鉄東山線": { operator: "名古屋市交通局", operatorEn: "Nagoya City Subway", type: "地下鉄" },
  "名城線":       { operator: "名古屋市交通局", operatorEn: "Nagoya City Subway", type: "地下鉄" },
  "鶴舞線":       { operator: "名古屋市交通局", operatorEn: "Nagoya City Subway", type: "地下鉄" },
  "桜通線":       { operator: "名古屋市交通局", operatorEn: "Nagoya City Subway", type: "地下鉄" },
  "名鉄名古屋本線": { operator: "名古屋鉄道(名鉄)", operatorEn: "Meitetsu", type: "私鉄" },
  // Fukuoka
  "福岡市地下鉄空港線": { operator: "福岡市地下鉄", operatorEn: "Fukuoka City Subway", type: "地下鉄" },
  "西鉄天神大牟田線": { operator: "西日本鉄道(西鉄)", operatorEn: "Nishitetsu", type: "私鉄" },
  // Sapporo
  "札幌市営地下鉄南北線": { operator: "札幌市交通局", operatorEn: "Sapporo City Subway", type: "地下鉄" },
  // Sendai
  "仙台市地下鉄南北線": { operator: "仙台市交通局", operatorEn: "Sendai City Subway", type: "地下鉄" },
}

export async function lookupTrainLine(query: string): Promise<LineInfo[]> {
  const q = query.trim().toLowerCase()
  if (!q) return []

  const results: LineInfo[] = []
  for (const [line, info] of Object.entries(LINE_MAP)) {
    if (
      line.toLowerCase().includes(q) ||
      info.operator.toLowerCase().includes(q) ||
      info.operatorEn.toLowerCase().includes(q)
    ) {
      results.push({ line, ...info })
    }
  }
  return results
}
