import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/components/AuthProvider'
import { useAppData } from '@/components/AppDataProvider'

export interface UniverPage {
    id: string
    title: string
    created_at: string
    updated_at: string
    content?: {
        type: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        data: any
    }
}

/**
 * Fetch all Univer sheet pages for the current team and season
 */
async function fetchUniverPages(teamId: string, seasonId: string): Promise<UniverPage[]> {
    const { data, error } = await supabase
        .from('notebook_pages')
        .select('id, title, created_at, updated_at, content')
        .eq('team_id', teamId)
        .eq('season_id', seasonId)
        .eq('page_type', 'sheet')
        .order('updated_at', { ascending: false })

    if (error) {
        console.error('[useUniverList] Error fetching pages:', error)
        throw new Error(`Failed to fetch Univer pages: ${error.message}`)
    }

    return data || []
}

/**
 * Hook to fetch all Univer sheet pages for the current team and season
 *
 * Features:
 * - Automatically refetches on window focus
 * - Caches results with TanStack Query
 * - Returns loading/error states
 *
 * Usage:
 * ```ts
 * const { data: sheets, isLoading, error } = useUniverList()
 * ```
 */
export function useUniverList() {
    const { user } = useAuth()
    const { team, currentSeason } = useAppData()

    return useQuery({
        queryKey: ['univer-pages', team?.id, currentSeason?.id],
        queryFn: () => fetchUniverPages(team!.id, currentSeason!.id),
        enabled: !!team && !!currentSeason && !!user,
        staleTime: 1000 * 60 * 5, // Cache for 5 minutes
    })
}
