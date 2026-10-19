import { describe, expect, it } from 'vitest';
import { buildRoom, type RoomObject } from '../../../server/src/room-map';
import { DEFAULT_ROOM } from '../../../server/src/room-templates';
import { OBJECT_ART } from '../../src/data/object-art';
import { canPlace, placeAt, topObjectAt } from '../../src/edit/place';
import type { MapObject } from '../../src/world/objects';

/** 방 데이터 물체 → 로비가 그리는 물체 (main.ts buildWorld 와 같은 합치기) */
function drawn(objects: readonly RoomObject[]): readonly MapObject[] {
  return buildRoom({ ...DEFAULT_ROOM, objects }).objects.map((o) => ({ ...o, ...OBJECT_ART[o.kind] }));
}

describe('placeAt', () => {
  it('포인터 칸이 물체 아래쪽 가운데 — 짝수 폭은 가운데 두 칸 중 오른쪽', () => {
    expect(placeAt('tree', { x: 10, y: 20 })).toEqual({ x: 8, y: 20 }); // 4칸 폭
    expect(placeAt('sunflower', { x: 10, y: 20 })).toEqual({ x: 9, y: 20 }); // 2칸 폭
    expect(placeAt('yard', { x: 10, y: 20 })).toEqual({ x: 7, y: 20 }); // 6칸 폭
  });
});

describe('canPlace (광장)', () => {
  it('빈 바닥이면 놓을 수 있다', () => {
    expect(canPlace(DEFAULT_ROOM, 'tree', { x: 60, y: 30 })).toBe(true);
  });

  it('다른 물체의 막는 칸과 겹치면 안 된다 — 그림만 겹치는 것은 괜찮다', () => {
    // 왼쪽 나무 줄 첫 그루(4, 23)의 밑둥은 (5, 23)·(6, 23). 바닥 채움 위는 그림만 겹친다
    expect(canPlace(DEFAULT_ROOM, 'tree', { x: 4, y: 23 })).toBe(false);
    expect(canPlace(DEFAULT_ROOM, 'tree', { x: 4, y: 22 })).toBe(true);
  });

  it('시작점을 막거나 맵을 벗어나면 안 된다', () => {
    // 밑둥이 시작점 (38, 48) 에 걸린다
    expect(canPlace(DEFAULT_ROOM, 'tree', { x: 37, y: 48 })).toBe(false);
    expect(canPlace(DEFAULT_ROOM, 'tree', { x: -1, y: 30 })).toBe(false);
    expect(canPlace(DEFAULT_ROOM, 'tree', { x: 30, y: 2 })).toBe(false); // 위로 뻗어 맵 밖
  });
});

describe('topObjectAt', () => {
  const yard: RoomObject = { id: 'yard', kind: 'yard', x: 18, y: 9 }; // 바닥 층, 18~23 × 4~9
  const tree: RoomObject = { id: 't1', kind: 'tree', x: 19, y: 9 }; // 정렬 층, 19~22 × 6~9 — 마당 위

  it('그림 영역이 덮는 물체 — 없으면 undefined', () => {
    const objs = drawn([yard]);
    expect(topObjectAt(objs, { x: 18, y: 4 })?.id).toBe('yard');
    expect(topObjectAt(objs, { x: 24, y: 9 })).toBeUndefined();
    expect(topObjectAt(objs, { x: 18, y: 10 })).toBeUndefined();
  });

  it('겹치면 앞에 그려진 층 — 바닥 층 마당보다 정렬 층 나무', () => {
    const objs = drawn([tree, yard]);
    expect(topObjectAt(objs, { x: 20, y: 8 })?.id).toBe('t1');
    expect(topObjectAt(objs, { x: 18, y: 8 })?.id).toBe('yard');
  });

  it('정렬 층은 발이 아래인 것이 앞, 같으면 목록 뒤쪽', () => {
    const front: RoomObject = { id: 't2', kind: 'tree', x: 19, y: 11 }; // 2칸 아래 — 8~11
    expect(topObjectAt(drawn([front, tree]), { x: 20, y: 8 })?.id).toBe('t2');
    // 같은 z — 바닥 층은 층 안에서 모두 같은 깊이
    const yard2: RoomObject = { id: 'yard2', kind: 'yard', x: 20, y: 9 };
    expect(topObjectAt(drawn([yard, yard2]), { x: 21, y: 6 })?.id).toBe('yard2');
    expect(topObjectAt(drawn([yard2, yard]), { x: 21, y: 6 })?.id).toBe('yard');
  });
});
