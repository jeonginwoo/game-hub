import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, type ClientMsg, type ServerMsg, type Spot } from '../src/protocol.ts';
import { DEFAULT_ROOM, ROOM_TEMPLATES, type RoomTemplate } from '../src/room-templates.ts';
import { CHAT_BURST, CHAT_WINDOW_MS, Rooms, Roster } from '../src/roster.ts';

function peer(): { got: ServerMsg[]; send: (m: ServerMsg) => void } {
  const got: ServerMsg[] = [];
  return { got, send: (m) => got.push(m) };
}

const spot = (x: number, y: number): Spot => ({ x, y, dir: 'down' });

describe('Roster', () => {
  it('방 데이터와 템플릿 id 를 welcome 에 싣는다 — 처음엔 기본 방, 만들 때 준 템플릿이면 그 방', () => {
    const a = peer();
    new Roster().join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    expect(a.got[0]).toMatchObject({ t: 'welcome', room: DEFAULT_ROOM, map: 'plaza' });

    const small: RoomTemplate = { id: 'small', name: '작은 방', room: { rows: ['#S.D#'], objects: [], doors: [] } };
    const b = peer();
    new Roster(Date.now, small).join(b, { t: 'hello', name: 'B', at: spot(1, 0), look: DEFAULT_LOOK });
    expect(b.got[0]).toMatchObject({ t: 'welcome', room: small.room, map: 'small' });
  });

  it('새 접속자는 본인 포함 명단을 받고, 나머지는 join 을 받는다', () => {
    const roster = new Roster();
    const a = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const b = peer();
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    expect(b.got).toEqual([
      {
        t: 'welcome',
        id: idb,
        owner: ida,
        players: [
          { id: ida, name: 'A', ...spot(1, 1), look: DEFAULT_LOOK },
          { id: idb, name: 'B', ...spot(2, 2), look: DEFAULT_LOOK },
        ],
        room: DEFAULT_ROOM,
        map: 'plaza',
      },
    ]);
    expect(a.got.at(-1)).toEqual({ t: 'join', player: { id: idb, name: 'B', ...spot(2, 2), look: DEFAULT_LOOK } });
  });

  it('이동은 보낸 사람을 뺀 모두에게 중계되고 명단에도 남는다', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    const before = a.got.length;
    roster.handle(ida, { t: 'move', at: spot(5, 6) });
    expect(a.got.length).toBe(before);
    expect(b.got.at(-1)).toEqual({ t: 'move', id: ida, at: spot(5, 6) });
    // 나중에 들어온 사람은 옮긴 자리를 본다
    const c = peer();
    roster.join(c, { t: 'hello', name: 'C', at: spot(0, 0), look: DEFAULT_LOOK });
    expect(c.got[0]).toMatchObject({ players: [{ id: ida, x: 5, y: 6 }, {}, {}] });
  });

  it('나가면 남은 사람에게 leave, 모르는 id 는 무시', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    roster.leave(idb);
    expect(roster.size).toBe(1);
    expect(a.got.at(-1)).toEqual({ t: 'leave', id: idb });
    const count = a.got.length;
    roster.leave(idb);
    roster.handle(idb, { t: 'move', at: spot(3, 3) });
    expect(a.got.length).toBe(count);
  });

  it('채팅은 보낸 사람을 포함한 모두에게 간다', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    roster.handle(ida, { t: 'chat', text: '안녕' });
    expect(a.got.at(-1)).toEqual({ t: 'chat', id: ida, text: '안녕' });
    expect(b.got.at(-1)).toEqual({ t: 'chat', id: ida, text: '안녕' });
  });

  it('CHAT_WINDOW_MS 안에 CHAT_BURST 줄을 넘으면 버리고, 시간이 지나면 다시 받는다', () => {
    let now = 1_000;
    const roster = new Roster(() => now);
    const a = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const chats = (): number => a.got.filter((m) => m.t === 'chat').length;
    for (let i = 0; i < CHAT_BURST + 2; i++) roster.handle(ida, { t: 'chat', text: `${i}` });
    expect(chats()).toBe(CHAT_BURST);
    now += CHAT_WINDOW_MS;
    roster.handle(ida, { t: 'chat', text: '다시' });
    expect(chats()).toBe(CHAT_BURST + 1);
  });

  it('이름 바꾸기는 보낸 사람을 뺀 모두에게 중계되고 명단에도 남는다', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    const before = a.got.length;
    roster.handle(ida, { t: 'rename', name: '에이' });
    expect(a.got.length).toBe(before);
    expect(b.got.at(-1)).toEqual({ t: 'rename', id: ida, name: '에이' });
    // 나중에 들어온 사람은 바뀐 이름을 본다
    const c = peer();
    roster.join(c, { t: 'hello', name: 'C', at: spot(0, 0), look: DEFAULT_LOOK });
    expect(c.got[0]).toMatchObject({ players: [{ id: ida, name: '에이' }, {}, {}] });
  });

  it('지금 이름과 같은 이름으로는 아무것도 보내지 않는다', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    const count = b.got.length;
    roster.handle(ida, { t: 'rename', name: 'A' });
    expect(b.got.length).toBe(count);
  });

  it('외형 바꾸기는 보낸 사람을 뺀 모두에게 중계되고 명단에도 남는다 — 같은 외형이면 보내지 않는다', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    const before = a.got.length;
    const look = { body: 3, hair: 1, hat: 2, beard: 1 };
    roster.handle(ida, { t: 'look', look });
    expect(a.got.length).toBe(before);
    expect(b.got.at(-1)).toEqual({ t: 'look', id: ida, look });
    const count = b.got.length;
    roster.handle(ida, { t: 'look', look: { ...look } });
    expect(b.got.length).toBe(count);
    const c = peer();
    roster.join(c, { t: 'hello', name: 'C', at: spot(0, 0), look: DEFAULT_LOOK });
    expect(c.got[0]).toMatchObject({ players: [{ id: ida, look }, {}, {}] });
  });

  it('처음 들어온 사람이 방장', () => {
    const roster = new Roster();
    const a = peer();
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    expect(roster.owner).toBe(ida);
    expect(a.got[0]).toMatchObject({ t: 'welcome', id: ida, owner: ida });
  });

  it('방장이 나가면 남은 사람 중 가장 먼저 들어온 사람에게 — leave 다음에 owner', () => {
    const roster = new Roster();
    const [a, b, c] = [peer(), peer(), peer()];
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    roster.join(c, { t: 'hello', name: 'C', at: spot(3, 3), look: DEFAULT_LOOK });
    roster.leave(ida);
    expect(roster.owner).toBe(idb);
    expect(c.got.slice(-2)).toEqual([
      { t: 'leave', id: ida },
      { t: 'owner', id: idb },
    ]);
    expect(b.got.at(-1)).toEqual({ t: 'owner', id: idb });
  });

  it('방장이 아닌 사람이 나가면 방장은 그대로, owner 를 보내지 않는다', () => {
    const roster = new Roster();
    const [a, b] = [peer(), peer()];
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    roster.leave(idb);
    expect(roster.owner).toBe(ida);
    expect(a.got.at(-1)).toEqual({ t: 'leave', id: idb });
  });

  it('옛 방장이 다시 들어와도 되찾지 않는다 — 새 접속은 새 사람', () => {
    const roster = new Roster();
    const [a, b, a2] = [peer(), peer(), peer()];
    const ida = roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    roster.leave(ida);
    roster.join(a2, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    expect(roster.owner).toBe(idb);
    expect(a2.got[0]).toMatchObject({ owner: idb });
  });

  it('모두 나가면 방장이 비고, 다음에 들어온 사람이 방장', () => {
    const roster = new Roster();
    const ida = roster.join(peer(), { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    roster.leave(ida);
    expect(roster.owner).toBeNull();
    const idb = roster.join(peer(), { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    expect(roster.owner).toBe(idb);
  });

  it('명단에 든 뒤의 hello 는 무시한다', () => {
    const roster = new Roster();
    const a = peer();
    const b = peer();
    roster.join(a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const idb = roster.join(b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    const count = a.got.length;
    roster.handle(idb, { t: 'hello', name: 'C', at: spot(3, 3), look: DEFAULT_LOOK });
    expect(a.got.length).toBe(count);
  });
});

describe('Roster — 문 배정', () => {
  // 문 0 = 윗줄 (1~2, 0) 붙은 두 칸, 처음엔 배정 없음
  const small: RoomTemplate = { id: 'small', name: '작은 방', room: { rows: ['#DD#', '#S.#', '####'], objects: [], doors: [] } };
  const hello = (name: string): Extract<ClientMsg, { t: 'hello' }> => ({ t: 'hello', name, at: spot(1, 1), look: DEFAULT_LOOK });

  function twoPeople(): { roster: Roster; a: ReturnType<typeof peer>; b: ReturnType<typeof peer>; ida: string; idb: string } {
    const roster = new Roster(Date.now, small);
    const [a, b] = [peer(), peer()];
    const ida = roster.join(a, hello('A'));
    const idb = roster.join(b, hello('B'));
    return { roster, a, b, ida, idb };
  }

  it('방장이 문에 게임을 배정하면 보낸 방장 포함 모두에게 room', () => {
    const { roster, a, b, ida } = twoPeople();
    roster.handle(ida, { t: 'door', x: 2, y: 0, game: 'a-1' });
    const room = { ...small.room, doors: [{ x: 2, y: 0, game: 'a-1' }] };
    expect(a.got.at(-1)).toEqual({ t: 'room', room });
    expect(b.got.at(-1)).toEqual({ t: 'room', room });
  });

  it('바뀐 방은 나중에 들어온 사람의 welcome 에 실린다 — map 은 템플릿 id 그대로', () => {
    const { roster, ida } = twoPeople();
    roster.handle(ida, { t: 'door', x: 1, y: 0, game: 'a-1' });
    const c = peer();
    roster.join(c, hello('C'));
    expect(c.got[0]).toMatchObject({ t: 'welcome', map: 'small', room: { doors: [{ x: 1, y: 0, game: 'a-1' }] } });
  });

  it('null 이면 배정을 지운다', () => {
    const { roster, a, ida } = twoPeople();
    roster.handle(ida, { t: 'door', x: 1, y: 0, game: 'a-1' });
    roster.handle(ida, { t: 'door', x: 2, y: 0, game: null });
    expect(a.got.at(-1)).toEqual({ t: 'room', room: small.room });
  });

  it('방장이 아니면 버린다 — 승계 뒤에는 새 방장만', () => {
    const { roster, a, b, ida, idb } = twoPeople();
    roster.handle(idb, { t: 'door', x: 1, y: 0, game: 'a-1' });
    expect(a.got.at(-1)?.t).not.toBe('room');
    roster.leave(ida);
    roster.handle(idb, { t: 'door', x: 1, y: 0, game: 'a-1' });
    expect(b.got.at(-1)).toMatchObject({ t: 'room' });
  });

  it('문 칸이 아니거나 이미 그 게임이면 아무것도 보내지 않는다', () => {
    const { roster, a, ida } = twoPeople();
    const count = a.got.length;
    roster.handle(ida, { t: 'door', x: 1, y: 1, game: 'a-1' });
    roster.handle(ida, { t: 'door', x: 1, y: 0, game: null });
    expect(a.got.length).toBe(count);
    roster.handle(ida, { t: 'door', x: 1, y: 0, game: 'a-1' });
    roster.handle(ida, { t: 'door', x: 2, y: 0, game: 'a-1' });
    expect(a.got.length).toBe(count + 1);
  });
});

describe('Rooms', () => {
  it('같은 방끼리만 서로를 본다', () => {
    const rooms = new Rooms();
    const a = peer();
    const b = peer();
    rooms.join('aaaaaa', a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const idb = rooms.join('bbbbbb', b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    rooms.handle('bbbbbb', idb, { t: 'move', at: spot(3, 3) });
    expect(a.got.map((m) => m.t)).toEqual(['welcome']);
    expect(b.got[0]).toMatchObject({ t: 'welcome', players: [{ name: 'B' }] });
  });

  it('시계를 방마다의 명단에 넘긴다 — 도배 제한이 같은 시계로 돈다', () => {
    let now = 0;
    const rooms = new Rooms(() => now);
    const a = peer();
    const ida = rooms.join('aaaaaa', a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    for (let i = 0; i < CHAT_BURST + 1; i++) rooms.handle('aaaaaa', ida, { t: 'chat', text: `${i}` });
    now += CHAT_WINDOW_MS;
    rooms.handle('aaaaaa', ida, { t: 'chat', text: '다시' });
    expect(a.got.filter((m) => m.t === 'chat')).toHaveLength(CHAT_BURST + 1);
  });

  it('방을 만드는 hello 의 맵으로 방이 생기고, 참여자의 맵은 무시한다', () => {
    const forest = ROOM_TEMPLATES.find((t) => t.id === 'forest');
    if (!forest) throw new Error('숲길 템플릿이 없다');
    const rooms = new Rooms();
    const a = peer();
    const b = peer();
    rooms.join('aaaaaa', a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK, map: 'forest' });
    rooms.join('aaaaaa', b, { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK, map: 'court' });
    expect(a.got[0]).toMatchObject({ t: 'welcome', map: 'forest', room: forest.room });
    expect(b.got[0]).toMatchObject({ t: 'welcome', map: 'forest', room: forest.room });
  });

  it('맵이 없거나 모르는 id 면 기본 방으로 만든다', () => {
    const rooms = new Rooms();
    const a = peer();
    const b = peer();
    rooms.join('aaaaaa', a, { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    rooms.join('bbbbbb', b, { t: 'hello', name: 'B', at: spot(1, 1), look: DEFAULT_LOOK, map: 'nowhere' });
    expect(a.got[0]).toMatchObject({ map: 'plaza', room: DEFAULT_ROOM });
    expect(b.got[0]).toMatchObject({ map: 'plaza', room: DEFAULT_ROOM });
  });

  it('비어 사라진 방은 다음 hello 의 맵으로 다시 생긴다', () => {
    const rooms = new Rooms();
    const ida = rooms.join('aaaaaa', peer(), { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK, map: 'forest' });
    rooms.leave('aaaaaa', ida);
    const b = peer();
    rooms.join('aaaaaa', b, { t: 'hello', name: 'B', at: spot(1, 1), look: DEFAULT_LOOK, map: 'court' });
    expect(b.got[0]).toMatchObject({ map: 'court' });
  });

  it('마지막 사람이 나가면 방이 사라진다', () => {
    const rooms = new Rooms();
    const ida = rooms.join('aaaaaa', peer(), { t: 'hello', name: 'A', at: spot(1, 1), look: DEFAULT_LOOK });
    const idb = rooms.join('aaaaaa', peer(), { t: 'hello', name: 'B', at: spot(2, 2), look: DEFAULT_LOOK });
    expect(rooms.count).toBe(1);
    rooms.leave('aaaaaa', ida);
    expect(rooms.count).toBe(1);
    rooms.leave('aaaaaa', idb);
    expect(rooms.count).toBe(0);
    // 없는 방은 무시
    rooms.leave('aaaaaa', idb);
    rooms.handle('aaaaaa', idb, { t: 'move', at: spot(3, 3) });
  });
});
