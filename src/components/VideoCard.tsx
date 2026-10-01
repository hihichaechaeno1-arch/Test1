/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { VideoItem, MemberName } from '../types';
import { ExternalLink, Play, Flame, Film, Users, Tv, Calendar } from 'lucide-react';

interface VideoCardProps {
  video: VideoItem;
  selectedMembers: MemberName[];
}

export const VideoCard: React.FC<VideoCardProps> = ({
  video,
  selectedMembers,
}) => {
  const isShorts = video.type === 'shorts';
  const youtubeUrl = `https://www.youtube.com/watch?v=${video.youtubeId}`;

  return (
    <a
      href={youtubeUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="group bg-white rounded-2xl border border-slate-200/90 hover:border-rose-300 hover:shadow-md transition-all duration-300 flex flex-col overflow-hidden text-left cursor-pointer focus:outline-none focus:ring-2 focus:ring-rose-400"
    >
      {/* 1. Thumbnail Container */}
      <div className="relative aspect-video w-full overflow-hidden bg-slate-100 shrink-0">
        <img
          src={video.thumbnailUrl}
          alt={video.title}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        {/* Video Scrim & Hover Play Overlay */}
        <div className="absolute inset-0 bg-black/15 group-hover:bg-black/35 transition-colors flex items-center justify-center">
          <div className="w-11 h-11 rounded-full bg-white/95 group-hover:bg-rose-600 text-slate-900 group-hover:text-white flex items-center justify-center shadow-md transition-all duration-300 group-hover:scale-110">
            <Play className="w-4 h-4 fill-current ml-0.5" />
          </div>
        </div>

        {/* Format Badge (Shorts vs Video - 精美標籤) */}
        <div className="absolute top-3 left-3">
          {isShorts ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-rose-600/95 text-white tracking-wide shadow-md backdrop-blur-xs">
              <Flame className="w-3.5 h-3.5 fill-white" />
              Shorts 短片
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-900/90 text-white tracking-wide shadow-md backdrop-blur-xs">
              <Film className="w-3.5 h-3.5 text-rose-300" />
              完整影片
            </span>
          )}
        </div>

        {/* If Shorts, special visual indicator */}
        {isShorts && (
          <div className="absolute top-3 right-3 px-2 py-0.5 rounded-md bg-black/60 text-white text-[10px] font-medium backdrop-blur-xs">
            9:16 直式短影音
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
              <span>在 YouTube 開啟</span>
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
              <span>出現成員 ({video.members.length})：</span>
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
              <span>發布日期：{video.publishedAt}</span>
            </div>
            <span className="tabular-nums text-slate-400 text-[11px]">
              {video.views}
            </span>
          </div>
        </div>
      </div>
    </a>
  );
};
