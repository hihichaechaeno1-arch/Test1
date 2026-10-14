import assert from 'node:assert/strict';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { VideoCard } from '../src/components/VideoCard';
import { MemberSelector } from '../src/components/MemberSelector';
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

test('live card keeps its playback link and lazy-loads images', () => {
  const html = renderToStaticMarkup(<VideoCard video={video} selectedMembers={['Carmen']} />);
  assert.match(html, /href="https:\/\/www.youtube.com\/watch\?v=abcdefghijk"/);
  assert.match(html, /loading="lazy"/);
  assert.match(html, /未核實/);
});

test('member controls announce their toggle state and retain keyboard focus styles', () => {
  const member: Member = { id: 'carmen', name: 'Carmen', koreanName: '카르멘', role: '', birthday: '', mbti: '', accentColor: '', avatarBg: '', charm: '', bio: '' };
  const html = renderToStaticMarkup(<MemberSelector members={[member]} selectedMembers={['Carmen']} onToggleMember={() => {}} onClearAll={() => {}} />);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /focus-visible/);
});

test('member controls render "including" and "only" mode buttons with aria-pressed', () => {
  const member: Member = { id: 'carmen', name: 'Carmen', koreanName: '카르멘', role: '', birthday: '', mbti: '', accentColor: '', avatarBg: '', charm: '', bio: '' };
  const htmlIncluding = renderToStaticMarkup(<MemberSelector members={[member]} selectedMembers={['Carmen']} matchMode="including" onToggleMember={() => {}} onClearAll={() => {}} onMatchModeChange={() => {}} />);
  assert.match(htmlIncluding, /包含 \(Including\)/);
  assert.match(htmlIncluding, /僅限 \(Only\)/);

  const htmlOnly = renderToStaticMarkup(<MemberSelector members={[member]} selectedMembers={['Carmen']} matchMode="only" onToggleMember={() => {}} onClearAll={() => {}} onMatchModeChange={() => {}} />);
  assert.match(htmlOnly, /「僅限 \(Only\)」模式/);
});

