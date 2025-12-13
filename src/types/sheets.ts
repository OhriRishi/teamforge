export interface SheetFolder {
  id: string
  team_id: string
  season_id: string
  parent_folder_id?: string
  name: string
  color: string
  sort_order: number
  folder_type: 'sheet'
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string

  // Computed fields
  children?: SheetFolder[]
  sheets?: SheetPage[]
  sheet_count?: number
}

export interface SheetPage {
  id: string
  team_id: string
  season_id: string
  folder_id?: string
  title: string
  content?: { type: 'sheet'; data: unknown }
  content_text?: string
  is_pinned: boolean
  sort_order: number
  page_type: 'sheet'
  created_at: string
  updated_at: string
  created_by: string
  updated_by: string
}

export interface CreateSheetFolderData {
  name: string
  parent_folder_id?: string
  color?: string
}

export interface CreateSheetData {
  title: string
  folder_id?: string
}

export interface UpdateSheetData {
  title?: string
  folder_id?: string
  is_pinned?: boolean
  sort_order?: number
  content?: { type: 'sheet'; data: unknown }
}

export interface UpdateSheetFolderData {
  name?: string
  color?: string
  parent_folder_id?: string | null
  sort_order?: number
}

export interface SheetsState {
  folders: SheetFolder[]
  sheets: SheetPage[]
  currentSheet?: SheetPage
  currentFolder?: SheetFolder
  isLoading: boolean
  error?: string
}
