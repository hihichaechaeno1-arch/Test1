/** @license SPDX-License-Identifier: Apache-2.0 */

// Shared, dependency-free inference used by the browser adapter and Node importer.
/** @type {Record<import('../types').MemberName, string[]>} */
const MEMBER_ALIASES = {
  Carmen: ['carmen', '카르멘'], Jiwoo: ['jiwoo', '지우'], Yuha: ['yuha', '유하'],
  Stella: ['stella', '스텔라'], Juun: ['juun', '준'], 'A-na': ['a-na', 'a_na', 'ana', '아나', '에이나'],
  Ian: ['ian', '이안'], 'Ye-on': ['ye-on', 'ye_on', 'yeon', '예온'],
};

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
 * Content heuristics, not verification of source identity or physical aspect ratio.
 * Explicit Shorts evidence wins; channel/group names alone never imply Shorts.
 * @param {string} [title] @param {string} [description] @param {string} [channel]
 * @param {string} [url] @param {string} [type]
 * @returns {import('../types').VideoGenre}
 */
function classifyVideoGenre(title = '', description = '', channel = '', url = '', type = '') {
  const shortsUrl = Boolean(getYoutubeId(url)) && /\/shorts\//.test(url);
  if (type === 'shorts' || shortsUrl || /#?\bshorts\b|\bchallenge\b|챌린지|挑戰/iu.test(title) || /#shorts\b/iu.test(description)) return 'shorts';

  const supplementary = /commentary|코멘터리|teaser|티저|trailer|트레일러|behind|비하인드|bh2nd|making|메이킹|reaction|리액션|interview|인터뷰|recording|녹음|unboxing|언박싱|lyric|가사|cover|커버/iu.test(title);
  if (supplementary) return 'other';
  if (type === 'mv' || /\bmv\b|m\/v|music video|뮤직비디오|official video|track video/iu.test(title)) return 'mv';

  const variety = /아는\s*형님|knowing\s*bros|런닝맨|running\s*man|아이돌\s*인간극장|돌박이일|워크돌|동네스타k|문명특급|살롱드립|집대성|할명수|리무진서비스|vlog|브이로그|\bep\.?\s*\d|\bepisode\b|reality|리얼리티|자컨|diary|다이어리|團綜|예능|variety/iu.test(title);
  if (variety || type === 'original') return 'original';
  if (type === 'stage' || /stage|fancam|직캠|facecam|페이스캠|인기가요|뮤직뱅크|음악중심|엠카운트다운|music bank|music core|m countdown|inkigayo|dance practice|안무|choreography|performance|퍼포먼스|showcase|쇼케이스|concert|콘서트|live clip|교차편집|원테이크|one take|fullcam|가요대전|gayo daejeon|무대|relay dance|舞台|直拍/iu.test(title)) return 'stage';
  // Display names are only a weak content hint, never a source authorization check.
  if (/knowingbros|아는형님|런닝맨|jtbcentertainment/iu.test(channel)) return 'original';
  if (/sbskpop|kbs kpop|mbckpop|mnet|studio choom|the k-pop|it's live|sbs entertainment/iu.test(channel)) return 'stage';
  return 'other';
}

module.exports = { canonicalMember, detectMembers, getYoutubeId, classifyVideoGenre };
