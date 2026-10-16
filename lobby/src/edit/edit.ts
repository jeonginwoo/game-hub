// 로비 편집 모드 — 누가 편집할 수 있는지, 문 표시, 문을 눌렀을 때의 게임 목록. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-16: 문 배정은 편집 모드에서 문을 눌러서 · 서버가 정한 방장)
import type { Room } from '../../../server/src/room-map';
import type { GameEntry } from '../data/games';
import { gameAtDoor } from '../launch/entry';
import type { Others } from '../net/others';

/** 편집은 방장만 — 서버도 방장이 보낸 door 만 받는다. welcome 전에는 false */
export function canEdit(others: Others): boolean {
  return others.me !== null && others.me === others.owner;
}

export interface DoorMark {
  readonly door: number;
  /** 문을 감싼 사각형(칸) — 왼쪽 위 칸과 크기 */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  /** 등록 표에 있는 게임이 배정됨 — 배경의 열린 문과 같은 판정 */
  readonly open: boolean;
}

/** 편집 중 문마다 그릴 테두리 — 문 번호 순 */
export function doorMarks(room: Room, games: readonly GameEntry[]): readonly DoorMark[] {
  return room.map.doors.map((d, door) => ({ door, ...d, open: gameAtDoor(door, games, room.doorGames) !== undefined }));
}

export interface DoorChoice {
  /** 고르면 door 로 보낼 값 — null 은 배정 해제 */
  readonly game: string | null;
  readonly title: string;
  readonly current: boolean;
}

/** 문을 눌렀을 때의 목록 — 없음, 등록 표 순서. 등록 표에 없는 id 가 배정돼 있으면 끝에 그 줄(지금 것) */
export function doorChoices(
  door: number,
  games: readonly GameEntry[],
  doorGames: Readonly<Record<number, string>>,
): readonly DoorChoice[] {
  const now = doorGames[door];
  const rows: DoorChoice[] = [
    { game: null, title: '없음', current: now === undefined },
    ...games.map((g) => ({ game: g.id, title: g.title, current: g.id === now })),
  ];
  if (now !== undefined && !games.some((g) => g.id === now)) rows.push({ game: now, title: `모르는 게임 (${now})`, current: true });
  return rows;
}
