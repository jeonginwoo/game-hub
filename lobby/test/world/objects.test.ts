import { describe, expect, it } from 'vitest';
import { drawZ } from '../../src/world/layers';
import { LOBBY_OBJECTS } from '../../src/data/lobby-objects';
import { LOBBY_ROWS } from '../../src/data/lobby-map';
import { parseMap } from '../../src/world/map';
import { checkObjects, objectRect, objectZ, solidCells, withSolidObjects, type MapObject } from '../../src/world/objects';

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

  it('solid 가 물체를 벗어나거나 시작점·문을 막으면 거부한다', () => {
    const small = { ...tree, x: 2, y: 1, w: 1, h: 1 };
    expect(() => checkObjects(map, [{ ...small, solid: [{ x: 1, y: 0 }] }])).toThrow(/solid/);
    expect(() => checkObjects(map, [{ ...small, solid: [{ x: 0, y: -1 }] }])).toThrow(/solid/);
    expect(() => checkObjects(map, [{ ...small, x: 1, solid: [{ x: 0, y: 0 }] }])).toThrow(/시작점/);
    expect(() => checkObjects(map, [{ ...small, solid: [{ x: 0, y: 0 }] }])).not.toThrow();
  });
});

describe('solidCells · withSolidObjects', () => {
  const map = parseMap(['#####', '#S..#', '#...#', '#####']);
  const post: MapObject = { ...tree, x: 2, y: 2, w: 2, h: 2, solid: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };

  it('solid 는 왼쪽 아래 칸 기준 — x 는 오른쪽, y 는 위쪽', () => {
    expect(solidCells(post)).toEqual([{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(solidCells({ ...post, solid: [{ x: 1, y: 1 }] })).toEqual([{ x: 3, y: 1 }]);
    expect(solidCells({ ...post, solid: undefined })).toEqual([]);
  });

  it('solid 칸만 벽이 되고, 그림만 있는 칸과 원래 맵은 그대로', () => {
    const walk = withSolidObjects(map, [post]);
    expect(walk.tileAt({ x: 2, y: 2 })).toBe('wall');
    expect(walk.tileAt({ x: 3, y: 2 })).toBe('wall');
    expect(walk.tileAt({ x: 2, y: 1 })).toBe('floor'); // 물체 윗줄 — 그림 뒤로 지나간다
    expect(walk.tileAt({ x: 0, y: 0 })).toBe('wall');
    expect(map.tileAt({ x: 2, y: 2 })).toBe('floor');
  });
});

describe('실제 로비 물체', () => {
  it('로비 맵 안에 있고 id 가 겹치지 않는다', () => {
    expect(() => checkObjects(parseMap(LOBBY_ROWS), LOBBY_OBJECTS)).not.toThrow();
  });

  it('나무는 밑둥 두 칸만 막히고, 도리이는 두 기둥 칸만 막혀 기둥 사이로 지나간다', () => {
    const walk = withSolidObjects(parseMap(LOBBY_ROWS), LOBBY_OBJECTS);
    for (const id of ['tree-left', 'tree-right']) {
      const o = LOBBY_OBJECTS.find((x) => x.id === id);
      expect(o).toBeDefined();
      if (!o) continue;
      const row = [0, 1, 2, 3].map((dx) => walk.tileAt({ x: o.x + dx, y: o.y }));
      expect(row).toEqual(['floor', 'wall', 'wall', 'floor']); // 잎 끝 아래는 지나간다
      expect(walk.tileAt({ x: o.x + 1, y: o.y - 1 })).toBe('floor'); // 잎 뒤로 지나간다
    }
    const torii = LOBBY_OBJECTS.find((x) => x.id === 'torii');
    expect(torii?.layer).toBe('sorted');
    if (!torii) return;
    const row = [0, 1, 2, 3, 4, 5].map((dx) => walk.tileAt({ x: torii.x + dx, y: torii.y }));
    expect(row).toEqual(['floor', 'wall', 'floor', 'floor', 'wall', 'floor']);
  });
});
