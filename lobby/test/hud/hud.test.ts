import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, type Look, type Spot } from '../../../server/src/protocol';
import { DEFAULT_ROOM } from '../../../server/src/room-templates';
import { noticeText, peopleCount, rosterRows } from '../../src/hud/hud';
import { bodyColor } from '../../src/avatar/look';
import { applyMsg, NO_OTHERS, type Others } from '../../src/net/others';

const at: Spot = { x: 1, y: 1, dir: 'down' };
const look = (body: number): Look => ({ ...DEFAULT_LOOK, body });

function room(): Others {
  // 서버 명단은 들어온 순서 — 나(b)는 가운데
  return applyMsg(NO_OTHERS, {
    t: 'welcome',
    id: 'b',
    owner: 'a',
    room: DEFAULT_ROOM,
    map: 'plaza',
    players: [
      { id: 'a', name: '영희', ...at, look: look(1) },
      { id: 'b', name: '철수', ...at, look: look(2) },
      { id: 'c', name: '민수', ...at, look: look(3) },
    ],
  });
}

describe('rosterRows', () => {
  it('나를 맨 위에, 나머지는 들어온 순서대로 — 몸 색은 화면 속 캐릭터와 같게', () => {
    expect(rosterRows(room(), '철수', look(4))).toEqual([
      { id: 'b', name: '철수', color: bodyColor(look(4)), mine: true, owner: false },
      { id: 'a', name: '영희', color: bodyColor(look(1)), mine: false, owner: true },
      { id: 'c', name: '민수', color: bodyColor(look(3)), mine: false, owner: false },
    ]);
  });

  it('남이 외형을 바꾸면 점 색도 따른다', () => {
    const s = applyMsg(room(), { t: 'look', id: 'c', look: look(5) });
    expect(rosterRows(s, '철수', look(4))[2]?.color).toBe(bodyColor(look(5)));
  });

  it('바뀐 이름·새로 온 사람을 따른다', () => {
    let s = applyMsg(room(), { t: 'rename', id: 'a', name: '영희2' });
    s = applyMsg(s, { t: 'join', player: { id: 'd', name: '지수', ...at, look: DEFAULT_LOOK } });
    expect(rosterRows(s, '철수', DEFAULT_LOOK).map((r) => r.name)).toEqual(['철수', '영희2', '민수', '지수']);
  });

  it('방장이 바뀌면 왕관도 옮긴다 — 내가 방장이 될 수도 있다', () => {
    const s = applyMsg(applyMsg(room(), { t: 'leave', id: 'a' }), { t: 'owner', id: 'b' });
    expect(rosterRows(s, '철수', DEFAULT_LOOK).map((r) => [r.name, r.owner])).toEqual([
      ['철수', true],
      ['민수', false],
    ]);
  });

  it('welcome 전에는 나 하나', () => {
    expect(rosterRows(NO_OTHERS, '철수', DEFAULT_LOOK)).toEqual([{ id: '', name: '철수', color: bodyColor(DEFAULT_LOOK), mine: true, owner: false }]);
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

describe('noticeText 편집 중', () => {
  it('편집 중이면 도구별 안내, 연결 알림이 있으면 그쪽이 먼저', () => {
    expect(noticeText('open', 'door')).toBe('편집 중 — 문을 눌러 게임 고르기 (Esc 끝)');
    expect(noticeText('open', 'place')).toBe('편집 중 — 고른 물체를 맵에 놓기 (Esc 끝)');
    expect(noticeText('open', 'remove')).toBe('편집 중 — 누른 물체 치우기 (Esc 끝)');
    expect(noticeText('open', 'paint')).toBe('편집 중 — 누르거나 끌어서 칸 칠하기 (Esc 끝)');
    expect(noticeText('closed', 'place')).toBe('연결 끊김 — 새로고침');
  });
});
