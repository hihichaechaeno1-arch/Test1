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

// 同時支援 ONLY (只限該成員) / INCLUDE (包含該成員) 及兼容舊版 AND / OR
export type MemberMatchMode = 'ONLY' | 'INCLUDE' | 'AND' | 'OR' | 'only' | 'include' | 'and' | 'or';

export type SortOrder = 'newest' | 'oldest' | 'popular' | 'views';

export type VideoType =
  | 'video'
  | 'shorts'
  | 'mv'
  | 'stage'
  | 'original'
  | 'other'
  | string;

export type VideoGroup =
  | 'All'
  | 'Official Music Videos (MVs)'
  | 'Shorts & Challenges'
  | 'Stage Performances'
  | 'Original Content'
  | 'Other Official / Semi-official Content'
  | 'Official H2H'
  | 'Shorts'
  | 'External Channels'
  | string;

export type VideoCategory = VideoGroup;

export interface Member {
  id: MemberId;
  name: MemberName | string;
  koreanName: string;
  birthYear?: number;
  birthday?: string;
  mbti?: string;
  role: string;
  charm?: string;
  bio?: string;
  emoji?: string;
  imageUrl: string;
  avatarBg?: string;
  color: string;
  description?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  category: string;
  date: string;
  publishedAt?: string;
  published_at?: string;
  duration: string;
  thumbnailUrl: string;
  thumbnail?: string;
  videoUrl: string;
  url?: string;
  channel?: string;
  type?: VideoType;
  views: string;
  members: (MemberName | MemberId | string)[];
  description?: string;
}

export type Video = VideoItem;

export interface Pairing {
  id: string;
  names: string;
  members: [MemberName | MemberId | string, MemberName | MemberId | string];
  chemistry: string;
  recommendedVideoIds: string[];
}
