// 로비 오른쪽 위 버튼 줄(사람·설정)이 보일 것 — 접속자 목록 순서, 인원, 연결 알림. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-16: 로비 정보는 오른쪽 위 버튼 둘로)
import type { NetStatus } from './net';
import { colorFor, type Others } from './others';

export interface RosterRow {
  readonly id: string; // welcome 전의 나는 ''
  readonly name: string;
  readonly color: string; // 화면 속 몸 색 — 목록과 캐릭터를 맞춰 보게
  readonly mine: boolean;
}

/** 접속자 목록 — 나를 맨 위에, 나머지는 들어온 순서(서버 명단·join 순서)대로 */
export function rosterRows(others: Others, myName: string, myColor: string): readonly RosterRow[] {
  const rows: RosterRow[] = [{ id: others.me ?? '', name: myName, color: myColor, mine: true }];
  for (const r of others.players.values()) rows.push({ id: r.id, name: r.name, color: colorFor(r.id), mine: false });
  return rows;
}

/** 사람 버튼 옆 숫자 — 나를 포함한 인원. 연결이 열려 있지 않으면 null (모르는 수를 보이지 않는다) */
export function peopleCount(status: NetStatus, others: Others): number | null {
  return status === 'open' ? others.players.size + 1 : null;
}

/** 위쪽 가운데 연결 알림 — 열려 있으면 null */
export function noticeText(status: NetStatus): string | null {
  if (status === 'connecting') return '연결 중…';
  if (status === 'closed') return '연결 끊김 — 새로고침';
  return null;
}
