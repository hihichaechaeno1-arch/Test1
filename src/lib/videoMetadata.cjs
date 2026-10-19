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

/** Vlog / diary / behind-the-scenes lifestyle cues for dual Shorts + 綜藝 placement. */
function isVlogVarietyContent(title = '', description = '') {
  const text = `${title}\n${description}`;
  return /vlog|브이로그|隨筆|日记|日記|後台|后台|待機|探险|探險|琴房|日常|團綜|예능|variety|\bep\.?\s*\d|\bepisode\b|reality|리얼리티|자컨|diary|다이어리/iu.test(text);
}

/**
 * Content classification without the Shorts-tab gate.
 * @returns {import('../types').VideoGenre}
 */
function classifyContentGenre(title = '', description = '', channel = '', type = '') {
  const supplementary = /commentary|코멘터리|teaser|티저|trailer|트레일러|behind|비하인드|bh2nd|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|錄音|unboxing|언박싱|lyric|가사|cover|커버|幕後|幕后|cypher/iu.test(title);
  if (supplementary) return 'other';
  if (type === 'mv' || /\bmv\b|m\/v|music video|뮤직비디오|official video|track video/iu.test(title)) return 'mv';

  const variety = /아는\s*형님|knowing\s*bros|런닝맨|running\s*man|아이돌\s*인간극장|돌박이일|워크돌|동네스타k|문명특급|살롱드립|집대성|할명수|리무진서비스|vlog|브이로그|\bep\.?\s*\d|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|團綜|예능|variety|隨筆|日记|日記|後台|后台|探險|探险|琴房/iu.test(title);
  if (variety || type === 'original') return 'original';
  if (type === 'stage' || /stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|음악중심|엠카운트다운|music bank|music core|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|가요대전|gayo daejeon|무대|relay dance|舞台|直拍|the first take|first take|生唱|solo stage/iu.test(title)) return 'stage';
  if (/knowingbros|아는형님|런닝맨|jtbcentertainment/iu.test(channel)) return 'original';
  if (/sbskpop|kbs kpop|mbckpop|mnet|studio choom|the k-pop|it's live|sbs entertainment/iu.test(channel)) return 'stage';
  if (type === 'other') return 'other';
  return 'other';
}

/**
 * Returns one or more tab memberships.
 * Shorts tab = official Hearts2Hearts channel Shorts/challenges only.
 * Official Shorts that are also vlog/variety also appear under 綜藝.
 * Non-official Shorts are never in the Shorts tab; they map to stage / original / other by content.
 * @param {string} [title] @param {string} [description] @param {string} [channel]
 * @param {string} [url] @param {string} [type] @param {string} [channelId]
 * @returns {import('../types').VideoGenre[]}
 */
function classifyVideoGenres(title = '', description = '', channel = '', url = '', type = '', channelId = '') {
  const official = isOfficialHearts2HeartsChannel(channel, channelId);
  const shortsFormat = hasShortsFormatEvidence(title, description, url, type);

  if (shortsFormat && official) {
    /** @type {import('../types').VideoGenre[]} */
    const genres = ['shorts'];
    if (isVlogVarietyContent(title, description)) genres.push('original');
    return genres;
  }

  if (shortsFormat && !official) {
    return [classifyContentGenre(title, description, channel, type === 'shorts' ? 'video' : type)];
  }

  return [classifyContentGenre(title, description, channel, type)];
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
