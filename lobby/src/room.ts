// 로비 방·이름 — 첫 화면이 무엇을 보일지, 방 코드 만들기·읽기, 초대 링크. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-14: 로그인 없이 방 + 닉네임 + 초대 링크). 방 코드 형식은 서버와 같은 server/src/protocol.ts.
import { isRoomCode, normalizeName, ROOM_ALPHABET, ROOM_CODE_LENGTH, ROOM_PARAM } from '../../server/src/protocol';

/** 첫 화면 — start: 이름 + 만들기/참여, name: 초대 링크로 와서 이름만, lobby: 바로 로비 */
export type Screen = 'start' | 'name' | 'lobby';

export function screenFor(room: string | null, savedName: string | null): Screen {
  if (room === null) return 'start';
  return savedName === null ? 'name' : 'lobby';
}

/** random 은 [0, 1) — 테스트에서 고정값을 넣는다 */
export function newRoomCode(random: () => number = Math.random): string {
  let code = '';
  for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
    code += ROOM_ALPHABET[Math.floor(random() * ROOM_ALPHABET.length)] ?? ROOM_ALPHABET[0];
  }
  return code;
}

/** 로비 URL 쿼리의 방 코드 — 손으로 친 대문자도 받는다. 없거나 형식이 틀리면 null */
export function roomFromSearch(search: string): string | null {
  const code = new URLSearchParams(search).get(ROOM_PARAM)?.toLowerCase();
  return code !== undefined && isRoomCode(code) ? code : null;
}

/**
 * 「코드로 참여」 칸의 입력 — 코드 그대로, 대문자·공백·하이픈 섞인 코드, 초대 링크 통째 모두 받는다.
 * 방 코드로 읽을 수 없으면 null
 */
export function roomFromInput(raw: string): string | null {
  const text = raw.trim();
  if (/^https?:\/\//i.test(text)) {
    try {
      return roomFromSearch(new URL(text).search);
    } catch {
      return null;
    }
  }
  const code = text.toLowerCase().replace(/[\s-]/g, '');
  return isRoomCode(code) ? code : null;
}

/** 로비 URL 에 방 코드를 넣은 것 — 다른 쿼리(hub_door 등)는 그대로 */
export function withRoom(lobbyHref: string, code: string): string {
  const url = new URL(lobbyHref);
  url.searchParams.set(ROOM_PARAM, code);
  return url.href;
}

/** 남에게 보낼 초대 링크 — 로비 주소에 방 코드만. 내 복귀 정보(hub_door)·해시는 넣지 않는다 */
export function inviteUrl(lobbyHref: string, code: string): string {
  const url = new URL(lobbyHref);
  url.search = '';
  url.hash = '';
  url.searchParams.set(ROOM_PARAM, code);
  return url.href;
}

/** 이름 칸의 입력 — 서버와 같은 규칙으로 다듬고, 비면 null (이름 없이는 들어가지 않는다) */
export function nameFromInput(raw: string): string | null {
  return normalizeName(raw) || null;
}
