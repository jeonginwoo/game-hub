// 타일 외형 — 맵의 칸마다 스프라이트 시트의 어느 칸을 그릴지 고른다. Three.js·DOM 과 무관한 순수 함수.
// 에셋: Ninja Adventure (CC0, docs/assets.md). 시트는 16×16 칸, (col, row) 는 왼쪽 위가 (0, 0).
// 맵 문자열(#·.·D·S)은 그대로 두고 주변 칸을 보고 외형을 정한다:
//   문이 있는 줄의 벽 = 건물 정면, 그 위 두 칸의 벽 = 지붕, 나머지 벽 = 풀밭 위 덤불.
// 그림 한 장(시트 한 칸)은 크기 그대로 칸 TILE_CELLS × TILE_CELLS 를 덮는다 — 칸마다 그 그림의 어느 조각(part)인지 함께 고른다.
// 조각은 32px 격자(맵 왼쪽 위 기준)에 맞추고, 문은 문의 왼쪽 위, 건물 정면·지붕은 그 줄 문의 위쪽 선에 맞춘다.
import { TILE_CELLS, type Pos, type TileMap } from './map';

export const SHEET_PX = 16; // 시트 한 칸의 픽셀 크기 — 배경에는 TILE_PX(32) 크기로, 칸마다 그 한 조각씩 찍는다

export type Sheet = 'floor' | 'house' | 'nature';

export interface Cell {
  readonly sheet: Sheet;
  readonly col: number;
  readonly row: number;
}

/**
 * base 는 칸 전체를 덮는 바닥층, over 는 그 위에 겹치는 투명 배경 스프라이트.
 * part 는 그 칸에 찍을 조각 — 시트 한 칸을 TILE_CELLS × TILE_CELLS 로 나눈 것 중 (x, y) 번째 (0 부터)
 */
export interface TileLook {
  readonly base: Cell;
  readonly over?: Cell;
  readonly part: Pos;
}

const GRASS: Cell = { sheet: 'floor', col: 0, row: 12 };
// 무늬 있는 풀 — 같은 칸만 반복되면 이동량이 눈에 안 들어온다
const GRASS_VARIANTS: readonly Cell[] = [1, 2, 3, 4].map((col) => ({ sheet: 'floor', col, row: 12 }));
const BUSH: Cell = { sheet: 'nature', col: 10, row: 9 };
const FACADE: Cell = { sheet: 'house', col: 2, row: 2 };
const ROOF_A: Cell = { sheet: 'house', col: 1, row: 1 }; // 지붕은 두 칸을 번갈아 — 기와 무늬가 이어지게
const ROOF_B: Cell = { sheet: 'house', col: 2, row: 1 };
const DOOR_OPEN: Cell = { sheet: 'house', col: 1, row: 2 }; // 게임이 배정된 문 — 열린 입구
const DOOR_SHUT: Cell = { sheet: 'house', col: 1, row: 3 }; // 배정 없는 문 — 창살 문

/** 위치마다 고정된 값 — 새로고침해도 풀 무늬가 같은 자리에 있게 */
function hash(x: number, y: number): number {
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
}

/** 0 ~ TILE_CELLS-1 로 — 음수도 */
function mod(n: number): number {
  return ((n % TILE_CELLS) + TILE_CELLS) % TILE_CELLS;
}

/** 그 줄을 지나는 문 중 가장 위쪽 선 — 문이 없는 줄이면 undefined */
function doorTopInRow(map: TileMap, y: number): number | undefined {
  let top: number | undefined;
  for (const d of map.doors) if (y >= d.y && y < d.y + d.h) top = Math.min(top ?? d.y, d.y);
  return top;
}

function isFacade(map: TileMap, p: Pos): boolean {
  return map.tileAt(p) === 'wall' && doorTopInRow(map, p.y) !== undefined;
}

function isBuilding(map: TileMap, p: Pos): boolean {
  return isFacade(map, p) || map.tileAt(p) === 'door';
}

/**
 * 칸 p 의 외형. isOpenDoor: 문 번호를 받아 그 문에 게임이 배정돼 있는지 — 열린 문과 닫힌 문을 겉모습으로 구분한다
 */
export function tileLook(map: TileMap, p: Pos, isOpenDoor: (door: number) => boolean): TileLook {
  const grid: Pos = { x: mod(p.x), y: mod(p.y) };
  const door = map.doorAt(p);
  if (door !== undefined) {
    const d = map.doors[door];
    const part = d ? { x: mod(p.x - d.x), y: mod(p.y - d.y) } : grid;
    return { base: isOpenDoor(door) ? DOOR_OPEN : DOOR_SHUT, part };
  }
  const tile = map.tileAt(p);
  if (tile === 'floor') {
    // 무늬는 32px 칸마다 하나 — 무늬 칸은 4/16, 더 많으면 지저분하다
    const h = hash(Math.floor(p.x / TILE_CELLS), Math.floor(p.y / TILE_CELLS)) % 16;
    return { base: GRASS_VARIANTS[h] ?? GRASS, part: grid };
  }
  const top = doorTopInRow(map, p.y);
  if (top !== undefined) return { base: FACADE, part: { x: grid.x, y: mod(p.y - top) } };
  // 지붕 — 바로 아래(1칸) 또는 그 아래(2칸)가 건물 정면·문이면. 아래 조각이 정면에 붙게
  for (let k = 1; k <= TILE_CELLS; k++) {
    if (!isBuilding(map, { x: p.x, y: p.y + k })) continue;
    const roof = Math.floor(p.x / TILE_CELLS) % 2 === 0 ? ROOF_A : ROOF_B;
    return { base: roof, part: { x: grid.x, y: TILE_CELLS - k } };
  }
  return { base: GRASS, over: BUSH, part: grid };
}
