// 타일 외형 — 배경 캔버스에 무엇을 찍을지 고른다. Three.js·DOM 과 무관한 순수 함수.
// 에셋: Ninja Adventure (CC0, docs/assets.md). 시트는 16×16 칸, (col, row) 는 왼쪽 위가 (0, 0).
// 문자 맵(#·.·D·S)은 문까지 그림이 없다 — 걷기·충돌·문·시작점 규칙만 담고, 그림은 모두 물체다
// (결정 2026-10-19: 문자 맵은 투명, 바닥은 물체 · 2026-10-21: 문도 투명). 그림 한 장(시트 한 칸)은 크기 그대로 칸 2×2 를 덮는다.

export const SHEET_PX = 16; // 시트 한 칸의 픽셀 크기 — 배경에는 TILE_PX(32) 크기로, 칸마다 그 한 조각씩 찍는다

export type Sheet = 'floor' | 'house' | 'nature';

export interface Cell {
  readonly sheet: Sheet;
  readonly col: number;
  readonly row: number;
}

/** 위치마다 고정된 값 — 새로고침해도 무늬가 같은 자리에 있게 */
function hash(x: number, y: number): number {
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
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
