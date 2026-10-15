import { describe, expect, it } from 'vitest';
import { drawZ } from '../src/layers';
import { LOBBY_OBJECTS } from '../src/lobby-objects';
import { LOBBY_ROWS } from '../src/lobby-map';
import { parseMap } from '../src/map';
import { checkObjects, objectRect, objectZ, type MapObject } from '../src/objects';

const tree: MapObject = { id: 'tree', layer: 'sorted', x: 4, y: 5, w: 2, h: 3, sprite: { sheet: 'nature', col: 0, row: 0 } };

describe('objectRect', () => {
  // 칸 중심이 정수 — 칸 4·5 를 덮으면 왼쪽 선 3.5, 오른쪽 선 5.5. 발은 칸 5 의 아래 선 5.5
  it('왼쪽 아래 칸에서 오른쪽·위로 뻗는다', () => {
    expect(objectRect(tree)).toEqual({ left: 3.5, top: 2.5, right: 5.5, bottom: 5.5 });
  });
});

describe('objectZ', () => {
  it('정렬 층 물체는 발 선으로 캐릭터와 앞뒤가 갈린다', () => {
    const behind = drawZ('sorted', 3.5); // 나무 위쪽 줄에 선 캐릭터
    const front = drawZ('sorted', 6.5); // 나무 아래쪽 줄에 선 캐릭터
    expect(objectZ(tree)).toBeGreaterThan(behind);
    expect(objectZ(tree)).toBeLessThan(front);
  });
});

describe('checkObjects', () => {
  const map = parseMap(['#####', '#S..#', '#####']);

  it('맵 안의 물체는 통과한다', () => {
    expect(() => checkObjects(map, [{ ...tree, x: 0, y: 2, w: 5, h: 3 }])).not.toThrow();
  });

  it('맵 밖으로 나가면 거부한다', () => {
    expect(() => checkObjects(map, [{ ...tree, x: 1, y: 1, w: 1, h: 3 }])).toThrow(/맵 밖/);
    expect(() => checkObjects(map, [{ ...tree, x: 4, y: 1, w: 2, h: 1 }])).toThrow(/맵 밖/);
  });

  it('id 가 겹치면 거부한다', () => {
    const o = { ...tree, x: 1, y: 1, w: 1, h: 1 };
    expect(() => checkObjects(map, [o, o])).toThrow(/겹친다/);
  });

  it('크기가 0 이하면 거부한다', () => {
    expect(() => checkObjects(map, [{ ...tree, x: 1, y: 1, w: 0, h: 1 }])).toThrow(/크기/);
  });
});

describe('실제 로비 물체', () => {
  it('로비 맵 안에 있고 id 가 겹치지 않는다', () => {
    expect(() => checkObjects(parseMap(LOBBY_ROWS), LOBBY_OBJECTS)).not.toThrow();
  });

  it('정렬 층 물체는 지나갈 수 없는 칸에 서 있다 — 캐릭터가 물체 안으로 걸어 들어가지 않게', () => {
    const map = parseMap(LOBBY_ROWS);
    for (const o of LOBBY_OBJECTS.filter((x) => x.layer === 'sorted')) {
      for (let dx = 0; dx < o.w; dx++) expect(map.tileAt({ x: o.x + dx, y: o.y })).toBe('wall');
    }
  });
});
