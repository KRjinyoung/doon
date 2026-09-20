import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/core/parse.js';
import { suggest } from '../src/core/rank.js';
import { createState } from '../src/data/mock.js';

const NOW = Date.UTC(2026, 8, 20, 12, 0, 0);
const state = () => createState(NOW);

function top(input, context = state()) {
  return suggest(parse(input), context)[0];
}

test('이미 열린 페이지로 이동하려 하면 새 탭이 아니라 그 탭으로 전환한다', () => {
  const first = top('docs.docker.com/compose/compose-file/');
  assert.equal(first.action.type, 'switch-tab');
  assert.ok(first.why.includes('이미 열려 있음'));
});

test('추적 파라미터만 다른 주소도 같은 탭으로 본다', () => {
  const first = top('https://docs.docker.com/compose/compose-file/?utm_source=twitter');
  assert.equal(first.action.type, 'switch-tab');
});

test('열려 있지 않은 주소는 그냥 이동한다', () => {
  const first = top('example.org');
  assert.equal(first.action.type, 'navigate');
  assert.equal(first.action.url, 'https://example.org');
});

test('검색어는 로컬(탭·북마크·기록)이 웹 검색보다 항상 먼저다', () => {
  const results = suggest(parse('docker'), state());
  const webIndex = results.findIndex((item) => item.kind === 'search');
  const localIndexes = results
    .map((item, index) => (['tab', 'history', 'bookmark'].includes(item.kind) ? index : -1))
    .filter((index) => index >= 0);
  assert.ok(localIndexes.length > 0, '로컬 후보가 있어야 한다');
  assert.ok(webIndex > Math.max(...localIndexes), '웹 검색은 마지막 줄이어야 한다');
});

test('웹 검색 후보는 사라지지 않는다 — 마지막 줄에 항상 있다', () => {
  const results = suggest(parse('docker'), state());
  assert.ok(results.some((item) => item.kind === 'search'));
});

test('@탭 범위에서는 탭만 나온다', () => {
  const results = suggest(parse('@탭 docker'), state());
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.kind === 'tab'));
});

test('@기록 범위에서는 웹 검색 후보가 끼어들지 않는다', () => {
  const results = suggest(parse('@기록 docker'), state());
  assert.ok(results.every((item) => item.kind === 'history'));
});

test('여러 단어는 AND 로 걸린다', () => {
  const results = suggest(parse('결제 위젯'), state());
  const titles = results.filter((item) => item.kind !== 'search').map((item) => item.title);
  assert.ok(titles.every((title) => title.includes('결제')));
});

test('모든 후보는 순위 근거를 들고 있다', () => {
  for (const input of ['docker', 'github.com', '@탭 슬랙', '>분할', '!gh doon']) {
    for (const candidate of suggest(parse(input), state())) {
      assert.ok(candidate.why.length > 0, `${input} → ${candidate.title} 에 근거가 없다`);
    }
  }
});

test('같은 점수 상황에서 최근에 본 탭이 앞선다', () => {
  const results = suggest(parse('docker'), state()).filter((item) => item.kind === 'tab');
  assert.equal(results[0].subtitle, 'https://docs.docker.com/compose/compose-file/');
});

test('명령 모드는 명령만 돌려준다', () => {
  const results = suggest(parse('>탭'), state());
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.kind === 'command'));
});

test('같은 페이지를 가리키는 탭들은 한 줄로 접히고 개수를 밝힌다', () => {
  const results = suggest(parse('docker'), state()).filter((item) => item.kind === 'tab');
  assert.equal(results.length, 1, '중복 탭이 여러 줄로 나오면 안 된다');
  assert.ok(results[0].why.some((label) => label.includes('중복 탭 2개')));
});

test('이동 후보로 이미 보여준 탭은 목록에서 반복하지 않는다', () => {
  const results = suggest(parse('docs.docker.com/compose/compose-file/'), state());
  const switchRows = results.filter((item) => item.action.type === 'switch-tab');
  assert.equal(switchRows.length, 1);
});
