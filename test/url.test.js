import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classify, dissect, rebuild, cleanUrl, identityKey } from '../src/core/url.js';

test('주소로 판정해야 하는 입력', () => {
  const cases = [
    ['github.com', 'https://github.com'],
    ['www.naver.com', 'https://www.naver.com'],
    ['ko.wikipedia.org/wiki/브라우저', 'https://ko.wikipedia.org/wiki/브라우저'],
    ['http://example.com', 'http://example.com'],
    ['localhost:3000', 'http://localhost:3000'],
    ['127.0.0.1:8080', 'http://127.0.0.1:8080'],
    ['about:blank', 'about:blank'],
  ];
  for (const [input, expected] of cases) {
    const verdict = classify(input);
    assert.equal(verdict.kind, 'url', `${input} 은(는) 주소여야 한다`);
    assert.equal(verdict.url, expected);
  }
});

test('검색어로 판정해야 하는 입력', () => {
  const cases = [
    '도커 컴포즈 볼륨',      // 공백
    '버전 1.2',              // 공백 + 숫자 TLD
    'TODO: 내일 할 일',      // 알 수 없는 스킴처럼 보이는 콜론
    '3.14',                  // 숫자 TLD
    'docker',                // 점 없음
    '',                      // 빈 입력
  ];
  for (const input of cases) {
    assert.equal(classify(input).kind, 'query', `${JSON.stringify(input)} 은(는) 검색어여야 한다`);
  }
});

test('판정에는 언제나 사람이 읽을 수 있는 근거가 붙는다', () => {
  for (const input of ['github.com', '도커 컴포즈', '3.14', 'localhost:3000']) {
    assert.ok(classify(input).reason.length > 0);
  }
});

test('dissect 는 주소를 편집 가능한 조각으로 쪼갠다', () => {
  const parts = dissect('https://shop.example.com:8443/items/42?color=red&utm_source=mail#reviews');
  assert.equal(parts.scheme, 'https');
  assert.equal(parts.host, 'shop.example.com');
  assert.equal(parts.port, '8443');
  assert.deepEqual(parts.segments, ['items', '42']);
  assert.equal(parts.hash, 'reviews');
  assert.equal(parts.params.length, 2);
  assert.equal(parts.params[0].enabled, true);
  assert.equal(parts.params[1].tracking, true);
  assert.equal(parts.params[1].enabled, false, '추적 파라미터는 기본적으로 꺼진 채 제시된다');
});

test('rebuild 는 꺼둔 파라미터를 뺀 주소를 만든다', () => {
  const parts = dissect('https://a.example/x?q=1&utm_source=z');
  assert.equal(rebuild(parts), 'https://a.example/x?q=1');
  parts.params[0].enabled = false;
  assert.equal(rebuild(parts), 'https://a.example/x');
});

test('cleanUrl 은 추적 파라미터만 걷어낸다', () => {
  assert.equal(
    cleanUrl('https://news.example/article?id=7&utm_medium=social&fbclid=xyz'),
    'https://news.example/article?id=7',
  );
});

test('identityKey 는 www·추적 파라미터·해시 차이를 같은 페이지로 본다', () => {
  const a = identityKey('https://www.docs.example/compose/?utm_source=nl');
  const b = identityKey('https://docs.example/compose/#top');
  assert.equal(a, b);
});

test('identityKey 는 실제로 다른 페이지를 구분한다', () => {
  assert.notEqual(identityKey('https://a.example/1'), identityKey('https://a.example/2'));
  assert.notEqual(identityKey('https://a.example/s?q=1'), identityKey('https://a.example/s?q=2'));
});
