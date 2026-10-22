// 편집 도구 — 물체 놓기 자리·놓을 수 있는지·치울 물체 고르기·놓기 창 썸네일 배율·Esc 한 단계. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-16: 물체 배치 편집 — 놓기 판정은 서버와 같은 placeObject · 2026-10-21: 편집 개편 B 놓기 창)
import { OBJECT_SHAPES, placeObject, type ObjectKind, type Pos, type RoomData } from '../../../server/src/room-map';
import { objectRect, objectZ, type MapObject } from '../world/objects';

/** 편집 도구 줄 — 물체 놓기(오른쪽 클릭은 치우기) · 문 배정 · 타일 칠하기 */
export type EditTool = 'place' | 'door' | 'paint';

/** 포인터가 든 칸을 물체 아래쪽 가운데로 보고, 방 데이터의 왼쪽 아래 칸으로 — 폭이 짝수면 가운데 두 칸 중 오른쪽이 포인터 */
export function placeAt(kind: ObjectKind, cell: Pos): Pos {
  return { x: cell.x - Math.floor(OBJECT_SHAPES[kind].w / 2), y: cell.y };
}

/** 서버가 받을 자리인지 — 서버와 같은 placeObject 를 돌려 보고 던지면 false (맵 밖·문 막기·solid 겹침·개수 상한) */
export function canPlace(data: RoomData, kind: ObjectKind, at: Pos): boolean {
  try {
    placeObject(data, kind, at);
    return true;
  } catch {
    return false;
  }
}

/** 칸을 그림 영역으로 덮는 물체 가운데 맨 앞에 그려진 것 — z 가 같으면 목록 뒤쪽(나중에 그려짐). 없으면 undefined */
export function topObjectAt(objects: readonly MapObject[], cell: Pos): MapObject | undefined {
  let top: MapObject | undefined;
  let topZ = -Infinity;
  for (const o of objects) {
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
  /** 놓기 창이 열려 있다 */
  readonly window: boolean;
  /** 초안에 저장 안 한 바뀐 것이 있다 */
  readonly dirty: boolean;
}

/** 편집 중 Esc 한 단계 — 게임 목록 닫기 → 놓기 창 다시 열기 → 창에서면 편집 끝(바뀐 것이 있으면 그대로 — 알림이 저장·취소를 가리킨다) */
export function escStep(s: EscState): 'close-door-list' | 'open-window' | 'end' | 'stay' {
  if (s.doorList) return 'close-door-list';
  if (!s.window) return 'open-window';
  return s.dirty ? 'stay' : 'end';
}
