// 타일 외형 — 맵의 칸마다 스프라이트 시트의 어느 칸을 그릴지 고른다. Three.js 와 무관한 순수 함수.
// 에셋: Mage City Arcanos (Hyptosis, CC0, docs/assets.md). 시트는 32×32 칸, (col, row) 는 왼쪽 위가 (0, 0).
// 맵 문자열(#·.·D·S)은 그대로 두고 주변 칸을 보고 외형을 정한다:
//   문이 있는 줄의 벽 = 건물 정면, 그 위의 벽 = 지붕, 나머지 벽 = 덤불.
import type { Pos, TileMap } from './map';

export const CELL_PX = 32;

export type Sheet = 'city';

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

const cell = (col: number, row: number): Cell => ({ sheet: 'city', col, row });

const FLAGSTONE = cell(1, 0); // 밝은 판석
const FLAGSTONE_GRASS = cell(1, 1); // 틈에 풀 난 판석 — 같은 칸만 반복되면 이동량이 눈에 안 들어온다
const HEDGE = cell(0, 0); // 빽빽한 잎
const FACADE = cell(5, 27); // 회색 벽돌
const ROOF = cell(1, 24); // 갈색 지붕 판자
const DOOR_OPEN = cell(6, 40); // 게임이 배정된 문 — 어두운 입구
const DOOR_SHUT = cell(2, 37); // 배정 없는 문 — 닫힌 나무판

/** 위치마다 고정된 값 — 새로고침해도 무늬가 같은 자리에 있게 */
function hash(x: number, y: number): number {
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
}

function hasDoorInRow(map: TileMap, y: number): boolean {
  return map.doors.some((d) => d.y === y);
}

function isFacade(map: TileMap, p: Pos): boolean {
  return map.tileAt(p) === 'wall' && hasDoorInRow(map, p.y);
}

/** isOpenDoor: 그 문에 게임이 배정돼 있는지 — 열린 문과 닫힌 문을 겉모습으로 구분한다 */
export function tileLook(map: TileMap, p: Pos, isOpenDoor: (p: Pos) => boolean): TileLook {
  const tile = map.tileAt(p);
  if (tile === 'door') return { base: isOpenDoor(p) ? DOOR_OPEN : DOOR_SHUT };
  if (tile === 'floor') return { base: hash(p.x, p.y) % 7 === 0 ? FLAGSTONE_GRASS : FLAGSTONE };
  if (isFacade(map, p)) return { base: FACADE };
  const below = { x: p.x, y: p.y + 1 };
  if (isFacade(map, below) || map.tileAt(below) === 'door') return { base: ROOF };
  return { base: HEDGE };
}

/**
 * 시트 안 칸의 UV 사각형 (텍스처 flipY 기본값 기준: v=0 이 이미지 아래).
 * 칸 경계에서 이웃 칸 픽셀이 새어 나오지 않게 아주 조금 안쪽으로 줄인다.
 */
export function cellUv(
  col: number,
  row: number,
  sheetW: number,
  sheetH: number,
): { u0: number; u1: number; vTop: number; vBottom: number } {
  const inset = 0.01;
  return {
    u0: (col * CELL_PX + inset) / sheetW,
    u1: ((col + 1) * CELL_PX - inset) / sheetW,
    vTop: 1 - (row * CELL_PX + inset) / sheetH,
    vBottom: 1 - ((row + 1) * CELL_PX - inset) / sheetH,
  };
}
