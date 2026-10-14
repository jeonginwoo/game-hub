import { describe, expect, it } from 'vitest';
import type { ServerMsg, Spot } from '../src/protocol.ts';
import { Roster } from '../src/roster.ts';

function peer(): { got: ServerMsg[]; send: (m: ServerMsg) => void } {
  const got: ServerMsg[] = [];
  return { got, send: (m) => got.push(m) };
}

const spot = (x: number, y: number): Spot => ({ x, y, dir: 'down' });

describe('Roster', () => {
  it('새 접속자는 본인 포함 명단을 받고, 나머지는 join 을 받는다', () => {
    const roster = new Roster();
    const a = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1) });
    const b = peer();
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2) });
    expect(b.got).toEqual([
      {
        t: 'welcome',
        id: idb,
        players: [
          { id: ida, name: 'A', ...spot(1, 1) },
          { id: idb, name: 'B', ...spot(2, 2) },
        ],
      },
    ]);
    expect(a.got.at(-1)).toEqual({ t: 'join', player: { id: idb, name: 'B', ...spot(2, 2) } });
  });

  it('이동은 보낸 사람을 뺀 모두에게 중계되고 명단에도 남는다', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1) });
    roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2) });
    const before = a.got.length;
    roster.handle(ida, { t: 'move', at: spot(5, 6) });
    expect(a.got.length).toBe(before);
    expect(b.got.at(-1)).toEqual({ t: 'move', id: ida, at: spot(5, 6) });
    // 나중에 들어온 사람은 옮긴 자리를 본다
    const c = peer();
    roster.join(c, { t: 'hello', name: 'C', at: spot(0, 0) });
    expect(c.got[0]).toMatchObject({ players: [{ id: ida, x: 5, y: 6 }, {}, {}] });
  });

  it('나가면 남은 사람에게 leave, 모르는 id 는 무시', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1) });
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2) });
    roster.leave(idb);
    expect(roster.size).toBe(1);
    expect(a.got.at(-1)).toEqual({ t: 'leave', id: idb });
    const count = a.got.length;
    roster.leave(idb);
    roster.handle(idb, { t: 'move', at: spot(3, 3) });
    expect(a.got.length).toBe(count);
  });

  it('명단에 든 뒤의 hello 는 무시한다', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1) });
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2) });
    const count = a.got.length;
    roster.handle(idb, { t: 'hello', name: 'C', at: spot(3, 3) });
    expect(a.got.length).toBe(count);
  });
});
