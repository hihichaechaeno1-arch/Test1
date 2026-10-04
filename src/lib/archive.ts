/** @license SPDX-License-Identifier: Apache-2.0 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VideoItem } from '../types';
import { mapSupabaseRowToVideoItem } from './videoData';

const PROJECTIONS = {
  legacy: 'id,title,url,thumbnail,channel,type,published_at,members',
  canonical: 'id,title,youtube_id,thumbnail_url,channel,type,published_at,members',
};

/** Fetch all publicly visible rows, even when the server caps pages below our requested size. */
export async function fetchArchiveVideos(
  client: Pick<SupabaseClient, 'from'>,
  signal: AbortSignal = AbortSignal.timeout(30000),
  rowFormat: 'legacy' | 'canonical' = 'legacy',
): Promise<VideoItem[]> {
  const videos: VideoItem[] = [];
  let offset = 0;
  let includeDescription = true;
  while (true) {
    signal.throwIfAborted();
    const { data, error, count } = await client.from('videos')
      .select(`${PROJECTIONS[rowFormat]}${includeDescription ? ',description' : ''}`, { count: 'exact' })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('id', { ascending: true })
      .range(offset, offset + 99)
      .abortSignal(signal);
    if (error) {
      // Older tables lack this optional metadata column. Retry only that known
      // schema error, once, before publishing any rows; never hide auth/RLS errors.
      if (offset === 0 && includeDescription && error.code === '42703' &&
          /^column (?:"?videos"?\.)?"?description"? does not exist$/i.test(error.message)) {
        includeDescription = false;
        continue;
      }
      throw new Error('無法讀取影片資料；請檢查資料表欄位、讀取權限與連線');
    }
    if (!data) throw new Error('影片資料回應無效');
    if (data.length === 0) {
      if (count !== null && offset < count) throw new Error('影片資料不完整；請重試');
      break;
    }
    videos.push(...data.map(mapSupabaseRowToVideoItem));
    offset += data.length;
    if (count !== null && offset >= count) break;
  }
  return videos;
}
