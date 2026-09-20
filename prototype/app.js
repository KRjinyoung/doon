// 프로토타입 셸. 로직은 전부 src/core 에 있고, 여기는 화면과 키보드만 담당한다.

import { parse, suggest, dissect, rebuild, cleanUrl, identityKey } from '../src/core/index.js';
import { createState } from '../src/data/mock.js';

const state = createState();
let addressParts = null;   // 현재 탭 주소의 해부 결과 (파라미터 on/off 상태를 들고 있다)
let candidates = [];
let cursor = 0;

const el = {
  tabstrip: document.getElementById('tabstrip'),
  chips: document.getElementById('chips'),
  overlay: document.getElementById('overlay'),
  input: document.getElementById('command-input'),
  explain: document.getElementById('explain'),
  reason: document.getElementById('reason'),
  results: document.getElementById('results'),
  toast: document.getElementById('toast'),
  pageTitle: document.getElementById('page-title'),
  pageUrl: document.getElementById('page-url'),
  pageNote: document.getElementById('page-note'),
  hints: document.getElementById('hints'),
};

const KIND_ICON = {
  tab: '⧉', history: '↺', bookmark: '★', navigate: '→',
  search: '⌕', 'site-search': '!', command: '>', find: '¶',
};

const HINTS = [
  ['docs.docker.com/compose/compose-file/', '이미 열려 있는 주소 — 새 탭이 아니라 그 탭으로 전환됩니다'],
  ['결제', '내 탭·기록에서 먼저 찾습니다. 웹 검색은 맨 아래'],
  ['@탭 docker', '범위를 탭으로 한정. 37개 탭 중에서 고르기'],
  ['!gh doon', 'GitHub 안에서만 검색. 설정 메뉴를 뒤질 필요 없이 ! 하나로'],
  ['버전 1.2', '점이 있어도 검색어로 봅니다. 왜 그런지도 같이 표시됩니다'],
  ['>탭 정리', '명령 모드. 중복 탭을 실제로 합쳐 봅니다'],
];

/* ---------- 렌더 ---------- */

function currentTab() {
  return state.tabs.find((tab) => tab.id === state.currentTabId) ?? state.tabs[0];
}

function renderTabs() {
  el.tabstrip.replaceChildren(...state.tabs.map((tab) => {
    const node = document.createElement('button');
    node.className = `tab${tab.id === state.currentTabId ? ' active' : ''}`;
    node.innerHTML = `<i class="favicon"></i><span class="label"></span>${tab.audible ? '<span class="audible">♪</span>' : ''}`;
    node.querySelector('.label').textContent = tab.title;
    node.title = tab.url;
    node.addEventListener('click', () => selectTab(tab.id));
    return node;
  }));
}

function renderAddress() {
  const tab = currentTab();
  addressParts = dissect(tab.url) ?? addressParts;
  el.chips.replaceChildren();

  if (!addressParts) {
    el.chips.textContent = tab.url;
    return;
  }

  const add = (className, text, onClick, title) => {
    const chip = document.createElement('span');
    chip.className = `chip ${className}`;
    chip.textContent = text;
    if (title) chip.title = title;
    if (onClick) chip.addEventListener('click', onClick);
    el.chips.append(chip);
  };

  add('scheme', addressParts.secure ? '🔒 https' : addressParts.scheme);
  add('host', addressParts.host + (addressParts.port ? `:${addressParts.port}` : ''));
  for (const segment of addressParts.segments) {
    add('sep', '/');
    add('segment', decodeURIComponent(segment));
  }
  addressParts.params.forEach((param, index) => {
    add('sep', index === 0 ? '?' : '&');
    add(
      `param${param.enabled ? '' : ' off'}${param.tracking ? ' tracking' : ''}`,
      `${param.key}=${truncate(param.value, 18)}`,
      () => {
        addressParts.params[index].enabled = !addressParts.params[index].enabled;
        renderAddress();
        toast(addressParts.params[index].enabled ? `${param.key} 켬` : `${param.key} 끔 — 주소가 다시 조립됐습니다`);
      },
      param.tracking ? '추적 파라미터 — 기본으로 꺼져 있습니다. 눌러서 켜고 끌 수 있습니다' : '눌러서 끄기',
    );
  });

  renderPage();
}

function renderPage() {
  const tab = currentTab();
  el.pageTitle.textContent = tab.title;
  el.pageUrl.textContent = addressParts ? rebuild(addressParts) : tab.url;
  const trackingCount = addressParts ? addressParts.params.filter((param) => param.tracking).length : 0;
  el.pageNote.textContent = trackingCount
    ? `이 주소에는 추적 파라미터가 ${trackingCount}개 있습니다. 주소창에서 이미 꺼진 채로 보여주고, 복사하면 꺼진 상태로 복사됩니다.`
    : '주소는 문자열이 아니라 조각입니다. 파라미터 칩을 눌러 켜고 끌 수 있습니다.';
}

function renderHints() {
  el.hints.replaceChildren(...HINTS.map(([example, note]) => {
    const node = document.createElement('button');
    node.className = 'hint';
    node.innerHTML = '<code></code><span></span>';
    node.querySelector('code').textContent = example;
    node.querySelector('span').textContent = note;
    node.addEventListener('click', () => openBar(example));
    return node;
  }));
}

function renderResults() {
  el.results.replaceChildren();
  if (!candidates.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.textContent = '일치하는 것이 없습니다.';
    el.results.append(empty);
    return;
  }

  candidates.forEach((candidate, index) => {
    const row = document.createElement('div');
    row.className = 'result';
    row.setAttribute('role', 'option');
    row.setAttribute('aria-selected', String(index === cursor));
    row.innerHTML = `
      <span class="kind"></span>
      <span class="body"><span class="title"></span><span class="subtitle"></span></span>
      <span class="why"></span>`;
    row.querySelector('.kind').textContent = KIND_ICON[candidate.kind] ?? '·';
    row.querySelector('.title').textContent = candidate.title;
    row.querySelector('.subtitle').textContent = candidate.subtitle ?? '';
    const why = row.querySelector('.why');
    for (const label of candidate.why) {
      const badge = document.createElement('span');
      badge.className = `badge${label === '이미 열려 있음' ? ' primary' : ''}${candidate.kind === 'search' ? ' web' : ''}`;
      badge.textContent = label;
      why.append(badge);
    }
    row.addEventListener('click', () => execute(candidate, false));
    row.addEventListener('mousemove', () => {
      if (cursor === index) return;
      cursor = index;
      renderResults();
    });
    el.results.append(row);
  });

  el.results.children[cursor]?.scrollIntoView({ block: 'nearest' });
}

/* ---------- 동작 ---------- */

function refresh() {
  const intent = parse(el.input.value);
  el.explain.textContent = intent.explain;
  el.reason.textContent = intent.reason;
  candidates = suggest(intent, state);
  cursor = 0;
  renderResults();
}

function openBar(prefill = '') {
  el.overlay.hidden = false;
  el.input.value = prefill;
  el.input.focus();
  el.input.select();
  refresh();
}

function closeBar() {
  el.overlay.hidden = true;
  el.input.value = '';
}

function selectTab(tabId) {
  state.currentTabId = tabId;
  const tab = state.tabs.find((item) => item.id === tabId);
  if (tab) tab.lastActive = Date.now();
  renderTabs();
  renderAddress();
}

function execute(candidate, forceNewTab) {
  if (!candidate) return;
  const action = candidate.action;

  if (action.type === 'prefill') {
    el.input.value = action.text;
    el.input.focus();
    refresh();
    return;
  }

  if (action.type === 'switch-tab' && !forceNewTab) {
    selectTab(action.tabId);
    closeBar();
    toast('이미 열려 있던 탭으로 전환했습니다 — 중복 탭을 만들지 않았습니다');
    return;
  }

  if (action.type === 'navigate' || (action.type === 'switch-tab' && forceNewTab)) {
    const url = action.url ?? state.tabs.find((tab) => tab.id === action.tabId)?.url;
    openUrl(url, forceNewTab);
    closeBar();
    return;
  }

  if (action.type === 'find-in-page') {
    closeBar();
    toast(`페이지 안에서 "${action.query}" 를 찾습니다 — 페이지를 떠나지 않습니다`);
    return;
  }

  if (action.type === 'command') {
    runCommand(action.id);
    closeBar();
  }
}

function openUrl(url, forceNewTab) {
  if (!url) return;
  const existing = state.tabs.find((tab) => identityKey(tab.url) === identityKey(url));
  if (existing && !forceNewTab) {
    selectTab(existing.id);
    return;
  }
  const tab = {
    id: `t${Date.now()}`,
    title: titleFor(url),
    url,
    lastActive: Date.now(),
  };
  state.tabs.push(tab);
  selectTab(tab.id);
  toast(forceNewTab ? '새 탭에서 열었습니다 (Shift+Enter)' : '새 탭에서 열었습니다');
}

function runCommand(id) {
  if (id === 'dedupe-tabs') {
    const seen = new Map();
    const removed = [];
    for (const tab of state.tabs) {
      const key = identityKey(tab.url);
      if (seen.has(key)) removed.push(tab);
      else seen.set(key, tab);
    }
    state.tabs = state.tabs.filter((tab) => !removed.includes(tab));
    if (!state.tabs.some((tab) => tab.id === state.currentTabId)) {
      state.currentTabId = state.tabs[0]?.id;
    }
    renderTabs();
    renderAddress();
    toast(removed.length ? `중복 탭 ${removed.length}개를 합쳤습니다` : '중복 탭이 없습니다');
    return;
  }
  if (id === 'copy-clean') {
    copyCleanUrl();
    return;
  }
  if (id === 'mute-all') {
    const muted = state.tabs.filter((tab) => tab.audible).length;
    state.tabs.forEach((tab) => { tab.audible = false; });
    renderTabs();
    toast(muted ? `탭 ${muted}개를 음소거했습니다` : '소리 나는 탭이 없습니다');
    return;
  }
  if (id === 'split') {
    toast('화면 분할 — 셸 단계에서 붙일 기능입니다 (docs/03-로드맵.md)');
    return;
  }
  if (id === 'save-session') {
    toast(`탭 ${state.tabs.length}개를 세션으로 저장했습니다 (프로토타입에서는 흉내만 냅니다)`);
  }
}

function copyCleanUrl() {
  const url = addressParts ? rebuild(addressParts) : cleanUrl(currentTab().url);
  navigator.clipboard?.writeText(url).catch(() => {});
  toast(`복사됨 · ${url}`);
}

let toastTimer = null;
function toast(message) {
  el.toast.textContent = message;
  el.toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.toast.hidden = true; }, 2600);
}

function truncate(text, max) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function titleFor(url) {
  try {
    const parsed = new URL(url);
    return `${parsed.hostname.replace(/^www\./, '')}${parsed.pathname === '/' ? '' : parsed.pathname}`;
  } catch {
    return url;
  }
}

/* ---------- 키보드 ---------- */

document.addEventListener('keydown', (event) => {
  const barOpen = !el.overlay.hidden;
  const typingElsewhere = event.target instanceof HTMLInputElement && event.target !== el.input;

  if (!barOpen && !typingElsewhere) {
    if ((event.key === 'l' || event.key === 'L') && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      openBar(rebuild(addressParts ?? dissect(currentTab().url)));
      return;
    }
    if (event.key === '/') {
      event.preventDefault();
      openBar('');
      return;
    }
  }

  if (!barOpen) return;

  if (event.key === 'Escape') { closeBar(); return; }
  if (event.key === 'ArrowDown') {
    event.preventDefault();
    cursor = Math.min(cursor + 1, candidates.length - 1);
    renderResults();
    return;
  }
  if (event.key === 'ArrowUp') {
    event.preventDefault();
    cursor = Math.max(cursor - 1, 0);
    renderResults();
    return;
  }
  if (event.key === 'Tab') {
    // Tab 은 "채우기"다. 실행하지 않는다 — 크롬 인라인 자동완성처럼 입력을 가로채지 않기 위해서.
    event.preventDefault();
    const candidate = candidates[cursor];
    if (candidate?.action.url) el.input.value = candidate.action.url;
    else if (candidate?.action.text) el.input.value = candidate.action.text;
    refresh();
    return;
  }
  if (event.key === 'Enter') {
    event.preventDefault();
    execute(candidates[cursor], event.shiftKey);
  }
});

el.input.addEventListener('input', refresh);
document.getElementById('open-bar').addEventListener('click', () => openBar());
document.getElementById('copy-clean').addEventListener('click', copyCleanUrl);
el.chips.addEventListener('dblclick', () => openBar(rebuild(addressParts ?? dissect(currentTab().url))));

renderTabs();
renderAddress();
renderHints();
