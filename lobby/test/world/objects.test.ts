import { describe, expect, it } from 'vitest';
import { buildRoom, OBJECT_SHAPES, type ObjectKind } from '../../../server/src/room-map';
import { DEFAULT_ROOM } from '../../../server/src/room-templates';
import { OBJECT_ART } from '../../src/data/object-art';
import { drawZ } from '../../src/world/layers';
import { parseMap } from '../../src/world/map';
import { objectZ, withSolidObjects, type MapObject } from '../../src/world/objects';

const tree: MapObject = { id: 'tree', layer: 'sorted', x: 4, y: 5, w: 2, h: 3, sprite: { sheet: 'nature', col: 0, row: 0 } };

describe('objectZ', () => {
  it('정렬 층 물체는 발 선으로 캐릭터와 앞뒤가 갈린다', () => {
    const behind = drawZ('sorted', 3.5); // 나무 위쪽 줄에 선 캐릭터
    const front = drawZ('sorted', 6.5); // 나무 아래쪽 줄에 선 캐릭터
    expect(objectZ(tree)).toBeGreaterThan(behind);
    expect(objectZ(tree)).toBeLessThan(front);
  });
});

describe('withSolidObjects', () => {
  const map = parseMap(['#####', '#S..#', '#...#', '#####']);
  const post: MapObject = { ...tree, x: 2, y: 2, w: 2, h: 2, solid: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };

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
  const room = buildRoom(DEFAULT_ROOM);
  const objects: MapObject[] = room.objects.map((o) => ({ ...o, ...OBJECT_ART[o.kind] }));

  it('나무는 밑둥 두 칸만 막히고, 도리이는 두 기둥 칸만 막혀 기둥 사이로 지나간다', () => {
    const walk = withSolidObjects(room.map, objects);
    for (const id of ['tree-left', 'tree-right']) {
      const o = objects.find((x) => x.id === id);
      expect(o).toBeDefined();
      if (!o) continue;
      const row = [0, 1, 2, 3].map((dx) => walk.tileAt({ x: o.x + dx, y: o.y }));
      expect(row).toEqual(['floor', 'wall', 'wall', 'floor']); // 잎 끝 아래는 지나간다
      expect(walk.tileAt({ x: o.x + 1, y: o.y - 1 })).toBe('floor'); // 잎 뒤로 지나간다
    }
    const torii = objects.find((x) => x.id === 'torii');
    expect(torii?.layer).toBe('sorted');
    if (!torii) return;
    const row = [0, 1, 2, 3, 4, 5].map((dx) => walk.tileAt({ x: torii.x + dx, y: torii.y }));
    expect(row).toEqual(['floor', 'wall', 'floor', 'floor', 'wall', 'floor']);
  });
});

describe('물체 그림 표', () => {
  // 시트 크기(시트 칸, 16px) — lobby/public/assets/ninja-adventure/ 의 PNG 크기 / 16
  const SHEET_CELLS = { floor: { w: 22, h: 26 }, house: { w: 33, h: 23 }, nature: { w: 24, h: 21 } } as const;

  it('모든 종류가 시트 안에서 잘린다 — 크기는 짝수 칸(시트 한 칸 = 2×2 칸)', () => {
    for (const kind of Object.keys(OBJECT_ART).filter((k): k is ObjectKind => Object.hasOwn(OBJECT_SHAPES, k))) {
      const { w, h } = OBJECT_SHAPES[kind];
      const { sheet, col, row } = OBJECT_ART[kind].sprite;
      expect(w % 2 === 0 && h % 2 === 0, kind).toBe(true);
      expect(col + w / 2 <= SHEET_CELLS[sheet].w && row + h / 2 <= SHEET_CELLS[sheet].h, kind).toBe(true);
    }
  });

  it('같은 시트 칸을 두 종류가 쓰지 않는다 — 잘라 쓰는 영역 전체가 안 겹친다', () => {
    const owner = new Map<string, ObjectKind>();
    for (const kind of Object.keys(OBJECT_ART).filter((k): k is ObjectKind => Object.hasOwn(OBJECT_SHAPES, k))) {
      const { w, h } = OBJECT_SHAPES[kind];
      const { sheet, col, row } = OBJECT_ART[kind].sprite;
      for (let dy = 0; dy < h / 2; dy++) {
        for (let dx = 0; dx < w / 2; dx++) {
          const cell = `${sheet}:${col + dx},${row + dy}`;
          expect(owner.get(cell), `${kind} ↔ ${owner.get(cell)} (${cell})`).toBeUndefined();
          owner.set(cell, kind);
        }
      }
    }
  });
});
