/** @license SPDX-License-Identifier: Apache-2.0 */

export type MemberName = 'Carmen' | 'Jiwoo' | 'Yuha' | 'Stella' | 'Juun' | 'A-na' | 'Ian' | 'Ye-on';
export type MemberMatchMode = 'including' | 'only' | 'AND' | 'OR';
export type SortOrder = 'new' | 'old' | 'popular';

/** Physical format is separate from inferred content category and source ownership. */
export type VideoType = 'video' | 'shorts';
export type VideoGenre = 'mv' | 'shorts' | 'stage' | 'original' | 'other';
export type VideoCategory = 'all' | VideoGenre | 'dance' | 'vlog' | 'variety';

export interface Member {
  id: string;
  name: MemberName;
  koreanName: string;
  role: string;
  birthday: string;
  mbti: string;
  accentColor: string;
  avatarBg: string;
  charm: string;
  bio: string;
  imageUrl?: string;
}

export interface VideoItem {
  id: string;
  title: string;
  type: VideoType;
  category: VideoCategory;
  /** Derived once when records/fixtures enter the UI; never an ownership assertion. */
  genre?: VideoGenre;
  channel: string;
  members: MemberName[];
  duration: string;
  publishedAt: string;
  views: string;
  thumbnailUrl: string;
  youtubeId: string;
  url?: string;
  description: string;
  highlightNote?: string;
  isSample?: boolean;
}
