import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VideoCard } from '../src/components/VideoCard';
import { VideoModal } from '../src/components/VideoModal';
import { MemberSelector } from '../src/components/MemberSelector';
import { mapSupabaseRowToVideoItem } from '../src/lib/videoData';
import type { Member, VideoItem } from '../src/types';

const video: VideoItem = {
  id: '1', title: 'Archive clip', youtubeId: 'abcdefghijk', thumbnailUrl: 'https://example.com/image.jpg',
  members: ['Carmen'], type: 'video', category: 'all', channel: 'Channel', publishedAt: '',
  duration: '未提供', views: '', description: 'Description',
};

test('demo content cannot navigate users to unrelated YouTube videos', () => {
  const html = renderToStaticMarkup(<VideoCard video={{ ...video, isSample: true }} selectedMembers={[]} />);
  assert.ok(!/<a\b/.test(html));
  assert.match(html, /示範/);
});

test('live card opens in-page playback instead of leaving for YouTube', () => {
  const html = renderToStaticMarkup(<VideoCard video={video} selectedMembers={['Carmen']} onPlay={() => {}} />);
  assert.match(html, /<button/);
  assert.match(html, /data-playback-id="abcdefghijk"/);
  assert.match(html, /在本頁播放/);
  assert.doesNotMatch(html, /<a\b/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /未核實/);
});

test('a freshly imported legacy row renders the intended playback link without official-source claims', () => {
  const mapped = mapSupabaseRowToVideoItem({
    id: 0, url: 'https://www.youtube.com/shorts/abcdefghijk', type: 'shorts',
    title: 'Unlabeled clip', channel: 'Unofficial Hearts2Hearts Fan', members: [],
  });
  const html = renderToStaticMarkup(<VideoCard video={mapped} selectedMembers={[]} />);
  assert.doesNotMatch(html, /<a\b/);
  assert.doesNotMatch(html, /iframe/);
  assert.doesNotMatch(html, /undefined|9:16|官方 MV|其他官方影音/);
  assert.match(html, /未核實 \(0\)/);
});

test('live YouTube modal embeds the video and still links out to YouTube', () => {
  const html = renderToStaticMarkup(<VideoModal video={video} onClose={() => {}} onSelectMember={() => {}} />);
  assert.match(html, /role="dialog"/);
  assert.match(html, /youtube-nocookie.com\/embed\/abcdefghijk/);
  assert.match(html, /href="https:\/\/www.youtube.com\/watch\?v=abcdefghijk"/);
  assert.equal(renderToStaticMarkup(<VideoModal video={{ ...video, isSample: true }} onClose={() => {}} onSelectMember={() => {}} />), '');
});

test('member controls announce their toggle state and retain keyboard focus styles', () => {
  const member: Member = { id: 'carmen', name: 'Carmen', koreanName: '카르멘', role: '', birthday: '', mbti: '', accentColor: '', avatarBg: '', charm: '', bio: '' };
  const html = renderToStaticMarkup(<MemberSelector members={[member]} selectedMembers={['Carmen']} onToggleMember={() => {}} onClearAll={() => {}} />);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /focus-visible/);
});

test('member controls render one including/only switch and explain the stored-tag rule', () => {
  const member: Member = { id: 'carmen', name: 'Carmen', koreanName: '카르멘', role: '', birthday: '', mbti: '', accentColor: '', avatarBg: '', charm: '', bio: '' };
  const jiwoo: Member = { ...member, id: 'jiwoo', name: 'Jiwoo', koreanName: '지우' };
  const htmlIncluding = renderToStaticMarkup(<MemberSelector members={[member, jiwoo]} selectedMembers={['Jiwoo', 'Ian']} matchMode="including" onToggleMember={() => {}} onClearAll={() => {}} onMatchModeChange={() => {}} />);
  assert.match(htmlIncluding, /包含全部/);
  assert.match(htmlIncluding, /剛好等於/);
  assert.match(htmlIncluding, /必須含有 Jiwoo、Ian 的每一個標籤/);
  assert.equal(htmlIncluding.match(/aria-label="成員篩選模式"/g)?.length, 1);

  const htmlOnly = renderToStaticMarkup(<MemberSelector members={[member]} selectedMembers={['Carmen']} matchMode="only" onToggleMember={() => {}} onClearAll={() => {}} onMatchModeChange={() => {}} />);
  assert.match(htmlOnly, /剛好等於：成員標籤必須正好是 Carmen/);
  assert.equal(htmlOnly.match(/>剛好等於</g)?.length, 1);
});

