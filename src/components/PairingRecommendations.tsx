/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { MemberName } from '../types';
import { Users, Sparkles, Flame, Mic, Compass } from 'lucide-react';

interface PairingRecommendationsProps {
  onSelectPairing: (members: MemberName[], mode?: 'AND' | 'OR') => void;
}

interface PairingItem {
  id: string;
  title: string;
  subtitle: string;
  members: MemberName[];
  mode: 'AND' | 'OR';
  icon: React.ReactNode;
  description: string;
  tag: string;
}

export const PairingRecommendations: React.FC<PairingRecommendationsProps> = ({
  onSelectPairing,
}) => {
  const pairings: PairingItem[] = [
    {
      id: 'p-1',
      title: '主唱天籟組 (Vocal Line)',
      subtitle: 'Carmen · Yuha · Ye-on',
      members: ['Carmen', 'Yuha', 'Ye-on'],
      mode: 'AND',
      icon: <Mic className="w-4 h-4 text-rose-500" />,
      description: '隊長 Carmen 的穩健高音、Yuha 的抒情創作與忙內 Ye-on 的靈魂穿透力，三人合聲 live 必聽！',
      tag: '三重高音',
    },
    {
      id: 'p-2',
      title: '舞力全開組 (Dance Line)',
      subtitle: 'Jiwoo · Stella · Ian',
      members: ['Jiwoo', 'Stella', 'Ian'],
      mode: 'AND',
      icon: <Flame className="w-4 h-4 text-amber-500" />,
      description: '主舞 Jiwoo 的卡點張力、Stella 的元氣爆發與 Ian 的敏捷身段，齊舞舞台與 Shorts 挑戰名場面。',
      tag: '齊舞卡點',
    },
    {
      id: 'p-3',
      title: '雙主饒舌組合 (Rap Cypher)',
      subtitle: 'Juun · A-na',
      members: ['Juun', 'A-na'],
      mode: 'AND',
      icon: <Sparkles className="w-4 h-4 text-purple-500" />,
      description: '低音砲 Juun 與精靈門面 A-na 的節奏碰撞，舞台風格又酷又颯，反差萌滿分。',
      tag: 'Flow 雙煞',
    },
    {
      id: 'p-4',
      title: '隊長與主舞 (Carmen & Jiwoo)',
      subtitle: 'Carmen · Jiwoo',
      members: ['Carmen', 'Jiwoo'],
      mode: 'AND',
      icon: <Users className="w-4 h-4 text-blue-500" />,
      description: '練習生時期一起走過的最強默契搭檔，雙人走廊手勢舞挑戰突破 300 萬觀看！',
      tag: '默契搭檔',
    },
    {
      id: 'p-5',
      title: '忙內打鬧組 (Maknae Line)',
      subtitle: 'Ian · Ye-on',
      members: ['Ian', 'Ye-on'],
      mode: 'AND',
      icon: <Compass className="w-4 h-4 text-orange-500" />,
      description: '團寵忙內二人組的日常相愛相殺，Vlog 與幕後花絮不可或缺的快樂泉源。',
      tag: '團寵忙內',
    },
    {
      id: 'p-6',
      title: '全員齊心 (Full Group)',
      subtitle: '全體 8 位成員',
      members: ['Carmen', 'Jiwoo', 'Yuha', 'Stella', 'Juun', 'A-na', 'Ian', 'Ye-on'],
      mode: 'AND',
      icon: <Sparkles className="w-4 h-4 text-rose-600" />,
      description: '收錄 Hearts2Hearts 官方 MV、全員完整打歌舞台、粉絲見面會的高清舞台大合集。',
      tag: '完整團體',
    },
  ];

  return (
    <section id="pairings-section" className="py-12 bg-[#FAF8F5]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="max-w-2xl mb-8">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <Users className="w-3 h-3 text-rose-500" />
            <span>Recommended Sub-Units</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            精選同框分隊與熱門 CP 組合
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            粉絲最愛的同框化學反應！點選卡片即可快速設定該組合並查看她們一同演出的影片。
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pairings.map((pairing) => (
            <div
              key={pairing.id}
              onClick={() => onSelectPairing(pairing.members, pairing.mode)}
              className="group bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-rose-300 hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
                    {pairing.icon}
                  </div>
                  <span className="text-[11px] font-semibold text-rose-600 bg-rose-50/80 px-2 py-0.5 rounded">
                    {pairing.tag}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                  {pairing.title}
                </h3>
                <p className="text-xs font-medium text-rose-700/80 mt-0.5">
                  {pairing.subtitle}
                </p>

                <p className="text-xs text-slate-500 leading-relaxed mt-2.5">
                  {pairing.description}
                </p>
              </div>

              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <span className="text-slate-400">
                  {pairing.members.length} 位成員同框
                </span>
                <span className="font-semibold text-rose-600 group-hover:underline">
                  查看組合影片 →
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
