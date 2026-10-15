import { describe, expect, it } from 'vitest';
import { parseMap } from '../src/map';
import { reversesWalk, step, stepHeld } from '../src/movement';

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

const open = parseMap([
  '#####',
  '#S..#',
  '#...#',
  '#.#.#',
  '#####',
]);

describe('stepHeld', () => {
  it('아무 키도 없으면 null', () => {
    expect(stepHeld(open, { x: 1, y: 1 }, [])).toBeNull();
  });

  it('한 방향이면 step 과 같다', () => {
    expect(stepHeld(open, { x: 1, y: 1 }, ['right'])).toEqual(step(open, { x: 1, y: 1 }, 'right'));
  });

  it('가로·세로를 같이 누르면 대각선, 모습은 나중에 누른 쪽', () => {
    expect(stepHeld(open, { x: 1, y: 1 }, ['right', 'down'])).toEqual({ pos: { x: 2, y: 2 }, facing: 'down', moved: true });
    expect(stepHeld(open, { x: 1, y: 1 }, ['down', 'right'])).toEqual({ pos: { x: 2, y: 2 }, facing: 'right', moved: true });
  });

  it('같은 축 두 키는 나중 것만 — 대각선이 아니다', () => {
    expect(stepHeld(open, { x: 2, y: 1 }, ['left', 'right'])?.pos).toEqual({ x: 3, y: 1 });
  });

  it('모서리를 질러가지 않고 막히지 않은 축으로 미끄러진다', () => {
    // (1,2) 에서 오른쪽 아래 (2,3) 은 벽 — 나중에 누른 오른쪽으로
    expect(stepHeld(open, { x: 1, y: 2 }, ['down', 'right'])).toEqual({ pos: { x: 2, y: 2 }, facing: 'right', moved: true });
    // (3,2) 에서 왼쪽 아래: 대각선 (2,3) 벽, 나중에 누른 왼쪽 (2,2) 은 바닥
    expect(stepHeld(open, { x: 3, y: 2 }, ['down', 'left'])?.pos).toEqual({ x: 2, y: 2 });
    // (1,1) 에서 왼쪽 위: 둘 다 벽이면 제자리에서 나중에 누른 쪽을 본다
    expect(stepHeld(open, { x: 1, y: 1 }, ['up', 'left'])).toEqual({ pos: { x: 1, y: 1 }, facing: 'left', moved: false });
  });

  it('옆 칸 하나가 벽이면 대각선 칸이 비어도 질러가지 않는다', () => {
    // (1,3) 에서 오른쪽 위 (2,2) 는 바닥이지만 옆 (2,3) 이 벽 — 위로만
    expect(stepHeld(open, { x: 1, y: 3 }, ['right', 'up'])).toEqual({ pos: { x: 1, y: 2 }, facing: 'up', moved: true });
  });
});

describe('reversesWalk', () => {
  const a = { x: 1, y: 1 };
  it('곧게 걷는 중 정반대 키면 되돌린다', () => {
    expect(reversesWalk(a, { x: 0, y: 1 }, 'right')).toBe(true);
    expect(reversesWalk(a, { x: 1, y: 2 }, 'up')).toBe(true);
  });

  it('같은 쪽·다른 축은 되돌리지 않는다', () => {
    expect(reversesWalk(a, { x: 2, y: 1 }, 'right')).toBe(false);
    expect(reversesWalk(a, { x: 2, y: 1 }, 'up')).toBe(false);
  });

  it('대각선 걸음은 한 축만 반대여도 되돌리지 않는다', () => {
    expect(reversesWalk(a, { x: 2, y: 0 }, 'down')).toBe(false);
    expect(reversesWalk(a, { x: 2, y: 0 }, 'left')).toBe(false);
  });
});
