// 부하 측정용 서버 지표 — 환경 변수 STATS=1 일 때만 main.ts 가 켠다 (봇: server/load/bots.ts).
// 1초마다 재고, 5초마다 한 줄 로그. 마지막 값은 main.ts 가 STATS_PATH 로 내준다 — 봇 대시보드가 읽는다.
// CPU 는 이 프로세스가 코어 하나를 얼마나 썼는지(%) — Node 는 JS 를 한 스레드로 돌리므로 100% 에 가까우면 포화다.
import { monitorEventLoopDelay } from 'node:perf_hooks';
import type { WebSocketServer } from 'ws';

export const STATS_PATH = '/__stats';

export interface ServerStats {
  readonly conns: number;
  readonly cpu: number; // %
  readonly memMb: number;
  readonly loopP99Ms: number;
}

const SAMPLE_MS = 1_000;
const LOG_EVERY = 5; // 샘플

/** 재기 시작하고, 마지막 샘플을 돌려주는 함수를 준다 — 첫 샘플 전에는 null */
export function startStats(wss: WebSocketServer): () => ServerStats | null {
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
      conns: wss.clients.size,
      cpu: ((used.user + used.system) / 1000 / (now - at)) * 100,
      memMb: process.memoryUsage().rss / 1024 / 1024,
      loopP99Ms: loop.percentile(99) / 1e6,
    };
    if (++n % LOG_EVERY === 0) {
      console.log(`[stats] 접속 ${last.conns} · CPU ${last.cpu.toFixed(0)}% · 메모리 ${last.memMb.toFixed(0)} MB` +
        ` · 이벤트 루프 지연 p99 ${last.loopP99Ms.toFixed(1)}ms`);
    }
    loop.reset();
    cpu = process.cpuUsage();
    at = now;
  }, SAMPLE_MS);
  timer.unref();
  return () => last;
}
