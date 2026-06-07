"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  getLinks,
  addLink as addLinkAction,
  removeLink as removeLinkAction,
  updateLink as updateLinkAction,
  togglePin as togglePinAction,
  reorderLinks as reorderLinksAction,
} from "@/app/actions/teams"
import { createClient } from "@/lib/supabase/client"
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { cn } from "@/lib/cn"
import { PageHeader, PageContent } from "@/components/PageHeader"
import { Icon } from "@/components/Icon"
import type { TeamLink } from "@/components/links/useLinks"

const CATEGORY_ORDER = ["グラスプ", "データ", "コンパス社", "ライフライン"]

function linkIcon(url: string) {
  if (url.includes("drive.google.com"))             return { label: "Drive", color: "text-blue-500" }
  if (url.includes("docs.google.com/spreadsheets")) return { label: "Sheet", color: "text-green-600" }
  if (url.includes("docs.google.com/forms"))        return { label: "Form",  color: "text-violet-500" }
  if (url.includes("docs.google.com/document"))     return { label: "Doc",   color: "text-blue-600" }
  return { label: "Link", color: "text-[var(--text-3)]" }
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString("ja-JP", { year: "2-digit", month: "numeric", day: "numeric" })
}

function sortLinks(links: TeamLink[]): TeamLink[] {
  return [...links].sort((a, b) => {
    const ao = a.sort_order, bo = b.sort_order
    if (ao != null && bo != null) return ao - bo
    if (ao != null) return -1
    if (bo != null) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })
}

type EditForm = { title: string; url: string; category: string }

export default function MoodboardPage() {
  const [links, setLinks]         = useState<TeamLink[]>([])
  const [loading, setLoading]     = useState(true)
  const [userName, setUserName]   = useState("Team")
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm]   = useState<EditForm>({ title: "", url: "", category: "" })
  const [adding, setAdding]       = useState(false)
  const [form, setForm]           = useState({ title: "", url: "", category: "" })
  const [filter, setFilter]       = useState<string | null>(null)
  const titleRef     = useRef<HTMLInputElement>(null)
  const editTitleRef = useRef<HTMLInputElement>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.user_metadata?.name) setUserName(user.user_metadata.name)
    })
    getLinks().then(data => {
      setLinks(sortLinks(data as TeamLink[]))
      setLoading(false)
    })
  }, [])

  const ordered = useMemo(() => sortLinks(links), [links])

  const allCategories = useMemo(() => {
    const cats = new Set(links.map(l => l.category).filter(Boolean))
    return [...CATEGORY_ORDER.filter(c => cats.has(c)), ...[...cats].filter(c => !CATEGORY_ORDER.includes(c))]
  }, [links])

  const visible = useMemo(
    () => (filter ? ordered.filter(l => l.category === filter) : ordered),
    [ordered, filter]
  )
  const canDrag = filter === null

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.url.trim() || !form.category.trim()) return
    const url = form.url.startsWith("http") ? form.url : `https://${form.url}`
    await addLinkAction(form.title.trim(), url, form.category.trim(), userName)
    const data = await getLinks()
    setLinks(sortLinks(data as TeamLink[]))
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

  async function handleTogglePin(id: string, current: boolean) {
    await togglePinAction(id, !current)
    setLinks(prev => prev.map(l => l.id === id ? { ...l, pinned: !current } : l))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = ordered.findIndex(l => l.id === active.id)
    const newIdx = ordered.findIndex(l => l.id === over.id)
    if (oldIdx < 0 || newIdx < 0) return
    const next = arrayMove(ordered, oldIdx, newIdx).map((l, i) => ({ ...l, sort_order: i }))
    setLinks(next)
    reorderLinksAction(next.map(l => l.id))
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
      <PageHeader title="Moodboard" right={
        <button
          onClick={() => setAdding(v => !v)}
          className={cn(
            "px-3 py-1.5 rounded border text-[0.78rem] font-medium transition-all",
            adding
              ? "border-[var(--text)] bg-[var(--text)] text-[var(--bg)]"
              : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)]"
          )}
        >
          {adding ? "Cancel" : "+ Add card"}
        </button>
      } />
      <PageContent>

      {/* Add form */}
      {adding && (
        <form onSubmit={handleAdd} className="mb-6 p-4 border border-[var(--border)] rounded-lg bg-[var(--surface)] flex flex-col gap-3">
          <p className="label-xs">New card</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <label className="text-[0.68rem] text-[var(--text-3)] uppercase tracking-wider">Title</label>
              <input ref={titleRef} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Card name" required
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

      {/* Category filter */}
      {allCategories.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-5">
          <FilterChip label="All" active={filter === null} onClick={() => setFilter(null)} count={links.length} />
          {allCategories.map(cat => (
            <FilterChip key={cat} label={cat} active={filter === cat} onClick={() => setFilter(cat)}
              count={links.filter(l => l.category === cat).length} />
          ))}
        </div>
      )}

      {/* Grid */}
      {links.length === 0 ? (
        <p className="text-sm text-[var(--text-3)] text-center py-12">No cards yet. Add the first one above.</p>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={visible.map(l => l.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
              {visible.map(link => (
                <Card key={link.id} link={link} canDrag={canDrag}
                  isEditing={editingId === link.id} editForm={editForm} setEditForm={setEditForm}
                  editTitleRef={editTitleRef} allCategories={allCategories}
                  isPending={confirmId === link.id} setConfirmId={setConfirmId}
                  onEdit={startEdit} onSaveEdit={handleSaveEdit} onCancelEdit={() => setEditingId(null)}
                  onDelete={handleDelete} onPin={handleTogglePin} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
      </PageContent>
    </div>
  )
}

function FilterChip({ label, active, onClick, count }: { label: string; active: boolean; onClick: () => void; count: number }) {
  return (
    <button onClick={onClick}
      className={cn(
        "px-2.5 py-1 rounded-full text-[0.72rem] font-medium transition-colors border",
        active
          ? "bg-[var(--text)] text-[var(--bg)] border-[var(--text)]"
          : "border-[var(--border)] text-[var(--text-2)] hover:text-[var(--text)] hover:border-[var(--text-2)]"
      )}>
      {label}<span className={cn("ml-1.5", active ? "text-[var(--bg)]/60" : "text-[var(--text-3)]")}>{count}</span>
    </button>
  )
}

type CardProps = {
  link: TeamLink
  canDrag: boolean
  isEditing: boolean
  editForm: EditForm
  setEditForm: (f: EditForm | ((p: EditForm) => EditForm)) => void
  editTitleRef: React.RefObject<HTMLInputElement | null>
  allCategories: string[]
  isPending: boolean
  setConfirmId: (id: string | null) => void
  onEdit: (link: TeamLink) => void
  onSaveEdit: (id: string) => void
  onCancelEdit: () => void
  onDelete: (id: string) => void
  onPin: (id: string, current: boolean) => void
}

function Card({ link, canDrag, isEditing, editForm, setEditForm, editTitleRef, allCategories,
  isPending, setConfirmId, onEdit, onSaveEdit, onCancelEdit, onDelete, onPin }: CardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: link.id, disabled: !canDrag })
  const icon = linkIcon(link.url)
  const pinned = link.pinned ?? false

  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }

  if (isEditing) {
    return (
      <div ref={setNodeRef} style={style}
        className="flex flex-col gap-1.5 p-3 rounded-lg border border-[var(--text-2)] bg-[var(--bg-2)]">
        <input ref={editTitleRef} value={editForm.title} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))}
          placeholder="Title"
          className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-sm text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
        <input value={editForm.category} onChange={e => setEditForm(f => ({ ...f, category: e.target.value }))}
          placeholder="Category" list="cat-list-edit"
          className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-[0.78rem] text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
        <datalist id="cat-list-edit">{allCategories.map(c => <option key={c} value={c} />)}</datalist>
        <input value={editForm.url} onChange={e => setEditForm(f => ({ ...f, url: e.target.value }))}
          placeholder="https://..."
          className="bg-[var(--bg)] border border-[var(--border)] rounded px-2 py-1.5 text-[0.7rem] font-mono text-[var(--text)] outline-none focus:border-[var(--text-2)]" />
        <div className="flex gap-2 justify-end pt-0.5">
          <button onClick={onCancelEdit} className="px-3 py-1 rounded border border-[var(--border)] text-[0.72rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">Cancel</button>
          <button onClick={() => onSaveEdit(link.id)} className="px-3 py-1 rounded bg-[var(--text)] text-[var(--bg)] text-[0.72rem] font-medium hover:opacity-80 transition-opacity">Save</button>
        </div>
      </div>
    )
  }

  return (
    <div ref={setNodeRef} style={style}
      {...(canDrag ? { ...attributes, ...listeners } : {})}
      className={cn(
        "group relative h-28 flex flex-col p-3 rounded-lg border bg-[var(--surface)] transition-colors outline-none",
        canDrag && "cursor-grab active:cursor-grabbing",
        pinned ? "border-[var(--highlight-text)] ring-1 ring-[var(--highlight-text)]/30" : "border-[var(--border)] hover:border-[var(--text-3)]",
        isPending && "border-red-400/60"
      )}>

      {/* Top row: type badge + drag hint */}
      <div className="flex items-center gap-1.5 mb-2">
        <span className={cn("text-[0.58rem] font-bold uppercase tracking-wider", icon.color)}>{icon.label}</span>
        {pinned && <Icon name="star" size={12} className="text-[var(--highlight-text)]" />}
        <span className="flex-1" />
        {canDrag && (
          <span className="text-[var(--text-3)] opacity-0 group-hover:opacity-100 transition-opacity flex items-center" title="Drag to rearrange">
            <Icon name="drag_indicator" size={15} />
          </span>
        )}
      </div>

      {/* Title — opens the link (a plain click navigates; drag only starts after moving 5px) */}
      <a href={link.url} target="_blank" rel="noopener noreferrer"
        onClick={e => e.stopPropagation()}
        className="flex-1 min-h-0 text-[0.88rem] font-medium leading-snug text-[var(--text)] hover:text-[var(--highlight-text)] transition-colors line-clamp-2 break-words">
        {link.title}
      </a>

      {/* Footer: category + meta */}
      <div className="mt-1.5 flex items-center gap-1.5">
        <span className="px-1.5 py-0.5 rounded bg-[var(--bg-2)] text-[0.55rem] text-[var(--text-3)] truncate">{link.category}</span>
        <span className="flex-1" />
        {link.added_by && <span className="text-[0.55rem] text-[var(--text-3)] shrink-0">{link.added_by}</span>}
        {link.created_at && <span className="text-[0.52rem] text-[var(--text-3)] shrink-0">· {shortDate(link.created_at)}</span>}
      </div>

      {/* Hover / confirm actions */}
      {isPending ? (
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 py-2 bg-[var(--surface)] border-t border-red-400/40 rounded-b-lg"
          onClick={e => e.stopPropagation()}>
          <span className="text-[0.7rem] text-red-400">Delete?</span>
          <button onClick={() => onDelete(link.id)} className="px-2 py-0.5 rounded bg-red-500 text-white text-[0.68rem] font-medium hover:bg-red-600 transition-colors">Yes</button>
          <button onClick={() => setConfirmId(null)} className="px-2 py-0.5 rounded border border-[var(--border)] text-[0.68rem] text-[var(--text-2)] hover:text-[var(--text)] transition-colors">No</button>
        </div>
      ) : (
        <div className="absolute top-2 right-2 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity bg-[var(--surface)]/80 backdrop-blur-sm rounded">
          <button onClick={() => onPin(link.id, pinned)} title={pinned ? "Unpin" : "Pin"}
            className={cn("w-6 h-6 flex items-center justify-center rounded transition-colors",
              pinned ? "text-[var(--highlight-text)]" : "text-[var(--text-3)] hover:text-[var(--highlight-text)]")}>
            <Icon name={pinned ? "star" : "star_border"} size={15} />
          </button>
          <button onClick={() => onEdit(link)} title="Edit"
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-[var(--text)] transition-colors">
            <Icon name="edit" size={14} />
          </button>
          <button onClick={() => onDelete(link.id)} title="Delete"
            className="w-6 h-6 flex items-center justify-center rounded text-[var(--text-3)] hover:text-red-400 transition-colors">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}
    </div>
  )
}
