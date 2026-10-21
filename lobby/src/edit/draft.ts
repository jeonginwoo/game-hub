// 편집 초안 — 편집을 켤 때의 방(base)과 도구가 고친 방(draft). Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-21: 저장식 편집 — 도구는 초안만 고치고 「저장」 때 한 번에 보낸다)
import { sameRoomData, type RoomData } from '../../../server/src/room-map';

/** 초안에 저장 안 한 바뀐 것이 있는지 — 편집 중이 아니면(draft null) false */
export function draftDirty(draft: RoomData | null, base: RoomData): boolean {
  return draft !== null && !sameRoomData(draft, base);
}

/**
 * 편집 중 room 을 받았을 때의 초안 — 바뀐 것이 없으면 받은 방으로 따라가고, 있으면 고친 초안 그대로.
 * 어느 쪽이든 base 는 받은 방이 된다(취소하면 그리로). 바뀐 것 없는 초안이 옛 방에 남아 저절로 「바뀜」이 되지 않게
 */
export function rebaseDraft(draft: RoomData, base: RoomData, room: RoomData): RoomData {
  return sameRoomData(draft, base) ? room : draft;
}
