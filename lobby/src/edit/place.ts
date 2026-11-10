// 편집 도구 — 창 탭·아래 줄 도구·붓·지우개 층 이름과 창 열기 버튼 글, 물체 놓기 자리·놓을 수 있는지·치울 물체 고르기·놓기 창 썸네일 배율·Esc 한 단계. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-16: 물체 배치 편집 — 놓기 판정은 서버와 같은 placeObject · 2026-10-21: 편집 개편 B 놓기 창 · C 도구 상자 · 2026-10-23: 편집 창 재구성 · 2026-10-24: 지우개·손은 아래 줄
//  · 2026-11-10: 바닥 재질 붓, 바닥 층 그림끼리 겹쳐 놓지 않기 · 편집 개편 D2: 열림/닫힘 토글)
import {
  footCell, OBJECT_SHAPES, parseMap, placeObject, type ObjectKind, type ObjectState, type Pos, type Rect, type RoomData, type TileChar, type TileMap,
} from '../../../server/src/room-map';
import { OBJECT_ART } from '../data/object-art';
import { OBJECT_INFO } from '../data/object-names';
import { objectRect, objectZ, type MapObject, type ObjectLayer } from '../world/objects';
import { brushName, type GroundBrush } from './ground-brush';

/** 편집 도구 상자 — 물체 놓기(오른쪽 클릭은 치우기) · 바닥 재질 칠하기 · 수정(문을 눌러 게임 배정) · 지우개(물체) · 손(맵 끌기) · 타일 칠하기 */
export type EditTool = 'place' | 'ground' | 'select' | 'erase' | 'hand' | 'paint';

/** 편집 창 위 탭의 도구 — 고를 것이 있는 도구. 지우개·손은 성격이 달라 아래 줄에 따로 (결정 2026-10-24) */
export type WindowTool = 'place' | 'select' | 'paint';

/** 편집 창 위 탭 — 이 순서로 */
export const WINDOW_TOOLS: readonly { readonly tool: WindowTool; readonly name: string }[] = [
  { tool: 'place', name: '오브젝트' },
  { tool: 'select', name: '게임' },
  { tool: 'paint', name: '타일 규칙' },
];

/** 아래 줄의 도구 — 창 없이 바로 */
export const BAR_TOOLS: readonly { readonly tool: Exclude<EditTool, WindowTool>; readonly name: string }[] = [
  { tool: 'erase', name: '지우개' },
  { tool: 'hand', name: '손' },
];

/** 도구가 속한 창 탭 — 바닥 재질 붓은 「오브젝트」 탭(바닥 층 탭)에서 고른다. 아래 줄 도구면 null */
export function tabOf(tool: EditTool): WindowTool | null {
  if (tool === 'ground') return 'place';
  return WINDOW_TOOLS.find((t) => t.tool === tool)?.tool ?? null;
}

/** 창에서 고르는 도구 — 창 탭 도구 + 바닥 재질 붓 */
export type PickTool = WindowTool | 'ground';

/** 칠하기 붓 — 맵 글자 */
export const BRUSHES: readonly { readonly ch: TileChar; readonly name: string }[] = [
  { ch: '.', name: '바닥' },
  { ch: '#', name: '벽' },
  { ch: 'D', name: '문' },
  { ch: 'S', name: '시작점' },
  { ch: 'G', name: '게이트' },
];

/** 지우개 층 — 쓰는 물체가 있는 층만(위 층 'top' 은 쓰는 물체가 생기면). (결정 2026-10-23: 지우개는 고른 층만) */
export const ERASE_LAYERS: readonly { readonly layer: ObjectLayer; readonly name: string }[] = [
  { layer: 'floor', name: '바닥' },
  { layer: 'sorted', name: '물체' },
];

/** 창 도구가 지금 고른 것 — 놓을 물체(안 골랐으면 null)·칠하기 붓·재질 붓 */
export interface ToolPick {
  readonly kind: ObjectKind | null;
  readonly brush: TileChar;
  readonly ground: GroundBrush;
}

/** 아래 줄 창 열기 버튼 글 — 창 탭 이름 · 마지막 창 도구가 고른 것 (게임은 이름만, 놓을 물체를 안 골랐으면 이름만) */
export function toolLabel(tool: PickTool, pick: ToolPick): string {
  const tab = tool === 'ground' ? 'place' : tool;
  const name = WINDOW_TOOLS.find((t) => t.tool === tab)?.name ?? tab;
  const what = tool === 'place' ? (pick.kind === null ? undefined : OBJECT_INFO[pick.kind].name)
    : tool === 'ground' ? brushName(pick.ground)
    : tool === 'paint' ? BRUSHES.find((b) => b.ch === pick.brush)?.name
    : undefined;
  return what === undefined ? name : `${name} · ${what}`;
}

/** 포인터가 든 칸을 물체 아래쪽 가운데로 보고, 방 데이터의 왼쪽 아래 칸으로 — 폭이 짝수면 가운데 두 칸 중 오른쪽이 포인터 */
export function placeAt(kind: ObjectKind, cell: Pos): Pos {
  return { x: cell.x - Math.floor(OBJECT_SHAPES[kind].w / 2), y: cell.y };
}

function overlaps(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** 편집 중 문 상태 토글 — 이 상태의 꼬리표 물체만 보이고, 문 칸에 놓는 물체는 이 꼬리표를 단다. 편집을 켤 때마다 닫힘부터 */
export const DOOR_STATES: readonly { readonly state: ObjectState; readonly name: string }[] = [
  { state: 'open', name: '열림' },
  { state: 'shut', name: '닫힘' },
];

/**
 * 왼쪽 아래 칸 at 에 놓는 물체의 상태 꼬리표 — 가운데 발 칸(footCell, 포인터 칸)이 문 칸이나 딸린 게이트 칸이면 편집 토글 상태, 아니면 없음
 * (결정 2026-10-21: 꼬리표는 문 칸 위 물체만, 그 문을 따른다 · 2026-11-10: 기준은 가운데 발 칸)
 */
export function placeState(map: TileMap, kind: ObjectKind, at: Pos, toggle: ObjectState): ObjectState | undefined {
  return map.doorOf(footCell({ ...at, w: OBJECT_SHAPES[kind].w })) === undefined ? undefined : toggle;
}

/**
 * 놓을 수 있는 자리인지 — 서버와 같은 placeObject 를 돌려 보고 던지면 false (맵 밖·문 막기·solid 겹침·개수 상한).
 * state 는 붙일 상태 꼬리표(placeState) — 같은 문의 다른 상태 물체와는 막는 칸·그림이 겹쳐도 된다(함께 보이지 않는다).
 * 그리고 바닥 층 그림(바닥 장식 등)은 다른 바닥 층 그림과 그림 영역이 겹치면 false — 겹쳐 깔면 아래 것이 가려져 지저분하다.
 * 이 규칙은 편집 도구만의 것이라 서버·템플릿은 겹친 바닥 그림을 그대로 받는다 (결정 2026-11-10)
 */
export function canPlace(data: RoomData, kind: ObjectKind, at: Pos, state?: ObjectState): boolean {
  try {
    placeObject(data, kind, at, state);
  } catch {
    return false;
  }
  if (OBJECT_ART[kind].layer !== 'floor') return true;
  const map = parseMap(data.rows);
  const door = map.doorOf(footCell({ ...at, w: OBJECT_SHAPES[kind].w }));
  const hidden = (o: RoomData['objects'][number]): boolean =>
    state !== undefined && o.state !== undefined && o.state !== state && map.doorOf(footCell({ ...o, w: OBJECT_SHAPES[o.kind].w })) === door;
  const rect = objectRect({ id: '', ...at, ...OBJECT_SHAPES[kind] });
  return !data.objects.some((o) => OBJECT_ART[o.kind].layer === 'floor' && !hidden(o) && overlaps(rect, objectRect({ ...o, ...OBJECT_SHAPES[o.kind] })));
}

/**
 * 칸을 그림 영역으로 덮는 물체 가운데 맨 앞에 그려진 것(오른쪽 클릭·지우개가 지울 것) — z 가 같으면 목록 뒤쪽(나중에 그려짐). 없으면 undefined.
 * layer 를 주면 그 층의 물체만 본다 — 지우개는 고른 층만 지운다(결정 2026-10-23)
 */
export function topObjectAt(objects: readonly MapObject[], cell: Pos, layer?: ObjectLayer): MapObject | undefined {
  let top: MapObject | undefined;
  let topZ = -Infinity;
  for (const o of objects) {
    if (layer !== undefined && o.layer !== layer) continue;
    const r = objectRect(o);
    if (cell.x < r.left || cell.x > r.right || cell.y < r.top || cell.y > r.bottom) continue;
    const z = objectZ(o);
    if (z >= topZ) {
      top = o;
      topZ = z;
    }
  }
  return top;
}

/**
 * 놓기 창 썸네일 배율 — 그림(w×h px)이 box px 정사각형에 들어가는 가장 큰 정수배(점이 고르게 커지게),
 * 1배로도 넘치면 긴 변을 box 에 맞춰 줄인다
 */
export function thumbScale(w: number, h: number, box: number): number {
  const fit = box / Math.max(w, h);
  return fit >= 1 ? Math.floor(fit) : fit;
}

export interface EscState {
  /** 문 게임 목록이 열려 있다 */
  readonly doorList: boolean;
  /** 편집 창이 열려 있다 */
  readonly window: boolean;
  /** 초안에 저장 안 한 바뀐 것이 있다 */
  readonly dirty: boolean;
}

/** 편집 중 Esc 한 단계 — 게임 목록 닫기 → 편집 창 다시 열기(마지막 창 탭으로) → 창에서면 편집 끝(바뀐 것이 있으면 그대로 — 알림이 저장·취소를 가리킨다) */
export function escStep(s: EscState): 'close-door-list' | 'open-window' | 'end' | 'stay' {
  if (s.doorList) return 'close-door-list';
  if (!s.window) return 'open-window';
  return s.dirty ? 'stay' : 'end';
}
