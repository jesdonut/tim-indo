"use client"

import { useEffect, useState } from "react"
import { cn } from "@/lib/cn"
import { Icon } from "@/components/Icon"
import { createClient } from "@/lib/supabase/client"
import type { Worker } from "@/app/actions/workers"
import {
  getWorkerLocations,
  upsertWorkerLocation,
  deleteWorkerLocation,
  fetchLeopalacePhone,
  type WorkerLocation,
} from "@/app/actions/workerLocations"

const inputCls =
  "w-full bg-[var(--bg-2)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.8rem] text-[var(--text)] outline-none focus:border-[var(--text-2)] transition-colors"

type Draft = Partial<WorkerLocation>
type SaveStatus = "idle" | "saving" | "saved"

// UI-only fields (furigana / 担当) — never persisted to Supabase
type LocalOnly = {
  furi_housing_address_old: string
  furi_housing_building_old: string
  furi_housing_address: string
  furi_housing_building: string
  furi_store_address: string
  tantou_tenshutsu: string
  tantou_tennyu: string
  tantou_tenkyo: string
}
const EMPTY_LOCAL: LocalOnly = {
  furi_housing_address_old: "", furi_housing_building_old: "",
  furi_housing_address: "", furi_housing_building: "",
  furi_store_address: "",
  tantou_tenshutsu: "", tantou_tennyu: "", tantou_tenkyo: "",
}

function pickActive(locs: WorkerLocation[]): WorkerLocation | null {
  const active = locs.filter(l => !l.is_archived).sort((a, b) => b.move_number - a.move_number)
  return active[0] ?? null
}

function datePassed(d?: string | null): boolean {
  if (!d) return false
  const t = new Date(d)
  if (isNaN(t.getTime())) return false
  const today = new Date()
  today.setHours(23, 59, 59, 999)
  return t.getTime() <= today.getTime()
}

export default function MoveTab({ worker }: { worker: Worker }) {
  const [locs, setLocs] = useState<WorkerLocation[] | null>(null)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [local, setLocal] = useState<LocalOnly>(EMPTY_LOCAL)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [err, setErr] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)

  const [tenpoLoading, setTenpoLoading] = useState(false)
  const [tenpoMsg, setTenpoMsg] = useState<{ type: "error" | "ok"; text: string } | null>(null)
  const supabase = useState(() => createClient())[0]

  const [leoPhone, setLeoPhone] = useState<string | null>(null)
  const [leoLoading, setLeoLoading] = useState(false)
  const [leoErr, setLeoErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    getWorkerLocations(worker.id).then(data => {
      if (!alive) return
      setLocs(data)
      setDraft(pickActive(data))
    })
    return () => { alive = false }
  }, [worker.id])

  function upd(k: keyof WorkerLocation, v: string | number | boolean | null) {
    setDraft(d => (d ? { ...d, [k]: v } : d))
  }

  async function commit(next: Draft) {
    setSaveStatus("saving"); setErr(null)
    const res = await upsertWorkerLocation({
      ...(next as Omit<WorkerLocation, "id" | "created_at" | "updated_at">),
      worker_id: worker.id,
      team_id: "",
      move_number: next.move_number ?? 1,
    })
    if ("error" in res) { setSaveStatus("idle"); setErr(res.error); return }
    setSaveStatus("saved")
    setDraft(d => (d ? { ...d, id: res.id } : d))
    const data = await getWorkerLocations(worker.id)
    setLocs(data)
    setTimeout(() => setSaveStatus(s => (s === "saved" ? "idle" : s)), 1500)
  }

  function blurCommit() { if (draft) commit(draft) }

  function toggle(k: keyof WorkerLocation, v: boolean) {
    const next = { ...(draft ?? {}), [k]: v }
    setDraft(next); commit(next)
  }

  function addMove() {
    const prev = (locs ?? []).slice().sort((a, b) => b.move_number - a.move_number)[0]
    const src = prev ?? worker
    const nextNum = (locs ?? []).reduce((m, l) => Math.max(m, l.move_number), 0) + 1
    setLocal(EMPTY_LOCAL)
    setLeoPhone(null); setLeoErr(null); setTenpoMsg(null)
    setDraft({
      worker_id: worker.id,
      move_number: nextNum,
      is_archived: false,
      housing_postal_code_old: src.housing_postal_code ?? null,
      housing_address_old: src.housing_address ?? null,
      housing_building_old: src.housing_building ?? null,
      housing_room_old: src.housing_room ?? null,
    })
  }

  async function lookupTenpo() {
    const code = (draft?.store_code ?? "").trim()
    if (!code) { setTenpoMsg({ type: "error", text: "店舗コードを入力してください。" }); return }
    setTenpoLoading(true); setTenpoMsg(null)
    const { data, error } = await supabase
      .from("tenpo_master")
      .select("tenpo_name, zip, address, tel")
      .eq("tenpo_cd", code)
      .maybeSingle()
    setTenpoLoading(false)
    if (error) { setTenpoMsg({ type: "error", text: `検索に失敗しました：${error.message}` }); return }
    if (!data) { setTenpoMsg({ type: "error", text: `店舗コード「${code}」が見つかりません。` }); return }
    const next: Draft = {
      ...(draft ?? {}),
      store_name: data.tenpo_name ?? draft?.store_name ?? null,
      store_postal_code: data.zip ?? draft?.store_postal_code ?? null,
      store_address: data.address ?? draft?.store_address ?? null,
      store_phone: data.tel ?? draft?.store_phone ?? null,
    }
    setDraft(next); commit(next)
    setTenpoMsg({ type: "ok", text: `${data.tenpo_name ?? code} を反映しました。` })
  }

  async function getLeoPhone() {
    setLeoLoading(true); setLeoErr(null); setLeoPhone(null)
    const res = await fetchLeopalacePhone(draft?.leopalace_url ?? "")
    setLeoLoading(false)
    if ("error" in res) { setLeoErr(res.error); return }
    setLeoPhone(res.phone)
  }

  async function archive() {
    if (!draft) return
    const next = { ...draft, is_archived: true }
    await commit(next)
    setDraft(null)
    setLocal(EMPTY_LOCAL)
    setLeoPhone(null)
  }

  async function deleteHistory(id: string) {
    await deleteWorkerLocation(id)
    setLocs(prev => (prev ?? []).filter(l => l.id !== id))
  }

  // ── Field render helpers (plain functions, not components, so inputs keep
  //    focus across re-renders) ────────────────────────────────────────────
  const T = (label: string, k: keyof WorkerLocation, type = "text", disabled = false) => (
    <label className="flex flex-col gap-0.5">
      <span className="label-xs">{label}</span>
      <input
        type={type}
        disabled={disabled}
        className={cn(inputCls, disabled && "opacity-40 cursor-not-allowed")}
        value={(draft?.[k] as string | null | undefined) ?? ""}
        onChange={e => upd(k, e.target.value || null)}
        onBlur={blurCommit}
      />
    </label>
  )

  const NumT = (label: string, k: keyof WorkerLocation) => (
    <label className="flex flex-col gap-0.5">
      <span className="label-xs">{label}</span>
      <input
        type="number"
        className={inputCls}
        value={(draft?.[k] as number | null | undefined) ?? ""}
        onChange={e => upd(k, e.target.value ? parseInt(e.target.value) : null)}
        onBlur={blurCommit}
      />
    </label>
  )

  const Furi = (label: string, k: keyof LocalOnly) => (
    <label className="flex flex-col gap-0.5">
      <span className="label-xs text-[var(--text-3)]">{label}</span>
      <input
        className={inputCls}
        value={local[k]}
        onChange={e => setLocal(l => ({ ...l, [k]: e.target.value }))}
      />
    </label>
  )

  const Chk = (label: string, k: keyof WorkerLocation) => (
    <label className="flex items-center gap-2 cursor-pointer text-[0.8rem] text-[var(--text)]">
      <input
        type="checkbox"
        className="accent-[var(--text)]"
        checked={!!draft?.[k]}
        onChange={e => toggle(k, e.target.checked)}
      />
      {label}
    </label>
  )

  const title = (text: string) => (
    <p className="label-xs border-b border-[var(--border)] pb-1">{text}</p>
  )

  // ── Render ───────────────────────────────────────────────────────────────
  if (locs === null) {
    return <p className="text-[0.75rem] text-[var(--text-3)] animate-pulse px-4 py-6">読み込み中…</p>
  }

  const history = (locs ?? []).filter(l => l.id !== draft?.id)

  const doneReady = !!draft &&
    datePassed(draft.first_work_date) &&
    !!draft.luggage_received &&
    !!draft.electricity_done && !!draft.water_done && !!draft.gas_done &&
    !!draft.tenshutsu_done && !!draft.tennyu_done && !!draft.tenkyo_done

  return (
    <div className="flex-1 overflow-y-auto px-4 py-4 flex flex-col gap-6">
      {/* No active move */}
      {!draft && (
        <div className="flex flex-col items-center gap-3 py-8">
          <p className="text-[0.8rem] text-[var(--text-3)]">現在進行中の引越しはありません。</p>
          <button
            onClick={addMove}
            className="flex items-center gap-1.5 px-4 py-2 rounded text-[0.8rem] bg-[var(--text)] text-[var(--bg)] hover:opacity-90 transition-opacity font-medium"
          >
            <Icon name="add" size={14} />
            引越しを追加 (Add Move)
          </button>
        </div>
      )}

      {draft && (
        <>
          {/* Save indicator */}
          <div className="flex items-center justify-between">
            <span className="text-[0.72rem] text-[var(--text-3)]">Move #{draft.move_number}</span>
            <span className="text-[0.7rem] text-[var(--text-3)]">
              {saveStatus === "saving" ? "保存中…" : saveStatus === "saved" ? "保存済み ✓" : ""}
            </span>
          </div>
          {err && <p className="text-[0.72rem] text-red-400">{err}</p>}

          {/* Done banner */}
          {doneReady && (
            <div className="flex items-center justify-between gap-3 px-3 py-2 rounded bg-green-500/15 border border-green-500/30">
              <span className="text-[0.8rem] text-green-400 font-medium">✅ 引越し完了</span>
              <button
                onClick={archive}
                className="px-3 py-1 rounded text-[0.72rem] bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors"
              >
                アーカイブ
              </button>
            </div>
          )}

          {/* ① 基本情報 */}
          <section className="flex flex-col gap-3">
            {title("① 基本情報")}
            <div className="grid grid-cols-2 gap-3">
              {T("入国/異動グループ", "ido_group")}
              <div />
              {T("最終出勤日", "last_work_date", "date")}
              {T("初出勤日", "first_work_date", "date")}
            </div>
          </section>

          {/* ② 旧住所 */}
          <section className="flex flex-col gap-3">
            {title("② 旧住所（引越し前）")}
            <div className="grid grid-cols-2 gap-3">
              {T("郵便番号", "housing_postal_code_old")}
              {T("部屋番号", "housing_room_old")}
              <div className="col-span-2">{T("住所", "housing_address_old")}</div>
              <div className="col-span-2">{Furi("住所 読み仮名（保存されません）", "furi_housing_address_old")}</div>
              {T("物件名", "housing_building_old")}
              {Furi("物件名 読み仮名（保存されません）", "furi_housing_building_old")}
            </div>
          </section>

          {/* ③ 新住所 */}
          <section className="flex flex-col gap-3">
            {title("③ 新住所（引越し後）")}
            <div className="grid grid-cols-2 gap-3">
              {T("郵便番号", "housing_postal_code")}
              {T("部屋番号", "housing_room")}
              <div className="col-span-2">{T("住所", "housing_address")}</div>
              <div className="col-span-2">{Furi("住所 読み仮名（保存されません）", "furi_housing_address")}</div>
              {T("物件名", "housing_building")}
              {Furi("物件名 読み仮名（保存されません）", "furi_housing_building")}
              {T("パスコード", "housing_passcode")}
              <div />
              <div className="col-span-2">
                <label className="flex flex-col gap-0.5">
                  <span className="label-xs">Leopalace URL</span>
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      value={draft.leopalace_url ?? ""}
                      onChange={e => upd("leopalace_url", e.target.value || null)}
                      onBlur={blurCommit}
                    />
                    <button
                      type="button"
                      onClick={getLeoPhone}
                      disabled={leoLoading}
                      className="px-3 py-1.5 rounded bg-[var(--bg-2)] border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] shrink-0 transition-colors disabled:opacity-50"
                    >
                      {leoLoading ? "取得中…" : "📞 番号を取得"}
                    </button>
                  </div>
                </label>
                {leoPhone && <p className="text-[0.72rem] text-[var(--text-2)] mt-1">物件電話: {leoPhone}</p>}
                {leoErr && <p className="text-[0.72rem] text-red-400 mt-1">{leoErr}</p>}
              </div>
            </div>
          </section>

          {/* ④ 店舗 */}
          <section className="flex flex-col gap-3">
            {title("④ 店舗")}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="flex flex-col gap-0.5">
                  <span className="label-xs">店舗CD</span>
                  <div className="flex gap-2">
                    <input
                      className={inputCls}
                      value={draft.store_code ?? ""}
                      onChange={e => { upd("store_code", e.target.value || null); setTenpoMsg(null) }}
                      onBlur={() => { blurCommit(); if ((draft.store_code ?? "").trim()) lookupTenpo() }}
                      onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); lookupTenpo() } }}
                      placeholder="コード入力 → Enter で検索"
                    />
                    <button
                      type="button"
                      onClick={lookupTenpo}
                      disabled={tenpoLoading}
                      className="px-3 py-1.5 rounded bg-[var(--bg-2)] border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] shrink-0 transition-colors disabled:opacity-50"
                    >
                      {tenpoLoading ? "検索中…" : "検索"}
                    </button>
                  </div>
                </label>
                {tenpoMsg && (
                  <p className={cn("text-[0.72rem] mt-1", tenpoMsg.type === "error" ? "text-red-400" : "text-[var(--text-2)]")}>
                    {tenpoMsg.text}
                  </p>
                )}
              </div>
              <div className="col-span-2">{T("店舗名", "store_name")}</div>
              {T("店舗郵便番号", "store_postal_code")}
              {T("店舗電話番号", "store_phone")}
              <div className="col-span-2">{T("店舗住所", "store_address")}</div>
              <div className="col-span-2">{Furi("店舗住所 読み仮名（保存されません）", "furi_store_address")}</div>
              {T("通勤方法", "commute_method")}
              {T("通勤距離", "commute_distance")}
              <div className="col-span-2">{T("ルートURL", "commute_route_url")}</div>
            </div>
          </section>

          {/* ⑤ 荷物 */}
          <section className="flex flex-col gap-3">
            {title("⑤ 荷物")}
            <div className="grid grid-cols-2 gap-3">
              {T("発送日時", "luggage_pickup_datetime", "datetime-local")}
              {T("着日時", "luggage_delivery_datetime", "datetime-local")}
            </div>
            {Chk("受取完了", "luggage_received")}
          </section>

          {/* ⑥ ライフライン */}
          <section className="flex flex-col gap-3">
            {title("⑥ ライフライン")}

            <div className="flex flex-col gap-2">
              <p className="text-[0.78rem] font-medium text-[var(--text-2)]">電気</p>
              <div className="grid grid-cols-2 gap-3">
                {T("停止日", "electricity_stop_date", "date")}
                {T("開始日", "electricity_start_date", "date")}
              </div>
              {Chk("完了", "electricity_done")}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[0.78rem] font-medium text-[var(--text-2)]">水道</p>
              <div className="grid grid-cols-2 gap-3">
                {T("停止日", "water_stop_date", "date")}
                {T("開始日", "water_start_date", "date")}
              </div>
              {Chk("完了", "water_done")}
            </div>

            <div className="flex flex-col gap-2">
              <p className="text-[0.78rem] font-medium text-[var(--text-2)]">ガス</p>
              <div className="grid grid-cols-2 gap-3">
                {T("停止日", "gas_stop_date", "date")}
                {T("開始日", "gas_start_date", "date")}
                {T("立ち会い日時", "gas_tachiai_datetime", "datetime-local", !!draft.gas_tachiai_unnecessary)}
                {NumT("保証金", "gas_deposit")}
              </div>
              {Chk("立ち会い不要", "gas_tachiai_unnecessary")}
              {Chk("完了", "gas_done")}
            </div>
          </section>

          {/* ⑦ 行政手続き */}
          <section className="flex flex-col gap-2">
            {title("⑦ 行政手続き")}
            <p className="text-[0.68rem] text-[var(--text-3)]">担当メモは保存されません</p>
            <table className="w-full text-[0.78rem] border-collapse">
              <thead>
                <tr className="text-left text-[var(--text-3)]">
                  <th className="label-xs font-normal pb-1 pr-2">手続き</th>
                  <th className="label-xs font-normal pb-1 pr-2">完了日</th>
                  <th className="label-xs font-normal pb-1 pr-2">担当メモ</th>
                  <th className="label-xs font-normal pb-1 text-center">完了</th>
                </tr>
              </thead>
              <tbody>
                {([
                  ["転出届", "tenshutsu_date", "tenshutsu_done", "tantou_tenshutsu"],
                  ["転入届", "tennyu_date", "tennyu_done", "tantou_tennyu"],
                  ["転居届", "tenkyo_date", "tenkyo_done", "tantou_tenkyo"],
                ] as const).map(([label, dateK, doneK, tantouK]) => (
                  <tr key={label}>
                    <td className="py-1 pr-2 whitespace-nowrap text-[var(--text)]">{label}</td>
                    <td className="py-1 pr-2">
                      <input
                        type="date"
                        className={inputCls}
                        value={(draft?.[dateK] as string | null | undefined) ?? ""}
                        onChange={e => upd(dateK, e.target.value || null)}
                        onBlur={blurCommit}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <input
                        className={inputCls}
                        value={local[tantouK]}
                        onChange={e => setLocal(l => ({ ...l, [tantouK]: e.target.value }))}
                      />
                    </td>
                    <td className="py-1 text-center">
                      <input
                        type="checkbox"
                        className="accent-[var(--text)]"
                        checked={!!draft?.[doneK]}
                        onChange={e => toggle(doneK, e.target.checked)}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          {/* Archive / delete */}
          <div className="flex items-center gap-2">
            {!doneReady && (
              <button
                onClick={archive}
                className="px-3 py-1.5 rounded text-[0.72rem] border border-[var(--border)] text-[var(--text-3)] hover:text-[var(--text)] transition-colors"
              >
                アーカイブ
              </button>
            )}
            {draft?.id && (
              <button
                onClick={async () => {
                  if (!draft.id) return
                  await deleteWorkerLocation(draft.id)
                  setDraft(null)
                  setLocal(EMPTY_LOCAL)
                  setLeoPhone(null)
                  setLocs(prev => (prev ?? []).filter(l => l.id !== draft.id))
                }}
                className="px-3 py-1.5 rounded text-[0.72rem] border border-[var(--border)] text-[var(--text-3)] hover:text-red-400 hover:border-red-400 transition-colors"
              >
                削除
              </button>
            )}
          </div>
        </>
      )}

      {/* Past moves */}
      {history.length > 0 && (
        <div>
          <button
            onClick={() => setHistoryOpen(o => !o)}
            className="flex items-center gap-1.5 label-xs mb-2 border-b border-[var(--border)] pb-1 w-full hover:text-[var(--text)] transition-colors"
          >
            過去の移動履歴
            <Icon name={historyOpen ? "expand_less" : "expand_more"} size={14} />
            <span className="ml-auto font-normal text-[var(--text-3)]">{history.length}</span>
          </button>
          {historyOpen && (
            <div className="flex flex-col gap-2">
              {history
                .slice()
                .sort((a, b) => b.move_number - a.move_number)
                .map(loc => (
                  <div key={loc.id} className="flex flex-col gap-1 p-3 bg-[var(--bg-2)] rounded border border-[var(--border)]">
                    <div className="flex items-center justify-between">
                      <span className="text-[0.72rem] font-semibold text-[var(--text)]">
                        Move {loc.move_number}
                        {loc.is_archived && <span className="ml-2 text-[0.62rem] font-normal text-[var(--text-3)]">アーカイブ済み</span>}
                      </span>
                      <button
                        onClick={() => deleteHistory(loc.id)}
                        className="text-[0.65rem] text-[var(--text-3)] hover:text-red-400 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                    {loc.first_work_date && <span className="text-[0.68rem] text-[var(--text-3)]">初出勤: {loc.first_work_date}</span>}
                    {loc.housing_address && <span className="text-[0.72rem] text-[var(--text-3)] truncate">{loc.housing_address}</span>}
                    {loc.store_name && <span className="text-[0.72rem] text-[var(--text-2)]">店舗: {loc.store_name}</span>}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
