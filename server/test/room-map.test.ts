import { describe, expect, it } from 'vitest';
import { assignDoor, buildRoom, checkObjects, MAX_OBJECTS, OBJECT_SHAPES, objectRect, parseMap, parseRoomData, paintTile, placeObject, removeObject, solidCells, type PlacedShape, type RoomData } from '../src/room-map.ts';
import { DEFAULT_ROOM, DEFAULT_TEMPLATE, ROOM_TEMPLATES, templateFor } from '../src/room-templates.ts';

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

describe('assignDoor', () => {
  // buildRoom 과 같은 맵 — 문 0 = (3~4, 0), 문 1 = (6, 3), 문 0 에 snake-race
  const data: RoomData = {
    rows: ['###DD##', '#.....#', '#.....#', '#S....D', '#.....#', '#######'],
    objects: [],
    doors: [{ x: 4, y: 0, game: 'snake-race' }],
  };

  it('빈 문에 게임을 배정한다 — 다른 문의 배정은 그대로', () => {
    expect(buildRoom(assignDoor(data, { x: 6, y: 3 }, 'a-1')).doorGames).toEqual({ 0: 'snake-race', 1: 'a-1' });
  });

  it('같은 문의 옛 배정은 다른 칸으로 적혔어도 바꾼다', () => {
    const next = assignDoor(data, { x: 3, y: 0 }, 'b');
    expect(next.doors).toEqual([{ x: 3, y: 0, game: 'b' }]);
  });

  it('null 이면 그 문의 배정을 지운다', () => {
    expect(assignDoor(data, { x: 3, y: 0 }, null).doors).toEqual([]);
  });

  it('받은 방 데이터는 바꾸지 않는다', () => {
    assignDoor(data, { x: 6, y: 3 }, 'a-1');
    expect(data.doors).toEqual([{ x: 4, y: 0, game: 'snake-race' }]);
  });

  it('문 칸이 아니거나 게임 id 형식이 틀리면 거부한다', () => {
    expect(() => assignDoor(data, { x: 2, y: 1 }, 'a')).toThrow(/문 칸이 아니다/);
    expect(() => assignDoor(data, { x: 6, y: 3 }, 'https://x')).toThrow(/게임 id/);
  });
});

describe('placeObject', () => {
  // 시작점 (1, 4). 나무 4×4 는 맨 아랫줄 가운데 두 칸(x+1, x+2)을 막는다
  const data: RoomData = {
    rows: ['###DD###', '#......#', '#......#', '#......#', '#S.....#', '########'],
    objects: [{ id: 'p1', kind: 'yard', x: 1, y: 5 }],
    doors: [],
  };

  it('물체를 끝에 더하고 안 쓰인 가장 작은 p 번호를 붙인다', () => {
    const next = placeObject(data, 'tree', { x: 2, y: 3 });
    expect(next.objects).toEqual([...data.objects, { id: 'p2', kind: 'tree', x: 2, y: 3 }]);
    // p2 를 치우면 그 번호를 다시 쓴다
    const again = placeObject(removeObject(next, 'p2'), 'tree', { x: 1, y: 3 });
    expect(again.objects.at(-1)?.id).toBe('p2');
  });

  it('받은 방 데이터는 바꾸지 않는다', () => {
    placeObject(data, 'tree', { x: 2, y: 3 });
    expect(data.objects).toHaveLength(1);
  });

  it('solid 가 다른 물체의 solid 와 겹치거나 시작점을 막거나 맵 밖이면 거부한다', () => {
    const one = placeObject(data, 'tree', { x: 2, y: 3 });
    // 밑둥 (3, 3)·(4, 3) 에 (4, 3) 이 겹친다
    expect(() => placeObject(one, 'tree', { x: 3, y: 3 })).toThrow(/겹친다/);
    // 밑둥 (1, 4) 가 시작점
    expect(() => placeObject(data, 'tree', { x: 0, y: 4 })).toThrow(/시작점을 막는다/);
    expect(() => placeObject(data, 'tree', { x: 5, y: 3 })).toThrow(/맵 밖/);
  });

  it('solid 없는 물체는 무엇과도 겹쳐 놓인다', () => {
    expect(placeObject(data, 'yard', { x: 1, y: 5 }).objects).toHaveLength(2);
  });

  it(`물체가 MAX_OBJECTS 개면 더 놓지 않는다`, () => {
    const full: RoomData = { ...data, objects: Array.from({ length: MAX_OBJECTS }, (_, i) => ({ id: `y${i}`, kind: 'yard', x: 1, y: 5 })) };
    expect(() => placeObject(full, 'yard', { x: 1, y: 5 })).toThrow(/더 놓을 수 없다/);
  });
});

describe('paintTile', () => {
  // 문 0 = (3~4, 0) 에 snake-race, 문 1 = (6, 3) 에 maze. 시작점 (1, 3). 나무 (1, 4) 의 밑둥은 (2, 4)·(3, 4)
  const data: RoomData = {
    rows: ['###DD##', '#.....#', '#.....#', '#S....D', '#.....#', '#######'],
    objects: [{ id: 't', kind: 'tree', x: 1, y: 4 }],
    doors: [{ x: 4, y: 0, game: 'snake-race' }, { x: 6, y: 3, game: 'maze' }],
  };

  it('그 칸의 글자만 바꾸고 받은 방 데이터는 그대로', () => {
    const next = paintTile(data, { x: 2, y: 4 }, '#');
    expect(next.rows).toEqual(['###DD##', '#.....#', '#.....#', '#S....D', '#.#...#', '#######']);
    expect(next.doors).toEqual(data.doors);
    expect(data.rows[4]).toBe('#.....#');
  });

  it('문 칸을 지우면 그 문의 배정도 지운다 — 다른 문은 그대로', () => {
    expect(paintTile(data, { x: 6, y: 3 }, '#').doors).toEqual([{ x: 4, y: 0, game: 'snake-race' }]);
  });

  it('배정이 적힌 칸만 지워지고 문이 남으면 배정을 그 문의 남은 칸으로 옮긴다', () => {
    // 배정은 (4, 0) 으로 적혀 있었다 — 문 0 은 (3, 0) 한 칸으로 남는다
    const next = paintTile(data, { x: 4, y: 0 }, '#');
    expect(next.doors).toEqual([{ x: 3, y: 0, game: 'snake-race' }, { x: 6, y: 3, game: 'maze' }]);
    expect(buildRoom(next).doorGames).toEqual({ 0: 'snake-race', 1: 'maze' });
  });

  it('문이 둘로 갈라지면 배정은 적힌 칸 쪽에 남는다', () => {
    const wide: RoomData = { ...data, rows: ['#DDD###', '#.....#', '#.....#', '#S....#', '#.....#', '#######'], doors: [{ x: 3, y: 0, game: 'a' }] };
    expect(buildRoom(paintTile(wide, { x: 2, y: 0 }, '#')).doorGames).toEqual({ 1: 'a' });
  });

  it('두 문이 붙어 하나가 되면 먼저 적힌 배정만 남긴다', () => {
    const two: RoomData = { ...data, rows: ['#D.D###', '#.....#', '#.....#', '#S....#', '#.....#', '#######'], doors: [{ x: 1, y: 0, game: 'a' }, { x: 3, y: 0, game: 'b' }] };
    expect(paintTile(two, { x: 2, y: 0 }, 'D').doors).toEqual([{ x: 1, y: 0, game: 'a' }]);
  });

  it('시작점·문을 새로 칠할 수 있다', () => {
    expect(buildRoom(paintTile(data, { x: 5, y: 4 }, 'S')).map.starts).toHaveLength(2);
    expect(buildRoom(paintTile(data, { x: 0, y: 4 }, 'D')).map.doors).toHaveLength(3);
  });

  it('맵 밖·이미 그 글자·마지막 시작점·물체의 solid 가 막는 문/시작점이면 거부한다', () => {
    expect(() => paintTile(data, { x: 7, y: 0 }, '#')).toThrow(/맵 밖/);
    expect(() => paintTile(data, { x: 0, y: 6 }, '#')).toThrow(/맵 밖/);
    expect(() => paintTile(data, { x: 0, y: 0 }, '#')).toThrow(/이미/);
    expect(() => paintTile(data, { x: 1, y: 3 }, '.')).toThrow(/시작점/);
    expect(() => paintTile(data, { x: 2, y: 4 }, 'S')).toThrow(/막는다/);
    expect(() => paintTile(data, { x: 3, y: 4 }, 'D')).toThrow(/막는다/);
  });
});

describe('removeObject', () => {
  const data: RoomData = {
    rows: ['#S.D#'],
    objects: [{ id: 'a', kind: 'yard', x: 0, y: 0 }, { id: 'b', kind: 'yard', x: 0, y: 0 }],
    doors: [],
  };

  it('그 id 물체만 치운다 — 받은 방 데이터는 그대로', () => {
    expect(removeObject(data, 'a').objects).toEqual([{ id: 'b', kind: 'yard', x: 0, y: 0 }]);
    expect(data.objects).toHaveLength(2);
  });

  it('없는 id 면 거부한다', () => {
    expect(() => removeObject(data, 'zzz')).toThrow(/없다/);
  });
});

describe('parseRoomData', () => {
  const data = {
    rows: ['#S.D#'],
    objects: [{ id: 't', kind: 'tree', x: 1, y: 0 }],
    doors: [{ x: 3, y: 0, game: 'g' }],
  };

  it('모양이 맞으면 알려진 필드만 담아 돌려준다', () => {
    const extra = { ...data, owner: 'x', objects: [{ ...data.objects[0], w: 99 }], doors: [{ ...data.doors[0], url: 'https://x' }] };
    expect(parseRoomData(extra)).toEqual(data);
    expect(parseRoomData(JSON.parse(JSON.stringify(DEFAULT_ROOM)))).toEqual(DEFAULT_ROOM);
  });

  it('하나라도 모양이 틀리면 null', () => {
    expect(parseRoomData(null)).toBeNull();
    expect(parseRoomData([])).toBeNull();
    expect(parseRoomData({ ...data, rows: 'abc' })).toBeNull();
    expect(parseRoomData({ ...data, rows: ['#S#', 3] })).toBeNull();
    expect(parseRoomData({ ...data, objects: undefined })).toBeNull();
    expect(parseRoomData({ ...data, objects: [{ id: 't', kind: 'castle', x: 1, y: 0 }] })).toBeNull();
    expect(parseRoomData({ ...data, objects: [{ id: 't', kind: 'toString', x: 1, y: 0 }] })).toBeNull();
    expect(parseRoomData({ ...data, objects: [{ id: 't', kind: 'tree', x: 1.5, y: 0 }] })).toBeNull();
    expect(parseRoomData({ ...data, doors: [{ x: 3, y: 0 }] })).toBeNull();
  });

  it('맵·배치가 맞는지는 보지 않는다 — buildRoom 몫', () => {
    expect(parseRoomData({ rows: ['#'], objects: [], doors: [{ x: 0, y: 0, game: 'g' }] })).not.toBeNull();
  });
});

describe('방 템플릿', () => {
  it('모두 검사를 통과하고 문 배정이 하나 이상 있다', () => {
    for (const t of ROOM_TEMPLATES) {
      expect(() => buildRoom(t.room), t.id).not.toThrow();
      expect(t.room.doors.length, t.id).toBeGreaterThan(0);
    }
  });

  it('물체 전시에는 모든 물체 종류가 한 번씩 있다', () => {
    const kinds = templateFor('gallery').room.objects.map((o) => o.kind);
    expect(kinds).toEqual(Object.keys(OBJECT_SHAPES));
  });

  it('id 가 겹치지 않고 첫 번째가 기본 방', () => {
    expect(new Set(ROOM_TEMPLATES.map((t) => t.id)).size).toBe(ROOM_TEMPLATES.length);
    expect(ROOM_TEMPLATES[0]).toBe(DEFAULT_TEMPLATE);
    expect(DEFAULT_TEMPLATE.room).toBe(DEFAULT_ROOM);
  });
});

describe('templateFor', () => {
  it('id 의 템플릿, 없거나 모르는 id 면 기본', () => {
    expect(templateFor('forest').id).toBe('forest');
    expect(templateFor(undefined)).toBe(DEFAULT_TEMPLATE);
    expect(templateFor('nowhere')).toBe(DEFAULT_TEMPLATE);
  });
});
