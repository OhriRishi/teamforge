'use client'

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import { SheetsSidebar } from '@/components/sheets/SheetsSidebar'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useSheetsContext } from '@/components/SheetsProvider'
import { useAuth } from '@/components/AuthProvider'
import { useAppData } from '@/components/AppDataProvider'
import { useUniverSave } from '@/hooks/useUniverSave'
import type { SheetPage, SheetFolder } from '@/types/sheets'
import type { IWorkbookData } from '@univerjs/core'
import { Table, FileSpreadsheet, FolderOpen, X, MoreVertical, Folder, Loader2, Plus, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetFolderDialog } from '@/components/sheets/SheetFolderDialog'
import { useDebouncedCallback } from 'use-debounce'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'

// Dynamically import Univer component (client-side only)
const UniverSheetComponent = dynamic(() => import('@/components/UniverSheetComponent'), {
  ssr: false,
})

export default function SheetDetailPage() {
  const params = useParams()
  const router = useRouter()
  const sheetId = params.sheetId as string
  const { user } = useAuth()
  const { team, currentSeason } = useAppData()
  const { mutate: saveUniver } = useUniverSave()

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)
  const [sidebarSize, setSidebarSize] = useState<number | null>(null)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)
  const [sheetTitle, setSheetTitle] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [hasPendingSave, setHasPendingSave] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState(false)

  // Load sidebar size from localStorage on mount
  useEffect(() => {
    const savedSize = localStorage.getItem('sheets-sidebar-size')
    if (savedSize) {
      const size = parseInt(savedSize, 10)
      if (size >= 15 && size <= 40) {
        setSidebarSize(size)
      } else {
        setSidebarSize(25)
      }
    } else {
      setSidebarSize(25)
    }
  }, [])

  const {
    folders,
    sheets,
    currentSheet,
    currentFolder,
    isLoading,
    error,
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
    setCurrentFolder
  } = useSheetsContext()

  // Track if we're loading a specific sheet
  const [isLoadingSheet, setIsLoadingSheet] = useState(true)

  // Set current sheet based on URL parameter
  useEffect(() => {
    // When sheetId changes, start loading
    setIsLoadingSheet(true)

    if (sheetId && sheets.length > 0) {
      const sheet = sheets.find(s => s.id === sheetId)
      if (sheet) {
        if (sheet.id !== currentSheet?.id) {
          setCurrentSheet(sheet)
          setSheetTitle(sheet.title)
          setCurrentFolder(undefined)
        } else if (!sheetTitle) {
          setSheetTitle(sheet.title)
        }
        // Sheet found, stop loading
        setIsLoadingSheet(false)
      } else if (!isLoading) {
        // Sheet not found, redirect to sheets home
        router.push('/sheets')
        setIsLoadingSheet(false)
      }
    } else if (sheetId && !isLoading && sheets.length === 0) {
      // No sheets exist, redirect
      router.push('/sheets')
      setIsLoadingSheet(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetId, isLoading, sheets])

  // Update current sheet when sheets array changes (e.g., after title update)
  useEffect(() => {
    if (currentSheet && sheets.length > 0) {
      const updatedSheet = sheets.find(s => s.id === currentSheet.id)
      if (updatedSheet && updatedSheet.title !== currentSheet.title) {
        setCurrentSheet(updatedSheet)
      }
    }
  }, [sheets, currentSheet, setCurrentSheet])

  // Debounced save function (for auto-save)
  const debouncedSave = useDebouncedCallback(
    useCallback((workbookData: unknown, title: string) => {
      if (!currentSheet || !team || !currentSeason || !user) return

      console.log('Auto-save triggered')
      setHasPendingSave(false)
      setIsSaving(true)
      setSaveError(false)
      saveUniver(
        {
          pageId: currentSheet.id,
          teamId: team.id,
          seasonId: currentSeason.id,
          workbookData,
          userId: user.id,
          metadata: { title },
        },
        {
          onSuccess: () => {
            console.log('Auto-save successful!')
            setIsSaving(false)
            setSaveSuccess(true)
            setSaveError(false)
          },
          onError: (err) => {
            console.error('Auto-save failed:', err)
            setIsSaving(false)
            setSaveSuccess(false)
            setSaveError(true)
          },
        }
      )
    }, [currentSheet, team, currentSeason, user, saveUniver]),
    3000 // 3 second debounce for auto-save
  )

  // Handle data changes from Univer
  const handleSheetChange = (workbookData: unknown) => {
    setHasPendingSave(true)
    setSaveSuccess(false)
    debouncedSave(workbookData, sheetTitle)
  }

  // Handle title change
  const handleTitleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTitle = e.target.value
    setSheetTitle(newTitle)
    setHasPendingSave(true)
    setSaveSuccess(false)
    if (currentSheet) {
      debouncedSave(currentSheet.content?.data, newTitle)
    }
  }

  const handleCreateSheet = useCallback(async (data: { title: string; folder_id?: string }) => {
    const newSheet = await createSheet(data)
    if (newSheet) {
      // Set the current sheet immediately to avoid flickering
      setCurrentSheet(newSheet)
      setSheetTitle(newSheet.title)
      // Then navigate to the new sheet URL
      router.push(`/sheets/${newSheet.id}`)
    }
  }, [createSheet, setCurrentSheet, router])

  const handleCreateFolder = useCallback(async (data: { name: string; parent_folder_id?: string; color?: string }) => {
    await createFolder(data)
  }, [createFolder])

  const handleUpdateFolder = useCallback(async (id: string, data: { name?: string; parent_folder_id?: string | null; color?: string }) => {
    await updateFolder(id, data)
  }, [updateFolder])

  const handleDeleteSheet = useCallback(async (id: string) => {
    if (id === sheetId) {
      // If deleting current sheet, navigate back to sheets home
      router.push('/sheets')
    }
    await deleteSheet(id)
  }, [sheetId, router, deleteSheet])

  const handleDeleteFolder = useCallback(async (id: string) => {
    await deleteFolder(id)
  }, [deleteFolder])

  const handleMoveSheetToFolder = useCallback(async (pageId: string, folderId?: string) => {
    await moveSheetToFolder(pageId, folderId)
  }, [moveSheetToFolder])

  const handleUpdateSheetMetadata = useCallback(async (id: string, data: { title?: string; is_pinned?: boolean }) => {
    await updateSheet(id, data, true)
    // Update local title if it's the current sheet
    if (id === currentSheet?.id && data.title) {
      setSheetTitle(data.title)
    }
  }, [updateSheet, currentSheet])

  const handleSelectSheet = useCallback((sheet: SheetPage) => {
    // Navigate to the selected sheet
    router.push(`/sheets/${sheet.id}`)
  }, [router])

  const handleSelectFolder = useCallback((folder?: SheetFolder) => {
    setCurrentFolder(folder)
    setCurrentSheet(undefined)
    // Navigate to sheets home when selecting a folder
    if (folder) {
      router.push(`/sheets?folder=${folder.id}`)
    } else {
      router.push('/sheets')
    }
  }, [setCurrentFolder, setCurrentSheet, router])

  const handleMobileSelectSheet = useCallback((sheet: SheetPage) => {
    handleSelectSheet(sheet)
    setIsMobileSidebarOpen(false)
  }, [handleSelectSheet])

  const handlePanelResize = useCallback((sizes: number[]) => {
    const newSize = sizes[0]
    if (newSize !== undefined) {
      setSidebarSize(newSize)
      localStorage.setItem('sheets-sidebar-size', newSize.toString())
    }
  }, [])

  // Action buttons for the top navigation
  const actionButtons = useMemo(() => (
    <>
      {/* Mobile/Medium sidebar toggle */}
      <Button
        variant="outline"
        size="sm"
        className="xl:hidden"
        onClick={() => setIsMobileSidebarOpen(!isMobileSidebarOpen)}
      >
        {isMobileSidebarOpen ? (
          <>
            <X className="w-4 h-4 mr-2" />
            Close
          </>
        ) : (
          <>
            <FolderOpen className="w-4 h-4 mr-2" />
            View sheets
          </>
        )}
      </Button>

      {/* Mobile/Medium dropdown menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="xl:hidden">
            <MoreVertical className="w-4 h-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => setIsFolderDialogOpen(true)}>
            <Folder className="w-4 h-4 mr-2" />
            Add Folder
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleCreateSheet({ title: 'Untitled Sheet' })}>
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            New Sheet
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Desktop action buttons - hidden on mobile and medium screens */}
      <div className="hidden xl:flex items-center gap-2">
        <Button
          variant="default"
          size="sm"
          className="btn-accent"
          onClick={() => setIsFolderDialogOpen(true)}
        >
          <Folder className="w-4 h-4 mr-2" />
          New Folder
        </Button>
        <Button
          variant="default"
          size="sm"
          className="btn-accent"
          onClick={() => handleCreateSheet({ title: 'Untitled Sheet' })}
        >
          <Plus className="w-4 h-4 mr-2" />
          New Sheet
        </Button>
      </div>

      {/* Shared folder dialog for both mobile and desktop */}
      <SheetFolderDialog
        folders={folders}
        onCreateFolder={handleCreateFolder}
        open={isFolderDialogOpen}
        onOpenChange={setIsFolderDialogOpen}
        trigger={<span className="hidden" />}
      />
    </>
  ), [isMobileSidebarOpen, folders, handleCreateFolder, handleCreateSheet, isFolderDialogOpen])

  if (isLoading) {
    return (
      <ProtectedRoute>
        <DashboardLayout pageTitle="Sheets" pageIcon={Table} actions={actionButtons} disableContentScroll={true}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading sheets...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  if (error) {
    return (
      <ProtectedRoute>
        <DashboardLayout pageTitle="Sheets" pageIcon={Table} actions={actionButtons} disableContentScroll={true}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-destructive mb-2">Error loading sheets</p>
              <p className="text-muted-foreground text-sm">{error}</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute>
      <DashboardLayout pageTitle="Sheets" pageIcon={Table} actions={actionButtons} disableContentScroll={true}>
        {/* Mobile/Medium Sidebar Overlay */}
        {isMobileSidebarOpen && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 bg-black/50 z-40 xl:hidden"
              onClick={() => setIsMobileSidebarOpen(false)}
            />

            {/* Sidebar */}
            <div className="fixed inset-y-0 left-0 w-80 max-w-[85vw] bg-background z-50 xl:hidden">
              <SheetsSidebar
                folders={folders}
                sheets={sheets}
                currentSheet={currentSheet}
                currentFolder={currentFolder}
                onCreateSheet={handleCreateSheet}
                onSelectSheet={handleMobileSelectSheet}
                onSelectFolder={handleSelectFolder}
                onDeleteSheet={handleDeleteSheet}
                onDeleteFolder={handleDeleteFolder}
                onUpdateSheet={handleUpdateSheetMetadata}
                onUpdateFolder={handleUpdateFolder}
                onMoveSheetToFolder={handleMoveSheetToFolder}
                onReorderSheet={reorderSheet}
                onReorderSheetToPosition={reorderSheetToPosition}
                onReorderFolder={reorderFolder}
              />
            </div>
          </>
        )}

        {/* Desktop Layout with Resizable Panels - Only show on large screens when size is loaded */}
        <div className="h-full hidden xl:flex">
          {sidebarSize !== null && (
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full w-full"
              onLayout={handlePanelResize}
            >
            <ResizablePanel defaultSize={sidebarSize} minSize={15} maxSize={40}>
              <SheetsSidebar
                folders={folders}
                sheets={sheets}
                currentSheet={currentSheet}
                currentFolder={currentFolder}
                onCreateSheet={handleCreateSheet}
                onSelectSheet={handleSelectSheet}
                onSelectFolder={handleSelectFolder}
                onDeleteSheet={handleDeleteSheet}
                onDeleteFolder={handleDeleteFolder}
                onUpdateSheet={handleUpdateSheetMetadata}
                onUpdateFolder={handleUpdateFolder}
                onMoveSheetToFolder={handleMoveSheetToFolder}
                onReorderSheet={reorderSheet}
                onReorderSheetToPosition={reorderSheetToPosition}
                onReorderFolder={reorderFolder}
              />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={100 - sidebarSize} className="overflow-hidden">
              {isLoadingSheet ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">Loading sheet...</p>
                  </div>
                </div>
              ) : currentSheet ? (
                <div className="flex flex-col h-full">
                  {/* Header - matching notebook style */}
                  <div className="border-b bg-background sticky top-0 z-20">
                    <div className="px-4 md:px-8 py-4 md:py-6">
                      <div className="flex items-start gap-3 md:gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <FileSpreadsheet className="w-6 h-6 text-muted-foreground flex-shrink-0 mt-1" />
                            <input
                              type="text"
                              value={sheetTitle}
                              onChange={handleTitleChange}
                              className="text-2xl md:text-4xl font-bold bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:placeholder:text-muted-foreground/30 transition-all"
                              placeholder="Untitled sheet"
                            />
                          </div>
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            {(isSaving || hasPendingSave) && (
                              <div className="flex items-center gap-1 text-blue-600">
                                <Loader2 className="w-3 h-3 animate-spin" />
                                <span>Saving...</span>
                              </div>
                            )}
                            {saveSuccess && !isSaving && !hasPendingSave && (
                              <div className="flex items-center gap-1 text-green-600">
                                <Check className="w-3 h-3" />
                                <span>Saved</span>
                              </div>
                            )}
                            {saveError && !isSaving && !hasPendingSave && (
                              <div className="flex items-center gap-1 text-red-600">
                                <AlertCircle className="w-3 h-3" />
                                <span>Save failed - will retry</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Spreadsheet */}
                  <div className="flex-1 relative min-h-[500px]">
                    <UniverSheetComponent
                      key={currentSheet.id}
                      containerId={`univer-${currentSheet.id}`}
                      height="100%"
                      data={currentSheet.content?.data as IWorkbookData | null | undefined}
                      onChange={handleSheetChange}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full p-4">
                  <div className="text-center max-w-md">
                    <FileSpreadsheet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-medium mb-2">Sheet not found</h3>
                    <p className="text-muted-foreground text-sm md:text-base mb-4">
                      The sheet you&apos;re looking for doesn&apos;t exist or may have been deleted.
                    </p>
                    <Button onClick={() => router.push('/sheets')}>
                      Back to Sheets
                    </Button>
                  </div>
                </div>
              )}
            </ResizablePanel>
          </ResizablePanelGroup>
          )}
        </div>

        {/* Mobile/Medium fallback */}
        <div className="h-full xl:hidden flex flex-col">
          {isLoadingSheet ? (
            <div className="flex items-center justify-center flex-1">
              <div className="text-center">
                <Loader2 className="w-8 h-8 animate-spin text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">Loading sheet...</p>
              </div>
            </div>
          ) : currentSheet ? (
            <div className="flex flex-col h-full">
              {/* Header - matching notebook style */}
              <div className="border-b bg-background sticky top-0 z-20">
                <div className="px-4 py-4">
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <FileSpreadsheet className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                        <input
                          type="text"
                          value={sheetTitle}
                          onChange={handleTitleChange}
                          className="text-xl font-bold bg-transparent border-none outline-none w-full placeholder:text-muted-foreground/50 focus:placeholder:text-muted-foreground/30 transition-all"
                          placeholder="Untitled sheet"
                        />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        {(isSaving || hasPendingSave) && (
                          <div className="flex items-center gap-1 text-blue-600">
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Saving...</span>
                          </div>
                        )}
                        {saveSuccess && !isSaving && !hasPendingSave && (
                          <div className="flex items-center gap-1 text-green-600">
                            <Check className="w-3 h-3" />
                            <span>Saved</span>
                          </div>
                        )}
                        {saveError && !isSaving && !hasPendingSave && (
                          <div className="flex items-center gap-1 text-red-600">
                            <AlertCircle className="w-3 h-3" />
                            <span>Save failed</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Spreadsheet */}
              <div className="flex-1 relative min-h-[500px]">
                <UniverSheetComponent
                  key={currentSheet.id}
                  containerId={`univer-mobile-${currentSheet.id}`}
                  height="100%"
                  data={currentSheet.content?.data as IWorkbookData | null | undefined}
                  onChange={handleSheetChange}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center flex-1 p-4">
              <div className="text-center max-w-md">
                <FileSpreadsheet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Sheet not found</h3>
                <p className="text-muted-foreground text-sm md:text-base mb-4">
                  The sheet you&apos;re looking for doesn&apos;t exist or may have been deleted.
                </p>
                <Button onClick={() => router.push('/sheets')}>
                  Back to Sheets
                </Button>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}
