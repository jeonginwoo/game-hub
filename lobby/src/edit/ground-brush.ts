// 편집 도구 — 바닥 재질 붓: 테마·바닥/길 이름, 칸 → 타일, 재질 맵 한 타일 칠하기. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-23: 바닥 재질 칠하기 · 2026-10-25: 바닥 재질 = 방 데이터 ground)
import { GROUND_THEMES, type GroundThemeKey } from '../../../server/src/ground';
import { buildRoom, type Pos, type RoomData } from '../../../server/src/room-map';

/** 재질 붓 — 테마 글자 + 바닥(소문자)·길(대문자) */
export interface GroundBrush {
  readonly theme: GroundThemeKey;
  readonly path: boolean;
}

/** 테마마다 보일 이름 — 테마 이름, 바닥 재질, 길 재질. GROUND_THEMES 와 같은 순서 (얼음·진흙은 바닥이 흰 바탕) */
const NAMES: Readonly<Record<GroundThemeKey, readonly [string, string, string]>> = {
  s: ['모래', '모래', '옅은 모래'],
  p: ['분홍 모래', '분홍 모래', '옅은 분홍 모래'],
  g: ['풀', '풀', '흙'],
  d: ['짙은 풀', '짙은 풀', '짙은 흙'],
  n: ['눈', '눈', '흰 눈'],
  b: ['갈색 흙', '갈색 흙', '마루'],
  i: ['얼음', '흰 바탕', '얼음'],
  c: ['진흙', '흰 바탕', '진흙'],
};

/** 붓 창 왼쪽 목록 — 테마 여덟, GROUND_THEMES 순서 */
export const GROUND_BRUSH_THEMES: readonly { readonly theme: GroundThemeKey; readonly name: string }[] = (
  Object.keys(GROUND_THEMES).filter((k): k is GroundThemeKey => Object.hasOwn(NAMES, k))
).map((theme) => ({ theme, name: NAMES[theme][0] }));

/** 붓이 칠할 재질 맵 글자 — 소문자 바닥, 대문자 길 */
export function groundChar(b: GroundBrush): string {
  return b.path ? b.theme.toUpperCase() : b.theme;
}

/** 붓 창 썸네일 아래 이름 — 「바닥 · 풀」「길 · 흙」 */
export function brushPartName(b: GroundBrush): string {
  const [, floor, path] = NAMES[b.theme];
  return b.path ? `길 · ${path}` : `바닥 · ${floor}`;
}

/** 창 열기 버튼 글 — 「풀 바닥」「풀 길」 */
export function brushName(b: GroundBrush): string {
  return `${NAMES[b.theme][0]} ${b.path ? '길' : '바닥'}`;
}

/** 칸(16px) → 그 칸을 덮는 재질 타일(32px) */
export function tileOf(cell: Pos): Pos {
  return { x: Math.floor(cell.x / 2), y: Math.floor(cell.y / 2) };
}

/** 재질 맵의 타일 at 을 ch 로 바꾼 새 방 데이터 — 맵 밖·이미 그 글자면 throw (초안 고치기가 던지면 그대로). 결과는 buildRoom 으로 검사 */
export function paintGround(data: RoomData, at: Pos, ch: string): RoomData {
  const line = data.ground[at.y];
  if (line === undefined || at.x < 0 || at.x >= line.length) throw new Error(`재질 타일 (${at.x}, ${at.y}) 은 맵 밖이다`);
  if (line[at.x] === ch) throw new Error(`재질 타일 (${at.x}, ${at.y}) 은 이미 '${ch}'`);
  const ground = data.ground.map((r, y) => (y === at.y ? r.slice(0, at.x) + ch + r.slice(at.x + 1) : r));
  const next: RoomData = { ...data, ground };
  buildRoom(next);
  return next;
}
