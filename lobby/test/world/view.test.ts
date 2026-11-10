import { describe, expect, it } from 'vitest';
import { clampAxis, DEFAULT_ZOOM, DRIFT_X_PER_S, DRIFT_Y_PER_S, driftCenter, panCenter, screenToCell, stepZoom, wheelDeltaPx, wheelSteps, ZOOM_LEVELS, zoomAround } from '../../src/world/view';

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

describe('panCenter', () => {
  const map = { w: 40, h: 30 };
  const view = { w: 10, h: 8 };

  it('포인터를 오른쪽·아래로 끌면 맵이 따라와 중심은 왼쪽·위로 — px 를 칸으로', () => {
    // 한 칸 32px, 64px·32px 끌면 2칸·1칸
    expect(panCenter({ x: 20, y: 15 }, 64, 32, 32, map, view)).toEqual({ x: 18, y: 14 });
  });

  it('맵 밖이 보이지 않게 가장자리에서 멈춘다', () => {
    expect(panCenter({ x: 6, y: 5 }, 1000, 1000, 32, map, view)).toEqual({ x: 4.5, y: 3.5 });
    expect(panCenter({ x: 30, y: 20 }, -1000, -1000, 32, map, view)).toEqual({ x: 34.5, y: 25.5 });
  });

  it('맵이 화면보다 작은 축은 가운데 고정 — 0 만큼 끌면 범위 안으로 맞추기만', () => {
    expect(panCenter({ x: 0, y: 15 }, 0, 0, 32, { w: 8, h: 30 }, view)).toEqual({ x: 3.5, y: 15 });
  });
});

describe('driftCenter', () => {
  // 맵 40×30칸, 화면 20×10칸 → x 범위 9.5~29.5, y 범위 4.5~24.5
  const map = { w: 40, h: 30 };
  const view = { w: 20, h: 10 };

  it('처음엔 범위 가운데', () => {
    expect(driftCenter(0, map, view)).toEqual({ x: 19.5, y: 14.5 });
  });

  it('오래 흘러도 맵 밖이 보이지 않는 범위 안에 있다', () => {
    for (let ms = 0; ms < 600_000; ms += 1234) {
      const c = driftCenter(ms, map, view);
      expect(c.x).toBeGreaterThanOrEqual(9.5);
      expect(c.x).toBeLessThanOrEqual(29.5);
      expect(c.y).toBeGreaterThanOrEqual(4.5);
      expect(c.y).toBeLessThanOrEqual(24.5);
    }
  });

  it('한 프레임에 정해진 속도보다 많이 움직이지 않는다 — 끝에서 꺾여도 튀지 않는다', () => {
    for (let ms = 0; ms < 200_000; ms += 16) {
      const a = driftCenter(ms, map, view);
      const b = driftCenter(ms + 16, map, view);
      expect(Math.abs(b.x - a.x)).toBeLessThanOrEqual(DRIFT_X_PER_S * 0.016 + 1e-9);
      expect(Math.abs(b.y - a.y)).toBeLessThanOrEqual(DRIFT_Y_PER_S * 0.016 + 1e-9);
    }
  });

  it('시간이 지나면 움직인다', () => {
    expect(driftCenter(10_000, map, view)).not.toEqual(driftCenter(0, map, view));
  });

  it('맵이 화면보다 작은 축은 가운데에 고정한다', () => {
    const small = { w: 6, h: 30 };
    expect(driftCenter(0, small, view).x).toBe(2.5);
    expect(driftCenter(77_777, small, view).x).toBe(2.5);
  });
});

describe('stepZoom', () => {
  it('한 단계씩 오르내린다', () => {
    expect(stepZoom(DEFAULT_ZOOM, 1)).toBeCloseTo(1.65);
    expect(stepZoom(DEFAULT_ZOOM, -1)).toBeCloseTo(1.35);
  });

  it('끝에서 멈춘다', () => {
    const top = ZOOM_LEVELS.at(-1) ?? 0;
    const bottom = ZOOM_LEVELS[0] ?? 0;
    expect(stepZoom(top, 1)).toBe(top);
    expect(stepZoom(bottom, -3)).toBe(bottom);
  });

  it('표에 없는 값은 기본 배율에서 센다', () => {
    expect(stepZoom(1.234, 0)).toBe(DEFAULT_ZOOM);
    expect(stepZoom(Number.NaN, 1)).toBe(stepZoom(DEFAULT_ZOOM, 1));
  });
});

describe('zoomAround', () => {
  const view = { w: 800, h: 600 };

  it('화면 가운데를 기준으로 하면 중심이 그대로', () => {
    expect(zoomAround({ x: 10, y: 7 }, 400, 300, view, 24, 48)).toEqual({ x: 10, y: 7 });
  });

  it('기준 점이 가리키던 칸이 바뀐 배율에서도 같은 화면 점에 있다', () => {
    const before = { x: 10, y: 7 };
    const after = zoomAround(before, 600, 100, view, 24, 48);
    const cellAt = (c: { x: number; y: number }, px: number) => ({ x: c.x + (600 - 400) / px, y: c.y + (100 - 300) / px });
    const a = cellAt(before, 24);
    const b = cellAt(after, 48);
    expect(b.x).toBeCloseTo(a.x);
    expect(b.y).toBeCloseTo(a.y);
  });
});

describe('wheelSteps', () => {
  it('마우스 휠 한 칸은 delta 크기와 상관없이 한 단계', () => {
    expect(wheelSteps(0, 53)).toEqual({ steps: 1, acc: 0 });
    expect(wheelSteps(0, -100)).toEqual({ steps: -1, acc: 0 });
    expect(wheelSteps(0, 240)).toEqual({ steps: 1, acc: 0 });
  });

  it('잘게 쪼갠 delta 는 모아서 한 단계', () => {
    let r = wheelSteps(0, 20);
    expect(r.steps).toBe(0);
    r = wheelSteps(r.acc, 20);
    r = wheelSteps(r.acc, 25);
    expect(r).toEqual({ steps: 1, acc: 5 });
  });

  it('방향이 바뀌면 모아 둔 것을 버린다', () => {
    expect(wheelSteps(50, -10)).toEqual({ steps: 0, acc: -10 });
  });
});

describe('wheelDeltaPx', () => {
  it('px·줄·쪽 단위를 px 로', () => {
    expect(wheelDeltaPx(53, 0, 800)).toBe(53);
    expect(wheelDeltaPx(-3, 1, 800)).toBe(-99);
    expect(wheelDeltaPx(1, 2, 800)).toBe(800);
  });
});
