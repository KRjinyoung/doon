// 의도(intent) + 내 브라우저 상태 → 후보 목록.
//
// 엣지/크롬 옴니박스의 순위는 블랙박스다. 광고와 기본 검색엔진이 섞여 들어오고,
// 왜 이 항목이 1등인지 설명하지 않는다. 여기서는 모든 후보가 `why`(근거 배지)를 들고 다니고,
// 점수 계산은 전부 이 파일 안에 있다. 로컬(탭·기록·북마크)이 언제나 웹 검색보다 먼저다.

import { identityKey, cleanUrl } from './url.js';
import { expand, COMMANDS, SITE_ALIASES } from './registry.js';

const WEIGHT = {
  openTab: 1000,      // 이미 열려 있는 것 > 새로 여는 것. 이 규칙은 협상 대상이 아니다.
  navigate: 900,
  bookmark: 500,
  history: 400,
  siteSearch: 300,
  command: 250,
  webSearch: 10,      // 웹 검색은 언제나 마지막 줄. 기본값이 아니라 선택지다.
};

const HOUR = 1000 * 60 * 60;

/**
 * @param {import('./parse.js').Intent} intent
 * @param {{tabs?: Array, history?: Array, bookmarks?: Array, now?: number, engine?: object}} context
 */
export function suggest(intent, context = {}) {
  const tabs = context.tabs ?? [];
  const history = context.history ?? [];
  const bookmarks = context.bookmarks ?? [];
  const now = context.now ?? Date.now();
  const engine = context.engine ?? { name: 'Google', template: 'https://www.google.com/search?q={q}' };

  const out = [];

  if (intent.type === 'command') {
    const needle = intent.query.toLowerCase();
    for (const command of COMMANDS) {
      const hit = !needle || command.keys.some((key) => key.toLowerCase().includes(needle)) ||
        command.label.includes(intent.query);
      if (!hit) continue;
      out.push({
        kind: 'command',
        title: command.label,
        subtitle: command.detail,
        action: { type: 'command', id: command.id },
        score: WEIGHT.command + (command.keys.some((key) => key.toLowerCase() === needle) ? 50 : 0),
        why: ['명령'],
      });
    }
    return finalize(out);
  }

  if (intent.type === 'find-in-page') {
    out.push({
      kind: 'find',
      title: intent.query ? `이 페이지에서 "${intent.query}" 찾기` : '이 페이지에서 찾기',
      subtitle: '페이지를 떠나지 않습니다',
      action: { type: 'find-in-page', query: intent.query },
      score: WEIGHT.navigate,
      why: ['페이지 내'],
    });
    return finalize(out);
  }

  if (intent.type === 'site-search') {
    if (intent.site && intent.query) {
      out.push({
        kind: 'site-search',
        title: `${intent.site.name}에서 "${intent.query}"`,
        subtitle: expand(intent.site.template, intent.query),
        action: { type: 'navigate', url: expand(intent.site.template, intent.query) },
        score: WEIGHT.navigate + 100,
        why: [`!${intent.site.alias}`],
      });
      if (intent.site.direct && /^[\w.@/-]+$/.test(intent.query)) {
        out.push({
          kind: 'navigate',
          title: `${intent.site.name} · ${intent.query} 바로 열기`,
          subtitle: expand(intent.site.direct, intent.query).replace(/%2F/g, '/'),
          action: { type: 'navigate', url: expand(intent.site.direct, intent.query).replace(/%2F/g, '/') },
          score: WEIGHT.siteSearch,
          why: ['바로가기'],
        });
      }
    } else {
      for (const site of SITE_ALIASES) {
        out.push({
          kind: 'site-search',
          title: `!${site.alias}`,
          subtitle: `${site.name} 안에서 검색`,
          action: { type: 'prefill', text: `!${site.alias} ` },
          score: WEIGHT.siteSearch,
          why: ['사이트 별칭'],
        });
      }
    }
    return finalize(out);
  }

  const scopes = intent.type === 'filter' ? [intent.scope] : ['tab', 'bookmark', 'history'];
  const query = intent.query ?? '';

  // 이동 의도: 그 주소가 이미 열려 있으면 "새 탭"이 아니라 "그 탭으로".
  if (intent.type === 'navigate' && intent.url) {
    const key = identityKey(intent.url);
    const already = tabs.find((tab) => identityKey(tab.url) === key);
    if (already) {
      out.push({
        kind: 'tab',
        title: already.title,
        subtitle: cleanUrl(already.url),
        action: { type: 'switch-tab', tabId: already.id },
        score: WEIGHT.openTab + 200,
        why: ['이미 열려 있음', '새 탭 대신 전환'],
      });
    }
    out.push({
      kind: 'navigate',
      title: intent.url,
      subtitle: already ? '그래도 새 탭에서 열기 (Shift+Enter)' : '주소로 이동',
      action: { type: 'navigate', url: intent.url },
      score: already ? WEIGHT.navigate - 300 : WEIGHT.navigate,
      why: [intent.reason],
    });
  }

  if (scopes.includes('tab')) {
    // 같은 페이지를 가리키는 탭은 한 줄로 접는다. 목록에서 중복을 다시 보여주는 건
    // 탭이 37개가 된 원인을 그대로 반복하는 짓이다.
    const alreadyShown = out.some((item) => item.action.type === 'switch-tab')
      ? new Set(out.filter((item) => item.action.type === 'switch-tab')
          .map((item) => identityKey(tabs.find((tab) => tab.id === item.action.tabId)?.url ?? '')))
      : new Set();

    const groups = new Map();
    for (const tab of tabs) {
      const key = identityKey(tab.url);
      if (alreadyShown.has(key)) continue;
      const match = score(query, tab.title, tab.url);
      if (query && !match.hit) continue;
      const group = groups.get(key);
      if (!group) groups.set(key, { tabs: [tab], match });
      else group.tabs.push(tab);
    }

    for (const { tabs: members, match } of groups.values()) {
      const primary = members.reduce((a, b) => ((b.lastActive ?? 0) > (a.lastActive ?? 0) ? b : a));
      out.push({
        kind: 'tab',
        title: primary.title,
        subtitle: cleanUrl(primary.url),
        action: { type: 'switch-tab', tabId: primary.id },
        score: WEIGHT.openTab + match.points + recencyBoost(primary.lastActive, now),
        why: compact([
          '열린 탭',
          members.length > 1 ? `중복 탭 ${members.length}개` : null,
          members.some((tab) => tab.audible) ? '소리 나는 중' : null,
          match.label,
        ]),
      });
    }
  }

  if (scopes.includes('bookmark')) {
    for (const bookmark of bookmarks) {
      const match = score(query, bookmark.title, bookmark.url);
      if (query && !match.hit) continue;
      out.push({
        kind: 'bookmark',
        title: bookmark.title,
        subtitle: cleanUrl(bookmark.url),
        action: { type: 'navigate', url: bookmark.url },
        score: WEIGHT.bookmark + match.points,
        why: compact([bookmark.folder ? `북마크 · ${bookmark.folder}` : '북마크', match.label]),
      });
    }
  }

  if (scopes.includes('history')) {
    for (const entry of history) {
      const match = score(query, entry.title, entry.url);
      if (query && !match.hit) continue;
      const age = Math.max(0, (now - entry.lastVisit) / HOUR);
      out.push({
        kind: 'history',
        title: entry.title,
        subtitle: cleanUrl(entry.url),
        action: { type: 'navigate', url: entry.url },
        score: WEIGHT.history + match.points + recencyBoost(entry.lastVisit, now) + Math.min(60, entry.visits * 6),
        why: compact([describeAge(age), entry.visits > 1 ? `${entry.visits}번 방문` : null, match.label]),
      });
    }
  }

  // 웹 검색은 항상 존재하되, 항상 마지막이다.
  if (query && intent.type !== 'filter') {
    out.push({
      kind: 'search',
      title: `웹에서 "${query}" 검색`,
      subtitle: engine.name,
      action: { type: 'navigate', url: expand(engine.template, query) },
      score: WEIGHT.webSearch,
      why: ['웹 검색'],
    });
  }

  return finalize(out);
}

/** 제목/주소에 대한 매치 점수. 접두 일치 > 단어 시작 일치 > 부분 일치. */
function score(query, title = '', url = '') {
  if (!query) return { hit: true, points: 0, label: null };
  const needle = query.toLowerCase().trim();
  const haystackTitle = title.toLowerCase();
  const haystackUrl = url.toLowerCase();

  // 여러 단어는 모두 들어 있어야 한다 (AND). 한 글자라도 빠지면 후보가 아니다.
  const words = needle.split(/\s+/).filter(Boolean);
  const combined = `${haystackTitle} ${haystackUrl}`;
  if (!words.every((word) => combined.includes(word))) {
    return { hit: false, points: 0, label: null };
  }

  if (haystackTitle.startsWith(needle)) return { hit: true, points: 120, label: '제목 앞부분 일치' };
  if (haystackUrl.replace(/^https?:\/\/(www\.)?/, '').startsWith(needle)) {
    return { hit: true, points: 110, label: '주소 앞부분 일치' };
  }
  if (new RegExp(`(^|[\\s/._-])${escapeRegExp(needle)}`).test(combined)) {
    return { hit: true, points: 70, label: '단어 일치' };
  }
  return { hit: true, points: 30, label: '부분 일치' };
}

function recencyBoost(timestamp, now) {
  if (!timestamp) return 0;
  const hours = Math.max(0, (now - timestamp) / HOUR);
  return Math.round(80 * Math.exp(-hours / 24));
}

function describeAge(hours) {
  if (hours < 1) return '방금';
  if (hours < 24) return `${Math.round(hours)}시간 전`;
  if (hours < 24 * 7) return `${Math.round(hours / 24)}일 전`;
  return `${Math.round(hours / 24 / 7)}주 전`;
}

function compact(list) {
  return list.filter(Boolean);
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function finalize(candidates) {
  return candidates
    .map((candidate, index) => ({ ...candidate, id: `${candidate.kind}-${index}` }))
    .sort((a, b) => b.score - a.score);
}
