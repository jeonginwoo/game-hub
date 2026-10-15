// 로비 물체 — 층마다 하나 이상 두어 ZEP 식 앞뒤 가림을 눈으로 확인한다. 위치는 lobby-map.ts 의 칸,
// 그림은 Ninja Adventure 시트의 칸 (docs/assets.md).
import type { MapObject } from './objects';

export const LOBBY_OBJECTS: readonly MapObject[] = [
  // 가운데 문 앞 흙 마당 — 캐릭터가 위를 밟고 지나간다
  { id: 'yard', layer: 'floor', x: 9, y: 4, w: 3, h: 3, sprite: { sheet: 'floor', col: 0, row: 7 } },
  // 풀밭의 나무 — 밑둥 줄(아래 줄)만 막는다. 윗줄(잎 뒤)로 지나가면 나무가 캐릭터를 가리고, 아래 줄 앞으로 지나가면 캐릭터가 앞
  { id: 'tree-left', layer: 'sorted', x: 4, y: 5, w: 2, h: 2, sprite: { sheet: 'nature', col: 6, row: 0 }, solid: { w: 2, h: 1 } },
  { id: 'tree-right', layer: 'sorted', x: 16, y: 5, w: 2, h: 2, sprite: { sheet: 'nature', col: 6, row: 0 }, solid: { w: 2, h: 1 } },
  // 도리이 문 — 바닥 칸 위에 서 있지만 상단 층이라 그 밑을 지나가면 늘 캐릭터를 덮는다
  { id: 'torii', layer: 'top', x: 2, y: 13, w: 3, h: 2, sprite: { sheet: 'house', col: 0, row: 5 } },
];
