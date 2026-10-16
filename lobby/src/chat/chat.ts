// 채팅 — 채팅창 한 줄과 머리 위 말풍선의 상태. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-16: 채팅창 + 말풍선, 서버 중계). 글자 다듬기는 서버와 같은 server/src/protocol.ts.
import { cleanChat, type ServerMsg } from '../../../server/src/protocol';
import type { Others } from '../net/others';

export const LOG_MAX = 50; // 줄 — 채팅창에 남기는 수
export const BUBBLE_MS = 5_000; // 말풍선이 떠 있는 시간
// 입력 칸이 닫혀 있을 때 채팅창 한 줄이 보이는 시간과, 그 뒤 흐려지며 사라지는 시간 (열려 있으면 계속 보인다)
export const LINE_SHOW_MS = 10_000;
export const LINE_FADE_MS = 1_000; // index.html .hub-chat-fading 의 transition 과 같게

export type ChatMsg = Extract<ServerMsg, { t: 'chat' }>;

export interface ChatLine {
  readonly name: string;
  readonly text: string;
  readonly mine: boolean;
}

export interface Bubble {
  readonly text: string;
  readonly until: number; // ms — 이 시각이 지나면 내린다
}

/** 채팅 입력 칸의 글자 — 서버와 같은 규칙으로 다듬고, 비면 null (보내지 않는다) */
export function chatFromInput(raw: string): string | null {
  return cleanChat(raw) || null;
}

/**
 * 받은 채팅의 채팅창 줄. 이름은 받은 순간의 명단에서 — 내 줄(서버가 돌려준 것)은 myName.
 * 명단에 없는 id(그새 나간 사람)면 null — 누가 했는지 모르는 줄은 띄우지 않는다
 */
export function chatLine(msg: ChatMsg, others: Others, myName: string): ChatLine | null {
  if (msg.id === others.me) return { name: myName, text: msg.text, mine: true };
  const r = others.players.get(msg.id);
  return r ? { name: r.name, text: msg.text, mine: false } : null;
}

/** id 의 말풍선을 새 글로 바꾼 새 상태 — 앞 말풍선은 바로 내리고 시간을 새로 센다. 지난 말풍선은 이때 치운다 */
export function say(bubbles: ReadonlyMap<string, Bubble>, id: string, text: string, now: number): ReadonlyMap<string, Bubble> {
  const next = new Map<string, Bubble>();
  for (const [k, b] of bubbles) if (b.until > now) next.set(k, b);
  next.set(id, { text, until: now + BUBBLE_MS });
  return next;
}

/** 지금 띄울 말풍선 글 — 없거나 시간이 지났으면 null */
export function bubbleText(bubbles: ReadonlyMap<string, Bubble>, id: string, now: number): string | null {
  const b = bubbles.get(id);
  return b && b.until > now ? b.text : null;
}
