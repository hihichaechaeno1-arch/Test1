/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';
import { VideoItem, MemberName } from '../types';
import heroGroupImg from '../assets/images/hero_h2h_group_1790790752463.jpg';

// Read from standard Next.js / Vercel public environment variables
export const SUPABASE_URL =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_URL) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_URL) ||
  '';

export const SUPABASE_ANON_KEY =
  (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEXT_PUBLIC_SUPABASE_ANON_KEY) ||
  '';

// Initialize Supabase Client with environment variables
export const supabase = createClient(
  SUPABASE_URL || 'https://placeholder.supabase.co',
  SUPABASE_ANON_KEY || 'placeholder-anon-key'
);

/**
 * Robust mapping function from Supabase row to frontend VideoItem
 * Supports both snake_case and camelCase field names
 */
export function mapSupabaseRowToVideoItem(row: any): VideoItem {
  // Parse members safely from array, JSON, or comma-separated string
  let parsedMembers: MemberName[] = [];
  const rawMembers = row.members;

  if (Array.isArray(rawMembers)) {
    parsedMembers = rawMembers.map((m: any) => String(m).trim() as MemberName);
  } else if (typeof rawMembers === 'string') {
    const trimmed = rawMembers.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr)) {
          parsedMembers = arr.map((m: any) => String(m).trim() as MemberName);
        }
      } catch {
        parsedMembers = trimmed
          .replace(/[\[\]"]/g, '')
          .split(',')
          .map((m) => m.trim() as MemberName)
          .filter(Boolean);
      }
    } else {
      parsedMembers = trimmed
        .split(',')
        .map((m) => m.trim() as MemberName)
        .filter(Boolean);
    }
  }

  // Handle published_at formatting: if it has ISO timestamp with T (e.g. 2026-03-15T00:00:00Z), extract YYYY-MM-DD
  const rawDate = row.published_at || row.publishedAt || '';
  const cleanDate = typeof rawDate === 'string' && rawDate.includes('T')
    ? rawDate.split('T')[0]
    : String(rawDate || '');

  return {
    id: String(row.id || Math.random().toString(36).substring(2, 9)),
    title: row.title || '無標題影片',
    type: String(row.type || '').toLowerCase() === 'shorts' ? 'shorts' : 'video',
    category: row.category || 'all',
    channel: row.channel || 'Hearts2Hearts 官方頻道',
    members: parsedMembers,
    duration: row.duration || '0:00',
    publishedAt: cleanDate || '2026-03-15',
    views: row.views || '',
    thumbnailUrl: row.thumbnail_url || row.thumbnailUrl || heroGroupImg,
    youtubeId: row.youtube_id || row.youtubeId || '',
    description: row.description || '',
    highlightNote: row.highlight_note || row.highlightNote || undefined,
  };
}
