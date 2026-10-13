import { describe, expect, it } from 'vitest';
import { clampAxis } from '../src/view';

describe('clampAxis', () => {
  // 맵 20칸, 화면 10칸 → 타일 0 의 왼쪽 끝(-0.5)이 화면 왼쪽 끝이 되는 중심은 4.5
  it('가운데에서는 대상을 그대로 따라간다', () => {
    expect(clampAxis(10, 20, 10)).toBe(10);
  });

  it('맵 가장자리에서 멈춘다', () => {
    expect(clampAxis(0, 20, 10)).toBe(4.5);
    expect(clampAxis(19, 20, 10)).toBe(14.5);
  });

  it('맵이 화면보다 작으면 맵 가운데에 고정한다', () => {
    expect(clampAxis(0, 6, 10)).toBe(2.5);
    expect(clampAxis(5, 6, 10)).toBe(2.5);
  });
});
