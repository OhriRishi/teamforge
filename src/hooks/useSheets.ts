import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useAppData } from '@/components/AppDataProvider'
import {
  SheetFolder,
  SheetPage,
  CreateSheetFolderData,
  CreateSheetData,
  UpdateSheetData,
  UpdateSheetFolderData,
  SheetsState
} from '@/types/sheets'

export function useSheets() {
  const { user } = useAuth()
  const { team, currentSeason } = useAppData()
  const [state, setState] = useState<SheetsState>({
    folders: [],
    sheets: [],
    isLoading: true,
    error: undefined
  })

  const saveTimeoutRef = useRef<NodeJS.Timeout | undefined>(undefined)
  const hasLoadedRef = useRef(false)
  const lastLoadKeyRef = useRef<string>('')

  // Fetch all sheets data
  const fetchSheetsData = useCallback(async () => {
    if (!user || !team) {
      setState(prev => ({ ...prev, isLoading: false }))
      return
    }

    if (!currentSeason) {
      setState(prev => ({
        ...prev,
        folders: [],
        sheets: [],
        isLoading: false,
        error: 'No season available. Please create a season to use sheets.'
      }))
      return
    }

    try {
      setState(prev => ({ ...prev, isLoading: true, error: undefined }))

      // Fetch folders with folder_type = 'sheet'
      const { data: folders, error: foldersError } = await supabase
        .from('notebook_folders')
        .select('*')
        .eq('team_id', team.id)
        .eq('season_id', currentSeason.id)
        .eq('folder_type', 'sheet')
        .order('sort_order', { ascending: true })

      if (foldersError) throw foldersError

      // Fetch sheets (pages with page_type = 'sheet')
      const { data: sheets, error: sheetsError } = await supabase
        .from('notebook_pages')
        .select('*')
        .eq('team_id', team.id)
        .eq('season_id', currentSeason.id)
        .eq('page_type', 'sheet')
        .order('sort_order', { ascending: true })

      if (sheetsError) throw sheetsError

      // Build folder tree with children and sheet counts
      const folderMap = new Map<string, SheetFolder>()
      const rootFolders: SheetFolder[] = []

      // Initialize folders
      folders?.forEach(folder => {
        const folderWithChildren: SheetFolder = {
          ...folder,
          folder_type: 'sheet' as const,
          children: [],
          sheets: [],
          sheet_count: 0
        }
        folderMap.set(folder.id, folderWithChildren)
      })

      // Build folder hierarchy
      folderMap.forEach(folder => {
        if (folder.parent_folder_id) {
          const parent = folderMap.get(folder.parent_folder_id)
          if (parent) {
            parent.children = parent.children || []
            parent.children.push(folder)
          }
        } else {
          rootFolders.push(folder)
        }
      })

      // Assign sheets to folders and count
      const typedSheets: SheetPage[] = (sheets || []).map(sheet => ({
        ...sheet,
        page_type: 'sheet' as const
      }))

      typedSheets.forEach(sheet => {
        if (sheet.folder_id) {
          const folder = folderMap.get(sheet.folder_id)
          if (folder) {
            folder.sheets = folder.sheets || []
            folder.sheets.push(sheet)
            folder.sheet_count = (folder.sheet_count || 0) + 1
          }
        }
      })

      setState(prev => ({
        ...prev,
        folders: rootFolders,
        sheets: typedSheets,
        isLoading: false
      }))

    } catch (error) {
      console.error('Error fetching sheets data:', error, JSON.stringify(error, null, 2))
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Failed to load sheets data'
      }))
    }
  }, [user, team, currentSeason])

  // Create a new folder
  const createFolder = useCallback(async (data: CreateSheetFolderData): Promise<SheetFolder | null> => {
    if (!user || !team || !currentSeason) return null

    try {
      const { data: folder, error } = await supabase
        .from('notebook_folders')
        .insert({
          team_id: team.id,
          season_id: currentSeason.id,
          name: data.name,
          parent_folder_id: data.parent_folder_id,
          color: data.color || '#6366f1',
          folder_type: 'sheet',
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      await fetchSheetsData()
      return { ...folder, folder_type: 'sheet' as const }
    } catch (error) {
      console.error('Error creating folder:', error)
      setState(prev => ({ ...prev, error: 'Failed to create folder' }))
      return null
    }
  }, [user, team, currentSeason, fetchSheetsData])

  // Create a new sheet
  const createSheet = useCallback(async (data: CreateSheetData): Promise<SheetPage | null> => {
    if (!user || !team || !currentSeason) return null

    try {
      const { data: sheet, error } = await supabase
        .from('notebook_pages')
        .insert({
          team_id: team.id,
          season_id: currentSeason.id,
          title: data.title || 'Untitled Sheet',
          folder_id: data.folder_id,
          page_type: 'sheet',
          content: { type: 'sheet', data: null },
          created_by: user.id,
          updated_by: user.id
        })
        .select()
        .single()

      if (error) throw error

      const typedSheet: SheetPage = { ...sheet, page_type: 'sheet' as const }

      // Update local state optimistically
      setState(prev => {
        const newSheets = [...prev.sheets, typedSheet]

        if (typedSheet.folder_id) {
          const updateFolderSheets = (folders: SheetFolder[]): SheetFolder[] => {
            return folders.map(folder => {
              if (folder.id === typedSheet.folder_id) {
                return {
                  ...folder,
                  sheets: [...(folder.sheets || []), typedSheet],
                  sheet_count: (folder.sheet_count || 0) + 1
                }
              }
              return {
                ...folder,
                children: folder.children ? updateFolderSheets(folder.children) : []
              }
            })
          }

          return {
            ...prev,
            sheets: newSheets,
            folders: updateFolderSheets(prev.folders)
          }
        }

        return {
          ...prev,
          sheets: newSheets
        }
      })

      return typedSheet
    } catch (error) {
      console.error('Error creating sheet:', error)
      setState(prev => ({ ...prev, error: 'Failed to create sheet' }))
      return null
    }
  }, [user, team, currentSeason])

  // Update a sheet
  const updateSheet = useCallback(async (id: string, data: UpdateSheetData, immediate = false) => {
    if (!user || !team || !currentSeason) return false

    const performUpdate = async () => {
      try {
        const updateData: Record<string, unknown> = {
          updated_by: user.id,
          updated_at: new Date().toISOString()
        }

        if (data.title !== undefined) updateData.title = data.title
        if (data.folder_id !== undefined) updateData.folder_id = data.folder_id
        if (data.is_pinned !== undefined) updateData.is_pinned = data.is_pinned
        if (data.sort_order !== undefined) updateData.sort_order = data.sort_order
        if (data.content !== undefined) updateData.content = data.content

        const { error } = await supabase
          .from('notebook_pages')
          .update(updateData)
          .eq('id', id)

        if (error) throw error

        // Update local state
        setState(prev => {
          const updateFolderSheets = (folders: SheetFolder[]): SheetFolder[] => {
            return folders.map(folder => ({
              ...folder,
              sheets: folder.sheets?.map(sheet =>
                sheet.id === id ? { ...sheet, ...data } : sheet
              ) || [],
              children: folder.children ? updateFolderSheets(folder.children) : []
            }))
          }

          return {
            ...prev,
            sheets: prev.sheets.map(sheet =>
              sheet.id === id ? { ...sheet, ...data } : sheet
            ),
            folders: updateFolderSheets(prev.folders),
            currentSheet: prev.currentSheet?.id === id
              ? { ...prev.currentSheet, ...data }
              : prev.currentSheet
          }
        })

        return true
      } catch (error) {
        console.error('Error updating sheet:', error)
        setState(prev => ({ ...prev, error: 'Failed to save sheet' }))
        return false
      }
    }

    if (immediate) {
      return await performUpdate()
    } else {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }

      saveTimeoutRef.current = setTimeout(async () => {
        await performUpdate()
      }, 1000)

      return true
    }
  }, [user, team, currentSeason])

  // Update a folder
  const updateFolder = useCallback(async (id: string, data: UpdateSheetFolderData): Promise<boolean> => {
    if (!user || !team || !currentSeason) return false

    try {
      const { error } = await supabase
        .from('notebook_folders')
        .update({
          ...data,
          updated_by: user.id
        })
        .eq('id', id)

      if (error) throw error

      await fetchSheetsData()
      return true
    } catch (error) {
      console.error('Error updating folder:', error)
      setState(prev => ({ ...prev, error: 'Failed to update folder' }))
      return false
    }
  }, [user, team, currentSeason, fetchSheetsData])

  // Delete a sheet
  const deleteSheet = useCallback(async (id: string): Promise<boolean> => {
    if (!user || !team || !currentSeason) return false

    try {
      const { error } = await supabase
        .from('notebook_pages')
        .delete()
        .eq('id', id)

      if (error) throw error

      setState(prev => ({
        ...prev,
        sheets: prev.sheets.filter(sheet => sheet.id !== id),
        currentSheet: prev.currentSheet?.id === id ? undefined : prev.currentSheet
      }))

      return true
    } catch (error) {
      console.error('Error deleting sheet:', error)
      setState(prev => ({ ...prev, error: 'Failed to delete sheet' }))
      return false
    }
  }, [user, team, currentSeason])

  // Delete a folder
  const deleteFolder = useCallback(async (id: string): Promise<boolean> => {
    if (!user || !team || !currentSeason) return false

    try {
      const { error } = await supabase
        .from('notebook_folders')
        .delete()
        .eq('id', id)

      if (error) throw error

      await fetchSheetsData()
      return true
    } catch (error) {
      console.error('Error deleting folder:', error)
      setState(prev => ({ ...prev, error: 'Failed to delete folder' }))
      return false
    }
  }, [user, team, currentSeason, fetchSheetsData])

  // Move sheet to different folder
  const moveSheetToFolder = useCallback(async (sheetId: string, folderId?: string): Promise<boolean> => {
    const success = await updateSheet(sheetId, { folder_id: folderId }, true)
    if (success) {
      await fetchSheetsData()
    }
    return success
  }, [updateSheet, fetchSheetsData])

  // Reorder sheet (move up or down)
  const reorderSheet = useCallback(async (sheetId: string, direction: 'up' | 'down'): Promise<boolean> => {
    if (!user || !team || !currentSeason) return false

    try {
      // Get current sheet
      const currentSheet = state.sheets.find(s => s.id === sheetId)
      if (!currentSheet) return false

      // Get siblings (sheets in the same folder or root)
      const siblings = state.sheets
        .filter(s => s.folder_id === currentSheet.folder_id)
        .sort((a, b) => a.sort_order - b.sort_order)

      const currentIndex = siblings.findIndex(s => s.id === sheetId)
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

      // Check bounds
      if (targetIndex < 0 || targetIndex >= siblings.length) return false

      const targetSheet = siblings[targetIndex]

      // Swap sort_order values
      const currentSortOrder = currentSheet.sort_order
      const targetSortOrder = targetSheet.sort_order

      // Update both sheets
      const { error: error1 } = await supabase
        .from('notebook_pages')
        .update({ sort_order: targetSortOrder, updated_by: user.id })
        .eq('id', sheetId)

      if (error1) throw error1

      const { error: error2 } = await supabase
        .from('notebook_pages')
        .update({ sort_order: currentSortOrder, updated_by: user.id })
        .eq('id', targetSheet.id)

      if (error2) throw error2

      // Refresh data
      await fetchSheetsData()
      return true
    } catch (error) {
      console.error('Error reordering sheet:', error)
      setState(prev => ({ ...prev, error: 'Failed to reorder sheet' }))
      return false
    }
  }, [user, team, currentSeason, state.sheets, fetchSheetsData])

  // Reorder sheet to a specific position (for drag-and-drop)
  const reorderSheetToPosition = useCallback(async (
    sheetId: string,
    targetSheetId: string,
    position: 'before' | 'after'
  ): Promise<boolean> => {
    if (!user || !team || !currentSeason) return false
    if (sheetId === targetSheetId) return false

    // Get both sheets
    const draggedSheet = state.sheets.find(s => s.id === sheetId)
    const targetSheet = state.sheets.find(s => s.id === targetSheetId)

    if (!draggedSheet || !targetSheet) return false

    // They must be in the same folder
    if (draggedSheet.folder_id !== targetSheet.folder_id) return false

    // Get all siblings in the same folder, sorted by sort_order
    const siblings = state.sheets
      .filter(s => s.folder_id === draggedSheet.folder_id)
      .sort((a, b) => a.sort_order - b.sort_order)

    // Remove the dragged sheet from its current position
    const withoutDragged = siblings.filter(s => s.id !== sheetId)

    // Find where to insert
    const targetIndex = withoutDragged.findIndex(s => s.id === targetSheetId)
    const insertIndex = position === 'before' ? targetIndex : targetIndex + 1

    // Insert dragged sheet at new position
    const reordered = [
      ...withoutDragged.slice(0, insertIndex),
      draggedSheet,
      ...withoutDragged.slice(insertIndex)
    ]

    // Create updated sheets with new sort_order values
    const updatedSheetIds = new Map<string, number>()
    reordered.forEach((sheet, index) => {
      updatedSheetIds.set(sheet.id, index)
    })

    // Optimistic update - update local state immediately
    setState(prev => {
      // Update sheets array
      const newSheets = prev.sheets.map(sheet => {
        const newSortOrder = updatedSheetIds.get(sheet.id)
        if (newSortOrder !== undefined) {
          return { ...sheet, sort_order: newSortOrder }
        }
        return sheet
      })

      // Update folders with their sheets
      const updateFolderSheets = (folders: SheetFolder[]): SheetFolder[] => {
        return folders.map(folder => {
          const updatedFolder = { ...folder }
          if (folder.sheets) {
            updatedFolder.sheets = folder.sheets.map(sheet => {
              const newSortOrder = updatedSheetIds.get(sheet.id)
              if (newSortOrder !== undefined) {
                return { ...sheet, sort_order: newSortOrder }
              }
              return sheet
            })
          }
          if (folder.children) {
            updatedFolder.children = updateFolderSheets(folder.children)
          }
          return updatedFolder
        })
      }

      return {
        ...prev,
        sheets: newSheets,
        folders: updateFolderSheets(prev.folders)
      }
    })

    // Save to database in the background (don't await)
    const saveToDatabase = async () => {
      try {
        for (const [id, sortOrder] of updatedSheetIds) {
          const { error } = await supabase
            .from('notebook_pages')
            .update({ sort_order: sortOrder, updated_by: user.id })
            .eq('id', id)

          if (error) throw error
        }
      } catch (error) {
        console.error('Error saving reorder to database:', error)
        // Optionally refresh data to get back to correct state on error
        // fetchSheetsData()
      }
    }

    saveToDatabase()
    return true
  }, [user, team, currentSeason, state.sheets])

  // Reorder folder (move up or down)
  const reorderFolder = useCallback(async (folderId: string, direction: 'up' | 'down'): Promise<boolean> => {
    if (!user || !team || !currentSeason) return false

    try {
      // Find the folder and its siblings
      const findFolderAndSiblings = (folders: SheetFolder[], parentId?: string): { folder: SheetFolder; siblings: SheetFolder[] } | null => {
        for (const f of folders) {
          if (f.id === folderId) {
            // Found! Get siblings from parent
            const parent = parentId ? folders.find(p => p.id === parentId) : null
            const siblings = parent?.children || folders.filter(s => !s.parent_folder_id)
            return { folder: f, siblings: siblings.sort((a, b) => a.sort_order - b.sort_order) }
          }
          if (f.children) {
            const result = findFolderAndSiblings(f.children, f.id)
            if (result) return result
          }
        }
        return null
      }

      // For root folders
      const rootFolders = state.folders.filter(f => !f.parent_folder_id).sort((a, b) => a.sort_order - b.sort_order)
      const currentFolder = rootFolders.find(f => f.id === folderId)

      let siblings: SheetFolder[]
      let folder: SheetFolder | undefined

      if (currentFolder) {
        siblings = rootFolders
        folder = currentFolder
      } else {
        // Search in nested folders
        const result = findFolderAndSiblings(state.folders, undefined)
        if (!result) return false
        siblings = result.siblings
        folder = result.folder
      }

      if (!folder) return false

      const currentIndex = siblings.findIndex(s => s.id === folderId)
      const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1

      if (targetIndex < 0 || targetIndex >= siblings.length) return false

      const targetFolder = siblings[targetIndex]

      // Swap sort_order values
      const currentSortOrder = folder.sort_order
      const targetSortOrder = targetFolder.sort_order

      const { error: error1 } = await supabase
        .from('notebook_folders')
        .update({ sort_order: targetSortOrder, updated_by: user.id })
        .eq('id', folderId)

      if (error1) throw error1

      const { error: error2 } = await supabase
        .from('notebook_folders')
        .update({ sort_order: currentSortOrder, updated_by: user.id })
        .eq('id', targetFolder.id)

      if (error2) throw error2

      await fetchSheetsData()
      return true
    } catch (error) {
      console.error('Error reordering folder:', error)
      setState(prev => ({ ...prev, error: 'Failed to reorder folder' }))
      return false
    }
  }, [user, team, currentSeason, state.folders, fetchSheetsData])

  // Set current sheet
  const setCurrentSheet = useCallback((sheet?: SheetPage) => {
    setState(prev => ({ ...prev, currentSheet: sheet }))
  }, [])

  // Set current folder
  const setCurrentFolder = useCallback((folder?: SheetFolder) => {
    setState(prev => ({ ...prev, currentFolder: folder }))
  }, [])

  // Load sheets data on mount and when team/season changes
  useEffect(() => {
    if (!user || !team || !currentSeason) {
      return
    }

    const loadKey = `${user.id}-${team.id}-${currentSeason.id}`

    if (!hasLoadedRef.current || lastLoadKeyRef.current !== loadKey) {
      lastLoadKeyRef.current = loadKey
      hasLoadedRef.current = true
      fetchSheetsData()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, team?.id, currentSeason?.id])

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  return {
    ...state,
    createFolder,
    createSheet,
    updateSheet,
    updateFolder,
    deleteSheet,
    deleteFolder,
    moveSheetToFolder,
    reorderSheet,
    reorderSheetToPosition,
    reorderFolder,
    setCurrentSheet,
    setCurrentFolder,
    refreshData: fetchSheetsData
  }
}
