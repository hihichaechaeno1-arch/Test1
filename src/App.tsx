/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { H2H_MEMBERS, MOCK_VIDEOS } from './data/h2hData';
import { MemberMatchMode, MemberName, SortOrder, VideoItem, VideoType, VideoGroup } from './types';
import { supabase, supabaseConfigError } from './lib/supabase';
import { fetchArchiveVideos } from './lib/archive';
import { MemberSelector } from './components/MemberSelector';
import { VideoCard } from './components/VideoCard';
import { Footer } from './components/Footer';
import { filterVideosByMembers, getVideoGroup, isOfficialH2HChannel, isOfficialShortsVideo, sortVideoItems, VIDEO_GROUPS } from './lib/videoData';
import { Search, Film, Flame, Heart, Users, Youtube, Layers, Loader2, Database, AlertCircle, RefreshCw, Sparkles, Tv, Clock, History, TrendingUp, ArrowUpDown, Filter } from 'lucide-react';

export type FilterGroup = 'all' | VideoGroup;

/** Filter to ensure official Hearts2Hearts channel only includes Shorts (excluding MVs & full-length variety shows) */
export const isSearchableVideo = (video: VideoItem): boolean => {
  if (isOfficialH2HChannel(video.channel)) {
    return isOfficialShortsVideo(video);
  }
  return true;
};

export default function App() {
  // Supabase video data & status state
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dataSource, setDataSource] = useState<'live' | 'demo' | 'empty' | 'error'>('empty');
  const request = useRef<AbortController | null>(null);
  const channelId = import.meta.env.NEXT_PUBLIC_YOUTUBE_CHANNEL_ID || '';
  const hasChannel = /^UC[A-Za-z0-9_-]{22}$/.test(channelId);

  // Member selection state (multiple selection supported)
  const [selectedMembers, setSelectedMembers] = useState<MemberName[]>([]);

  // Member matching mode: 'including' (contains all selected) vs 'only' (strictly only selected)
  const [memberMatchMode, setMemberMatchMode] = useState<MemberMatchMode>('including');

  // Video group filter: 'all' | 'shorts' | 'stage' | 'others'
  const [groupFilter, setGroupFilter] = useState<FilterGroup>('all');

  // Video sort order: 'new' | 'old' | 'popular'
  const [sortOrder, setSortOrder] = useState<SortOrder>('new');

  // Search keyword query
  const [searchQuery, setSearchQuery] = useState('');

  const showDemo = useCallback(() => {
    request.current?.abort();
    setVideos(MOCK_VIDEOS.filter(isSearchableVideo).map(video => ({ ...video, isSample: true }))
      .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)));
    setDataSource('demo');
    setFetchError(null);
    setIsLoading(false);
  }, []);

  const fetchVideosFromSupabase = useCallback(async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsLoading(true);
    setFetchError(null);
    try {
      if (supabaseConfigError) throw new Error(supabaseConfigError);
      if (!supabase) { showDemo(); return; }
      const rowFormat = import.meta.env.NEXT_PUBLIC_VIDEO_ROW_FORMAT || 'legacy';
      if (rowFormat !== 'legacy' && rowFormat !== 'canonical') throw new Error('影片欄位格式設定無效');
      const loaded = await fetchArchiveVideos(supabase,
        AbortSignal.any([controller.signal, AbortSignal.timeout(30000)]), rowFormat);
      if (controller.signal.aborted) return;
      const searchable = loaded.filter(isSearchableVideo);
      setVideos(searchable);
      setDataSource(searchable.length ? 'live' : 'empty');
    } catch {
      if (controller.signal.aborted) return;
      setVideos([]);
      setDataSource('error');
      setFetchError('無法載入完整資料；請檢查公開設定、資料表欄位及讀取權限後重試。');
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [showDemo]);

  useEffect(() => {
    fetchVideosFromSupabase();
    return () => request.current?.abort();
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
    return filterVideosByMembers(videos, selectedMembers, memberMatchMode);
  }, [selectedMembers, videos, memberMatchMode]);

  const allCount = memberFilteredBase.length;
  const officialCount = memberFilteredBase.filter((v) => (v.group || getVideoGroup(v)) === 'official').length;
  const shortsCount = memberFilteredBase.filter((v) => (v.group || getVideoGroup(v)) === 'shorts').length;
  const stageCount = memberFilteredBase.filter((v) => (v.group || getVideoGroup(v)) === 'stage').length;
  const othersCount = memberFilteredBase.filter((v) => (v.group || getVideoGroup(v)) === 'others').length;

  // Final filtered list including group filter, search query, and sort order (new, old, popular)
  const filteredVideos = useMemo(() => {
    const matches = memberFilteredBase.filter((video) => {
      // 1. Group filter
      const group = video.group || getVideoGroup(video);
      if (groupFilter !== 'all' && group !== groupFilter) {
        return false;
      }

      // 2. Search query filter
      if (searchQuery.trim() !== '') {
        const query = searchQuery.toLowerCase().trim();
        const matchesTitle = video.title.toLowerCase().includes(query);
        const matchesChannel = video.channel.toLowerCase().includes(query);
        const matchesDescription = video.description.toLowerCase().includes(query);
        const groupInfo = VIDEO_GROUPS[group];
        const matchesGroup = groupInfo?.label.toLowerCase().includes(query) || groupInfo?.shortLabel.toLowerCase().includes(query);
        if (!matchesTitle && !matchesChannel && !matchesDescription && !matchesGroup) {
          return false;
        }
      }

      return true;
    });

    // 3. Sort by 'new' (newest), 'old' (oldest), or 'popular' (highest views)
    return sortVideoItems(matches, sortOrder);
  }, [memberFilteredBase, groupFilter, searchQuery, sortOrder]);

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
                成員標籤影像資料庫
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            <div role="status" className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700">
              <span>{isLoading ? '載入中' : dataSource === 'live' ? '資料庫資料' : dataSource === 'demo' ? '示範資料' : dataSource === 'error' ? '連線或資料錯誤' : '資料庫暫無資料'}</span>
              {!isLoading && (dataSource === 'live' || dataSource === 'demo') && (
                <span className="font-semibold text-rose-600 bg-white/90 px-1.5 py-0.5 rounded-full border border-rose-200/60 tabular-nums">
                  共 {videos.length} 部
                </span>
              )}
            </div>

            <a
              href={hasChannel ? `https://www.youtube.com/channel/${channelId}` : 'https://www.youtube.com'}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 hover:text-rose-600 rounded-full border border-slate-200 hover:border-rose-200 bg-white transition-colors shadow-2xs"
            >
              <Youtube className="w-3.5 h-3.5 text-rose-500" />
              <span>{hasChannel ? '已設定頻道' : 'YouTube'}</span>
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
            Hearts2Hearts 成員標籤搜尋
          </h1>
          <p className="text-sm sm:text-base text-slate-600 font-normal">
            依成員標籤搜尋影片；文字推測及舊資料標籤未經同框核實
          </p>
        </div>

        <div role={dataSource === 'error' ? 'alert' : 'status'} className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600 space-y-2">
          <p>{isLoading ? '正在載入完整影片資料...' : dataSource === 'demo'
            ? '目前為示範資料：標題與成員資訊僅供介面測試，示範卡片不提供播放連結。'
            : dataSource === 'error' ? fetchError
            : dataSource === 'empty' ? '目前沒有可讀取的影片資料；請檢查資料庫內容與公開讀取政策。'
            : `已載入資料庫可讀取的影片（共 ${videos.length} 部）；成員標籤為文字關聯，不保證實際同框。`}</p>
          {!isLoading && (
            <div className="flex gap-4">
              <button onClick={fetchVideosFromSupabase} className="underline text-rose-700">重新讀取資料</button>
              {dataSource !== 'demo' && <button onClick={showDemo} className="underline">檢視示範資料</button>}
            </div>
          )}
        </div>

        {/* Member Selector Component */}
        <MemberSelector
          members={H2H_MEMBERS}
          selectedMembers={selectedMembers}
          onToggleMember={handleToggleMember}
          onClearAll={handleClearAll}
          matchMode={memberMatchMode}
          onMatchModeChange={setMemberMatchMode}
        />

        {/* Quick Presets Recommendation Bar */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-slate-500">
          <span className="font-medium text-slate-400">快速推薦：</span>
          <button
            onClick={() => handleSelectPreset(['Carmen', 'Jiwoo', 'Yuha', 'Stella', 'Juun', 'A-na', 'Ian', 'Ye-on'])}
            className="px-2.5 py-1 rounded-full bg-white hover:bg-rose-50 text-slate-700 hover:text-rose-700 border border-slate-200 hover:border-rose-200 transition-colors cursor-pointer"
          >
            全員 8 人標籤
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

        {/* 2. 影片分類群組切換（Filter Tabs）與排序／搜尋 */}
        <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-2xs flex flex-col xl:flex-row xl:items-center justify-between gap-3">
          {/* 3 Groups Segmented Filter Tabs: 全部 / 官方 Shorts / 舞台與直拍 / 其他影片 */}
          <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-xl text-xs font-semibold overflow-x-auto no-scrollbar w-full xl:w-auto">
            {/* 1. 全部 */}
            <button
              type="button"
              onClick={() => setGroupFilter('all')}
              aria-pressed={groupFilter === 'all'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                groupFilter === 'all'
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

            {/* 2. 官方 Shorts */}
            <button
              type="button"
              onClick={() => setGroupFilter('shorts')}
              aria-pressed={groupFilter === 'shorts'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                groupFilter === 'shorts'
                  ? 'bg-white text-amber-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Flame className="w-3.5 h-3.5 text-amber-500 fill-amber-500/20" />
              <span>官方 Shorts</span>
              {selectedMembers.length > 0 && !isLoading && (
                <span className="text-[11px] font-mono tabular-nums opacity-75">
                  ({shortsCount})
                </span>
              )}
            </button>

            {/* 3. 舞台與直拍 */}
            <button
              type="button"
              onClick={() => setGroupFilter('stage')}
              aria-pressed={groupFilter === 'stage'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                groupFilter === 'stage'
                  ? 'bg-white text-indigo-600 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Tv className="w-3.5 h-3.5 text-indigo-500" />
              <span>舞台與直拍</span>
              {selectedMembers.length > 0 && !isLoading && (
                <span className="text-[11px] font-mono tabular-nums opacity-75">
                  ({stageCount})
                </span>
              )}
            </button>

            {/* 4. 其他影片 */}
            <button
              type="button"
              onClick={() => setGroupFilter('others')}
              aria-pressed={groupFilter === 'others'}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                groupFilter === 'others'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Film className="w-3.5 h-3.5 text-slate-500" />
              <span>其他影片 (綜藝/專訪)</span>
              {selectedMembers.length > 0 && !isLoading && (
                <span className="text-[11px] font-mono tabular-nums opacity-75">
                  ({othersCount})
                </span>
              )}
            </button>
          </div>

          {/* Right Controls: Sort segmented control + Keyword Search */}
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5 w-full xl:w-auto">
            {/* Sort Control: 最新 (new) · 最舊 (old) · 熱門 (popular) */}
            <div className="flex items-center gap-0.5 p-1 bg-slate-100/90 rounded-xl text-xs font-medium shrink-0" role="toolbar" aria-label="影片排序">
              <span className="text-[11px] text-slate-400 font-normal px-1.5 flex items-center gap-1 shrink-0">
                <ArrowUpDown className="w-3 h-3 text-slate-400" />
                <span className="hidden sm:inline">排序：</span>
              </span>
              <button
                type="button"
                onClick={() => setSortOrder('new')}
                aria-pressed={sortOrder === 'new'}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-xs font-semibold ${
                  sortOrder === 'new'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="依最新發布日期排序"
              >
                <Clock className="w-3 h-3 text-rose-500" />
                <span>最新</span>
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('old')}
                aria-pressed={sortOrder === 'old'}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-xs font-semibold ${
                  sortOrder === 'old'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="依最舊發布日期排序"
              >
                <History className="w-3 h-3 text-slate-500" />
                <span>最舊</span>
              </button>
              <button
                type="button"
                onClick={() => setSortOrder('popular')}
                aria-pressed={sortOrder === 'popular'}
                className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer whitespace-nowrap text-xs font-semibold ${
                  sortOrder === 'popular'
                    ? 'bg-white text-rose-600 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="依最高觀看次數排序"
              >
                <TrendingUp className="w-3 h-3 text-amber-500" />
                <span>熱門</span>
              </button>
            </div>

            {/* Keyword Search Input */}
            <div className="relative w-full sm:w-56 shrink-0">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <label htmlFor="video-search" className="sr-only">搜尋標題、頻道或描述</label>
              <input
                id="video-search"
                type="search"
                placeholder="搜尋標題、頻道或描述..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-400"
              />
            </div>
          </div>
        </div>

        {/* 3. Video Results Section */}
        <section className="space-y-6" aria-busy={isLoading}>
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
          ) : (
            /* Video List Section: Shows all videos if no members selected, or filtered videos if members selected */
            <div className="space-y-6">
              {/* Header Info Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-200/80">
                <div>
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                    <span>{selectedMembers.length > 0 ? '標籤搜尋結果' : '全部收錄影片'}</span>
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                      共 {filteredVideos.length} 部
                    </span>
                    {selectedMembers.length > 0 && (
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                        {memberMatchMode === 'only' ? '僅限 (Only)' : '包含 (Including)'}
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-slate-500 mt-1">
                    {selectedMembers.length > 0 ? (
                      <>
                        <span>{memberMatchMode === 'only' ? '嚴格僅限成員：' : '必須包含標籤：'}</span>
                        <span className="font-semibold text-rose-700 ml-1">
                          {selectedMembers.join(' + ')}
                        </span>
                      </>
                    ) : (
                      <span>顯示全部影片；可點選上方成員頭像進行同框篩選</span>
                    )}
                    <span className="text-slate-400 ml-2 hidden sm:inline">{dataSource === 'demo' ? '（示範卡片不提供播放）' : '（點擊卡片將於新分頁開啟 YouTube）'}</span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                  {/* Mode switch button - shown when members are selected */}
                  {selectedMembers.length > 0 && (
                    <div className="flex items-center p-0.5 bg-slate-100 rounded-lg text-xs font-medium">
                      <button
                        type="button"
                        onClick={() => setMemberMatchMode('including')}
                        aria-pressed={memberMatchMode === 'including'}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                          memberMatchMode === 'including'
                            ? 'bg-white text-rose-600 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        包含 (Including)
                      </button>
                      <button
                        type="button"
                        onClick={() => setMemberMatchMode('only')}
                        aria-pressed={memberMatchMode === 'only'}
                        className={`px-2 py-1 rounded-md transition-all cursor-pointer ${
                          memberMatchMode === 'only'
                            ? 'bg-white text-rose-600 shadow-2xs font-semibold'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        僅限 (Only)
                      </button>
                    </div>
                  )}

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
                    暫時沒有找到符合條件的影片
                  </h4>
                  <p className="mt-1.5 text-xs text-slate-500 leading-relaxed">
                    {selectedMembers.length > 0 ? (
                      <>所選成員 <strong>{selectedMembers.join(' + ')}</strong> 在「{groupFilter === 'all' ? '全部' : VIDEO_GROUPS[groupFilter]?.label || groupFilter}」分類下尚未有符合記錄，請嘗試切換分類、切換為包含模式或調整選取組合。</>
                    ) : (
                      <>在「{groupFilter === 'all' ? '全部' : VIDEO_GROUPS[groupFilter]?.label || groupFilter}」分類或目前關鍵字下查無影片，請嘗試清除關鍵字或切換分類。</>
                    )}
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-2">
                    {groupFilter !== 'all' && (
                      <button
                        onClick={() => setGroupFilter('all')}
                        className="px-3.5 py-1.5 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg border border-rose-200 transition-colors cursor-pointer"
                      >
                        查看全部分類
                      </button>
                    )}
                    {selectedMembers.length > 0 && (
                      <button
                        onClick={handleClearAll}
                        className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                      >
                        清除成員條件
                      </button>
                    )}
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
