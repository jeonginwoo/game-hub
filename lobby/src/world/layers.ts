// ZEP 식 그리기 층과 픽셀 규격 — 무엇이 무엇 위에 그려지는지는 여기 한 곳에서 정한다. 순수.
// 층: 배경 한 장 → 바닥 물체 → 정렬 층(물체·캐릭터를 발 y 로 앞뒤 정렬) → 상단 물체 → 앞화면.

import { TILE_CELLS } from './map';

export type Layer = 'background' | 'floor' | 'sorted' | 'top' | 'foreground';

export const CELL_PX = 16; // 한 칸(걷기·충돌·월드 좌표 1)의 픽셀 크기
export const TILE_PX = CELL_PX * TILE_CELLS; // 타일(문자 맵 한 글자·배경 그림 한 장)의 픽셀 크기 — 32 (ZEP 타일)
export const AVATAR_PX: { readonly w: number; readonly h: number } = { w: 48, h: 64 }; // 캐릭터 한 프레임 — 가로 3칸·세로 4칸, 발이 칸 아래 가운데

const LAYER_BASE: Readonly<Record<Layer, number>> = {
  background: 0,
  floor: 1,
  sorted: 2,
  top: 3,
  foreground: 4,
};

// 정렬 층 안에서 발 y 1칸당 올라가는 z — MAX_SORT_Y 에서도 +0.5 라 상단 물체 층(+1)에 닿지 않는다
const SORT_STEP = 0.0005;
export const MAX_SORT_Y = 1000; // 칸

/**
 * 그릴 깊이(z, 클수록 앞). `footY` 는 발이 닿은 가로선의 칸 y — 칸 y 에 선 것은 `y + 0.5`.
 * 정렬 층만 footY 를 쓰고, 나머지 층은 층 안에서 모두 같은 깊이다.
 */
export function drawZ(layer: Layer, footY = 0): number {
  if (layer !== 'sorted') return LAYER_BASE[layer];
  if (footY < 0 || footY > MAX_SORT_Y) throw new Error(`정렬 층 발 y 는 0~${MAX_SORT_Y} — ${footY}`);
  return LAYER_BASE.sorted + footY * SORT_STEP;
}
