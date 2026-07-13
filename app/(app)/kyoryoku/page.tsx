"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { PillTabs } from "@/components/PageHeader"
import { getTenpoStores, type TenpoStore } from "@/app/actions/tenpo"
import {
  getMunicipalities,
  addMunicipality,
  updateMunicipalityStatus,
  updateMunicipality,
  deleteMunicipality,
  bulkUpsertMunicipalities,
  type Municipality,
} from "@/app/actions/municipalities"

// ── Helpers ───────────────────────────────────────────────────────────────────

const COMPANY = "株式会社GRASPエージェント・ジャパン"

function toWareki(date: Date): string {
  const y = date.getFullYear()
  const m = date.getMonth() + 1
  const d = date.getDate()
  if (y > 2019 || (y === 2019 && m >= 5)) return `令和${y - 2018}年${m}月${d}日`
  return `平成${y - 1988}年${m}月${d}日`
}

function toBase64Lines(bytes: Uint8Array): string {
  let binary = ""
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  const b64 = btoa(binary)
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64
}

function buildEml(to: string, subject: string, body: string, attachments: { name: string; data: Uint8Array }[]): string {
  const boundary = `----=_Part_${Date.now()}`
  const lines: string[] = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: 8bit",
    "",
    body,
    "",
  ]
  for (const att of attachments) {
    const safeName = encodeURIComponent(att.name)
    lines.push(`--${boundary}`)
    lines.push("Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    lines.push(`Content-Disposition: attachment; filename*=UTF-8''${safeName}`)
    lines.push("Content-Transfer-Encoding: base64")
    lines.push("")
    lines.push(toBase64Lines(att.data))
    lines.push("")
  }
  lines.push(`--${boundary}--`)
  return lines.join("\r\n")
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ── CSV parsing ───────────────────────────────────────────────────────────────

type CsvRow = Omit<Municipality, "id" | "sent_at">

function parseCsv(text: string): CsvRow[] {
  const lines = text.split("\n").map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []
  const first = lines[0].toLowerCase()
  const hasHeader =
    first.includes("自治体") || first.includes("name") || first.includes("メール") || first.includes("送付")
  const data = hasHeader ? lines.slice(1) : lines
  return data.map(line => {
    const cols = line.split("\t")
    const methodRaw = cols[3]?.trim() ?? ""
    const method: Municipality["submission_method"] = (["email", "form", "mail"] as const).includes(methodRaw as "email") ? (methodRaw as Municipality["submission_method"]) : null
    return {
      name: cols[0]?.trim() ?? "",
      name_romaji: cols[1]?.trim() || null,
      email: cols[2]?.trim() || null,
      submission_method: method,
      form_url: cols[4]?.trim() || null,
      status: "pending" as const,
    }
  }).filter(r => r.name)
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<Municipality["status"], string> = {
  pending: "未送付",
  sent: "送付済",
  confirmed: "確認済",
}

const STATUS_COLOR: Record<Municipality["status"], string> = {
  pending: "text-[var(--text-3)] bg-[var(--bg-2)]",
  sent: "text-blue-500 bg-blue-500/10",
  confirmed: "text-green-500 bg-green-500/10",
}

const METHOD_LABEL: Record<string, string> = { email: "メール", form: "フォーム", mail: "郵送" }

// ── Input component ───────────────────────────────────────────────────────────

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={cn(
        "w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors",
        props.className
      )}
    />
  )
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={cn(
        "bg-[var(--bg-2)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors",
        props.className
      )}
    />
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ManageTab
// ─────────────────────────────────────────────────────────────────────────────

function ManageTab({
  municipalities,
  onReload,
}: {
  municipalities: Municipality[]
  onReload: () => void
}) {
  const [filter, setFilter] = useState<"all" | Municipality["status"]>("all")
  const [search, setSearch] = useState("")
  const [csvText, setCsvText] = useState("")
  const [csvResult, setCsvResult] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editFields, setEditFields] = useState<Partial<Municipality>>({})
  const [addOpen, setAddOpen] = useState(false)
  const [newRow, setNewRow] = useState<CsvRow>({ name: "", name_romaji: null, email: null, submission_method: null, form_url: null, status: "pending" })

  const filtered = municipalities.filter(m => {
    if (filter !== "all" && m.status !== filter) return false
    if (search && !m.name.includes(search) && !(m.name_romaji ?? "").toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  async function handleCsvImport() {
    if (!csvText.trim()) return
    setBusy(true)
    const rows = parseCsv(csvText)
    if (rows.length === 0) { setCsvResult("有効な行がありません。"); setBusy(false); return }
    const result = await bulkUpsertMunicipalities(rows)
    const msgs = [`追加: ${result.added}件`, `更新: ${result.updated}件`]
    if (result.errors.length) msgs.push(...result.errors)
    setCsvResult(msgs.join(" / "))
    setCsvText("")
    onReload()
    setBusy(false)
  }

  async function handleStatusChange(id: string, status: Municipality["status"]) {
    await updateMunicipalityStatus(id, status)
    onReload()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`「${name}」を削除しますか？`)) return
    await deleteMunicipality(id)
    onReload()
  }

  async function handleSaveEdit() {
    if (!editingId) return
    setBusy(true)
    await updateMunicipality(editingId, editFields)
    setEditingId(null)
    setEditFields({})
    onReload()
    setBusy(false)
  }

  async function handleAddRow() {
    if (!newRow.name.trim()) return
    setBusy(true)
    await addMunicipality(newRow)
    setNewRow({ name: "", name_romaji: null, email: null, submission_method: null, form_url: null, status: "pending" })
    setAddOpen(false)
    onReload()
    setBusy(false)
  }

  return (
    <div className="flex flex-col gap-4">
      {/* CSV import */}
      <div className="border border-[var(--border)] rounded p-4 flex flex-col gap-2">
        <p className="text-[0.72rem] font-medium text-[var(--text-2)] uppercase tracking-wide">CSVインポート</p>
        <p className="text-[0.72rem] text-[var(--text-3)]">列順: 自治体名 / ローマ字 / メール / 送付方法(email|form|mail) / フォームURL</p>
        <textarea
          value={csvText}
          onChange={e => setCsvText(e.target.value)}
          placeholder="ExcelからTSVを貼り付け..."
          rows={4}
          className="w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm font-mono text-[var(--text)] outline-none focus:border-[var(--text-2)] resize-none placeholder:text-[var(--text-3)]"
        />
        <div className="flex items-center gap-2">
          <button
            onClick={handleCsvImport}
            disabled={busy || !csvText.trim()}
            className="px-3 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            インポート
          </button>
          {csvResult && <p className="text-[0.75rem] text-[var(--text-2)]">{csvResult}</p>}
        </div>
      </div>

      {/* Filters + Add button */}
      <div className="flex items-center gap-2 flex-wrap">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="自治体名で検索..."
          className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors w-44"
        />
        <div className="flex gap-1">
          {(["all", "pending", "sent", "confirmed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={cn(
                "px-2.5 py-1 rounded text-xs font-medium transition-all",
                filter === s ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-2)] hover:text-[var(--text)] bg-[var(--bg-2)]"
              )}
            >
              {s === "all" ? "すべて" : STATUS_LABEL[s]}
            </button>
          ))}
        </div>
        <button
          onClick={() => setAddOpen(v => !v)}
          className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] transition-colors"
        >
          <Icon name="add" size={14} />
          追加
        </button>
      </div>

      {/* Add row form */}
      {addOpen && (
        <div className="border border-[var(--border)] rounded p-4 flex flex-col gap-3">
          <p className="text-sm font-medium text-[var(--text)]">新規自治体</p>
          <div className="grid grid-cols-2 gap-2">
            <Input placeholder="自治体名 *" value={newRow.name} onChange={e => setNewRow(p => ({ ...p, name: e.target.value }))} />
            <Input placeholder="ローマ字" value={newRow.name_romaji ?? ""} onChange={e => setNewRow(p => ({ ...p, name_romaji: e.target.value || null }))} />
            <Input placeholder="メールアドレス" value={newRow.email ?? ""} onChange={e => setNewRow(p => ({ ...p, email: e.target.value || null }))} />
            <Select value={newRow.submission_method ?? ""} onChange={e => setNewRow(p => ({ ...p, submission_method: (e.target.value as Municipality["submission_method"]) || null }))}>
              <option value="">送付方法を選択</option>
              <option value="email">メール</option>
              <option value="form">フォーム</option>
              <option value="mail">郵送</option>
            </Select>
            <Input placeholder="フォームURL" value={newRow.form_url ?? ""} onChange={e => setNewRow(p => ({ ...p, form_url: e.target.value || null }))} className="col-span-2" />
          </div>
          <div className="flex gap-2">
            <button onClick={handleAddRow} disabled={busy || !newRow.name.trim()} className="px-3 py-1.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-medium disabled:opacity-40">
              保存
            </button>
            <button onClick={() => setAddOpen(false)} className="px-3 py-1.5 rounded border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)]">
              キャンセル
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <p className="text-sm text-[var(--text-3)]">
          {municipalities.length === 0 ? "自治体がまだ登録されていません。" : "条件に一致する自治体がありません。"}
        </p>
      ) : (
        <div className="border border-[var(--border)] rounded overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--bg-2)]">
                <th className="text-left px-3 py-2 text-[0.72rem] font-medium text-[var(--text-3)] uppercase tracking-wide">自治体名</th>
                <th className="text-left px-3 py-2 text-[0.72rem] font-medium text-[var(--text-3)] uppercase tracking-wide">送付方法</th>
                <th className="text-left px-3 py-2 text-[0.72rem] font-medium text-[var(--text-3)] uppercase tracking-wide">ステータス</th>
                <th className="px-3 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filtered.map(m => (
                editingId === m.id ? (
                  <tr key={m.id} className="bg-[var(--bg-2)]">
                    <td colSpan={4} className="px-3 py-3">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <Input value={editFields.name ?? m.name} onChange={e => setEditFields(p => ({ ...p, name: e.target.value }))} placeholder="自治体名" />
                        <Input value={editFields.name_romaji ?? m.name_romaji ?? ""} onChange={e => setEditFields(p => ({ ...p, name_romaji: e.target.value || null }))} placeholder="ローマ字" />
                        <Input value={editFields.email ?? m.email ?? ""} onChange={e => setEditFields(p => ({ ...p, email: e.target.value || null }))} placeholder="メール" />
                        <Select value={editFields.submission_method ?? m.submission_method ?? ""} onChange={e => setEditFields(p => ({ ...p, submission_method: (e.target.value as Municipality["submission_method"]) || null }))}>
                          <option value="">送付方法</option>
                          <option value="email">メール</option>
                          <option value="form">フォーム</option>
                          <option value="mail">郵送</option>
                        </Select>
                        <Input value={editFields.form_url ?? m.form_url ?? ""} onChange={e => setEditFields(p => ({ ...p, form_url: e.target.value || null }))} placeholder="フォームURL" className="col-span-2" />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={handleSaveEdit} disabled={busy} className="px-3 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-xs font-medium disabled:opacity-40">保存</button>
                        <button onClick={() => { setEditingId(null); setEditFields({}) }} className="px-3 py-1 rounded border border-[var(--border)] text-xs text-[var(--text-2)]">キャンセル</button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={m.id} className="hover:bg-[var(--bg-2)] transition-colors">
                    <td className="px-3 py-2.5">
                      <div className="font-medium text-[var(--text)]">{m.name}</div>
                      {m.name_romaji && <div className="text-[0.72rem] text-[var(--text-3)]">{m.name_romaji}</div>}
                      {m.email && <div className="text-[0.72rem] text-[var(--text-3)]">{m.email}</div>}
                      {m.form_url && <a href={m.form_url} target="_blank" rel="noopener noreferrer" className="text-[0.72rem] text-blue-500 hover:underline truncate block max-w-xs">フォームURL</a>}
                    </td>
                    <td className="px-3 py-2.5 text-[0.75rem] text-[var(--text-2)]">
                      {m.submission_method ? METHOD_LABEL[m.submission_method] : "—"}
                    </td>
                    <td className="px-3 py-2.5">
                      <Select
                        value={m.status}
                        onChange={e => handleStatusChange(m.id, e.target.value as Municipality["status"])}
                        className="text-xs"
                      >
                        <option value="pending">未送付</option>
                        <option value="sent">送付済</option>
                        <option value="confirmed">確認済</option>
                      </Select>
                    </td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center gap-1 justify-end">
                        <button
                          onClick={() => { setEditingId(m.id); setEditFields({}) }}
                          className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text)] hover:bg-[var(--bg)] transition-colors"
                          title="編集"
                        >
                          <Icon name="edit" size={14} />
                        </button>
                        <button
                          onClick={() => handleDelete(m.id, m.name)}
                          className="p-1 rounded text-[var(--text-3)] hover:text-red-400 hover:bg-red-400/10 transition-colors"
                          title="削除"
                        >
                          <Icon name="delete" size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// GenerateTab
// ─────────────────────────────────────────────────────────────────────────────

type LogEntry = { text: string; type: "success" | "skip" | "error" | "info" }

function GenerateTab({
  municipalities,
  stores,
  onReload,
}: {
  municipalities: Municipality[]
  stores: TenpoStore[]
  onReload: () => void
}) {
  const [templateFile, setTemplateFile] = useState<File | null>(null)
  const [selectedMunis, setSelectedMunis] = useState<Set<string>>(new Set())
  const [selectedStores, setSelectedStores] = useState<Set<string>>(new Set())
  const [storeSearch, setStoreSearch] = useState("")
  const [muniFilter, setMuniFilter] = useState<"all" | "pending" | "sent" | "confirmed">("pending")
  const [log, setLog] = useState<LogEntry[]>([])
  const [generating, setGenerating] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const filteredMunis = municipalities.filter(m => muniFilter === "all" || m.status === muniFilter)
  const filteredStores = stores.filter(s =>
    !storeSearch ||
    (s.tenpo_name ?? "").includes(storeSearch) ||
    s.tenpo_cd.includes(storeSearch)
  )

  function toggleMuni(id: string) {
    setSelectedMunis(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleStore(cd: string) {
    setSelectedStores(prev => {
      const next = new Set(prev)
      next.has(cd) ? next.delete(cd) : next.add(cd)
      return next
    })
  }

  function toggleAllStores() {
    if (selectedStores.size === filteredStores.length) {
      setSelectedStores(new Set())
    } else {
      setSelectedStores(new Set(filteredStores.map(s => s.tenpo_cd)))
    }
  }

  function toggleAllMunis() {
    if (selectedMunis.size === filteredMunis.length) {
      setSelectedMunis(new Set())
    } else {
      setSelectedMunis(new Set(filteredMunis.map(m => m.id)))
    }
  }

  async function generate() {
    if (!templateFile) { alert("テンプレートファイルを選択してください。"); return }
    if (selectedMunis.size === 0) { alert("自治体を1つ以上選択してください。"); return }
    if (selectedStores.size === 0) { alert("店舗を1つ以上選択してください。"); return }

    setGenerating(true)
    setLog([])
    const entries: LogEntry[] = []
    const addLog = (text: string, type: LogEntry["type"]) => {
      entries.push({ text, type })
      setLog([...entries])
    }

    try {
      const [PizZip, Docxtemplater, JSZip] = await Promise.all([
        import("pizzip").then(m => m.default),
        import("docxtemplater").then(m => m.default),
        import("jszip").then(m => m.default),
      ])

      const templateBuffer = await templateFile.arrayBuffer()
      const dateStr = toWareki(new Date())
      const zipOut = new JSZip()

      const selectedMuniList = municipalities.filter(m => selectedMunis.has(m.id))
      const selectedStoreList = stores.filter(s => selectedStores.has(s.tenpo_cd))

      for (const muni of selectedMuniList) {
        const folder = zipOut.folder(muni.name_romaji || muni.name) as InstanceType<typeof JSZip>
        const emlAttachments: { name: string; data: Uint8Array }[] = []

        for (const store of selectedStoreList) {
          try {
            const pz = new PizZip(templateBuffer)
            const doc = new Docxtemplater(pz, { paragraphLoop: true, linebreaks: true })
            doc.render({
              MUNICIPALITY: `${muni.name}　御中`,
              DATE: dateStr,
              STORE_NAME: store.tenpo_name ?? store.tenpo_cd,
              STORE_ADDRESS: store.address ?? "",
              COMPANY,
            })
            const outBuf = doc.getZip().generate({ type: "arraybuffer" })
            const safeName = (store.tenpo_name ?? store.tenpo_cd).replace(/[/\\:*?"<>|]/g, "_")
            const safeRomaji = (muni.name_romaji || muni.name).replace(/\s+/g, "_")
            const filename = `kyoryokukakuninsho_${safeRomaji}_${safeName}.docx`
            folder.file(filename, outBuf)
            emlAttachments.push({ name: filename, data: new Uint8Array(outBuf) })
            addLog(`✓ ${muni.name} × ${store.tenpo_name ?? store.tenpo_cd}`, "success")
          } catch (err) {
            addLog(`✗ ${muni.name} × ${store.tenpo_name ?? store.tenpo_cd}: ${String(err)}`, "error")
          }
        }

        if (muni.submission_method === "email" && muni.email) {
          const body = `${muni.name}　ご担当者様\n\nお世話になっております。\n${COMPANY}でございます。\n\n協力確認書をお送りいたします。\nご確認のほどよろしくお願いいたします。`
          const eml = buildEml(muni.email, `協力確認書 送付 – ${muni.name}`, body, emlAttachments)
          const safeRomaji = (muni.name_romaji || muni.name).replace(/\s+/g, "_")
          folder.file(`${safeRomaji}_draft.eml`, eml)
          addLog(`📧 ${muni.name}: .emlドラフト作成`, "info")
        } else if (muni.submission_method === "form" && muni.form_url) {
          addLog(`🔗 ${muni.name}: フォームURL → ${muni.form_url}`, "info")
        }
      }

      const zipBlob = await zipOut.generateAsync({ type: "blob" })
      const now = new Date()
      const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`
      downloadBlob(zipBlob, `kyoryoku_${ymd}.zip`)
      addLog(`ダウンロード完了`, "success")

      // Mark email/form municipalities as sent
      for (const muni of selectedMuniList) {
        if (muni.submission_method === "email" || muni.submission_method === "form") {
          if (muni.status === "pending") {
            await updateMunicipalityStatus(muni.id, "sent")
          }
        }
      }
      onReload()
    } catch (err) {
      addLog(`エラー: ${String(err)}`, "error")
    }

    setGenerating(false)
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Template upload */}
      <div>
        <p className="text-[0.72rem] font-medium text-[var(--text-2)] uppercase tracking-wide mb-2">テンプレート (DOCX)</p>
        <div className="flex items-center gap-3">
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 rounded border border-[var(--border)] text-sm text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)] transition-colors"
          >
            <Icon name="upload_file" size={14} />
            ファイルを選択
          </button>
          {templateFile ? (
            <span className="text-sm text-[var(--text)]">{templateFile.name}</span>
          ) : (
            <span className="text-sm text-[var(--text-3)]">未選択</span>
          )}
          <input ref={fileRef} type="file" accept=".docx" className="hidden" onChange={e => setTemplateFile(e.target.files?.[0] ?? null)} />
        </div>
        <p className="mt-1.5 text-[0.72rem] text-[var(--text-3)]">
          プレースホルダー: {"{{MUNICIPALITY}}"} {"{{DATE}}"} {"{{STORE_NAME}}"} {"{{STORE_ADDRESS}}"} {"{{COMPANY}}"}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Municipality selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[0.72rem] font-medium text-[var(--text-2)] uppercase tracking-wide">自治体</p>
            <div className="flex gap-1 items-center">
              {(["pending", "sent", "confirmed", "all"] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setMuniFilter(s)}
                  className={cn(
                    "px-1.5 py-0.5 rounded text-[0.65rem] font-medium transition-all",
                    muniFilter === s ? "bg-[var(--text)] text-[var(--bg)]" : "text-[var(--text-3)] hover:text-[var(--text)]"
                  )}
                >
                  {s === "all" ? "全" : STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
          <div className="border border-[var(--border)] rounded overflow-hidden">
            <div
              onClick={toggleAllMunis}
              className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-2)] cursor-pointer hover:bg-[var(--bg)] text-[0.72rem] text-[var(--text-3)]"
            >
              <input type="checkbox" readOnly checked={filteredMunis.length > 0 && selectedMunis.size === filteredMunis.length} className="pointer-events-none" />
              すべて選択
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredMunis.length === 0 ? (
                <p className="px-3 py-4 text-[0.75rem] text-[var(--text-3)]">自治体がありません</p>
              ) : (
                filteredMunis.map(m => (
                  <div
                    key={m.id}
                    onClick={() => toggleMuni(m.id)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--bg-2)] border-b border-[var(--border)] last:border-0 transition-colors"
                  >
                    <input type="checkbox" readOnly checked={selectedMunis.has(m.id)} className="pointer-events-none shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-[var(--text)] block truncate">{m.name}</span>
                      <span className={cn("text-[0.65rem] px-1.5 py-0.5 rounded", STATUS_COLOR[m.status])}>
                        {STATUS_LABEL[m.status]}
                      </span>
                      {m.submission_method && (
                        <span className="ml-1 text-[0.65rem] text-[var(--text-3)]">{METHOD_LABEL[m.submission_method]}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          <p className="mt-1 text-[0.65rem] text-[var(--text-3)]">{selectedMunis.size}件選択</p>
        </div>

        {/* Store selector */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-[0.72rem] font-medium text-[var(--text-2)] uppercase tracking-wide">店舗</p>
            <p className="text-[0.65rem] text-[var(--text-3)]">{selectedStores.size}/{stores.length}</p>
          </div>
          <input
            value={storeSearch}
            onChange={e => setStoreSearch(e.target.value)}
            placeholder="店舗名・コードで検索..."
            className="w-full mb-1.5 bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] transition-colors"
          />
          <div className="border border-[var(--border)] rounded overflow-hidden">
            <div
              onClick={toggleAllStores}
              className="flex items-center gap-2 px-3 py-2 border-b border-[var(--border)] bg-[var(--bg-2)] cursor-pointer hover:bg-[var(--bg)] text-[0.72rem] text-[var(--text-3)]"
            >
              <input type="checkbox" readOnly checked={filteredStores.length > 0 && selectedStores.size === filteredStores.length} className="pointer-events-none" />
              すべて選択
            </div>
            <div className="max-h-64 overflow-y-auto">
              {filteredStores.length === 0 ? (
                <p className="px-3 py-4 text-[0.75rem] text-[var(--text-3)]">店舗がありません</p>
              ) : (
                filteredStores.map(s => (
                  <div
                    key={s.tenpo_cd}
                    onClick={() => toggleStore(s.tenpo_cd)}
                    className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[var(--bg-2)] border-b border-[var(--border)] last:border-0 transition-colors"
                  >
                    <input type="checkbox" readOnly checked={selectedStores.has(s.tenpo_cd)} className="pointer-events-none shrink-0" />
                    <div className="min-w-0">
                      <span className="text-sm text-[var(--text)] block truncate">{s.tenpo_name ?? s.tenpo_cd}</span>
                      <span className="text-[0.65rem] text-[var(--text-3)]">{s.tenpo_cd}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Generate button */}
      <div>
        <button
          onClick={generate}
          disabled={generating || !templateFile || selectedMunis.size === 0 || selectedStores.size === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded bg-[var(--text)] text-[var(--bg)] text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          <Icon name={generating ? "hourglass_empty" : "download"} size={16} />
          {generating ? "生成中..." : `書類を生成してZIPダウンロード (${selectedMunis.size}自治体 × ${selectedStores.size}店舗)`}
        </button>

        {/* Form URL links for selected form-method municipalities */}
        {[...selectedMunis].map(id => {
          const m = municipalities.find(x => x.id === id)
          if (!m || m.submission_method !== "form" || !m.form_url) return null
          return (
            <div key={id} className="mt-2 flex items-center gap-2 text-sm">
              <span className="text-[var(--text-2)]">{m.name}:</span>
              <a href={m.form_url} target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline flex items-center gap-1">
                <Icon name="open_in_new" size={12} />
                フォームを開く
              </a>
            </div>
          )
        })}
      </div>

      {/* Log */}
      {log.length > 0 && (
        <div className="border border-[var(--border)] rounded p-3 bg-[var(--bg-2)] max-h-48 overflow-y-auto">
          <p className="text-[0.65rem] font-medium text-[var(--text-3)] uppercase tracking-wide mb-2">生成ログ</p>
          {log.map((entry, i) => (
            <p
              key={i}
              className={cn("text-[0.75rem] font-mono leading-relaxed", {
                "text-green-500": entry.type === "success",
                "text-[var(--text-3)]": entry.type === "skip",
                "text-red-400": entry.type === "error",
                "text-blue-400": entry.type === "info",
              })}
            >
              {entry.text}
            </p>
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────────────────────────────────────

type Tab = "manage" | "generate"

export default function KyoryokuPage() {
  const [tab, setTab] = useState<Tab>("manage")
  const [municipalities, setMunicipalities] = useState<Municipality[]>([])
  const [stores, setStores] = useState<TenpoStore[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    const [ms, ss] = await Promise.all([getMunicipalities(), getTenpoStores()])
    setMunicipalities(ms)
    setStores(ss)
    setLoading(false)
  }, [])

  useEffect(() => { reload() }, [reload])

  return (
    <div className="max-w-3xl mx-auto px-5 py-8">
      <div className="mb-6">
        <p className="label-xs mb-1">Documents</p>
        <h1 className="text-2xl font-bold tracking-tight text-[var(--text)]">協力確認書一括作成</h1>
      </div>

      <div className="mb-6">
        <PillTabs<Tab>
          options={[
            { value: "manage", label: "自治体管理" },
            { value: "generate", label: "書類生成" },
          ]}
          value={tab}
          onChange={setTab}
        />
      </div>

      {loading ? (
        <p className="text-sm text-[var(--text-3)]">読み込み中...</p>
      ) : tab === "manage" ? (
        <ManageTab municipalities={municipalities} onReload={reload} />
      ) : (
        <GenerateTab municipalities={municipalities} stores={stores} onReload={reload} />
      )}
    </div>
  )
}
