"use server"

import * as cheerio from "cheerio"

export type GuidebookData = {
  apartmentName: string
  roomNumber: string
  address: string
  addressRomaji: string
  postalCode: string
  electricity: string
  gasCompany: string
  gasPhone: string
  water: string
}

export type PostalResult = {
  zipcode: string
  address: string   // kanji full address
  reading: string   // kana full reading
  prefecture: string
  city: string
  town: string
}

export async function lookupPostal(code: string): Promise<{ results?: PostalResult[]; error?: string }> {
  const clean = code.replace(/[^0-9]/g, "")
  if (clean.length !== 7) return { error: "Enter a 7-digit postal code" }

  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${clean}`)
    const data = await res.json()
    if (!data.results) return { error: "No results found" }

    const results: PostalResult[] = data.results.map((r: Record<string, string>) => ({
      zipcode:    r.zipcode,
      address:    r.address1 + r.address2 + r.address3,
      reading:    r.kana1 + r.kana2 + r.kana3,
      prefecture: r.address1,
      city:       r.address2,
      town:       r.address3,
    }))

    return { results }
  } catch (e) {
    return { error: String(e) }
  }
}

async function getPostalCode(address: string): Promise<string> {
  try {
    // Strip block/lot numbers — Nominatim matches better on town level
    const query = address.replace(/[\s　]*[0-9０-９][0-9０-９\-ー―丁目番地号\s]*/u, "").trim()
    const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&countrycodes=jp&limit=5`
    const res = await fetch(url, { headers: { "Accept-Language": "ja", "User-Agent": "TimIndoApp/1.0" } })
    const items: Array<{ address?: { postcode?: string } }> = await res.json()
    for (const item of items) {
      const pc = item.address?.postcode?.replace(/\D/g, "")
      if (pc?.length === 7) return `${pc.slice(0, 3)}-${pc.slice(3)}`
    }
    return ""
  } catch {
    return ""
  }
}

async function getRomaji(text: string): Promise<string> {
  try {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=ja&tl=en&dt=t&dt=rm&dj=1&q=${encodeURIComponent(text)}`
    const res = await fetch(url)
    const data = await res.json()
    // Collect romaji from sentence segments
    let romaji = ""
    if (data?.sentences) {
      for (const seg of data.sentences) {
        romaji += seg.src_translit ?? seg.translit ?? ""
      }
    }
    return romaji.trim()
  } catch {
    return ""
  }
}

export async function extractGuidebook(url: string): Promise<{ data?: GuidebookData; error?: string }> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; bot/1.0)" },
      next: { revalidate: 0 },
    })

    if (!res.ok) return { error: `Failed to fetch page (${res.status})` }

    const html = await res.text()
    const $ = cheerio.load(html)

    // Apartment name + room from h4.heading11
    const h4 = $("h4.heading11")
    h4.find("span").remove()
    const fullTitle = h4.text().trim()
    const roomMatch = fullTitle.match(/^(.+?)\s+(\d+号室)$/)
    const apartmentName = roomMatch ? roomMatch[1] : fullTitle
    const roomNumber    = roomMatch ? roomMatch[2] : ""

    // Address
    const address = $("dt").filter((_, el) => $(el).text().trim() === "所在地")
      .next("dd").text().trim()

    // Lifeline
    function getLifeline(label: string) {
      return $("dt").filter((_, el) => $(el).text().trim() === label)
        .next("dd").text().trim()
    }

    const electricity = getLifeline("電気連絡先")
    const gasCompany  = getLifeline("ガス会社")
    const gasPhone    = getLifeline("ガス連絡先")
    const water       = getLifeline("水道連絡先")

    // Romaji + postal code in parallel
    const [addressRomaji, postalCode] = await Promise.all([
      address ? getRomaji(address) : Promise.resolve(""),
      address ? getPostalCode(address) : Promise.resolve(""),
    ])

    return {
      data: { apartmentName, roomNumber, address, addressRomaji, postalCode, electricity, gasCompany, gasPhone, water },
    }
  } catch (e) {
    return { error: String(e) }
  }
}
