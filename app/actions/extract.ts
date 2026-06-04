"use server"

import * as cheerio from "cheerio"

export type GuidebookData = {
  apartmentName: string
  roomNumber: string
  address: string
  electricity: string
  gasCompany: string
  gasPhone: string
  water: string
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
    // e.g. <span>アパート番号52673</span>レオネクストソレイユ 102号室
    const h4 = $("h4.heading11")
    h4.find("span").remove()
    const fullTitle = h4.text().trim() // "レオネクストソレイユ 102号室"
    const roomMatch = fullTitle.match(/^(.+?)\s+(\d+号室)$/)
    const apartmentName = roomMatch ? roomMatch[1] : fullTitle
    const roomNumber = roomMatch ? roomMatch[2] : ""

    // Address: dt containing 所在地 → next dd
    const address = $("dt").filter((_, el) => $(el).text().trim() === "所在地")
      .next("dd").text().trim()

    // Lifeline fields: dt label → next dd
    function getLifeline(label: string) {
      return $("dt").filter((_, el) => $(el).text().trim() === label)
        .next("dd").text().trim()
    }

    const electricity = getLifeline("電気連絡先")
    const gasCompany  = getLifeline("ガス会社")
    const gasPhone    = getLifeline("ガス連絡先")
    const water       = getLifeline("水道連絡先")

    return {
      data: { apartmentName, roomNumber, address, electricity, gasCompany, gasPhone, water },
    }
  } catch (e) {
    return { error: String(e) }
  }
}
