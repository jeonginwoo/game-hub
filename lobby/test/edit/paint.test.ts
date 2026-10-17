import { describe, expect, it } from 'vitest';
import type { RoomData } from '../../../server/src/room-map';
import { cellsBetween, paintCheck } from '../../src/edit/paint';

describe('paintCheck', () => {
  // 문 (3~4, 0), 시작점 (1, 3) 하나. 나무 (1, 4) 의 밑둥은 (2, 4)·(3, 4)
  const data: RoomData = {
    rows: ['###DD##', '#.....#', '#.....#', '#S....#', '#.....#', '#######'],
    objects: [{ id: 't', kind: 'tree', x: 1, y: 4 }],
    doors: [],
  };

  it('서버가 받을 칠하기면 ok', () => {
    expect(paintCheck(data, { x: 2, y: 2 }, '#')).toBe('ok');
    expect(paintCheck(data, { x: 3, y: 0 }, '#')).toBe('ok'); // 문 한 칸 지우기
  });

  it('이미 그 글자면 same — 빨갛게 하지도 보내지도 않는다', () => {
    expect(paintCheck(data, { x: 2, y: 2 }, '.')).toBe('same');
    expect(paintCheck(data, { x: 0, y: 0 }, '#')).toBe('same');
  });

  it('서버가 버릴 칠하기면 no — 마지막 시작점·밑둥 위 문·맵 밖', () => {
    expect(paintCheck(data, { x: 1, y: 3 }, '.')).toBe('no');
    expect(paintCheck(data, { x: 2, y: 4 }, 'D')).toBe('no');
    expect(paintCheck(data, { x: 7, y: 2 }, '#')).toBe('no');
    expect(paintCheck(data, { x: 2, y: -1 }, '#')).toBe('no');
  });
});

describe('cellsBetween', () => {
  it('같은 칸이면 그 칸 하나', () => {
    expect(cellsBetween({ x: 3, y: 4 }, { x: 3, y: 4 })).toEqual([{ x: 3, y: 4 }]);
  });

  it('가로·세로로 끝 칸까지 빠짐없이 — 시작 칸 포함', () => {
    expect(cellsBetween({ x: 1, y: 2 }, { x: 4, y: 2 })).toEqual([{ x: 1, y: 2 }, { x: 2, y: 2 }, { x: 3, y: 2 }, { x: 4, y: 2 }]);
    expect(cellsBetween({ x: 0, y: 3 }, { x: 0, y: 1 })).toEqual([{ x: 0, y: 3 }, { x: 0, y: 2 }, { x: 0, y: 1 }]);
  });

  it('비스듬하면 칸이 상하좌우로 이어진다 — 대각선으로만 닿은 D 칸은 다른 문이 된다', () => {
    const cells = cellsBetween({ x: 0, y: 0 }, { x: 3, y: 2 });
    expect(cells[0]).toEqual({ x: 0, y: 0 });
    expect(cells.at(-1)).toEqual({ x: 3, y: 2 });
    expect(cells).toHaveLength(3 + 2 + 1);
    for (let i = 1; i < cells.length; i++) {
      const a = cells[i - 1];
      const b = cells[i];
      if (!a || !b) throw new Error('칸 없음');
      expect(Math.abs(a.x - b.x) + Math.abs(a.y - b.y)).toBe(1);
    }
  });
});
