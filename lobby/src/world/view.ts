// 카메라 중심 계산 — 캐릭터를 따라가되 맵 밖이 보이지 않게 가장자리에서 멈춘다. 첫 화면 뒤에선 저절로 흐른다(driftCenter).
// 편집 중엔 캐릭터와 따로 손으로 끌어 옮긴다(panCenter — 결정 2026-10-21: 편집 개편 C 도구 상자).
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

/**
 * 손으로 끈 만큼 옮긴 카메라 중심(칸) — 포인터가 (dxPx, dyPx) 화면 px 움직이면 맵이 포인터를 따라오게 중심은 반대로.
 * 맵 밖이 보이지 않게 clampAxis 로 자른다. 0 만큼 끌면 지금 중심을 범위 안으로 맞추기만 한다(창 크기·방이 바뀐 뒤)
 */
export function panCenter(
  center: { readonly x: number; readonly y: number },
  dxPx: number,
  dyPx: number,
  cellPx: number,
  map: { readonly w: number; readonly h: number },
  view: { readonly w: number; readonly h: number },
): { readonly x: number; readonly y: number } {
  return {
    x: clampAxis(center.x - dxPx / cellPx, map.w, view.w),
    y: clampAxis(center.y - dyPx / cellPx, map.h, view.h),
  };
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

// 휠 확대·축소 — 로비 안 화면 배율(그림 1px 이 화면 몇 CSS px). 기본 배율을 100% 로 한 퍼센트 단계 — 100% 가까이는 10% 씩 촘촘하게
export const DEFAULT_ZOOM = 1.5;
export const ZOOM_PERCENTS: readonly number[] = [50, 60, 70, 80, 90, 100, 110, 120, 135, 150, 175, 200, 250, 300];
export const ZOOM_LEVELS: readonly number[] = ZOOM_PERCENTS.map((p) => (DEFAULT_ZOOM * p) / 100);

// 휠 입력 → 단계. 마우스 휠 한 칸은 기기·브라우저마다 delta 가 달라(대개 50~120px) 크기와 상관없이 한 칸 = 한 단계.
// 트랙패드처럼 잘게 쪼갠 delta(WHEEL_FINE_PX 미만)만 WHEEL_FINE_STEP 만큼 모아서 한 단계
export const WHEEL_FINE_PX = 30;
export const WHEEL_FINE_STEP = 60;

const LINE_PX = 33; // deltaMode 줄 단위(Firefox 마우스 휠) 한 줄을 px 로

/** WheelEvent.deltaY 를 px 로 — deltaMode 0 = px · 1 = 줄 · 2 = 쪽(화면 높이) */
export function wheelDeltaPx(deltaY: number, deltaMode: number, pageH: number): number {
  return deltaY * (deltaMode === 1 ? LINE_PX : deltaMode === 2 ? pageH : 1);
}

/** 휠 한 번(deltaPx — px 로 바꾼 deltaY)과 모아 둔 값 → 이번에 오를 단계(+ = 축소 방향, deltaY 부호 그대로)와 새로 모아 둔 값 */
export function wheelSteps(acc: number, deltaPx: number): { readonly steps: number; readonly acc: number } {
  if (Math.abs(deltaPx) >= WHEEL_FINE_PX) return { steps: Math.sign(deltaPx), acc: 0 };
  // 방향이 바뀌면 반대쪽으로 모은 것은 버린다
  const sum = Math.sign(acc) === -Math.sign(deltaPx) ? deltaPx : acc + deltaPx;
  const steps = Math.trunc(sum / WHEEL_FINE_STEP) || 0; // -0 을 0 으로
  return { steps, acc: sum - steps * WHEEL_FINE_STEP };
}

/** 배율 한 단계 위(steps > 0 = 확대)·아래 — 끝에서 멈춘다. 표에 없는 값이면 기본 배율에서 센다 */
export function stepZoom(zoom: number, steps: number): number {
  const i = ZOOM_LEVELS.indexOf(zoom);
  const from = i >= 0 ? i : ZOOM_LEVELS.indexOf(DEFAULT_ZOOM);
  return ZOOM_LEVELS[Math.min(Math.max(from + steps, 0), ZOOM_LEVELS.length - 1)] ?? DEFAULT_ZOOM;
}

/**
 * 배율을 바꿀 때 화면 점(sx, sy — CSS px)이 가리키던 칸 자리가 그대로 있게 옮긴 카메라 중심(칸).
 * 맵 범위로 자르는 것은 부르는 쪽(panCenter) 몫
 */
export function zoomAround(
  center: { readonly x: number; readonly y: number },
  sx: number,
  sy: number,
  view: { readonly w: number; readonly h: number },
  oldPx: number,
  newPx: number,
): { readonly x: number; readonly y: number } {
  const dx = sx - view.w / 2;
  const dy = sy - view.h / 2;
  return { x: center.x + dx / oldPx - dx / newPx, y: center.y + dy / oldPx - dy / newPx };
}
