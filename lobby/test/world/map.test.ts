import { describe, expect, it } from 'vitest';
import { parseMap } from '../../src/world/map';

describe('parseMap', () => {
  const rows = [
    '#######',
    '#S.DD.#',
    '#..DD##',
    '#S...D#',
    '#######',
  ];

  it('한 글자 = 한 칸 — 크기와 칸 종류를 읽는다', () => {
    const map = parseMap(rows);
    expect(map.width).toBe(7);
    expect(map.height).toBe(5);
    expect(map.tileAt({ x: 0, y: 0 })).toBe('wall');
    expect(map.tileAt({ x: 2, y: 1 })).toBe('floor');
    expect(map.tileAt({ x: 3, y: 1 })).toBe('door');
  });

  it('시작점은 여럿일 수 있고 모두 바닥 칸이 된다', () => {
    const map = parseMap(rows);
    expect(map.starts).toEqual([{ x: 1, y: 1 }, { x: 1, y: 3 }]);
    expect(map.tileAt({ x: 1, y: 3 })).toBe('floor');
  });

  it('상하좌우로 붙은 D 칸은 문 하나 — 감싸는 사각형과 칸마다 문 번호', () => {
    const map = parseMap(rows);
    expect(map.doors).toEqual([{ x: 3, y: 1, w: 2, h: 2 }, { x: 5, y: 3, w: 1, h: 1 }]);
    for (const p of [{ x: 3, y: 1 }, { x: 4, y: 1 }, { x: 3, y: 2 }, { x: 4, y: 2 }]) expect(map.doorAt(p)).toBe(0);
    expect(map.doorAt({ x: 5, y: 3 })).toBe(1);
    expect(map.doorAt({ x: 2, y: 1 })).toBeUndefined();
    expect(map.doorAt({ x: -1, y: 1 })).toBeUndefined();
  });

  it('대각선으로만 닿은 D 칸은 다른 문, ㄱ 자로 붙으면 한 문', () => {
    expect(parseMap(['#D#', '#.D', '#S#']).doors).toHaveLength(2);
    const bent = parseMap(['DD#', '#D#', '#S#']);
    expect(bent.doors).toEqual([{ x: 0, y: 0, w: 2, h: 2 }]);
  });

  it('맵 밖은 벽으로 본다', () => {
    const map = parseMap(rows);
    expect(map.tileAt({ x: -1, y: 0 })).toBe('wall');
    expect(map.tileAt({ x: 0, y: 5 })).toBe('wall');
  });

  it('줄 길이가 다르면 거부한다', () => {
    expect(() => parseMap(['#S#', '##'])).toThrow(/길이/);
  });

  it('모르는 문자는 거부한다', () => {
    expect(() => parseMap(['#S?'])).toThrow(/\?/);
  });

  it('시작점이 없으면 거부한다', () => {
    expect(() => parseMap(['#..#'])).toThrow(/시작점/);
  });
});
