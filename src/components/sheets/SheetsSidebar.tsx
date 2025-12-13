'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { SheetFolder, SheetPage } from '@/types/sheets'
import { SheetFolderDialog } from './SheetFolderDialog'
import {
  Search,
  Plus,
  FileSpreadsheet,
  MoreHorizontal,
  Edit,
  Trash2,
  ChevronDown,
  ChevronRight,
  Folder,
  FolderOpen,
  GripVertical,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'

interface SheetsSidebarProps {
  folders: SheetFolder[]
  sheets: SheetPage[]
  currentSheet?: SheetPage
  currentFolder?: SheetFolder
  onCreateSheet: (data: { title: string; folder_id?: string }) => Promise<void>
  onSelectSheet: (sheet: SheetPage) => void
  onSelectFolder: (folder?: SheetFolder) => void
  onDeleteSheet: (id: string) => Promise<void>
  onDeleteFolder: (id: string) => Promise<void>
  onUpdateSheet: (id: string, data: { title?: string; is_pinned?: boolean }) => Promise<void>
  onUpdateFolder: (id: string, data: { name?: string; parent_folder_id?: string | null; color?: string }) => Promise<void>
  onMoveSheetToFolder: (sheetId: string, folderId?: string) => Promise<void>
  onReorderSheet?: (sheetId: string, direction: 'up' | 'down') => Promise<boolean>
  onReorderSheetToPosition?: (sheetId: string, targetSheetId: string, position: 'before' | 'after') => Promise<boolean>
  onReorderFolder?: (folderId: string, direction: 'up' | 'down') => Promise<boolean>
}

export function SheetsSidebar({
  folders,
  sheets,
  currentSheet,
  currentFolder,
  onCreateSheet,
  onSelectSheet,
  onSelectFolder,
  onDeleteSheet,
  onDeleteFolder,
  onUpdateSheet,
  onUpdateFolder,
  onMoveSheetToFolder,
  onReorderSheet,
  onReorderSheetToPosition,
  onReorderFolder: _onReorderFolder, // Folder reorder UI not yet implemented
}: SheetsSidebarProps) {
  // Suppress unused warning - folder reordering UI will be added later
  void _onReorderFolder
  // Helper function to get all folder IDs recursively
  const getAllFolderIds = useCallback((folders: SheetFolder[]): string[] => {
    const ids: string[] = []
    folders.forEach(folder => {
      ids.push(folder.id)
      if (folder.children && folder.children.length > 0) {
        ids.push(...getAllFolderIds(folder.children))
      }
    })
    return ids
  }, [])

  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())
  const [editingSheetId, setEditingSheetId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: 'sheet' | 'folder'; id: string; name: string } | null>(null)
  const [draggedSheet, setDraggedSheet] = useState<SheetPage | null>(null)
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null)
  const [dragOverSheet, setDragOverSheet] = useState<{ id: string; position: 'before' | 'after' } | null>(null)
  const [editingFolder, setEditingFolder] = useState<SheetFolder | null>(null)

  // Track if we just finished dragging to prevent click events from firing
  const justDraggedRef = useRef(false)
  const [showFolderDialog, setShowFolderDialog] = useState(false)

  // Auto-expand all folders when folders data changes
  useEffect(() => {
    const allFolderIds = getAllFolderIds(folders)
    setExpandedFolders(new Set(allFolderIds))
  }, [folders, getAllFolderIds])

  // Filter sheets based on search
  const filteredSheets = sheets.filter(sheet =>
    (sheet.title || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Get sheets without folders (root level)
  const rootSheets = sheets.filter(sheet => !sheet.folder_id)

  // Toggle folder expansion
  const toggleFolder = (folderId: string) => {
    const newExpanded = new Set(expandedFolders)
    if (newExpanded.has(folderId)) {
      newExpanded.delete(folderId)
    } else {
      newExpanded.add(folderId)
    }
    setExpandedFolders(newExpanded)
  }

  // Start editing sheet title
  const startEditingSheet = (sheet: SheetPage) => {
    setEditingSheetId(sheet.id)
    setEditingTitle(sheet.title)
  }

  // Save sheet title edit
  const saveSheetTitle = async () => {
    if (editingSheetId && editingTitle.trim()) {
      await onUpdateSheet(editingSheetId, { title: editingTitle.trim() })
    }
    setEditingSheetId(null)
    setEditingTitle('')
  }

  // Cancel sheet title edit
  const cancelEditingSheet = () => {
    setEditingSheetId(null)
    setEditingTitle('')
  }

  // Handle delete confirmation
  const handleDelete = async () => {
    if (!deleteConfirm) return

    if (deleteConfirm.type === 'sheet') {
      await onDeleteSheet(deleteConfirm.id)
    } else {
      await onDeleteFolder(deleteConfirm.id)
    }
    setDeleteConfirm(null)
  }

  // Drag and drop handlers
  const handleDragStart = (e: React.DragEvent, sheet: SheetPage) => {
    justDraggedRef.current = true
    setDraggedSheet(sheet)
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', sheet.id)
  }

  const handleDragEnd = () => {
    setDraggedSheet(null)
    setDragOverFolder(null)
    setDragOverSheet(null)
    // Keep the flag set briefly to prevent click from firing
    setTimeout(() => {
      justDraggedRef.current = false
    }, 100)
  }

  // Handle sheet click with drag protection
  const handleSheetClick = (sheet: SheetPage) => {
    // Don't navigate if we just finished dragging
    if (justDraggedRef.current) {
      return
    }
    onSelectSheet(sheet)
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDragEnter = (e: React.DragEvent, folderId: string | null) => {
    e.preventDefault()
    setDragOverFolder(folderId)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverFolder(null)
    }
  }

  // Handler for dragging over a sheet item (for reordering)
  const handleSheetDragOver = (e: React.DragEvent, targetSheet: SheetPage) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedSheet || draggedSheet.id === targetSheet.id) {
      setDragOverSheet(null)
      return
    }

    // Only allow reordering within the same folder
    if (draggedSheet.folder_id !== targetSheet.folder_id) {
      setDragOverSheet(null)
      return
    }

    // Determine if dropping before or after based on mouse position
    const rect = e.currentTarget.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const position = e.clientY < midY ? 'before' : 'after'

    setDragOverSheet({ id: targetSheet.id, position })
    setDragOverFolder(null) // Clear folder drag state when over a sheet
  }

  const handleSheetDragLeave = (e: React.DragEvent) => {
    // Only clear if leaving to outside the element
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverSheet(null)
    }
  }

  const handleSheetDrop = async (e: React.DragEvent, targetSheet: SheetPage) => {
    e.preventDefault()
    e.stopPropagation()

    if (!draggedSheet || !onReorderSheetToPosition) {
      setDraggedSheet(null)
      setDragOverSheet(null)
      return
    }

    // Only reorder within the same folder
    if (draggedSheet.folder_id === targetSheet.folder_id && draggedSheet.id !== targetSheet.id) {
      const rect = e.currentTarget.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const position = e.clientY < midY ? 'before' : 'after'

      try {
        await onReorderSheetToPosition(draggedSheet.id, targetSheet.id, position)
      } catch (error) {
        console.error('Error reordering sheet:', error)
      }
    }

    setDraggedSheet(null)
    setDragOverSheet(null)
  }

  const handleDrop = async (e: React.DragEvent, folderId?: string) => {
    e.preventDefault()
    if (!draggedSheet) return

    try {
      await onMoveSheetToFolder(draggedSheet.id, folderId)
    } catch (error) {
      console.error('Error moving sheet:', error)
    } finally {
      setDraggedSheet(null)
      setDragOverFolder(null)
    }
  }

  // Render folder tree recursively
  const renderFolder = (folder: SheetFolder, level = 0) => {
    const isExpanded = expandedFolders.has(folder.id)
    const isSelected = currentFolder?.id === folder.id
    const isDraggedOver = dragOverFolder === folder.id

    return (
      <div key={folder.id} className="select-none">
        <div
          className={`flex items-center gap-1 md:gap-2 pr-2 py-2 md:py-1.5 rounded-md text-sm cursor-pointer hover:bg-accent group min-h-[44px] md:min-h-auto ${
            isSelected ? 'bg-accent' : ''
          } ${isDraggedOver ? 'bg-blue-100 border-2 border-blue-400 border-dashed' : ''}`}
          style={{ paddingLeft: `${level * 8 + 4}px`, paddingRight: '8px' }}
          onClick={() => onSelectFolder(folder)}
          onDragOver={handleDragOver}
          onDragEnter={(e) => handleDragEnter(e, folder.id)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, folder.id)}
        >
          <button
            onClick={(e) => {
              e.stopPropagation()
              toggleFolder(folder.id)
            }}
            className="p-0.5 hover:bg-accent-foreground/10 rounded"
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>

          <div
            className="w-3 h-3 rounded-sm flex-shrink-0"
            style={{ backgroundColor: folder.color }}
          />

          {isExpanded ? (
            <FolderOpen className="w-4 h-4 text-muted-foreground" />
          ) : (
            <Folder className="w-4 h-4 text-muted-foreground" />
          )}

          <Tooltip>
            <TooltipTrigger asChild>
              <span className="flex-1 truncate">{folder.name}</span>
            </TooltipTrigger>
            <TooltipContent>
              {folder.name}
            </TooltipContent>
          </Tooltip>

          {folder.sheet_count !== undefined && folder.sheet_count > 0 && (
            <Badge variant="secondary" className="text-xs h-5">
              {folder.sheet_count}
            </Badge>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="w-3 h-3" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                onCreateSheet({ title: 'Untitled Sheet', folder_id: folder.id })
              }}>
                <Plus className="w-4 h-4 mr-2" />
                New Sheet
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={(e) => {
                e.stopPropagation()
                setEditingFolder(folder)
                setShowFolderDialog(true)
              }}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Folder
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={(e) => {
                  e.stopPropagation()
                  setDeleteConfirm({ type: 'folder', id: folder.id, name: folder.name })
                }}
                className="text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete Folder
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Folder sheets */}
        {isExpanded && folder.sheets && (() => {
          const folderSheets = folder.sheets.sort((a, b) => a.sort_order - b.sort_order)
          return folderSheets.map((sheet, index) => {
            const isDropTarget = dragOverSheet?.id === sheet.id
            const dropPosition = isDropTarget ? dragOverSheet.position : null

            return (
              <div key={sheet.id} className="relative">
                {/* Drop indicator line - before */}
                {isDropTarget && dropPosition === 'before' && (
                  <div
                    className="absolute left-4 right-2 h-0.5 bg-blue-500 rounded-full z-10"
                    style={{ top: 0, marginLeft: `${level * 8 + 24}px` }}
                  />
                )}

                <div
                  className={`flex items-center gap-1 md:gap-2 pr-2 py-2 md:py-1.5 rounded-md text-sm cursor-pointer hover:bg-accent group min-h-[44px] md:min-h-auto ${
                    currentSheet?.id === sheet.id ? 'bg-accent' : ''
                  } ${draggedSheet?.id === sheet.id ? 'opacity-50' : ''}`}
                  style={{ paddingLeft: `${level * 8 + 28}px`, paddingRight: '8px' }}
                  onClick={() => handleSheetClick(sheet)}
                  draggable={true}
                  onDragStart={(e) => handleDragStart(e, sheet)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleSheetDragOver(e, sheet)}
                  onDragLeave={handleSheetDragLeave}
                  onDrop={(e) => handleSheetDrop(e, sheet)}
                >
                  <GripVertical className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
                  <FileSpreadsheet className="w-4 h-4 text-muted-foreground flex-shrink-0" />

                  {editingSheetId === sheet.id ? (
                    <Input
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      onBlur={saveSheetTitle}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveSheetTitle()
                        if (e.key === 'Escape') cancelEditingSheet()
                      }}
                      className="h-6 text-sm flex-1"
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="flex-1 truncate">{sheet.title}</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        {sheet.title}
                      </TooltipContent>
                    </Tooltip>
                  )}

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-3 h-3" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => startEditingSheet(sheet)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Rename
                      </DropdownMenuItem>
                      {onReorderSheet && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => onReorderSheet(sheet.id, 'up')}
                            disabled={index === 0}
                          >
                            <ArrowUp className="w-4 h-4 mr-2" />
                            Move Up
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onReorderSheet(sheet.id, 'down')}
                            disabled={index === folderSheets.length - 1}
                          >
                            <ArrowDown className="w-4 h-4 mr-2" />
                            Move Down
                          </DropdownMenuItem>
                        </>
                      )}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        onClick={() => setDeleteConfirm({ type: 'sheet', id: sheet.id, name: sheet.title })}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Drop indicator line - after */}
                {isDropTarget && dropPosition === 'after' && (
                  <div
                    className="absolute left-4 right-2 h-0.5 bg-blue-500 rounded-full z-10"
                    style={{ bottom: 0, marginLeft: `${level * 8 + 24}px` }}
                  />
                )}
              </div>
            )
          })
        })()}

        {/* Subfolders */}
        {isExpanded && folder.children && folder.children.map(subfolder => (
          renderFolder(subfolder, level + 1)
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full bg-background border-r">
      {/* Header */}
      <div className="p-4 border-b">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold">Sheets</h2>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search sheets..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-2">
        {searchQuery ? (
          /* Search Results */
          <div className="space-y-1">
            <div className="px-2 py-1 text-xs font-medium text-muted-foreground">
              Search Results ({filteredSheets.length})
            </div>
            {filteredSheets.map(sheet => (
              <div
                key={sheet.id}
                className={`flex items-center gap-1 md:gap-2 pr-2 py-2 md:py-1.5 rounded-md text-sm cursor-pointer hover:bg-accent min-h-[44px] md:min-h-auto ${
                  currentSheet?.id === sheet.id ? 'bg-accent' : ''
                } ${draggedSheet?.id === sheet.id ? 'opacity-50' : ''}`}
                style={{ paddingLeft: '4px', paddingRight: '8px' }}
                onClick={() => handleSheetClick(sheet)}
                draggable={true}
                onDragStart={(e) => handleDragStart(e, sheet)}
                onDragEnd={handleDragEnd}
              >
                <GripVertical className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
                <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="flex-1 truncate">{sheet.title}</span>
                  </TooltipTrigger>
                  <TooltipContent>
                    {sheet.title}
                  </TooltipContent>
                </Tooltip>
              </div>
            ))}
          </div>
        ) : (
          /* Folder Tree */
          <div className="space-y-1">
            {/* Root folders */}
            {folders.map(folder => renderFolder(folder))}

            {/* Root sheets and drop zone */}
            {(rootSheets.length > 0 || draggedSheet) && (
              <>
                <div
                  className={`px-2 py-1 text-xs font-medium text-muted-foreground mt-4 ${
                    dragOverFolder === null && draggedSheet ? 'bg-blue-100 border-2 border-blue-400 border-dashed rounded' : ''
                  }`}
                  onDragOver={handleDragOver}
                  onDragEnter={(e) => handleDragEnter(e, null)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, undefined)}
                >
                  {rootSheets.length > 0 ? 'Uncategorized' : 'Drop here to remove from folder'}
                </div>
                {(() => {
                  const sortedRootSheets = rootSheets.sort((a, b) => a.sort_order - b.sort_order)
                  return sortedRootSheets.map((sheet, index) => {
                    const isDropTarget = dragOverSheet?.id === sheet.id
                    const dropPosition = isDropTarget ? dragOverSheet.position : null

                    return (
                      <div key={sheet.id} className="relative">
                        {/* Drop indicator line - before */}
                        {isDropTarget && dropPosition === 'before' && (
                          <div
                            className="absolute left-0 right-2 h-0.5 bg-blue-500 rounded-full z-10"
                            style={{ top: 0 }}
                          />
                        )}

                        <div
                          className={`flex items-center gap-1 md:gap-2 pr-2 py-2 md:py-1.5 rounded-md text-sm cursor-pointer hover:bg-accent group min-h-[44px] md:min-h-auto ${
                            currentSheet?.id === sheet.id ? 'bg-accent' : ''
                          } ${draggedSheet?.id === sheet.id ? 'opacity-50' : ''}`}
                          style={{ paddingLeft: '4px', paddingRight: '8px' }}
                          onClick={() => handleSheetClick(sheet)}
                          draggable={true}
                          onDragStart={(e) => handleDragStart(e, sheet)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) => handleSheetDragOver(e, sheet)}
                          onDragLeave={handleSheetDragLeave}
                          onDrop={(e) => handleSheetDrop(e, sheet)}
                        >
                          <GripVertical className="w-3 h-3 text-muted-foreground/50 opacity-0 group-hover:opacity-100 flex-shrink-0 cursor-grab" />
                          <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />

                          {editingSheetId === sheet.id ? (
                            <Input
                              value={editingTitle}
                              onChange={(e) => setEditingTitle(e.target.value)}
                              onBlur={saveSheetTitle}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveSheetTitle()
                                if (e.key === 'Escape') cancelEditingSheet()
                              }}
                              className="h-6 text-sm flex-1"
                              autoFocus
                              onClick={(e) => e.stopPropagation()}
                            />
                          ) : (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex-1 truncate">{sheet.title}</span>
                              </TooltipTrigger>
                              <TooltipContent>
                                {sheet.title}
                              </TooltipContent>
                            </Tooltip>
                          )}

                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <MoreHorizontal className="w-3 h-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => startEditingSheet(sheet)}>
                                <Edit className="w-4 h-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              {onReorderSheet && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => onReorderSheet(sheet.id, 'up')}
                                    disabled={index === 0}
                                  >
                                    <ArrowUp className="w-4 h-4 mr-2" />
                                    Move Up
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => onReorderSheet(sheet.id, 'down')}
                                    disabled={index === sortedRootSheets.length - 1}
                                  >
                                    <ArrowDown className="w-4 h-4 mr-2" />
                                    Move Down
                                  </DropdownMenuItem>
                                </>
                              )}
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirm({ type: 'sheet', id: sheet.id, name: sheet.title })}
                                className="text-destructive"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>

                        {/* Drop indicator line - after */}
                        {isDropTarget && dropPosition === 'after' && (
                          <div
                            className="absolute left-0 right-2 h-0.5 bg-blue-500 rounded-full z-10"
                            style={{ bottom: 0 }}
                          />
                        )}
                      </div>
                    )
                  })
                })()}
              </>
            )}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {deleteConfirm?.type === 'sheet' ? 'Sheet' : 'Folder'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete &quot;{deleteConfirm?.name}&quot;?
              {deleteConfirm?.type === 'folder' && ' This will also delete all sheets and subfolders inside it.'}
              {' '}This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Folder Dialog */}
      <SheetFolderDialog
        folders={folders}
        onCreateFolder={async () => {}}
        onUpdateFolder={onUpdateFolder}
        editFolder={editingFolder || undefined}
        open={showFolderDialog}
        onOpenChange={(open) => {
          setShowFolderDialog(open)
          if (!open) {
            setEditingFolder(null)
          }
        }}
        trigger={<span className="hidden" />}
      />
    </div>
  )
}
