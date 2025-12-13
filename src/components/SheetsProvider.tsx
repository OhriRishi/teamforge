'use client'

import React, { createContext, useContext, ReactNode } from 'react'
import { useSheets } from '@/hooks/useSheets'
import type {
  SheetFolder,
  SheetPage,
  CreateSheetFolderData,
  CreateSheetData,
  UpdateSheetData,
  UpdateSheetFolderData
} from '@/types/sheets'

interface SheetsContextType {
  folders: SheetFolder[]
  sheets: SheetPage[]
  currentSheet?: SheetPage
  currentFolder?: SheetFolder
  isLoading: boolean
  error?: string
  createFolder: (data: CreateSheetFolderData) => Promise<SheetFolder | null>
  createSheet: (data: CreateSheetData) => Promise<SheetPage | null>
  updateSheet: (id: string, data: UpdateSheetData, immediate?: boolean) => Promise<boolean>
  updateFolder: (id: string, data: UpdateSheetFolderData) => Promise<boolean>
  deleteSheet: (id: string) => Promise<boolean>
  deleteFolder: (id: string) => Promise<boolean>
  moveSheetToFolder: (sheetId: string, folderId?: string) => Promise<boolean>
  reorderSheet: (sheetId: string, direction: 'up' | 'down') => Promise<boolean>
  reorderSheetToPosition: (sheetId: string, targetSheetId: string, position: 'before' | 'after') => Promise<boolean>
  reorderFolder: (folderId: string, direction: 'up' | 'down') => Promise<boolean>
  setCurrentSheet: (sheet?: SheetPage) => void
  setCurrentFolder: (folder?: SheetFolder) => void
  refreshData: () => Promise<void>
}

const SheetsContext = createContext<SheetsContextType | undefined>(undefined)

export function SheetsProvider({ children }: { children: ReactNode }) {
  const sheets = useSheets()

  return (
    <SheetsContext.Provider value={sheets}>
      {children}
    </SheetsContext.Provider>
  )
}

export function useSheetsContext() {
  const context = useContext(SheetsContext)
  if (context === undefined) {
    throw new Error('useSheetsContext must be used within a SheetsProvider')
  }
  return context
}
