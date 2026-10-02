/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { MemberName, VideoCategory, VideoItem } from '../types';

const MEMBER_NAMES: MemberName[] = ['Carmen', 'Jiwoo', 'Yuha', 'Stella', 'Juun', 'A-na', 'Ian', 'Ye-on'];
const CATEGORIES: VideoCategory[] = ['all', 'mv', 'dance', 'vlog', 'variety', 'shorts'];
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

function text(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value.trim() || fallback : fallback;
}

/** Accept IDs and known YouTube URL forms, never an arbitrary host's query string. */
export function getYoutubeId(value: unknown): string {
  const raw = text(value);
  if (VIDEO_ID.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return '';
    let id = '';
    if (url.hostname === 'youtu.be') {
      id = url.pathname.slice(1);
    } else if (['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname)) {
      id = url.pathname === '/watch'
        ? url.searchParams.get('v') || ''
        : /^\/(shorts|embed|live)\/([^/]+)\/?$/.exec(url.pathname)?.[2] || '';
    }
    return VIDEO_ID.test(id) ? id : '';
  } catch {
    return '';
  }
}

function parseMembers(value: unknown): MemberName[] {
  let values: unknown[] = [];
  if (Array.isArray(value)) {
    values = value;
  } else if (typeof value === 'string') {
    if (value.trim().startsWith('[')) {
      try {
        const parsed: unknown = JSON.parse(value);
        if (Array.isArray(parsed)) values = parsed;
      } catch {
        throw new Error('Invalid members JSON');
      }
    } else {
      values = value.split(',');
    }
  }
  return [...new Set(values.flatMap((entry) => {
    const name = MEMBER_NAMES.find((member) => member.toLowerCase() === text(entry).toLowerCase());
    return name ? [name] : [];
  }))];
}

function parseDate(value: unknown): string {
  const raw = text(value);
  if (!raw) return '';
  const date = raw.split('T')[0];
  if (raw.includes('T') && !Number.isFinite(Date.parse(raw))) throw new Error('Invalid publication timestamp');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) ||
      new Date(date).toISOString().slice(0, 10) !== date) {
    throw new Error('Invalid publication date');
  }
  return date;
}

/** Explicit legacy adapter: importer url/thumbnail and canonical fields are supported. */
export function mapSupabaseRowToVideoItem(value: unknown): VideoItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid video row');
  }
  const row = value as Record<string, unknown>;
  const youtubeId = getYoutubeId(row.youtube_id) || getYoutubeId(row.youtubeId) || getYoutubeId(row.url);
  if (!youtubeId) throw new Error('Missing or invalid YouTube identity');
  const type = text(row.type, 'video').toLowerCase();
  if (type !== 'video' && type !== 'shorts') throw new Error('Invalid video format');
  const category = text(row.category, 'all') as VideoCategory;
  const thumbnail = text(row.thumbnail_url) || text(row.thumbnailUrl) || text(row.thumbnail);
  const safeThumbnail = /^https?:\/\//i.test(thumbnail) ? thumbnail : `https://img.youtube.com/vi/${youtubeId}/hqdefault.jpg`;

  return {
    id: typeof row.id === 'number' ? String(row.id) : text(row.id, youtubeId),
    title: text(row.title, '無標題影片'),
    type,
    category: CATEGORIES.includes(category) ? category : 'all',
    channel: text(row.channel, '未提供頻道名稱'),
    members: parseMembers(row.members),
    duration: text(row.duration, '未提供'),
    publishedAt: parseDate(row.published_at || row.publishedAt),
    views: text(row.views),
    thumbnailUrl: safeThumbnail,
    youtubeId,
    description: text(row.description),
    highlightNote: text(row.highlight_note) || text(row.highlightNote) || undefined,
  };
}
