// 協力確認書 PDF サンプル生成
//   node scripts/genKyoryokuPdf.mjs
//
// Reproduces kyouryokukakuninnsyo2.docx. 直接雇用なので ①〜⑤ のみ。
// ①③④⑤ は固定値、変わるのは 宛名(自治体) と ②(事業所所在地 + 店舗名) だけ。

import React from "react"
import { Document, Page, Text, View, StyleSheet, Font, renderToFile } from "@react-pdf/renderer"
import path from "path"

Font.register({
  family: "NotoSansJP",
  src: path.resolve("public/fonts/NotoSansJP.ttf"),
})

// Japanese has no spaces, so @react-pdf treats a sentence as one giant "word"
// and hyphenates it — inserting a literal "-" mid-sentence. It appends a hyphen
// at ANY break point, so no callback avoids it. The only reliable fix is to
// never let it wrap: we pre-wrap the text ourselves and emit one <Text> per
// line. Kinsoku: never start a line with closing punctuation.
Font.registerHyphenationCallback(word => [word])

const NO_LINE_START = "、。）」』】〉》，．・ー"
function wrapJa(text, perLine) {
  const lines = []
  let cur = ""
  for (const ch of text) {
    if (cur.length >= perLine && !NO_LINE_START.includes(ch)) { lines.push(cur); cur = "" }
    cur += ch
  }
  if (cur) lines.push(cur)
  return lines
}
const Lines = (text, perLine, style, k = "l") =>
  wrapJa(text, perLine).map((l, i) => React.createElement(Text, { key: `${k}${i}`, style }, l))

// 固定値（永久に変わらない）
const KIKAN   = "コンパスグループ・ジャパン 株式会社"
const TANTOU  = "ピープル部門 採用部　安藤 由美子"
const TEL     = "０５２－７４４－０６３１"
const EMAIL   = "foreign_recruitment@compass-jpn.com"

const BODY =
  "特定技能外国人の受入れに当たり、当該外国人が活動する事業所の所在地及び住居地が属する" +
  "地方公共団体から、共生社会の実現のために実施する施策に対する協力を要請されたときは、" +
  "当該要請に応じ、必要な協力をいたします。"

// Vercel は UTC なので必ず Asia/Tokyo で日付を出す
function jstToday() {
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date())
  const g = t => p.find(x => x.type === t).value
  return { y: g("year"), m: String(Number(g("month"))), d: String(Number(g("day"))) }
}

const s = StyleSheet.create({
  page:   { fontFamily: "NotoSansJP", fontSize: 11, paddingTop: 50, paddingBottom: 50, paddingHorizontal: 60, lineHeight: 1.7 },
  atena:  { fontSize: 12, marginBottom: 28 },
  title:  { fontSize: 16, textAlign: "center", marginBottom: 28, letterSpacing: 4 },
  body:   { fontSize: 11, textAlign: "left", marginBottom: 30 },
  date:   { fontSize: 11, textAlign: "right", marginBottom: 26 },
  row:    { flexDirection: "row", borderBottom: "1pt solid #000", paddingVertical: 7, alignItems: "flex-start" },
  label:  { width: 175, fontSize: 10.5 },
  value:  { flex: 1, fontSize: 10.5 },
  note:   { fontSize: 8.5, marginTop: 22, color: "#333", lineHeight: 1.5 },
})

function Row({ label, children }) {
  return React.createElement(View, { style: s.row },
    React.createElement(Text, { style: s.label }, label),
    React.createElement(View, { style: s.value }, children),
  )
}

export function KyoryokuDoc({ municipality, storeName, storeAddress }) {
  const { y, m, d } = jstToday()
  return React.createElement(Document, null,
    React.createElement(Page, { size: "A4", style: s.page },
      React.createElement(Text, { style: s.atena }, `${municipality}長　殿`),
      React.createElement(Text, { style: s.title }, "協力確認書"),
      React.createElement(View, { style: s.body }, ...Lines(BODY, 42)),
      React.createElement(Text, { style: s.date }, `${y}年　${m}月　${d}日`),

      React.createElement(Row, { label: "①特定技能所属機関名" },
        React.createElement(Text, null, KIKAN)),
      React.createElement(Row, { label: "②事業所の所在地" },
        ...Lines(storeAddress, 26, undefined, "a"),
        ...Lines(storeName, 26, undefined, "n")),
      React.createElement(Row, { label: "③担当者連絡先（部署・担当者名）" },
        React.createElement(Text, null, TANTOU)),
      React.createElement(Row, { label: "④電　話　番　号" },
        React.createElement(Text, null, TEL)),
      React.createElement(Row, { label: "⑤メールアドレス" },
        React.createElement(Text, null, EMAIL)),

      React.createElement(Text, { style: s.note },
        "※　直接雇用の場合：①～⑤を記載してください。\n" +
        "②は特定技能外国人が活動している事業所所在地を記載してください。"),
    ),
  )
}

// ── サンプル: 横浜市 / 特養　磯子自然村 ────────────────────────────────────────
const sample = {
  municipality: "横浜市",
  storeName:    "特養　磯子自然村",
  storeAddress: "神奈川県横浜市磯子区氷取沢町６０－１７",
}
const out = `協力確認書_${sample.municipality}_${sample.storeName}.pdf`
await renderToFile(React.createElement(KyoryokuDoc, sample), out)
console.log("→", out)
