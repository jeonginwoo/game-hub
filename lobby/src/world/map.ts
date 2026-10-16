// 타일맵 — 문자열 줄 배열을 해석한다. 렌더링·Three.js 와 무관한 순수 데이터.
// 문자 한 글자 = 칸 하나(16px). 그림(32px 타일)은 크기 그대로 칸 TILE_CELLS × TILE_CELLS 에 걸쳐 그린다 (tiles.ts).
// 좌표는 칸 단위, x 는 오른쪽, y 는 아래쪽(줄 번호)으로 증가한다.

export type Tile = 'wall' | 'floor' | 'door';

/** 그림 타일(32px) 한 변의 칸 수 — 걷기·충돌은 칸, 그림 크기는 타일 그대로 (결정 2026-10-16: 칸 2배 밀도) */
export const TILE_CELLS = 2;

export interface Pos {
  readonly x: number;
  readonly y: number;
}

/** 문 하나 — 상하좌우로 붙은 'D' 칸 묶음. 자리는 묶음을 감싸는 사각형 */
export interface Door {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TileMap {
  /** 칸 단위 크기 */
  readonly width: number;
  readonly height: number;
  /** 시작점 칸들 — 하나 이상, 등장할 때 그중 하나를 고른다 */
  readonly starts: readonly Pos[];
  /** 문들 — 번호는 맵을 위→아래, 왼→오른으로 훑어 처음 만난 순서 */
  readonly doors: readonly Door[];
  /** 맵 밖은 벽으로 본다 — 호출부가 경계 검사를 따로 하지 않아도 된다 */
  tileAt(p: Pos): Tile;
  /** 칸이 속한 문 번호, 문 칸이 아니면 undefined */
  doorAt(p: Pos): number | undefined;
}

// 'S'(시작점)는 바닥 위에 놓인 표식이라 타일로는 바닥
const LEGEND: Readonly<Record<string, Tile>> = { '#': 'wall', '.': 'floor', D: 'door', S: 'floor' };

const NEIGHBORS: readonly Pos[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

export function parseMap(rows: readonly string[]): TileMap {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error('맵이 비어 있다');

  const tiles: Tile[] = [];
  const starts: Pos[] = [];

  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${y}번 줄 길이 ${row.length} — 첫 줄 길이 ${width} 와 다르다`);
    [...row].forEach((ch, x) => {
      const tile = LEGEND[ch];
      if (!tile) throw new Error(`(${x}, ${y}) 의 모르는 문자 '${ch}'`);
      tiles.push(tile);
      if (ch === 'S') starts.push({ x, y });
    });
  });
  if (starts.length === 0) throw new Error("시작점 'S' 가 하나 이상 있어야 한다");

  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height;
  const tileAt = ({ x, y }: Pos): Tile => (inside(x, y) ? tiles[y * width + x] ?? 'wall' : 'wall');

  // 붙은 문 칸을 묶는다 — 훑는 순서대로 번호
  const doorIds: (number | undefined)[] = new Array<number | undefined>(width * height);
  const doors: Door[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tileAt({ x, y }) !== 'door' || doorIds[y * width + x] !== undefined) continue;
      const id = doors.length;
      let [minX, minY, maxX, maxY] = [x, y, x, y];
      const stack: Pos[] = [{ x, y }];
      doorIds[y * width + x] = id;
      for (let p = stack.pop(); p; p = stack.pop()) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        for (const d of NEIGHBORS) {
          const n = { x: p.x + d.x, y: p.y + d.y };
          if (tileAt(n) !== 'door' || doorIds[n.y * width + n.x] !== undefined) continue;
          doorIds[n.y * width + n.x] = id;
          stack.push(n);
        }
      }
      doors.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    }
  }

  return {
    width,
    height,
    starts,
    doors,
    tileAt,
    doorAt: ({ x, y }) => (inside(x, y) ? doorIds[y * width + x] : undefined),
  };
}
