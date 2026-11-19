import { describe, expect, it } from 'vitest';
import { nextStep, percentile, walkableOf } from '../load/walk.ts';
import { DEFAULT_ROOM } from '../src/room-templates.ts';

describe('부하 봇 걷기', () => {
  const walk = walkableOf(DEFAULT_ROOM);

  it('시작점은 설 수 있는 칸이다', () => {
    expect(walk.starts.length).toBeGreaterThan(0);
    for (const s of walk.starts) expect(walk.canStand(s)).toBe(true);
  });

  it('오래 걸어도 설 수 없는 칸으로 가지 않고, 한 번에 한 칸만 움직인다', () => {
    let at = { ...walk.starts[0]!, dir: 'down' as const } as Parameters<typeof nextStep>[0];
    for (let i = 0; i < 2000; i++) {
      const to = nextStep(at, walk);
      expect(Math.abs(to.x - at.x) + Math.abs(to.y - at.y)).toBeLessThanOrEqual(1);
      expect(walk.canStand(to)).toBe(true);
      at = to;
    }
  });

  it('사방이 막히면 제자리에서 방향만 바꾼다', () => {
    const boxed = { canStand: (p: { x: number; y: number }) => p.x === 5 && p.y === 5, starts: [{ x: 5, y: 5 }] };
    const to = nextStep({ x: 5, y: 5, dir: 'up' }, boxed);
    expect({ x: to.x, y: to.y }).toEqual({ x: 5, y: 5 });
    expect(to.dir).not.toBe('up');
  });
});

describe('percentile', () => {
  it('정렬된 값의 백분위, 비면 NaN', () => {
    const v = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(v, 50)).toBe(50);
    expect(percentile(v, 99)).toBe(99);
    expect(percentile(v, 100)).toBe(100);
    expect(percentile([], 50)).toBeNaN();
  });
});
