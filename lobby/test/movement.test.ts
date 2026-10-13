import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/map';
import { step } from '../src/movement';

const map = parseMap([
  '#####',
  '#S.D#',
  '#..##',
  '#####',
]);

describe('step', () => {
  it('바닥으로는 한 칸 이동하고 그 방향을 본다', () => {
    expect(step(map, { x: 1, y: 1 }, 'right')).toEqual({ pos: { x: 2, y: 1 }, facing: 'right', moved: true });
    expect(step(map, { x: 1, y: 1 }, 'down')).toEqual({ pos: { x: 1, y: 2 }, facing: 'down', moved: true });
  });

  it('벽으로는 이동하지 않고 방향만 바꾼다', () => {
    expect(step(map, { x: 1, y: 1 }, 'up')).toEqual({ pos: { x: 1, y: 1 }, facing: 'up', moved: false });
    expect(step(map, { x: 1, y: 1 }, 'left')).toEqual({ pos: { x: 1, y: 1 }, facing: 'left', moved: false });
  });

  it('문 타일은 밟을 수 있다', () => {
    expect(step(map, { x: 2, y: 1 }, 'right').pos).toEqual({ x: 3, y: 1 });
  });

  it('입력 위치를 바꾸지 않는다', () => {
    const pos = { x: 1, y: 1 };
    step(map, pos, 'right');
    expect(pos).toEqual({ x: 1, y: 1 });
  });
});
