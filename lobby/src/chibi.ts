// 2등신 캐릭터 그리기 — 꾸미기 값으로 걷기 시트 한 장(RGBA 픽셀)을 만든다. 외부 에셋 없이 직접 찍는다.
// 순수 함수 (DOM·Three.js 없음). 프레임 32×40, 32px = 타일 1칸 (머리가 윗칸으로 넘어간다).
//
// 그리는 방식: 머리·얼굴은 타원 + 앞머리 선으로 모양을 정하고 빛 방향(왼쪽 위)으로 음영 단계를 고른다.
// 눈·칼라 같은 세부만 손으로 찍는다. 색은 꾸미기 값의 기준 색 하나에서 5단계(deep~hi)를 만든다.
// 외곽선은 다 그린 뒤 실루엣 둘레에, 맞닿은 색을 어둡게 한 색으로 두른다 (selout — 검정 외곽선보다 부드럽다).
// 옆모습은 왼쪽을 보고 그리고, 오른쪽은 좌우 반전.
import { CLOTH_COLORS, EYE_COLORS, HAIR_COLORS, SKIN_COLORS, type Avatar } from './avatar';
import type { Dir } from './movement';

export const FRAME_W = 32;
export const FRAME_H = 40;
export const FRAMES = 4; // 서기 · 한 발 · 서기 · 다른 발
const DIRS: readonly Dir[] = ['down', 'up', 'left', 'right'];
export const SHEET_W = FRAME_W * FRAMES;
export const SHEET_H = FRAME_H * DIRS.length;

/** 시트에서 이 방향이 몇 번째 행인지 */
export function dirRow(d: Dir): number {
  return DIRS.indexOf(d);
}

// --- 색 ---------------------------------------------------------------------------

type RGB = readonly [number, number, number];

function hex(h: string): RGB {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: RGB, b: RGB, k: number): RGB {
  return [
    Math.round(a[0] + (b[0] - a[0]) * k),
    Math.round(a[1] + (b[1] - a[1]) * k),
    Math.round(a[2] + (b[2] - a[2]) * k),
  ];
}

const INK = hex('#2a1d33');
const WHITE: RGB = [255, 255, 255];

interface Ramp {
  readonly deep: RGB;
  readonly shadow: RGB;
  readonly base: RGB;
  readonly light: RGB;
  readonly hi: RGB;
}

function ramp(h: string): Ramp {
  const c = hex(h);
  return {
    deep: mix(c, INK, 0.55),
    shadow: mix(c, INK, 0.3),
    base: c,
    light: mix(c, WHITE, 0.22),
    hi: mix(c, WHITE, 0.5),
  };
}

interface Colors {
  readonly skin: Ramp;
  readonly eye: Ramp;
  readonly hair: Ramp;
  readonly top: Ramp;
  readonly bottom: Ramp;
  readonly shoes: Ramp;
}

function colors(a: Avatar): Colors {
  const pick = (t: Readonly<Record<string, string>>, k: string, fb: string) => ramp(t[k] ?? fb);
  return {
    skin: pick(SKIN_COLORS, a.skin, '#f6cfb4'),
    eye: pick(EYE_COLORS, a.eyeColor, '#4a74d9'),
    hair: pick(HAIR_COLORS, a.hairColor, '#8a5a3c'),
    top: pick(CLOTH_COLORS, a.topColor, '#f3f2f6'),
    bottom: pick(CLOTH_COLORS, a.bottomColor, '#3d4a7a'),
    shoes: pick(CLOTH_COLORS, a.shoesColor, '#8c5c3e'),
  };
}

// --- 캔버스 -----------------------------------------------------------------------

class Grid {
  readonly px: (RGB | null)[] = Array<RGB | null>(FRAME_W * FRAME_H).fill(null);
  set(x: number, y: number, c: RGB): void {
    if (x >= 0 && x < FRAME_W && y >= 0 && y < FRAME_H) this.px[y * FRAME_W + x] = c;
  }
  get(x: number, y: number): RGB | null {
    if (x < 0 || x >= FRAME_W || y < 0 || y >= FRAME_H) return null;
    return this.px[y * FRAME_W + x] ?? null;
  }
  /** 행별 [시작, 끝] 칸을 채운다. 색은 칸마다 고른다 */
  spans(rows: Readonly<Record<number, readonly [number, number]>>, dy: number, pick: (x: number, y: number) => RGB): void {
    for (const [ys, [a, b]] of Object.entries(rows)) {
      const y = Number(ys);
      for (let x = a; x <= b; x++) this.set(x, y + dy, pick(x, y));
    }
  }
}

/** 빛 방향(왼쪽 위 앞) 기준 구 음영 — nx, ny 는 타원 안 -1~1 */
const LIGHT = [-0.45, -0.6, 0.66] as const;
function sphereTone(r: Ramp, nx: number, ny: number): RGB {
  const nz = Math.sqrt(Math.max(0, 1 - nx * nx - ny * ny));
  const lam = nx * LIGHT[0] + ny * LIGHT[1] + nz * LIGHT[2];
  return lam > 0.82 ? r.light : lam > 0.5 ? r.base : lam > 0.2 ? r.shadow : r.deep;
}

/** 같은 램프에서 한 단계 어두운 색 */
function darker(r: Ramp, col: RGB): RGB {
  const order = [r.hi, r.light, r.base, r.shadow, r.deep];
  const i = order.findIndex((o) => o.join() === col.join());
  return i < 0 ? col : order[Math.min(i + 1, order.length - 1)] ?? col;
}

/** 꺾은선 위 x 의 y (구간 밖이면 양 끝 값) */
function polyline(pts: readonly (readonly [number, number])[], x: number): number {
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  if (x <= first[0]) return first[1];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i]!;
    const [x1, y1] = pts[i + 1]!;
    if (x >= x0 && x <= x1) return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
  }
  return last[1];
}

// --- 머리 -------------------------------------------------------------------------

type View = 'front' | 'back' | 'side';

interface Ellipse {
  readonly cx: number;
  readonly cy: number;
  readonly rx: number;
  readonly ry: number;
}
const inEllipse = (e: Ellipse, x: number, y: number) =>
  ((x + 0.5 - e.cx) / e.rx) ** 2 + ((y + 0.5 - e.cy) / e.ry) ** 2 <= 1;

function faceOf(view: View, dy: number): Ellipse {
  return { cx: view === 'side' ? 14.8 : 15.5, cy: 16.2 + dy, rx: 9.2, ry: 8.4 };
}

/** 머리카락 덩어리 — 스타일마다 크기와 아래 끝이 다르다 */
function hairOf(a: Avatar, view: View, dy: number): { e: Ellipse; limit: number } {
  const long = a.hair === 'bob' || a.hair === 'long';
  const cx = view === 'side' ? 16.2 : 15.5;
  return long
    ? { e: { cx, cy: 12.4 + dy, rx: 13.2, ry: 12.4 }, limit: 25 + dy }
    : { e: { cx, cy: 12 + dy, rx: 12.6, ry: 11.4 }, limit: (view === 'back' ? 22 : 21) + dy };
}

// 앞머리 선 — 덩어리 끝(아래로 뾰족)과 골. 이 선 아래 얼굴만 보인다
const BANGS_FRONT: readonly (readonly [number, number])[] = [
  [5, 21], [7, 19], [8.5, 12], [10, 16], [12, 12], [14, 16.5], [16, 11.5],
  [18, 15.5], [19.6, 12], [21.5, 15], [23, 12], [24.5, 19], [26.5, 21],
];
const VALLEYS_FRONT: readonly (readonly [number, number])[] = [[8.5, 12], [12, 12], [16, 11.5], [19.6, 12], [23, 12]];
const BANGS_SIDE: readonly (readonly [number, number])[] = [
  [3, 15], [5, 11], [7, 13.5], [9, 10.5], [11, 13.5], [12.5, 11.5], [14, 15], [15, 22], [16, 40],
];
const VALLEYS_SIDE: readonly (readonly [number, number])[] = [[5, 11], [9, 10.5], [13, 11]];

function drawHead(g: Grid, a: Avatar, c: Colors, view: View, dy: number): void {
  const face = faceOf(view, dy);
  const { e, limit } = hairOf(a, view, dy);
  const bangsPts = view === 'side' ? BANGS_SIDE : BANGS_FRONT;
  const bangs = (x: number) => polyline(bangsPts, x) + dy;
  const showsFace = (x: number, y: number) =>
    view !== 'back' && inEllipse(face, x, y) && y >= bangs(x) && (view === 'front' || x <= 15);

  // 얼굴 피부 — 왼쪽 위는 밝게, 오른쪽·턱 아래는 그늘
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      if (!inEllipse(face, x, y)) continue;
      let col = c.skin.base;
      if (x <= 10 && y <= 18 + dy) col = c.skin.light;
      if ((view === 'front' && x >= 22) || y >= 23 + dy) col = mix(c.skin.base, c.skin.shadow, 0.6);
      g.set(x, y, col);
    }
  // 목
  for (let y = 24; y <= 25; y++) for (let x = 14; x <= 17; x++) g.set(x, y + dy, c.skin.shadow);

  if (view === 'front') drawFaceFront(g, c, dy);
  if (view === 'side') drawFaceSide(g, c, dy);

  // 머리카락 — 타원 둘레에 삐죽한 머리끝(tuft)을 붙여 매끈한 공처럼 보이지 않게
  const tuft = (nx: number, ny: number) => ny < 0.55 && Math.sin(Math.atan2(ny, nx) * 13 + 0.6) > 0.5;
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const nx = (x + 0.5 - e.cx) / e.rx;
      const ny = (y + 0.5 - e.cy) / e.ry;
      const r = Math.hypot(nx, ny);
      if (!(r <= 1 || (r <= 1.08 && tuft(nx, ny))) || y > limit || showsFace(x, y)) continue;
      let col = sphereTone(c.hair, nx / Math.max(1, r), ny / Math.max(1, r));
      // 뒷모습은 아래로 갈수록 한 단계 어둡게
      if (view === 'back' && y > e.cy + 2) col = darker(c.hair, col);
      // 엔젤링 — 정수리 아래 얇은 띠, 군데군데 끊는다
      if (ny > -0.6 && ny < -0.5 && nx > -0.62 && nx < 0.35 && x % 5 !== 2) col = c.hair.hi;
      // 앞머리 끝 바로 위는 그늘 — 덩어리가 얼굴 위에 떠 보이게
      if (view !== 'back' && inEllipse(face, x, y + 1) && y >= bangs(x) - 1.2) col = c.hair.shadow;
      // 뒷머리 결
      if (view === 'back' && y > 9 + dy && [9, 13, 18, 22].includes(x)) col = c.hair.shadow;
      if (y === limit) col = c.hair.shadow;
      g.set(x, y, col);
    }
  // 앞머리 결: 골에서 정수리 쪽으로 짧은 그늘 선
  if (view !== 'back') {
    const valleys = view === 'side' ? VALLEYS_SIDE : VALLEYS_FRONT;
    for (const [vx, vy] of valleys) {
      const tx = e.cx + (vx - e.cx) * 0.35;
      for (let s = 0; s <= 0.42; s += 0.08) {
        const x = Math.round(vx + (tx - vx) * s);
        const y = Math.round(vy + dy + (4 - vy) * s);
        if (y >= 6 + dy && g.get(x, y)) g.set(x, y, c.hair.shadow);
      }
    }
    // 앞머리 아래 얼굴 그늘
    for (let x = 4; x <= 26; x++) {
      const y = Math.ceil(bangs(x));
      if (showsFace(x, y) && inEllipse(face, x, y)) g.set(x, y, c.skin.shadow);
    }
  }
  // 앞모습 옆머리 — 얼굴 양옆으로 턱까지 내려온다
  if (view === 'front') {
    for (let y = 14 + dy; y <= 24 + dy; y++) {
      const cut = Math.max(0, y - (20 + dy));
      for (let x = 4; x <= 7 - cut; x++) g.set(x, y, x === 7 - cut || y === 24 + dy ? c.hair.shadow : c.hair.base);
      for (let x = 24 + cut; x <= 27; x++) g.set(x, y, x === 24 + cut || y === 24 + dy ? c.hair.deep : c.hair.shadow);
    }
  }
  // 바보털
  const ahoge: readonly (readonly [number, number])[] =
    view === 'side' ? [[17, 1], [18, 0], [19, 0], [17, 2], [16, 2]] : [[16, 1], [17, 0], [18, 0], [16, 2], [15, 2]];
  for (const [x, y] of ahoge) g.set(x, y + dy, c.hair.base);
}

// 눈 — 위 속눈썹(k), 눈동자는 위가 짙고 아래로 밝아진다(d → i → j), 반사광(x), 아래 눈꺼풀은 피부 그늘(s)
const EYE_FRONT = ['kkkk', 'dxdd', 'diid', 'diid', 'djjd', '.ss.'];
const EYE_SIDE = ['kkk', 'xdd', 'iid', 'iid', 'jjd', '.s.'];

function stampEye(g: Grid, c: Colors, ox: number, oy: number, rows: readonly string[]): void {
  const pal: Readonly<Record<string, RGB>> = {
    k: INK, x: WHITE, d: mix(c.eye.base, INK, 0.45), i: c.eye.base, j: c.eye.hi, s: c.skin.shadow,
  };
  rows.forEach((r, dy) => [...r].forEach((ch, dx) => {
    const col = pal[ch];
    if (col) g.set(ox + dx, oy + dy, col);
  }));
}

function drawFaceFront(g: Grid, c: Colors, dy: number): void {
  stampEye(g, c, 9, 15 + dy, EYE_FRONT);
  stampEye(g, c, 19, 15 + dy, EYE_FRONT);
  g.set(8, 15 + dy, INK); // 속눈썹 끝 — 바깥쪽으로 살짝
  g.set(23, 15 + dy, INK);
  const blush = mix(c.skin.base, hex('#ff7f9a'), 0.4);
  for (const x of [8, 9, 22, 23]) g.set(x, 21 + dy, blush);
  g.set(15, 22 + dy, mix(c.skin.shadow, hex('#a8384f'), 0.55));
  g.set(16, 22 + dy, mix(c.skin.base, hex('#e0607a'), 0.35));
}

function drawFaceSide(g: Grid, c: Colors, dy: number): void {
  // 옆모습은 입을 그리지 않는다 — 얼굴 앞 테두리에 붙으면 외곽선과 겹쳐 입술이 튀어나와 보인다
  stampEye(g, c, 7, 15 + dy, EYE_SIDE);
  g.set(10, 15 + dy, INK);
  const blush = mix(c.skin.base, hex('#ff7f9a'), 0.4);
  for (const x of [8, 9]) g.set(x, 21 + dy, blush);
}

// --- 몸 뒤 머리카락 (긴 머리·양갈래) ----------------------------------------------

function drawHairBehind(g: Grid, a: Avatar, c: Colors, view: View, dy: number): void {
  if (a.hair === 'long' && view !== 'back') {
    // 등 뒤로 늘어진 머리 — 결을 세로 줄무늬로
    const cx = view === 'side' ? 21 : 15.5;
    const half = view === 'side' ? 6 : 11.5;
    for (let y = 12 + dy; y <= 32 + dy; y++) {
      const w = half - Math.max(0, y - (28 + dy)) * 1.3;
      for (let x = Math.ceil(cx - w); x <= Math.floor(cx + w - 1); x++) {
        const edge = x <= cx - w + 1 || x >= cx + w - 2;
        g.set(x, y, y === 32 + dy ? c.hair.deep : edge || x % 4 === 0 ? c.hair.shadow : c.hair.base);
      }
    }
  }
  if (a.hair === 'pigtails') {
    // 높이 묶어 발 근처까지 늘어뜨린다 — 물결치며 바깥으로 벌어졌다 모인다
    const tails: readonly { ax: number; side: number }[] =
      view === 'side' ? [{ ax: 24, side: 1 }] : [{ ax: 5, side: -1 }, { ax: 26, side: 1 }];
    for (const { ax, side } of tails) {
      for (let t = 0; t <= 1; t += 0.015) {
        const cx = ax + side * (2.2 + 1.4 * Math.sin(Math.PI * t * 2.2)) * Math.min(1, t * 5);
        const cy = 6 + dy + 30 * t;
        const r = Math.max(1.2, 4 - 2.8 * t);
        for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
          for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
            if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 > r * r) continue;
            const d = (x + 0.5 - cx) / r;
            const strand = (x + y) % 6 === 0; // 머리 결
            const col = t > 0.92 ? c.hair.deep : d < -0.3 ? (t < 0.35 ? c.hair.hi : c.hair.light)
              : d > 0.45 || strand ? c.hair.shadow : c.hair.base;
            g.set(x, y, col);
          }
      }
      // 머리끈 — 하의 색 (옷과 맞춘다)
      const tx = Math.round(ax) - 1;
      for (const [x, y] of [[tx, 5], [tx + 1, 5], [tx, 6], [tx + 1, 6]] as const) g.set(x, y + dy, c.bottom.base);
    }
  }
}

// --- 몸 ---------------------------------------------------------------------------

/** 앞·뒷모습 상의 (행: [시작, 끝]) */
const TORSO_FRONT: Readonly<Record<number, readonly [number, number]>> = {
  25: [11, 20], 26: [9, 22], 27: [8, 23], 28: [8, 23], 29: [8, 23], 30: [11, 20], 31: [11, 20], 32: [11, 20],
};
const TORSO_SIDE: Readonly<Record<number, readonly [number, number]>> = {
  25: [13, 18], 26: [12, 19], 27: [12, 19], 28: [12, 19], 29: [12, 19], 30: [12, 19], 31: [12, 19], 32: [12, 19],
};

function drawTop(g: Grid, a: Avatar, c: Colors, view: View, dy: number, armSwing: number): void {
  const t = c.top;
  const hoodie = a.top === 'hoodie';
  const blouse = a.top === 'blouse';
  const collar = mix(t.base, WHITE, 0.7);
  const ribbon = c.bottom;
  if (view === 'side') {
    g.spans(TORSO_SIDE, dy, (x, y) => (y === 32 ? t.shadow : x >= 18 ? t.shadow : t.base));
    // 가까운 팔 — 걸을 때 앞뒤로 흔든다
    const sleeveEnd = hoodie ? 30 : 29;
    for (let y = 26; y <= sleeveEnd; y++)
      for (let x = 14; x <= 17; x++) {
        const ax = x + (y >= 28 ? armSwing : 0);
        g.set(ax, y + dy, x === 14 || x === 17 ? t.shadow : t.light);
      }
    for (let y = sleeveEnd + 1; y <= sleeveEnd + 2; y++)
      for (let x = 15; x <= 16; x++) g.set(x + armSwing, y + dy, c.skin.base);
    if (blouse) {
      for (const [x, y] of [[12, 25], [13, 25], [14, 25], [12, 26]] as const) g.set(x, y + dy, collar);
      for (const [x, y] of [[11, 26], [11, 27], [12, 27]] as const) g.set(x, y + dy, ribbon.base);
    }
    return;
  }
  const rows: Record<number, readonly [number, number]> = { ...TORSO_FRONT };
  if (hoodie) rows[30] = [8, 23];
  g.spans(rows, dy, (x, y) => {
    if (y === 32) return t.shadow;
    if ((x === 10 || x === 21) && y >= 27) return t.shadow; // 소매와 몸통 사이
    if (x <= 12) return t.light;
    if (x >= 19) return t.shadow;
    return t.base;
  });
  // 손
  const handTop = hoodie ? 31 : 30;
  for (let y = handTop; y <= handTop + 1; y++)
    for (const x of [8, 9, 22, 23]) g.set(x, y + dy, x < 16 ? c.skin.base : c.skin.shadow);
  if (view === 'front') {
    for (let x = 14; x <= 17; x++) g.set(x, 25 + dy, c.skin.shadow); // 목선
    if (hoodie) {
      for (let x = 12; x <= 19; x++) g.set(x, 25 + dy, t.shadow); // 후드 테두리
      for (let x = 14; x <= 17; x++) g.set(x, 26 + dy, t.deep);
      for (let y = 27; y <= 29; y++) { g.set(14, y + dy, t.hi); g.set(17, y + dy, t.hi); } // 끈
      for (let x = 12; x <= 19; x++) g.set(x, 30 + dy, t.shadow); // 주머니
    } else if (blouse) {
      // 세일러 칼라 + 가슴 리본 (리본은 하의 색)
      const collarCells = [[11, 25], [12, 25], [13, 25], [18, 25], [19, 25], [20, 25], [11, 26], [12, 26], [19, 26], [20, 26]] as const;
      for (const [x, y] of collarCells) g.set(x, y + dy, collar);
      const bow = ['bB..Bb', 'bbDDbb', '.b..b.'];
      bow.forEach((row, ry) => [...row].forEach((ch, rx) => {
        const col = ch === 'b' ? ribbon.base : ch === 'B' ? ribbon.shadow : ch === 'D' ? ribbon.deep : null;
        if (col) g.set(13 + rx, 26 + ry + dy, col);
      }));
    } else {
      g.set(13, 26 + dy, t.shadow); g.set(18, 26 + dy, t.shadow); // 칼라
      g.set(14, 26 + dy, t.deep); g.set(17, 26 + dy, t.deep);
      g.set(14, 29 + dy, t.shadow); g.set(15, 30 + dy, t.shadow); // 주름
    }
  } else {
    for (let x = 12; x <= 19; x++) g.set(x, 25 + dy, t.shadow); // 뒷목 칼라
    if (blouse) {
      // 등에 넓게 덮인 세일러 칼라
      for (let y = 25; y <= 28; y++)
        for (let x = 11; x <= 20; x++)
          g.set(x, y + dy, y === 28 || x === 11 || x === 20 ? mix(collar, t.shadow, 0.5) : collar);
    }
    if (hoodie) {
      // 등에 걸친 후드
      for (let y = 23; y <= 27; y++)
        for (let x = 11; x <= 20; x++) {
          if (((x + 0.5 - 15.5) / 5) ** 2 + ((y + 0.5 - 24.5) / 3) ** 2 > 1) continue;
          g.set(x, y + dy, y >= 26 ? t.deep : t.shadow);
        }
    }
  }
}

/** 다리 하나 + 신발. x0 = 다리 왼쪽 칸, w = 폭, lift = 신발을 든 칸 수 */
function drawLeg(
  g: Grid, c: Colors, a: Avatar, x0: number, w: number, hip: number, lift: number, far: boolean, toe: number,
): void {
  const legRamp = a.bottom === 'pants' ? c.bottom : c.skin;
  const shoeTop = 37 - lift;
  for (let y = hip; y < shoeTop; y++)
    for (let x = x0; x < x0 + w; x++) {
      const skinny = a.bottom === 'skirt' && (x === x0 || x === x0 + w - 1); // 치마 아래 다리는 가늘게
      if (skinny) continue;
      g.set(x, y, far ? legRamp.shadow : x === x0 + w - 1 ? legRamp.shadow : legRamp.base);
    }
  const s = c.shoes;
  // 신발은 작게 — 두 줄, 옆모습은 발끝 쪽으로 한 칸
  const left = x0 + Math.min(toe, 0);
  for (let y = shoeTop; y <= shoeTop + 1; y++)
    for (let x = left; x <= x0 + w - 1 + Math.max(toe, 0); x++) {
      const sole = y === shoeTop + 1;
      g.set(x, y, sole ? s.deep : far ? s.shadow : x === left ? s.hi : s.base);
    }
}

function drawLegs(g: Grid, a: Avatar, c: Colors, view: View, frame: number, dy: number): void {
  const hip = 33 + dy;
  if (view === 'side') {
    // 서 있으면 두 다리가 겹치고, 걸으면 앞뒤로 벌린다. 먼 쪽 다리는 그늘 색. 발끝은 왼쪽(앞)
    const near = frame === 1 ? 11 : frame === 3 ? 17 : 13;
    const far = frame === 1 ? 17 : frame === 3 ? 11 : 15;
    drawLeg(g, c, a, far, 4, hip, 0, true, -1);
    drawLeg(g, c, a, near, 4, hip, 0, false, -1);
    return;
  }
  drawLeg(g, c, a, 11, 4, hip, frame === 1 ? 1 : 0, false, 0);
  drawLeg(g, c, a, 17, 4, hip, frame === 3 ? 1 : 0, false, 0);
}

function drawBottom(g: Grid, a: Avatar, c: Colors, view: View, dy: number): void {
  const b = c.bottom;
  const side = view === 'side';
  if (a.bottom === 'pants') {
    const [l, r] = side ? [12, 19] : [11, 20];
    for (let x = l; x <= r; x++) g.set(x, 33 + dy, x >= r - 2 ? b.shadow : b.base);
    return;
  }
  // 치마 — 아래로 퍼지고 주름은 그늘 줄
  const rows: Readonly<Record<number, readonly [number, number]>> = side
    ? { 32: [12, 19], 33: [11, 20], 34: [10, 21] }
    : { 32: [11, 20], 33: [10, 21], 34: [9, 22] };
  g.spans(rows, dy, (x, y) => (y === 34 ? b.shadow : (x - 9) % 3 === 2 ? b.shadow : x <= 12 ? b.light : b.base));
}

// --- 외곽선 ------------------------------------------------------------------------

function outline(g: Grid): void {
  const edge: [number, number, RGB][] = [];
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      if (g.get(x, y)) continue;
      const n = g.get(x + 1, y) ?? g.get(x - 1, y) ?? g.get(x, y + 1) ?? g.get(x, y - 1);
      if (n) edge.push([x, y, mix(n, INK, 0.75)]);
    }
  for (const [x, y, col] of edge) g.set(x, y, col);
}

// --- 프레임·시트 ---------------------------------------------------------------------

/** 프레임 한 장. frame: 0 서기 · 1 한 발 · 2 서기 · 3 다른 발 */
function drawChibiFrame(a: Avatar, view: View, frame: number): (RGB | null)[] {
  const c = colors(a);
  const g = new Grid();
  const step = frame % 2 === 1;
  const dy = step ? 1 : 0; // 발을 내딛는 프레임은 몸이 1px 내려간다 — 통통 튀는 느낌
  const armSwing = frame === 1 ? 2 : frame === 3 ? -2 : 0;
  drawHairBehind(g, a, c, view, dy);
  drawLegs(g, a, c, view, frame, dy);
  drawBottom(g, a, c, view, dy);
  drawTop(g, a, c, view, dy, armSwing);
  drawHead(g, a, c, view, dy);
  if (a.hair === 'pigtails' && view === 'back') drawHairBehind(g, a, c, view, dy); // 뒷모습 양갈래는 머리 옆에 보인다
  if (a.hair === 'long' && view === 'back') drawLongBack(g, c, dy);
  outline(g);
  return g.px;
}

/** 뒷모습 긴 머리 — 등을 덮는다 */
function drawLongBack(g: Grid, c: Colors, dy: number): void {
  for (let y = 20 + dy; y <= 32 + dy; y++) {
    const w = 10.5 - Math.max(0, y - (28 + dy)) * 1.4;
    for (let x = Math.ceil(15.5 - w); x <= Math.floor(15.5 + w - 1); x++) {
      const edge = x <= 15.5 - w + 1 || x >= 15.5 + w - 2;
      g.set(x, y, y === 32 + dy ? c.hair.deep : edge || [9, 13, 18, 22].includes(x) ? c.hair.shadow : c.hair.base);
    }
  }
}

const VIEW_OF: Readonly<Record<Dir, View>> = { down: 'front', up: 'back', left: 'side', right: 'side' };

/**
 * 걷기 시트: 가로 FRAMES 칸(서기·한 발·서기·다른 발) × 세로 4방향(아래·위·왼쪽·오른쪽), RGBA.
 * 오른쪽은 왼쪽 옆모습의 좌우 반전.
 */
export function renderChibiSheet(a: Avatar): Uint8ClampedArray<ArrayBuffer> {
  const out = new Uint8ClampedArray(SHEET_W * SHEET_H * 4);
  DIRS.forEach((dir, row) => {
    for (let f = 0; f < FRAMES; f++) {
      const px = drawChibiFrame(a, VIEW_OF[dir], f);
      for (let y = 0; y < FRAME_H; y++)
        for (let x = 0; x < FRAME_W; x++) {
          const col = px[y * FRAME_W + (dir === 'right' ? FRAME_W - 1 - x : x)];
          if (!col) continue;
          const i = ((row * FRAME_H + y) * SHEET_W + f * FRAME_W + x) * 4;
          out[i] = col[0];
          out[i + 1] = col[1];
          out[i + 2] = col[2];
          out[i + 3] = 255;
        }
    }
  });
  return out;
}
