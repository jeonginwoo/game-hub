// 로비 오른쪽 위 버튼 줄(꾸미기·사람·설정)이 보일 것 — 접속자 목록 순서, 인원, 연결 알림. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-16: 로비 정보는 오른쪽 위 버튼 둘로)
import type { Look } from '../../../server/src/protocol';
import { bodyColor } from '../avatar/look';
import type { EditTool } from '../edit/place';
import type { NetStatus } from '../net/net';
import type { Others } from '../net/others';
import type { ObjectLayer } from '../world/objects';

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

/** 편집 중 알림에 필요한 것 — 도구, 편집 창이 열렸는지, 초안에 저장 안 한 바뀐 것이 있는지 */
export interface EditNotice {
  readonly tool: EditTool;
  readonly window: boolean;
  readonly dirty: boolean;
  /** 지우개가 지우는 층 — 없으면 물체(정렬 층) */
  readonly eraseLayer?: ObjectLayer;
}

/**
 * 위쪽 가운데 알림 — 연결 알림이 먼저, 열려 있으면 편집 중(edit) 도구 안내, 둘 다 아니면 null.
 * Esc 는 창 밖에선 편집 창을, 창에선 편집 끝. 바뀐 것이 있으면 Esc 로 끝나지 않는다 — 저장·취소로
 * (결정 2026-10-21: 저장식 편집 · 편집 개편 B 놓기 창 · 2026-10-23: 편집 창 재구성)
 */
export function noticeText(status: NetStatus, edit: EditNotice | null = null): string | null {
  if (status === 'connecting') return '연결 중…';
  if (status === 'closed') return '연결 끊김 — 새로고침';
  if (edit === null) return null;
  const what = edit.window ? '도구 고르기'
    : edit.tool === 'erase' ? `누르거나 끌어서 ${ERASE_WHAT[edit.eraseLayer ?? 'sorted']} 지우기` : EDIT_NOTICE[edit.tool];
  const esc = edit.dirty ? '(저장해야 모두에게 · 저장·취소로 끝)' : edit.window ? '(Esc 끝)' : '(Esc 도구 고르기)';
  return `편집 중 — ${what} ${esc}`;
}

/** 지우개가 지우는 층 — 고른 층만 (결정 2026-10-23) */
const ERASE_WHAT: Readonly<Record<ObjectLayer, string>> = {
  floor: '바닥',
  sorted: '물체',
  top: '위 층 물체',
};

const EDIT_NOTICE: Readonly<Record<Exclude<EditTool, 'erase'>, string>> = {
  place: '누르면 놓기 · 오른쪽 클릭 치우기',
  ground: '누르거나 끌어서 바닥 재질 칠하기',
  select: '문을 눌러 게임 고르기',
  hand: '끌어서 맵 옮기기',
  paint: '누르거나 끌어서 칸 칠하기',
};
