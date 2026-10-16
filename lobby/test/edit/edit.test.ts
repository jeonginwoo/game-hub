import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, type Spot } from '../../../server/src/protocol';
import { buildRoom } from '../../../server/src/room-map';
import { DEFAULT_ROOM } from '../../../server/src/room-templates';
import { canEdit, doorChoices, doorMarks } from '../../src/edit/edit';
import { GAMES, type GameEntry } from '../../src/data/games';
import { applyMsg, NO_OTHERS, type Others } from '../../src/net/others';

const at: Spot = { x: 1, y: 1, dir: 'down' };

function joined(me: string, owner: string): Others {
  return applyMsg(NO_OTHERS, {
    t: 'welcome',
    id: me,
    owner,
    room: DEFAULT_ROOM,
    map: 'plaza',
    players: [
      { id: 'a', name: '영희', ...at, look: DEFAULT_LOOK },
      { id: 'b', name: '철수', ...at, look: DEFAULT_LOOK },
    ],
  });
}

const TWO_GAMES: readonly GameEntry[] = [
  { id: 'alpha', title: '알파', url: 'http://a/' },
  { id: 'beta', title: '베타', url: 'http://b/' },
];

describe('canEdit', () => {
  it('내가 방장일 때만', () => {
    expect(canEdit(joined('a', 'a'))).toBe(true);
    expect(canEdit(joined('b', 'a'))).toBe(false);
  });

  it('welcome 전(나도 방장도 모름)에는 못 한다', () => {
    expect(canEdit(NO_OTHERS)).toBe(false);
  });

  it('방장이 넘어오면 할 수 있다', () => {
    const s = applyMsg(applyMsg(joined('b', 'a'), { t: 'leave', id: 'a' }), { t: 'owner', id: 'b' });
    expect(canEdit(s)).toBe(true);
  });
});

describe('doorMarks', () => {
  it('문마다 사각형 하나 — 등록 표에 있는 게임이 배정된 문만 열림', () => {
    expect(doorMarks(buildRoom(DEFAULT_ROOM), GAMES)).toEqual([
      { door: 0, x: 6, y: 2, w: 2, h: 2, open: false },
      { door: 1, x: 20, y: 2, w: 2, h: 2, open: true },
      { door: 2, x: 34, y: 2, w: 2, h: 2, open: false },
    ]);
  });

  // 서버는 게임 목록을 모른다 — 모르는 id 의 문은 닫힌 문으로 그리는 것과 같게
  it('등록 표에 없는 id 가 배정된 문은 닫힘', () => {
    expect(doorMarks(buildRoom(DEFAULT_ROOM), TWO_GAMES).map((m) => m.open)).toEqual([false, false, false]);
  });
});

describe('doorChoices', () => {
  it('없음 + 등록 표 순서, 지금 배정된 것 표시', () => {
    expect(doorChoices(0, TWO_GAMES, { 0: 'beta' })).toEqual([
      { game: null, title: '없음', current: false },
      { game: 'alpha', title: '알파', current: false },
      { game: 'beta', title: '베타', current: true },
    ]);
  });

  it('배정이 없으면 없음이 지금 것', () => {
    expect(doorChoices(2, TWO_GAMES, { 0: 'beta' }).filter((c) => c.current).map((c) => c.game)).toEqual([null]);
  });

  it('등록 표에 없는 id 가 배정돼 있으면 그 줄을 끝에 지금 것으로 — 고르지 않으면 그대로 둔다', () => {
    expect(doorChoices(1, TWO_GAMES, { 1: 'gone' }).at(-1)).toEqual({ game: 'gone', title: '모르는 게임 (gone)', current: true });
  });
});
