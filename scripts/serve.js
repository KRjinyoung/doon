#!/usr/bin/env node
// 의존성 없는 정적 서버. 프로토타입은 ESM 모듈을 쓰기 때문에 file:// 로는 열리지 않는다.

import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';

const ROOT = new URL('..', import.meta.url).pathname;
const PORT = Number(process.env.PORT ?? 4173);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, 'http://localhost');
  let pathname = decodeURIComponent(url.pathname);

  // 상대 경로(./styles.css)가 깨지지 않도록 루트는 리다이렉트한다.
  if (pathname === '/') {
    response.writeHead(302, { location: '/prototype/' }).end();
    return;
  }
  if (pathname.endsWith('/')) pathname += 'index.html';

  // 루트 밖으로 나가는 경로는 거부한다.
  const target = join(ROOT, normalize(pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!target.startsWith(ROOT)) {
    response.writeHead(403).end('forbidden');
    return;
  }

  try {
    const body = await readFile(target);
    response.writeHead(200, { 'content-type': TYPES[extname(target)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    response.end('not found');
  }
});

server.listen(PORT, () => {
  console.log(`Doon 프로토타입 → http://localhost:${PORT}/`);
});
