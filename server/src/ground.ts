// 바닥 재질 — 방 데이터의 32px 타일마다 한 글자(테마 × 바닥/길), 그리고 타일마다 찍을 Floor 시트 칸 고르기.
// 순수 모듈, node·DOM 을 import 하지 않는다 (로비 src/ 도 쓴다 — 모두가 같은 칸을 같은 그림으로 보게).
// 바닥은 구역의 바깥 재질, 길은 그 위에 까는 안쪽 재질 — 길의 가장자리 조각은 이웃 길을 보고 저절로 고른다(autotile).
// 같은 재질 안의 무늬는 타일 좌표로 고정된 무작위 (결정 2026-10-23: 바닥 재질 칠하기).
// Floor 시트는 재질 구역 여덟(가로 둘 × 세로 넷, 구역마다 11열 × 7줄)이고 구역마다 배치가 같다 — room-templates.ts 「바닥 재질」.

/** Floor 시트 칸 — 왼쪽 위가 (0, 0) */
export interface SheetCell {
  readonly col: number;
  readonly row: number;
}

interface GroundTheme {
  /** 구역 왼쪽 위 시트 칸 — 길 조각은 여기서 상대 자리로 찾는다 */
  readonly col: number;
  readonly row: number;
  /** 바닥 칸 — [0] 바탕, 나머지 무늬 (시트 절대 자리) */
  readonly floor: readonly SheetCell[];
  /** 길 가운데의 무늬 (구역 상대 자리) — 바탕은 (1, 1) */
  readonly pathVariants: readonly SheetCell[];
  /** 혼자 떨어진 길 한 타일 조각 (3, 3) 이 있는가 — 얼음·진흙 구역엔 없어 가운데로 대신한다 */
  readonly dot: boolean;
}

/** 흰 바탕이 아닌 구역 여섯은 구역 상대 줄 5 에 바닥 바탕·무늬 넷, 줄 4 에 길 무늬(막대·조약돌)가 있다 (줄은 0 부터) */
function zone(col: number, row: number): GroundTheme {
  return {
    col,
    row,
    floor: [0, 1, 2, 3, 4].map((dc) => ({ col: col + dc, row: row + 5 })),
    pathVariants: [{ col: 0, row: 4 }, { col: 1, row: 4 }],
    dot: true,
  };
}

// 얼음·진흙 구역은 바깥이 흰 바탕이고 무늬 줄이 없다 — 바닥은 얼음 구역 아래 순백 칸
const WHITE: SheetCell = { col: 0, row: 25 };

function whiteZone(col: number, row: number): GroundTheme {
  return { col, row, floor: [WHITE], pathVariants: [], dot: false };
}

/** 테마 글자 — 소문자 = 바닥, 대문자 = 같은 테마의 길. 이 순서가 편집 붓 순서 */
export const GROUND_THEMES = {
  s: zone(0, 0), // 모래 · 옅은 모래
  p: zone(11, 0), // 분홍 모래 · 옅은 분홍
  g: zone(0, 7), // 풀 · 흙
  d: zone(11, 7), // 짙은 풀 · 짙은 흙
  n: zone(0, 14), // 눈 · 흰 눈
  b: zone(11, 14), // 갈색 흙 · 마루
  i: whiteZone(0, 21), // 흰 바탕 · 얼음
  c: whiteZone(11, 21), // 흰 바탕 · 진흙
} as const satisfies Record<string, GroundTheme>;

export type GroundThemeKey = keyof typeof GROUND_THEMES;

/** 재질 없는 타일 — 아무것도 굽지 않아 장면 바탕색 */
export const NO_GROUND = '.';

/** 재질 맵의 크기 — 32px 타일 하나에 한 글자, 칸(16px) 맵의 반(홀수면 올림) */
export function groundSize(mapWidth: number, mapHeight: number): { readonly width: number; readonly height: number } {
  return { width: Math.ceil(mapWidth / 2), height: Math.ceil(mapHeight / 2) };
}

/** 재질 없는 재질 맵 — 칸 맵 크기 기준 */
export function blankGround(mapWidth: number, mapHeight: number): string[] {
  const { width, height } = groundSize(mapWidth, mapHeight);
  return Array.from({ length: height }, () => NO_GROUND.repeat(width));
}

function isGroundChar(ch: string): boolean {
  return ch === NO_GROUND || Object.hasOwn(GROUND_THEMES, ch.toLowerCase());
}

/** 재질 맵이 칸 맵 크기에 맞고 아는 글자만 쓰는지 — 틀리면 throw (buildRoom 이 부른다) */
export function checkGround(ground: readonly string[], mapWidth: number, mapHeight: number): void {
  const { width, height } = groundSize(mapWidth, mapHeight);
  if (ground.length !== height) throw new Error(`재질 맵 ${ground.length}줄 — 칸 맵 ${mapHeight}줄이면 ${height}줄이어야 한다`);
  ground.forEach((line, ty) => {
    if (line.length !== width) throw new Error(`재질 맵 ${ty}번 줄 길이 ${line.length} — ${width} 이어야 한다`);
    [...line].forEach((ch, tx) => {
      if (!isGroundChar(ch)) throw new Error(`재질 맵 (${tx}, ${ty}) 의 모르는 글자 '${ch}'`);
    });
  });
}

/** 위치마다 고정된 값 — 새로고침해도, 누가 봐도 무늬가 같은 자리에 있게 */
function hash(x: number, y: number): number {
  return (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
}

/**
 * 타일 (tx, ty) 에 찍을 것 — cells[0] 이 바탕, 나머지는 무늬. 무늬는 4/16 — 더 많으면 지저분하다.
 * 같은 자리는 늘 같은 것이라 채움을 겹쳐 깔아도 이음매가 생기지 않는다
 */
export function pickVariant<T>(cells: readonly T[], tx: number, ty: number): T | undefined {
  const variants = cells.length - 1;
  if (variants <= 0) return cells[0];
  const h = hash(tx, ty) % 16;
  return h < 4 ? cells[1 + (h % variants)] : cells[0];
}

/** 같은 테마의 길 이웃에 따른 길 조각 (구역 상대 자리). 한 타일 폭 띠·끝·T 자도 시트 조각으로 */
function pathPiece(theme: GroundTheme, has: (dx: number, dy: number) => boolean, tx: number, ty: number): SheetCell {
  const n = has(0, -1);
  const s = has(0, 1);
  const w = has(-1, 0);
  const e = has(1, 0);
  const at = (col: number, row: number): SheetCell => ({ col, row });
  if (n && s && w && e) {
    // 대각선이 비면 안쪽 모서리
    if (!has(-1, -1)) return at(6, 2);
    if (!has(1, -1)) return at(5, 2);
    if (!has(-1, 1)) return at(6, 1);
    if (!has(1, 1)) return at(5, 1);
    return pickVariant([at(1, 1), ...theme.pathVariants], tx, ty) ?? at(1, 1);
  }
  if (s && w && e) return at(1, 0);
  if (n && w && e) return at(1, 2);
  if (n && s && e) return at(0, 1);
  if (n && s && w) return at(2, 1);
  if (s && e) return at(0, 0);
  if (s && w) return at(2, 0);
  if (n && e) return at(0, 2);
  if (n && w) return at(2, 2);
  if (n && s) return at(3, 1);
  if (s) return at(3, 0);
  if (n) return at(3, 2);
  if (w && e) return at(1, 3);
  if (e) return at(0, 3);
  if (w) return at(2, 3);
  return theme.dot ? at(3, 3) : at(1, 1);
}

/** 재질 타일 하나 — 타일 자리와 찍을 시트 칸 */
export interface GroundTile extends SheetCell {
  readonly tx: number;
  readonly ty: number;
}

/**
 * 재질 맵의 타일마다 찍을 Floor 시트 칸 — 위→아래, 왼→오른 순서, 재질 없는 타일은 뺀다.
 * 바닥은 바탕·무늬 중 하나, 길은 같은 테마 길 이웃을 보고 가장자리·안쪽 모서리·가운데. 맵 밖은 길이 아닌 것으로 본다
 */
export function groundTiles(ground: readonly string[]): GroundTile[] {
  const out: GroundTile[] = [];
  ground.forEach((line, ty) => {
    [...line].forEach((ch, tx) => {
      const theme: GroundTheme | undefined = GROUND_THEMES[ch.toLowerCase() as GroundThemeKey];
      if (ch === NO_GROUND || theme === undefined) return;
      if (ch === ch.toLowerCase()) {
        const cell = pickVariant(theme.floor, tx, ty) ?? theme.floor[0] ?? WHITE;
        out.push({ tx, ty, col: cell.col, row: cell.row });
        return;
      }
      const has = (dx: number, dy: number): boolean => ground[ty + dy]?.[tx + dx] === ch;
      const piece = pathPiece(theme, has, tx, ty);
      out.push({ tx, ty, col: theme.col + piece.col, row: theme.row + piece.row });
    });
  });
  return out;
}
