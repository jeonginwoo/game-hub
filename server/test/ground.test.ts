import { describe, expect, it } from 'vitest';
import { blankGround, checkGround, GROUND_THEMES, groundSize, groundTiles, pickVariant } from '../src/ground.ts';
import { FLOOR_TILES } from '../src/object-shapes.ts';

/** 타일 (tx, ty) 에 찍힌 시트 칸 */
function cellAt(ground: readonly string[], tx: number, ty: number): readonly [number, number] | undefined {
  const t = groundTiles(ground).find((g) => g.tx === tx && g.ty === ty);
  return t && [t.col, t.row];
}

describe('groundSize · blankGround', () => {
  it('칸 맵의 반 — 홀수면 올림', () => {
    expect(groundSize(7, 6)).toEqual({ width: 4, height: 3 });
    expect(groundSize(247, 80)).toEqual({ width: 124, height: 40 });
    expect(blankGround(7, 6)).toEqual(['....', '....', '....']);
  });
});

describe('checkGround', () => {
  it('크기가 맞고 아는 글자(테마 소문자·대문자·.)만이면 통과', () => {
    expect(() => checkGround(['sSpPgG', 'dDnNbB', 'iIcC..'], 12, 6)).not.toThrow();
  });

  it('줄 수·줄 길이·모르는 글자는 거부', () => {
    expect(() => checkGround(['..'], 4, 4)).toThrow(/2줄/);
    expect(() => checkGround(['..', '...'], 4, 4)).toThrow(/길이/);
    expect(() => checkGround(['..', '.#'], 4, 4)).toThrow(/모르는 글자/);
  });
});

describe('pickVariant', () => {
  it('자리마다 고정, 무늬는 바탕보다 훨씬 적게', () => {
    const cells = ['plain', 'a', 'b'];
    let variants = 0;
    for (let ty = 0; ty < 32; ty++) {
      for (let tx = 0; tx < 32; tx++) {
        const v = pickVariant(cells, tx, ty);
        expect(pickVariant(cells, tx, ty)).toBe(v);
        if (v !== 'plain') variants++;
      }
    }
    expect(variants).toBeGreaterThan(0);
    expect(variants).toBeLessThan(32 * 32 / 2);
    expect(pickVariant(['only'], 3, 4)).toBe('only');
  });
});

describe('groundTiles — 바닥', () => {
  it('재질 없는 타일은 빼고, 바닥은 구역 무늬 줄의 바탕·무늬 중 하나', () => {
    const tiles = groundTiles(['g.', '.n']);
    expect(tiles.map((t) => [t.tx, t.ty])).toEqual([[0, 0], [1, 1]]);
    const [grass, snow] = tiles;
    expect(grass?.row).toBe(12);
    expect(grass?.col).toBeLessThan(5);
    expect(snow?.row).toBe(19);
  });

  it('얼음·진흙의 바닥은 흰 바탕 한 칸', () => {
    expect(cellAt(['i'], 0, 0)).toEqual([0, 25]);
    expect(cellAt(['c'], 0, 0)).toEqual([0, 25]);
  });

  it('누가 몇 번 불러도 같은 칸', () => {
    const ground = ['gggggggg', 'gggggggg', 'gggggggg'];
    expect(groundTiles(ground)).toEqual(groundTiles(ground));
  });
});

describe('groundTiles — 길 가장자리 (풀 구역: 왼쪽 위 (0, 7))', () => {
  const block = ['ggggg', 'gGGGg', 'gGGGg', 'gGGGg', 'ggggg'];

  it('3×3 길 — 모서리·변·가운데', () => {
    expect(cellAt(block, 1, 1)).toEqual([0, 7]);
    expect(cellAt(block, 2, 1)).toEqual([1, 7]);
    expect(cellAt(block, 3, 1)).toEqual([2, 7]);
    expect(cellAt(block, 1, 2)).toEqual([0, 8]);
    expect(cellAt(block, 3, 2)).toEqual([2, 8]);
    expect(cellAt(block, 1, 3)).toEqual([0, 9]);
    expect(cellAt(block, 3, 3)).toEqual([2, 9]);
    // 가운데는 바탕 (1, 8) 또는 막대·조약돌 (0, 11)·(1, 11)
    expect([[1, 8], [0, 11], [1, 11]]).toContainEqual(cellAt(block, 2, 2));
  });

  it('대각선 하나가 비면 안쪽 모서리', () => {
    const notch = ['gGG', 'GGG', 'GGG'];
    expect(cellAt(notch, 1, 1)).toEqual([6, 9]);
  });

  it('한 타일 폭 띠·끝·혼자 떨어진 점', () => {
    const column = ['G', 'G', 'G'];
    expect([0, 1, 2].map((ty) => cellAt(column, 0, ty))).toEqual([[3, 7], [3, 8], [3, 9]]);
    const row = ['GGG'];
    expect([0, 1, 2].map((tx) => cellAt(row, tx, 0))).toEqual([[0, 10], [1, 10], [2, 10]]);
    expect(cellAt(['G'], 0, 0)).toEqual([3, 10]);
  });

  it('다른 테마의 길과는 잇지 않는다', () => {
    expect(cellAt(['GD'], 0, 0)).toEqual([3, 10]);
    expect(cellAt(['GD'], 1, 0)).toEqual([14, 10]);
  });

  it('얼음·진흙엔 점 조각이 없어 가운데로', () => {
    expect(cellAt(['I'], 0, 0)).toEqual([1, 22]);
    expect(cellAt(['C'], 0, 0)).toEqual([12, 22]);
  });
});

describe('groundTiles — 모든 이웃 모양', () => {
  it('어느 테마 어느 이웃이든 시트에 그림이 있는 칸', () => {
    const drawn = new Set(FLOOR_TILES.map((t) => `${t.col},${t.row}`));
    for (const theme of Object.keys(GROUND_THEMES)) {
      const path = theme.toUpperCase();
      for (let mask = 0; mask < 512; mask++) {
        const ground = [0, 1, 2].map((y) => [0, 1, 2].map((x) => (mask >> (y * 3 + x)) & 1 ? path : theme).join(''));
        for (const t of groundTiles(ground)) expect(drawn.has(`${t.col},${t.row}`), `${theme} ${ground.join('/')} → ${t.col},${t.row}`).toBe(true);
      }
    }
  });
});
