import { describe, expect, it } from 'vitest';
import { cleanName, parseClientMsg } from '../src/protocol.ts';

const at = { x: 3, y: 4, dir: 'down' };

describe('parseClientMsg', () => {
  it('hello·move 를 받는다', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'hello', name: '철수', at }))).toEqual({ t: 'hello', name: '철수', at });
    expect(parseClientMsg(JSON.stringify({ t: 'move', at }))).toEqual({ t: 'move', at });
  });

  it('모르는 필드는 버리고 필요한 것만 남긴다', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, hp: 9 }, extra: 1 }))).toEqual({ t: 'move', at });
  });

  it('형식이 틀리면 null', () => {
    expect(parseClientMsg('not json')).toBeNull();
    expect(parseClientMsg('[]')).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'nope', at }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'move' }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'hello', at }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, dir: 'north' } }))).toBeNull();
  });

  it('좌표는 0 이상 COORD_MAX 미만의 정수만', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, x: 1.5 } }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, x: -1 } }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, y: 1000 } }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, y: '4' } }))).toBeNull();
  });
});

describe('cleanName', () => {
  it('제어 문자를 빼고 공백을 자른다', () => {
    expect(cleanName('  영\u0000희\n ')).toBe('영희');
  });

  it('NAME_MAX 글자로 자른다', () => {
    expect(cleanName('가'.repeat(20))).toBe('가'.repeat(16));
  });

  it('비면 기본 이름', () => {
    expect(cleanName('   ')).toBe('손님');
  });
});
