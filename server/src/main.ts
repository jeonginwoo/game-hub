// 배포용 진입점 — 로비 빌드(lobby/dist)와 /ws 를 한 포트로 연다. `npm run build && npm start`.
// 개발 중에는 쓰지 않는다 (lobby/vite.config.ts 의 플러그인이 Vite 서버에 같은 /ws 를 붙인다).
import { createReadStream, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { pipeline } from 'node:stream';
import { answerStats, startStats, statsGate, STATS_PATH, type ServerStats } from './load-stats.ts';
import { Rooms } from './roster.ts';
import { attachLobby, WS_PATH } from './ws.ts';

const PORT = Number(process.env.PORT) || 8080; // 호스팅이 PORT 를 정해 주면 그것을 쓴다 (빈 값이면 기본)
const ROOT = resolve(import.meta.dirname, '..', '..', 'lobby', 'dist');

const MIME: Readonly<Record<string, string>> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

// 부하 측정 때만(STATS=1 또는 STATS_TOKEN) — 아래 attachLobby 뒤에 켠다. 꺼져 있으면 STATS_PATH 도 보통 주소(404)
const gate = statsGate(process.env);
let stats: (() => ServerStats | null) | null = null;

const server = createServer((req, res) => {
  let path: string;
  try {
    path = decodeURIComponent(new URL(req.url ?? '/', 'http://x').pathname);
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (gate && stats && path === STATS_PATH) {
    answerStats(res, gate, new URL(req.url ?? '/', 'http://x').searchParams.get('token'), stats());
    return;
  }
  let file = normalize(join(ROOT, path));
  // ../ 로 dist 밖을 읽지 못하게
  if (file !== ROOT && !file.startsWith(ROOT + sep)) {
    res.writeHead(403).end();
    return;
  }
  try {
    if (statSync(file).isDirectory()) {
      // 디렉터리면 그 안의 index.html — 그것도 있어야 한다
      file = join(file, 'index.html');
      statSync(file);
    }
  } catch {
    res.writeHead(404).end('not found');
    return;
  }
  res.writeHead(200, { 'Content-Type': MIME[extname(file)] ?? 'application/octet-stream' });
  // 읽는 중 파일이 사라지거나 클라이언트가 끊겨도 스트림 오류가 프로세스를 죽이지 않게
  pipeline(createReadStream(file), res, () => {});
});

const rooms = new Rooms();
const wss = attachLobby(server, rooms);
if (gate) stats = startStats(() => ({ conns: wss.clients.size, rooms: rooms.count }));
// attachLobby 는 /ws 밖의 업그레이드를 남겨 둔다 — 받을 곳이 없으면 소켓이 매달리므로 끊는다
server.on('upgrade', (req, socket) => {
  if (new URL(req.url ?? '/', 'http://x').pathname !== WS_PATH) socket.destroy();
});
server.listen(PORT, () => console.log(`game-hub → http://localhost:${PORT}`));
