// 타일맵 — 문자열 줄 배열을 해석한다. 렌더링·Three.js 와 무관한 순수 데이터.
// 좌표는 타일 단위, x 는 오른쪽, y 는 아래쪽(줄 번호)으로 증가한다.

export type Tile = 'wall' | 'floor' | 'door';

export interface Pos {
  readonly x: number;
  readonly y: number;
}

export interface TileMap {
  readonly width: number;
  readonly height: number;
  readonly start: Pos;
  readonly doors: readonly Pos[];
  /** 맵 밖은 벽으로 본다 — 호출부가 경계 검사를 따로 하지 않아도 된다 */
  tileAt(p: Pos): Tile;
}

// 'S'(시작점)는 바닥 위에 놓인 표식이라 타일로는 바닥
const LEGEND: Readonly<Record<string, Tile>> = { '#': 'wall', '.': 'floor', D: 'door', S: 'floor' };

export function parseMap(rows: readonly string[]): TileMap {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error('맵이 비어 있다');

  const tiles: Tile[] = [];
  const starts: Pos[] = [];
  const doors: Pos[] = [];

  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${y}번 줄 길이 ${row.length} — 첫 줄 길이 ${width} 와 다르다`);
    [...row].forEach((ch, x) => {
      const tile = LEGEND[ch];
      if (!tile) throw new Error(`(${x}, ${y}) 의 모르는 문자 '${ch}'`);
      tiles.push(tile);
      if (ch === 'S') starts.push({ x, y });
      if (tile === 'door') doors.push({ x, y });
    });
  });

  const start = starts[0];
  if (!start || starts.length !== 1) throw new Error(`시작점 'S' 는 정확히 하나여야 한다 — ${starts.length}개`);

  return {
    width,
    height,
    start,
    doors,
    tileAt({ x, y }) {
      if (x < 0 || y < 0 || x >= width || y >= height) return 'wall';
      return tiles[y * width + x] ?? 'wall';
    },
  };
}
