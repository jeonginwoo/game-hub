import { describe, expect, it } from 'vitest';
import { parseMap } from '../../src/world/map';
import { fillCell, tileLook, type Cell } from '../../src/world/tiles';

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
    const open = tileLook(map, { x: 2, y: 2 }, openOnly(0))?.base;
    const shut = tileLook(map, { x: 9, y: 2 }, openOnly(0))?.base;
    expect(open).toBeDefined();
    expect(open).not.toEqual(shut);
    expect(open?.sheet).toBe('house');
    expect(shut?.sheet).toBe('house');
  });

  it('문 조각은 문의 왼쪽 위에 맞춘다 — 홀수 칸에서 시작해도 그림이 쪼개지지 않는다', () => {
    const part = (x: number, y: number) => tileLook(map, { x, y }, noneOpen)?.part;
    expect([part(9, 2), part(10, 2), part(9, 3), part(10, 3)]).toEqual([
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 },
    ]);
  });

  it('문 밖의 칸(벽·바닥·시작점)은 그림이 없다 — 바닥·벽 그림은 물체 몫', () => {
    for (const p of [{ x: 0, y: 0 }, { x: 5, y: 3 }, { x: 2, y: 5 }, { x: 6, y: 4 }, { x: 5, y: 4 }]) {
      expect(tileLook(map, p, noneOpen), `${p.x},${p.y}`).toBeUndefined();
    }
  });
});

describe('fillCell', () => {
  const base: Cell = { sheet: 'floor', col: 0, row: 12 };
  const v1: Cell = { sheet: 'floor', col: 1, row: 12 };
  const v2: Cell = { sheet: 'floor', col: 2, row: 12 };

  it('무늬가 없으면 늘 바탕', () => {
    for (let i = 0; i < 20; i++) expect(fillCell([base], i, i * 3)).toBe(base);
  });

  it('같은 자리는 늘 같은 칸, 대부분은 바탕이고 무늬도 섞인다', () => {
    const cells = [base, v1, v2];
    const picks = [];
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) picks.push(fillCell(cells, x, y));
    expect(fillCell(cells, 3, 7)).toBe(fillCell(cells, 3, 7));
    const bases = picks.filter((c) => c === base).length;
    expect(bases).toBeGreaterThan(picks.length / 2);
    expect(picks.some((c) => c === v1 || c === v2)).toBe(true);
  });
});
