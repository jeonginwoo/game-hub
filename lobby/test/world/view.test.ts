import { describe, expect, it } from 'vitest';
import { clampAxis, screenToCell } from '../../src/world/view';

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

describe('screenToCell', () => {
  // 화면 400×300, 한 칸 20px, 카메라 중심 칸 (10, 5)
  const view = { w: 400, h: 300, cellPx: 20, center: { x: 10, y: 5 } };

  it('화면 가운데는 카메라 중심 칸', () => {
    expect(screenToCell(200, 150, view)).toEqual({ x: 10, y: 5 });
  });

  it('칸 중심이 정수라 반 칸 안쪽은 같은 칸, 넘으면 이웃 칸', () => {
    expect(screenToCell(209, 141, view)).toEqual({ x: 10, y: 5 });
    expect(screenToCell(211, 139, view)).toEqual({ x: 11, y: 4 });
  });

  it('화면 아래쪽이 큰 y (맵 아랫줄)', () => {
    expect(screenToCell(0, 300, view)).toEqual({ x: 0, y: 13 });
  });

  // 카메라가 맵 가운데에 고정된 작은 맵이면 중심이 반 칸 자리일 수 있다
  it('중심이 반 칸이어도 칸으로 내림 없이 가장 가까운 칸', () => {
    expect(screenToCell(205, 150, { ...view, center: { x: 2.5, y: 5 } })).toEqual({ x: 3, y: 5 });
  });
});
