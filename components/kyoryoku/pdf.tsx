"use client"

import { Document, Page, Text, View, StyleSheet, Font, pdf } from "@react-pdf/renderer"

// 9MB font — served statically from /public and cached by the browser, so we
// render in the browser rather than bundling it into a serverless function.
Font.register({ family: "NotoSansJP", src: "/fonts/NotoSansJP.ttf" })

// Japanese has no spaces, so @react-pdf treats a sentence as one giant "word",
// can't fit it, and hyphenates it — injecting a literal "-" mid-sentence. It
// appends a hyphen at ANY break point, so no callback avoids it. We never let
// it wrap: pre-wrap the text and emit one <Text> per line.
Font.registerHyphenationCallback(word => [word])

const NO_LINE_START = "、。）」』】〉》，．・ー"
function wrapJa(text: string, perLine: number): string[] {
  const lines: string[] = []
  let cur = ""
  for (const ch of text) {
    if (cur.length >= perLine && !NO_LINE_START.includes(ch)) { lines.push(cur); cur = "" }
    cur += ch
  }
  if (cur) lines.push(cur)
  return lines
}

// 固定値（永久に変わらない）
const KIKAN  = "コンパスグループ・ジャパン 株式会社"
const TANTOU = "ピープル部門 採用部　安藤 由美子"
const TEL    = "０５２－７４４－０６３１"
const EMAIL  = "foreign_recruitment@compass-jpn.com"

export const BODY_TEXT =
  "特定技能外国人の受入れに当たり、当該外国人が活動する事業所の所在地及び住居地が属する" +
  "地方公共団体から、共生社会の実現のために実施する施策に対する協力を要請されたときは、" +
  "当該要請に応じ、必要な協力をいたします。"

// Vercel は UTC なので必ず Asia/Tokyo で日付を出す
function jstToday() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const g = (t: string) => p.find(x => x.type === t)!.value
  return { y: g("year"), m: String(Number(g("month"))), d: String(Number(g("day"))) }
}

const s = StyleSheet.create({
  page:  { fontFamily: "NotoSansJP", fontSize: 11, paddingTop: 50, paddingBottom: 50, paddingHorizontal: 60, lineHeight: 1.7 },
  atena: { fontSize: 12, marginBottom: 28 },
  title: { fontSize: 16, textAlign: "center", marginBottom: 28, letterSpacing: 4 },
  body:  { fontSize: 11, marginBottom: 30 },
  date:  { fontSize: 11, textAlign: "right", marginBottom: 26 },
  row:   { flexDirection: "row", paddingVertical: 7, alignItems: "flex-start" },
  label: { width: 175, fontSize: 10.5 },
  value: { flex: 1, fontSize: 10.5 },
  note:  { fontSize: 8.5, marginTop: 22, color: "#333", lineHeight: 1.5 },
})

export type PdfInput = {
  municipality: string   // 宛名（例: 横浜市 / 新宿区）
  storeName: string
  storeAddress: string
}

function Doc({ municipality, storeName, storeAddress }: PdfInput) {
  const { y, m, d } = jstToday()
  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.atena}>{`${municipality}長　殿`}</Text>
        <Text style={s.title}>協力確認書</Text>

        <View style={s.body}>
          {wrapJa(BODY_TEXT, 42).map((l, i) => <Text key={i}>{l}</Text>)}
        </View>

        <Text style={s.date}>{`${y}年　${m}月　${d}日`}</Text>

        <View style={s.row}>
          <Text style={s.label}>①特定技能所属機関名</Text>
          <View style={s.value}><Text>{KIKAN}</Text></View>
        </View>
        <View style={s.row}>
          <Text style={s.label}>②事業所の所在地</Text>
          <View style={s.value}>
            {wrapJa(storeAddress, 26).map((l, i) => <Text key={`a${i}`}>{l}</Text>)}
            {wrapJa(storeName, 26).map((l, i) => <Text key={`n${i}`}>{l}</Text>)}
          </View>
        </View>
        <View style={s.row}>
          <Text style={s.label}>③担当者連絡先（部署・担当者名）</Text>
          <View style={s.value}><Text>{TANTOU}</Text></View>
        </View>
        <View style={s.row}>
          <Text style={s.label}>④電　話　番　号</Text>
          <View style={s.value}><Text>{TEL}</Text></View>
        </View>
        <View style={s.row}>
          <Text style={s.label}>⑤メールアドレス</Text>
          <View style={s.value}><Text>{EMAIL}</Text></View>
        </View>

        <Text style={s.note}>
          {"※　直接雇用の場合：①～⑤を記載してください。\n②は特定技能外国人が活動している事業所所在地を記載してください。"}
        </Text>
      </Page>
    </Document>
  )
}

export async function downloadKyoryokuPdf(input: PdfInput) {
  const blob = await pdf(<Doc {...input} />).toBlob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = `協力確認書_${input.municipality}_${input.storeName}.pdf`
  a.click()
  URL.revokeObjectURL(url)
}
