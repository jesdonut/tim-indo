"use server"

import * as cheerio from "cheerio"

export type GuidebookData = {
  apartmentName: string
  roomNumber: string
  address: string
  addressRomaji: string
  electricity: string
  gasCompany: string
  gasPhone: string
  water: string
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

    // Romaji reading of the address (run in parallel with the rest)
    const addressRomaji = address ? await getRomaji(address) : ""

    return {
      data: { apartmentName, roomNumber, address, addressRomaji, electricity, gasCompany, gasPhone, water },
    }
  } catch (e) {
    return { error: String(e) }
  }
}
