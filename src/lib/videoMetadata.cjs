/** @license SPDX-License-Identifier: Apache-2.0 */

// Shared, dependency-free inference used by the browser adapter and Node importer.
/** @type {Record<import('../types').MemberName, string[]>} */
const MEMBER_ALIASES = {
  Carmen: ['carmen', '카르멘'], Jiwoo: ['jiwoo', '지우'], Yuha: ['yuha', '유하'],
  Stella: ['stella', '스텔라'], Juun: ['juun', '준'], 'A-na': ['a-na', 'a_na', 'ana', '아나', '에이나'],
  Ian: ['ian', '이안'], 'Ye-on': ['ye-on', 'ye_on', 'yeon', '예온'],
};

/** Official Hearts2Hearts YouTube channel ID (config/youtube-channels.json). */
const OFFICIAL_CHANNEL_ID = 'UC7Q3HUnJA3nvjZR2JeMn2Cw';

/** @param {unknown} value @returns {import('../types').MemberName | undefined} */
function canonicalMember(value) {
  if (typeof value !== 'string') return undefined;
  const key = value.trim().normalize('NFKC').toLowerCase();
  return /** @type {import('../types').MemberName[]} */ (Object.keys(MEMBER_ALIASES))
    .find(name => MEMBER_ALIASES[name].includes(key));
}

/** Text associations only; never proof of on-screen membership. @param {unknown} value */
function detectMembers(value) {
  if (typeof value !== 'string') return [];
  const content = value.normalize('NFKC');
  return /** @type {import('../types').MemberName[]} */ (Object.keys(MEMBER_ALIASES)).filter(name =>
    MEMBER_ALIASES[name].some(alias =>
      new RegExp(`(^|[^\\p{L}\\p{N}])${alias}(?=$|[^\\p{L}\\p{N}])`, 'iu').test(content)));
}

/** @param {unknown} value @returns {string} */
function getYoutubeId(value) {
  if (typeof value !== 'string') return '';
  const raw = value.trim();
  const valid = /^[A-Za-z0-9_-]{11}$/;
  if (valid.test(raw)) return raw;
  try {
    const url = new URL(raw);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port) return '';
    let id = '';
    if (url.hostname === 'youtu.be') id = url.pathname.replace(/^\//, '').replace(/\/$/, '');
    else if (['youtube.com', 'www.youtube.com', 'm.youtube.com', 'www.youtube-nocookie.com'].includes(url.hostname)) {
      id = url.pathname === '/watch' ? url.searchParams.get('v') || ''
        : /^\/(shorts|embed|live)\/([^/]+)\/?$/.exec(url.pathname)?.[2] || '';
    }
    return valid.test(id) ? id : '';
  } catch { return ''; }
}

/**
 * True only for the official Hearts2Hearts channel (name or channel ID).
 * Fan / unofficial channels that mention the group name are rejected.
 * @param {string} [channel]
 * @param {string} [channelId]
 */
function isOfficialHearts2HeartsChannel(channel = '', channelId = '') {
  const id = String(channelId || '').trim();
  if (id === OFFICIAL_CHANNEL_ID) return true;
  const name = String(channel || '').normalize('NFKC').trim();
  if (!name) return false;
  if (/unofficial|非官方|팬\s*채널|fan\s*(page|channel|acc|edit)|fanpage/iu.test(name)) return false;
  const compact = name.replace(/[\s._-]+/g, '');
  if (/^hearts2hearts$/iu.test(compact)) return true;
  if (/^하츠투하츠$/u.test(name.replace(/\s+/g, ''))) return true;
  if (/hearts\s*2\s*hearts/iu.test(name) && /官方|official/iu.test(name)) return true;
  if (/하츠투하츠/u.test(name) && /공식|official|官方/iu.test(name)) return true;
  return false;
}

/** Physical Shorts / challenge evidence (format), not the Shorts tab membership. */
function hasShortsFormatEvidence(title = '', description = '', url = '', type = '') {
  const shortsUrl = Boolean(getYoutubeId(url)) && /\/shorts\//.test(url);
  return type === 'shorts' || shortsUrl
    || /#?\bshorts\b|\bchallenge\b|챌린지|挑戰/iu.test(title)
    || /#shorts\b/iu.test(description);
}

/**
 * Teasers and trailers belong on 官方綜藝/物料 (`original`), including MV Teaser.
 * These words are not Shorts evidence and do not make the clip an MV.
 * @param {string} [title]
 */
function isPreviewContent(title = '') {
  return /teaser|티저|trailer|트레일러/iu.test(title);
}

/** Music-show lineup announcements stay other. They are not the interview. */
function isLineupTitle(title = '') {
  return /라인업|\bline-?up\b/iu.test(title);
}

/**
 * Comeback interviews, acceptance speeches, and Show Champion appearance posts.
 * 출챔 does not match the performance marker 쇼챔.
 * @param {string} [title]
 */
function isInterviewTitle(title = '') {
  return /interview|인터뷰|수상소감|출챔/iu.test(title);
}

/** Vlog / diary / behind-the-scenes lifestyle cues for dual Shorts + 官方綜藝/物料 placement. */
function isVlogVarietyContent(title = '', description = '') {
  const text = `${title}\n${description}`;
  return /vlog|브이로그|隨筆|日记|日記|後台|后台|待機|探险|探險|琴房|日常|團綜|예능|variety|\bep\.?\s*\d|\bepisode\b|reality|리얼리티|자컨|diary|다이어리/iu.test(text);
}

/**
 * Content classification without the Shorts-tab gate.
 * Strong performance cues run before episode/variety markers so a Show Champion
 * fancam titled "EP.602" is stage, not 官方綜藝/物料.
 * Teaser and trailer titles are original even when they also say MV.
 * Comeback interviews, 수상소감, and 출챔 posts are interview.
 * Lineup posts, behind-the-scenes, making, and reaction stay other.
 * @returns {import('../types').VideoGenre}
 */
function classifyContentGenre(title = '', description = '', channel = '', type = '') {
  if (isPreviewContent(title)) return 'original';
  if (isLineupTitle(title)) return 'other';
  if (isInterviewTitle(title)) return 'interview';

  // Behind-the-scenes and similar posts mention a music show but are not the performance.
  const hardOther = /behind|비하인드|bh2nd|making|메이킹|reaction|리액션|unboxing|언박싱|commentary|코멘터리|직캠보고서|幕後|幕后/iu.test(title);
  const fancam = /fancam|직캠|facecam|페이스캠|full\s*cam|풀캠/iu.test(title) && !/직캠보고서/iu.test(title);
  const broadcast = /music\s*core|음악중심|music\s*bank|뮤직뱅크|show\s*champion|쇼챔|inkigayo|인기가요|m\s*countdown|엠카운트다운|가요대전|gayo daejeon|on the spot|온더스팟|performing artist/iu.test(title);
  if ((fancam || broadcast) && !hardOther) return 'stage';
  if (hardOther || /lyric|가사|\bcover\b|커버|\bcypher\b|recording|녹음|錄音/iu.test(title)) return 'other';

  if (type === 'mv' || /\bmv\b|m\/v|music video|뮤직비디오|official video|track video/iu.test(title)) return 'mv';

  const variety = /아는\s*형님|knowing\s*bros|런닝맨|running\s*man|아이돌\s*인간극장|돌박이일|워크돌|동네스타k|문명특급|살롱드립|집대성|할명수|리무진서비스|vlog|브이로그|\bep\.?\s*\d|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|團綜|예능|variety|隨筆|日记|日記|後台|后台|探險|探险|琴房|crunchy hearts|둘셋하투하|체아빙/iu.test(title);
  if (variety || type === 'original') return 'original';
  if (type === 'stage' || /\bstage\b|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|무대|relay dance|舞台|直拍|the first take|first take|生唱|solo stage/iu.test(title)) return 'stage';
  if (/knowingbros|아는형님|런닝맨|jtbcentertainment/iu.test(channel)) return 'original';
  if (/sbskpop|kbs kpop|mbckpop|mnet|studio choom|the k-pop|it's live|sbs entertainment/iu.test(channel)) return 'stage';
  if (type === 'other') return 'other';
  return 'other';
}

/**
 * Returns one or more tab memberships.
 * Shorts tab = official Hearts2Hearts channel Shorts/challenges only.
 * Official Shorts that are also vlog/variety also appear under 官方綜藝/物料.
 * Non-official Shorts are never in the Shorts tab; they map to stage / original / other by content.
 * @param {string} [title] @param {string} [description] @param {string} [channel]
 * @param {string} [url] @param {string} [type] @param {string} [channelId]
 * @returns {import('../types').VideoGenre[]}
 */
function classifyVideoGenres(title = '', description = '', channel = '', url = '', type = '', channelId = '') {
  const official = isOfficialHearts2HeartsChannel(channel, channelId);
  const shortsFormat = hasShortsFormatEvidence(title, description, url, type);

  // Every official Hearts2Hearts Shorts/challenge is on the Shorts tab.
  // Hashtag-only captions, teasers, and interviews do not opt out.
  // A stored mv/stage/original value must not replace that membership.
  // Vlog, variety, teaser, or trailer cues may add 官方綜藝/物料 as a second tab.
  // An interview Short may also appear under 訪問, with Shorts first.
  if (official && shortsFormat) {
    /** @type {import('../types').VideoGenre[]} */
    const genres = ['shorts'];
    if (isVlogVarietyContent(title, description) || isPreviewContent(title)) genres.push('original');
    else if (isInterviewTitle(title) && !isLineupTitle(title)) genres.push('interview');
    return genres;
  }

  // teaser/티저/trailer/트레일러 → 官方綜藝/物料, including MV Teaser.
  // A stored mv value does not put these on the MV tab.
  if (isPreviewContent(title)) return ['original'];
  if (isLineupTitle(title)) return ['other'];
  if (isInterviewTitle(title)) return ['interview'];

  // Stored mv/stage/original wins over the title heuristic. `video` and `shorts`
  // are formats, and stored `other` is only the fallback when no clearer cue exists.
  if (type === 'mv' || type === 'stage' || type === 'original') return [type];

  const heuristicType = type === 'shorts' ? '' : type;
  return [classifyContentGenre(title, description, channel, heuristicType)];
}

/**
 * Primary genre (first membership). Prefer classifyVideoGenres when dual tabs matter.
 * @returns {import('../types').VideoGenre}
 */
function classifyVideoGenre(title = '', description = '', channel = '', url = '', type = '', channelId = '') {
  return classifyVideoGenres(title, description, channel, url, type, channelId)[0];
}

module.exports = {
  OFFICIAL_CHANNEL_ID,
  canonicalMember,
  detectMembers,
  getYoutubeId,
  isOfficialHearts2HeartsChannel,
  hasShortsFormatEvidence,
  classifyVideoGenre,
  classifyVideoGenres,
};
