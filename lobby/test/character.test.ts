import { describe, expect, it } from 'vitest';
import { characterFrame } from '../src/character';

describe('characterFrame', () => {
  it('방향마다 다른 행 (아래·위·왼쪽·오른쪽)', () => {
    const rows = (['down', 'up', 'left', 'right'] as const).map((d) => characterFrame(d, false, 0).row);
    expect(rows).toEqual([0, 1, 2, 3]);
  });

  it('정지 중이면 걸은 거리와 무관하게 0열(서기)', () => {
    expect(characterFrame('left', false, 0).col).toBe(0);
    expect(characterFrame('left', false, 3.7).col).toBe(0);
  });

  it('걷기 시작하면 바로 발을 내딛고, 두 칸에 4프레임을 한 바퀴 돈다', () => {
    const cols = [0, 0.5, 1, 1.5, 2].map((s) => characterFrame('down', true, s).col);
    expect(cols).toEqual([1, 2, 3, 0, 1]);
  });
});
