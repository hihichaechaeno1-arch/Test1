/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect } from 'react';
import { VideoItem, MemberName } from '../types';
import { X, Youtube, ExternalLink, Calendar, Eye, Users, Sparkles } from 'lucide-react';

interface VideoModalProps {
  video: VideoItem | null;
  onClose: () => void;
  onSelectMember: (name: MemberName) => void;
}

export const VideoModal: React.FC<VideoModalProps> = ({
  video,
  onClose,
  onSelectMember,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  if (!video) return null;

  const isShorts = video.type === 'shorts';

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100 flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header bar inside modal */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 bg-[#FAF8F5]">
          <div className="flex items-center gap-2 text-xs font-medium text-slate-600">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>{isShorts ? 'Hearts2Hearts Shorts 播放器' : 'Hearts2Hearts 精選影片'}</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 transition-colors"
            title="關閉 (ESC)"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div className="overflow-y-auto flex-1">
          {/* Video Player Display */}
          <div className="relative bg-black flex items-center justify-center">
            {isShorts ? (
              /* Shorts Vertical Display Frame */
              <div className="w-full max-w-[340px] aspect-[9/16] my-4 mx-auto rounded-xl overflow-hidden shadow-2xl relative bg-slate-950">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&mute=0&rel=0`}
                  title={video.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            ) : (
              /* 16:9 Standard Player Frame */
              <div className="w-full aspect-video">
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${video.youtubeId}?autoplay=1&rel=0`}
                  title={video.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}
          </div>

          {/* Video Information Area */}
          <div className="p-5 sm:p-6 space-y-4">
            <div>
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5">
                <span className="font-semibold text-rose-600">{video.channel}</span>
                <span aria-hidden="true">·</span>
                <span>發布於 {video.publishedAt}</span>
                <span aria-hidden="true">·</span>
                <span>{video.views}</span>
              </div>
              <h2 className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
                {video.title}
              </h2>
            </div>

            {/* Description */}
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-100 text-sm text-slate-600 leading-relaxed">
              {video.description}
            </div>

            {/* Highlight */}
            {video.highlightNote && (
              <div className="flex items-center gap-2 text-xs text-rose-800 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
                <Sparkles className="w-4 h-4 text-rose-500 shrink-0" />
                <span>
                  <strong>精彩看點：</strong>
                  {video.highlightNote}
                </span>
              </div>
            )}

            {/* Participating Members */}
            <div>
              <div className="text-xs font-semibold text-slate-700 mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                <span>出演成員（點選可直接篩選該成員）：</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {video.members.map((memberName) => (
                  <button
                    key={memberName}
                    onClick={() => {
                      onSelectMember(memberName as MemberName);
                      onClose();
                    }}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 transition-colors flex items-center gap-1"
                  >
                    <span>{memberName}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Modal Footer with YouTube Link */}
        <div className="px-5 py-3 border-t border-slate-100 bg-[#FAF8F5] flex items-center justify-between">
          <span className="text-xs text-slate-400">
            按 ESC 鍵可隨時關閉
          </span>
          <a
            href={`https://www.youtube.com/watch?v=${video.youtubeId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors shadow-xs"
          >
            <Youtube className="w-4 h-4" />
            <span>在 YouTube 原網站開啟</span>
            <ExternalLink className="w-3 h-3 ml-0.5" />
          </a>
        </div>
      </div>
    </div>
  );
};
