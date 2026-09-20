// 입력 문자열 → 의도(intent).
//
// 원칙 하나: Enter는 화면에 적힌 해석만 실행한다.
// 그래서 parse()는 항상 `explain`(사람이 읽는 한 줄)을 같이 돌려주고,
// UI는 그 문장을 명령 바 위에 그대로 띄운다. 추측이 숨는 곳이 없다.

import { classify } from './url.js';
import { findAlias, findScope, expand, COMMANDS, SITE_ALIASES } from './registry.js';
import { withJosa } from './josa.js';

/**
 * @typedef {Object} Intent
 * @property {'navigate'|'search'|'site-search'|'filter'|'command'|'find-in-page'|'empty'} type
 * @property {string} query      남은 검색어
 * @property {string} explain    사용자에게 보이는 해석 한 줄
 * @property {string} reason     그렇게 판정한 근거
 * @property {'all'|'tab'|'history'|'bookmark'|'page'} scope
 * @property {string|null} url   navigate 일 때 최종 주소
 * @property {object|null} site  site-search 일 때 별칭 정보
 * @property {object|null} command
 */

/** @returns {Intent} */
export function parse(input, options = {}) {
  const aliases = options.aliases ?? SITE_ALIASES;
  const raw = String(input ?? '');
  const text = raw.trim();

  if (!text) {
    return intent({
      type: 'empty',
      explain: '무엇을 할까요? 주소, 검색어, 또는 ! @ > 로 시작하세요',
      reason: '빈 입력',
    });
  }

  // 1) 명령 모드: ">"
  if (text.startsWith('>')) {
    const body = text.slice(1).trim();
    const command = matchCommand(body);
    return intent({
      type: 'command',
      query: body,
      command,
      explain: command ? `명령 실행: ${command.label}` : '명령 찾는 중…',
      reason: '> 로 시작 → 명령 모드',
    });
  }

  // 2) 범위 한정: "@탭 도커"
  if (text.startsWith('@')) {
    const [token, ...rest] = text.slice(1).split(/\s+/);
    const scope = findScope(token);
    const query = rest.join(' ');
    if (!scope) {
      return intent({
        type: 'filter',
        scope: 'all',
        query: text.slice(1),
        explain: '범위를 고르세요: @탭 @기록 @북마크 @페이지',
        reason: `@${token} 는 모르는 범위`,
      });
    }
    if (scope.scope === 'page') {
      return intent({
        type: 'find-in-page',
        scope: 'page',
        query,
        explain: query ? `현재 페이지에서 "${query}" 찾기` : '현재 페이지에서 찾기',
        reason: '@페이지 → 페이지 내 검색',
      });
    }
    return intent({
      type: 'filter',
      scope: scope.scope,
      query,
      explain: query ? `${scope.label}에서만 "${query}" 찾기` : `${scope.label} 전체 보기`,
      reason: `@${token} → ${withJosa(scope.label, '으로')} 범위 한정`,
    });
  }

  // 3) 명시적 웹 검색: "?"
  if (text.startsWith('?')) {
    const query = text.slice(1).trim();
    return intent({
      type: 'search',
      query,
      explain: query ? `웹에서 "${query}" 검색` : '웹 검색',
      reason: '? 로 시작 → 주소 해석 없이 검색',
    });
  }

  // 4) 사이트 한정 검색: "!gh doon"
  if (text.startsWith('!')) {
    const [token, ...rest] = text.slice(1).split(/\s+/);
    const site = findAlias(token, aliases);
    const query = rest.join(' ');
    if (!site) {
      return intent({
        type: 'site-search',
        query: text.slice(1),
        explain: '사이트를 고르세요',
        reason: `!${token} 는 등록되지 않은 별칭`,
      });
    }
    return intent({
      type: 'site-search',
      query,
      site,
      url: query ? expand(site.template, query) : null,
      explain: query ? `${site.name} 안에서 "${query}" 검색` : `${site.name} 안에서 검색`,
      reason: `!${site.alias} → ${site.name} 한정`,
    });
  }

  // 5) 그 외: 주소인지 검색어인지 규칙으로 판정한다.
  const verdict = classify(text);
  if (verdict.kind === 'url') {
    return intent({
      type: 'navigate',
      query: text,
      url: verdict.url,
      explain: `${withJosa(hostOf(verdict.url), '으로')} 이동`,
      reason: verdict.reason,
    });
  }

  return intent({
    type: 'search',
    query: text,
    explain: `"${text}" — 내 탭·기록·북마크 먼저, 그다음 웹`,
    reason: verdict.reason,
  });
}

function matchCommand(body) {
  if (!body) return null;
  const needle = body.toLowerCase();
  return (
    COMMANDS.find((command) => command.keys.some((key) => key.toLowerCase() === needle)) ??
    COMMANDS.find((command) => command.keys.some((key) => key.toLowerCase().startsWith(needle))) ??
    COMMANDS.find((command) => command.label.includes(body)) ??
    null
  );
}

function hostOf(url) {
  try {
    return new URL(url).host || url;
  } catch {
    return url;
  }
}

function intent(partial) {
  return {
    type: 'search',
    query: '',
    scope: 'all',
    url: null,
    site: null,
    command: null,
    explain: '',
    reason: '',
    ...partial,
  };
}
