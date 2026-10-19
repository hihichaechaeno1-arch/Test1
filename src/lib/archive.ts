/** @license SPDX-License-Identifier: Apache-2.0 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { VideoItem } from '../types';
import { mapSupabaseRowToVideoItem } from './videoData';

const PROJECTIONS = {
  legacy: 'id,title,url,thumbnail,channel,type,published_at,members',
  canonical: 'id,title,youtube_id,thumbnail_url,channel,type,published_at,members',
};

/** Load all visible pages or reject; never replace errors/empty responses with demo data. */
export async function fetchArchiveVideos(
  client: Pick<SupabaseClient, 'from'>,
  signal?: AbortSignal,
  rowFormat: 'legacy' | 'canonical' = 'legacy',
): Promise<VideoItem[]> {
  if (!Object.hasOwn(PROJECTIONS, rowFormat)) throw new Error('影片欄位格式設定無效');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timer = setTimeout(abort, 30000);
  const assertActive = () => {
    if (controller.signal.aborted) throw new Error('影片資料讀取已取消或逾時');
  };
  try {
    const videos: VideoItem[] = [];
    let offset = 0;
    let includeDescription = true;
    while (true) {
      assertActive();
      const { data, error, count } = await client.from('videos')
        .select(`${PROJECTIONS[rowFormat]}${includeDescription ? ',description' : ''}`, { count: 'exact' })
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('id', { ascending: true })
        .range(offset, offset + 99)
        .abortSignal(controller.signal);
      assertActive();
      if (error) {
        if (offset === 0 && includeDescription && error.code === '42703' &&
            /^column (?:"?videos"?\.)?"?description"? does not exist$/i.test(error.message)) {
          includeDescription = false;
          continue;
        }
        throw new Error('無法讀取影片資料；請檢查資料表欄位、讀取權限與連線');
      }
      if (!Array.isArray(data)) throw new Error('影片資料回應無效');
      if (data.length === 0) {
        if (count !== null && offset < count) throw new Error('影片資料不完整；請重試');
        break;
      }
      videos.push(...data.map(mapSupabaseRowToVideoItem));
      offset += data.length;
      if (count !== null && offset >= count) break;
    }
    return videos;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }
}
