// 같은 방의 다른 플레이어 — 서버 메시지를 상태에 반영하고, 한 칸씩 걷는 모습을 보간한다. Three.js·DOM 과 무관한 순수 함수.
// 위치는 클라이언트 권위(결정 2026-10-09): 받은 칸을 그대로 믿고, 이웃 칸이면 걸어가고 멀면 순간 이동한다.
import type { Player, ServerMsg, Spot } from '../../server/src/protocol';

export interface Remote {
  readonly id: string;
  readonly name: string;
  readonly at: Spot; // 도착할 칸 (걷는 중이 아니면 서 있는 칸)
  readonly fromX: number; // 걷기 시작한 자리 — 걷는 도중에 새 칸이 오면 그때의 중간 위치
  readonly fromY: number;
  readonly t: number; // from → at 진행도, 1 이면 정지
}

export interface Others {
  readonly me: string | null; // welcome 전에는 null
  readonly players: ReadonlyMap<string, Remote>;
}

export const NO_OTHERS: Others = { me: null, players: new Map() };

function standing(p: Player): Remote {
  return { id: p.id, name: p.name, at: { x: p.x, y: p.y, dir: p.dir }, fromX: p.x, fromY: p.y, t: 1 };
}

/** 지금 그릴 자리(타일 단위, 걷는 중이면 칸 사이) */
export function remotePos(r: Remote): { readonly x: number; readonly y: number } {
  return { x: r.fromX + (r.at.x - r.fromX) * r.t, y: r.fromY + (r.at.y - r.fromY) * r.t };
}

function moved(r: Remote, at: Spot): Remote {
  const now = remotePos(r);
  const step = Math.abs(at.x - r.at.x) + Math.abs(at.y - r.at.y);
  // 이웃 칸이면 걷는다. 같은 칸(방향만 바뀜)이나 먼 칸(문 앞 등장 등)은 바로 그 자리
  if (step === 1) return { ...r, at, fromX: now.x, fromY: now.y, t: 0 };
  return { ...r, at, fromX: at.x, fromY: at.y, t: 1 };
}

/** 서버 메시지 하나를 반영한 새 상태. 나 자신은 명단에 넣지 않는다 */
export function applyMsg(state: Others, msg: ServerMsg): Others {
  switch (msg.t) {
    case 'welcome': {
      const players = new Map<string, Remote>();
      for (const p of msg.players) if (p.id !== msg.id) players.set(p.id, standing(p));
      return { me: msg.id, players };
    }
    case 'join': {
      if (msg.player.id === state.me) return state;
      const players = new Map(state.players);
      players.set(msg.player.id, standing(msg.player));
      return { ...state, players };
    }
    case 'move': {
      const r = state.players.get(msg.id);
      if (!r) return state;
      const players = new Map(state.players);
      players.set(msg.id, moved(r, msg.at));
      return { ...state, players };
    }
    case 'leave': {
      if (!state.players.has(msg.id)) return state;
      const players = new Map(state.players);
      players.delete(msg.id);
      return { ...state, players };
    }
  }
}

/** dtMs 만큼 걷기를 진행한 새 상태 — stepMs 는 한 칸 걷는 시간(내 캐릭터와 같게) */
export function advance(state: Others, dtMs: number, stepMs: number): Others {
  let changed = false;
  const players = new Map<string, Remote>();
  for (const [id, r] of state.players) {
    if (r.t < 1) {
      changed = true;
      players.set(id, { ...r, t: Math.min(1, r.t + dtMs / stepMs) });
    } else {
      players.set(id, r);
    }
  }
  return changed ? { ...state, players } : state;
}

/** 다른 플레이어를 구별할 몸 색 — id 로 고정해 다시 접속해도(같은 id 면) 같은 색 */
export const OTHER_COLORS: readonly string[] = ['#bf616a', '#a3be8c', '#b48ead', '#d08770', '#88c0d0', '#ebcb8b'];

export function colorFor(id: string): string {
  let h = 0;
  for (const ch of id) h = (h * 31 + (ch.codePointAt(0) ?? 0)) >>> 0;
  return OTHER_COLORS[h % OTHER_COLORS.length] ?? '#bf616a';
}
