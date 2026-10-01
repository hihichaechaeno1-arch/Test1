/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Member, MemberName } from '../types';
import { Check, RotateCcw, X, Users } from 'lucide-react';

interface MemberSelectorProps {
  members: Member[];
  selectedMembers: MemberName[];
  onToggleMember: (name: MemberName) => void;
  onClearAll: () => void;
}

/**
 * Individual Member Avatar with image loading & automatic fallback handling
 */
const MemberAvatarItem: React.FC<{
  member: Member;
  isSelected: boolean;
}> = ({ member, isSelected }) => {
  const [hasError, setHasError] = useState(false);
  const initial = member.name.charAt(0);
  const showImage = Boolean(member.imageUrl) && !hasError;

  return (
    <div className="relative mb-2">
      <div
        className={`w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center font-bold text-lg sm:text-xl overflow-hidden transition-all duration-200 ${
          isSelected
            ? 'ring-3 ring-rose-500 ring-offset-2 ring-offset-white shadow-md scale-105'
            : 'border border-slate-200/90 hover:ring-2 hover:ring-rose-300 hover:scale-102 shadow-2xs'
        }`}
      >
        {showImage ? (
          <img
            src={member.imageUrl}
            alt={member.name}
            width={128}
            height={128}
            loading="eager"
            decoding="async"
            onError={() => setHasError(true)}
            referrerPolicy="no-referrer"
            className="w-16 h-16 rounded-full object-cover image-hd"
            style={{
              imageRendering: '-webkit-optimize-contrast',
              transform: 'translateZ(0)',
              backfaceVisibility: 'hidden',
            }}
          />
        ) : (
          <div
            className={`w-full h-full flex items-center justify-center ${
              isSelected ? 'bg-rose-500 text-white' : `${member.avatarBg}`
            }`}
          >
            <span>{initial}</span>
          </div>
        )}
      </div>

      {/* Selected Checkmark Badge */}
      {isSelected && (
        <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-rose-600 text-white flex items-center justify-center border-2 border-white shadow-xs animate-in zoom-in-75 duration-150 z-10">
          <Check className="w-3 h-3 stroke-[3]" />
        </div>
      )}
    </div>
  );
};

export const MemberSelector: React.FC<MemberSelectorProps> = ({
  members,
  selectedMembers,
  onToggleMember,
  onClearAll,
}) => {
  const selectedCount = selectedMembers.length;
  const hasSelected = selectedCount > 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/90 p-5 sm:p-7 shadow-xs transition-all">
      {/* 1. Top Bar: Title, Selected Count Indicator & Clear Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              選擇成員
            </h2>
            {/* Display count dynamically */}
            <span
              className={`text-xs font-semibold px-2.5 py-0.5 rounded-full transition-colors ${
                hasSelected
                  ? 'bg-rose-50 text-rose-600 border border-rose-200 shadow-2xs'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {hasSelected ? `已選擇 ${selectedCount} 位成員` : '尚未選擇成員'}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            點擊下方圓形頭像可複選多位成員，系統將嚴格搜尋全員共同出席的影片
          </p>
        </div>

        {/* Clear Selection Button */}
        <div>
          <button
            onClick={onClearAll}
            disabled={!hasSelected}
            className={`w-full sm:w-auto flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              hasSelected
                ? 'bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 cursor-pointer shadow-2xs'
                : 'bg-slate-100 text-slate-400 border border-transparent cursor-not-allowed opacity-60'
            }`}
            title={hasSelected ? '清除所有已選成員' : '目前尚未選擇任何成員'}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>清除選擇</span>
          </button>
        </div>
      </div>

      {/* 2. Circular Avatar + Name Grid */}
      <div className="pt-6">
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 sm:gap-4">
          {members.map((member) => {
            const isSelected = selectedMembers.includes(member.name);

            return (
              <button
                key={member.id}
                type="button"
                onClick={() => onToggleMember(member.name)}
                className="group flex flex-col items-center cursor-pointer transition-transform duration-150 active:scale-95 focus:outline-none"
              >
                {/* Circular Avatar with Image & Fallback */}
                <MemberAvatarItem
                  member={member}
                  isSelected={isSelected}
                />

                {/* Member Name */}
                <span
                  className={`text-xs sm:text-sm font-semibold tracking-tight transition-colors text-center ${
                    isSelected
                      ? 'text-rose-600 font-bold'
                      : 'text-slate-700 group-hover:text-slate-900'
                  }`}
                >
                  {member.name}
                </span>

                {/* Korean Subtitle */}
                <span className="text-[10px] text-slate-400 text-center">
                  {member.koreanName}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Bottom Tags: Display currently selected members */}
      {hasSelected && (
        <div className="mt-6 pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2 animate-in fade-in duration-200">
          <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 mr-1">
            <Users className="w-3.5 h-3.5 text-rose-500" />
            <span>目前選中：</span>
          </div>

          {selectedMembers.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-rose-50 text-rose-700 border border-rose-200 shadow-2xs"
            >
              <span>{name}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleMember(name);
                }}
                className="hover:text-rose-900 hover:bg-rose-200/60 rounded-full p-0.5 transition-colors cursor-pointer"
                title={`取消選取 ${name}`}
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          <button
            type="button"
            onClick={onClearAll}
            className="text-[11px] text-slate-400 hover:text-rose-600 underline ml-auto transition-colors cursor-pointer"
          >
            全部清除
          </button>
        </div>
      )}
    </div>
  );
};
