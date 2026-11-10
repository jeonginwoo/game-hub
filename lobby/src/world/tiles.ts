// 타일 외형 — 배경 캔버스에 무엇을 찍을지 고른다. Three.js·DOM 과 무관한 순수 함수.
// 에셋: Ninja Adventure (CC0, docs/assets.md). 시트는 16×16 칸, (col, row) 는 왼쪽 위가 (0, 0).
// 문자 맵(#·.·D·S)은 문까지 그림이 없다 — 걷기·충돌·문·시작점 규칙만 담고, 그림은 모두 물체다
// (결정 2026-10-19: 문자 맵은 투명, 바닥은 물체 · 2026-10-21: 문도 투명). 그림 한 장(시트 한 칸)은 크기 그대로 칸 2×2 를 덮는다.

import { groundTiles, pickVariant } from '../../../server/src/ground';

export const SHEET_PX = 16; // 시트 한 칸의 픽셀 크기 — 배경에는 TILE_PX(32) 크기로, 칸마다 그 한 조각씩 찍는다

export type Sheet = 'floor' | 'house' | 'nature';

export interface Cell {
  readonly sheet: Sheet;
  readonly col: number;
  readonly row: number;
}

/**
 * 채움 물체의 타일 하나에 찍을 시트 칸 — cells[0] 이 바탕, 나머지는 무늬. (tx, ty) 는 맵 기준 타일(32px) 자리라
 * 같은 자리는 늘 같은 무늬이고, 채움을 겹쳐 깔아도 이음매가 생기지 않는다. 고르는 규칙은 바닥 재질과 같다(ground.ts)
 */
export function fillCell(cells: readonly Cell[], tx: number, ty: number): Cell | undefined {
  return pickVariant(cells, tx, ty);
}

/** 배경에 먼저 굽는 재질 타일 하나 — 맵 기준 타일(32px) 자리와 찍을 Floor 시트 칸 */
export interface GroundArt {
  readonly tx: number;
  readonly ty: number;
  readonly cell: Cell;
}

/** 방의 재질 맵 → 타일마다 찍을 그림. 고르는 규칙(길 가장자리 autotile·무늬)은 ground.ts, 재질 없는 타일은 빠진다 */
export function groundArt(ground: readonly string[]): GroundArt[] {
  return groundTiles(ground).map(({ tx, ty, col, row }) => ({ tx, ty, cell: { sheet: 'floor', col, row } }));
}
