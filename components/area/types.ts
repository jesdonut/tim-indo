export type Staff = {
  id: string
  name: string       // Japanese / display name
  nameEn: string
  color: string
}

export type PrefData = {
  assignedTo: string  // staff id or "unassigned"
  count: number       // manual count (pre-CSV)
}

export type Worker = {
  id: string
  name: string
  furigana?: string
  gender?: string
  birthdate?: string
  moveInDate?: string
  firstWorkDate?: string
  storeId?: string
  storeName?: string
  storeAddress?: string
  homeAddress?: string
  apartment?: string
  phone?: string
  status?: string
  assignedTo?: string  // overrides prefecture assignment
}

export type AreaState = {
  staff: Record<string, Staff>
  prefectures: Record<string, PrefData>
  rosters: Record<string, Worker[]>  // key = prefecture name
}

export type MapMode = "staff" | "count" | "unassigned"

export const MODE_LABELS: Record<MapMode, string> = {
  staff:      "担当者別",
  count:      "人数別",
  unassigned: "未割当",
}

export const DEFAULT_STAFF: Staff[] = []

export const EXTRA_COLORS = ["#f97316","#0891b2","#65a30d","#d97706","#6366f1","#db2777"]

export const MAX_CAPACITY = 70
