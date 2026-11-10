import { describe, expect, it } from 'vitest';
import { OBJECT_SHAPES } from '../../../server/src/room-map';
import { kindsByGroup, OBJECT_INFO } from '../../src/data/object-names';

describe('물체 이름·묶음', () => {
  it('이름은 비어 있지 않고 종류마다 다르다', () => {
    const names = Object.values(OBJECT_INFO).map((i) => i.name);
    for (const n of names) expect(n.trim()).not.toBe('');
    expect(new Set(names).size).toBe(names.length);
  });

  it('묶음마다 종류가 하나 이상', () => {
    for (const g of kindsByGroup(true)) expect(g.kinds.length, g.group).toBeGreaterThan(0);
  });

  it('묶음을 차례로 돌면 모든 종류가 한 번씩', () => {
    const all = kindsByGroup(true).flatMap((g) => g.kinds);
    expect(all.length).toBe(Object.keys(OBJECT_SHAPES).length);
    expect(new Set(all)).toEqual(new Set(Object.keys(OBJECT_SHAPES)));
  });

  it('묶음 안은 모양 표 순서', () => {
    const order = Object.keys(OBJECT_SHAPES);
    for (const g of kindsByGroup(true)) {
      const idx = g.kinds.map((k) => order.indexOf(k));
      expect(idx, g.group).toEqual([...idx].sort((a, b) => a - b));
    }
  });

  // 바닥 조각·채움은 재질 붓이 대신한다 — 놓기 창엔 없고, 데이터(물체 전시 템플릿)엔 남는다 (결정 2026-10-23 · 2026-11-10)
  it('놓기 창 묶음엔 바닥 조각·채움이 없고, 바닥 장식은 있다', () => {
    const shown = kindsByGroup().flatMap((g) => g.kinds);
    expect(shown.some((k) => k.startsWith('floor-') || k.startsWith('fill-'))).toBe(false);
    expect(shown).toContain('pebbles-1');
    expect(shown).toContain('yard');
    expect(kindsByGroup().map((g) => g.group)).toContain('floor');
  });
});
