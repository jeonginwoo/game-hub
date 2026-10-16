import { describe, expect, it } from 'vitest';
import type { Spot } from '../../server/src/protocol';
import { noticeText, peopleCount, rosterRows } from '../src/hud';
import { applyMsg, colorFor, NO_OTHERS, type Others } from '../src/others';

const at: Spot = { x: 1, y: 1, dir: 'down' };

function room(): Others {
  // 서버 명단은 들어온 순서 — 나(b)는 가운데
  return applyMsg(NO_OTHERS, {
    t: 'welcome',
    id: 'b',
    players: [
      { id: 'a', name: '영희', ...at },
      { id: 'b', name: '철수', ...at },
      { id: 'c', name: '민수', ...at },
    ],
  });
}

describe('rosterRows', () => {
  it('나를 맨 위에, 나머지는 들어온 순서대로 — 몸 색은 화면 속 캐릭터와 같게', () => {
    expect(rosterRows(room(), '철수', '#5e81ac')).toEqual([
      { id: 'b', name: '철수', color: '#5e81ac', mine: true },
      { id: 'a', name: '영희', color: colorFor('a'), mine: false },
      { id: 'c', name: '민수', color: colorFor('c'), mine: false },
    ]);
  });

  it('바뀐 이름·새로 온 사람을 따른다', () => {
    let s = applyMsg(room(), { t: 'rename', id: 'a', name: '영희2' });
    s = applyMsg(s, { t: 'join', player: { id: 'd', name: '지수', ...at } });
    expect(rosterRows(s, '철수', '#000').map((r) => r.name)).toEqual(['철수', '영희2', '민수', '지수']);
  });

  it('welcome 전에는 나 하나', () => {
    expect(rosterRows(NO_OTHERS, '철수', '#000')).toEqual([{ id: '', name: '철수', color: '#000', mine: true }]);
  });
});

describe('peopleCount', () => {
  it('열려 있을 때만 나를 포함한 인원, 아니면 null — 모르는 수를 보이지 않는다', () => {
    expect(peopleCount('open', room())).toBe(3);
    expect(peopleCount('connecting', room())).toBeNull();
    expect(peopleCount('closed', NO_OTHERS)).toBeNull();
  });
});

describe('noticeText', () => {
  it('연결이 열려 있으면 알림 없음', () => {
    expect(noticeText('open')).toBeNull();
    expect(noticeText('connecting')).toBe('연결 중…');
    expect(noticeText('closed')).toBe('연결 끊김 — 새로고침');
  });
});
