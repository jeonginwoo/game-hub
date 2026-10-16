// 타일맵 — 문자 맵 해석은 로비·서버 공용 순수 모듈(server/src/room-map.ts)에 있고, 로비 world/ 는 여기서 받아 쓴다.
// 문자 한 글자 = 칸 하나(16px). 그림(32px 타일)은 크기 그대로 칸 TILE_CELLS × TILE_CELLS 에 걸쳐 그린다 (tiles.ts).
export { parseMap, type Door, type Pos, type Tile, type TileMap } from '../../../server/src/room-map';

/** 그림 타일(32px) 한 변의 칸 수 — 걷기·충돌은 칸, 그림 크기는 타일 그대로 (결정 2026-10-16: 칸 2배 밀도) */
export const TILE_CELLS = 2;
