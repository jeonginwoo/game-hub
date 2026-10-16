// 카메라 중심 계산 — 캐릭터를 따라가되 맵 밖이 보이지 않게 가장자리에서 멈춘다.
// 맵이 화면보다 작은 축은 맵 가운데에 고정한다. 단위는 칸(칸 중심이 정수 좌표).

export function clampAxis(target: number, mapSize: number, viewSize: number): number {
  const lo = viewSize / 2 - 0.5;
  const hi = mapSize - viewSize / 2 - 0.5;
  if (lo > hi) return (mapSize - 1) / 2;
  return Math.min(Math.max(target, lo), hi);
}
