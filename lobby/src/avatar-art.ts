// 임시 캐릭터 그림 — 외형(look.ts)대로 48×64 프레임 하나를 2d 캔버스에 그린다. DOM 캔버스만 쓰고 Three.js 와 무관.
// 에셋 전 코드 그림 (결정 2026-10-16: 캐릭터 꾸미기는 코드 그림으로 구조만). 발이 프레임 아래 가운데 (layers.ts AVATAR_PX)
import type { Look } from '../../server/src/protocol';
import { AVATAR_PX } from './layers';
import { bodyColor, hairColor } from './look';
import type { Dir } from './movement';

const SKIN = '#e5c3a0';
const EYE = '#2a1d16';
const HEAD = [10, 8, 28, 28] as const; // 머리 네모 x, y, w, h (프레임 픽셀)

type Rect = readonly [number, number, number, number]; // x, y, w, h (프레임 픽셀)

// 눈 — 정면은 두 눈, 옆모습은 보이는 쪽 한 눈, 뒷모습은 없음
const EYES: Readonly<Record<Dir, readonly Rect[]>> = {
  down: [[16, 21, 4, 6], [28, 21, 4, 6]],
  left: [[13, 19, 4, 6]],
  right: [[31, 19, 4, 6]],
  up: [],
};

// 머리카락 — 앞머리 띠, 옆모습은 뒤통수 쪽까지, 뒷모습은 머리 전체
const HAIR: Readonly<Record<Dir, readonly Rect[]>> = {
  down: [[10, 8, 28, 6], [10, 14, 3, 6], [35, 14, 3, 6]],
  left: [[10, 8, 28, 6], [28, 14, 10, 12]],
  right: [[10, 8, 28, 6], [10, 14, 10, 12]],
  up: [HEAD],
};

// 수염 — 머리카락 색. 뒷모습에는 안 보인다
const BEARDS: readonly Readonly<Record<Dir, readonly Rect[]>>[] = [
  { down: [], left: [], right: [], up: [] },
  { down: [[18, 29, 12, 3]], left: [[10, 28, 8, 3]], right: [[30, 28, 8, 3]], up: [] }, // 콧수염
  { down: [[12, 28, 24, 8]], left: [[10, 27, 14, 9]], right: [[24, 27, 14, 9]], up: [] }, // 턱수염
];

// 모자 — [색, 칸] 묶음을 순서대로. 챙은 바라보는 쪽으로
type Paint = readonly (readonly [string, Rect])[];
const HATS: readonly Readonly<Record<Dir, Paint>>[] = [
  { down: [], left: [], right: [], up: [] },
  (() => {
    // 캡
    const crown: Paint = [['#c0392b', [9, 3, 30, 11]]];
    return {
      down: [...crown, ['#e05a4b', [9, 12, 30, 3]]],
      left: [...crown, ['#e05a4b', [3, 11, 12, 3]]],
      right: [...crown, ['#e05a4b', [33, 11, 12, 3]]],
      up: crown,
    };
  })(),
  (() => {
    // 비니 — 방울 + 접은 단
    const all: Paint = [['#4f6d94', [10, 3, 28, 10]], ['#3b5474', [9, 11, 30, 4]], ['#eceff4', [21, 0, 6, 4]]];
    return { down: all, left: all, right: all, up: all };
  })(),
  (() => {
    // 밀짚모자 — 넓은 챙 + 띠
    const all: Paint = [['#c9a24f', [4, 11, 40, 4]], ['#d9b866', [12, 2, 24, 10]], ['#8b3a3a', [12, 8, 24, 2]]];
    return { down: all, left: all, right: all, up: all };
  })(),
];

function fill(g: CanvasRenderingContext2D, color: string, rects: readonly Rect[]): void {
  g.fillStyle = color;
  for (const r of rects) g.fillRect(r[0], r[1], r[2], r[3]);
}

/** 프레임 하나를 (0, 0) 부터 그린다 — 캔버스는 AVATAR_PX 크기여야 한다 */
export function drawAvatar(g: CanvasRenderingContext2D, facing: Dir, look: Look): void {
  g.clearRect(0, 0, AVATAR_PX.w, AVATAR_PX.h);
  fill(g, bodyColor(look), [[12, 34, 24, 26]]);
  fill(g, SKIN, [HEAD]);
  fill(g, EYE, EYES[facing]);
  const hair = hairColor(look);
  fill(g, hair, HAIR[facing]);
  fill(g, hair, BEARDS[look.beard]?.[facing] ?? []);
  for (const [color, rect] of HATS[look.hat]?.[facing] ?? []) fill(g, color, [rect]);
}

export function avatarCanvas(facing: Dir, look: Look): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = AVATAR_PX.w;
  c.height = AVATAR_PX.h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  drawAvatar(g, facing, look);
  return c;
}
