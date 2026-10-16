// 물체 종류의 모양 — 크기와 막는 칸. 충돌 판정에 쓰이므로 로비·서버가 같은 표를 본다. 순수 데이터 (room-map.ts 가 다시 내보낸다).
// 그림(시트 칸·층)은 로비 data/object-art.ts 몫 — 두 표의 종류는 같아야 한다 (타입이 강제).
// 크기는 칸 단위(16px) — 시트 한 칸(16px)이 로비에서는 2×2 칸으로 커지므로 크기는 모두 짝수다.
// 막는 칸은 그림마다 고르지 않고 규칙으로 (결정 2026-10-16: 물체 종류 늘리기) — 나무는 밑둥, 꽉 찬 것(바위·그루터기 등)은 아랫부분,
// 풀·꽃·바닥 무늬는 막지 않는다.
import type { Pos } from './room-map.ts';

/** 물체 종류의 모양 — 크기와 막는 칸 */
export interface ObjectShape {
  /** 칸 단위 크기 */
  readonly w: number;
  readonly h: number;
  /**
   * 지나갈 수 없는 칸들 — 물체의 왼쪽 아래 칸 기준 (x 는 오른쪽, y 는 위쪽으로 0 부터). 예: 4칸 폭 나무의 밑둥 [{1,0},{2,0}],
   * 6칸 폭 도리이의 두 기둥 [{1,0},{4,0}]. 그림의 실제 모양에 칸 단위로 맞춘다. 없으면 그림만 있고 지나갈 수 있다
   */
  readonly solid?: readonly Pos[];
}

/** 막지 않는다 — 풀·꽃·바닥 무늬 */
function open(w: number, h: number): ObjectShape {
  return { w, h };
}

/** 나무 — 맨 아랫줄 가운데 두 칸(밑둥)만 막는다. 잎 아래·뒤로는 지나간다 */
function trunk(w: number, h: number): ObjectShape {
  return { w, h, solid: [{ x: w / 2 - 1, y: 0 }, { x: w / 2, y: 0 }] };
}

/** 꽉 찬 것 — 아래에서 rows 줄을, 양옆 inset 칸씩 빼고 막는다 */
function base(w: number, h: number, rows = 1, inset = 0): ObjectShape {
  const solid: Pos[] = [];
  for (let y = 0; y < rows; y++) for (let x = inset; x < w - inset; x++) solid.push({ x, y });
  return { w, h, solid };
}

// 순서는 종류끼리 모아서 — 「물체 전시」 템플릿이 이 순서로 늘어놓는다. Nature 시트 (docs/assets.md) 의 혼자 서 있는 그림 전부.
// 키 큰 주황 나무(시트 12,16)는 잎이 옆 칸의 다른 그림과 겹쳐 잘라 쓸 수 없어 뺐다
const SHAPES = {
  // 처음 셋 — 템플릿이 쓰는 이름 그대로
  yard: open(6, 6), // 흙 마당 — 위를 밟고 지나간다
  tree: trunk(4, 4), // 뿌리 드러난 초록 나무
  torii: { w: 6, h: 4, solid: [{ x: 1, y: 0 }, { x: 4, y: 0 }] }, // 도리이 — 두 기둥, 기둥 사이로 지나간다

  // 나무 (2×2 시트 칸)
  'tree-green': trunk(4, 4),
  'tree-pine': trunk(4, 4),
  'tree-dead': trunk(4, 4),
  'tree-pine-snowy': trunk(4, 4),
  'tree-pine-snow': trunk(4, 4),
  'tree-snow': trunk(4, 4),
  'tree-pink': trunk(4, 4),
  'tree-lime': trunk(4, 4),
  'tree-lime-grass': trunk(4, 4),
  'tree-round': trunk(4, 4),
  // 큰 둥근 나무 (3×3)
  'tree-big-pink': trunk(6, 6),
  'tree-big-green': trunk(6, 6),
  'tree-big-snow': trunk(6, 6),
  'tree-big-orange': trunk(6, 6),
  // 나무 세 그루 무더기 (4×3) — 앞 두 그루의 밑둥 줄
  'grove-pine': base(8, 6, 1, 1),
  'grove-green': base(8, 6, 1, 1),
  'grove-snow': base(8, 6, 1, 1),
  'grove-pink': base(8, 6, 1, 1),
  'grove-lime': base(8, 6, 1, 1),
  'grove-lime-grass': base(8, 6, 1, 1),
  'grove-dead': base(8, 6, 1, 1),
  'grove-pine-snowy': base(8, 6, 1, 1),
  'grove-pine-snow': base(8, 6, 1, 1),
  // 대나무
  bamboo: base(2, 6),
  'bamboo-short': base(2, 4),

  // 그루터기·통나무
  'stump-dark': base(4, 4, 2),
  stump: base(4, 4, 2),
  'stump-small': base(2, 2),
  log: base(2, 2),
  'log-end': base(2, 2),
  'log-end-mossy': base(2, 2),
  'log-standing': base(2, 4),
  'log-standing-mossy': base(2, 4),
  // 다듬은 덤불
  'hedge-orange': base(2, 2),
  'hedge-orange-round': base(2, 2),
  hedge: base(2, 2),
  'hedge-round': base(2, 2),
  'berry-big-1': base(4, 4),
  'berry-big-2': base(4, 4),
  'berry-big-3': base(4, 4),
  'berry-big-4': base(4, 4),

  // 풀·꽃 — 막지 않는다
  'shrub-dead': open(2, 2),
  twig: open(2, 2),
  'bush-1': open(2, 2),
  'bush-2': open(2, 2),
  'bush-3': open(2, 2),
  'bush-4': open(2, 2),
  'bush-5': open(2, 2),
  'grass-1': open(2, 2),
  'grass-2': open(2, 2),
  'grass-3': open(2, 2),
  'grass-4': open(2, 2),
  'grass-5': open(2, 2),
  'grass-6': open(2, 2),
  'grass-tall': open(2, 2),
  'fern-1': open(2, 2),
  'fern-2': open(2, 2),
  sunflower: open(2, 2),
  'sunflower-2': open(2, 2),
  clover: open(2, 2),
  'flower-red': open(2, 2),
  'flower-white': open(2, 2),
  'leafy-1': open(2, 2),
  'leafy-2': open(2, 2),
  'leaf-orange': open(2, 2),
  'leaf-teal': open(2, 2),
  'leaf-pink': open(2, 2),
  'leaf-green': open(2, 2),
  'berry-1': open(2, 2),
  'berry-2': open(2, 2),
  'berry-3': open(2, 2),
  'berry-4': open(2, 2),
  'berry-5': open(2, 2),
  'berry-6': open(2, 2),
  'berry-7': open(2, 2),
  'berry-8': open(2, 2),
  'berry-9': open(2, 2),
  'berry-10': open(2, 2),
  'berry-11': open(2, 2),
  'berry-12': open(2, 2),
  'sprout-orange': open(2, 2),
  'sprout-olive': open(2, 2),
  'sprout-orange-2': open(2, 2),
  'sprout-olive-2': open(2, 2),
  'gem-orange': open(2, 2),
  'gem-teal': open(2, 2),
  'gem-pink': open(2, 2),
  'gem-lime': open(2, 2),

  // 수정 덩어리
  'crystal-orange': base(2, 2),
  'crystal-teal': base(2, 2),
  'crystal-pink': base(2, 2),
  'crystal-lime': base(2, 2),

  // 바위
  'rock-brown': base(4, 4, 2),
  'rock-brown-small': base(2, 2),
  'rock-gray': base(4, 4, 2),
  'rock-gray-small': base(2, 2),
  'rock-pile-brown': base(8, 6, 2),
  'rock-pile-gray': base(8, 6, 2),
  'boulder-teal': base(4, 4, 2),
  'boulder-snow': base(4, 4, 2),
  'rock-snowy': base(2, 2),
  'rock-white': base(2, 2),
  'spikes-teal': base(2, 2),
  'rock-teal-sharp': base(2, 2),
  'rock-teal': base(2, 2),
  'spikes-snowy': base(2, 2),
  'snow-pile': open(2, 2),
  'block-tan': base(2, 2),
  'rock-orange': base(2, 2),
  'rock-orange-2': base(2, 2),
  snowball: base(2, 2),
  'stone-ball': base(2, 2),
  'boulder-brown': base(4, 4, 2),
  'boulder-brown-2': base(4, 4, 2),
  'cliff-brown': base(8, 6, 3),
  'pillar-brown': base(4, 6, 3),
  'stone-brown-1': base(2, 2),
  'stone-brown-2': base(2, 2),
  'stone-brown-3': base(2, 2),
  'boulder-gray': base(4, 4, 2),
  'boulder-gray-2': base(4, 4, 2),
  'cliff-gray': base(8, 6, 3),
  'pillar-gray': base(4, 6, 3),
  'stone-gray-1': base(2, 2),
  'stone-gray-2': base(2, 2),
  'stone-gray-3': base(2, 2),

  // 바닥 무늬 — 바닥 층, 막지 않는다 (구멍만 막는다)
  'pebbles-pale': open(2, 2),
  'pebbles-1': open(2, 2),
  'pebbles-2': open(2, 2),
  'pebbles-3': open(2, 2),
  'pebbles-4': open(2, 2),
  'ice-1': open(2, 2),
  'ice-2': open(2, 2),
  pit: base(2, 2, 2),

  // --- House 시트 — 혼자 서 있는 그림 (울타리·담·마루·벽에 거는 것·벽 조각은 뺐다) ---

  // 건물 — 정면 아랫부분을 막고 지붕 뒤로는 지나간다. 입구는 그림일 뿐 게임 문이 아니다
  'house-orange': base(8, 6, 2),
  'house-tan': base(8, 6, 2),
  'house-orange-tan': base(8, 6, 2),
  'house-red': base(8, 6, 2),
  shop: base(6, 6, 2),
  'house-green': base(8, 6, 2),
  'house-stone': base(6, 6, 2),
  'house-wood': base(6, 6, 2),
  'house-hall': base(8, 8, 2),
  'house-wood-tall': base(8, 10, 2),
  'hut-round': base(6, 8, 2),
  'hut-mud': base(6, 6, 2),
  'hut-straw': base(6, 4, 2),
  'hut-wood': base(6, 6, 2),
  tent: base(8, 10, 2), // 시트 25,12 의 두 줄은 한 층을 더 쌓는 조각이라 뺐다
  igloo: base(6, 6, 2),
  'igloo-small': base(6, 6, 2),
  'ice-house': base(6, 6, 2),
  'arch-stone': { w: 6, h: 6, solid: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 4, y: 0 }, { x: 5, y: 0 }, { x: 0, y: 1 }, { x: 1, y: 1 }, { x: 4, y: 1 }, { x: 5, y: 1 }] }, // 돌 아치 — 두 다리, 가운데로 지나간다

  // 석상 — 모래색·돌색 같은 모양 두 벌
  'statue-pillar-sand': base(2, 6),
  'statue-face-sand': base(4, 6, 2),
  'statue-orb-sand': base(4, 4, 2),
  'statue-buddha-sand': base(4, 4, 2),
  'statue-figure-sand': base(2, 4),
  'statue-plant-sand': base(2, 4),
  'statue-frog-sand': base(4, 4, 2),
  'statue-guardian-sand': base(4, 4, 2),
  'statue-pedestal-sand': base(2, 4),
  'statue-snowcap-sand': base(2, 4),
  'statue-block-sand': base(2, 2),
  'statue-pillar-stone': base(2, 6),
  'statue-face-stone': base(4, 6, 2),
  'statue-orb-stone': base(4, 4, 2),
  'statue-buddha-stone': base(4, 4, 2),
  'statue-figure-stone': base(2, 4),
  'statue-plant-stone': base(2, 4),
  'statue-frog-stone': base(4, 4, 2),
  'statue-guardian-stone': base(4, 4, 2),
  'statue-pedestal-stone': base(2, 4),
  'statue-snowcap-stone': base(2, 4),
  'statue-block-stone': base(2, 2),

  // 기둥·가구
  'column-giant': base(6, 12, 2),
  column: base(4, 10, 2),
  'column-thin': base(2, 6),
  desk: base(6, 6, 2),
  shelf: base(6, 6, 2),
  'table-big': base(6, 6, 2),
  cabinet: base(6, 6, 2),
  'table-long': base(6, 4),
  'table-long-dark': base(6, 4),
  'bench-v': base(2, 6, 6),
  'bench-h': base(6, 2),
  'bench-long': base(4, 2),
  workbench: base(4, 4, 2),
  'workbench-small': base(4, 2),
  'counter-pot': base(4, 2),
  'oven-clay': base(4, 4, 2),
  'oven-stone': base(4, 4, 2),
  kiln: base(4, 6, 2),
  anvil: base(2, 2),
  'weapon-rack': base(4, 4),
  'weapon-rack-2': base(4, 4),

  // 통·자루·상자·항아리
  barrel: base(2, 2),
  'barrel-open': base(2, 2),
  cask: base(2, 4),
  'cask-open': base(2, 4),
  'cask-2': base(2, 4),
  'bucket-water': base(2, 2),
  'bucket-greens': base(2, 2),
  'bucket-apples': base(2, 2),
  'bucket-swords': base(2, 4),
  'sack-big': base(4, 4, 2),
  'sack-white': base(2, 2),
  'sack-tied': base(2, 4),
  'sack-long': base(2, 4),
  'sack-grain': base(2, 2),
  'sack-orange': base(2, 2),
  pouch: base(2, 2),
  'crate-berries': base(2, 2),
  'crate-goods': base(2, 2),
  crate: base(2, 2),
  'crate-goods-2': base(2, 2),
  'crate-dark-1': base(2, 2),
  'crate-dark-2': base(2, 2),
  'crate-long': base(4, 2),
  'crate-wide': base(4, 2),
  'crate-small': base(2, 2),
  'jar-heart': base(2, 2),
  'jar-skull': base(2, 2),
  'jar-green': base(2, 2),
  jar: base(2, 2),
  'cauldron-soup': base(2, 2),
  cauldron: base(2, 2),
  'pot-soup': base(2, 2),
  pot: base(2, 2),
  kettle: base(2, 2),
  lid: base(2, 2),
  'plate-food': base(2, 2),
  plate: base(2, 2),
  basket: base(2, 2),
  'basket-tipped': base(2, 2),
  'scroll-bag': base(2, 2),
  bread: base(2, 2),
  cloth: base(2, 2),
  stool: base(2, 2),
  'stool-2': base(2, 2),
  plank: base(2, 4),
  lantern: base(2, 2),
  signpost: base(2, 2),
  idol: base(2, 2),

  // 깃발
  'banner-white': base(2, 4),
  'banner-red': base(2, 4),
  'banner-teal': base(2, 4),
  'banner-green': base(2, 4),
  'banner-crimson': base(2, 4),
  'banner-purple': base(2, 4),
  'banner-yellow': base(2, 4),
} satisfies Record<string, ObjectShape>;

export type ObjectKind = keyof typeof SHAPES;

export const OBJECT_SHAPES: Readonly<Record<ObjectKind, ObjectShape>> = SHAPES;
