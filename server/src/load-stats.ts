// 부하 측정용 서버 지표 — load-lab 저장소의 docs/stats-contract.md 를 따른다 (봇: C:\Projects\playground\load-lab).
// STATS=1 이거나 STATS_TOKEN 이 있을 때만 main.ts 가 켠다. 1초마다 재고 5초마다 한 줄 로그, 마지막 값을 GET STATS_PATH 로.
// STATS_TOKEN 이 있으면 ?token= 이 맞아야 답한다 — 공개 배포에서 켤 때는 반드시 토큰으로 (접속 수가 드러난다).
// 읽는 쪽은 봇 프로세스(Node)라 CORS 헤더는 주지 않는다 — 브라우저 페이지는 못 읽는다.
// CPU 는 이 프로세스가 코어 하나를 얼마나 썼는지(%) — Node 는 JS 를 한 스레드로 돌리므로 100% 에 가까우면 포화다.
import { timingSafeEqual } from 'node:crypto';
import type { ServerResponse } from 'node:http';
import { monitorEventLoopDelay } from 'node:perf_hooks';

export const STATS_PATH = '/__stats';

export interface ServerStats {
  readonly conns: number;
  readonly rooms: number;
  readonly cpu: number; // %
  readonly memMb: number;
  readonly loopP99Ms: number;
}

export interface StatsGate {
  readonly token: string | null;
}

/** 환경 변수로 켜졌는지 — 꺼져 있으면 null (STATS_PATH 는 보통 주소처럼 404) */
export function statsGate(env: Readonly<Record<string, string | undefined>>): StatsGate | null {
  if (env.STATS_TOKEN) return { token: env.STATS_TOKEN };
  return env.STATS === '1' ? { token: null } : null;
}

/** 토큰이 맞는지 — 길이가 다르면 바로 false, 같으면 시간이 일정한 비교 */
export function tokenOk(gate: StatsGate, given: string | null): boolean {
  if (gate.token === null) return true;
  if (given === null) return false;
  const a = Buffer.from(gate.token);
  const b = Buffer.from(given);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** STATS_PATH 요청에 답한다 */
export function answerStats(res: ServerResponse, gate: StatsGate, token: string | null, stats: ServerStats | null): void {
  if (!tokenOk(gate, token)) {
    res.writeHead(403).end();
    return;
  }
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(stats));
}

const SAMPLE_MS = 1_000;
const LOG_EVERY = 5; // 샘플

/** 재기 시작하고, 마지막 샘플을 돌려주는 함수를 준다 — 첫 샘플 전에는 null */
export function startStats(counts: () => { conns: number; rooms: number }): () => ServerStats | null {
  const loop = monitorEventLoopDelay({ resolution: 10 });
  loop.enable();
  let cpu = process.cpuUsage();
  let at = performance.now();
  let last: ServerStats | null = null;
  let n = 0;
  const timer = setInterval(() => {
    const now = performance.now();
    const used = process.cpuUsage(cpu);
    last = {
      ...counts(),
      cpu: ((used.user + used.system) / 1000 / (now - at)) * 100,
      memMb: process.memoryUsage().rss / 1024 / 1024,
      loopP99Ms: loop.percentile(99) / 1e6,
    };
    if (++n % LOG_EVERY === 0) {
      console.log(`[stats] 접속 ${last.conns} · 방 ${last.rooms} · CPU ${last.cpu.toFixed(0)}% · 메모리 ${last.memMb.toFixed(0)} MB` +
        ` · 이벤트 루프 지연 p99 ${last.loopP99Ms.toFixed(1)}ms`);
    }
    loop.reset();
    cpu = process.cpuUsage();
    at = now;
  }, SAMPLE_MS);
  timer.unref();
  return () => last;
}
