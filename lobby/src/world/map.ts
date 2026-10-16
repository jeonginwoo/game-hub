// 타일맵 — 문자 맵 해석은 로비·서버 공용 순수 모듈(server/src/room-map.ts)에 있고, 로비 world/ 는 여기서 받아 쓴다.
// 문자 한 글자 = 칸 하나(16px). 그림(32px 타일)은 크기 그대로 칸 TILE_CELLS × TILE_CELLS 에 걸쳐 그린다 (tiles.ts).
import type { RoomData } from '../../../server/src/room-map';

export { parseMap, type Door, type Pos, type Tile, type TileMap } from '../../../server/src/room-map';

/** 그림 타일(32px) 한 변의 칸 수 — 걷기·충돌은 칸, 그림 크기는 타일 그대로 (결정 2026-10-16: 칸 2배 밀도) */
export const TILE_CELLS = 2;

/** 두 방 데이터가 같은가 — 맵 줄·물체·문 배정을 순서까지 비교한다 (서버가 보낸 방이 지금 그린 방인지) */
export function sameRoomData(a: RoomData, b: RoomData): boolean {
  return a.rows.length === b.rows.length && a.rows.every((r, i) => r === b.rows[i])
    && a.objects.length === b.objects.length
    && a.objects.every((o, i) => {
      const p = b.objects[i];
      return p !== undefined && o.id === p.id && o.kind === p.kind && o.x === p.x && o.y === p.y;
    })
    && a.doors.length === b.doors.length
    && a.doors.every((d, i) => {
      const e = b.doors[i];
      return e !== undefined && d.x === e.x && d.y === e.y && d.game === e.game;
    });
}
