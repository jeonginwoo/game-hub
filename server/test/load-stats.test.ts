import { describe, expect, it } from 'vitest';
import { statsGate, tokenOk } from '../src/load-stats.ts';

describe('서버 지표 켜기·잠그기', () => {
  it('STATS=1 이면 토큰 없이, STATS_TOKEN 이 있으면 토큰으로, 둘 다 없으면 꺼짐', () => {
    expect(statsGate({})).toBeNull();
    expect(statsGate({ STATS: '0' })).toBeNull();
    expect(statsGate({ STATS: '1' })).toEqual({ token: null });
    expect(statsGate({ STATS: '1', STATS_TOKEN: 's3cret' })).toEqual({ token: 's3cret' });
  });

  it('토큰이 정확히 같을 때만 통과', () => {
    const gate = { token: 's3cret' };
    expect(tokenOk(gate, 's3cret')).toBe(true);
    expect(tokenOk(gate, 's3cre')).toBe(false);
    expect(tokenOk(gate, 's3cretX')).toBe(false);
    expect(tokenOk(gate, null)).toBe(false);
    expect(tokenOk({ token: null }, null)).toBe(true);
  });
});
