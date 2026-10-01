/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { H2H_MEMBERS, MOCK_VIDEOS } from './data/h2hData';
import { MemberName, VideoItem, VideoType } from './types';
import { supabase, mapSupabaseRowToVideoItem } from './lib/supabase';
import { MemberSelector } from './components/MemberSelector';
import { VideoCard } from './components/VideoCard';
import { Footer } from './components/Footer';
import { Search, Film, Flame, Heart, Users, Youtube, Layers, Loader2, Database, AlertCircle, RefreshCw } from 'lucide-react';

export default function App() {
  // Supabase video data & status state
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Member selection state (multiple selection supported)
  const [selectedMembers, setSelectedMembers] = useState<MemberName[]>([]);

  // Video format filter: 'all' | 'video' | 'shorts'
  const [formatFilter, setFormatFilter] = useState<'all' | VideoType>('all');

  // Search keyword query
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch videos from Supabase 'videos' table on component mount
  const fetchVideosFromSupabase = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);

    try {
      // Query videos from Supabase table ordered by published_at DESC
      let { data, error } = await supabase
        .from('videos')
        .select('*')
        .order('published_at', { ascending: false });

      // If ordering by published_at failed, try ordering by publishedAt or default query
      if (error) {
        const retry = await supabase
          .from('videos')
          .select('*');

        if (retry.error) {
          throw retry.error;
        }
        data = retry.data;
      }

      if (data && data.length > 0) {
        const mapped = data.map(mapSupabaseRowToVideoItem);
        // Sort descending by publication date
        mapped.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
        setVideos(mapped);
      } else {
        // Fallback to MOCK_VIDEOS if table is currently empty
        setVideos(MOCK_VIDEOS);
      }
    } catch (err: any) {
      console.warn('Supabase fetch error, using fallback data:', err);
      setFetchError(err.message || '無法從 Supabase 取得資料');
      // Graceful fallback to initial mock dataset so the website is always functional
      setVideos(MOCK_VIDEOS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVideosFromSupabase();
  }, [fetchVideosFromSupabase]);

  // Toggle single member in selection
  const handleToggleMember = (name: MemberName) => {
    setSelectedMembers((prev) =>
      prev.includes(name) ? prev.filter((m) => m !== name) : [...prev, name]
    );
  };

  // Clear all selections
  const handleClearAll = () => {
    setSelectedMembers([]);
  };

  // Quick preset helper
  const handleSelectPreset = (presetNames: MemberName[]) => {
    setSelectedMembers(presetNames);
  };

  // Pre-calculate count for current member selection (for tabs counter)
  const memberFilteredBase = useMemo(() => {
    if (selectedMembers.length === 0) return [];
    return videos.filter((video) =>
      selectedMembers.every((m) => video.members.includes(m))
    );
  }, [selectedMembers, videos]);

  const allCount = memberFilteredBase.length;
  const videoCount = memberFilteredBase.filter((v) => v.type === 'video').length;
  const shortsCount = memberFilteredBase.filter((v) => v.type === 'shorts').length;

  // Final filtered list including format filter and search query
  const filteredVideos = useMemo(() => {
    if (selectedMembers.length === 0) {
      return [];
    }

    return memberFilteredBase.filter((video) => {
      // 1. Format filter (all / video / shorts)
      if (formatFilter !== 'all' && video.type !== formatFilter) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = video.title.toLowerCase().includes(query);
        const matchesChannel = video.channel.toLowerCase().includes(query);
        const matchesDescription = video.description.toLowerCase().includes(query);
        if (!matchesTitle && !matchesChannel && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }, [memberFilteredBase, formatFilter, searchQuery, selectedMembers]);

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-800 flex flex-col font-sans">
      {/* 1. Top Minimal Navigation Bar */}
      <header className="border-b border-rose-100/70 bg-white/90 backdrop-blur-md sticky top-0 z-30 transition-all">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center font-bold text-xs tracking-tight shadow-xs">
              H2H
            </span>
            <div className="flex flex-col">
              <span className="font-bold text-slate-900 tracking-tight text-sm sm:text-base leading-tight">
                Hearts2Hearts
              </span>
              <span className="text-[10px] text-slate-400 font-medium hidden sm:inline leading-none">
                成員同框影像資料庫
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Supabase status indicator */}
            <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200/70">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span>Supabase 資料庫連線</span>
            </div>

            <a
              href="https://www.youtube.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-rose-600 rounded-full border border-slate-200 hover:border-rose-200 bg-white transition-colors shadow-2xs"
            >
              <Youtube className="w-3.5 h-3.5 text-rose-500" />
              <span>官方頻道</span>
            </a>
          </div>
        </div>
      </header>

      {/* 2. Main Page Content */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 space-y-8">
        {/* Page Top Heading & Subtitle */}
        <div className="text-center space-y-2 max-w-xl mx-auto pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100/80 text-rose-700 text-xs font-semibold uppercase tracking-wider mb-1">
            <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
            <span>H2H Video & Shorts Archive</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900">
            Hearts2Hearts 成員同框搜尋
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            選擇成員，找出他們一起出現的影片
          </p>
        </div>

        {/* Member Selector Component */}
        <MemberSelector
          members={H2H_MEMBERS}
          selectedMembers={selectedMembers}
          onToggleMember={handleToggleMember}
          onClearAll={handleClearAll}
        />

        {/* Quick Presets Recommendation Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-400">快速推薦：</span>
          <button
            onClick={() => handleSelectPreset(['Carmen', 'Jiwoo', 'Yuha', 'Stella', 'Juun', 'A-na', 'Ian', 'Ye-on'])}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
          >
            全員 8 人同框
          </button>
          <button
            onClick={() => handleSelectPreset(['Carmen', 'Jiwoo'])}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
          >
            Carmen & Jiwoo
          </button>
          <button
            onClick={() => handleSelectPreset(['Juun', 'A-na'])}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
          >
            Juun & A-na
          </button>
          <button
            onClick={() => handleSelectPreset(['Carmen', 'Yuha', 'Ye-on'])}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
          >
            主唱三人組 (Carmen · Yuha · Ye-on)
          </button>
          <button
            onClick={() => handleSelectPreset(['Jiwoo', 'Stella', 'Ian'])}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
          >
            舞線三人組 (Jiwoo · Stella · Ian)
          </button>
        </div>

        {/* 2. 類型篩選按鈕（Filter Tabs）喺成員選擇區同影片列表之間 */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Segmented Filter Tabs: 全部 / 完整影片 / Shorts 短片 */}
          <div className="flex items-center p-1 bg-slate-100/90 rounded-xl text-xs font-semibold w-full sm:w-auto">
            <button
              onClick={() => setFormatFilter('all')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                formatFilter === 'all'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>全部</span>
              {selectedMembers.length > 0 && !isLoading && (
                <span className="text-[11px] font-mono tabular-nums opacity-75">
                  ({allCount})
                </span>
              )}
            </button>

            <button
              onClick={() => setFormatFilter('video')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                formatFilter === 'video'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film className="w-3.5 h-3.5" />
              <span>完整影片</span>
              {selectedMembers.length > 0 && !isLoading && (
                <span className="text-[11px] font-mono tabular-nums opacity-75">
                  ({videoCount})
                </span>
              )}
            </button>

            <button
              onClick={() => setFormatFilter('shorts')}
              className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg transition-all cursor-pointer ${
                formatFilter === 'shorts'
                  ? 'bg-white text-rose-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-rose-500" />
              <span>Shorts 短片</span>
              {selectedMembers.length > 0 && !isLoading && (
                <span className="text-[11px] font-mono tabular-nums opacity-75">
                  ({shortsCount})
                </span>
              )}
            </button>
          </div>

          {/* Keyword Search Input */}
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="搜尋標題或頻道..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8.5 pr-3 py-2 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
            />
          </div>
        </div>

        {/* 3. Video Results Section */}
        <section className="space-y-6">
          {/* Loading State */}
          {isLoading ? (
            <div className="py-20 px-6 text-center bg-white rounded-2xl border border-slate-200/80 shadow-2xs max-w-xl mx-auto">
              <div className="w-12 h-12 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-3 animate-spin">
                <Loader2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                正在從 Supabase 讀取影片資料庫...
              </h3>
              <p className="mt-1 text-xs text-slate-400">
                依據發布日期排序載入最新同框內容
              </p>
            </div>
          ) : selectedMembers.length === 0 ? (
            /* Conditional Rendering: When no member is selected */
            <div className="py-16 sm:py-20 px-6 text-center bg-white rounded-2xl border border-dashed border-rose-200/90 shadow-2xs max-w-2xl mx-auto">
              <div className="w-16 h-16 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center mx-auto mb-4 border border-rose-100">
                <Users className="w-8 h-8 stroke-[1.5]" />
              </div>
              <h3 className="text-lg sm:text-xl font-bold text-slate-800">
                請先選擇一位或多位成員
              </h3>
              <p className="mt-2 text-xs sm:text-sm text-slate-500 max-w-md mx-auto leading-relaxed">
                點擊上方圓形頭像即可找出成員共同出現的 YouTube 完整影片與 Shorts 短片！例如同時點選 <strong>Carmen</strong> 與 <strong>Jiwoo</strong>，即可立即看到兩位成員同框出演的精彩舞台。
              </p>
            </div>
          ) : (
            /* When members are selected: Show header and matching videos */
            <div className="space-y-6">
              {/* Header Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span>同框搜尋結果</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      共 {filteredVideos.length} 部
                    </span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    必須同時出現：
                    <span className="font-semibold text-rose-700 ml-1">
                      {selectedMembers.join(' + ')}
                    </span>
                    <span className="text-slate-400 ml-2 hidden sm:inline">（點擊卡片將於新分頁開啟 YouTube）</span>
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {fetchError && (
                    <button
                      onClick={fetchVideosFromSupabase}
                      className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 bg-amber-50 px-2 py-1 rounded-md border border-amber-200 transition-colors"
                      title="重試連線至 Supabase"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>重新連線</span>
                    </button>
                  )}

                  {selectedMembers.length > 0 && (
                    <button
                      onClick={handleClearAll}
                      className="text-xs text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                    >
                      重設成員篩選
                    </button>
                  )}
                </div>
              </div>

              {/* Video Grid or Empty Results */}
              {filteredVideos.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7">
                  {filteredVideos.map((video) => (
                    <VideoCard
                      key={video.id}
                      video={video}
                      selectedMembers={selectedMembers}
                    />
                  ))}
                </div>
              ) : (
                /* No matching video found for this combination */
                <div className="py-16 px-6 text-center bg-white rounded-2xl border border-slate-200 max-w-md mx-auto shadow-2xs">
                  <div className="w-14 h-14 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3.5">
                    <Film className="w-7 h-7 stroke-[1.5]" />
                  </div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-800">
                    暫時沒有找到符合的同框影片
                  </h4>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    所選成員 <strong>{selectedMembers.join(' + ')}</strong> 在「{formatFilter === 'all' ? '全部' : formatFilter === 'video' ? '完整影片' : 'Shorts 短片'}」分類下尚未有同框記錄，請嘗試切換標籤或調整選取組合。
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {formatFilter !== 'all' && (
                      <button
                        onClick={() => setFormatFilter('all')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                      >
                        查看全部類別
                      </button>
                    )}
                    <button
                      onClick={handleClearAll}
                      className="px-3.5 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      重設成員選擇
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      </main>

      {/* 4. Minimalist Footer */}
      <Footer />
    </div>
  );
}
