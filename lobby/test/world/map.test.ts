import { describe, expect, it } from 'vitest';
import type { RoomData } from '../../../server/src/room-map';
import { DEFAULT_ROOM } from '../../../server/src/room-templates';
import { parseMap, sameRoomData, withShutDoors } from '../../src/world/map';

describe('sameRoomData', () => {
  const data: RoomData = {
    rows: ['#S.D#'],
    objects: [{ id: 't', kind: 'tree', x: 1, y: 0 }],
    doors: [{ x: 3, y: 0, game: 'g' }],
  };

  it('내용이 같으면 같다 — 다른 객체여도, 필드 순서가 달라도', () => {
    expect(sameRoomData(data, JSON.parse(JSON.stringify(data)))).toBe(true);
    expect(sameRoomData(data, { doors: [{ game: 'g', y: 0, x: 3 }], objects: [{ y: 0, x: 1, kind: 'tree', id: 't' }], rows: ['#S.D#'] })).toBe(true);
    expect(sameRoomData(DEFAULT_ROOM, JSON.parse(JSON.stringify(DEFAULT_ROOM)))).toBe(true);
  });

  it('맵 줄·물체·문 배정 중 하나라도 다르면 다르다', () => {
    expect(sameRoomData(data, { ...data, rows: ['#SD.#'] })).toBe(false);
    expect(sameRoomData(data, { ...data, rows: [...data.rows, '#####'] })).toBe(false);
    expect(sameRoomData(data, { ...data, objects: [{ id: 't', kind: 'torii', x: 1, y: 0 }] })).toBe(false);
    expect(sameRoomData(data, { ...data, objects: [] })).toBe(false);
    expect(sameRoomData(data, { ...data, doors: [{ x: 3, y: 0, game: 'h' }] })).toBe(false);
    expect(sameRoomData(DEFAULT_ROOM, data)).toBe(false);
  });
});

describe('withShutDoors', () => {
  // 문 0 = (1~2, 0), 문 1 = (5~6, 0)
  const map = parseMap([
    '#DD##DD#',
    '#..S...#',
    '########',
  ]);
  const walk = withShutDoors(map, (door) => door === 0);

  it('열린 문은 문, 닫힌 문은 벽 — 그 밖의 칸은 원래 맵 그대로', () => {
    expect(walk.tileAt({ x: 1, y: 0 })).toBe('door');
    expect(walk.tileAt({ x: 2, y: 0 })).toBe('door');
    expect(walk.tileAt({ x: 5, y: 0 })).toBe('wall');
    expect(walk.tileAt({ x: 6, y: 0 })).toBe('wall');
    expect(walk.tileAt({ x: 3, y: 1 })).toBe('floor');
    expect(walk.tileAt({ x: 0, y: 0 })).toBe('wall');
  });

  it('문 번호·자리는 원래 맵 그대로 — 닫힌 문도 문으로 셈한다', () => {
    expect(walk.doors).toEqual(map.doors);
    expect(walk.doorAt({ x: 5, y: 0 })).toBe(1);
  });
});
