import { describe, expect, it } from 'vitest';
import { GROUND_THEMES } from '../../../server/src/ground';
import type { RoomData } from '../../../server/src/room-map';
import { brushName, brushPartName, GROUND_BRUSH_THEMES, groundChar, paintGround, tileOf } from '../../src/edit/ground-brush';

describe('GROUND_BRUSH_THEMES', () => {
  it('테마 여덟이 GROUND_THEMES 순서대로, 이름은 서로 다르다', () => {
    expect(GROUND_BRUSH_THEMES.map((t) => t.theme)).toEqual(Object.keys(GROUND_THEMES));
    expect(new Set(GROUND_BRUSH_THEMES.map((t) => t.name)).size).toBe(8);
  });
});

describe('붓 글자·이름', () => {
  it('바닥은 소문자, 길은 대문자', () => {
    expect(groundChar({ theme: 'g', path: false })).toBe('g');
    expect(groundChar({ theme: 'g', path: true })).toBe('G');
  });

  it('창 이름은 바닥/길 재질, 버튼 글은 테마 + 바닥/길', () => {
    expect(brushPartName({ theme: 'g', path: true })).toBe('길 · 흙');
    expect(brushPartName({ theme: 'i', path: false })).toBe('바닥 · 흰 바탕');
    expect(brushName({ theme: 'b', path: true })).toBe('갈색 흙 길');
  });
});

describe('tileOf', () => {
  it('칸 2×2 가 타일 하나', () => {
    expect(tileOf({ x: 0, y: 0 })).toEqual({ x: 0, y: 0 });
    expect(tileOf({ x: 1, y: 1 })).toEqual({ x: 0, y: 0 });
    expect(tileOf({ x: 5, y: 2 })).toEqual({ x: 2, y: 1 });
  });
});

describe('paintGround', () => {
  // 칸 7×6 → 재질 4×3
  const data: RoomData = {
    rows: ['###DD##', '#.....#', '#.....#', '#S....#', '#.....#', '#######'], ground: ['gggg', 'gggg', 'gggg'],
    objects: [],
    doors: [],
  };

  it('타일 하나만 바꾼 새 방 데이터 — 원본은 그대로', () => {
    const next = paintGround(data, { x: 1, y: 1 }, 'G');
    expect(next.ground).toEqual(['gggg', 'gGgg', 'gggg']);
    expect(data.ground[1]).toBe('gggg');
    expect(next.rows).toBe(data.rows);
  });

  it('이미 그 글자거나 맵 밖이면 던진다', () => {
    expect(() => paintGround(data, { x: 0, y: 0 }, 'g')).toThrow();
    expect(() => paintGround(data, { x: 4, y: 0 }, 'G')).toThrow();
    expect(() => paintGround(data, { x: 0, y: 3 }, 'G')).toThrow();
    expect(() => paintGround(data, { x: -1, y: 0 }, 'G')).toThrow();
  });

  it('모르는 글자는 검사에 걸린다', () => {
    expect(() => paintGround(data, { x: 0, y: 0 }, 'z')).toThrow();
  });
});
