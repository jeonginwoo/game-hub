// 부하 테스트 봇 — 로비 서버 /ws 에 봇 여럿을 붙여 걷게 하고, 서버가 몇 명까지 버티는지 잰다 (스터디 체크리스트 m1·m3).
// 봇은 로비와 같은 메시지(hello → move)만 보낸다. 지연은 채팅 탐침으로 잰다 — 보낸 시각을 글에 싣고 같은 방 다른 봇이
// 받은 시각과 뺀다(봇이 모두 한 프로세스라 시계가 같다). 탐침은 move 와 같은 중계 길(broadcast)을 지나므로 중계 지연의 대리값.
//
//   npm run load -w server -- --ui                            대시보드(http://localhost:9300)에서 봇을 늘리고 줄이며 실시간으로 본다
//   npm run load -w server -- --bots 20                       방 하나에 20명, 60초
//   npm run load -w server -- --bots 100 --step 10 --step-every 20   20초마다 10명씩 늘리며 꺾이는 지점 찾기
//   npm run load -w server -- --bots 200 --rooms 10           방 10개에 20명씩 — 서버 전체 용량
//
// 서버 쪽 CPU·메모리는 서버를 STATS=1 로 띄우면 같이 본다 (src/load-stats.ts — 대시보드는 그 서버의 /__stats 를 읽는다).
// 같은 PC 에서 돌리면 봇도 CPU 를 쓰니 보고서에 적을 것 — 봇 쪽 「루프 지연」이 크면 서버가 아니라 봇 프로세스가 병목이다.
// 루프 지연은 Windows 타이머가 거칠어 쉬어도 20~30ms 쯤 나온다 — 절대값보다 인원을 늘릴 때 오르는지를 본다.
import { appendFileSync, readFileSync, writeFileSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { join } from 'node:path';
import { monitorEventLoopDelay } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { WebSocket, type RawData } from 'ws';
import { LOOK_CHOICES, ROOM_ALPHABET, ROOM_CODE_LENGTH, ROOM_PARAM, type ClientMsg, type Look, type ServerMsg, type Spot } from '../src/protocol.ts';
import { STATS_PATH, type ServerStats } from '../src/load-stats.ts';
import type { RoomData } from '../src/room-map.ts';
import { templateFor } from '../src/room-templates.ts';
import { nextStep, percentile, walkableOf, type Walkable } from './walk.ts';

const { values: opt } = parseArgs({
  options: {
    url: { type: 'string', default: 'ws://localhost:8080/ws' }, // 배포 모양(npm start). 개발 서버면 ws://localhost:5173/ws
    bots: { type: 'string' }, // 처음 붙일 봇 수 — 기본 20, --ui 면 0(화면에서 늘린다)
    rooms: { type: 'string', default: '1' }, // 봇을 방 여러 개에 고르게 나눈다
    room: { type: 'string' }, // 첫 방 코드를 정한다 — 브라우저로 그 방에 들어가 봇을 볼 수 있다
    map: { type: 'string' }, // 방을 만들 템플릿 id (없으면 기본 광장)
    hz: { type: 'string', default: '5' }, // 봇 하나가 초당 보내는 move. 쉬지 않고 걷는 사람 ≈ 12.5 (로비 STEP_MS 80)
    step: { type: 'string' }, // 한 번에 늘릴 봇 수 (없으면 한꺼번에)
    'step-every': { type: 'string', default: '15' }, // 초
    duration: { type: 'string' }, // 마지막 봇이 들어온 뒤 잴 시간(초). 0 = Ctrl+C 까지. 기본 60, --ui 면 0
    probe: { type: 'string', default: '2' }, // 봇 하나가 지연 탐침을 보내는 간격(초). 0 = 끔. 서버 채팅 제한이 5초에 5줄이라 1 이상
    report: { type: 'string', default: '5' }, // 콘솔 한 줄 요약 간격(초)
    csv: { type: 'string' }, // 요약 줄을 CSV 로도 남길 파일 — 보고서 그래프용
    ui: { type: 'boolean', default: false }, // 실시간 대시보드
    'ui-port': { type: 'string', default: '9300' },
  },
});

function num(name: keyof typeof opt, fallback: number, min: number): number {
  const raw = opt[name];
  if (raw === undefined) return fallback;
  const v = Number(raw);
  if (!Number.isFinite(v) || v < min) throw new Error(`--${name} 은 ${min} 이상의 수여야 한다: ${String(raw)}`);
  return v;
}

const UI = opt.ui === true;
const INITIAL_BOTS = num('bots', UI ? 0 : 20, 0);
const ROOMS = num('rooms', 1, 1);
const STEP = num('step', Math.max(1, INITIAL_BOTS), 1);
const STEP_EVERY_MS = num('step-every', 15, 1) * 1000;
const DURATION_MS = num('duration', UI ? 0 : 60, 0) * 1000;
const PROBE_MS = num('probe', 2, 0) * 1000;
const REPORT_MS = num('report', 5, 1) * 1000;
const UI_PORT = num('ui-port', 9300, 1);
if (PROBE_MS > 0 && PROBE_MS < 1000) throw new Error('--probe 는 0(끔) 또는 1 이상 — 서버가 5초에 5줄 넘는 채팅을 버린다');
const HZ_MIN = 0.1;
const HZ_MAX = 30;
let hz = Math.min(HZ_MAX, num('hz', 5, HZ_MIN));
const PROBE = '⏱'; // 탐침 채팅 머리 — 뒤에 보낸 시각(ms)
const JOIN_GAP_MS = 50; // 봇을 여럿 붙일 때 사이 간격 — 한 틱에 수백 개가 몰리는 접속 폭주는 재려는 것이 아니다
const MAX_BOTS = 2000; // 화면 버튼으로 끝없이 늘리지 않게

const wsUrl = new URL(opt.url);
const httpOrigin = `${wsUrl.protocol === 'wss:' ? 'https:' : 'http:'}//${wsUrl.host}`;

function randomCode(): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) code += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  return code;
}

const roomCodes = Array.from({ length: ROOMS }, (_, i) => (i === 0 && opt.room ? opt.room : randomCode()));

function randomLook(): Look {
  const pick = (n: number): number => Math.floor(Math.random() * n);
  return { body: pick(LOOK_CHOICES.body), hair: pick(LOOK_CHOICES.hair), hat: pick(LOOK_CHOICES.hat), beard: pick(LOOK_CHOICES.beard) };
}

// 방 데이터 → 걸을 곳. 같은 방의 봇들이 같은 데이터를 받으므로 한 번만 만든다
const walkCache = new Map<string, Walkable>();
function walkableFor(code: string, room: RoomData): Walkable {
  const key = `${code}:${JSON.stringify(room).length}`; // 방장이 바꾸지 않는 한 같은 방 — 길이로 충분
  let w = walkCache.get(key);
  if (!w) {
    w = walkableOf(room);
    walkCache.set(key, w);
  }
  return w;
}
const templateWalk = walkableOf(templateFor(opt.map).room);

// ── 집계. 창은 셋 — 1초(대시보드), 콘솔 보고 간격, 처음부터 끝까지
class Window {
  sent = 0;
  recv = 0;
  bytes = 0;
  lat: number[] = [];
}
let secWin = new Window();
let repWin = new Window();
const total = new Window();
const windows = (): Window[] => [secWin, repWin, total];
let failed = 0; // welcome 전에 닫힘
let dropped = 0; // 측정 중 서버가 끊음 — 과부하 신호
let open = 0; // welcome 받고 열린 봇
let peakOpen = 0; // 동시에 열린 봇의 최대
const inRoom = new Map<string, number>(); // 방 코드 → welcome 받은 봇 수
const loop = monitorEventLoopDelay({ resolution: 10 });
loop.enable();
let repLoopMax = 0;

function sizeOf(data: RawData): number {
  if (Array.isArray(data)) return data.reduce((n, b) => n + b.length, 0);
  return data instanceof ArrayBuffer ? data.byteLength : data.length;
}

class Bot {
  private readonly ws: WebSocket;
  private readonly n: number;
  private readonly code: string;
  private id: string | null = null;
  private at: Spot;
  private walk: Walkable = templateWalk;
  private moveTimer: NodeJS.Timeout | undefined;
  private probeTimer: NodeJS.Timeout | undefined;
  private leaving = false;

  constructor(n: number, code: string) {
    this.n = n;
    this.code = code;
    const start = templateWalk.starts[n % templateWalk.starts.length] ?? { x: 1, y: 1 };
    this.at = { ...start, dir: 'down' };
    this.ws = new WebSocket(`${opt.url}?${ROOM_PARAM}=${code}`);
    this.ws.on('open', () => {
      this.send({ t: 'hello', name: `봇${n + 1}`, at: this.at, look: randomLook(), ...(opt.map ? { map: opt.map } : {}) });
    });
    this.ws.on('message', (data) => this.receive(data));
    this.ws.on('error', () => {}); // 실패는 close 가 센다
    this.ws.on('close', () => {
      clearInterval(this.moveTimer);
      clearInterval(this.probeTimer);
      if (this.id === null) {
        if (!this.leaving) failed++;
        return;
      }
      open--;
      inRoom.set(this.code, (inRoom.get(this.code) ?? 1) - 1);
      if (!this.leaving && !stopping) dropped++;
    });
  }

  private send(msg: ClientMsg): void {
    if (this.ws.readyState !== WebSocket.OPEN) return;
    this.ws.send(JSON.stringify(msg));
    for (const w of windows()) w.sent++;
  }

  private receive(data: RawData): void {
    const size = sizeOf(data);
    for (const w of windows()) {
      w.recv++;
      w.bytes += size;
    }
    // 상대는 우리 서버뿐이라 형식 검사 없이 받는다
    let msg: ServerMsg;
    try {
      msg = JSON.parse(data.toString()) as ServerMsg;
    } catch {
      return; // 깨진 프레임 하나로 측정 전체가 죽지 않게
    }
    if (msg.t === 'welcome') this.welcome(msg.id, msg.room);
    else if (msg.t === 'chat' && msg.id !== this.id && msg.text.startsWith(PROBE)) {
      // 사람이 봇 방에서 「⏱abc」 를 쳐도 NaN 이 백분위를 깨지 않게
      const lat = Date.now() - Number(msg.text.slice(PROBE.length));
      if (Number.isFinite(lat) && lat >= 0) for (const w of windows()) w.lat.push(lat);
    }
  }

  private welcome(id: string, room: RoomData): void {
    this.id = id;
    open++;
    peakOpen = Math.max(peakOpen, open);
    inRoom.set(this.code, (inRoom.get(this.code) ?? 0) + 1);
    this.walk = walkableFor(this.code, room);
    // 이미 있던 방(다른 맵)에 들어왔으면 그 방의 시작점으로
    if (!this.walk.canStand(this.at)) {
      const s = this.walk.starts[this.n % this.walk.starts.length] ?? this.at;
      this.at = { ...s, dir: 'down' };
    }
    this.startMoving();
    if (PROBE_MS > 0) {
      // 모두 같은 순간에 보내지 않게 시작을 흩는다
      setTimeout(() => {
        if (this.ws.readyState !== WebSocket.OPEN) return;
        this.probeTimer = setInterval(() => this.send({ t: 'chat', text: `${PROBE}${Date.now()}` }), PROBE_MS);
      }, Math.random() * PROBE_MS);
    }
  }

  /** 지금 hz 로 걷기 — hz 가 바뀌면 다시 부른다 */
  startMoving(): void {
    if (this.id === null) return;
    clearInterval(this.moveTimer);
    const every = 1000 / hz;
    const timer = setTimeout(() => {
      if (this.ws.readyState !== WebSocket.OPEN) return;
      this.moveTimer = setInterval(() => {
        this.at = nextStep(this.at, this.walk);
        this.send({ t: 'move', at: this.at });
      }, every);
    }, Math.random() * every);
    this.moveTimer = timer;
  }

  close(): void {
    this.leaving = true;
    this.ws.close();
  }
}

// ── 봇 늘리기·줄이기
const bots: Bot[] = [];
let nextN = 0;
let pending = 0; // 붙이기로 하고 아직 만들지 않은 봇
let stopping = false;

function addBots(k: number, gapMs = JOIN_GAP_MS, delayMs = 0): void {
  const room = Math.max(0, MAX_BOTS - bots.length - pending);
  const count = Math.min(k, room);
  pending += count;
  for (let i = 0; i < count; i++) {
    setTimeout(() => {
      pending--;
      if (stopping) return;
      const n = nextN++;
      bots.push(new Bot(n, roomCodes[n % ROOMS] ?? randomCode()));
    }, delayMs + i * gapMs);
  }
}

function removeBots(k: number): void {
  for (let i = 0; i < k && bots.length > 0; i++) bots.pop()?.close();
}

function setHz(v: number): void {
  hz = Math.min(HZ_MAX, Math.max(HZ_MIN, v));
  for (const b of bots) b.startMoving();
}

/**
 * 서버가 초당 보내야 하는 메시지 수 — 방마다 인원 n 이면 move n·(n−1)·hz(보낸 사람 빼고 중계) + 탐침 n·n/간격(보낸 사람에게도 돌아옴).
 * 받은 수가 이보다 꾸준히 작으면 서버가 밀리고 있다
 */
function expectedRecv(): number {
  const probeHz = PROBE_MS > 0 ? 1000 / PROBE_MS : 0;
  let sum = 0;
  for (const n of inRoom.values()) sum += n * (n - 1) * hz + n * n * probeHz;
  return Math.round(sum);
}

// ── 1초 샘플 — 대시보드로 보내고, 콘솔 창에 모은다
interface Sample {
  readonly t: number; // 시작부터 초
  readonly bots: number;
  readonly target: number;
  readonly hz: number;
  readonly sent: number;
  readonly recv: number;
  readonly expected: number;
  readonly kb: number;
  readonly p50: number | null;
  readonly p95: number | null;
  readonly p99: number | null;
  readonly max: number | null;
  readonly botLoop: number;
  readonly dropped: number;
  readonly failed: number;
  readonly server: ServerStats | null;
}

const t0 = Date.now();
let lastSec = t0;
let serverStats: ServerStats | null = null;
const history: Sample[] = [];
const HISTORY_MAX = 600; // 10분
const nan2null = (v: number): number | null => (Number.isNaN(v) ? null : Math.round(v * 10) / 10);

async function pollServer(): Promise<void> {
  try {
    const res = await fetch(`${httpOrigin}${STATS_PATH}`, { signal: AbortSignal.timeout(800) });
    serverStats = res.ok ? ((await res.json()) as ServerStats | null) : null;
  } catch {
    serverStats = null; // STATS=1 이 아니거나 개발 서버(Vite) — 서버 지표 없이 간다
  }
}

function tick(): void {
  const now = Date.now();
  const secs = Math.max(0.001, (now - lastSec) / 1000);
  lastSec = now;
  const lat = secWin.lat.sort((a, b) => a - b);
  const botLoop = loop.percentile(99) / 1e6;
  repLoopMax = Math.max(repLoopMax, botLoop);
  loop.reset();
  const s: Sample = {
    t: Math.round((now - t0) / 1000),
    bots: open,
    target: bots.length + pending,
    hz,
    sent: Math.round(secWin.sent / secs),
    recv: Math.round(secWin.recv / secs),
    expected: expectedRecv(),
    kb: Math.round(secWin.bytes / 1024 / secs),
    p50: nan2null(percentile(lat, 50)),
    p95: nan2null(percentile(lat, 95)),
    p99: nan2null(percentile(lat, 99)),
    max: nan2null(percentile(lat, 100)),
    botLoop: Math.round(botLoop * 10) / 10,
    dropped,
    failed,
    server: serverStats,
  };
  secWin = new Window();
  history.push(s);
  if (history.length > HISTORY_MAX) history.shift();
  broadcast('sample', s);
  void pollServer();
}

// ── 콘솔·CSV
const ms = (v: number): string => (Number.isNaN(v) ? '-' : `${v.toFixed(0)}ms`);
const CSV_HEAD = 'sec,bots,hz,sent_per_s,recv_per_s,recv_kb_per_s,expected_recv_per_s,lat_p50_ms,lat_p95_ms,lat_p99_ms,lat_max_ms,bot_loop_p99_ms,dropped,server_cpu_pct,server_mem_mb';
let lastReport = t0;

function report(): void {
  const now = Date.now();
  const secs = Math.max(0.001, (now - lastReport) / 1000); // 마지막 구간은 짧을 수 있다
  lastReport = now;
  const lat = repWin.lat.sort((a, b) => a - b);
  const sec = Math.round((now - t0) / 1000);
  const sent = Math.round(repWin.sent / secs);
  const recv = Math.round(repWin.recv / secs);
  const kb = Math.round(repWin.bytes / 1024 / secs);
  const expected = expectedRecv();
  const [p50, p95, p99, max] = [50, 95, 99, 100].map((p) => percentile(lat, p)) as [number, number, number, number];
  const srv = serverStats;
  log(
    `[${String(sec).padStart(4)}s] 봇 ${open} · 보냄 ${sent}/s · 받음 ${recv}/s (기대 ${expected}/s, ${kb} KB/s)` +
    ` · 지연 p50 ${ms(p50)} p95 ${ms(p95)} p99 ${ms(p99)} 최대 ${ms(max)} · 봇 루프 p99 ${ms(repLoopMax)}` +
    (srv ? ` · 서버 CPU ${srv.cpu.toFixed(0)}%` : '') +
    (dropped > 0 ? ` · 끊김 ${dropped}` : ''),
  );
  if (opt.csv) {
    const f = (v: number | undefined): string => (v === undefined || Number.isNaN(v) ? '' : v.toFixed(1));
    appendFileSync(opt.csv, [sec, open, hz, sent, recv, kb, expected, f(p50), f(p95), f(p99), f(max), f(repLoopMax), dropped,
      f(srv?.cpu), f(srv?.memMb)].join(',') + '\n');
  }
  repWin = new Window();
  repLoopMax = 0;
}

// ── 대시보드 — 페이지 하나와 1초 샘플·로그 스트림(SSE), 봇 조절 POST
const clients = new Set<ServerResponse>();
const logs: string[] = [];
const LOG_MAX = 200; // 줄

/** 콘솔과 대시보드 로그 칸에 같은 줄 */
function log(line: string): void {
  console.log(line);
  logs.push(line);
  if (logs.length > LOG_MAX) logs.shift();
  broadcast('log', line);
}

function broadcast(event: string, data: unknown): void {
  const chunk = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of clients) res.write(chunk);
}

function startUi(): void {
  const page = readFileSync(join(import.meta.dirname, 'dashboard.html'));
  const lobby = `${httpOrigin}/?${ROOM_PARAM}=`;
  // 이 PC 의 다른 웹 페이지가 fetch 로 봇을 조작하지 못하게(POST 는 사전 요청이 없다) — Host 는 DNS rebinding 막기
  const hosts = new Set([`localhost:${UI_PORT}`, `127.0.0.1:${UI_PORT}`]);
  const origins = new Set([...hosts].map((h) => `http://${h}`));
  const ui = createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://x');
    const origin = req.headers.origin;
    if (!hosts.has(req.headers.host ?? '') || (origin !== undefined && !origins.has(origin))) {
      res.writeHead(403).end();
      return;
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' }).end(page);
      return;
    }
    if (req.method === 'GET' && url.pathname === '/events') {
      res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' });
      res.write(`event: init\ndata: ${JSON.stringify({ url: opt.url, rooms: roomCodes, lobby, probeMs: PROBE_MS, history, logs })}\n\n`);
      clients.add(res);
      req.on('close', () => clients.delete(res));
      return;
    }
    if (req.method === 'POST') {
      const raw = url.searchParams.get('v');
      // 없으면 NaN — Number(null) 은 0 이라 그냥 쓰면 「+0」·최소 빈도가 된다. 봇 수는 ±MAX_BOTS 로 자른다
      const v = raw === null || raw === '' ? Number.NaN : Number(raw);
      if (url.pathname === '/bots' && Number.isInteger(v) && v !== 0 && Math.abs(v) <= MAX_BOTS) {
        if (v > 0) addBots(v);
        else removeBots(-v);
        log(`── 봇 ${v > 0 ? '+' : ''}${v} → 목표 ${bots.length + pending}`);
      } else if (url.pathname === '/hz' && Number.isFinite(v)) {
        setHz(v);
        log(`── 봇당 이동 ${hz}/s`);
      }
      else if (url.pathname === '/stop') stop();
      else {
        res.writeHead(400).end();
        return;
      }
      res.writeHead(204).end();
      return;
    }
    res.writeHead(404).end();
  });
  ui.on('error', (e) => console.error(`대시보드를 열지 못했다 (포트 ${UI_PORT}): ${e.message}`));
  ui.listen(UI_PORT, '127.0.0.1', () => console.log(`대시보드 → http://localhost:${UI_PORT}`));
  ui.unref();
}

// ── 실행
function stop(): void {
  if (stopping) return;
  stopping = true;
  clearInterval(ticker);
  clearInterval(reporter);
  report();
  broadcast('stopped', {});
  for (const res of clients) res.end();
  const secs = (Date.now() - t0) / 1000;
  const lat = total.lat.sort((a, b) => a - b);
  console.log('\n── 요약');
  console.log(`동시 접속 최대 ${peakOpen}·만든 봇 ${nextN} (방 ${ROOMS}개, 봇당 move ${hz}/s) · ${secs.toFixed(0)}초 · 접속 실패 ${failed} · 측정 중 끊김 ${dropped}`);
  console.log(`보냄 ${total.sent} · 받음 ${total.recv} (${(total.bytes / 1024 / 1024).toFixed(1)} MB, 평균 ${Math.round(total.bytes / 1024 / secs)} KB/s)`);
  console.log(`지연 탐침 ${lat.length}개 · p50 ${ms(percentile(lat, 50))} · p95 ${ms(percentile(lat, 95))} · p99 ${ms(percentile(lat, 99))} · 최대 ${ms(percentile(lat, 100))}`);
  for (const b of bots) b.close();
  setTimeout(() => process.exit(0), 500).unref();
}

if (opt.csv) writeFileSync(opt.csv, `${CSV_HEAD}\n`);
console.log(`봇 → ${opt.url} · 방 ${roomCodes.join(', ')}`);
console.log(`(브라우저로 보기: ${httpOrigin}/?${ROOM_PARAM}=${roomCodes[0]})`);
const ticker = setInterval(tick, 1000);
const reporter = setInterval(report, REPORT_MS);
process.on('SIGINT', stop);
if (UI) startUi();

for (let s = 0; s * STEP < INITIAL_BOTS; s++) addBots(Math.min(STEP, INITIAL_BOTS - s * STEP), JOIN_GAP_MS, s * STEP_EVERY_MS);
if (DURATION_MS > 0) {
  const last = INITIAL_BOTS === 0 ? 0 : Math.floor((INITIAL_BOTS - 1) / STEP) * STEP_EVERY_MS + ((INITIAL_BOTS - 1) % STEP) * JOIN_GAP_MS;
  setTimeout(stop, last + DURATION_MS);
}
