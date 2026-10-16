// 타일 외형 — 맵의 칸마다 스프라이트 시트의 어느 칸을 그릴지 고른다. Three.js·DOM 과 무관한 순수 함수.
// 에셋: Ninja Adventure (CC0, docs/assets.md). 시트는 16×16 칸, (col, row) 는 왼쪽 위가 (0, 0).
// 맵 문자열(#·.·D·S)은 그대로 두고 주변 타일을 보고 외형을 정한다:
//   문이 있는 줄의 벽 = 건물 정면, 그 위의 벽 = 지붕, 나머지 벽 = 풀밭 위 덤불.
// 외형은 타일(문자 한 글자) 단위 — 좌표도 타일 좌표다. 맵은 칸 단위라 타일의 왼쪽 위 칸으로 읽는다.
import type { Pos, Tile, TileMap } from './map';

export const SHEET_PX = 16; // 시트 한 칸의 픽셀 크기 — 배경 캔버스에는 TILE_PX 로 키워 찍는다

export type Sheet = 'floor' | 'house' | 'nature';

export interface Cell {
  readonly sheet: Sheet;
  readonly col: number;
  readonly row: number;
}

/** base 는 칸 전체를 덮는 바닥층, over 는 그 위에 겹치는 투명 배경 스프라이트 */
export interface TileLook {
  readonly base: Cell;
  readonly over?: Cell;
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

/** 타일 좌표 → 그 타일의 왼쪽 위 칸 */
function corner(map: TileMap, t: Pos): Pos {
  return { x: t.x * map.tileCells, y: t.y * map.tileCells };
}

function tileAt(map: TileMap, t: Pos): Tile {
  return map.tileAt(corner(map, t));
}

function hasDoorInRow(map: TileMap, ty: number): boolean {
  return map.doors.some((d) => d.y === ty * map.tileCells);
}

function isFacade(map: TileMap, t: Pos): boolean {
  return tileAt(map, t) === 'wall' && hasDoorInRow(map, t.y);
}

/**
 * 타일 t(타일 좌표)의 외형. isOpenDoor: 문의 왼쪽 위 칸을 받아 그 문에 게임이 배정돼 있는지 —
 * 열린 문과 닫힌 문을 겉모습으로 구분한다
 */
export function tileLook(map: TileMap, t: Pos, isOpenDoor: (door: Pos) => boolean): TileLook {
  const tile = tileAt(map, t);
  if (tile === 'door') return { base: isOpenDoor(corner(map, t)) ? DOOR_OPEN : DOOR_SHUT };
  if (tile === 'floor') {
    const h = hash(t.x, t.y) % 16; // 무늬 타일은 4/16 — 더 많으면 지저분하다
    return { base: GRASS_VARIANTS[h] ?? GRASS };
  }
  if (isFacade(map, t)) return { base: FACADE };
  const below = { x: t.x, y: t.y + 1 };
  if (isFacade(map, below) || tileAt(map, below) === 'door') return { base: t.x % 2 === 0 ? ROOF_A : ROOF_B };
  return { base: GRASS, over: BUSH };
}
