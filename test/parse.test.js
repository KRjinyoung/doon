import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse } from '../src/core/parse.js';

test('접두어 없는 입력은 규칙대로 이동/검색으로 갈린다', () => {
  assert.equal(parse('github.com').type, 'navigate');
  assert.equal(parse('github.com').url, 'https://github.com');
  assert.equal(parse('도커 볼륨 마운트').type, 'search');
});

test('? 는 주소처럼 생긴 입력도 무조건 검색으로 보낸다', () => {
  const intent = parse('?github.com');
  assert.equal(intent.type, 'search');
  assert.equal(intent.query, 'github.com');
});

test('! 는 사이트 한정 검색', () => {
  const intent = parse('!gh doon browser');
  assert.equal(intent.type, 'site-search');
  assert.equal(intent.site.name, 'GitHub');
  assert.equal(intent.query, 'doon browser');
  assert.ok(intent.url.includes('doon%20browser'));
});

test('모르는 별칭은 조용히 웹 검색으로 새지 않는다', () => {
  const intent = parse('!zzz 뭔가');
  assert.equal(intent.type, 'site-search');
  assert.equal(intent.site, null);
  assert.match(intent.reason, /등록되지 않은/);
});

test('@ 는 검색 범위를 한정한다', () => {
  assert.equal(parse('@탭 슬랙').scope, 'tab');
  assert.equal(parse('@기록 도커').scope, 'history');
  assert.equal(parse('@북마크').scope, 'bookmark');
  assert.equal(parse('@페이지 환불').type, 'find-in-page');
});

test('> 는 명령 모드', () => {
  const intent = parse('>탭 정리');
  assert.equal(intent.type, 'command');
  assert.equal(intent.command.id, 'dedupe-tabs');
});

test('모든 해석에는 explain 한 줄이 따라붙는다', () => {
  const inputs = ['', 'github.com', '도커', '!gh x', '@탭 a', '>분할', '?a'];
  for (const input of inputs) {
    const intent = parse(input);
    assert.ok(intent.explain.length > 0, `${JSON.stringify(input)} 에 해석 문장이 없다`);
  }
});

test('한국어 조사가 어색해지지 않는다', () => {
  assert.match(parse('@탭 a').reason, /열린 탭으로/);
  assert.match(parse('@북마크 a').reason, /북마크로/);
});
