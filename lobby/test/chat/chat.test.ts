import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK } from '../../../server/src/protocol';
import { BUBBLE_MS, bubbleText, chatFromInput, chatLine, say } from '../../src/chat/chat';
import { applyMsg, NO_OTHERS } from '../../src/net/others';

const others = applyMsg(NO_OTHERS, {
  t: 'welcome',
  id: 'a',
  owner: 'a',
  players: [
    { id: 'a', name: '나', x: 1, y: 1, dir: 'down', look: DEFAULT_LOOK },
    { id: 'b', name: '영희', x: 2, y: 2, dir: 'down', look: DEFAULT_LOOK },
  ],
});

describe('chatFromInput', () => {
  it('다듬은 글, 비면 null', () => {
    expect(chatFromInput('  안녕 ')).toBe('안녕');
    expect(chatFromInput(' \t ')).toBeNull();
  });
});

describe('chatLine', () => {
  it('남의 줄은 명단의 이름, 내 줄은 내 이름', () => {
    expect(chatLine({ t: 'chat', id: 'b', text: '하이' }, others, '철수')).toEqual({ name: '영희', text: '하이', mine: false });
    expect(chatLine({ t: 'chat', id: 'a', text: '안녕' }, others, '철수')).toEqual({ name: '철수', text: '안녕', mine: true });
  });

  it('명단에 없는 사람의 줄은 null', () => {
    expect(chatLine({ t: 'chat', id: 'z', text: '?' }, others, '철수')).toBeNull();
  });
});

describe('say · bubbleText', () => {
  it('BUBBLE_MS 동안만 뜬다', () => {
    const b = say(new Map(), 'b', '하이', 1_000);
    expect(bubbleText(b, 'b', 1_000 + BUBBLE_MS - 1)).toBe('하이');
    expect(bubbleText(b, 'b', 1_000 + BUBBLE_MS)).toBeNull();
    expect(bubbleText(b, 'a', 1_000)).toBeNull();
  });

  it('새 글은 앞 말풍선을 바꾸고 시간을 새로 센다', () => {
    const b = say(say(new Map(), 'b', '하나', 0), 'b', '둘', BUBBLE_MS - 1);
    expect(bubbleText(b, 'b', BUBBLE_MS + 10)).toBe('둘');
  });

  it('지난 말풍선은 다음 say 때 치운다', () => {
    const b = say(say(new Map(), 'a', '옛말', 0), 'b', '새말', BUBBLE_MS);
    expect([...b.keys()]).toEqual(['b']);
  });
});
