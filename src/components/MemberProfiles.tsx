/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Member, MemberName } from '../types';
import { Heart, Film, ArrowRight } from 'lucide-react';

interface MemberProfilesProps {
  members: Member[];
  onSelectMemberAndScroll: (name: MemberName) => void;
}

const ProfileAvatar: React.FC<{ member: Member }> = ({ member }) => {
  const [hasError, setHasError] = useState(false);
  const showImage = Boolean(member.imageUrl) && !hasError;

  return (
    <div className="w-14 h-14 rounded-2xl overflow-hidden border border-slate-200 shadow-xs shrink-0 bg-slate-100 flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
      {showImage ? (
        <img
          src={member.imageUrl}
          alt={member.name}
          width={128}
          height={128}
          loading="lazy"
          decoding="async"
          onError={() => setHasError(true)}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover image-hd"
          style={{
            imageRendering: '-webkit-optimize-contrast',
            transform: 'translateZ(0)',
            backfaceVisibility: 'hidden',
          }}
        />
      ) : (
        <div className={`w-full h-full flex items-center justify-center font-bold text-lg ${member.avatarBg}`}>
          {member.name.slice(0, 2)}
        </div>
      )}
    </div>
  );
};

export const MemberProfiles: React.FC<MemberProfilesProps> = ({
  members,
  onSelectMemberAndScroll,
}) => {
  return (
    <section id="members-section" className="py-12 bg-white border-y border-rose-100/60">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="max-w-2xl mb-10">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-rose-50 border border-rose-100 text-rose-700 text-xs font-semibold uppercase tracking-wider mb-2">
            <Heart className="w-3 h-3 fill-rose-500 text-rose-500" />
            <span>Meet The 8 Hearts</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">
            認識 Hearts2Hearts 成員檔案
          </h2>
          <p className="mt-2 text-sm sm:text-base text-slate-600">
            點選每位成員卡片上的「看她的影片」，即可快速切換至專屬的同框舞台與 Shorts 列表。
          </p>
        </div>

        {/* 8 Members Grid (Clean unboxed editorial style, responsive 1 -> 2 -> 4 cols) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {members.map((member) => (
            <div
              key={member.id}
              className="group bg-[#FAF8F5]/80 hover:bg-white rounded-2xl p-5 border border-slate-200/80 hover:border-rose-200 hover:shadow-md transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Header: Avatar, English Name, Korean Name */}
                <div className="flex items-center gap-3 mb-4">
                  <ProfileAvatar member={member} />
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 group-hover:text-rose-600 transition-colors">
                      {member.name}
                    </h3>
                    <p className="text-xs text-slate-400 font-medium">
                      {member.koreanName} · 生日 {member.birthday}
                    </p>
                    <span className="text-[11px] text-slate-500 font-mono">
                      MBTI: {member.mbti}
                    </span>
                  </div>
                </div>

                {/* Role / Position */}
                <div className="text-xs font-semibold text-rose-700 pb-2.5 mb-2.5 border-b border-rose-100/60">
                  {member.role}
                </div>

                {/* Charm Point */}
                <div className="text-xs text-slate-600 mb-3 space-y-1">
                  <p className="font-medium text-slate-700">魅力看點：</p>
                  <p className="text-slate-500 leading-relaxed text-[13px]">
                    {member.charm}
                  </p>
                </div>

                {/* Bio text */}
                <p className="text-xs text-slate-500 leading-relaxed line-clamp-3">
                  {member.bio}
                </p>
              </div>

              {/* Action: View Videos */}
              <div className="pt-4 mt-4 border-t border-slate-100">
                <button
                  onClick={() => onSelectMemberAndScroll(member.name)}
                  className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-semibold bg-white group-hover:bg-rose-600 text-slate-700 group-hover:text-white border border-slate-200 group-hover:border-rose-600 shadow-2xs transition-all cursor-pointer"
                >
                  <Film className="w-3.5 h-3.5" />
                  <span>查看 {member.name} 的影片</span>
                  <ArrowRight className="w-3 h-3 transition-transform group-hover:translate-x-0.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
