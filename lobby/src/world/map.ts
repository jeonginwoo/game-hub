// 타일맵 — 문자열 줄 배열을 해석한다. 렌더링·Three.js 와 무관한 순수 데이터.
// 문자 한 글자 = 타일 하나(그림 32px). 걷기·충돌·위치는 그보다 잘게 나눈 칸 단위다 — 타일 하나 = tileCells × tileCells 칸.
// 좌표는 칸 단위, x 는 오른쪽, y 는 아래쪽(줄 번호)으로 증가한다.

export type Tile = 'wall' | 'floor' | 'door';

/** 타일 한 변의 칸 수 — 그림은 타일 크기 그대로 두고 걷기만 잘게 (결정 2026-10-16: 칸 2배 밀도) */
export const TILE_CELLS = 2;

export interface Pos {
  readonly x: number;
  readonly y: number;
}

export interface TileMap {
  /** 칸 단위 크기 */
  readonly width: number;
  readonly height: number;
  /** 타일 한 변의 칸 수 */
  readonly tileCells: number;
  /** 시작점 타일의 왼쪽 위 칸 */
  readonly start: Pos;
  /** 문 타일마다 왼쪽 위 칸 — 문은 tileCells × tileCells 칸을 덮는다 */
  readonly doors: readonly Pos[];
  /** 맵 밖은 벽으로 본다 — 호출부가 경계 검사를 따로 하지 않아도 된다 */
  tileAt(p: Pos): Tile;
}

// 'S'(시작점)는 바닥 위에 놓인 표식이라 타일로는 바닥
const LEGEND: Readonly<Record<string, Tile>> = { '#': 'wall', '.': 'floor', D: 'door', S: 'floor' };

export function parseMap(rows: readonly string[], tileCells = TILE_CELLS): TileMap {
  const rowsH = rows.length;
  const rowsW = rows[0]?.length ?? 0;
  if (rowsH === 0 || rowsW === 0) throw new Error('맵이 비어 있다');
  if (!Number.isInteger(tileCells) || tileCells < 1) throw new Error(`타일 한 변의 칸 수 ${tileCells} — 1 이상 정수여야 한다`);

  const tiles: Tile[] = [];
  const starts: Pos[] = [];
  const doors: Pos[] = [];

  rows.forEach((row, y) => {
    if (row.length !== rowsW) throw new Error(`${y}번 줄 길이 ${row.length} — 첫 줄 길이 ${rowsW} 와 다르다`);
    [...row].forEach((ch, x) => {
      const tile = LEGEND[ch];
      if (!tile) throw new Error(`(${x}, ${y}) 의 모르는 문자 '${ch}'`);
      tiles.push(tile);
      const corner = { x: x * tileCells, y: y * tileCells };
      if (ch === 'S') starts.push(corner);
      if (tile === 'door') doors.push(corner);
    });
  });

  const start = starts[0];
  if (!start || starts.length !== 1) throw new Error(`시작점 'S' 는 정확히 하나여야 한다 — ${starts.length}개`);

  const width = rowsW * tileCells;
  const height = rowsH * tileCells;
  return {
    width,
    height,
    tileCells,
    start,
    doors,
    tileAt({ x, y }) {
      if (x < 0 || y < 0 || x >= width || y >= height) return 'wall';
      return tiles[Math.floor(y / tileCells) * rowsW + Math.floor(x / tileCells)] ?? 'wall';
    },
  };
}
