import { describe, expect, it } from 'vitest';
import { buildRoom, checkObjects, objectRect, parseMap, solidCells, type PlacedShape, type RoomData } from '../src/room-map.ts';
import { DEFAULT_ROOM } from '../src/room-templates.ts';

const tree: PlacedShape = { id: 'tree', x: 4, y: 5, w: 2, h: 3 };

describe('parseMap', () => {
  const rows = [
    '#######',
    '#S.DD.#',
    '#..DD##',
    '#S...D#',
    '#######',
  ];

  it('한 글자 = 한 칸 — 크기와 칸 종류를 읽는다', () => {
    const map = parseMap(rows);
    expect(map.width).toBe(7);
    expect(map.height).toBe(5);
    expect(map.tileAt({ x: 0, y: 0 })).toBe('wall');
    expect(map.tileAt({ x: 2, y: 1 })).toBe('floor');
    expect(map.tileAt({ x: 3, y: 1 })).toBe('door');
  });

  it('시작점은 여럿일 수 있고 모두 바닥 칸이 된다', () => {
    const map = parseMap(rows);
    expect(map.starts).toEqual([{ x: 1, y: 1 }, { x: 1, y: 3 }]);
    expect(map.tileAt({ x: 1, y: 3 })).toBe('floor');
  });

  it('상하좌우로 붙은 D 칸은 문 하나 — 감싸는 사각형과 칸마다 문 번호', () => {
    const map = parseMap(rows);
    expect(map.doors).toEqual([{ x: 3, y: 1, w: 2, h: 2 }, { x: 5, y: 3, w: 1, h: 1 }]);
    for (const p of [{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 2 }]) expect(map.doorAt(p)).toBe(0);
    expect(map.doorAt({ x: 5, y: 3 })).toBe(1);
    expect(map.doorAt({ x: 2, y: 1 })).toBeUndefined();
    expect(map.doorAt({ x: -1, y: 1 })).toBeUndefined();
  });

  it('대각선으로만 닿은 D 칸은 다른 문, ㄱ 자로 붙으면 한 문', () => {
    expect(parseMap(['#D#', '#.D', '#S#']).doors).toHaveLength(2);
    const bent = parseMap(['DD#', '#D#', '#S#']);
    expect(bent.doors).toEqual([{ x: 0, y: 0, w: 2, h: 2 }]);
  });

  it('맵 밖은 벽으로 본다', () => {
    const map = parseMap(rows);
    expect(map.tileAt({ x: -1, y: 0 })).toBe('wall');
    expect(map.tileAt({ x: 0, y: 5 })).toBe('wall');
  });

  it('줄 길이가 다르면 거부한다', () => {
    expect(() => parseMap(['#S#', '##'])).toThrow(/길이/);
  });

  it('모르는 문자는 거부한다', () => {
    expect(() => parseMap(['#S?'])).toThrow(/\?/);
  });

  it('시작점이 없으면 거부한다', () => {
    expect(() => parseMap(['#..#'])).toThrow(/시작점/);
  });
});

describe('objectRect', () => {
  // 칸 중심이 정수 — 칸 4·5 를 덮으면 왼쪽 선 3.5, 오른쪽 선 5.5. 발은 칸 5 의 아래 선 5.5
  it('왼쪽 아래 칸에서 오른쪽·위로 뻗는다', () => {
    expect(objectRect(tree)).toEqual({ left: 3.5, top: 2.5, right: 5.5, bottom: 5.5 });
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

  it('물체끼리 solid 가 겹치면 거부하고, 그림만 겹치는 것은 통과한다', () => {
    const a = { ...tree, id: 'a', x: 2, y: 1, w: 2, h: 1, solid: [{ x: 0, y: 0 }] };
    const b = { ...tree, id: 'b', x: 2, y: 1, w: 2, h: 1, solid: [{ x: 1, y: 0 }] };
    expect(() => checkObjects(map, [a, b])).not.toThrow(); // 그림은 같은 자리, solid 는 다른 칸
    expect(() => checkObjects(map, [a, { ...b, x: 1, solid: [{ x: 1, y: 0 }] }])).toThrow(/'a' 와 겹친다/);
    expect(() => checkObjects(map, [a, { ...b, solid: undefined }])).not.toThrow(); // solid 없는 물체는 어디든
  });

  it('solid 가 맵의 벽 위에 놓여도 통과한다', () => {
    expect(() => checkObjects(map, [{ ...tree, x: 0, y: 0, w: 1, h: 1, solid: [{ x: 0, y: 0 }] }])).not.toThrow();
  });
});

describe('solidCells', () => {
  const post: PlacedShape = { ...tree, x: 2, y: 2, w: 2, h: 2, solid: [{ x: 0, y: 0 }, { x: 1, y: 0 }] };

  it('solid 는 왼쪽 아래 칸 기준 — x 는 오른쪽, y 는 위쪽', () => {
    expect(solidCells(post)).toEqual([{ x: 2, y: 2 }, { x: 3, y: 2 }]);
    expect(solidCells({ ...post, solid: [{ x: 1, y: 1 }] })).toEqual([{ x: 3, y: 1 }]);
    expect(solidCells({ ...post, solid: undefined })).toEqual([]);
  });
});

describe('buildRoom', () => {
  // 문 0 = (3~4, 0) 붙은 두 칸 · 문 1 = (6, 3)
  const data: RoomData = {
    rows: ['###DD##', '#.....#', '#.....#', '#S....D', '#.....#', '#######'],
    objects: [{ id: 't', kind: 'tree', x: 1, y: 4 }],
    doors: [{ x: 4, y: 0, game: 'snake-race' }],
  };

  it('물체에 종류의 모양을 붙이고, 문 배정은 그 칸이 속한 문 번호로', () => {
    const room = buildRoom(data);
    expect(room.objects).toEqual([{ id: 't', kind: 'tree', x: 1, y: 4, w: 4, h: 4, solid: [{ x: 1, y: 0 }, { x: 2, y: 0 }] }]);
    expect(room.doorGames).toEqual({ 0: 'snake-race' });
    expect(buildRoom({ ...data, doors: [{ x: 6, y: 3, game: 'a-1' }] }).doorGames).toEqual({ 1: 'a-1' });
  });

  it('맵·물체가 틀리면 거부한다', () => {
    expect(() => buildRoom({ ...data, rows: ['#..#'] })).toThrow(/시작점/);
    expect(() => buildRoom({ ...data, objects: [{ id: 't', kind: 'tree', x: 4, y: 4 }] })).toThrow(/맵 밖/);
  });

  it('문 칸이 아닌 배정 · 한 문에 두 번 배정 · 형식이 틀린 게임 id 는 거부한다', () => {
    expect(() => buildRoom({ ...data, doors: [{ x: 2, y: 1, game: 'a' }] })).toThrow(/문 칸이 아니다/);
    const twice = [{ x: 3, y: 0, game: 'a' }, { x: 4, y: 0, game: 'b' }];
    expect(() => buildRoom({ ...data, doors: twice })).toThrow(/두 번/);
    expect(() => buildRoom({ ...data, doors: [{ x: 4, y: 0, game: 'https://x' }] })).toThrow(/게임 id/);
  });
});

describe('기본 방', () => {
  it('검사를 통과한다', () => {
    expect(() => buildRoom(DEFAULT_ROOM)).not.toThrow();
  });
});
