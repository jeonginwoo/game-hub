// 로비 명단 — 방 하나의 접속자 목록과 중계, 그리고 방 코드별 묶음. 전송(ws)과 분리한 순수 모듈이라 소켓 없이 단위 테스트한다.
// 위치는 클라이언트 권위(결정 2026-10-09): 받은 위치를 그대로 기록하고 다른 사람에게 전한다.
// 방장은 서버가 정한다(결정 2026-10-16): 처음 들어온 사람, 나가면 남은 사람 중 가장 먼저 들어온 사람.
// 방 데이터는 메모리에만 — 방이 생길 때 받아 welcome 에 싣고, 마지막 사람이 나가면 방과 함께 사라진다 (결정 2026-10-16: 방이 상태를 갖는다).
import type { ClientMsg, Look, Player, ServerMsg } from './protocol.ts';
import type { RoomData } from './room-map.ts';
import { DEFAULT_ROOM } from './room-templates.ts';

export interface Peer {
  send(msg: ServerMsg): void;
}

// 채팅 도배 막기 — 한 사람이 CHAT_WINDOW_MS 안에 CHAT_BURST 줄까지. 넘친 줄은 조용히 버린다
export const CHAT_BURST = 5;
export const CHAT_WINDOW_MS = 5_000;

function sameLook(a: Look, b: Look): boolean {
  return a.body === b.body && a.hair === b.hair && a.hat === b.hat && a.beard === b.beard;
}

/** 지금 시각(ms) — 테스트에서 고정값을 넣는다 */
export type Clock = () => number;

export class Roster {
  private readonly players = new Map<string, { info: Player; peer: Peer; chats: readonly number[] }>();
  private nextId = 1;
  private ownerId: string | null = null;

  private readonly now: Clock;
  /** 이 방의 맵·물체·문 배정 — 서버는 들고 보낼 뿐, 위치를 이것과 대조하지 않는다 */
  readonly room: RoomData;

  constructor(now: Clock = Date.now, room: RoomData = DEFAULT_ROOM) {
    this.now = now;
    this.room = room;
  }

  get size(): number {
    return this.players.size;
  }

  /** 지금 방장 id — 아무도 없으면 null */
  get owner(): string | null {
    return this.ownerId;
  }

  /**
   * hello 를 보낸 접속자를 명단에 넣고 id 를 돌려준다.
   * 본인에게 welcome(본인 포함 명단 + 방 데이터), 나머지에게 join.
   */
  join(peer: Peer, hello: Extract<ClientMsg, { t: 'hello' }>): string {
    const id = `p${this.nextId++}`;
    const info: Player = { id, name: hello.name, ...hello.at, look: hello.look };
    this.broadcast({ t: 'join', player: info });
    this.players.set(id, { info, peer, chats: [] });
    this.ownerId ??= id;
    peer.send({ t: 'welcome', id, owner: this.ownerId, players: [...this.players.values()].map((p) => p.info), room: this.room });
    return id;
  }

  /**
   * 모르는 id 는 무시 — 이미 나간 접속자의 늦은 메시지.
   * 방장이 나가면 leave 다음에 owner — 게임에 들어간 것(연결 끊김)도 나간 것이고, 돌아와도 새 접속이라 되찾지 않는다
   */
  leave(id: string): void {
    if (!this.players.delete(id)) return;
    this.broadcast({ t: 'leave', id });
    if (id !== this.ownerId) return;
    // Map 은 넣은 순서를 지킨다 — 첫 번째가 가장 먼저 들어온 사람
    const next = this.players.keys().next();
    this.ownerId = next.done ? null : next.value;
    if (this.ownerId !== null) this.broadcast({ t: 'owner', id: this.ownerId });
  }

  /** 명단에 든 뒤의 메시지. hello 를 또 보내면 무시한다 — 이름 바꾸기는 rename */
  handle(id: string, msg: ClientMsg): void {
    const me = this.players.get(id);
    if (!me) return;
    switch (msg.t) {
      case 'move':
        me.info = { ...me.info, ...msg.at };
        this.broadcast({ t: 'move', id, at: msg.at }, id);
        return;
      case 'chat': {
        const now = this.now();
        const recent = me.chats.filter((t) => now - t < CHAT_WINDOW_MS);
        if (recent.length >= CHAT_BURST) return;
        me.chats = [...recent, now];
        // 보낸 사람에게도 보낸다 — 모두가 같은 순서로 보고, 버려진 줄은 본인 화면에도 안 나온다
        this.broadcast({ t: 'chat', id, text: msg.text });
        return;
      }
      case 'rename':
        if (msg.name === me.info.name) return;
        me.info = { ...me.info, name: msg.name };
        this.broadcast({ t: 'rename', id, name: msg.name }, id);
        return;
      case 'look':
        if (sameLook(msg.look, me.info.look)) return;
        me.info = { ...me.info, look: msg.look };
        this.broadcast({ t: 'look', id, look: msg.look }, id);
        return;
      case 'hello':
        return;
    }
  }

  private broadcast(msg: ServerMsg, except?: string): void {
    for (const [pid, p] of this.players) {
      if (pid !== except) p.peer.send(msg);
    }
  }
}

/** 방 코드별 명단. 방은 처음 들어온 사람이 만들고, 마지막 사람이 나가면 없앤다 (결정 2026-10-14) */
export class Rooms {
  private readonly rooms = new Map<string, Roster>();
  private readonly now: Clock;

  constructor(now: Clock = Date.now) {
    this.now = now;
  }

  /** 지금 열린 방 수 */
  get count(): number {
    return this.rooms.size;
  }

  join(code: string, peer: Peer, hello: Extract<ClientMsg, { t: 'hello' }>): string {
    let roster = this.rooms.get(code);
    if (!roster) {
      roster = new Roster(this.now);
      this.rooms.set(code, roster);
    }
    return roster.join(peer, hello);
  }

  handle(code: string, id: string, msg: ClientMsg): void {
    this.rooms.get(code)?.handle(id, msg);
  }

  leave(code: string, id: string): void {
    const roster = this.rooms.get(code);
    if (!roster) return;
    roster.leave(id);
    if (roster.size === 0) this.rooms.delete(code);
  }
}
