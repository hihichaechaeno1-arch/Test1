/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MemberId =
  | 'carmen'
  | 'jiwoo'
  | 'yuha'
  | 'stella'
  | 'juun'
  | 'a-na'
  | 'ana'
  | 'ian'
  | 'ye-on'
  | 'yeon';

export type MemberName =
  | 'Carmen'
  | 'Jiwoo'
  | 'Yuha'
  | 'Stella'
  | 'Juun'
  | 'A-na'
  | 'Ian'
  | 'Ye-on';

export type MemberMatchMode = 'including' | 'only' | 'AND' | 'OR' | 'and' | 'or';

export type SortOrder = 'new' | 'old' | 'popular' | 'newest' | 'oldest' | 'views';

export type VideoType =
  | 'video'
  | 'shorts'
  | 'mv'
  | 'stage'
  | 'original'
  | 'other'
  | string;

export type VideoGroup =
  | 'all'
  | 'official'
  | 'shorts'
  | 'stage'
  | 'others'
  | 'mv'
  | 'original'
  | 'other'
  | 'Official Music Videos (MVs)'
  | 'Shorts & Challenges'
  | 'Stage Performances'
  | 'Original Content'
  | 'Other Official / Semi-official Content'
  | string;

export type VideoCategory = VideoGroup;

export interface Member {
  id: MemberId;
  name: MemberName;
  koreanName: string;
  role: string;
  birthday?: string;
  birthYear?: number;
  mbti?: string;
  accentColor?: string;
  color?: string;
  avatarBg?: string;
  charm?: string;
  bio?: string;
  imageUrl?: string;
  image?: string;
  emoji?: string;
  description?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  category?: string;
  date?: string;
  publishedAt?: string;
  published_at?: string;
  duration?: string;
  thumbnailUrl?: string;
  thumbnail?: string;
  videoUrl?: string;
  url?: string;
  youtubeId?: string;
  channel?: string;
  type?: VideoType;
  views?: string;
  viewsCount?: number;
  viewCount?: number;
  members: (MemberName | string)[];
  description?: string;
  group?: VideoGroup;
  genre?: VideoCategory | string;
  isSample?: boolean;
  highlightNote?: string;
}

export type Video = VideoItem;

export interface Pairing {
  id: string;
  names: string;
  members: [MemberName | MemberId | string, MemberName | MemberId | string];
  chemistry: string;
  recommendedVideoIds: string[];
}
