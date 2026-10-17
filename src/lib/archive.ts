import { VIDEOS as FALLBACK_VIDEOS } from '../data/h2hData';
import { VideoItem } from '../types';
import { getSupabaseClient } from './supabase';
import { mapSupabaseRowToVideoItem } from './videoData';

export interface ArchiveLoadResult {
  videos: VideoItem[];
  usingFallback: boolean;
  warning: string | null;
  source?: 'supabase' | 'fallback';
}

export async function loadArchiveVideos(
  clientOverride?: any
): Promise<ArchiveLoadResult> {
  const supabase = clientOverride !== undefined ? clientOverride : getSupabaseClient();

  if (!supabase) {
    return {
      videos: FALLBACK_VIDEOS,
      usingFallback: true,
      warning: 'Supabase environment variables are not configured. Showing built-in starter archive.',
      source: 'fallback'
    };
  }

  try {
    const { data, error } = await supabase
      .from('videos')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(5000);

    if (error) {
      return {
        videos: FALLBACK_VIDEOS,
        usingFallback: true,
        warning: `Supabase query failed (${error.message}). Showing built-in starter archive.`,
        source: 'fallback'
      };
    }

    if (!data || data.length === 0) {
      return {
        videos: FALLBACK_VIDEOS,
        usingFallback: true,
        warning: 'Supabase videos table is currently empty. Showing built-in starter archive.',
        source: 'fallback'
      };
    }

    const mapped = data.map((row: any) => mapSupabaseRowToVideoItem(row));

    return {
      videos: mapped,
      usingFallback: false,
      warning: null,
      source: 'supabase'
    };
  } catch (err: any) {
    return {
      videos: FALLBACK_VIDEOS,
      usingFallback: true,
      warning: `Unexpected error loading archive (${err?.message || 'Unknown error'}). Showing built-in starter archive.`,
      source: 'fallback'
    };
  }
}
