export type MemberId =
  | 'carmen'
  | 'jiwoo'
  | 'yuha'
  | 'stella'
  | 'juun'
  | 'ana'
  | 'ian'
  | 'yeon';

export type VideoCategory =
  | 'mv'
  | 'shorts'
  | 'stage'
  | 'original'
  | 'other';

export interface Member {
  id: MemberId;
  name: string;
  koreanName: string;
  birthYear: number;
  role: string;
  emoji: string;
  imageUrl: string;
  color: string;
  description: string;
}

export interface Video {
  id: string;
  title: string;
  category: string;
  date: string;
  duration: string;
  thumbnailUrl: string;
  videoUrl?: string;
  url?: string;
  thumbnail?: string;
  channel?: string;
  type?: VideoCategory | 'video' | string;
  published_at?: string;
  views: string;
  members: MemberId[];
  description?: string;
}

export interface Pairing {
  id: string;
  names: string;
  members: [MemberId, MemberId];
  chemistry: string;
  recommendedVideoIds: string[];
}
