// 쯔꾸르식 칸 단위 이동 판정 — 한 번에 한 칸(대각선 포함), 벽이면 제자리에서 방향만 바꾼다.
import type { Pos, TileMap } from './map';

export type Dir = 'up' | 'down' | 'left' | 'right';

export const DIR_DELTA: Readonly<Record<Dir, Pos>> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export interface StepResult {
  readonly pos: Pos;
  readonly facing: Dir;
  readonly moved: boolean;
}

export function step(map: TileMap, from: Pos, dir: Dir): StepResult {
  const d = DIR_DELTA[dir];
  const to = { x: from.x + d.x, y: from.y + d.y };
  if (map.tileAt(to) === 'wall') return { pos: { ...from }, facing: dir, moved: false };
  return { pos: to, facing: dir, moved: true };
}

/** 누르고 있는 방향들(먼저 누른 것부터) 중 가장 나중의 가로·세로 키 */
function latestPerAxis(held: readonly Dir[]): { readonly h: Dir | undefined; readonly v: Dir | undefined } {
  let h: Dir | undefined;
  let v: Dir | undefined;
  for (const d of held) {
    if (DIR_DELTA[d].x !== 0) h = d;
    else v = d;
  }
  return { h, v };
}

/**
 * 캐릭터가 볼 방향 — 모습은 4방향이라, 가로 키가 하나라도 눌려 있으면 가장 나중의 가로 키(대각선이면 좌우로 보인다),
 * 없으면 가장 나중의 세로 키. 아무것도 없으면 undefined
 */
export function facingOf(held: readonly Dir[]): Dir | undefined {
  const { h, v } = latestPerAxis(held);
  return h ?? v;
}

/**
 * 누르고 있는 방향들(먼저 누른 것부터)로 한 칸. 가로·세로를 하나씩 같이 누르면 대각선.
 * 대각선은 모서리를 질러가지 않는다 — 옆 두 칸 중 하나라도 벽이면 나중에 누른 축, 그다음 다른 축으로 미끄러진다.
 * 보는 방향은 어느 쪽으로 가든 facingOf(held)
 */
export function stepHeld(map: TileMap, from: Pos, held: readonly Dir[]): StepResult | null {
  const last = held[held.length - 1];
  const facing = facingOf(held);
  if (!last || !facing) return null;
  const { h, v } = latestPerAxis(held);
  if (!h || !v) return { ...step(map, from, last), facing };
  const dx = DIR_DELTA[h].x;
  const dy = DIR_DELTA[v].y;
  const free = (x: number, y: number): boolean => map.tileAt({ x, y }) !== 'wall';
  if (free(from.x + dx, from.y + dy) && free(from.x + dx, from.y) && free(from.x, from.y + dy)) {
    return { pos: { x: from.x + dx, y: from.y + dy }, facing, moved: true };
  }
  const other = last === h ? v : h;
  const first = step(map, from, last);
  const r = first.moved ? first : step(map, from, other);
  return { pos: r.pos, facing, moved: r.moved };
}

/**
 * 걷는 중(from → to)에 새로 누른 방향이 이 걸음을 되돌리는지 — 곧게 걷는 중 정반대 키일 때만.
 * 그 밖의 키(같은 쪽 연타, 다른 축, 대각선 걸음 중 한 축만 반대)는 기억하지 않는다 —
 * 이 칸을 다 간 뒤 그때 누르고 있는 키로 다음 걸음을 정한다.
 */
export function reversesWalk(from: Pos, to: Pos, dir: Dir): boolean {
  const d = DIR_DELTA[dir];
  return d.x === -(to.x - from.x) && d.y === -(to.y - from.y);
}
