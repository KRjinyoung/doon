// 사이트 별칭과 명령 레지스트리.
//
// 크롬의 "검색 엔진 관리"는 설정 5단계 깊이에 숨어 있고, 등록해도 발견되지 않는다.
// 여기서는 `!` 하나로 전부 노출되고, 입력 중에 목록이 그대로 뜬다.

export const SITE_ALIASES = [
  { alias: 'gh', name: 'GitHub', template: 'https://github.com/search?q={q}', direct: 'https://github.com/{q}' },
  { alias: 'npm', name: 'npm', template: 'https://www.npmjs.com/search?q={q}', direct: 'https://www.npmjs.com/package/{q}' },
  { alias: 'mdn', name: 'MDN', template: 'https://developer.mozilla.org/ko/search?q={q}' },
  { alias: 'so', name: 'Stack Overflow', template: 'https://stackoverflow.com/search?q={q}' },
  { alias: 'wiki', name: '위키백과', template: 'https://ko.wikipedia.org/w/index.php?search={q}' },
  { alias: 'yt', name: 'YouTube', template: 'https://www.youtube.com/results?search_query={q}' },
  { alias: 'nv', name: '네이버', template: 'https://search.naver.com/search.naver?query={q}' },
  { alias: 'g', name: 'Google', template: 'https://www.google.com/search?q={q}' },
];

export const SCOPES = [
  { scope: 'tab', keys: ['tab', 'tabs', '탭'], label: '열린 탭' },
  { scope: 'history', keys: ['history', 'h', '기록', '방문'], label: '방문 기록' },
  { scope: 'bookmark', keys: ['bookmark', 'bm', 'b', '북마크'], label: '북마크' },
  { scope: 'page', keys: ['page', 'p', '페이지', '이페이지'], label: '현재 페이지 안' },
];

export const COMMANDS = [
  {
    id: 'dedupe-tabs',
    keys: ['탭 정리', '중복 탭', 'dedupe', 'tidy'],
    label: '중복 탭 정리',
    detail: '같은 페이지를 가리키는 탭을 하나로 합칩니다',
  },
  {
    id: 'split',
    keys: ['분할', '나란히', 'split'],
    label: '화면 분할',
    detail: '현재 탭과 다음으로 고른 탭을 나란히 엽니다',
  },
  {
    id: 'save-session',
    keys: ['세션 저장', '작업 저장', 'session'],
    label: '지금 작업을 세션으로 저장',
    detail: '열린 탭 묶음에 이름을 붙여 보관합니다',
  },
  {
    id: 'copy-clean',
    keys: ['주소 복사', '깨끗한 주소', 'copy'],
    label: '추적 파라미터 없는 주소 복사',
    detail: 'utm_*, fbclid 등을 제거한 주소를 클립보드에 넣습니다',
  },
  {
    id: 'mute-all',
    keys: ['소리 끄기', '음소거', 'mute'],
    label: '모든 탭 음소거',
    detail: '소리를 내는 탭을 전부 끕니다',
  },
];

export function findAlias(token, aliases = SITE_ALIASES) {
  if (!token) return null;
  const needle = token.toLowerCase();
  return aliases.find((entry) => entry.alias === needle) ?? null;
}

export function findScope(token) {
  if (!token) return null;
  const needle = token.toLowerCase();
  return SCOPES.find((entry) => entry.keys.includes(needle)) ?? null;
}

/** 템플릿에 검색어를 끼워 넣는다. {q} 는 인코딩된 검색어. */
export function expand(template, query) {
  return template.replace(/\{q\}/g, encodeURIComponent(query));
}
