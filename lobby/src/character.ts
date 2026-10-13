// 캐릭터 스프라이트 프레임 — 바라보는 방향·걷는 중인지로 걷기 시트의 칸을 고른다. 순수 함수.
// 시트(chibi.ts): 열 = 서기 · 한 발 · 서기 · 다른 발, 행 = 아래 · 위 · 왼쪽 · 오른쪽.
import { FRAMES, dirRow } from './chibi';
import type { Dir } from './movement';

const FRAMES_PER_STEP = 2; // 한 칸 걷는 동안 넘기는 프레임 수 — 두 칸에 한 사이클

/**
 * stride: 걸은 거리(칸 단위, 계속 걸으면 끊김 없이 늘어나는 값). 정지 중이면 서 있는 프레임.
 * 걷기 시작하자마자 발을 내딛는 프레임이 나오게 한 칸 앞에서 시작한다.
 */
export function characterFrame(facing: Dir, walking: boolean, stride: number): { col: number; row: number } {
  const row = dirRow(facing);
  if (!walking) return { col: 0, row };
  return { col: (Math.floor(stride * FRAMES_PER_STEP) + 1) % FRAMES, row };
}
