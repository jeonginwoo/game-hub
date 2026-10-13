// 게임 입장·복귀 — 계약(docs/game-entry-contract.md)의 로비 쪽 구현. Three.js·DOM 과 무관한 순수 함수.
// 복귀 URL 에는 로비 전용 `hub_door` 를 넣어 들어갔던 문 앞에 다시 세운다 (게임에게는 불투명한 값).
import type { GameEntry } from './games';
import type { Pos, TileMap } from './map';
import { DIR_DELTA, type Dir } from './movement';

const RETURN_PARAM = 'hub_return';
const DOOR_PARAM = 'hub_door';

/** 문 번호에 배정된 게임. 배정이 없거나 등록 표에 없는 id 면 undefined */
export function gameAtDoor(
  door: number,
  games: readonly GameEntry[],
  doorGames: Readonly<Record<number, string>>,
): GameEntry | undefined {
  const id = doorGames[door];
  return id === undefined ? undefined : games.find((g) => g.id === id);
}

/** 위치가 문 타일이면 그 문 번호, 아니면 undefined */
export function doorIndexAt(map: TileMap, p: Pos): number | undefined {
  const i = map.doors.findIndex((d) => d.x === p.x && d.y === p.y);
  return i < 0 ? undefined : i;
}

/**
 * 게임으로 갈 URL. 등록 URL 의 기존 쿼리·해시는 손대지 않고 `hub_return` 만 덧붙인다.
 * searchParams.set 은 기존 쿼리를 다시 직렬화하므로(`?flag` → `?flag=`) 문자열로 붙인다.
 */
export function entryUrl(gameUrl: string, returnUrl: string, lobbyHref: string): string {
  const url = new URL(gameUrl, lobbyHref);
  const sep = url.search ? '&' : '?';
  url.search = `${url.search}${sep}${RETURN_PARAM}=${encodeURIComponent(returnUrl)}`;
  return url.href;
}

/** 게임이 끝나고 돌아올 로비 URL — 절대 URL, `hub_door` 에 들어간 문 번호 */
export function returnUrl(lobbyHref: string, door: number): string {
  const url = new URL(lobbyHref);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`복귀 URL 은 http(s) 여야 한다 — ${url.protocol}`);
  }
  url.searchParams.set(DOOR_PARAM, String(door));
  return url.href;
}

/** 로비 URL 에서 `hub_door` 를 뺀 것 — 복귀 뒤 새로고침하면 원래 시작점에서 시작하게 */
export function withoutDoorParam(lobbyHref: string): string {
  const url = new URL(lobbyHref);
  if (!url.searchParams.has(DOOR_PARAM)) return lobbyHref;
  url.searchParams.delete(DOOR_PARAM);
  return url.href;
}

// 문 앞 칸을 찾는 순서 — 지금 맵의 문은 모두 윗벽에 있어 아래가 먼저
const FRONT_ORDER: readonly Dir[] = ['down', 'up', 'left', 'right'];

export interface Spawn {
  readonly pos: Pos;
  readonly facing: Dir;
}

/** 문에서 바로 걸어 나온 자리와 그때 보는 방향(문 반대쪽). 사방이 막혔으면 undefined */
export function doorFront(map: TileMap, door: Pos): Spawn | undefined {
  for (const dir of FRONT_ORDER) {
    const d = DIR_DELTA[dir];
    const pos = { x: door.x + d.x, y: door.y + d.y };
    if (map.tileAt(pos) === 'floor') return { pos, facing: dir };
  }
  return undefined;
}

/** 로드 시 등장 위치 — 유효한 `hub_door` 가 있으면 그 문 앞, 아니면 맵 시작점 */
export function spawnFromSearch(map: TileMap, search: string): Spawn {
  const fallback: Spawn = { pos: map.start, facing: 'down' };
  const raw = new URLSearchParams(search).get(DOOR_PARAM);
  if (raw === null || !/^\d+$/.test(raw)) return fallback;
  const door = map.doors[Number(raw)];
  if (!door) return fallback;
  return doorFront(map, door) ?? fallback;
}
