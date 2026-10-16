import { describe, expect, it } from 'vitest';
import {
  filterVideosByMembers,
  getVideoGroup,
  mapSupabaseRowToVideoItem,
  parseViewsCount,
  sortVideoItems,
  VIDEO_GROUPS
} from '../src/lib/videoData';
import { VideoItem } from '../src/types';

const sampleVideos: VideoItem[] = [
  {
    id: '1',
    title: "Hearts2Hearts 'The Chase' MV",
    category: 'Official Music Videos (MVs)',
    date: '2025-02-24',
    duration: '03:15',
    thumbnailUrl: 'https://img.youtube.com/vi/abc12345678/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=abc12345678',
    channel: 'SMTOWN',
    type: 'mv',
    views: '10M',
    members: ['Carmen', 'Jiwoo', 'Yuha']
  },
  {
    id: '2',
    title: 'Hearts2Hearts Dance Challenge #Shorts',
    category: 'Shorts & Challenges',
    date: '2025-02-26',
    duration: '00:30',
    thumbnailUrl: 'https://img.youtube.com/vi/def12345678/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/shorts/def12345678',
    channel: 'Hearts2Hearts',
    type: 'shorts',
    views: '500K',
    members: ['Carmen', 'Ian']
  },
  {
    id: '3',
    title: '[Inkigayo] Hearts2Hearts - The Chase Stage',
    category: 'Stage Performances',
    date: '2025-03-01',
    duration: '03:30',
    thumbnailUrl: 'https://img.youtube.com/vi/ghi12345678/hqdefault.jpg',
    videoUrl: 'https://www.youtube.com/watch?v=ghi12345678',
    channel: 'SBSKPOP X INKIGAYO',
    type: 'stage',
    views: '1.2M',
    members: ['Jiwoo', 'Yuha']
  }
];

describe('videoData utilities with 5 categories', () => {
  it('defines the 5 main categories plus All', () => {
    expect(VIDEO_GROUPS).toEqual([
      'All',
      'Official Music Videos (MVs)',
      'Shorts & Challenges',
      'Stage Performances',
      'Original Content',
      'Other Official / Semi-official Content'
    ]);
  });

  it('classifies videos into the 5 categories accurately', () => {
    expect(getVideoGroup(sampleVideos[0])).toBe('Official Music Videos (MVs)');
    expect(getVideoGroup(sampleVideos[1])).toBe('Shorts & Challenges');
    expect(getVideoGroup(sampleVideos[2])).toBe('Stage Performances');
  });

  it('filters videos by members in AND / OR modes', () => {
    const andResult = filterVideosByMembers(sampleVideos, ['Carmen', 'Jiwoo'], 'AND');
    expect(andResult.map((v: VideoItem) => v.id)).toEqual(['1']);

    const orResult = filterVideosByMembers(sampleVideos, ['Ian', 'Yuha'], 'OR');
    expect(orResult.map((v: VideoItem) => v.id)).toEqual(['1', '2', '3']);
  });

  it('parses view counts and sorts videos', () => {
    expect(parseViewsCount('10M')).toBe(10_000_000);
    expect(parseViewsCount('500K')).toBe(500_000);

    const newest = sortVideoItems(sampleVideos, 'newest');
    expect(newest.map((v: VideoItem) => v.id)).toEqual(['3', '2', '1']);

    const popular = sortVideoItems(sampleVideos, 'popular');
    expect(popular.map((v: VideoItem) => v.id)).toEqual(['1', '3', '2']);
  });

  it('maps Supabase rows to VideoItem with 5-category classification', () => {
    const mapped = mapSupabaseRowToVideoItem({
      id: '99',
      title: 'Hearts2Hearts EP.1 Reality Vlog',
      url: 'https://www.youtube.com/watch?v=xyz12345678',
      channel: 'Hearts2Hearts',
      published_at: '2025-03-05',
      members: ['Carmen', 'Stella']
    });
    expect(mapped.category).toBe('Original Content');
    expect(mapped.members).toEqual(['Carmen', 'Stella']);
  });
});
