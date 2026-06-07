"use client"

import Link from "next/link"
import { useState } from "react"

type Lang = "id" | "vi" | "my" | "ja"

const LANGS: { code: Lang; label: string }[] = [
  { code: "id", label: "ID" },
  { code: "vi", label: "VI" },
  { code: "my", label: "MY" },
  { code: "ja", label: "JA" },
]

const COPY: Record<Lang, {
  eyebrow: string
  title: [string, string]
  desc: string
  tools: string[]
  login: string
  signup: string
  footer: string
}> = {
  id: {
    eyebrow: "Alat internal · Tim Indonesia",
    title: ["Tim Indo", "Serba Bisa"],
    desc: "Satu tempat untuk semua alat yang digunakan tim setiap hari. Tautan, PDF, terjemahan, builder, manajemen area, ekstraksi data, dan lainnya.",
    tools: ["Database", "Tautan", "PDF", "Terjemahan", "Builder", "Area", "Ekstrak"],
    login: "Masuk",
    signup: "Daftar",
    footer: "Khusus tim · undangan diperlukan",
  },
  vi: {
    eyebrow: "Bởi Jessica (Tim Indonesia)",
    title: ["Tim Indo", "Serba Bisa"],
    desc: "Nơi tập trung tất cả các công cụ mà nhóm sử dụng hằng ngày. Liên kết, PDF, dịch thuật, công cụ xây dựng, quản lý khu vực, trích xuất dữ liệu và nhiều tính năng khác.",
    tools: ["Cơ sở dữ liệu", "Liên kết", "PDF", "Dịch thuật", "Builder", "Khu vực", "Trích xuất"],
    login: "Đăng nhập",
    signup: "Đăng ký",
    footer: "Chỉ dành cho thành viên nhóm · Cần lời mời",
  },
  my: {
    eyebrow: "Jessica မှ (Tim Indonesia)",
    title: ["Tim Indo", "Serba Bisa"],
    desc: "အဖွဲ့ဝင်များ နေ့စဉ်အသုံးပြုသည့် ကိရိယာများအားလုံးကို တစ်နေရာတည်းတွင် စုစည်းထားသည်။ လင့်ခ်များ၊ PDF များ၊ ဘာသာပြန်၊ Builder၊ နယ်မြေစီမံခန့်ခွဲမှု၊ ဒေတာထုတ်ယူခြင်း နှင့် အခြားလုပ်ဆောင်ချက်များကို အသုံးပြုနိုင်ပါသည်။",
    tools: ["ဒေတာဘေ့စ်", "လင့်ခ်များ", "PDF", "ဘာသာပြန်", "Builder", "နယ်မြေ", "ထုတ်ယူ"],
    login: "ဝင်ရောက်ရန်",
    signup: "အကောင့်ဖွင့်ရန်",
    footer: "အဖွဲ့ဝင်များသာ · ဖိတ်ကြားချက် လိုအပ်သည်",
  },
  ja: {
    eyebrow: "社内ツール · インドネシアチーム",
    title: ["Tim Indo", "Serba Bisa"],
    desc: "チームが毎日使うツールをひとつにまとめました。リンク集、PDF、翻訳、ビルダー、エリア管理、データ抽出などが利用できます。",
    tools: ["データベース", "リンク", "PDF", "翻訳", "ビルダー", "エリア", "抽出"],
    login: "ログイン",
    signup: "登録",
    footer: "チーム専用 · 招待が必要",
  },
}

export default function Home() {
  const [lang, setLang] = useState<Lang>("id")
  const c = COPY[lang]

  return (
    <div className="min-h-[calc(100dvh-48px)] flex flex-col px-5 py-12 max-w-5xl mx-auto w-full">

      <div className="flex items-center justify-between">
        <p className="label-xs">{c.eyebrow}</p>
        <div className="flex items-center gap-0.5 bg-[var(--bg-2)] rounded p-0.5">
          {LANGS.map(l => (
            <button
              key={l.code}
              onClick={() => setLang(l.code)}
              className={`px-2.5 py-1 rounded text-[0.65rem] font-semibold tracking-wide transition-all ${
                lang === l.code
                  ? "bg-[var(--text)] text-[var(--bg)]"
                  : "text-[var(--text-3)] hover:text-[var(--text)]"
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col justify-center gap-10 py-12">

        <div className="border-l-2 border-[var(--highlight)] pl-5">
          <h1 className="display text-[var(--text)]">
            {c.title[0]}<br />
            <span className="text-[var(--text-3)]">{c.title[1]}</span>
          </h1>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end gap-6 sm:gap-16 border-t border-[var(--border)] pt-8">
          <p className="text-sm text-[var(--text-2)] max-w-xs leading-relaxed">
            {c.desc}
          </p>

          <div className="flex items-center gap-3 sm:ml-auto shrink-0">
            <Link
              href="/login"
              className="px-5 py-2.5 rounded border border-[var(--border)] text-sm font-medium text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-all duration-150"
            >
              {c.login}
            </Link>
            <Link
              href="/signup"
              className="px-5 py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold hover:opacity-80 transition-opacity duration-150"
            >
              {c.signup}
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-5 gap-y-1">
          {c.tools.map(t => (
            <span key={t} className="label-xs">{t}</span>
          ))}
        </div>

      </div>

      <div className="border-t border-[var(--border)] pt-5 flex items-center justify-between">
        <span className="label-xs">v2 · 2026</span>
        <span className="label-xs">{c.footer}</span>
      </div>

    </div>
  )
}
