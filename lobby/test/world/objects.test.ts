import { describe, expect, it } from 'vitest';
import { buildRoom, OBJECT_SHAPES, type ObjectKind } from '../../../server/src/room-map';
import { DEFAULT_ROOM } from '../../../server/src/room-templates';
import { OBJECT_ART } from '../../src/data/object-art';
import { drawZ } from '../../src/world/layers';
import { parseMap } from '../../src/world/map';
import { objectZ, visibleObjects, withSolidObjects, type MapObject } from '../../src/world/objects';

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

describe('visibleObjects', () => {
  // 문 0 = (1~2, 0), 문 1 = (4, 2)
  const map = parseMap(['#DD##', '#S..#', '#...D', '#####']);
  const bit = (id: string, x: number, y: number, state?: 'open' | 'shut'): MapObject => ({ ...tree, id, x, y, w: 1, h: 1, ...(state && { state }) });
  const objects = [bit('plain', 2, 1), bit('d0-open', 1, 0, 'open'), bit('d0-shut', 2, 0, 'shut'), bit('d1-open', 4, 2, 'open'), bit('d1-shut', 4, 2, 'shut')];
  const ids = (os: readonly MapObject[]): string[] => os.map((o) => o.id);

  it('꼬리표 없는 물체는 늘 보이고, 꼬리표 물체는 제 문의 상태일 때만', () => {
    expect(ids(visibleObjects(objects, map, (d) => (d === 0 ? 'open' : 'shut')))).toEqual(['plain', 'd0-open', 'd1-shut']);
    expect(ids(visibleObjects(objects, map, (d) => (d === 0 ? 'shut' : 'open')))).toEqual(['plain', 'd0-shut', 'd1-open']);
  });

  it('편집 토글처럼 모든 문에 한 상태', () => {
    expect(ids(visibleObjects(objects, map, () => 'shut'))).toEqual(['plain', 'd0-shut', 'd1-shut']);
  });

  it('숨은 물체의 막는 칸은 걷기 판정에서도 빠진다', () => {
    const post = { ...bit('post', 4, 2, 'shut'), solid: [{ x: 0, y: 0 }] };
    const open = withSolidObjects(map, visibleObjects([post], map, () => 'open'));
    expect(open.tileAt({ x: 4, y: 2 })).toBe('door');
    const shut = withSolidObjects(map, visibleObjects([post], map, () => 'shut'));
    expect(shut.tileAt({ x: 4, y: 2 })).toBe('wall');
  });

  it('게이트 칸의 꼬리표 물체는 딸린 문을 따른다', () => {
    // 문 0 = (1, 0), 게이트 (1~3, 1) 이 이어져 문 0 에 딸린다
    const gated = parseMap(['#D###', '#GGG#', '#S..#', '#####']);
    const onGate = [bit('g-open', 3, 1, 'open'), bit('g-shut', 3, 1, 'shut')];
    expect(ids(visibleObjects(onGate, gated, (d) => (d === 0 ? 'open' : 'shut')))).toEqual(['g-open']);
    expect(ids(visibleObjects(onGate, gated, () => 'shut'))).toEqual(['g-shut']);
  });
});

describe('실제 로비 물체', () => {
  // 템플릿 배치와 상관없이 — 광장 맵 위에 나무 둘과 도리이만
  const room = buildRoom({
    ...DEFAULT_ROOM,
    objects: [
      { id: 'tree-left', kind: 'tree', x: 8, y: 11 },
      { id: 'tree-right', kind: 'tree', x: 32, y: 11 },
      { id: 'torii', kind: 'torii', x: 4, y: 27 },
    ],
  });
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

  // Floor 시트는 빼고 — 바닥 조각·채움·흙 마당은 같은 지형 세트를 일부러 나눠 쓴다.
  // 건물 줄 조각(지붕·정면)도 빼고 — 주황 집 그림의 한 칸씩을 예전 배경처럼 따로 쓴다
  const SHARED: ReadonlySet<string> = new Set(['roof-1', 'roof-2', 'facade']);
  it('같은 시트 칸을 두 종류가 쓰지 않는다 — 잘라 쓰는 영역 전체가 안 겹친다 (Floor 시트·건물 줄 조각 제외)', () => {
    const owner = new Map<string, ObjectKind>();
    for (const kind of Object.keys(OBJECT_ART).filter((k): k is ObjectKind => Object.hasOwn(OBJECT_SHAPES, k))) {
      const { w, h } = OBJECT_SHAPES[kind];
      const { sheet, col, row } = OBJECT_ART[kind].sprite;
      if (sheet === 'floor' || SHARED.has(kind)) continue;
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
