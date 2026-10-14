// 로비 명단 — 접속자 목록과 중계. 전송(ws)과 분리한 순수 모듈이라 소켓 없이 단위 테스트한다.
// 위치는 클라이언트 권위(결정 2026-10-09): 받은 위치를 그대로 기록하고 다른 사람에게 전한다.
import type { ClientMsg, Player, ServerMsg } from './protocol.ts';

export interface Peer {
  send(msg: ServerMsg): void;
}

export class Roster {
  private readonly players = new Map<string, { info: Player; peer: Peer }>();
  private nextId = 1;

  get size(): number {
    return this.players.size;
  }

  /**
   * hello 를 보낸 접속자를 명단에 넣고 id 를 돌려준다.
   * 본인에게 welcome(본인 포함 명단), 나머지에게 join.
   */
  join(peer: Peer, hello: Extract<ClientMsg, { t: 'hello' }>): string {
    const id = `p${this.nextId++}`;
    const info: Player = { id, name: hello.name, ...hello.at };
    this.broadcast({ t: 'join', player: info });
    this.players.set(id, { info, peer });
    peer.send({ t: 'welcome', id, players: [...this.players.values()].map((p) => p.info) });
    return id;
  }

  /** 모르는 id 는 무시 — 이미 나간 접속자의 늦은 메시지 */
  leave(id: string): void {
    if (!this.players.delete(id)) return;
    this.broadcast({ t: 'leave', id });
  }

  /** 명단에 든 뒤의 메시지. hello 를 또 보내면 무시한다(이름 바꾸기는 v0 에 없음) */
  handle(id: string, msg: ClientMsg): void {
    const me = this.players.get(id);
    if (!me || msg.t !== 'move') return;
    me.info = { ...me.info, ...msg.at };
    this.broadcast({ t: 'move', id, at: msg.at }, id);
  }

  private broadcast(msg: ServerMsg, except?: string): void {
    for (const [pid, p] of this.players) {
      if (pid !== except) p.peer.send(msg);
    }
  }
}
