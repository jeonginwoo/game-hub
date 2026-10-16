import { describe, expect, it } from 'vitest';
import { parseMap } from '../../src/world/map';

describe('parseMap', () => {
  const rows = [
    '#####',
    '#S.D#',
    '#####',
  ];

  it('크기와 타일 종류를 읽는다', () => {
    const map = parseMap(rows);
    expect(map.width).toBe(5);
    expect(map.height).toBe(3);
    expect(map.tileAt({ x: 0, y: 0 })).toBe('wall');
    expect(map.tileAt({ x: 2, y: 1 })).toBe('floor');
    expect(map.tileAt({ x: 3, y: 1 })).toBe('door');
  });

  it('시작점은 위치로 기록되고 바닥 타일이 된다', () => {
    const map = parseMap(rows);
    expect(map.start).toEqual({ x: 1, y: 1 });
    expect(map.tileAt({ x: 1, y: 1 })).toBe('floor');
  });

  it('문 위치를 모은다', () => {
    expect(parseMap(rows).doors).toEqual([{ x: 3, y: 1 }]);
  });

  it('맵 밖은 벽으로 본다', () => {
    const map = parseMap(rows);
    expect(map.tileAt({ x: -1, y: 0 })).toBe('wall');
    expect(map.tileAt({ x: 0, y: 3 })).toBe('wall');
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
