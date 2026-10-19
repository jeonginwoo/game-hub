// 타일 외형 — 배경 캔버스에 무엇을 찍을지 고른다. Three.js·DOM 과 무관한 순수 함수.
// 에셋: Ninja Adventure (CC0, docs/assets.md). 시트는 16×16 칸, (col, row) 는 왼쪽 위가 (0, 0).
// 문자 맵(#·.·D·S)은 그림이 없다 — 걷기·충돌·문·시작점 규칙만 담고, 바닥·벽·건물 그림은 모두 물체다.
// 문만 그린다: 게임이 배정됐는지(열린 입구/창살 문)가 겉모습으로 보여야 하므로 (결정 2026-10-19: 문자 맵은 투명, 바닥은 물체).
// 그림 한 장(시트 한 칸)은 크기 그대로 칸 TILE_CELLS × TILE_CELLS 를 덮는다 — 칸마다 그 그림의 어느 조각(part)인지 함께 고른다.
import { TILE_CELLS, type Pos, type TileMap } from './map';

export const SHEET_PX = 16; // 시트 한 칸의 픽셀 크기 — 배경에는 TILE_PX(32) 크기로, 칸마다 그 한 조각씩 찍는다

export type Sheet = 'floor' | 'house' | 'nature';

export interface Cell {
  readonly sheet: Sheet;
  readonly col: number;
  readonly row: number;
}

/** 칸 하나에 찍을 그림 — 시트 칸 base 를 TILE_CELLS × TILE_CELLS 로 나눈 것 중 (x, y) 번째 조각(part, 0 부터) */
export interface TileLook {
  readonly base: Cell;
  readonly part: Pos;
}

const DOOR_OPEN: Cell = { sheet: 'house', col: 1, row: 2 }; // 게임이 배정된 문 — 열린 입구
const DOOR_SHUT: Cell = { sheet: 'house', col: 1, row: 3 }; // 배정 없는 문 — 창살 문

/** 위치마다 고정된 값 — 새로고침해도 무늬가 같은 자리에 있게 */
function hash(x: number, y: number): number {
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
}

/** 0 ~ TILE_CELLS-1 로 — 음수도 */
function mod(n: number): number {
  return ((n % TILE_CELLS) + TILE_CELLS) % TILE_CELLS;
}

/**
 * 칸 p 의 그림 — 문 칸만 있고 나머지(벽·바닥·시작점)는 undefined(투명).
 * isOpenDoor: 문 번호를 받아 그 문에 게임이 배정돼 있는지. 문 조각은 문의 왼쪽 위에 맞춘다 — 홀수 칸에서 시작해도 쪼개지지 않게
 */
export function tileLook(map: TileMap, p: Pos, isOpenDoor: (door: number) => boolean): TileLook | undefined {
  const door = map.doorAt(p);
  if (door === undefined) return undefined;
  const d = map.doors[door];
  const part = d ? { x: mod(p.x - d.x), y: mod(p.y - d.y) } : { x: mod(p.x), y: mod(p.y) };
  return { base: isOpenDoor(door) ? DOOR_OPEN : DOOR_SHUT, part };
}

/**
 * 채움 물체의 타일 하나에 찍을 시트 칸 — cells[0] 이 바탕, 나머지는 무늬. (tx, ty) 는 맵 기준 타일(32px) 자리라
 * 같은 자리는 늘 같은 무늬이고, 채움을 겹쳐 깔아도 이음매가 생기지 않는다. 무늬 칸은 4/16 — 더 많으면 지저분하다
 */
export function fillCell(cells: readonly Cell[], tx: number, ty: number): Cell | undefined {
  const variants = cells.length - 1;
  if (variants <= 0) return cells[0];
  const h = hash(tx, ty) % 16;
  return h < 4 ? cells[1 + (h % variants)] : cells[0];
}
