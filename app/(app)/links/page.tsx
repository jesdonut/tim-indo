"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  getLinks,
  addLink as addLinkAction,
  removeLink as removeLinkAction,
  updateLink as updateLinkAction,
  togglePin as togglePinAction,
  renameCategory as renameCategoryAction,
} from "@/app/actions/teams"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent } from "@/components/PageHeader"
import type { TeamLink } from "@/components/links/useLinks"

const CATEGORY_ORDER = ["グラスプ", "データ", "コンパス社", "ライフライン"]

function linkIcon(url: string) {
  if (url.includes("drive.google.com"))            return { label: "Drive",  color: "text-blue-500" }
  if (url.includes("docs.google.com/spreadsheets")) return { label: "Sheet", color: "text-green-600" }
  if (url.includes("docs.google.com/forms"))        return { label: "Form",  color: "text-violet-500" }
  if (url.includes("docs.google.com/document"))     return { label: "Doc",   color: "text-blue-600" }
  return { label: "Link", color: "text-[var(--text-3)]" }
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "2-digit", month: "numeric", day: "numeric" })
}

type EditForm = { title: string; url: string; category: string }

export default function LinksPage() {
  const [links, setLinks]         = useState<TeamLink[]>([])
  const [loading, setLoading]     = useState(true)
  const [userName, setUserName]   = useState("Team")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editingId, setEditingId]       = useState<string | null>(null)
  const [editingCat, setEditingCat]     = useState<string | null>(null)
  const [editCatValue, setEditCatValue] = useState("")
  const editCatRef = useRef<HTMLInputElement>(null)
  const [editForm, setEditForm]   = useState<EditForm>({ title: "", url: "", category: "" })
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState({ title: "", url: "", category: "" })
  const titleRef     = useRef<HTMLInputElement>(null)
  const editTitleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.name) setUserName(user.user_metadata.name)
    })
    getLinks().then(data => {
      setLinks(data as TeamLink[])
      setLoading(false)
    })
  }, [])

  const pinned  = useMemo(() => links.filter(l => l.pinned), [links])

  const grouped = useMemo(() => {
    const unpinned = links.filter(l => !l.pinned)
    const map = new Map<string, TeamLink[]>()
    for (const link of unpinned) {
      const cat = link.category || "その他"
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(link)
    }
    const ordered: [string, TeamLink[]][] = []
    for (const cat of CATEGORY_ORDER) {
      if (map.has(cat)) ordered.push([cat, map.get(cat)!])
    }
    for (const [cat, items] of map) {
      if (!CATEGORY_ORDER.includes(cat)) ordered.push([cat, items])
    }
    return ordered
  }, [links])

  const allCategories = useMemo(() => {
    const cats = new Set(links.map(l => l.category).filter(Boolean))
    return [...CATEGORY_ORDER.filter(c => cats.has(c)), ...([...cats].filter(c => !CATEGORY_ORDER.includes(c)))]
  }, [links])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.url.trim() || !form.category.trim()) return
    const url = form.url.startsWith("http") ? form.url : `https://${form.url}`
    await addLinkAction(form.title.trim(), url, form.category.trim(), userName)
    const data = await getLinks()
    setLinks(data as TeamLink[])
    setForm({ title: "", url: "", category: "" })
    setAdding(false)
  }

  async function handleDelete(id: string) {
    if (confirmId !== id) { setConfirmId(id); return }
    await removeLinkAction(id)
    setLinks(prev => prev.filter(l => l.id !== id))
    setConfirmId(null)
  }

  function startEdit(link: TeamLink) {
    setEditingId(link.id)
    setEditForm({ title: link.title, url: link.url, category: link.category })
    setConfirmId(null)
    setTimeout(() => editTitleRef.current?.focus(), 50)
  }

  async function handleSaveEdit(id: string) {
    if (!editForm.title.trim() || !editForm.url.trim()) return
    const url = editForm.url.startsWith("http") ? editForm.url : `https://${editForm.url}`
    await updateLinkAction(id, { title: editForm.title.trim(), url, category: editForm.category.trim() })
    setLinks(prev => prev.map(l => l.id === id ? { ...l, ...editForm, url } : l))
    setEditingId(null)
  }

  function startEditCat(cat: string) {
    setEditingCat(cat)
    setEditCatValue(cat)
    setTimeout(() => editCatRef.current?.focus(), 50)
  }

  async function handleRenameCat(oldName: string) {
    const newName = editCatValue.trim()
    if (!newName || newName === oldName) { setEditingCat(null); return }
    await renameCategoryAction(oldName, newName)
    setLinks(prev => prev.map(l => l.category === oldName ? { ...l, category: newName } : l))
    setEditingCat(null)
  }

  async function handleTogglePin(id: string, current: boolean) {
    await togglePinAction(id, !current)
    setLinks(prev => prev.map(l => l.id === id ? { ...l, pinned: !current } : l))
  }

  useEffect(() => {
    if (adding) setTimeout(() => titleRef.current?.focus(), 50)
  }, [adding])

  useEffect(() => {
    if (!confirmId) return
    const handler = () => setConfirmId(null)
    setTimeout(() => window.addEventListener("click", handler), 0)
    return () => window.removeEventListener("click", handler)
  }, [confirmId])

  if (loading) return (
    <div className="flex items-center justify-center h-[calc(100dvh-48px)] text-sm text-[var(--text-3)]">Loading...</div>
  )

  return (
    <div>
      <PageHeader title="Links" right={
        <button
          onClick={() => setAdding(v => !v)}
          className={cn(
            "px-3 py-1.5 rounded border text-[0.78rem] font-medium transition-all",
            adding
              ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
              : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)]"
          )}
        >
          {adding ? "Cancel" : "+ Add link"}
        </button>
      } />
      <PageContent>

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} className="mb-6 p-4 border border-[var(--border)] rounded bg-[var(--surface)] flex flex-col gap-3">
          <p className="label-xs">New link</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.68rem] text-[var(--text-3)] uppercase tracking-wider">Title</label>
              <input ref={titleRef} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Link name" required
                className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.68rem] text-[var(--text-3)] uppercase tracking-wider">Category</label>
              <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                placeholder="e.g. グラスプ" list="cat-list" required
                className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)]" />
              <datalist id="cat-list">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-[0.68rem] text-[var(--text-3)] uppercase tracking-wider">URL</label>
            <input value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
              placeholder="https://..." required
              className="bg-[var(--bg-2)] border border-[var(--border)] rounded px-3 py-2 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)] placeholder:text-[var(--text-3)] font-mono text-[0.78rem]" />
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-[0.68rem] text-[var(--text-3)]">Added as: {userName}</span>
            <button type="submit" className="px-4 py-2 rounded bg-[var(--text)] text-[var(--bg)] text-[0.78rem] font-semibold hover:opacity-80 transition-opacity">Add</button>
          </div>
        </form>
      )}

      {/* Links */}
      <div className="flex flex-col gap-5">

        {/* Pinned section */}
        {pinned.length > 0 && (
          <div className="border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-[var(--surface)] border-b border-[var(--border)]">
              <p className="label-xs">Pinned</p>
            </div>
            <div className="divide-y divide-[var(--border-soft)]">
              {pinned.map(link => (
                <LinkRow key={link.id} link={link} editingId={editingId} editForm={editForm}
                  setEditForm={setEditForm} editTitleRef={editTitleRef} confirmId={confirmId}
                  allCategories={allCategories}
                  onEdit={startEdit} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditingId(null)}
                  onDelete={handleDelete} onPin={handleTogglePin} setConfirmId={setConfirmId} />
              ))}
            </div>
          </div>
        )}

        {/* Category groups */}
        {grouped.map(([category, items]) => (
          <div key={category} className="border border-[var(--border)] rounded-lg overflow-hidden">
            <div className="px-4 py-2 bg-[var(--surface)] border-b border-[var(--border)] flex items-center gap-2">
              {editingCat === category ? (
                <input
                  ref={editCatRef}
                  value={editCatValue}
                  onChange={e => setEditCatValue(e.target.value)}
                  onBlur={() => handleRenameCat(category)}
                  onKeyDown={e => { if (e.key === "Enter") handleRenameCat(category); if (e.key === "Escape") setEditingCat(null) }}
                  className="label-xs bg-transparent outline-none border-b border-[var(--text-2)] text-[var(--text)] w-40"
                />
              ) : (
                <div className="group/cat flex items-center gap-1.5">
                  <span className="label-xs">{category}</span>
                  <button onClick={() => startEditCat(category)} title="Rename category"
                    className="opacity-0 group-hover/cat:opacity-100 text-[var(--text-3)] hover:text-[var(--text)] text-[0.7rem] transition-opacity leading-none">
                    ✎
                  </button>
                </div>
              )}
            </div>
            <div className="divide-y divide-[var(--border-soft)]">
              {items.map(link => (
                <LinkRow key={link.id} link={link} editingId={editingId} editForm={editForm}
                  setEditForm={setEditForm} editTitleRef={editTitleRef} confirmId={confirmId}
                  allCategories={allCategories}
                  onEdit={startEdit} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditingId(null)}
                  onDelete={handleDelete} onPin={handleTogglePin} setConfirmId={setConfirmId} />
              ))}
            </div>
          </div>
        ))}

        {links.length === 0 && (
          <p className="text-sm text-[var(--text-3)] text-center py-12">No links yet. Add the first one above.</p>
        )}
      </div>
      </PageContent>
    </div>
  )
}

type RowProps = {
  link: TeamLink
  editingId: string | null
  editForm: EditForm
  setEditForm: (f: EditForm | ((p: EditForm) => EditForm)) => void
  editTitleRef: React.RefObject<HTMLInputElement | null>
  confirmId: string | null
  allCategories: string[]
  onEdit: (link: TeamLink) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onPin: (id: string, current: boolean) => void
  setConfirmId: (id: string | null) => void
}

function LinkRow({ link, editingId, editForm, setEditForm, editTitleRef, confirmId, allCategories,
  onEdit, onSaveEdit, onCancelEdit, onDelete, onPin, setConfirmId }: RowProps) {
  const icon = linkIcon(link.url)
  const isEditing = editingId === link.id
  const isPending = confirmId === link.id

  if (isEditing) {
    return (
      <div className="px-4 py-3 flex flex-col gap-2 bg-[var(--bg-2)]">
        <div className="grid grid-cols-2 gap-2">
          <input ref={editTitleRef} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
            placeholder="Title"
            className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
          <input value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
            placeholder="Category" list="cat-list-edit"
            className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
          <datalist id="cat-list-edit">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
        </div>
        <input value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
          placeholder="https://..."
          className="bg-[var(--bg)] border border-[var(--border)] rounded px-2.5 py-1.5 text-[0.78rem] font-mono text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
        <div className="flex gap-2 justify-end">
          <button onClick={onCancelEdit} className="px-3 py-1 rounded border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Cancel</button>
          <button onClick={() => onSaveEdit(link.id)} className="px-3 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-[0.72rem] font-medium hover:opacity-80 transition-opacity">Save</button>
        </div>
      </div>
    )
  }

  return (
    <div className={cn("flex items-center gap-3 px-4 py-2.5 group", isPending && "bg-red-500/5")}>
      <span className={cn("text-[0.6rem] font-bold w-8 shrink-0", icon.color)}>{icon.label}</span>

      <a href={link.url} target="_blank" rel="noopener noreferrer"
        className="flex-1 text-[0.85rem] text-[var(--text)] hover:text-[var(--highlight-text)] hover:underline underline-offset-2 truncate transition-colors min-w-0">
        {link.title}
      </a>

      <div className="shrink-0 flex items-center gap-2 text-[0.62rem] text-[var(--text-3)] hidden sm:flex">
        {link.added_by && <span>{link.added_by}</span>}
        {link.created_at && <span className="hidden md:block">{shortDate(link.created_at)}</span>}
      </div>

      {isPending ? (
        <div className="flex items-center gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
          <span className="text-[0.7rem] text-red-400">Delete?</span>
          <button onClick={() => onDelete(link.id)} className="px-2 py-0.5 rounded bg-red-500 text-white text-[0.68rem] font-medium hover:bg-red-600 transition-colors">Yes</button>
          <button onClick={() => setConfirmId(null)} className="px-2 py-0.5 rounded border border-[var(--border)] text-[0.68rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">No</button>
        </div>
      ) : (
        <div className="shrink-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onPin(link.id, link.pinned ?? false)}
            title={link.pinned ? "Unpin" : "Pin to top"}
            className={cn("w-6 h-6 flex items-center justify-center rounded text-[0.75rem] transition-colors",
              link.pinned ? "text-[var(--highlight-text)]" : "text-[var(--text-3)] hover:text-[var(--highlight-text)]")}>
            {link.pinned ?? false ? "★" : "☆"}
          </button>
          <button onClick={() => onEdit(link)}
            title="Edit"
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--text)] text-[0.72rem] transition-colors">
            ✎
          </button>
          <button onClick={() => onDelete(link.id)}
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-red-400 text-sm transition-colors">
            ×
          </button>
        </div>
      )}
    </div>
  )
}
