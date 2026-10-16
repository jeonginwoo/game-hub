import { describe, expect, it } from 'vitest';
import {
  doorFront,
  doorIndexAt,
  entryUrl,
  gameAtDoor,
  pickStart,
  returnUrl,
  spawnFromSearch,
  withoutDoorParam,
} from '../../src/launch/entry';
import { buildRoom } from '../../../server/src/room-map';
import { ROOM_TEMPLATES } from '../../../server/src/room-templates';
import { GAMES, type GameEntry } from '../../src/data/games';
import { parseMap } from '../../src/world/map';

const LOBBY = 'http://localhost:5173/';

// 한 글자 = 한 칸. 문 0 = 붙은 D 네 칸 (1~2, 0~1) · 문 1 = (6, 0) · 문 2 = (7, 1) — 대각선은 붙은 것이 아니다. 시작점 둘
const map = parseMap([
  '#DD###D#',
  '#DD###.D',
  '#....S.#',
  '#S.....#',
  '########',
]);

const games: GameEntry[] = [{ id: 'snake-race', title: '스네이크 레이스', url: '/games/snake-race/' }];

describe('entryUrl', () => {
  it('상대 URL 을 로비 주소 기준 절대 URL 로 만들고 hub_return 을 인코딩해 붙인다', () => {
    const back = 'http://localhost:5173/?hub_door=0';
    expect(entryUrl('/games/snake-race/', back, LOBBY)).toBe(
      'http://localhost:5173/games/snake-race/?hub_return=http%3A%2F%2Flocalhost%3A5173%2F%3Fhub_door%3D0',
    );
  });

  it('게임 URL 의 기존 쿼리·해시를 그대로 둔다', () => {
    const url = entryUrl('https://example.com/g/?mode=a+b&flag#lv2', 'http://x/', LOBBY);
    expect(url).toBe('https://example.com/g/?mode=a+b&flag&hub_return=http%3A%2F%2Fx%2F#lv2');
  });

  it('게임이 읽으면 복귀 URL 이 그대로 나온다', () => {
    const back = returnUrl('http://localhost:5173/?room=1#x', 2);
    const url = new URL(entryUrl('/g/?a=1', back, LOBBY));
    expect(url.searchParams.get('hub_return')).toBe(back);
  });

  it('플레이어가 있으면 hub_return 뒤에 hub_name·hub_room 을 인코딩해 붙인다 (계약 v3)', () => {
    const url = entryUrl('/g/?mode=a#lv2', 'http://x/', LOBBY, { name: '철수 a&b', room: 'abc234' });
    expect(url).toBe(
      'http://localhost:5173/g/?mode=a&hub_return=http%3A%2F%2Fx%2F&hub_name=%EC%B2%A0%EC%88%98%20a%26b&hub_room=abc234#lv2',
    );
  });

  it('게임이 읽으면 이름이 글자 그대로 나온다', () => {
    const url = new URL(entryUrl('/g/', 'http://x/', LOBBY, { name: '<b>철수</b>', room: 'abc234' }));
    expect(url.searchParams.get('hub_name')).toBe('<b>철수</b>');
    expect(url.searchParams.get('hub_room')).toBe('abc234');
  });

  it('이름은 제어 문자를 빼고 다듬어 16자로, 다듬어 비면 빼고 붙이지 않는다', () => {
    const long = new URL(entryUrl('/g/', 'http://x/', LOBBY, { name: ' 가\n나다라마바사아자차카타파하abcd ', room: 'abc234' }));
    expect(long.searchParams.get('hub_name')).toBe('가나다라마바사아자차카타파하ab');
    const blank = new URL(entryUrl('/g/', 'http://x/', LOBBY, { name: ' \t ', room: 'abc234' }));
    expect(blank.searchParams.has('hub_name')).toBe(false);
    expect(blank.searchParams.get('hub_room')).toBe('abc234');
  });

  it('방 코드 형식이 틀리면 hub_room 을 붙이지 않는다', () => {
    const url = new URL(entryUrl('/g/', 'http://x/', LOBBY, { name: '철수', room: 'ABC10l' }));
    expect(url.searchParams.has('hub_room')).toBe(false);
    expect(url.searchParams.get('hub_name')).toBe('철수');
  });

  it('플레이어가 없으면 v1 과 같다 — hub_return 만', () => {
    expect(entryUrl('/g/', 'http://x/', LOBBY)).toBe('http://localhost:5173/g/?hub_return=http%3A%2F%2Fx%2F');
  });
});

describe('returnUrl', () => {
  it('로비 URL 에 hub_door 를 넣은 절대 URL', () => {
    expect(returnUrl('http://localhost:5173/?room=1', 3)).toBe('http://localhost:5173/?room=1&hub_door=3');
  });

  it('이미 있는 hub_door 는 덮어쓴다', () => {
    expect(returnUrl('http://localhost:5173/?hub_door=1', 2)).toBe('http://localhost:5173/?hub_door=2');
  });

  it('http(s) 가 아니면 거부한다 — 계약상 hub_return 은 항상 http(s)', () => {
    expect(() => returnUrl('file:///C:/lobby/index.html', 0)).toThrow();
  });
});

describe('withoutDoorParam', () => {
  it('hub_door 만 지우고 나머지는 둔다', () => {
    expect(withoutDoorParam('http://localhost:5173/?room=1&hub_door=0#x')).toBe('http://localhost:5173/?room=1#x');
  });

  it('hub_door 가 없으면 입력 그대로', () => {
    expect(withoutDoorParam('http://localhost:5173/?a=b+c')).toBe('http://localhost:5173/?a=b+c');
  });
});

describe('문 위치·배정', () => {
  it('문 번호는 맵에서 위→아래, 왼→오른 순 — 붙은 D 칸은 한 문', () => {
    for (const p of [{ x: 1, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 1 }]) expect(doorIndexAt(map, p)).toBe(0);
    expect(doorIndexAt(map, { x: 6, y: 0 })).toBe(1);
    expect(doorIndexAt(map, { x: 7, y: 1 })).toBe(2);
    for (const p of [{ x: 3, y: 0 }, { x: 1, y: 2 }, { x: 6, y: 1 }]) expect(doorIndexAt(map, p)).toBeUndefined();
  });

  it('배정된 게임만 찾고, 배정이 없거나 등록 표에 없는 id 면 undefined', () => {
    expect(gameAtDoor(0, games, { 0: 'snake-race' })?.id).toBe('snake-race');
    expect(gameAtDoor(1, games, { 0: 'snake-race' })).toBeUndefined();
    expect(gameAtDoor(0, games, { 0: 'nope' })).toBeUndefined();
  });
});

describe('doorFront / spawnFromSearch', () => {
  it('문 앞 바닥 칸에서 문 반대쪽을 보고 선다', () => {
    // 아래로 나오면 문의 왼쪽 열 바로 밑, 왼쪽으로 나오면 문의 아랫줄 바로 왼쪽
    expect(doorFront(map, { x: 1, y: 0, w: 2, h: 2 })).toEqual({ pos: { x: 1, y: 2 }, facing: 'down' });
    expect(doorFront(map, { x: 7, y: 1, w: 1, h: 1 })).toEqual({ pos: { x: 6, y: 1 }, facing: 'left' });
  });

  it('hub_door 가 유효하면 그 문 앞', () => {
    expect(spawnFromSearch(map, '?hub_door=1')).toEqual({ pos: { x: 6, y: 1 }, facing: 'down' });
  });

  it('없거나 잘못된 hub_door 는 시작점 중 하나', () => {
    for (const s of ['', '?room=1', '?hub_door=9', '?hub_door=-1', '?hub_door=1.5', '?hub_door=abc', '?hub_door=']) {
      expect(spawnFromSearch(map, s, () => 0)).toEqual({ pos: { x: 5, y: 2 }, facing: 'down' });
      expect(spawnFromSearch(map, s, () => 0.99)).toEqual({ pos: { x: 1, y: 3 }, facing: 'down' });
    }
  });

  it('시작점은 rand 로 고르고, 맵의 시작점 밖으로 나가지 않는다', () => {
    expect(pickStart(map, () => 0)).toEqual({ x: 5, y: 2 });
    expect(pickStart(map, () => 0.5)).toEqual({ x: 1, y: 3 });
    expect(pickStart(map, () => 1)).toEqual({ x: 1, y: 3 }); // [0, 1) 를 벗어난 값도 마지막 것으로
  });
});

describe('실제 등록 표', () => {
  it('id 는 형식에 맞고 겹치지 않는다', () => {
    const ids = GAMES.map((g) => g.id);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('모든 방 템플릿의 문 배정은 등록된 게임만 가리킨다', () => {
    // 문 칸·한 문 한 게임은 buildRoom 이 본다 — 등록 표는 로비만 안다
    for (const t of ROOM_TEMPLATES) {
      const room = buildRoom(t.room);
      expect(Object.keys(room.doorGames), t.id).not.toHaveLength(0);
      for (const id of Object.values(room.doorGames)) expect(GAMES.some((g) => g.id === id), `${t.id} 게임 ${id}`).toBe(true);
    }
  });

  it('모든 방 템플릿의 모든 문 앞에 설 자리가 있다', () => {
    for (const t of ROOM_TEMPLATES) {
      const map = buildRoom(t.room).map;
      for (const d of map.doors) expect(doorFront(map, d), t.id).toBeDefined();
    }
  });
});
