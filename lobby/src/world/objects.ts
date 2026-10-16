// 맵 위 물체 — 배경 그림과 따로 그려지는 것(나무·마당·도리이 등)의 자리와 층. 순수 데이터 + 검사.
// 충돌은 두 가지 — 문자 맵의 '#'(맵 자체)와, 물체마다 정한 solid 칸(나무 밑둥 등). 그림 크기와는 별개다.
import { drawZ, type Layer } from './layers';
import type { Pos, TileMap } from './map';
import type { Cell } from './tiles';

export type ObjectLayer = Extract<Layer, 'floor' | 'sorted' | 'top'>;

export interface MapObject {
  readonly id: string;
  readonly layer: ObjectLayer;
  /** 왼쪽 아래 칸 — 물체는 여기서 오른쪽(w)·위쪽(h)으로 뻗는다. 발은 이 칸의 아래 선 */
  readonly x: number;
  readonly y: number;
  /** 칸 단위 크기 */
  readonly w: number;
  readonly h: number;
  /** 그림 — 타일 시트에서 이 칸을 왼쪽 위로 w×h 칸 넓이를 잘라 쓴다 (시트 한 칸 = 타일 하나 = TILE_CELLS × TILE_CELLS 칸) */
  readonly sprite: Cell;
  /**
   * 지나갈 수 없는 칸들 — 물체의 왼쪽 아래 칸 기준 (x 는 오른쪽, y 는 위쪽으로 0 부터). 예: 4칸 폭 나무의 밑둥 [{1,0},{2,0}],
   * 6칸 폭 도리이의 두 기둥 [{1,0},{4,0}]. 그림의 실제 모양에 칸 단위로 맞춘다. 없으면 그림만 있고 지나갈 수 있다
   */
  readonly solid?: readonly Pos[];
}

/** 칸 좌표의 가장자리 — 칸 중심이 정수라 칸 x 의 왼쪽 선은 x - 0.5 */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function objectRect(o: MapObject): Rect {
  const bottom = o.y + 0.5;
  const left = o.x - 0.5;
  return { left, top: bottom - o.h, right: left + o.w, bottom };
}

export function objectZ(o: MapObject): number {
  return drawZ(o.layer, objectRect(o).bottom);
}

/** 물체가 막는 칸들 */
export function solidCells(o: MapObject): Pos[] {
  return (o.solid ?? []).map((c) => ({ x: o.x + c.x, y: o.y - c.y }));
}

/** 걷기 판정용 맵 — 물체의 solid 칸을 벽으로 본다. 그림(배경 타일)은 원래 맵으로 그린다 */
export function withSolidObjects(map: TileMap, objects: readonly MapObject[]): TileMap {
  const blocked = new Set(objects.flatMap(solidCells).map((p) => `${p.x},${p.y}`));
  return {
    ...map,
    tileAt: (p) => (blocked.has(`${p.x},${p.y}`) ? 'wall' : map.tileAt(p)),
  };
}

/** 물체 목록 검사 — id 중복, 크기 0 이하, 맵 밖으로 나간 물체, 물체를 벗어나거나 문·시작점을 막는 solid 를 거부한다 */
export function checkObjects(map: TileMap, objects: readonly MapObject[]): void {
  const seen = new Set<string>();
  for (const o of objects) {
    if (seen.has(o.id)) throw new Error(`물체 id '${o.id}' 가 겹친다`);
    seen.add(o.id);
    if (o.w <= 0 || o.h <= 0) throw new Error(`물체 '${o.id}' 크기 ${o.w}×${o.h} — 0 보다 커야 한다`);
    const r = objectRect(o);
    if (r.left < -0.5 || r.top < -0.5 || r.right > map.width - 0.5 || r.bottom > map.height - 0.5) {
      throw new Error(`물체 '${o.id}' 가 맵 밖으로 나간다 — (${o.x}, ${o.y}) ${o.w}×${o.h}`);
    }
    for (const c of o.solid ?? []) {
      if (c.x < 0 || c.y < 0 || c.x >= o.w || c.y >= o.h) {
        throw new Error(`물체 '${o.id}' 의 solid 칸 (${c.x}, ${c.y}) — 물체 ${o.w}×${o.h} 안이어야 한다`);
      }
    }
    for (const p of solidCells(o)) {
      const isStart = map.starts.some((s) => s.x === p.x && s.y === p.y);
      if (map.tileAt(p) === 'door' || isStart) throw new Error(`물체 '${o.id}' 가 (${p.x}, ${p.y}) 의 문·시작점을 막는다`);
    }
  }
}
