// 로비 ↔ 멀티 서버 메시지 (JSON over WebSocket, 경로 /ws) — 순수 모듈, node·DOM 을 import 하지 않는다 (로비 src/ 도 쓴다).
// 위치는 클라이언트 권위(결정 2026-10-09): 서버는 형식만 검사하고 명단 관리·중계만 한다. 좌표는 칸 단위(로비 타일의 1/2).
// 방 데이터(맵·물체·문 배정)는 서버가 들고 welcome 에 실어 보낸다 (결정 2026-10-16: 방이 상태를 갖는다).
import { parseRoomData, type RoomData } from './room-map.ts';

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly dir: Dir;
}

// 캐릭터 외형 — 부위마다 선택지 표의 번호 (결정 2026-10-16: 캐릭터 꾸미기). 색·그림은 로비 몫(look.ts),
// 서버는 번호 범위만 본다 — 방 데이터에 임의 색·글이 섞이지 않게
export interface Look {
  readonly body: number; // 몸 색
  readonly hair: number; // 머리 색
  readonly hat: number; // 0 = 없음
  readonly beard: number; // 0 = 없음
}

export type LookPart = keyof Look;

/** 부위별 선택지 수 — 로비의 그림 표(look.ts)와 길이가 같아야 한다 (테스트가 본다) */
export const LOOK_CHOICES: Readonly<Record<LookPart, number>> = { body: 8, hair: 5, hat: 4, beard: 3 };

export const DEFAULT_LOOK: Look = { body: 0, hair: 0, hat: 0, beard: 0 };

export interface Player extends Spot {
  readonly id: string;
  readonly name: string;
  readonly look: Look;
}

export type ClientMsg =
  | { readonly t: 'hello'; readonly name: string; readonly at: Spot; readonly look: Look } // 접속 후 첫 메시지 — 그 전에는 명단에 없다
  | { readonly t: 'move'; readonly at: Spot }
  | { readonly t: 'chat'; readonly text: string } // 같은 방 모두에게 — 보낸 사람에게도 돌아온다
  | { readonly t: 'rename'; readonly name: string } // 로비 안 닉네임 변경 — 보낸 사람은 이미 바꿨으므로 돌려받지 않는다
  | { readonly t: 'look'; readonly look: Look }; // 외형 바꾸기 — rename 처럼 보낸 사람은 돌려받지 않는다

export type ServerMsg =
  // players 에 본인 포함, owner 는 방장 id, room 은 이 방의 데이터 — 로비는 buildRoom 으로 다시 검사한다
  | { readonly t: 'welcome'; readonly id: string; readonly owner: string; readonly players: readonly Player[]; readonly room: RoomData }
  | { readonly t: 'join'; readonly player: Player }
  | { readonly t: 'move'; readonly id: string; readonly at: Spot }
  | { readonly t: 'leave'; readonly id: string }
  | { readonly t: 'chat'; readonly id: string; readonly text: string }
  | { readonly t: 'rename'; readonly id: string; readonly name: string }
  | { readonly t: 'look'; readonly id: string; readonly look: Look }
  | { readonly t: 'owner'; readonly id: string }; // 방장이 바뀜 — 방장이 나가 승계될 때 (결정 2026-10-16: 서버가 정한 방장)

export const NAME_MAX = 16; // 글자
export const COORD_MAX = 1000; // 칸 — 서버는 위치를 맵과 대조하지 않으므로 넉넉한 상한만 둔다
export const DEFAULT_NAME = '손님';
export const CHAT_MAX = 200; // 글자

// 방 코드 — 접속 주소 `/ws?room=<코드>`. 로비가 만들고 서버는 형식만 본다 (결정 2026-10-14: 로그인 없이 방 + 초대 링크).
// 헷갈리는 글자(0·o, 1·l·i)는 뺀다 — 사람이 보고 옮겨 적는 값이라
export const ROOM_ALPHABET = '23456789abcdefghjkmnpqrstuvwxyz';
export const ROOM_CODE_LENGTH = 6; // 글자
export const ROOM_PARAM = 'room';
const ROOM_CODE_RE = new RegExp(`^[${ROOM_ALPHABET}]{${ROOM_CODE_LENGTH}}$`);

export function isRoomCode(v: string): boolean {
  return ROOM_CODE_RE.test(v);
}

/** 접속 요청 경로(`/ws?room=…`)의 방 코드. 없거나 형식이 틀리면 null */
export function roomFromPath(path: string): string | null {
  const code = new URL(path, 'http://x').searchParams.get(ROOM_PARAM);
  return code !== null && isRoomCode(code) ? code : null;
}

const DIRS: readonly string[] = ['up', 'down', 'left', 'right'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCoord(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < COORD_MAX;
}

function isDir(v: unknown): v is Dir {
  return typeof v === 'string' && DIRS.includes(v);
}

function parseSpot(v: unknown): Spot | null {
  if (!isRecord(v)) return null;
  const { x, y, dir } = v;
  if (!isCoord(x) || !isCoord(y) || !isDir(dir)) return null;
  return { x, y, dir };
}

function isChoice(v: unknown, count: number): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v < count;
}

/** 부위 하나라도 없거나 범위 밖이면 null. 모르는 필드는 버린다 */
export function parseLook(v: unknown): Look | null {
  if (!isRecord(v)) return null;
  const { body, hair, hat, beard } = v;
  if (!isChoice(body, LOOK_CHOICES.body) || !isChoice(hair, LOOK_CHOICES.hair)) return null;
  if (!isChoice(hat, LOOK_CHOICES.hat) || !isChoice(beard, LOOK_CHOICES.beard)) return null;
  return { body, hair, hat, beard };
}

/** 제어 문자를 빼고 앞뒤 공백을 자른 뒤 NAME_MAX 글자로 — 빈 문자열일 수 있다 (로비 이름 칸이 쓴다) */
export function normalizeName(raw: string): string {
  return raw.replace(/\p{Cc}/gu, '').trim().slice(0, NAME_MAX).trim();
}

/** normalizeName 에 더해, 비면 DEFAULT_NAME (서버가 받은 hello 에 쓴다) */
export function cleanName(raw: string): string {
  return normalizeName(raw) || DEFAULT_NAME;
}

/** 채팅 한 줄 — 제어 문자·줄/문단 구분자(줄바꿈 포함)는 공백으로, 앞뒤 공백을 자르고 CHAT_MAX 글자로. 빈 문자열일 수 있다 */
export function cleanChat(raw: string): string {
  return raw.replace(/[\p{Cc}\p{Zl}\p{Zp}]/gu, ' ').trim().slice(0, CHAT_MAX).trim();
}

/** 형식이 틀리면 null — 서버는 그 메시지를 조용히 버린다. 빈 채팅도 null */
export function parseClientMsg(raw: string): ClientMsg | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(v)) return null;
  switch (v.t) {
    case 'hello': {
      const at = parseSpot(v.at);
      // 외형이 틀리면 접속을 막지 않고 기본 외형으로 — 이름을 다듬는 것과 같은 태도
      const look = parseLook(v.look) ?? DEFAULT_LOOK;
      return at && typeof v.name === 'string' ? { t: 'hello', name: cleanName(v.name), at, look } : null;
    }
    case 'move': {
      const at = parseSpot(v.at);
      return at ? { t: 'move', at } : null;
    }
    case 'chat': {
      const text = typeof v.text === 'string' ? cleanChat(v.text) : '';
      return text ? { t: 'chat', text } : null;
    }
    case 'rename': {
      // hello 와 달리 빈 이름을 DEFAULT_NAME 으로 바꾸지 않는다 — 지우려다 「손님」이 되는 것은 바꾸기가 아니다
      const name = typeof v.name === 'string' ? normalizeName(v.name) : '';
      return name ? { t: 'rename', name } : null;
    }
    case 'look': {
      // hello 와 달리 기본 외형으로 바꾸지 않고 버린다 — 고른 적 없는 외형이 되는 것은 바꾸기가 아니다
      const look = parseLook(v.look);
      return look ? { t: 'look', look } : null;
    }
    default:
      return null;
  }
}

function parsePlayer(v: unknown): Player | null {
  if (!isRecord(v) || typeof v.id !== 'string' || typeof v.name !== 'string') return null;
  const at = parseSpot(v);
  return at ? { id: v.id, name: cleanName(v.name), ...at, look: parseLook(v.look) ?? DEFAULT_LOOK } : null;
}

/** 로비가 받은 서버 메시지. 형식이 틀리면 null — 로비는 그 메시지를 버린다 (서버 쪽과 같은 규칙) */
export function parseServerMsg(raw: string): ServerMsg | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(v)) return null;
  switch (v.t) {
    case 'welcome': {
      if (typeof v.id !== 'string' || typeof v.owner !== 'string' || !Array.isArray(v.players)) return null;
      const room = parseRoomData(v.room);
      if (!room) return null;
      const players: Player[] = [];
      for (const p of v.players) {
        const player = parsePlayer(p);
        if (!player) return null;
        players.push(player);
      }
      return { t: 'welcome', id: v.id, owner: v.owner, players, room };
    }
    case 'join': {
      const player = parsePlayer(v.player);
      return player ? { t: 'join', player } : null;
    }
    case 'move': {
      const at = parseSpot(v.at);
      return typeof v.id === 'string' && at ? { t: 'move', id: v.id, at } : null;
    }
    case 'leave':
      return typeof v.id === 'string' ? { t: 'leave', id: v.id } : null;
    case 'chat': {
      // 화면에 그대로 나가는 값이라 로비도 다시 다듬는다
      const text = typeof v.text === 'string' ? cleanChat(v.text) : '';
      return typeof v.id === 'string' && text ? { t: 'chat', id: v.id, text } : null;
    }
    case 'owner':
      return typeof v.id === 'string' ? { t: 'owner', id: v.id } : null;
    case 'rename':
      return typeof v.id === 'string' && typeof v.name === 'string' ? { t: 'rename', id: v.id, name: cleanName(v.name) } : null;
    case 'look': {
      const look = parseLook(v.look);
      return typeof v.id === 'string' && look ? { t: 'look', id: v.id, look } : null;
    }
    default:
      return null;
  }
}
