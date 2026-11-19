// 부하 테스트 봇의 순수 규칙 — 어디를 걸을 수 있는지, 다음 한 칸, 지연 백분위. 소켓 없이 테스트한다.
import type { Dir, Spot } from '../src/protocol.ts';
import { buildRoom, solidCells, type Pos, type RoomData } from '../src/room-map.ts';

export interface Walkable {
  canStand(p: Pos): boolean;
  readonly starts: readonly Pos[];
}

/**
 * 봇이 설 수 있는 칸 — 바닥·게이트 칸 중 물체가 막지 않는 곳. 문 칸은 밟지 않는다(사람이라면 게임에 들어간다).
 * 꼬리표(열림/닫힘) 물체는 문 상태에 따라 보이므로 빼고 늘 보이는 물체만 막는 것으로 본다 — 봇 걷기에는 이 정도면 된다
 */
export function walkableOf(data: RoomData): Walkable {
  const room = buildRoom(data);
  const blocked = new Set(
    room.objects.filter((o) => o.state === undefined).flatMap(solidCells).map((p) => `${p.x},${p.y}`),
  );
  const canStand = (p: Pos): boolean => {
    const tile = room.map.tileAt(p);
    return (tile === 'floor' || tile === 'gate') && !blocked.has(`${p.x},${p.y}`);
  };
  return { canStand, starts: room.map.starts };
}

const STEPS: Readonly<Record<Dir, Pos>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};
const DIRS = Object.keys(STEPS) as Dir[];
const KEEP_GOING = 0.8; // 같은 방향으로 계속 걸을 확률 — 사람처럼 직선으로 걷다 가끔 꺾는다

/** 다음 자리 — 막히면 다른 방향, 사방이 막히면 제자리에서 방향만 바꾼다 (그래도 move 하나는 보낸다) */
export function nextStep(at: Spot, walk: Walkable, random: () => number = Math.random): Spot {
  const first: Dir = random() < KEEP_GOING ? at.dir : DIRS[Math.floor(random() * DIRS.length)] ?? 'down';
  const order = [first, ...DIRS.filter((d) => d !== first)];
  for (const dir of order) {
    const step = STEPS[dir];
    const to = { x: at.x + step.x, y: at.y + step.y };
    if (walk.canStand(to)) return { ...to, dir };
  }
  return { ...at, dir: DIRS[(DIRS.indexOf(at.dir) + 1) % DIRS.length] ?? 'down' };
}

/** 정렬된 배열의 p 백분위(0~100) — 비면 NaN */
export function percentile(sorted: readonly number[], p: number): number {
  if (sorted.length === 0) return Number.NaN;
  const i = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[i] ?? Number.NaN;
}
