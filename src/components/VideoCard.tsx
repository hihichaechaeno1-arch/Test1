/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { VideoItem, MemberName, VideoGenre } from '../types';
import { ExternalLink, Play, Flame, Film, Users, Tv, Calendar, Sparkles, Layers } from 'lucide-react';
import { getVideoGroups, getYoutubeId } from '../lib/videoData';

interface VideoCardProps {
  video: VideoItem;
  selectedMembers: MemberName[];
  /** Live cards open the in-page player. Demo cards ignore this and stay non-playable. */
  onPlay?: (video: VideoItem) => void;
}

const GENRE_BADGE: Record<VideoGenre, { className: string; icon: React.ReactNode; label: string }> = {
  mv: {
    className: 'bg-rose-600/95 text-white font-bold',
    icon: <Film className="w-3.5 h-3.5 fill-white text-white" />,
    label: '音樂錄影帶',
  },
  shorts: {
    className: 'bg-amber-500/95 text-white font-bold',
    icon: <Flame className="w-3.5 h-3.5 fill-white text-white" />,
    label: '官方 Shorts',
  },
  stage: {
    className: 'bg-sky-600/95 text-white font-bold',
    icon: <Tv className="w-3.5 h-3.5 text-sky-100" />,
    label: '舞台與直拍',
  },
  original: {
    className: 'bg-emerald-600/95 text-white font-bold',
    icon: <Sparkles className="w-3.5 h-3.5 fill-white text-white" />,
    label: '官方綜藝/物料',
  },
  other: {
    className: 'bg-purple-700/95 text-white font-semibold',
    icon: <Layers className="w-3.5 h-3.5 text-purple-200" />,
    label: '其他影音',
  },
};

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  selectedMembers,
  onPlay,
}) => {
  const genres = getVideoGroups(video);
  const isShorts = genres.includes('shorts') || video.type === 'shorts';
  const playbackId = getYoutubeId(video.youtubeId) || getYoutubeId(video.url);
  const canPlay = !video.isSample && Boolean(playbackId) && Boolean(onPlay);
  const [failedImage, setFailedImage] = useState<string | null>(null);
  const Card = canPlay ? 'button' : 'article';

  return (
    <Card
      type={canPlay ? 'button' : undefined}
      onClick={canPlay ? () => onPlay?.(video) : undefined}
      data-playback-id={canPlay ? playbackId : undefined}
      aria-label={canPlay ? `在本頁播放 ${video.title}` : undefined}
      className="group w-full bg-white rounded-2xl border border-slate-200/90 hover:border-rose-300 hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400"
    >
      {/* 1. Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100 shrink-0">
        {failedImage === video.thumbnailUrl ? (
          <div role="img" aria-label="縮圖無法載入" className="w-full h-full flex items-center justify-center bg-slate-100 text-slate-400">
            <Film className="w-12 h-12" />
          </div>
        ) : (
          <img
            src={video.thumbnailUrl}
            alt={video.title}
            width={480}
            height={270}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            onError={() => setFailedImage(video.thumbnailUrl || null)}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        )}
        {/* Video Scrim & Hover Play Overlay */}
        <div className="absolute inset-0 bg-black/15 group-hover:bg-black/35 transition-colors flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white/95 group-hover:bg-rose-600 text-slate-900 group-hover:text-white flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110">
            {video.isSample ? <span className="text-xs">示範</span> : <Play className="w-4 h-4 fill-current ml-0.5" />}
          </div>
        </div>

        {/* Classification badges — dual-tab videos show every membership */}
        <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
          {genres.map((genre) => {
            const badge = GENRE_BADGE[genre];
            return (
              <span
                key={genre}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs tracking-wide shadow-md backdrop-blur-xs ${badge.className}`}
              >
                {badge.icon}
                {badge.label}
              </span>
            );
          })}
        </div>

        {/* Physical Shorts format indicator (may differ from Shorts tab membership) */}
        {isShorts && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium backdrop-blur-xs">
            Shorts 格式
          </div>
        )}

        {/* Duration badge */}
        <div className="absolute bottom-2.5 right-2.5 px-2 py-0.5 rounded bg-black/75 text-white text-[11px] font-mono tabular-nums">
          {video.duration}
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="p-5 flex-1 flex flex-col justify-between space-y-4">
        <div>
          {/* Source Channel Name & External Link Indicator */}
          <div className="flex items-center justify-between text-xs text-slate-500 mb-2.5">
            <span className="inline-flex items-center gap-1 font-medium text-slate-700 bg-slate-100/90 px-2 py-0.5 rounded-md truncate max-w-[200px]">
              <Tv className="w-3 h-3 text-rose-500 shrink-0" />
              <span className="truncate">{video.channel}</span>
            </span>

            <span className="inline-flex items-center gap-1 text-[11px] text-rose-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity">
              <span>{canPlay ? '在本頁播放' : '示範資料・不提供播放'}</span>
              <ExternalLink className="w-3 h-3" />
            </span>
          </div>

          {/* Video Title */}
          <h3 className="text-base font-bold text-slate-900 group-hover:text-rose-600 transition-colors line-clamp-2 leading-snug">
            {video.title}
          </h3>

          {/* Video Description snippet */}
          <p className="mt-2 text-xs text-slate-500 line-clamp-2 leading-relaxed">
            {video.description}
          </p>
        </div>

        {/* 3. Appearing Members & Publication Date at Bottom */}
        <div className="space-y-3 pt-3.5 border-t border-slate-100">
          {/* Appearing Members Tags */}
          <div>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 mb-2 font-medium">
              <Users className="w-3.5 h-3.5 text-rose-500 shrink-0" />
              <span>成員標籤・未核實 ({video.members.length})：</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {video.members.map((memberName) => {
                const isSelected = selectedMembers.includes(memberName);
                return (
                  <span
                    key={memberName}
                    className={`text-xs px-2.5 py-0.5 rounded-md transition-colors ${
                      isSelected
                        ? 'bg-rose-500 text-white font-semibold shadow-2xs'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium'
                    }`}
                  >
                    {memberName}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Highlight Note if available */}
          {video.highlightNote && (
            <div className="text-[11px] text-rose-800 bg-rose-50/70 border border-rose-100 px-2.5 py-1 rounded-md">
              ★ 看點：{video.highlightNote}
            </div>
          )}

          {/* Card Bottom: Publication Date & Views */}
          <div className="pt-2 border-t border-slate-100/80 flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1.5 text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              <span>發布日期：{video.publishedAt || '未提供'}</span>
            </div>
            <span className="tabular-nums text-slate-400 text-[11px]">
              {video.views}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
};
