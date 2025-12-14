'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SheetsSidebar } from '@/components/sheets/SheetsSidebar'
import { DashboardLayout } from '@/components/DashboardLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { useSheetsContext } from '@/components/SheetsProvider'
import type { SheetPage, SheetFolder } from '@/types/sheets'
import { Table, Plus, X, FolderOpen, MoreVertical, Folder, FileSpreadsheet } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SheetFolderDialog } from '@/components/sheets/SheetFolderDialog'
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

function SheetsPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(true)
  const [sidebarSize, setSidebarSize] = useState<number | null>(null)
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false)

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

  // Handle folder selection from query parameter
  useEffect(() => {
    const folderId = searchParams.get('folder')
    if (folderId && folders.length > 0) {
      // Find the folder recursively
      const findFolder = (folders: SheetFolder[]): SheetFolder | undefined => {
        for (const folder of folders) {
          if (folder.id === folderId) return folder
          if (folder.children) {
            const found = findFolder(folder.children)
            if (found) return found
          }
        }
        return undefined
      }

      const folder = findFolder(folders)
      if (folder && folder.id !== currentFolder?.id) {
        setCurrentFolder(folder)
        setCurrentSheet(undefined)
      }
    } else if (!folderId && currentFolder) {
      // Clear folder selection if no query param
      setCurrentFolder(undefined)
    }
  }, [searchParams, folders, currentFolder, setCurrentFolder, setCurrentSheet])


  const handleCreateSheet = async (data: { title: string; folder_id?: string }) => {
    const newSheet = await createSheet(data)
    if (newSheet) {
      // Set the current sheet immediately to avoid flickering
      setCurrentSheet(newSheet)
      // Then navigate to the new sheet URL
      router.push(`/sheets/${newSheet.id}`)
    }
  }

  const handleCreateFolder = async (data: { name: string; parent_folder_id?: string; color?: string }) => {
    await createFolder(data)
  }

  const handleUpdateFolder = async (id: string, data: { name?: string; parent_folder_id?: string | null; color?: string }) => {
    await updateFolder(id, data)
  }

  const handleDeleteSheet = async (id: string) => {
    await deleteSheet(id)
  }

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id)
  }

  const handleMoveSheetToFolder = async (sheetId: string, folderId?: string) => {
    await moveSheetToFolder(sheetId, folderId)
  }

  const handleUpdateSheetMetadata = async (id: string, data: { title?: string; is_pinned?: boolean }) => {
    await updateSheet(id, data, true)
  }

  const handleSelectSheet = (sheet: SheetPage) => {
    // Navigate to the selected sheet
    router.push(`/sheets/${sheet.id}`)
  }

  const handleSelectFolder = (folder?: SheetFolder) => {
    setCurrentFolder(folder)
    setCurrentSheet(undefined)
    // Navigate to update the URL with the folder parameter
    if (folder) {
      router.push(`/sheets?folder=${folder.id}`)
    } else {
      router.push('/sheets')
    }
  }

  const handlePanelResize = (sizes: number[]) => {
    const newSize = sizes[0]
    if (newSize !== undefined) {
      setSidebarSize(newSize)
      localStorage.setItem('sheets-sidebar-size', newSize.toString())
    }
  }

  // Action buttons for the top navigation
  const actionButtons = (
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
  )

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
                onSelectSheet={(sheet) => {
                  handleSelectSheet(sheet)
                  setIsMobileSidebarOpen(false) // Close sidebar when sheet is selected
                }}
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
                {currentFolder ? (
                  <div className="flex items-center justify-center h-full p-4">
                    <div className="text-center max-w-md">
                      <div
                        className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center"
                        style={{ backgroundColor: currentFolder.color || '#6366f1' }}
                      >
                        <FolderOpen className="w-8 h-8 text-white" />
                      </div>
                      <h3 className="text-lg font-medium mb-2">{currentFolder.name}</h3>
                      <p className="text-muted-foreground text-sm md:text-base mb-4">
                        Select a sheet from this folder or create a new one.
                      </p>
                      <div className="flex gap-2 justify-center">
                        <Button
                          onClick={() => handleCreateSheet({
                            title: 'Untitled Sheet',
                            folder_id: currentFolder.id
                          })}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          New Sheet in Folder
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full p-4">
                    <div className="flex flex-col items-center justify-center flex-1">
                      <div className="text-center max-w-md mb-6">
                        <Table className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                        <h3 className="text-lg font-medium mb-2">Welcome to Team Sheets</h3>
                        <p className="text-muted-foreground text-sm md:text-base mb-4">
                          Organize your team&apos;s data with spreadsheets and folders. Select a sheet from the sidebar or create a new one to get started.
                        </p>
                      </div>
                      <div className="flex gap-2">
                        <Button className="btn-accent" onClick={() => handleCreateSheet({ title: 'Untitled Sheet' })}>
                          <Plus className="w-4 h-4 mr-2" />
                          {sheets.length === 0 ? 'Create First Sheet' : 'Create New Sheet'}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </ResizablePanel>
            </ResizablePanelGroup>
          )}
        </div>

        {/* Mobile/Medium fallback - show content without resizable */}
        <div className="h-full xl:hidden">
          {currentFolder ? (
            <div className="flex items-center justify-center min-h-full p-4">
              <div className="text-center max-w-md">
                <div
                  className="w-16 h-16 rounded-lg mx-auto mb-4 flex items-center justify-center"
                  style={{ backgroundColor: currentFolder.color || '#6366f1' }}
                >
                  <FolderOpen className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-lg font-medium mb-2">{currentFolder.name}</h3>
                <p className="text-muted-foreground text-sm md:text-base mb-4">
                  Select a sheet from this folder or create a new one.
                </p>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={() => handleCreateSheet({
                      title: 'Untitled Sheet',
                      folder_id: currentFolder.id
                    })}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    New Sheet in Folder
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center min-h-full p-4">
              <div className="text-center max-w-md">
                <Table className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">Welcome to Team Sheets</h3>
                <p className="text-muted-foreground text-sm md:text-base mb-4">
                  Organize your team&apos;s data with spreadsheets and folders. Select a sheet from the sidebar or create a new one to get started.
                </p>
                <div className="flex flex-col gap-2 justify-center">
                  <Button className="btn-accent" onClick={() => handleCreateSheet({ title: 'Untitled Sheet' })}>
                    <Plus className="w-4 h-4 mr-2" />
                    {sheets.length === 0 ? 'Create First Sheet' : 'Create New Sheet'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DashboardLayout>
    </ProtectedRoute>
  )
}

export default function SheetsPage() {
  return (
    <Suspense fallback={
      <ProtectedRoute>
        <DashboardLayout pageTitle="Sheets" pageIcon={Table} disableContentScroll={true}>
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-muted-foreground">Loading sheets...</p>
            </div>
          </div>
        </DashboardLayout>
      </ProtectedRoute>
    }>
      <SheetsPageContent />
    </Suspense>
  )
}
