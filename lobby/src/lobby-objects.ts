// 로비 물체 — 바닥·정렬 층에 두어 ZEP 식 앞뒤 가림을 눈으로 확인한다. 위치는 lobby-map.ts 의 칸,
// 그림은 Ninja Adventure 시트의 칸 (docs/assets.md).
import type { MapObject } from './objects';

const TRUNK = [{ x: 0, y: 0 }, { x: 1, y: 0 }]; // 2칸 폭 나무의 밑둥 줄

export const LOBBY_OBJECTS: readonly MapObject[] = [
  // 가운데 문 앞 흙 마당 — 캐릭터가 위를 밟고 지나간다
  { id: 'yard', layer: 'floor', x: 9, y: 4, w: 3, h: 3, sprite: { sheet: 'floor', col: 0, row: 7 } },
  // 풀밭의 나무 — 밑둥 줄(아래 줄)만 막는다. 윗줄(잎 뒤)로 지나가면 나무가 캐릭터를 가리고, 아래 줄 앞으로 지나가면 캐릭터가 앞
  { id: 'tree-left', layer: 'sorted', x: 4, y: 5, w: 2, h: 2, sprite: { sheet: 'nature', col: 6, row: 0 }, solid: TRUNK },
  { id: 'tree-right', layer: 'sorted', x: 16, y: 5, w: 2, h: 2, sprite: { sheet: 'nature', col: 6, row: 0 }, solid: TRUNK },
  // 도리이 문 — 나무처럼 정렬 층. 두 기둥(아래 줄 양 끝)만 막고 가운데 칸으로 지나간다
  { id: 'torii', layer: 'sorted', x: 2, y: 13, w: 3, h: 2, sprite: { sheet: 'house', col: 0, row: 5 }, solid: [{ x: 0, y: 0 }, { x: 2, y: 0 }] },
];
