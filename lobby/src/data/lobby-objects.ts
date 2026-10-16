// 로비 물체 — 바닥·정렬 층에 두어 ZEP 식 앞뒤 가림을 눈으로 확인한다. 위치는 lobby-map.ts 의 칸,
// 그림은 Ninja Adventure 시트의 칸 (docs/assets.md).
import type { MapObject } from '../world/objects';

/** 물체 종류 — 그림·크기·층·막는 칸. 놓을 때는 id 와 왼쪽 아래 칸만 정한다 */
type ObjectKind = Omit<MapObject, 'id' | 'x' | 'y'>;

const KINDS = {
  // 흙 마당 — 캐릭터가 위를 밟고 지나간다
  yard: { layer: 'floor', w: 3, h: 3, sprite: { sheet: 'floor', col: 0, row: 7 } },
  // 2칸 폭 나무 — 밑둥 줄(아래 줄)만 막는다. 윗줄(잎 뒤)로 지나가면 나무가 캐릭터를 가리고, 아래 줄 앞으로 지나가면 캐릭터가 앞
  tree: { layer: 'sorted', w: 2, h: 2, sprite: { sheet: 'nature', col: 6, row: 0 }, solid: [{ x: 0, y: 0 }, { x: 1, y: 0 }] },
  // 도리이 문 — 나무처럼 정렬 층. 두 기둥(아래 줄 양 끝)만 막고 가운데 칸으로 지나간다
  torii: { layer: 'sorted', w: 3, h: 2, sprite: { sheet: 'house', col: 0, row: 5 }, solid: [{ x: 0, y: 0 }, { x: 2, y: 0 }] },
} satisfies Record<string, ObjectKind>;

function place(kind: keyof typeof KINDS, id: string, x: number, y: number): MapObject {
  return { ...KINDS[kind], id, x, y };
}

export const LOBBY_OBJECTS: readonly MapObject[] = [
  place('yard', 'yard', 9, 4), // 가운데 문 앞
  place('tree', 'tree-left', 4, 5),
  place('tree', 'tree-right', 16, 5),
  place('torii', 'torii', 2, 13),
];
