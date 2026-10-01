/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type MemberName =
  | 'Carmen'
  | 'Jiwoo'
  | 'Yuha'
  | 'Stella'
  | 'Juun'
  | 'A-na'
  | 'Ian'
  | 'Ye-on';

export type VideoType = 'video' | 'shorts';

export type VideoCategory = 'all' | 'mv' | 'dance' | 'vlog' | 'variety' | 'shorts';

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
  category: 'mv' | 'dance' | 'vlog' | 'variety' | 'shorts';
  channel: string;
  members: MemberName[];
  duration: string;
  publishedAt: string;
  views: string;
  thumbnailUrl: string;
  youtubeId: string;
  description: string;
  highlightNote?: string;
}
