import { describe, expect, it } from 'vitest';
import { parseMap } from '../../src/world/map';
import { tileLook } from '../../src/world/tiles';

// 한 글자 = 한 칸, 그림 한 장은 2×2 칸. 문 0 = (2~3, 2~3), 문 1 = (9~10, 2~3) — 문 1 은 홀수 칸에서 시작
const map = parseMap([
  '############',
  '############',
  '##DD#####DD#',
  '##DD#####DD#',
  '#....S.....#',
  '#.##.......#',
  '############',
]);
const openOnly = (n: number) => (door: number) => door === n;
const noneOpen = () => false;

describe('tileLook', () => {
  it('게임이 배정된 문은 열린 입구, 아닌 문은 닫힌 문', () => {
    const open = tileLook(map, { x: 2, y: 2 }, openOnly(0)).base;
    const shut = tileLook(map, { x: 9, y: 2 }, openOnly(0)).base;
    expect(open).not.toEqual(shut);
    expect(open.sheet).toBe('house');
    expect(shut.sheet).toBe('house');
  });

  it('문 조각은 문의 왼쪽 위에 맞춘다 — 홀수 칸에서 시작해도 그림이 쪼개지지 않는다', () => {
    const part = (x: number, y: number) => tileLook(map, { x, y }, noneOpen).part;
    expect([part(9, 2), part(10, 2), part(9, 3), part(10, 3)]).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ]);
  });

  it('문이 있는 줄의 벽은 건물 정면, 그 위 두 칸은 지붕(아래 조각이 정면에 붙게)', () => {
    const facade = tileLook(map, { x: 5, y: 3 }, noneOpen);
    const roofLow = tileLook(map, { x: 5, y: 1 }, noneOpen);
    const roofHigh = tileLook(map, { x: 5, y: 0 }, noneOpen);
    expect(facade.base.sheet).toBe('house');
    expect(facade.over).toBeUndefined();
    expect(facade.part.y).toBe(1);
    expect(roofLow.base.row).toBe(1);
    expect(roofLow.base).not.toEqual(facade.base);
    expect(roofLow.part.y).toBe(1);
    expect(roofHigh.part.y).toBe(0);
    expect(tileLook(map, { x: 2, y: 1 }, noneOpen).base.row).toBe(1); // 문 위도 지붕
  });

  it('그 밖의 벽은 풀밭 위 덤불 — 조각은 32px 격자', () => {
    for (const p of [{ x: 0, y: 5 }, { x: 3, y: 5 }, { x: 4, y: 6 }]) {
      const look = tileLook(map, p, noneOpen);
      expect(look.base.sheet).toBe('floor');
      expect(look.over?.sheet).toBe('nature');
      expect(look.part).toEqual({ x: p.x % 2, y: p.y % 2 });
    }
  });

  it('바닥(시작점 포함)은 풀 — 32px 한 칸 안은 같은 무늬, 같은 칸은 늘 같은 무늬', () => {
    const a = tileLook(map, { x: 6, y: 4 }, noneOpen);
    const b = tileLook(map, { x: 7, y: 5 }, noneOpen);
    expect(a.base.sheet).toBe('floor');
    expect(a.over).toBeUndefined();
    expect(b.base).toEqual(a.base);
    expect(tileLook(map, { x: 6, y: 4 }, noneOpen)).toEqual(a);
  });
});
