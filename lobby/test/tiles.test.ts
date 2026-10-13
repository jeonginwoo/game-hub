import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/map';
import { cellUv, tileLook } from '../src/tiles';

const map = parseMap([
  '######',
  '#D##D#',
  '#..S.#',
  '#.##.#',
  '######',
]);
const openAt = (x: number, y: number) => (p: { x: number; y: number }) => p.x === x && p.y === y;
const noneOpen = () => false;
const base = (x: number, y: number) => tileLook(map, { x, y }, noneOpen).base;

describe('tileLook', () => {
  it('게임이 배정된 문은 열린 입구, 아닌 문은 닫힌 문', () => {
    const look = (x: number) => tileLook(map, { x, y: 1 }, openAt(1, 1)).base;
    expect(look(1)).not.toEqual(look(4));
  });

  it('문이 있는 줄의 벽은 건물 정면, 그 바로 위 벽은 지붕 — 서로 다르다', () => {
    const facade = base(2, 1);
    const roofAboveWall = base(2, 0);
    expect(roofAboveWall).not.toEqual(facade);
    expect(base(1, 0)).toEqual(roofAboveWall); // 문 위도 지붕
  });

  it('그 밖의 벽은 모두 같은 덤불 — 정면·지붕과 다르다', () => {
    const hedge = base(0, 3);
    expect(base(2, 3)).toEqual(hedge);
    expect(base(3, 4)).toEqual(hedge);
    expect(hedge).not.toEqual(base(2, 1));
    expect(hedge).not.toEqual(base(2, 0));
  });

  it('바닥(시작점 포함)은 벽·문과 다른 칸 — 같은 칸은 늘 같은 무늬', () => {
    const walls = [base(2, 1), base(2, 0), base(0, 3)];
    for (const p of [{ x: 1, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 3 }]) {
      const a = tileLook(map, p, noneOpen);
      for (const w of walls) expect(a.base).not.toEqual(w);
      expect(tileLook(map, p, noneOpen)).toEqual(a);
    }
  });
});

describe('cellUv', () => {
  it('왼쪽 위 칸은 u 0 근처·v 1 근처, 경계는 살짝 안쪽', () => {
    const uv = cellUv(0, 0, 128, 64);
    expect(uv.u0).toBeGreaterThan(0);
    expect(uv.u0).toBeCloseTo(0, 3);
    expect(uv.u1).toBeCloseTo(32 / 128, 3);
    expect(uv.vTop).toBeLessThan(1);
    expect(uv.vTop).toBeCloseTo(1, 3);
    expect(uv.vBottom).toBeCloseTo(0.5, 3);
  });

  it('행이 늘면 v 가 내려간다 (텍스처 flipY)', () => {
    const uv = cellUv(3, 1, 128, 64);
    expect(uv.u0).toBeCloseTo(96 / 128, 3);
    expect(uv.u1).toBeCloseTo(1, 3);
    expect(uv.vTop).toBeCloseTo(0.5, 3);
    expect(uv.vBottom).toBeCloseTo(0, 3);
  });
});
