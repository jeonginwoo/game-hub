// 카메라 중심 계산 — 캐릭터를 따라가되 맵 밖이 보이지 않게 가장자리에서 멈춘다.
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
