import { describe, expect, it } from 'vitest';
import { fillCell, type Cell } from '../../src/world/tiles';

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
