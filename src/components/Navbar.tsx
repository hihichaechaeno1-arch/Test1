/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Sparkles, Youtube } from 'lucide-react';

interface NavbarProps {
  activeTab: 'videos' | 'members' | 'pairings';
  onTabChange: (tab: 'videos' | 'members' | 'pairings') => void;
  selectedCount: number;
  onResetFilters: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  selectedCount,
  onResetFilters,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FAF8F5]/90 backdrop-blur-md border-b border-rose-100/70 transition-all">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Brand title wordmark */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTabChange('videos')}
            className="flex items-center gap-2 text-left group"
          >
            <span className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-sm shadow-sm group-hover:scale-105 transition-transform">
              H2H
            </span>
            <span className="text-xl font-bold tracking-tight text-slate-900 group-hover:text-rose-600 transition-colors">
              Hearts2Hearts
            </span>
          </button>
        </div>

        {/* Zone 2: Navigation Links */}
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button
            onClick={() => onTabChange('videos')}
            className={`transition-colors relative py-1 text-left ${
              activeTab === 'videos'
                ? 'text-rose-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            影片庫與 Shorts
            {activeTab === 'videos' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('members')}
            className={`transition-colors relative py-1 text-left ${
              activeTab === 'members'
                ? 'text-rose-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            認識 8 位成員
            {activeTab === 'members' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
            )}
          </button>

          <button
            onClick={() => onTabChange('pairings')}
            className={`transition-colors relative py-1 text-left ${
              activeTab === 'pairings'
                ? 'text-rose-600 font-semibold'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            熱門分隊與推薦
            {activeTab === 'pairings' && (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500 rounded-full" />
            )}
          </button>
        </nav>

        {/* Zone 3: Primary Actions */}
        <div className="flex items-center gap-3">
          {selectedCount > 0 && (
            <button
              onClick={onResetFilters}
              className="text-xs font-medium text-slate-500 hover:text-rose-600 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:border-rose-200 transition-colors hidden sm:block"
            >
              清除已選 ({selectedCount})
            </button>
          )}

          <a
            href="https://www.youtube.com"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-full shadow-sm hover:shadow transition-all"
          >
            <Youtube className="w-3.5 h-3.5 text-rose-400" />
            <span>官方頻道</span>
          </a>
        </div>
      </div>

      {/* Mobile Sub-Navigation Bar */}
      <div className="md:hidden flex items-center justify-around border-t border-rose-100/50 bg-[#FAF8F5]/95 px-2 py-2 text-xs font-medium">
        <button
          onClick={() => onTabChange('videos')}
          className={`py-1 px-3 rounded-md transition-colors ${
            activeTab === 'videos'
              ? 'text-rose-600 bg-rose-50 font-semibold'
              : 'text-slate-600'
          }`}
        >
          精選影片
        </button>
        <button
          onClick={() => onTabChange('members')}
          className={`py-1 px-3 rounded-md transition-colors ${
            activeTab === 'members'
              ? 'text-rose-600 bg-rose-50 font-semibold'
              : 'text-slate-600'
          }`}
        >
          成員介紹
        </button>
        <button
          onClick={() => onTabChange('pairings')}
          className={`py-1 px-3 rounded-md transition-colors ${
            activeTab === 'pairings'
              ? 'text-rose-600 bg-rose-50 font-semibold'
              : 'text-slate-600'
          }`}
        >
          分隊推薦
        </button>
      </div>
    </header>
  );
};
