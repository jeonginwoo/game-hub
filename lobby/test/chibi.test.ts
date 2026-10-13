import { describe, expect, it } from 'vitest';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, type Avatar } from '../src/avatar';
import { FRAME_H, FRAME_W, FRAMES, SHEET_H, SHEET_W, renderChibiSheet } from '../src/chibi';

/** 시트의 (열, 행) 프레임 픽셀만 잘라 RGBA 배열로 */
function frame(px: Uint8ClampedArray, col: number, row: number): number[] {
  const out: number[] = [];
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const i = ((row * FRAME_H + y) * SHEET_W + col * FRAME_W + x) * 4;
      out.push(px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!);
    }
  return out;
}

function mirrored(f: number[]): number[] {
  const out: number[] = [];
  for (let y = 0; y < FRAME_H; y++)
    for (let x = 0; x < FRAME_W; x++) {
      const i = (y * FRAME_W + (FRAME_W - 1 - x)) * 4;
      out.push(f[i]!, f[i + 1]!, f[i + 2]!, f[i + 3]!);
    }
  return out;
}

const alphaAt = (f: number[], x: number, y: number) => f[(y * FRAME_W + x) * 4 + 3]!;

describe('renderChibiSheet', () => {
  const sheet = renderChibiSheet(DEFAULT_AVATAR);

  it('시트 크기 = 프레임 4장 × 4방향', () => {
    expect(sheet.length).toBe(SHEET_W * SHEET_H * 4);
    expect(SHEET_W).toBe(FRAME_W * FRAMES);
  });

  it('같은 꾸미기는 늘 같은 그림', () => {
    expect(renderChibiSheet(DEFAULT_AVATAR)).toEqual(sheet);
  });

  it('오른쪽은 왼쪽 옆모습의 좌우 반전', () => {
    for (let f = 0; f < FRAMES; f++) expect(frame(sheet, f, 3)).toEqual(mirrored(frame(sheet, f, 2)));
  });

  it('모든 프레임: 모서리는 비고, 서 있는 프레임은 발(외곽선)이 맨 아래 줄에 닿는다', () => {
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < FRAMES; col++) {
        const f = frame(sheet, col, row);
        expect(alphaAt(f, 0, FRAME_H - 1)).toBe(0);
        expect(alphaAt(f, FRAME_W - 1, FRAME_H - 1)).toBe(0);
        if (col % 2 === 0) {
          const bottom = Array.from({ length: FRAME_W }, (_, x) => alphaAt(f, x, FRAME_H - 1));
          expect(bottom.some((a) => a > 0)).toBe(true);
        }
      }
  });

  it('걷는 프레임은 서 있는 프레임과 다르다 (모든 방향)', () => {
    for (let row = 0; row < 4; row++) {
      expect(frame(sheet, 1, row)).not.toEqual(frame(sheet, 0, row));
      expect(frame(sheet, 3, row)).not.toEqual(frame(sheet, 1, row));
    }
  });

  it('꾸미기 항목을 하나씩 바꾸면 그림이 바뀐다', () => {
    for (const key of Object.keys(AVATAR_OPTIONS) as (keyof Avatar)[]) {
      const other = AVATAR_OPTIONS[key].find((v) => v !== DEFAULT_AVATAR[key])!;
      const changed = renderChibiSheet({ ...DEFAULT_AVATAR, [key]: other } as Avatar);
      expect(changed, key).not.toEqual(sheet);
    }
  });
});
