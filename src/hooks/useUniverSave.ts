import { useMutation } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface SaveUniverParams {
    pageId: string
    teamId: string
    seasonId: string
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    workbookData: any // Univer workbook snapshot from workbook.save()
    userId?: string
    metadata?: {
        title?: string
    }
}

interface SaveUniverResult {
    success: boolean
    timestamp: Date
}

/**
 * Save Univer workbook content to notebook_pages table
 * Stores the complete workbook snapshot as JSON in the content field
 */
async function saveUniverContent(params: SaveUniverParams): Promise<SaveUniverResult> {
    const { pageId, workbookData, userId, metadata } = params

    try {
        // Prepare update data
        const updateData: Record<string, unknown> = {
            content: { type: 'sheet', data: workbookData },
            content_text: `Univer sheet with ${Object.keys(workbookData?.sheets || {}).length} sheet(s)`,
            updated_at: new Date().toISOString(),
            page_type: 'sheet',
        }

        // Add metadata fields if provided
        if (metadata?.title !== undefined) updateData.title = metadata.title
        if (userId) updateData.updated_by = userId

        const { error: dbError } = await supabase
            .from('notebook_pages')
            .update(updateData)
            .eq('id', pageId)

        if (dbError) {
            console.error('[useUniverSave] Database update error:', dbError)
            throw new Error(`Failed to update database: ${dbError.message}`)
        }

        return {
            success: true,
            timestamp: new Date()
        }
    } catch (error) {
        console.error('[useUniverSave] Error saving Univer sheet:', error)
        throw error // Let TanStack Query handle retries
    }
}

/**
 * Hook to save Univer workbook content with automatic retry
 *
 * Features:
 * - Automatic retry on failure (3 attempts with exponential backoff)
 * - Proper mutation queuing (no race conditions)
 * - Direct save to Supabase database
 * - Database metadata updates
 *
 * Usage:
 * ```ts
 * const { mutate: saveUniver, isPending } = useUniverSave()
 *
 * saveUniver({
 *   pageId: 'page-123',
 *   teamId: 'team-456',
 *   seasonId: 'season-789',
 *   workbookData: workbook.save(),
 *   metadata: { title: 'My Sheet' }
 * })
 * ```
 */
export function useUniverSave() {
    return useMutation({
        mutationFn: saveUniverContent,
        retry: 3,
        retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    })
}
