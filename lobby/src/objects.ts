// 맵 위 물체 — 배경 그림과 따로 그려지는 것(나무·마당·도리이 등)의 자리와 층. 순수 데이터 + 검사.
// 그림일 뿐 충돌은 없다 — 지나갈 수 없는 칸은 문자 맵의 '#' 가 정한다 (ZEP 의 통과 불가 타일처럼 그림과 별개).
import { drawZ, type Layer } from './layers';
import type { TileMap } from './map';
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
  /** 그림 — 타일 시트에서 이 칸을 왼쪽 위로 w×h 칸을 잘라 쓴다 */
  readonly sprite: Cell;
}

/** 타일 좌표의 가장자리 — 칸 중심이 정수라 칸 x 의 왼쪽 선은 x - 0.5 */
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

/** 물체 목록 검사 — id 중복, 크기 0 이하, 맵 밖으로 나간 물체를 거부한다 */
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
  }
}
