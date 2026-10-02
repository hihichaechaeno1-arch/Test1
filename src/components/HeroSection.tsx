/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Heart, Play, Users, Sparkles } from 'lucide-react';
import heroGroupImg from '../assets/images/hero_h2h_group_1790790752463.webp';

interface HeroSectionProps {
  onScrollToFilter: () => void;
  onExploreMembers: () => void;
}

export const HeroSection: React.FC<HeroSectionProps> = ({
  onScrollToFilter,
  onExploreMembers,
}) => {
  return (
    <section className="relative overflow-hidden pt-8 pb-12 sm:pt-12 sm:pb-16 bg-gradient-to-b from-rose-50/60 via-[#FAF8F5] to-[#FAF8F5] border-b border-rose-100/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          {/* Left Column: Editorial Intro */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-100/70 border border-rose-200/60 text-rose-800 text-xs font-medium">
              <Heart className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
              <span>Hearts2Hearts 官方粉絲精選影片庫</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight text-slate-900 leading-tight text-balance">
              尋找心動共鳴，
              <br />
              <span className="text-rose-600 font-extrabold">成員同框影片</span> 一鍵即時查
            </h1>

            <p className="text-base sm:text-lg text-slate-600 leading-relaxed">
              專為 H2H 粉絲打造的簡約影像資料庫。點選想要關注的 1 位或多位成員，立即篩選出她們共同出演的 YouTube 官方舞台、幕後花絮與熱門 Shorts 短影音！
            </p>

            {/* Quick Metrics (Clean Editorial Text) */}
            <div className="flex items-center gap-6 pt-2 text-xs sm:text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tabular-nums">8</span>
                <span>位官方成員</span>
              </div>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-base tabular-nums">14+</span>
                <span>部精選同框收錄</span>
              </div>
              <span className="text-slate-300" aria-hidden="true">·</span>
              <div className="flex items-center gap-2">
                <span className="font-bold text-rose-600 text-base">AND / OR</span>
                <span>智能雙模篩選</span>
              </div>
            </div>

            {/* Primary Action Buttons */}
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={onScrollToFilter}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-rose-600 hover:bg-rose-700 text-white font-medium text-sm shadow-sm hover:shadow transition-all group"
              >
                <Play className="w-4 h-4 fill-white transition-transform group-hover:scale-110" />
                <span>開始選擇成員看影片</span>
              </button>

              <button
                onClick={onExploreMembers}
                className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-white hover:bg-rose-50/50 text-slate-700 hover:text-slate-900 font-medium text-sm border border-slate-200 hover:border-rose-200 transition-all"
              >
                <Users className="w-4 h-4 text-slate-500" />
                <span>認識 8 位成員檔案</span>
              </button>
            </div>
          </div>

          {/* Right Column: Visual Group Poster */}
          <div className="lg:col-span-6">
            <div className="relative rounded-2xl overflow-hidden shadow-lg border border-rose-100 bg-white group">
              <img
                src={heroGroupImg}
                alt="Hearts2Hearts 成員全體視覺合影"
                className="w-full h-[260px] sm:h-[340px] object-cover transition-transform duration-500 group-hover:scale-102"
                referrerPolicy="no-referrer"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />

              <div className="absolute bottom-4 left-4 right-4 text-white flex items-end justify-between pointer-events-none">
                <div>
                  <p className="text-xs uppercase tracking-wider text-rose-200 font-medium">Group Concept</p>
                  <p className="text-lg font-bold text-white drop-shadow-sm">Hearts2Hearts (H2H)</p>
                  <p className="text-xs text-slate-200">Carmen · Jiwoo · Yuha · Stella · Juun · A-na · Ian · Ye-on</p>
                </div>
                <div className="bg-white/20 backdrop-blur-md rounded-full px-3 py-1 text-xs text-white border border-white/30 hidden sm:block">
                  最新主打《Heart Beat Echo》
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
