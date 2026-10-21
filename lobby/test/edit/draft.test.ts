import { describe, expect, it } from 'vitest';
import type { RoomData } from '../../../server/src/room-map';
import { draftDirty, rebaseDraft } from '../../src/edit/draft';

const base: RoomData = { rows: ['#S..#'], objects: [], doors: [] };
const edited: RoomData = { ...base, rows: ['#S.##'] };
const received: RoomData = { ...base, rows: ['#S#.#'] };

describe('draftDirty', () => {
  it('편집 중이 아니거나 내용이 같으면 false — 다른 객체여도', () => {
    expect(draftDirty(null, base)).toBe(false);
    expect(draftDirty(JSON.parse(JSON.stringify(base)), base)).toBe(false);
  });

  it('맵·물체·문 배정 중 하나라도 다르면 true', () => {
    expect(draftDirty(edited, base)).toBe(true);
    expect(draftDirty({ ...base, objects: [{ id: 'p1', kind: 'tree', x: 1, y: 0 }] }, base)).toBe(true);
  });
});

describe('rebaseDraft', () => {
  it('바뀐 것이 없으면 받은 방으로 — 저절로 「바뀜」이 되지 않는다', () => {
    const next = rebaseDraft(base, base, received);
    expect(next).toBe(received);
    expect(draftDirty(next, received)).toBe(false);
  });

  it('바뀐 것이 있으면 고친 초안 그대로', () => {
    const next = rebaseDraft(edited, base, received);
    expect(next).toBe(edited);
    expect(draftDirty(next, received)).toBe(true);
  });
});
