export type MemberId =
  | 'carmen'
  | 'jiwoo'
  | 'yuha'
  | 'stella'
  | 'juun'
  | 'ana'
  | 'ian'
  | 'yeon';

// 5 大精準影片分類代碼
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
  url?: string;
  videoUrl?: string;
  thumbnail?: string;
  thumbnailUrl: string;
  channel?: string;
  type: VideoCategory | 'video';
  category: string;
  published_at?: string;
  date: string;
  duration: string;
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
