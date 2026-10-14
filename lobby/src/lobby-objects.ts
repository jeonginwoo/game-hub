// 로비 물체 (임시) — 층마다 하나 이상 두어 ZEP 식 앞뒤 가림을 눈으로 확인한다. 위치는 lobby-map.ts 의 칸.
import type { MapObject } from './objects';

export const LOBBY_OBJECTS: readonly MapObject[] = [
  // 가운데 문 앞 깔개 — 캐릭터가 위를 밟고 지나간다
  { id: 'rug', layer: 'floor', x: 9, y: 3, w: 3, h: 2, color: 0xa3505b },
  // '##' 덩어리 위의 나무 — 위쪽 줄에 서면 캐릭터 아랫부분이 가려지고, 아래쪽 줄에 서면 캐릭터가 앞
  { id: 'tree-left', layer: 'sorted', x: 4, y: 5, w: 2, h: 3, color: 0x2e6b3a },
  { id: 'tree-right', layer: 'sorted', x: 16, y: 5, w: 2, h: 3, color: 0x2e6b3a },
  // 머리 위 들보 — 바닥 칸 위에 걸려 있어 그 밑을 지나가면 늘 캐릭터를 덮는다
  { id: 'beam', layer: 'top', x: 2, y: 13, w: 5, h: 1, color: 0x7a5534 },
];
