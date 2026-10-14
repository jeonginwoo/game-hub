// 로비 ↔ 멀티 서버 메시지 (JSON over WebSocket, 경로 /ws) — 순수 모듈, node·DOM 을 import 하지 않는다.
// 위치는 클라이언트 권위(결정 2026-10-09): 서버는 형식만 검사하고 명단 관리·중계만 한다. 좌표는 타일 단위.

export type Dir = 'up' | 'down' | 'left' | 'right';

export interface Spot {
  readonly x: number;
  readonly y: number;
  readonly dir: Dir;
}

export interface Player extends Spot {
  readonly id: string;
  readonly name: string;
}

export type ClientMsg =
  | { readonly t: 'hello'; readonly name: string; readonly at: Spot } // 접속 후 첫 메시지 — 그 전에는 명단에 없다
  | { readonly t: 'move'; readonly at: Spot };

export type ServerMsg =
  | { readonly t: 'welcome'; readonly id: string; readonly players: readonly Player[] } // players 에 본인 포함
  | { readonly t: 'join'; readonly player: Player }
  | { readonly t: 'move'; readonly id: string; readonly at: Spot }
  | { readonly t: 'leave'; readonly id: string };

export const NAME_MAX = 16; // 글자
export const COORD_MAX = 1000; // 타일 — 맵 크기를 서버가 모르므로 넉넉한 상한만 둔다
export const DEFAULT_NAME = '손님';

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

/** 제어 문자를 빼고 앞뒤 공백을 자른 뒤 NAME_MAX 글자로 — 비면 DEFAULT_NAME */
export function cleanName(raw: string): string {
  const name = raw.replace(/\p{Cc}/gu, '').trim().slice(0, NAME_MAX);
  return name || DEFAULT_NAME;
}

/** 형식이 틀리면 null — 서버는 그 메시지를 조용히 버린다 */
export function parseClientMsg(raw: string): ClientMsg | null {
  let v: unknown;
  try {
    v = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(v)) return null;
  const at = parseSpot(v.at);
  if (!at) return null;
  switch (v.t) {
    case 'hello':
      return typeof v.name === 'string' ? { t: 'hello', name: cleanName(v.name), at } : null;
    case 'move':
      return { t: 'move', at };
    default:
      return null;
  }
}
