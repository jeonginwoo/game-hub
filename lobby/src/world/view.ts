// 카메라 중심 계산 — 캐릭터를 따라가되 맵 밖이 보이지 않게 가장자리에서 멈춘다. 첫 화면 뒤에선 저절로 흐른다(driftCenter).
// 맵이 화면보다 작은 축은 맵 가운데에 고정한다. 단위는 칸(칸 중심이 정수 좌표).

export function clampAxis(target: number, mapSize: number, viewSize: number): number {
  const lo = viewSize / 2 - 0.5;
  const hi = mapSize - viewSize / 2 - 0.5;
  if (lo > hi) return (mapSize - 1) / 2;
  return Math.min(Math.max(target, lo), hi);
}

export interface ScreenView {
  readonly w: number; // 화면 CSS px
  readonly h: number;
  readonly cellPx: number; // 한 칸이 화면 몇 CSS px
  readonly center: { readonly x: number; readonly y: number }; // 카메라 중심(칸, y 는 아래로)
}

/** 화면 점(CSS px, 왼쪽 위 기준) → 그 점이 든 칸. 맵 밖일 수 있다 — 칸 판정은 맵이 한다 */
export function screenToCell(sx: number, sy: number, view: ScreenView): { readonly x: number; readonly y: number } {
  // 칸 중심이 정수라 가장 가까운 정수가 그 칸 — 반 칸 경계는 오른쪽·아래 칸으로 (Math.round 는 -0 을 낸다)
  const x = view.center.x + (sx - view.w / 2) / view.cellPx;
  const y = view.center.y + (sy - view.h / 2) / view.cellPx;
  return { x: Math.floor(x + 0.5), y: Math.floor(y + 0.5) };
}

export const DRIFT_X_PER_S = 0.5; // 칸/초
export const DRIFT_Y_PER_S = 0.35; // 칸/초

/**
 * 첫 화면 뒤 배경의 카메라 중심(칸) — 축마다 clampAxis 범위 안을 일정한 속도로 왕복한다.
 * 맵이 화면보다 작은 축은 가운데 고정. 축마다 속도가 달라 같은 길만 되풀이하지 않는다. ms 는 흐른 시간.
 */
export function driftCenter(
  ms: number,
  map: { readonly w: number; readonly h: number },
  view: { readonly w: number; readonly h: number },
): { readonly x: number; readonly y: number } {
  return {
    x: driftAxis(ms, DRIFT_X_PER_S, map.w, view.w),
    y: driftAxis(ms, DRIFT_Y_PER_S, map.h, view.h),
  };
}

function driftAxis(ms: number, perS: number, mapSize: number, viewSize: number): number {
  const lo = clampAxis(-Infinity, mapSize, viewSize);
  const range = clampAxis(Infinity, mapSize, viewSize) - lo;
  if (range <= 0) return lo;
  // 처음엔 범위 가운데에서 출발 — 첫 화면이 맵 구석부터 보이지 않게
  const phase = (range / 2 + (ms / 1000) * perS) % (2 * range);
  return lo + (phase <= range ? phase : 2 * range - phase);
}
