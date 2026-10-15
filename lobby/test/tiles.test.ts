import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/map';
import { tileLook } from '../src/tiles';

const map = parseMap([
  '######',
  '#D##D#',
  '#..S.#',
  '#.##.#',
  '######',
]);
const openAt = (x: number, y: number) => (p: { x: number; y: number }) => p.x === x && p.y === y;
const noneOpen = () => false;

describe('tileLook', () => {
  it('게임이 배정된 문은 열린 입구, 아닌 문은 닫힌 문', () => {
    const look = (x: number) => tileLook(map, { x, y: 1 }, openAt(1, 1)).base;
    expect(look(1)).not.toEqual(look(4));
    expect(look(1).sheet).toBe('house');
    expect(look(4).sheet).toBe('house');
  });

  it('문이 있는 줄의 벽은 건물 정면, 그 바로 위 벽은 지붕', () => {
    const facade = tileLook(map, { x: 2, y: 1 }, noneOpen);
    const roofAboveWall = tileLook(map, { x: 2, y: 0 }, noneOpen);
    const roofAboveDoor = tileLook(map, { x: 1, y: 0 }, noneOpen);
    expect(facade.base.sheet).toBe('house');
    expect(facade.over).toBeUndefined();
    expect(roofAboveWall.base.sheet).toBe('house');
    expect(roofAboveWall.base).not.toEqual(facade.base);
    expect(roofAboveDoor.base.row).toBe(roofAboveWall.base.row);
  });

  it('그 밖의 벽은 풀밭 위 덤불', () => {
    for (const p of [{ x: 0, y: 3 }, { x: 2, y: 3 }, { x: 3, y: 4 }]) {
      const look = tileLook(map, p, noneOpen);
      expect(look.base.sheet).toBe('floor');
      expect(look.over?.sheet).toBe('nature');
    }
  });

  it('바닥(시작점 포함)은 풀 — 같은 칸은 늘 같은 무늬', () => {
    for (const p of [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 3 }]) {
      const a = tileLook(map, p, noneOpen);
      expect(a.base.sheet).toBe('floor');
      expect(a.over).toBeUndefined();
      expect(tileLook(map, p, noneOpen)).toEqual(a);
    }
  });
});
