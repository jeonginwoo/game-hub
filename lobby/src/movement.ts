// 쯔꾸르식 칸 단위 이동 판정 — 한 번에 한 칸, 벽이면 제자리에서 방향만 바꾼다.
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
