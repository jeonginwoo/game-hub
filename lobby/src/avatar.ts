// 캐릭터 꾸미기 값 — 헤어·옷 모양과 색을 고른다 (ZEP 식). 데이터와 순수 함수만.
// 그림은 chibi.ts 가 이 값으로 직접 찍는다 — 외부 에셋 없음.

export type HairStyle = 'short' | 'bob' | 'long' | 'pigtails';
export type TopStyle = 'tshirt' | 'hoodie';
export type BottomStyle = 'pants' | 'skirt';

/** 저장·전송되는 꾸미기 값. 모든 값은 AVATAR_OPTIONS 의 키 */
export interface Avatar {
  readonly skin: string;
  readonly eyeColor: string;
  readonly hair: HairStyle;
  readonly hairColor: string;
  readonly top: TopStyle;
  readonly topColor: string;
  readonly bottom: BottomStyle;
  readonly bottomColor: string;
  readonly shoesColor: string;
}

export const SKIN_COLORS: Readonly<Record<string, string>> = {
  porcelain: '#fbe3d3',
  peach: '#f6cfb4',
  tan: '#e2aa82',
  brown: '#b97c55',
  dark: '#7d5038',
};

export const EYE_COLORS: Readonly<Record<string, string>> = {
  brown: '#8a5a3c',
  blue: '#4a74d9',
  green: '#3f9a63',
  pink: '#d94a7a',
  purple: '#8a5ad0',
  gray: '#5a6a8a',
};

export const HAIR_COLORS: Readonly<Record<string, string>> = {
  black: '#3c3546',
  brown: '#8a5a3c',
  chestnut: '#a8582e',
  blonde: '#f2d27a',
  orange: '#ee8c46',
  red: '#d6504a',
  pink: '#f29bc0',
  purple: '#a383dc',
  blue: '#6593e3',
  mint: '#83d6bd',
  silver: '#dcdbe6',
};

export const CLOTH_COLORS: Readonly<Record<string, string>> = {
  white: '#f3f2f6',
  gray: '#a4a3ae',
  black: '#3d3946',
  red: '#e0565d',
  orange: '#f29d50',
  yellow: '#f5d765',
  green: '#6fbf76',
  mint: '#91dfc9',
  sky: '#82c5f0',
  blue: '#4f78d6',
  navy: '#3d4a7a',
  purple: '#9c74d6',
  pink: '#f39fc5',
  brown: '#8c5c3e',
};

/** 꾸미기 화면이 보여 줄 선택지 — 키 목록 */
export const AVATAR_OPTIONS: { readonly [K in keyof Avatar]: readonly string[] } = {
  skin: Object.keys(SKIN_COLORS),
  eyeColor: Object.keys(EYE_COLORS),
  hair: ['short', 'bob', 'long', 'pigtails'] satisfies HairStyle[],
  hairColor: Object.keys(HAIR_COLORS),
  top: ['tshirt', 'hoodie'] satisfies TopStyle[],
  topColor: Object.keys(CLOTH_COLORS),
  bottom: ['pants', 'skirt'] satisfies BottomStyle[],
  bottomColor: Object.keys(CLOTH_COLORS),
  shoesColor: Object.keys(CLOTH_COLORS),
};

/** 처음 들어온 사람의 기본 캐릭터 */
export const DEFAULT_AVATAR: Avatar = {
  skin: 'peach',
  eyeColor: 'blue',
  hair: 'short',
  hairColor: 'brown',
  top: 'tshirt',
  topColor: 'white',
  bottom: 'pants',
  bottomColor: 'navy',
  shoesColor: 'brown',
};

/**
 * 밖에서 온 값(저장소·네트워크)을 꾸미기 값으로. 항목별로 검사해 모르는 값만 기본값으로 되돌린다
 * — 선택지가 바뀌어도 나머지 꾸미기는 남게.
 */
export function parseAvatar(raw: unknown): Avatar {
  const src = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : {};
  const out: Record<string, string> = {};
  for (const key of Object.keys(AVATAR_OPTIONS) as (keyof Avatar)[]) {
    const v = src[key];
    out[key] = typeof v === 'string' && AVATAR_OPTIONS[key].includes(v) ? v : DEFAULT_AVATAR[key];
  }
  return out as unknown as Avatar;
}

/** 브라우저에 저장된 문자열 → 꾸미기 값. 없거나 깨졌으면 기본 캐릭터 */
export function avatarFromStored(text: string | null): Avatar {
  if (text === null) return DEFAULT_AVATAR;
  try {
    return parseAvatar(JSON.parse(text));
  } catch {
    return DEFAULT_AVATAR;
  }
}

export const AVATAR_STORAGE_KEY = 'game-hub.avatar';
