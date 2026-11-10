import { describe, expect, it } from 'vitest';
import { nearestFloor, parseMap, withShutDoors } from '../../src/world/map';

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

describe('withShutDoors — 게이트 칸', () => {
  // 문 0 = (1, 0) 에 게이트 (1~2, 1), 문 1 = (5, 0) 에 게이트 (5, 1), 딸린 문 없는 게이트 (3, 3)
  const map = parseMap(['#D###D#', '#GG..G#', '#S....#', '###G###']);
  const walk = withShutDoors(map, (door) => door === 0);

  it('게이트는 문 상태와 상관없이 바닥(입장 없음) — 닫힌 문 칸만 벽', () => {
    expect(walk.tileAt({ x: 1, y: 1 })).toBe('floor');
    expect(walk.tileAt({ x: 2, y: 1 })).toBe('floor');
    expect(walk.doorAt({ x: 2, y: 1 })).toBeUndefined();
    expect(walk.tileAt({ x: 5, y: 1 })).toBe('floor');
    expect(walk.tileAt({ x: 5, y: 0 })).toBe('wall');
  });

  it('어느 문에도 안 닿은 게이트도 바닥', () => {
    expect(withShutDoors(map, () => false).tileAt({ x: 3, y: 3 })).toBe('floor');
  });

  it('열린 문의 게이트는 막힌 사람을 옮길 바닥 칸이 될 수 있다', () => {
    expect(nearestFloor(walk, { x: 1, y: 0 })).toEqual({ x: 1, y: 1 });
  });
});

describe('nearestFloor', () => {
  const map = parseMap([
    '#####',
    '#S#.#',
    '#####',
    '#.D.#',
    '#####',
  ]);

  it('가장 가까운 바닥 칸 — 같은 거리면 위→아래, 왼→오른 순 첫 칸', () => {
    expect(nearestFloor(map, { x: 2, y: 1 })).toEqual({ x: 1, y: 1 });
    expect(nearestFloor(map, { x: 2, y: 2 })).toEqual({ x: 1, y: 1 });
    expect(nearestFloor(map, { x: 4, y: 4 })).toEqual({ x: 3, y: 3 });
  });

  it('바닥 칸 위면 그 칸, 문 칸은 고르지 않는다', () => {
    expect(nearestFloor(map, { x: 3, y: 1 })).toEqual({ x: 3, y: 1 });
    expect(nearestFloor(map, { x: 2, y: 4 })).toEqual({ x: 1, y: 3 });
  });

  it('바닥이 없으면 undefined', () => {
    expect(nearestFloor({ ...map, tileAt: () => 'wall' }, { x: 2, y: 2 })).toBeUndefined();
  });
});
