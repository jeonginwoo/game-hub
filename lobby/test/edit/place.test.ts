import { describe, expect, it } from 'vitest';
import { buildRoom, parseMap, type RoomData, type RoomObject } from '../../../server/src/room-map';
import { DEFAULT_ROOM } from '../../../server/src/room-templates';
import { OBJECT_ART } from '../../src/data/object-art';
import { canPlace, escStep, placeAt, placeState, tabOf, thumbScale, toolLabel, topObjectAt } from '../../src/edit/place';
import { placeObject } from '../../../server/src/room-map';
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

// 편집 도구만의 규칙 — 바닥 층 그림(조약돌 등)끼리는 겹쳐 놓지 않는다 (결정 2026-11-10)
describe('canPlace — 바닥 층 그림끼리', () => {
  const withPebbles = placeObject(DEFAULT_ROOM, 'pebbles-1', { x: 60, y: 30 }); // 2×2 — (60~61, 29~30)

  it('바닥 층 그림 위에 바닥 층 그림을 겹쳐 놓을 수 없다', () => {
    expect(canPlace(withPebbles, 'pebbles-1', { x: 60, y: 30 })).toBe(false);
    expect(canPlace(withPebbles, 'pebbles-2', { x: 61, y: 31 })).toBe(false); // 한 칸만 겹쳐도
  });

  it('맞닿기만 하면 된다', () => {
    expect(canPlace(withPebbles, 'pebbles-2', { x: 62, y: 30 })).toBe(true);
    expect(canPlace(withPebbles, 'pebbles-2', { x: 60, y: 32 })).toBe(true);
  });

  it('물체 층 그림은 바닥 그림 위에 놓을 수 있다', () => {
    expect(canPlace(withPebbles, 'sunflower', { x: 60, y: 30 })).toBe(true);
  });
});

// 편집 개편 D2 — 가운데 발 칸이 문 칸인 물체는 토글 상태의 꼬리표를 단다
describe('placeState · canPlace — 상태 꼬리표', () => {
  // 문 0 = (5~6, 6). 시작점 (1, 7). 나무 문 6×6 이 들어가게 문을 아래쪽에
  const data: RoomData = {
    rows: ['############', '#..........#', '#..........#', '#..........#', '#..........#', '#..........#', '#....DD....#', '#S.........#', '############'],
    ground: ['......', '......', '......', '......', '......'], objects: [], doors: [],
  };
  const map = parseMap(data.rows);

  it('가운데 발 칸(포인터 칸)이 문 칸이면 토글 상태, 아니면 꼬리표 없음', () => {
    expect(placeState(map, 'log', placeAt('log', { x: 5, y: 6 }), 'shut')).toBe('shut'); // 왼쪽 아래 칸 (4, 6) 은 문 밖이어도
    expect(placeState(map, 'log', placeAt('log', { x: 6, y: 6 }), 'open')).toBe('open');
    expect(placeState(map, 'log', placeAt('log', { x: 7, y: 6 }), 'open')).toBeUndefined();
    expect(placeState(map, 'gate-open', placeAt('gate-open', { x: 6, y: 6 }), 'open')).toBe('open'); // 문보다 넓은 그림
  });

  it('가운데 발 칸이 문에 딸린 게이트 칸이어도 토글 상태 — 딸린 문 없는 게이트는 꼬리표 없음', () => {
    // (7~8, 6) 게이트는 문 0 에 이어지고, (1, 3) 게이트는 어느 문에도 안 닿는다
    const gated = parseMap(['############', '#..........#', '#..........#', '#G.........#', '#..........#', '#..........#', '#....DDGG..#', '#S.........#', '############']);
    expect(placeState(gated, 'log', placeAt('log', { x: 8, y: 6 }), 'open')).toBe('open');
    expect(placeState(gated, 'log', placeAt('log', { x: 1, y: 3 }), 'open')).toBeUndefined();
  });

  it('같은 문의 다른 상태 물체와는 막는 칸이 겹쳐도 놓인다 — 같은 상태끼리는 안 된다', () => {
    const at = placeAt('log', { x: 5, y: 6 }); // 통나무 2×2 는 아랫줄 (4~5, 6) 을 막는다 — 문 칸 (5, 6) 을 막으니 닫힘 꼬리표만
    expect(canPlace(data, 'log', at)).toBe(false);
    expect(canPlace(data, 'log', at, 'shut')).toBe(true);
    const shut = placeObject(data, 'log', at, 'shut');
    expect(canPlace(shut, 'log', at, 'shut')).toBe(false);
    expect(canPlace(shut, 'stump-small', at, 'open')).toBe(false); // 열림 물체는 문 칸을 못 막는다
  });

  it('나무 문 — 닫힘을 놓은 자리에 열림을 겹쳐 놓는다. 열림은 양옆 기둥만 막아 문 칸이 비어 있다', () => {
    const at = placeAt('gate-shut', { x: 6, y: 6 }); // (3, 6) — 6칸 폭이 2칸 문 가운데에
    expect(canPlace(data, 'gate-shut', at, 'shut')).toBe(true);
    const shut = placeObject(data, 'gate-shut', at, 'shut');
    expect(canPlace(shut, 'gate-open', at, 'open')).toBe(true);
    expect(canPlace(shut, 'gate-shut', at, 'open')).toBe(false); // 닫힌 문 그림을 열림으로 — 문 칸을 막는다
  });

  it('바닥 층 그림도 같은 문의 다른 상태와는 겹쳐 놓인다', () => {
    const at = placeAt('pebbles-1', { x: 6, y: 6 }); // (5, 6)
    const shut = placeObject(data, 'pebbles-1', at, 'shut');
    expect(canPlace(shut, 'pebbles-2', at, 'open')).toBe(true);
    expect(canPlace(shut, 'pebbles-2', at, 'shut')).toBe(false);
    expect(canPlace(shut, 'pebbles-2', placeAt('pebbles-2', { x: 7, y: 6 }))).toBe(false); // 꼬리표 없는 물체와는 늘 함께 보인다
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

  it('층을 주면 그 층만 — 나무 밑의 마당도 바닥 층으로 고를 수 있고, 다른 층만 있으면 없음', () => {
    const objs = drawn([tree, yard]);
    expect(topObjectAt(objs, { x: 20, y: 8 }, 'floor')?.id).toBe('yard');
    expect(topObjectAt(objs, { x: 20, y: 8 }, 'sorted')?.id).toBe('t1');
    expect(topObjectAt(objs, { x: 18, y: 8 }, 'sorted')).toBeUndefined();
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

describe('thumbScale', () => {
  it('들어가면 가장 큰 정수배 — 점이 고르게 커지게', () => {
    expect(thumbScale(32, 32, 64)).toBe(2);
    expect(thumbScale(32, 48, 64)).toBe(1); // 48 이 두 배면 넘친다
    expect(thumbScale(16, 16, 56)).toBe(3);
  });

  it('1배로도 넘치면 긴 변을 칸에 맞춰 줄인다', () => {
    expect(thumbScale(128, 64, 64)).toBe(0.5);
    expect(thumbScale(64, 96, 64)).toBeCloseTo(2 / 3);
  });
});

describe('escStep', () => {
  const s = { doorList: false, window: false, dirty: false };

  it('게임 목록이 열려 있으면 그것부터 닫는다', () => {
    expect(escStep({ ...s, doorList: true })).toBe('close-door-list');
  });

  it('창 밖(놓는 중·문·칠하기)이면 편집 창을 다시 연다', () => {
    expect(escStep(s)).toBe('open-window');
    expect(escStep({ ...s, dirty: true })).toBe('open-window');
  });

  it('창에서면 편집 끝 — 바뀐 것이 있으면 그대로', () => {
    expect(escStep({ ...s, window: true })).toBe('end');
    expect(escStep({ ...s, window: true, dirty: true })).toBe('stay');
  });
});

describe('toolLabel', () => {
  const pick = { kind: null, brush: '.', ground: { theme: 'g', path: true } } as const;

  it('게임은 이름만', () => {
    expect(toolLabel('select', pick)).toBe('게임');
  });

  it('타일 규칙은 붓을 붙인다', () => {
    expect(toolLabel('paint', { ...pick, brush: '#' })).toBe('타일 규칙 · 벽');
  });

  it('오브젝트는 고른 물체 이름 — 안 골랐으면 이름만', () => {
    expect(toolLabel('place', pick)).toBe('오브젝트');
    expect(toolLabel('place', { ...pick, kind: 'fill-soil' })).toBe('오브젝트 · 갈색 흙 채움');
  });

  it('재질 붓도 오브젝트 탭 — 테마와 바닥/길', () => {
    expect(toolLabel('ground', pick)).toBe('오브젝트 · 풀 길');
    expect(toolLabel('ground', { ...pick, ground: { theme: 'n', path: false } })).toBe('오브젝트 · 눈 바닥');
  });
});

describe('tabOf', () => {
  it('오브젝트·게임·타일 규칙은 창 탭, 재질 붓은 오브젝트 탭, 지우개·손은 아래 줄', () => {
    for (const t of ['place', 'select', 'paint'] as const) expect(tabOf(t), t).toBe(t);
    expect(tabOf('ground')).toBe('place');
    expect(tabOf('erase')).toBeNull();
    expect(tabOf('hand')).toBeNull();
  });
});
