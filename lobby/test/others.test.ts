import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, type Player, type Spot } from '../../server/src/protocol';
import { advance, applyMsg, NO_OTHERS, remotePos, type Others } from '../src/others';

const spot = (x: number, y: number, dir: Spot['dir'] = 'down'): Spot => ({ x, y, dir });
const player = (id: string, x: number, y: number): Player => ({ id, name: id.toUpperCase(), ...spot(x, y), look: DEFAULT_LOOK });

function withB(): Others {
  return applyMsg(NO_OTHERS, { t: 'welcome', id: 'a', owner: 'a', players: [player('a', 1, 1), player('b', 5, 5)] });
}

describe('applyMsg', () => {
  it('welcome — 나를 뺀 명단', () => {
    const s = withB();
    expect(s.me).toBe('a');
    expect(s.owner).toBe('a');
    expect([...s.players.keys()]).toEqual(['b']);
    expect(remotePos(s.players.get('b') ?? fail())).toEqual({ x: 5, y: 5 });
  });

  it('join·leave 로 명단이 바뀐다', () => {
    let s = applyMsg(withB(), { t: 'join', player: player('c', 2, 2) });
    expect([...s.players.keys()]).toEqual(['b', 'c']);
    s = applyMsg(s, { t: 'leave', id: 'b' });
    expect([...s.players.keys()]).toEqual(['c']);
  });

  it('이웃 칸으로 move 하면 걷기 시작', () => {
    const s = applyMsg(withB(), { t: 'move', id: 'b', at: spot(6, 5, 'right') });
    const b = s.players.get('b') ?? fail();
    expect(b.t).toBe(0);
    expect(remotePos(b)).toEqual({ x: 5, y: 5 });
    expect(b.at.dir).toBe('right');
  });

  it('먼 칸이나 같은 칸이면 바로 그 자리', () => {
    let s = applyMsg(withB(), { t: 'move', id: 'b', at: spot(9, 1) });
    expect(remotePos(s.players.get('b') ?? fail())).toEqual({ x: 9, y: 1 });
    s = applyMsg(s, { t: 'move', id: 'b', at: spot(9, 1, 'up') });
    expect(s.players.get('b')?.t).toBe(1);
    expect(s.players.get('b')?.at.dir).toBe('up');
  });

  it('대각선 이웃 칸도 걷고, √2 배 시간이 걸린다', () => {
    let s = applyMsg(withB(), { t: 'move', id: 'b', at: spot(6, 6, 'right') });
    expect(s.players.get('b')?.t).toBe(0);
    s = advance(s, 160, 160);
    expect(s.players.get('b')?.t).toBeCloseTo(1 / Math.SQRT2);
  });

  it('걷는 도중에 다음 칸이 오면 지금 자리에서 이어 걷는다', () => {
    let s = applyMsg(withB(), { t: 'move', id: 'b', at: spot(6, 5, 'right') });
    s = advance(s, 80, 160);
    s = applyMsg(s, { t: 'move', id: 'b', at: spot(7, 5, 'right') });
    const b = s.players.get('b') ?? fail();
    expect(remotePos(b)).toEqual({ x: 5.5, y: 5 });
    expect(b.at.x).toBe(7);
  });

  it('rename 은 이름만 바꾸고 자리·걷기는 그대로', () => {
    let s = applyMsg(withB(), { t: 'move', id: 'b', at: spot(6, 5, 'right') });
    const walking = s.players.get('b') ?? fail();
    s = applyMsg(s, { t: 'rename', id: 'b', name: '비' });
    expect(s.players.get('b')).toEqual({ ...walking, name: '비' });
  });

  it('look 은 외형만 바꾸고 자리·걷기는 그대로', () => {
    let s = applyMsg(withB(), { t: 'move', id: 'b', at: spot(6, 5, 'right') });
    const walking = s.players.get('b') ?? fail();
    const look = { body: 2, hair: 3, hat: 1, beard: 2 };
    s = applyMsg(s, { t: 'look', id: 'b', look });
    expect(s.players.get('b')).toEqual({ ...walking, look });
  });

  it('owner 로 방장이 바뀐다', () => {
    const s = applyMsg(withB(), { t: 'owner', id: 'b' });
    expect(s.owner).toBe('b');
    expect([...s.players.keys()]).toEqual(['b']);
  });

  it('모르는 id 의 move·leave·rename·look, 나 자신의 join 은 무시', () => {
    const s = withB();
    expect(applyMsg(s, { t: 'rename', id: 'zz', name: 'Z' })).toBe(s);
    expect(applyMsg(s, { t: 'look', id: 'zz', look: DEFAULT_LOOK })).toBe(s);
    expect(applyMsg(s, { t: 'move', id: 'zz', at: spot(1, 1) })).toBe(s);
    expect(applyMsg(s, { t: 'leave', id: 'zz' })).toBe(s);
    expect(applyMsg(s, { t: 'join', player: player('a', 1, 1) })).toBe(s);
  });
});

describe('advance', () => {
  it('stepMs 에 한 칸, 넘치면 1 에서 멈춘다', () => {
    let s = applyMsg(withB(), { t: 'move', id: 'b', at: spot(6, 5, 'right') });
    s = advance(s, 40, 160);
    expect(remotePos(s.players.get('b') ?? fail())).toEqual({ x: 5.25, y: 5 });
    s = advance(s, 500, 160);
    expect(remotePos(s.players.get('b') ?? fail())).toEqual({ x: 6, y: 5 });
  });

  it('아무도 걷지 않으면 같은 상태를 돌려준다', () => {
    const s = withB();
    expect(advance(s, 16, 160)).toBe(s);
  });
});

function fail(): never {
  throw new Error('플레이어가 없다');
}
