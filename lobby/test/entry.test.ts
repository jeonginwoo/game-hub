import { describe, expect, it } from 'vitest';
import {
  doorFront,
  doorIndexAt,
  entryUrl,
  gameAtDoor,
  returnUrl,
  spawnFromSearch,
  withoutDoorParam,
} from '../src/entry';
import { DOOR_GAMES, GAMES, type GameEntry } from '../src/games';
import { LOBBY_ROWS } from '../src/lobby-map';
import { parseMap } from '../src/map';

const LOBBY = 'http://localhost:5173/';

const map = parseMap([
  '#D###D#',
  '#.....#',
  '#..S..D',
  '#######',
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
  it('문 번호는 맵에서 위→아래, 왼→오른 순', () => {
    expect(doorIndexAt(map, { x: 1, y: 0 })).toBe(0);
    expect(doorIndexAt(map, { x: 5, y: 0 })).toBe(1);
    expect(doorIndexAt(map, { x: 6, y: 2 })).toBe(2);
    expect(doorIndexAt(map, { x: 2, y: 1 })).toBeUndefined();
  });

  it('배정된 게임만 찾고, 배정이 없거나 등록 표에 없는 id 면 undefined', () => {
    expect(gameAtDoor(0, games, { 0: 'snake-race' })?.id).toBe('snake-race');
    expect(gameAtDoor(1, games, { 0: 'snake-race' })).toBeUndefined();
    expect(gameAtDoor(0, games, { 0: 'nope' })).toBeUndefined();
  });
});

describe('doorFront / spawnFromSearch', () => {
  it('문 앞 바닥 칸에서 문 반대쪽을 보고 선다', () => {
    expect(doorFront(map, { x: 1, y: 0 })).toEqual({ pos: { x: 1, y: 1 }, facing: 'down' });
    expect(doorFront(map, { x: 6, y: 2 })).toEqual({ pos: { x: 5, y: 2 }, facing: 'left' });
  });

  it('hub_door 가 유효하면 그 문 앞', () => {
    expect(spawnFromSearch(map, '?hub_door=1')).toEqual({ pos: { x: 5, y: 1 }, facing: 'down' });
  });

  it('없거나 잘못된 hub_door 는 시작점', () => {
    const start = { pos: map.start, facing: 'down' };
    for (const s of ['', '?room=1', '?hub_door=9', '?hub_door=-1', '?hub_door=1.5', '?hub_door=abc', '?hub_door=']) {
      expect(spawnFromSearch(map, s)).toEqual(start);
    }
  });
});

describe('실제 등록 표', () => {
  const lobby = parseMap(LOBBY_ROWS);

  it('id 는 형식에 맞고 겹치지 않는다', () => {
    const ids = GAMES.map((g) => g.id);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('문 배정은 있는 문 · 등록된 게임만 가리킨다', () => {
    for (const [door, id] of Object.entries(DOOR_GAMES)) {
      expect(lobby.doors[Number(door)], `문 ${door}`).toBeDefined();
      expect(GAMES.some((g) => g.id === id), `게임 ${id}`).toBe(true);
    }
  });

  it('로비의 모든 문 앞에 설 자리가 있다', () => {
    for (const d of lobby.doors) expect(doorFront(lobby, d)).toBeDefined();
  });
});
