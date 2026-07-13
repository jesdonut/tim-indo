"use client"

import { useEffect, useMemo, useState } from "react"
import { PageHeader, ToolContent } from "@/components/PageHeader"
import PixelLoader from "@/components/PixelLoader"
import { Icon } from "@/components/Icon"
import { cn } from "@/lib/cn"
import {
  getKyoryoku, updateSubmission, updateMunicipality, markPdfGenerated,
  type Municipality, type Submission, type KyoryokuStatus, type SubmissionMethod,
} from "@/app/actions/kyoryoku"
import { downloadKyoryokuPdf } from "@/components/kyoryoku/pdf"

const STATUSES: KyoryokuStatus[] = ["未着手", "調査済", "提出済", "受理確認済"]
const METHODS: SubmissionMethod[] =
  ["未調査", "メール", "ホームページフォーム", "電子申請システム", "郵送", "窓口", "電話"]

const STATUS_STYLE: Record<KyoryokuStatus, string> = {
  未着手:   "bg-red-500/15 text-red-400",
  調査済:   "bg-yellow-500/15 text-yellow-400",
  提出済:   "bg-blue-500/15 text-blue-400",
  受理確認済: "bg-green-500/15 text-green-400",
}

const CC = "lieu_le@grasp-agent.jp, zinaye_may@grasp-agent.jp"
const SUBJECT = "協力確認書のご提出について(コンパスグループ・ジャパン株式会社)"

function mailBody(m: Municipality, sender: string) {
  return `${m.name}長
${m.name}役場${m.department ?? ""}
ご担当者様

お世話になっております。
登録支援機関 株式会社GRASPエージェント・ジャパンの${sender || "＿＿＿"}と申します。

このたび、所属機関であるコンパスグループ・ジャパン 株式会社の協力確認書についてご連絡申し上げます。
弊社が代理として、協力確認書を提出させていただきますので、何卒よろしくお願い申し上げます。

引き続きどうぞよろしくお願いいたします。

ご不明な点などがございましたら、恐れ入りますが、本メールにご返信いただけますと幸いです。`
}

const inputCls =
  "w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]"

export default function KyoryokuPage() {
  const [munis, setMunis] = useState<Municipality[] | null>(null)
  const [subs, setSubs] = useState<Submission[]>([])
  const [err, setErr] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<KyoryokuStatus | null>(null)
  const [openMuni, setOpenMuni] = useState<string | null>(null)
  const [selected, setSelected] = useState<Submission | null>(null)
  const [sender, setSender] = useState("")

  useEffect(() => {
    let alive = true
    const saved = localStorage.getItem("kyoryoku_sender") ?? ""
    getKyoryoku().then(res => {
      if (!alive) return
      setSender(saved)
      if ("error" in res) { setErr(res.error); setMunis([]); return }
      setMunis(res.municipalities); setSubs(res.submissions)
    }).catch(e => { if (alive) { setErr(String(e)); setMunis([]) } })
    return () => { alive = false }
  }, [])

  function saveSender(v: string) {
    setSender(v); localStorage.setItem("kyoryoku_sender", v)
  }

  const muniById = useMemo(() => new Map((munis ?? []).map(m => [m.id, m])), [munis])

  // group submissions by municipality
  const groups = useMemo(() => {
    const g = new Map<string, Submission[]>()
    for (const s of subs) {
      const k = s.municipality_id ?? "__none__"
      if (!g.has(k)) g.set(k, [])
      g.get(k)!.push(s)
    }
    return g
  }, [subs])

  const done = subs.filter(s => s.status === "提出済" || s.status === "受理確認済").length
  const q = search.trim().toLowerCase()

  const visible = useMemo(() => {
    return [...groups.entries()]
      .map(([mid, rows]) => ({ mid, muni: muniById.get(mid) ?? null, rows }))
      .filter(({ muni, rows }) => {
        const rs = filter ? rows.filter(r => r.status === filter) : rows
        if (rs.length === 0) return false
        if (!q) return true
        return (muni?.name ?? "").toLowerCase().includes(q)
          || rs.some(r => (r.store_name ?? "").toLowerCase().includes(q) || (r.store_code ?? "").includes(q))
      })
      .sort((a, b) => (a.muni?.name ?? "zz").localeCompare(b.muni?.name ?? "zz", "ja"))
  }, [groups, muniById, filter, q])

  function patchSub(id: string, fields: Partial<Submission>) {
    setSubs(prev => prev.map(s => (s.id === id ? { ...s, ...fields } : s)))
    setSelected(prev => (prev && prev.id === id ? { ...prev, ...fields } : prev))
    updateSubmission(id, fields)
  }
  function patchMuni(id: string, fields: Partial<Municipality>) {
    setMunis(prev => (prev ?? []).map(m => (m.id === id ? { ...m, ...fields } : m)))
    updateMunicipality(id, fields)
  }

  return (
    <div className="relative flex flex-col h-[calc(100dvh-48px)]">
      <PixelLoader ready={munis !== null} />
      <PageHeader
        full
        title="協力確認書"
        right={
          <div className="flex items-center gap-3">
            <span className="text-[0.75rem] text-[var(--text-2)]">
              <span className="text-[var(--text)] font-semibold">{done}</span> / {subs.length} 提出済
            </span>
            <div className="h-1.5 w-28 rounded-full bg-[var(--bg-2)] overflow-hidden">
              <div className="h-full bg-green-500/70" style={{ width: subs.length ? `${(done / subs.length) * 100}%` : "0%" }} />
            </div>
          </div>
        }
      />

      <ToolContent full className="overflow-hidden">
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* List */}
          <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
            <div className="shrink-0 py-3 flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Icon name="search" size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)]" />
                <input
                  className="bg-[var(--bg-2)] border border-[var(--border)] rounded pl-8 pr-3 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] w-60"
                  placeholder="自治体・店舗名・店舗CDで検索…"
                  value={search} onChange={e => setSearch(e.target.value)}
                />
              </div>
              {STATUSES.map(s => (
                <button key={s} onClick={() => setFilter(f => (f === s ? null : s))}
                  className={cn("px-2.5 py-1 rounded text-[0.72rem] font-medium transition-all border",
                    filter === s ? "bg-[var(--text)] text-[var(--bg)] border-[var(--text)]"
                                 : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)]")}>
                  {s} {subs.filter(x => x.status === s).length}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-1.5">
                <span className="text-[0.7rem] text-[var(--text-3)]">送信者名</span>
                <input className={cn(inputCls, "w-32 py-1")} placeholder="例: 山田"
                  value={sender} onChange={e => saveSender(e.target.value)} />
              </label>
            </div>

            {err && <p className="text-[0.78rem] text-red-400 pb-2">読み込みエラー: {err}</p>}

            <div className="flex-1 overflow-y-auto pb-8 flex flex-col gap-1.5">
              {munis !== null && visible.length === 0 && (
                <p className="text-[0.8rem] text-[var(--text-3)] py-10 text-center">
                  該当なし。（テーブル未作成の場合は kyoryoku.sql / seed_kyoryoku.sql を実行してください）
                </p>
              )}

              {visible.map(({ mid, muni, rows }) => {
                const rs = filter ? rows.filter(r => r.status === filter) : rows
                const open = openMuni === mid
                const d = rows.filter(r => r.status === "提出済" || r.status === "受理確認済").length
                return (
                  <div key={mid} className="rounded border border-[var(--border)] bg-[var(--bg-2)]">
                    <button onClick={() => setOpenMuni(o => (o === mid ? null : mid))}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-[var(--bg-3)] transition-colors">
                      <Icon name={open ? "expand_more" : "chevron_right"} size={15} className="text-[var(--text-3)]" />
                      <span className="text-[0.82rem] font-medium text-[var(--text)]">
                        {muni?.name ?? "（自治体未設定）"}
                      </span>
                      {muni && (
                        <span className="text-[0.65rem] px-1.5 py-0.5 rounded bg-[var(--bg)] text-[var(--text-3)] border border-[var(--border)]">
                          {muni.submission_method}
                        </span>
                      )}
                      <span className="ml-auto text-[0.7rem] text-[var(--text-3)]">{d}/{rows.length}</span>
                    </button>

                    {open && (
                      <div className="border-t border-[var(--border)]">
                        {rs.map(r => (
                          <button key={r.id} onClick={() => setSelected(r)}
                            className={cn("w-full flex items-center gap-2 px-3 py-1.5 text-left border-b border-[var(--border)] last:border-0 hover:bg-[var(--bg-3)] transition-colors",
                              selected?.id === r.id && "bg-[var(--bg-3)]")}>
                            <span className={cn("text-[0.62rem] px-1.5 py-0.5 rounded shrink-0", STATUS_STYLE[r.status])}>{r.status}</span>
                            <span className="text-[0.75rem] text-[var(--text)] truncate">{r.store_name ?? "—"}</span>
                            <span className="text-[0.65rem] text-[var(--text-3)] font-mono shrink-0 ml-auto">{r.store_code ?? ""}</span>
                            {r.pdf_generated_at && <Icon name="picture_as_pdf" size={12} className="text-[var(--text-3)] shrink-0" />}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Detail */}
          {selected && (
            <Detail
              key={selected.id}
              sub={selected}
              muni={selected.municipality_id ? muniById.get(selected.municipality_id) ?? null : null}
              sender={sender}
              onClose={() => setSelected(null)}
              onPatchSub={patchSub}
              onPatchMuni={patchMuni}
            />
          )}
        </div>
      </ToolContent>
    </div>
  )
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function Detail({
  sub, muni, sender, onClose, onPatchSub, onPatchMuni,
}: {
  sub: Submission
  muni: Municipality | null
  sender: string
  onClose: () => void
  onPatchSub: (id: string, f: Partial<Submission>) => void
  onPatchMuni: (id: string, f: Partial<Municipality>) => void
}) {
  // Editable PDF inputs — the CSV data is unreliable, so let staff fix it
  // before it lands on a legal document. Seeded once per selection; the parent
  // remounts this via key={sub.id}, so no syncing effect is needed.
  const [atena, setAtena] = useState(muni?.name ?? "")
  const [name, setName] = useState(sub.store_name ?? "")
  const [addr, setAddr] = useState(sub.store_address ?? "")
  const [busy, setBusy] = useState(false)
  const [copied, setCopied] = useState<string | null>(null)

  async function copy(label: string, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(label); setTimeout(() => setCopied(null), 1500)
  }

  async function genPdf() {
    if (!atena.trim() || !name.trim() || !addr.trim()) return
    setBusy(true)
    try {
      await downloadKyoryokuPdf({ municipality: atena.trim(), storeName: name.trim(), storeAddress: addr.trim() })
      // persist any edits the user made, then record the generation
      onPatchSub(sub.id, { store_name: name.trim(), store_address: addr.trim() })
      await markPdfGenerated(sub.id)
      onPatchSub(sub.id, {
        pdf_generated_at: new Date().toISOString(),
        ...(sub.status === "未着手" ? { status: "調査済" as KyoryokuStatus } : {}),
      })
    } finally { setBusy(false) }
  }

  // Plain render function, not a component — defining a component inside render
  // remounts it every keystroke.
  const copyBtn = (label: string, text: string) => (
    <button onClick={() => copy(label, text)}
      className={cn("text-[0.68rem] flex items-center gap-1 transition-colors",
        copied === label ? "text-green-400" : "text-[var(--text-3)] hover:text-[var(--text)]")}>
      <Icon name={copied === label ? "check" : "content_copy"} size={12} />
      {copied === label ? "コピー済み" : "コピー"}
    </button>
  )

  return (
    <div className="w-96 shrink-0 border-l border-[var(--border)] flex flex-col overflow-hidden">
      <div className="flex items-start justify-between px-4 pt-4 pb-3 border-b border-[var(--border)] shrink-0">
        <div className="min-w-0">
          <p className="text-[0.9rem] font-semibold text-[var(--text)] truncate">{sub.store_name ?? "—"}</p>
          <p className="text-[0.7rem] text-[var(--text-3)]">{muni?.name ?? "自治体未設定"} · {sub.store_code ?? ""}</p>
        </div>
        <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text)]"><Icon name="close" size={17} /></button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-5">
        {/* Status */}
        <div>
          <p className="label-xs mb-1.5">ステータス</p>
          <div className="flex gap-1 flex-wrap">
            {STATUSES.map(s => (
              <button key={s} onClick={() => onPatchSub(sub.id, { status: s })}
                className={cn("px-2 py-1 rounded text-[0.68rem] transition-all border",
                  sub.status === s ? "border-[var(--text)] " + STATUS_STYLE[s] : "border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)]")}>
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* PDF — editable before generating */}
        <div className="flex flex-col gap-2">
          <p className="label-xs">PDF生成（内容を確認・修正してから）</p>
          <label className="flex flex-col gap-0.5">
            <span className="text-[0.65rem] text-[var(--text-3)]">宛名（自治体）→「{atena || "＿"}長　殿」</span>
            <input className={inputCls} value={atena} onChange={e => setAtena(e.target.value)} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[0.65rem] text-[var(--text-3)]">②事業所の所在地</span>
            <input className={inputCls} value={addr} onChange={e => setAddr(e.target.value)} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[0.65rem] text-[var(--text-3)]">②店舗名</span>
            <input className={inputCls} value={name} onChange={e => setName(e.target.value)} />
          </label>
          <button onClick={genPdf} disabled={busy || !atena.trim() || !name.trim() || !addr.trim()}
            className="mt-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded text-[0.78rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 disabled:opacity-40 font-medium">
            <Icon name="picture_as_pdf" size={14} />
            {busy ? "生成中…" : "PDF生成"}
          </button>
          {sub.pdf_generated_at && (
            <p className="text-[0.65rem] text-[var(--text-3)]">
              生成済み: {new Date(sub.pdf_generated_at).toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" })}
            </p>
          )}
        </div>

        {/* Method-specific */}
        {muni && (
          <div className="flex flex-col gap-2">
            <p className="label-xs">提出方法</p>
            <select className={inputCls} value={muni.submission_method}
              onChange={e => onPatchMuni(muni.id, { submission_method: e.target.value as SubmissionMethod })}>
              {METHODS.map(m => <option key={m} value={m}>{m}</option>)}
            </select>

            {muni.submission_method === "メール" && (
              <div className="flex flex-col gap-2 mt-1">
                <label className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] text-[var(--text-3)]">宛先メール</span>
                  <input className={inputCls} value={muni.email ?? ""}
                    onChange={e => onPatchMuni(muni.id, { email: e.target.value || null })} />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-[0.65rem] text-[var(--text-3)]">担当課</span>
                  <input className={inputCls} value={muni.department ?? ""}
                    onChange={e => onPatchMuni(muni.id, { department: e.target.value || null })} />
                </label>

                <div className="rounded border border-[var(--border)] bg-[var(--bg-2)] p-2.5 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[0.68rem] text-[var(--text-3)]">CC</span>
                    {copyBtn("cc", CC)}
                  </div>
                  <p className="text-[0.68rem] text-[var(--text-2)] break-all">{CC}</p>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[0.68rem] text-[var(--text-3)]">件名</span>
                    {copyBtn("subj", SUBJECT)}
                  </div>
                  <p className="text-[0.68rem] text-[var(--text-2)]">{SUBJECT}</p>

                  <div className="flex items-center justify-between mt-1">
                    <span className="text-[0.68rem] text-[var(--text-3)]">本文</span>
                    {copyBtn("body", mailBody(muni, sender))}
                  </div>
                  <pre className="text-[0.66rem] text-[var(--text-2)] whitespace-pre-wrap font-sans leading-relaxed">
                    {mailBody(muni, sender)}
                  </pre>
                  {!sender && <p className="text-[0.62rem] text-yellow-500">※ 上部で「送信者名」を入力してください</p>}
                </div>
              </div>
            )}

            {(muni.submission_method === "ホームページフォーム" || muni.submission_method === "電子申請システム") && (
              <label className="flex flex-col gap-0.5">
                <span className="text-[0.65rem] text-[var(--text-3)]">フォームURL</span>
                <div className="flex gap-2">
                  <input className={inputCls} value={muni.form_url ?? ""}
                    onChange={e => onPatchMuni(muni.id, { form_url: e.target.value || null })} />
                  {muni.form_url && (
                    <a href={muni.form_url} target="_blank" rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded bg-[var(--bg-2)] border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] shrink-0">
                      開く
                    </a>
                  )}
                </div>
              </label>
            )}

            {(muni.submission_method === "郵送" || muni.submission_method === "窓口") && (
              <div className="rounded border border-[var(--border)] bg-[var(--bg-2)] p-2.5">
                <p className="text-[0.68rem] text-[var(--text-3)] mb-1">宛先（備考欄に記録）</p>
                <p className="text-[0.72rem] text-[var(--text-2)] whitespace-pre-wrap">{muni.notes || "（未記入）"}</p>
              </div>
            )}

            <label className="flex flex-col gap-0.5 mt-1">
              <span className="text-[0.65rem] text-[var(--text-3)]">注意点・メモ</span>
              <textarea className={cn(inputCls, "min-h-[60px] resize-y")} value={muni.notes ?? ""}
                onChange={e => onPatchMuni(muni.id, { notes: e.target.value || null })} />
            </label>
          </div>
        )}

        {/* Record */}
        <div className="flex flex-col gap-2">
          <p className="label-xs">提出記録</p>
          <label className="flex flex-col gap-0.5">
            <span className="text-[0.65rem] text-[var(--text-3)]">申請日</span>
            <input type="date" className={inputCls} value={sub.submitted_at ?? ""}
              onChange={e => onPatchSub(sub.id, { submitted_at: e.target.value || null })} />
          </label>
          <label className="flex flex-col gap-0.5">
            <span className="text-[0.65rem] text-[var(--text-3)]">受付番号</span>
            <input className={inputCls} value={sub.receipt_number ?? ""}
              onChange={e => onPatchSub(sub.id, { receipt_number: e.target.value || null })} />
          </label>
        </div>
      </div>
    </div>
  )
}
