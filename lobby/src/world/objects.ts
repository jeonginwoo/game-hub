// 맵 위 물체 — 배경 그림과 따로 그려지는 것(나무·마당·도리이 등)의 층과 그림. 순수 데이터 + 걷기 판정.
// 자리·모양·검사는 로비·서버 공용(server/src/room-map.ts), 그림(시트 칸·층)만 로비 몫이다.
// 충돌은 두 가지 — 문자 맵의 '#'(맵 자체)와, 물체마다 정한 solid 칸(나무 밑둥 등). 그림 크기와는 별개다.
import { footCell, objectRect, solidCells, type ObjectState, type PlacedShape } from '../../../server/src/room-map';
import { drawZ, type Layer } from './layers';
import type { TileMap } from './map';
import type { Cell } from './tiles';

export { objectRect, solidCells, type ObjectState, type Rect } from '../../../server/src/room-map';

export type ObjectLayer = Extract<Layer, 'floor' | 'sorted' | 'top'>;

/** 물체 종류의 그림 — 방 데이터에는 없고 로비가 종류별로 붙인다 */
export interface ObjectArt {
  readonly layer: ObjectLayer;
  /** 타일 시트에서 이 칸을 왼쪽 위로 w×h 칸 넓이를 잘라 쓴다 (시트 한 칸 = 타일 하나 = TILE_CELLS × TILE_CELLS 칸) */
  readonly sprite: Cell;
  /** 채움 — 있으면 sprite 를 잘라 키우지 않고 시트 칸 하나씩 물체 넓이만큼 되풀이한다. 첫 칸이 바탕, 나머지는 가끔 섞는 무늬 */
  readonly fill?: readonly Cell[];
}

export interface MapObject extends PlacedShape, ObjectArt {}

export function objectZ(o: MapObject): number {
  return drawZ(o.layer, objectRect(o).bottom);
}

/** 걷기 판정용 맵 — 물체의 solid 칸을 벽으로 본다. 그림(배경 타일)은 원래 맵으로 그린다 */
export function withSolidObjects(map: TileMap, objects: readonly PlacedShape[]): TileMap {
  const blocked = new Set(objects.flatMap(solidCells).map((p) => `${p.x},${p.y}`));
  return {
    ...map,
    tileAt: (p) => (blocked.has(`${p.x},${p.y}`) ? 'wall' : map.tileAt(p)),
  };
}

/**
 * 지금 보이는 물체 — 상태 꼬리표가 없으면 늘 보이고, 있으면 가운데 발 칸(footCell)의 문(게이트 칸이면 딸린 문) 상태(doorState)와 같을 때만.
 * 평소엔 문마다 열림(게임 배정)·닫힘, 편집 중엔 토글 하나를 모든 문에. 그리기·막는 칸·지우개는 이것만 본다
 * (결정 2026-10-21: 편집 개편 D — 상태 꼬리표 물체는 그 문을 따른다)
 */
export function visibleObjects<T extends PlacedShape>(objects: readonly T[], map: TileMap, doorState: (door: number) => ObjectState): T[] {
  return objects.filter((o) => {
    if (o.state === undefined) return true;
    const door = map.doorOf(footCell(o));
    return door !== undefined && doorState(door) === o.state;
  });
}
