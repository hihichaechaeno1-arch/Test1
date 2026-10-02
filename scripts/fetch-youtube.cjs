/** @license SPDX-License-Identifier: Apache-2.0 */

const MEMBER_MAP = {
  Carmen: ['carmen', '카르멘'], Jiwoo: ['jiwoo', '지우'], Yuha: ['yuha', '유하'],
  Stella: ['stella', '스텔라'], Juun: ['juun', '준'], 'A-na': ['a-na', 'ana', '아나'],
  Ian: ['ian', '이안'], 'Ye-on': ['ye-on', 'yeon', '예온'],
};

// Text association only: these tags never certify on-screen appearances.
function detectMembers(text) {
  if (typeof text !== 'string' || !text.trim()) return [];
  return Object.entries(MEMBER_MAP).flatMap(([name, aliases]) =>
    aliases.some(alias => new RegExp(`(^|[^\\p{L}\\p{N}])${alias}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(text))
      ? [name] : []
  );
}

function validTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
}

function loadConfig(env = process.env, args = process.argv.slice(2)) {
  for (const name of ['YOUTUBE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'YOUTUBE_CHANNEL_IDS']) {
    if (!env[name]?.trim()) throw new Error(`Missing required setting: ${name}`);
  }
  const channelIds = [...new Set(env.YOUTUBE_CHANNEL_IDS.split(',').map(id => id.trim()))];
  if (channelIds.some(id => !/^UC[A-Za-z0-9_-]{22}$/.test(id))) {
    throw new Error('YOUTUBE_CHANNEL_IDS must contain approved channel IDs, not names or URLs');
  }
  const options = {};
  const allowed = ['mode', 'max-pages', 'max-requests', 'published-after', 'published-before', 'page-token'];
  for (const arg of args) {
    const match = /^--([^=]+)=(.+)$/.exec(arg);
    if (!match || !allowed.includes(match[1])) throw new Error('Unknown sync option; use --name=value');
    options[match[1]] = match[2];
  }
  const mode = options.mode || 'recent';
  if (!['recent', 'backfill'].includes(mode)) throw new Error('Mode must be recent or backfill');
  const maxPages = Number(options['max-pages'] || 3);
  const maxRequests = Number(options['max-requests'] || 39);
  if (!Number.isInteger(maxPages) || maxPages < 1 || !Number.isInteger(maxRequests) || maxRequests < 1 || maxRequests > 99) {
    throw new Error('Positive integer page/request limits required; max-requests cannot exceed 99');
  }
  for (const name of ['published-after', 'published-before']) {
    if (options[name] && !validTimestamp(options[name])) throw new Error(`Invalid ${name} timestamp`);
  }
  if (mode === 'backfill' && !options['published-before']) throw new Error('Backfill requires --published-before');
  if (options['published-before'] && options['published-after'] && Date.parse(options['published-after']) >= Date.parse(options['published-before'])) {
    throw new Error('published-after must precede published-before');
  }
  if (options['page-token'] && channelIds.length !== 1) throw new Error('Page-token resume requires exactly one channel');
  return {
    apiKey: env.YOUTUBE_API_KEY, supabaseUrl: env.SUPABASE_URL, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    channelIds, mode, maxPages, maxRequests, publishedAfter: options['published-after'],
    publishedBefore: options['published-before'], pageToken: options['page-token'] || '',
  };
}

async function searchPage(url, fetchImpl, sleep) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(15000) });
    } catch {
      if (attempt < 2) { await sleep(250 * 2 ** attempt); continue; }
      throw new Error('YouTube network request failed or timed out');
    }
    if ((response.status === 429 || response.status >= 500) && attempt < 2) {
      await sleep(250 * 2 ** attempt);
      continue;
    }
    // Do not log response messages or request URLs: they can contain credentials.
    if (!response.ok) throw new Error(`YouTube HTTP failure (${response.status})`);
    let data;
    try { data = await response.json(); } catch { throw new Error('Invalid YouTube JSON response'); }
    if (data?.error) throw new Error('YouTube API returned an error');
    if (!Array.isArray(data?.items)) throw new Error('YouTube response is missing items');
    return data;
  }
}

/** Public ingestion boundary; mocks are limited to the external HTTP/database services. */
async function syncVideos({
  apiKey, channelIds, client, maxPages = 3, maxRequests = 39, mode = 'recent',
  publishedAfter, publishedBefore, pageToken = '', fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log,
}) {
  const summary = { mode, inserted: 0, updated: 0, skipped: 0, failed: 0, requests: 0, channels: [] };
  // Each retry consumes quota too; enforce the global bound at the actual HTTP boundary.
  const boundedFetch = async (...args) => {
    if (summary.requests >= maxRequests) throw new Error('Search request budget exhausted');
    summary.requests++;
    return fetchImpl(...args);
  };
  for (const channelId of channelIds) {
    const result = { channelId, pages: 0, nextPageToken: pageToken, oldestPublishedAt: '', complete: false };
    summary.channels.push(result);
    if (summary.requests >= maxRequests) {
      summary.failed++;
      log({ event: 'budget-exhausted', channelId });
      continue;
    }
    do {
      const url = new URL('https://www.googleapis.com/youtube/v3/search');
      url.search = new URLSearchParams({
        part: 'snippet', maxResults: '50', order: 'date', type: 'video',
        key: apiKey, channelId, q: 'Hearts2Hearts',
      }).toString();
      if (result.nextPageToken) url.searchParams.set('pageToken', result.nextPageToken);
      if (publishedAfter) url.searchParams.set('publishedAfter', publishedAfter);
      if (publishedBefore) url.searchParams.set('publishedBefore', publishedBefore);
      let data;
      try {
        data = await searchPage(url.toString(), boundedFetch, sleep);
      } catch (error) {
        summary.failed++;
        log({ event: 'search-failed', channelId, page: result.pages + 1, reason: error.message });
        break;
      }
      result.pages++;
      for (const item of data.items) {
        const id = item?.id?.videoId;
        const snippet = item?.snippet;
        if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{11}$/.test(id) || snippet?.channelId !== channelId) {
          summary.skipped++;
          continue;
        }
        if (typeof snippet.title !== 'string' || !validTimestamp(snippet.publishedAt)) {
          summary.failed++;
          log({ event: 'invalid-metadata', channelId, videoId: id });
          continue;
        }
        if (!result.oldestPublishedAt || snippet.publishedAt < result.oldestPublishedAt) result.oldestPublishedAt = snippet.publishedAt;
        const description = typeof snippet.description === 'string' ? snippet.description : '';
        const text = `${snippet.title} ${description}`;
        const members = detectMembers(text);
        if (!/hearts\s?2hearts|하츠투하츠|\bh2h\b/iu.test(text) && members.length === 0) {
          summary.skipped++;
          continue;
        }
        // A stable watch URL is the identity for BOTH formats. Legacy Shorts URLs are recognized.
        const videoUrl = `https://www.youtube.com/watch?v=${id}`;
        const metadata = {
          title: snippet.title, thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
          channel: typeof snippet.channelTitle === 'string' ? snippet.channelTitle : channelId,
          type: /#?\bshorts\b/iu.test(snippet.title) ? 'shorts' : 'video',
          published_at: snippet.publishedAt.split('T')[0], description,
        };
        let operation = 'lookup';
        try {
          const { data: existing, error: lookupError } = await client.from('videos')
            .select('id').in('url', [videoUrl, `https://www.youtube.com/shorts/${id}`]).maybeSingle();
          if (lookupError) throw new Error('Database lookup failed');
          if (existing) {
            // Preserve editorial member tags. Only source metadata is refreshed.
            operation = 'update';
            const { error, count } = await client.from('videos').update({ ...metadata, url: videoUrl }, { count: 'exact' }).eq('id', existing.id);
            if (error || count !== 1) throw new Error('Database update failed or affected no row');
            summary.updated++;
          } else {
            operation = 'insert';
            const { error } = await client.from('videos').insert({ ...metadata, url: videoUrl, members });
            if (error) {
              if (error.code === '23505') {
                const { data: winner, error: retryError } = await client.from('videos').select('id').eq('url', videoUrl).maybeSingle();
                if (retryError || !winner) throw new Error('Unconfirmed duplicate conflict');
                summary.skipped++;
              } else throw new Error('Database insert failed');
            } else summary.inserted++;
          }
        } catch {
          summary.failed++;
          log({ event: 'database-failed', channelId, videoId: id, operation });
        }
      }
      result.nextPageToken = typeof data.nextPageToken === 'string' ? data.nextPageToken : '';
      result.complete = !result.nextPageToken;
      if (result.complete) break;
    } while (result.pages < maxPages && summary.requests < maxRequests);
    log({ event: result.complete ? 'channel-finished' : 'channel-incomplete', ...result });
  }
  return summary;
}

module.exports = { detectMembers, loadConfig, syncVideos };

if (require.main === module) {
  (async () => {
    const config = loadConfig();
    const { createClient } = require('@supabase/supabase-js');
    const client = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const summary = await syncVideos({ ...config, client });
    console.log(JSON.stringify({ event: 'sync-summary', ...summary }));
    if (summary.failed > 0) process.exitCode = 1;
    else if (config.mode === 'backfill' && summary.channels.some(channel => !channel.complete)) process.exitCode = 2;
  })().catch(error => {
    // Configuration messages contain names, not values. Never print raw SDK/network errors.
    console.error(error instanceof Error && error.message.startsWith('Missing required setting:')
      ? error.message : 'Sync failed; check approved channel IDs, options, and service configuration');
    process.exitCode = 1;
  });
}
