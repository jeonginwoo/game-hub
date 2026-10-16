import { describe, expect, it } from 'vitest';
import { CHAT_MAX, cleanChat, cleanName, isRoomCode, normalizeName, parseClientMsg, parseServerMsg, roomFromPath } from '../src/protocol.ts';

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

  it('chat 은 다듬은 글자로 받고, 비면 null', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'chat', text: ' 안녕\n하세요 ', at }))).toEqual({ t: 'chat', text: '안녕 하세요' });
    expect(parseClientMsg(JSON.stringify({ t: 'chat', text: ' \u0000 ' }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'chat', text: 3 }))).toBeNull();
  });

  it('좌표는 0 이상 COORD_MAX 미만의 정수만', () => {
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, x: 1.5 } }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, x: -1 } }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, y: 1000 } }))).toBeNull();
    expect(parseClientMsg(JSON.stringify({ t: 'move', at: { ...at, y: '4' } }))).toBeNull();
  });
});

describe('isRoomCode', () => {
  it('허용 글자 6자만', () => {
    expect(isRoomCode('abc234')).toBe(true);
    expect(isRoomCode('abc23')).toBe(false);
    expect(isRoomCode('abc2345')).toBe(false);
    expect(isRoomCode('ABC234')).toBe(false);
  });

  it('헷갈리는 글자(0·o·1·l·i)는 받지 않는다', () => {
    for (const ch of ['0', 'o', '1', 'l', 'i']) expect(isRoomCode(`abc23${ch}`)).toBe(false);
  });
});

describe('roomFromPath', () => {
  it('room 쿼리의 코드를 꺼낸다', () => {
    expect(roomFromPath('/ws?room=abc234')).toBe('abc234');
    expect(roomFromPath('/ws?x=1&room=abc234')).toBe('abc234');
  });

  it('없거나 틀리면 null', () => {
    expect(roomFromPath('/ws')).toBeNull();
    expect(roomFromPath('/ws?room=')).toBeNull();
    expect(roomFromPath('/ws?room=../etc')).toBeNull();
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

  it('잘린 끝에 공백이 남지 않는다', () => {
    // 16번째 글자가 공백이면 자른 뒤 다시 다듬는다 — 계약 v2 「앞뒤 공백 없음」
    expect(cleanName(`${'가'.repeat(15)} 나`)).toBe('가'.repeat(15));
  });
});

describe('normalizeName', () => {
  it('비면 빈 문자열 — 기본 이름을 넣지 않는다', () => {
    expect(normalizeName(' \u0007 ')).toBe('');
    expect(normalizeName(' 영희 ')).toBe('영희');
  });
});

describe('cleanChat', () => {
  it('제어 문자는 공백으로, 앞뒤 공백은 자른다', () => {
    expect(cleanChat('\t가\r\n나 ')).toBe('가  나');
    // \p{Cc} 밖의 줄·문단 구분자도 — 말풍선이 여러 줄로 갈라지지 않게
    expect(cleanChat('가 나 다')).toBe('가 나 다');
  });

  it('CHAT_MAX 글자로 자른다', () => {
    expect(cleanChat('a'.repeat(CHAT_MAX + 5))).toHaveLength(CHAT_MAX);
  });
});

describe('parseServerMsg', () => {
  const player = { id: 'p1', name: 'A', ...at };

  it('서버가 보내는 다섯 가지를 받는다', () => {
    expect(parseServerMsg(JSON.stringify({ t: 'welcome', id: 'p1', players: [player] }))).toEqual({
      t: 'welcome',
      id: 'p1',
      players: [player],
    });
    expect(parseServerMsg(JSON.stringify({ t: 'join', player }))).toEqual({ t: 'join', player });
    expect(parseServerMsg(JSON.stringify({ t: 'move', id: 'p1', at }))).toEqual({ t: 'move', id: 'p1', at });
    expect(parseServerMsg(JSON.stringify({ t: 'leave', id: 'p1' }))).toEqual({ t: 'leave', id: 'p1' });
    expect(parseServerMsg(JSON.stringify({ t: 'chat', id: 'p1', text: '안녕' }))).toEqual({ t: 'chat', id: 'p1', text: '안녕' });
  });

  it('형식이 틀리면 null — 명단에 틀린 사람이 하나라도 있으면 통째로', () => {
    expect(parseServerMsg('nope')).toBeNull();
    expect(parseServerMsg(JSON.stringify({ t: 'welcome', id: 'p1', players: [player, { id: 'p2' }] }))).toBeNull();
    expect(parseServerMsg(JSON.stringify({ t: 'join', player: { ...player, x: -1 } }))).toBeNull();
    expect(parseServerMsg(JSON.stringify({ t: 'move', id: 3, at }))).toBeNull();
    expect(parseServerMsg(JSON.stringify({ t: 'leave' }))).toBeNull();
    expect(parseServerMsg(JSON.stringify({ t: 'chat', id: 'p1', text: '  ' }))).toBeNull();
  });

  it('이름은 다시 다듬는다 — 화면에 그대로 나가는 값이라', () => {
    expect(parseServerMsg(JSON.stringify({ t: 'join', player: { ...player, name: ' B\u0000 ' } }))).toEqual({
      t: 'join',
      player: { ...player, name: 'B' },
    });
  });
});
