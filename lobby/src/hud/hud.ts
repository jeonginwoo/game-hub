// 로비 오른쪽 위 버튼 줄(꾸미기·사람·설정)이 보일 것 — 접속자 목록 순서, 인원, 연결 알림. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-16: 로비 정보는 오른쪽 위 버튼 둘로)
import type { Look } from '../../../server/src/protocol';
import { bodyColor } from '../avatar/look';
import type { EditTool } from '../edit/place';
import type { NetStatus } from '../net/net';
import type { Others } from '../net/others';

export interface RosterRow {
  readonly id: string; // welcome 전의 나는 ''
  readonly name: string;
  readonly color: string; // 화면 속 몸 색(외형) — 목록과 캐릭터를 맞춰 보게
  readonly mine: boolean;
  readonly owner: boolean; // 방장 — 목록에 왕관
}

/** 접속자 목록 — 나를 맨 위에, 나머지는 들어온 순서(서버 명단·join 순서)대로 */
export function rosterRows(others: Others, myName: string, myLook: Look): readonly RosterRow[] {
  const isOwner = (id: string | null): boolean => id !== null && id === others.owner;
  const rows: RosterRow[] = [{ id: others.me ?? '', name: myName, color: bodyColor(myLook), mine: true, owner: isOwner(others.me) }];
  for (const r of others.players.values()) {
    rows.push({ id: r.id, name: r.name, color: bodyColor(r.look), mine: false, owner: isOwner(r.id) });
  }
  return rows;
}

/** 사람 버튼 옆 숫자 — 나를 포함한 인원. 연결이 열려 있지 않으면 null (모르는 수를 보이지 않는다) */
export function peopleCount(status: NetStatus, others: Others): number | null {
  return status === 'open' ? others.players.size + 1 : null;
}

/** 위쪽 가운데 알림 — 연결 알림이 먼저, 열려 있으면 편집 중(tool) 도구 안내, 둘 다 아니면 null */
export function noticeText(status: NetStatus, tool: EditTool | null = null): string | null {
  if (status === 'connecting') return '연결 중…';
  if (status === 'closed') return '연결 끊김 — 새로고침';
  return tool === null ? null : EDIT_NOTICE[tool];
}

const EDIT_NOTICE: Readonly<Record<EditTool, string>> = {
  door: '편집 중 — 문을 눌러 게임 고르기 (Esc 끝)',
  place: '편집 중 — 고른 물체를 맵에 놓기 (Esc 끝)',
  remove: '편집 중 — 누른 물체 치우기 (Esc 끝)',
  paint: '편집 중 — 누르거나 끌어서 칸 칠하기 (Esc 끝)',
};
