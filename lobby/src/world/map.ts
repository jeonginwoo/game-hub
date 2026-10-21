// 타일맵 — 문자 맵 해석은 로비·서버 공용 순수 모듈(server/src/room-map.ts)에 있고, 로비 world/ 는 여기서 받아 쓴다.
// 문자 한 글자 = 칸 하나(16px). 그림(32px 타일)은 크기 그대로 칸 TILE_CELLS × TILE_CELLS 에 걸쳐 그린다 (tiles.ts).
import type { Pos, TileMap } from '../../../server/src/room-map';

export { parseMap, sameRoomData, type Door, type Pos, type Tile, type TileMap } from '../../../server/src/room-map';

/** 그림 타일(32px) 한 변의 칸 수 — 걷기·충돌은 칸, 그림 크기는 타일 그대로 (결정 2026-10-16: 칸 2배 밀도) */
export const TILE_CELLS = 2;

/**
 * 걷기 판정용 맵 — 닫힌 문(isOpenDoor 가 false)의 칸을 벽으로 본다. 열린 문은 그대로 문(밟으면 입장).
 * 문 번호·자리(doors·doorAt)는 원래 맵 그대로 (결정 2026-10-21: 문도 투명 — 닫힘은 벽, 열림은 바닥)
 */
export function withShutDoors(map: TileMap, isOpenDoor: (door: number) => boolean): TileMap {
  return {
    ...map,
    tileAt: (p) => {
      const door = map.doorAt(p);
      return door !== undefined && !isOpenDoor(door) ? 'wall' : map.tileAt(p);
    },
  };
}

/**
 * p 에서 가장 가까운(가로+세로 칸 수) 바닥 칸 — 같은 거리면 위→아래, 왼→오른 순 첫 칸. 바닥이 하나도 없으면 undefined.
 * 문 칸은 고르지 않는다 — 열린 문이면 서자마자 게임에 들어간다. 저장된 방에서 막힌 칸에 선 사람을 옮길 때 쓴다
 * (결정 2026-10-21: 저장식 편집 — 막힌 칸에 선 사람만 가장 가까운 빈 칸으로)
 */
export function nearestFloor(map: TileMap, p: Pos): Pos | undefined {
  let best: Pos | undefined;
  let bestDist = Infinity;
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const dist = Math.abs(x - p.x) + Math.abs(y - p.y);
      if (dist < bestDist && map.tileAt({ x, y }) === 'floor') {
        best = { x, y };
        bestDist = dist;
      }
    }
  }
  return best;
}
