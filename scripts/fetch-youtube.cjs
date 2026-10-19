/** @license SPDX-License-Identifier: Apache-2.0 */

// No SDK/config side effects on import: the preflight runs before dependency installation.
const { detectMembers, classifyVideoGenres, hasShortsFormatEvidence } = require('../src/lib/videoMetadata.cjs');

function validTimestamp(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value.slice(0, 10);
}

function loadConfig(env = process.env, args = process.argv.slice(2)) {
  for (const name of ['YOUTUBE_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'YOUTUBE_CHANNEL_IDS']) {
    if (!env[name]?.trim()) throw new Error(`Missing required setting: ${name}`);
  }
  let target;
  try { target = new URL(env.SUPABASE_URL); } catch { throw new Error('Invalid SUPABASE_URL'); }
  if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash || target.pathname !== '/') {
    throw new Error('Invalid SUPABASE_URL');
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
    apiKey: env.YOUTUBE_API_KEY.trim(), supabaseUrl: target.origin, serviceKey: env.SUPABASE_SERVICE_ROLE_KEY.trim(),
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
    if (!response.ok) throw new Error('YouTube HTTP failure');
    let data;
    try { data = await response.json(); } catch { throw new Error('Invalid YouTube JSON response'); }
    if (data?.error) throw new Error('YouTube API returned an error');
    if (!Array.isArray(data?.items)) throw new Error('YouTube response is missing items');
    return data;
  }
}

function isMissingDescription(error) {
  if (error?.code === 'PGRST204') {
    return /^Could not find the 'description' column of 'videos' in the schema cache$/i.test(error.message);
  }
  return error?.code === '42703' &&
    /^(?:column (?:"?videos"?\.)?"?description"? does not exist|column "?description"? of relation "?videos"? does not exist)$/i.test(error.message);
}

function databaseDiagnostic(error) {
  const code = typeof error?.code === 'string' && /^(?:[0-9A-Z]{5}|PGRST\d{3})$/.test(error.code)
    ? error.code : 'unknown';
  const reasons = {
    PGRST204: 'schema-column-missing', '42703': 'schema-column-missing',
    PGRST116: 'multiple-rows',
    '42501': 'permission-denied', PGRST301: 'authentication-failed',
    '23502': 'required-value-missing', '23505': 'unique-conflict',
    '23514': 'check-constraint', '22P02': 'invalid-value',
  };
  return { code, reason: reasons[code] || 'database-operation-failed' };
}

/**
 * Resolve an existing row for a YouTube identity.
 * Prefer the canonical watch URL when both watch and Shorts URLs were stored
 * (PostgREST PGRST116 / .maybeSingle fails when .in() matches more than one row).
 */
function pickExistingVideoRow(rows, videoUrl, shortsUrl) {
  const list = Array.isArray(rows) ? rows.filter(row => row && typeof row === 'object') : [];
  if (!list.length) return { existing: null, matchCount: 0, shortsEvidence: false };
  const existing = list.find(row => row.url === videoUrl)
    || list.find(row => row.url === shortsUrl)
    || list[0];
  const shortsEvidence = list.some(row => row.type === 'shorts' || row.url === shortsUrl);
  return { existing, matchCount: list.length, shortsEvidence };
}

/** Trusted ingestion seam. External HTTP/database services can be injected for offline tests. */
async function syncVideos({
  apiKey, channelIds, client, maxPages = 3, maxRequests = 39, mode = 'recent',
  publishedAfter, publishedBefore, pageToken = '', fetchImpl = fetch,
  sleep = ms => new Promise(resolve => setTimeout(resolve, ms)), log = console.log,
}) {
  const summary = { mode, inserted: 0, updated: 0, skipped: 0, failed: 0, requests: 0, channels: [], metadataOmissions: [] };
  let includeDescription = true;
  const writeMetadata = async (record, write) => {
    const { description, ...required } = record;
    let result = await write(includeDescription ? record : required);
    if (includeDescription && isMissingDescription(result.error)) {
      includeDescription = false;
      summary.metadataOmissions.push('description');
      log({ event: 'schema-compatibility', omittedColumn: 'description', reason: 'missing-optional-column' });
      result = await write(required);
    }
    return result;
  };
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
      try { data = await searchPage(url.toString(), boundedFetch, sleep); }
      catch {
        summary.failed++;
        log({ event: 'search-failed', channelId, page: result.pages + 1, reason: 'request-failed-or-budget-exhausted' });
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
        if (typeof snippet.title !== 'string' || !snippet.title.trim() || !validTimestamp(snippet.publishedAt)) {
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
        const videoUrl = `https://www.youtube.com/watch?v=${id}`;
        const channelTitle = typeof snippet.channelTitle === 'string' ? snippet.channelTitle : channelId;
        const inferredGenres = classifyVideoGenres(snippet.title, description, channelTitle, '', 'video', channelId);
        const physicalShorts = hasShortsFormatEvidence(snippet.title, description, '', 'video')
          || inferredGenres.includes('shorts');
        const metadata = {
          title: snippet.title, thumbnail: `https://img.youtube.com/vi/${id}/hqdefault.jpg`,
          channel: channelTitle,
          type: physicalShorts ? 'shorts' : 'video',
          published_at: snippet.publishedAt.split('T')[0], description,
        };
        let operation = 'lookup';
        const shortsUrl = `https://www.youtube.com/shorts/${id}`;
        try {
          // Do not use maybeSingle(): duplicate watch + shorts rows for one ID are common and
          // return PGRST116 ("multiple rows"), which previously aborted the update path.
          const { data: lookupRows, error: lookupError } = await client.from('videos')
            .select('id,type,url').in('url', [videoUrl, shortsUrl]);
          if (lookupError) throw lookupError;
          const { existing, matchCount, shortsEvidence } = pickExistingVideoRow(lookupRows, videoUrl, shortsUrl);
          if (matchCount > 1) {
            log({
              event: 'duplicate-identity', channelId, videoId: id, matches: matchCount,
              reason: 'multiple-url-rows', preferredId: existing?.id,
            });
          }
          if (existing) {
            // Weak text inference must not erase earlier Shorts evidence or editorial tags.
            if (shortsEvidence || existing.type === 'shorts' || existing.url === shortsUrl) metadata.type = 'shorts';
            operation = 'update';
            const { error, count } = await writeMetadata({ ...metadata, url: videoUrl }, record =>
              client.from('videos').update(record, { count: 'exact' }).eq('id', existing.id));
            if (error) throw error;
            if (count !== 1) throw new Error('Database update affected no row');
            summary.updated++;
          } else {
            operation = 'insert';
            const { error } = await writeMetadata({ ...metadata, url: videoUrl, members }, record =>
              client.from('videos').insert(record));
            if (error) {
              if (error.code === '23505') {
                const { data: winner, error: retryError } = await client.from('videos').select('id').eq('url', videoUrl).maybeSingle();
                if (retryError) throw retryError;
                if (!winner) throw error;
                summary.skipped++;
              } else throw error;
            } else summary.inserted++;
          }
        } catch (error) {
          summary.failed++;
          log({ event: 'database-failed', channelId, videoId: id, operation, ...databaseDiagnostic(error) });
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

module.exports = { detectMembers, loadConfig, syncVideos, pickExistingVideoRow };

if (require.main === module) {
  (async () => {
    if (process.env.ENABLE_YOUTUBE_SYNC !== 'true') throw new Error('ENABLE_YOUTUBE_SYNC must be exactly true');
    const config = loadConfig();
    const { createClient } = require('@supabase/supabase-js');
    const timedFetch = (input, init = {}) => fetch(input, {
      ...init, signal: AbortSignal.any([...(init.signal ? [init.signal] : []), AbortSignal.timeout(15000)]),
    });
    const client = createClient(config.supabaseUrl, config.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false }, global: { fetch: timedFetch },
    });
    const summary = await syncVideos({ ...config, client });
    console.log(JSON.stringify({ event: 'sync-summary', ...summary }));
    if (summary.failed > 0) process.exitCode = 1;
    else if (config.mode === 'backfill' && summary.channels.some(channel => !channel.complete)) process.exitCode = 2;
  })().catch(() => {
    console.error('Sync blocked or failed; check ENABLE_YOUTUBE_SYNC, approved channel IDs, options, and service configuration');
    process.exitCode = 1;
  });
}
