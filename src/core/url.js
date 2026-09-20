// URL 판정과 해부(dissect).
//
// 크롬/엣지 주소창의 가장 큰 실패는 "이게 주소인지 검색어인지"를 확률로 때려맞히고,
// 그 결과를 사용자에게 보여주지 않은 채 Enter 시점에 확정한다는 점이다.
// 여기서는 규칙을 전부 명시적으로 적고, 판정 근거(reason)를 항상 함께 돌려준다.

const KNOWN_SCHEMES = ['http:', 'https:', 'file:', 'ftp:', 'about:', 'doon:', 'chrome:', 'data:'];

// 점 없는 단일 호스트지만 주소로 봐야 하는 예외들.
const BARE_HOSTS = new Set(['localhost']);

const IPV4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
const IPV6_BRACKETED = /^\[[0-9a-fA-F:]+\]$/;
const HOSTNAME = /^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?)*$/;

// 추적용 파라미터. 주소창이 문자열이 아니라 구조라면, 이런 건 꺼둘 수 있어야 한다.
const TRACKING_PARAMS = [
  /^utm_/i, /^fbclid$/i, /^gclid$/i, /^dclid$/i, /^msclkid$/i,
  /^igshid$/i, /^mc_(e|c)id$/i, /^ref_src$/i, /^spm$/i, /^yclid$/i,
  /^_ga$/i, /^si$/i,
];

/**
 * 입력이 주소인지 검색어인지 판정한다. 확률이 아니라 규칙이다.
 * @returns {{kind: 'url'|'query', reason: string, url?: string}}
 */
export function classify(input) {
  const text = String(input ?? '').trim();
  if (!text) return { kind: 'query', reason: '빈 입력' };

  // 공백이 있으면 주소가 아니다. 예외 없음.
  // (공백 포함 URL은 존재하지만, 사람이 주소창에 손으로 칠 일은 없다.)
  if (/\s/.test(text)) return { kind: 'query', reason: '공백 포함 → 검색어' };

  // 콜론 뒤가 숫자면 스킴이 아니라 포트다 (localhost:3000).
  const schemeMatch = text.match(/^([a-zA-Z][a-zA-Z0-9+.-]*:)(?!\d)/);
  if (schemeMatch) {
    const scheme = schemeMatch[1].toLowerCase();
    if (KNOWN_SCHEMES.includes(scheme)) {
      return { kind: 'url', reason: `스킴 ${scheme} 명시`, url: text };
    }
    // 알 수 없는 스킴은 검색어로 본다 (예: "TODO: 내일 할 일").
    return { kind: 'query', reason: `알 수 없는 스킴 ${scheme} → 검색어` };
  }

  const [authority] = text.split(/[/?#]/, 1);
  const hostPart = authority.replace(/^[^@]*@/, '');
  const portMatch = hostPart.match(/:(\d+)$/);
  const host = portMatch ? hostPart.slice(0, -portMatch[0].length) : hostPart;

  if (BARE_HOSTS.has(host.toLowerCase())) {
    return { kind: 'url', reason: 'localhost', url: `http://${text}` };
  }
  if (IPV4.test(host) && host.split('.').every((o) => Number(o) <= 255)) {
    return { kind: 'url', reason: 'IPv4 주소', url: `http://${text}` };
  }
  if (IPV6_BRACKETED.test(host)) {
    return { kind: 'url', reason: 'IPv6 주소', url: `http://${text}` };
  }
  if (portMatch && HOSTNAME.test(host)) {
    return { kind: 'url', reason: `포트 :${portMatch[1]} 명시`, url: `http://${text}` };
  }

  if (host.includes('.') && HOSTNAME.test(host)) {
    const tld = host.slice(host.lastIndexOf('.') + 1);
    // 마지막 라벨이 두 글자 이상의 알파벳이어야 도메인으로 본다.
    // "버전 1.2" 같은 입력이 사이트로 둔갑하는 사고를 막는다.
    if (/^[a-zA-Z]{2,}$/.test(tld)) {
      return { kind: 'url', reason: `도메인 형태(.${tld})`, url: `https://${text}` };
    }
    return { kind: 'query', reason: `.${tld} 는 TLD 형태가 아님 → 검색어` };
  }

  return { kind: 'query', reason: '점 없는 단어 → 검색어' };
}

/** classify()가 url이라고 판정했을 때 최종 정규화된 주소. 아니면 null. */
export function toUrl(input) {
  const result = classify(input);
  return result.kind === 'url' ? result.url : null;
}

/**
 * 주소를 조작 가능한 조각으로 해부한다.
 * 주소창이 "읽기 전용 문자열"이 아니라 "편집 가능한 구조"가 되는 지점.
 */
export function dissect(rawUrl) {
  let parsed;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  const params = [...parsed.searchParams.entries()].map(([key, value]) => ({
    key,
    value,
    tracking: TRACKING_PARAMS.some((pattern) => pattern.test(key)),
    // 추적 파라미터는 기본적으로 꺼진 상태로 제시한다.
    enabled: !TRACKING_PARAMS.some((pattern) => pattern.test(key)),
  }));

  return {
    scheme: parsed.protocol.replace(':', ''),
    host: parsed.hostname,
    port: parsed.port || null,
    segments: parsed.pathname.split('/').filter(Boolean),
    // 뒤 슬래시는 의미가 있는 사이트가 있다. 복사·재조립에서 사라지면 안 된다.
    trailingSlash: parsed.pathname.length > 1 && parsed.pathname.endsWith('/'),
    params,
    hash: parsed.hash ? parsed.hash.slice(1) : null,
    secure: parsed.protocol === 'https:',
  };
}

/** dissect()의 결과를 다시 주소로 조립한다. enabled=false 인 파라미터는 빠진다. */
export function rebuild(parts) {
  const port = parts.port ? `:${parts.port}` : '';
  const path = parts.segments.length
    ? `/${parts.segments.join('/')}${parts.trailingSlash ? '/' : ''}`
    : '/';
  const url = new URL(`${parts.scheme}://${parts.host}${port}${path}`);
  for (const param of parts.params) {
    if (param.enabled) url.searchParams.append(param.key, param.value);
  }
  if (parts.hash) url.hash = parts.hash;
  return url.toString();
}

/** 추적 파라미터를 제거한 "깨끗한 주소". 복사 버튼이 실제로 주는 값. */
export function cleanUrl(rawUrl) {
  const parts = dissect(rawUrl);
  if (!parts) return rawUrl;
  return rebuild(parts);
}

/** 탭 중복 판정용 키. 해시와 추적 파라미터 차이는 같은 페이지로 본다. */
export function identityKey(rawUrl) {
  const parts = dissect(rawUrl);
  if (!parts) return String(rawUrl);
  const host = parts.host.replace(/^www\./, '');
  const path = parts.segments.join('/');
  const query = parts.params
    .filter((param) => param.enabled)
    .map((param) => `${param.key}=${param.value}`)
    .sort()
    .join('&');
  return `${host}/${path}${query ? `?${query}` : ''}`;
}
