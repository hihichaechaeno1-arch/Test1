/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Heart, ArrowUp } from 'lucide-react';

export const Footer: React.FC = () => {
  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <footer className="bg-white border-t border-slate-200/80 py-10 text-slate-500 text-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs">
              H2H
            </span>
            <span className="font-semibold text-slate-800">
              Hearts2Hearts 粉絲影片庫
            </span>
            <span className="text-slate-300" aria-hidden="true">·</span>
            <span>非官方粉絲整理分享平台</span>
          </div>

          <div className="flex items-center gap-4 text-slate-500">
            <span>收錄成員：Carmen · Jiwoo · Yuha · Stella · Juun · A-na · Ian · Ye-on</span>
            <button
              onClick={scrollToTop}
              className="flex items-center gap-1 text-slate-600 hover:text-rose-600 transition-colors p-1.5 rounded-md hover:bg-slate-50"
              title="回到頁首"
            >
              <ArrowUp className="w-3.5 h-3.5" />
              <span>頁首</span>
            </button>
          </div>
        </div>

        <div className="mt-6 pt-6 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2 text-slate-400 text-[11px]">
          <p>
            影片內容與著作權皆歸 YouTube 原創作者與 Hearts2Hearts 所屬官方公司所有。
          </p>
          <div className="flex items-center gap-1">
            <span>Made with</span>
            <Heart className="w-3 h-3 fill-rose-400 text-rose-400 inline" />
            <span>for H2H Fans Worldwide</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
