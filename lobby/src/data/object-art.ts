// 물체 종류별 그림 — 층과 Ninja Adventure 시트의 칸 (docs/assets.md). 크기·막는 칸은 공용 표 OBJECT_SHAPES(server/src/room-map.ts).
import type { ObjectKind } from '../../../server/src/room-map';
import type { ObjectArt } from '../world/objects';

export const OBJECT_ART: Readonly<Record<ObjectKind, ObjectArt>> = {
  // 흙 마당 — 캐릭터가 위를 밟고 지나간다
  yard: { layer: 'floor', sprite: { sheet: 'floor', col: 0, row: 7 } },
  // 2타일 폭 나무 — 위로 지나가면 나무가 캐릭터를 가리고, 아랫줄 앞으로 지나가면 캐릭터가 앞
  tree: { layer: 'sorted', sprite: { sheet: 'nature', col: 6, row: 0 } },
  // 도리이 문 — 나무처럼 정렬 층
  torii: { layer: 'sorted', sprite: { sheet: 'house', col: 0, row: 5 } },
};
