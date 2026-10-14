import { describe, expect, it } from 'vitest';
import { drawZ, MAX_SORT_Y } from '../src/layers';

describe('drawZ', () => {
  it('층 순서대로 앞에 그린다 — 배경 < 바닥 < 정렬 < 상단 < 앞화면', () => {
    const zs = [
      drawZ('background'),
      drawZ('floor'),
      drawZ('sorted', 0),
      drawZ('sorted', MAX_SORT_Y),
      drawZ('top'),
      drawZ('foreground'),
    ];
    for (let i = 1; i < zs.length; i++) expect(zs[i]).toBeGreaterThan(zs[i - 1] ?? Infinity);
  });

  it('정렬 층은 발이 아래(y 가 큰) 것을 앞에 그린다', () => {
    expect(drawZ('sorted', 6.5)).toBeGreaterThan(drawZ('sorted', 5.5));
  });

  it('정렬 층이 아니면 발 y 와 무관하다', () => {
    expect(drawZ('top', 1)).toBe(drawZ('top', 900));
  });

  it('정렬 층 범위 밖 발 y 는 거부한다', () => {
    expect(() => drawZ('sorted', -1)).toThrow(/발 y/);
    expect(() => drawZ('sorted', MAX_SORT_Y + 1)).toThrow(/발 y/);
  });
});
