import { describe, expect, it } from 'vitest';
import type { RoomData } from '../../../server/src/room-map';
import { DEFAULT_ROOM } from '../../../server/src/room-templates';
import { sameRoomData } from '../../src/world/map';

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
