'use client'

import { useEffect, useRef, useState } from 'react'
import { createUniver, defaultTheme } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core'
import type { IWorkbookData } from '@univerjs/core'
import '@univerjs/preset-sheets-core/lib/index.css'
import { useTheme } from '@/components/ThemeProvider'

// Import locale - TypeScript can't find types but runtime works
// @ts-expect-error - Locale file lacks TypeScript declarations
import enUS from '@univerjs/preset-sheets-core/lib/locales/en-US'

interface UniverSheetComponentProps {
    containerId: string
    height?: string | number
    width?: string | number
    data?: IWorkbookData | null
    onChange?: (data: IWorkbookData) => void
}

export default function UniverSheetComponent({
    containerId,
    height = '100%',
    width = '100%',
    data,
    onChange,
}: UniverSheetComponentProps) {
    const containerRef = useRef<HTMLDivElement>(null)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const univerRef = useRef<{ univer: any; univerAPI: any } | null>(null)
    const onChangeRef = useRef(onChange)
    const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null)
    const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null)
    const initAttemptRef = useRef(0)
    const [isLoading, setIsLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [containerReady, setContainerReady] = useState(false)
    // Store initial data to avoid re-initialization on data changes
    const initialDataRef = useRef(data)

    // Get theme from app context
    const { resolvedTheme } = useTheme()
    const isDarkMode = resolvedTheme === 'dark'
    // Store initial theme to use during initialization
    const initialThemeRef = useRef(isDarkMode)

    // Keep onChange ref updated
    useEffect(() => {
        onChangeRef.current = onChange
    }, [onChange])

    // Monitor container dimensions with ResizeObserver
    useEffect(() => {
        if (!containerRef.current) return

        const checkDimensions = () => {
            const rect = containerRef.current?.getBoundingClientRect()
            if (rect && rect.width > 100 && rect.height > 100) {
                setContainerReady(true)
                return true
            }
            return false
        }

        // Check immediately
        if (checkDimensions()) return

        // Use ResizeObserver to wait for valid dimensions
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect
                if (width > 100 && height > 100) {
                    setContainerReady(true)
                    resizeObserver.disconnect()
                }
            }
        })

        resizeObserver.observe(containerRef.current)

        // Also use a timeout as fallback
        const timeout = setTimeout(() => {
            if (checkDimensions()) {
                resizeObserver.disconnect()
            }
        }, 500)

        return () => {
            resizeObserver.disconnect()
            clearTimeout(timeout)
        }
    }, [])

    // Initialize Univer only when container is ready
    useEffect(() => {
        if (!containerReady) {
            console.log('[UniverSheet] Waiting for container to be ready...')
            return
        }

        // Cancel any pending cleanup from previous mount (React Strict Mode)
        if (cleanupTimeoutRef.current) {
            console.log('[UniverSheet] Cancelling pending cleanup (Strict Mode remount)')
            clearTimeout(cleanupTimeoutRef.current)
            cleanupTimeoutRef.current = null
        }

        // If Univer already exists from previous mount, reuse it
        if (univerRef.current) {
            console.log('[UniverSheet] Reusing existing Univer instance')
            setIsLoading(false)
            return
        }

        if (!containerRef.current) {
            console.log('[UniverSheet] Container not ready')
            return
        }

        // Check if container has valid dimensions
        const rect = containerRef.current.getBoundingClientRect()
        console.log('[UniverSheet] Container dimensions:', { width: rect.width, height: rect.height })

        if (rect.width < 100 || rect.height < 100) {
            console.log('[UniverSheet] Container too small, waiting...')
            return
        }

        let isActive = true

        const initUniver = async () => {
            try {
                initAttemptRef.current++
                console.log('[UniverSheet] Starting initialization (attempt', initAttemptRef.current, ')...')
                setIsLoading(true)
                setError(null)

                if (!isActive) {
                    console.log('[UniverSheet] Aborted - component unmounted during init')
                    return
                }

                // Clear the container before creating Univer
                if (containerRef.current) {
                    containerRef.current.innerHTML = ''
                }

                // Create Univer instance using the preset approach
                console.log('[UniverSheet] Creating Univer instance with darkMode:', initialThemeRef.current)
                const { univer, univerAPI } = createUniver({
                    locale: enUS,
                    locales: {
                        'en-US': enUS
                    },
                    theme: defaultTheme,
                    darkMode: initialThemeRef.current,
                    presets: [
                        UniverSheetsCorePreset({
                            container: containerRef.current!
                        })
                    ],
                })

                univerRef.current = { univer, univerAPI }
                console.log('[UniverSheet] Univer instance created')

                // Create workbook with provided data or default workbook
                if (initialDataRef.current) {
                    console.log('[UniverSheet] Creating workbook with provided data')
                    univerAPI.createWorkbook(initialDataRef.current)
                } else {
                    console.log('[UniverSheet] Creating default workbook')
                    // Create a default empty workbook structure
                    const defaultWorkbook: IWorkbookData = {
                        id: 'default-workbook',
                        name: 'Workbook',
                        appVersion: '0.0.0',
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        locale: 'enUS' as any,
                        styles: {},
                        sheetOrder: ['sheet1'],
                        sheets: {
                            sheet1: {
                                id: 'sheet1',
                                name: 'Sheet1',
                                rowCount: 1000,
                                columnCount: 26,
                            },
                        },
                    }
                    univerAPI.createWorkbook(defaultWorkbook)
                }

                console.log('[UniverSheet] Workbook created, initialization complete')

                // Set up autosave - check for changes every 2 seconds
                let lastSnapshot: string | null = null
                let isSaving = false

                autosaveIntervalRef.current = setInterval(() => {
                    if (isSaving || !isActive || !onChangeRef.current) return

                    try {
                        if (!univerRef.current?.univerAPI) {
                            return
                        }

                        const activeWorkbook = univerRef.current.univerAPI.getActiveWorkbook()
                        if (!activeWorkbook) return

                        const currentSnapshot = JSON.stringify(activeWorkbook.save())

                        // Only save if the workbook has changed
                        if (lastSnapshot !== null && currentSnapshot !== lastSnapshot) {
                            console.log('[UniverSheet] Changes detected, saving...')
                            isSaving = true

                            const snapshot = activeWorkbook.save()
                            if (snapshot && onChangeRef.current) {
                                onChangeRef.current(snapshot)
                            }
                            isSaving = false
                        }

                        lastSnapshot = currentSnapshot
                    } catch (err) {
                        console.error('[UniverSheet] Autosave error:', err)
                        isSaving = false
                    }
                }, 2000)

                setIsLoading(false)
            } catch (err) {
                console.error('[UniverSheet] Initialization error:', err)
                setError(err instanceof Error ? err.message : 'Failed to initialize spreadsheet')
                setIsLoading(false)
            }
        }

        initUniver()

        // Cleanup function - uses delayed cleanup for React Strict Mode
        return () => {
            console.log('[UniverSheet] Scheduling cleanup...')
            isActive = false

            // Clear autosave interval immediately
            if (autosaveIntervalRef.current) {
                clearInterval(autosaveIntervalRef.current)
                autosaveIntervalRef.current = null
            }

            // Delay actual Univer disposal to allow for Strict Mode remount
            cleanupTimeoutRef.current = setTimeout(() => {
                console.log('[UniverSheet] Executing cleanup (real unmount)')
                if (univerRef.current?.univer) {
                    univerRef.current.univer.dispose()
                    univerRef.current = null
                }
            }, 100)
        }
    }, [containerId, containerReady])

    // Toggle dark mode when theme changes after initialization
    useEffect(() => {
        if (!univerRef.current?.univerAPI || isLoading) return

        try {
            console.log('[UniverSheet] Toggling dark mode to:', isDarkMode)
            univerRef.current.univerAPI.toggleDarkMode(isDarkMode)
        } catch (err) {
            console.error('[UniverSheet] Error toggling dark mode:', err)
        }
    }, [isDarkMode, isLoading])

    return (
        <div
            className="relative w-full h-full"
            style={{
                width: typeof width === 'number' ? `${width}px` : width,
                height: typeof height === 'number' ? `${height}px` : height,
                minHeight: '500px',
                minWidth: '300px',
            }}
        >
            {/* Univer container - always rendered so ref can attach */}
            <div
                id={containerId}
                ref={containerRef}
                className="absolute inset-0"
                style={{ minWidth: '300px', minHeight: '500px' }}
            />

            {/* Loading overlay */}
            {isLoading && (
                <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
                        <p className="text-muted-foreground">Loading spreadsheet...</p>
                    </div>
                </div>
            )}

            {/* Error overlay */}
            {error && (
                <div className="absolute inset-0 flex items-center justify-center bg-background z-10">
                    <div className="text-center text-destructive">
                        <p className="font-semibold mb-2">Error loading spreadsheet</p>
                        <p className="text-sm">{error}</p>
                    </div>
                </div>
            )}
        </div>
    )
}
