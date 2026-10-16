// 로비 물체 — 바닥·정렬 층에 두어 ZEP 식 앞뒤 가림을 눈으로 확인한다. 위치·크기는 칸(타일의 1/2),
// 그림은 Ninja Adventure 시트의 칸 (docs/assets.md).
import type { MapObject } from '../world/objects';

/** 물체 종류 — 그림·크기·층·막는 칸. 놓을 때는 id 와 왼쪽 아래 칸만 정한다 */
type ObjectKind = Omit<MapObject, 'id' | 'x' | 'y'>;

const KINDS = {
  // 흙 마당 — 캐릭터가 위를 밟고 지나간다
  yard: { layer: 'floor', w: 6, h: 6, sprite: { sheet: 'floor', col: 0, row: 7 } },
  // 2타일 폭 나무 — 아랫줄 가운데 두 칸(밑둥)만 막는다. 위로 지나가면 나무가 캐릭터를 가리고, 아랫줄 앞으로 지나가면 캐릭터가 앞
  tree: { layer: 'sorted', w: 4, h: 4, sprite: { sheet: 'nature', col: 6, row: 0 }, solid: [{ x: 1, y: 0 }, { x: 2, y: 0 }] },
  // 도리이 문 — 나무처럼 정렬 층. 두 기둥(아랫줄 1·4번 칸)만 막고 기둥 사이 두 칸으로 지나간다
  torii: { layer: 'sorted', w: 6, h: 4, sprite: { sheet: 'house', col: 0, row: 5 }, solid: [{ x: 1, y: 0 }, { x: 4, y: 0 }] },
} satisfies Record<string, ObjectKind>;

function place(kind: keyof typeof KINDS, id: string, x: number, y: number): MapObject {
  return { ...KINDS[kind], id, x, y };
}

// 자리는 칸 — 타일 (tx, ty) 의 왼쪽 아래 칸은 (2·tx, 2·ty + 1)
export const LOBBY_OBJECTS: readonly MapObject[] = [
  place('yard', 'yard', 18, 9), // 가운데 문 앞
  place('tree', 'tree-left', 8, 11),
  place('tree', 'tree-right', 32, 11),
  place('torii', 'torii', 4, 27),
];
