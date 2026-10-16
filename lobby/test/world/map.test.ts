import { describe, expect, it } from 'vitest';
import { parseMap, TILE_CELLS } from '../../src/world/map';

describe('parseMap', () => {
  const rows = [
    '#####',
    '#S.D#',
    '#####',
  ];

  it('타일 하나 = 2×2 칸 — 크기는 칸 단위', () => {
    const map = parseMap(rows);
    expect(TILE_CELLS).toBe(2);
    expect(map.tileCells).toBe(2);
    expect(map.width).toBe(10);
    expect(map.height).toBe(6);
  });

  it('칸마다 그 칸이 속한 타일의 종류', () => {
    const map = parseMap(rows);
    expect(map.tileAt({ x: 1, y: 1 })).toBe('wall'); // 타일 (0, 0)
    expect(map.tileAt({ x: 2, y: 2 })).toBe('floor'); // 타일 (1, 1) 의 왼쪽 위
    expect(map.tileAt({ x: 5, y: 3 })).toBe('floor'); // 타일 (2, 1) 의 오른쪽 아래
    for (const p of [{ x: 6, y: 2 }, { x: 7, y: 2 }, { x: 6, y: 3 }, { x: 7, y: 3 }]) expect(map.tileAt(p)).toBe('door');
    expect(map.tileAt({ x: 8, y: 3 })).toBe('wall');
  });

  it('시작점은 그 타일의 왼쪽 위 칸이고 바닥이 된다', () => {
    const map = parseMap(rows);
    expect(map.start).toEqual({ x: 2, y: 2 });
    expect(map.tileAt({ x: 3, y: 3 })).toBe('floor');
  });

  it('문은 타일마다 왼쪽 위 칸 하나로 모은다', () => {
    expect(parseMap(rows).doors).toEqual([{ x: 6, y: 2 }]);
  });

  it('맵 밖은 벽으로 본다', () => {
    const map = parseMap(rows);
    expect(map.tileAt({ x: -1, y: 2 })).toBe('wall');
    expect(map.tileAt({ x: 2, y: 6 })).toBe('wall');
    expect(map.tileAt({ x: 10, y: 2 })).toBe('wall');
  });

  it('타일 = 1칸으로도 읽는다 — 좌표가 문자 위치 그대로', () => {
    const map = parseMap(rows, 1);
    expect([map.width, map.height]).toEqual([5, 3]);
    expect(map.start).toEqual({ x: 1, y: 1 });
    expect(map.doors).toEqual([{ x: 3, y: 1 }]);
    expect(() => parseMap(rows, 0)).toThrow(/칸 수/);
  });

  it('줄 길이가 다르면 거부한다', () => {
    expect(() => parseMap(['#S#', '##'])).toThrow(/길이/);
  });

  it('모르는 문자는 거부한다', () => {
    expect(() => parseMap(['#S?'])).toThrow(/\?/);
  });

  it('시작점이 정확히 하나가 아니면 거부한다', () => {
    expect(() => parseMap(['#..#'])).toThrow(/시작점/);
    expect(() => parseMap(['#SS#'])).toThrow(/시작점/);
  });
});
