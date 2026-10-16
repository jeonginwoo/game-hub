import { describe, expect, it } from 'vitest';
import { DEFAULT_LOOK, LOOK_CHOICES } from '../../../server/src/protocol';
import { bodyColor, cycleLook, LOOK_PARTS, LOOK_TABLE, lookFromStorage, lookKey, randomLook } from '../../src/avatar/look';

describe('선택지 표', () => {
  it('부위마다 서버가 받는 선택지 수와 길이가 같다', () => {
    // LOOK_PARTS 가 모든 부위를 덮는지는 아래 줄이 본다
    for (const [part] of LOOK_PARTS) expect(LOOK_TABLE[part]).toHaveLength(LOOK_CHOICES[part]);
  });

  it('꾸미기 창은 모든 부위를 한 번씩 보인다', () => {
    expect(LOOK_PARTS.map(([p]) => p).sort()).toEqual(Object.keys(LOOK_CHOICES).sort());
  });

  it('색 부위는 모두 색을 갖는다', () => {
    for (const c of [...LOOK_TABLE.body, ...LOOK_TABLE.hair]) expect(c.color).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe('randomLook', () => {
  it('몸·머리 색만 무작위, 모자·수염은 없음', () => {
    expect(randomLook(() => 0)).toEqual(DEFAULT_LOOK);
    // 1 에 아주 가까워도 표 밖으로 나가지 않는다
    expect(randomLook(() => 0.9999999)).toEqual({ body: LOOK_CHOICES.body - 1, hair: LOOK_CHOICES.hair - 1, hat: 0, beard: 0 });
  });
});

describe('cycleLook', () => {
  it('한 부위만 넘기고 끝에서 처음으로 돈다', () => {
    expect(cycleLook(DEFAULT_LOOK, 'hat', 1)).toEqual({ ...DEFAULT_LOOK, hat: 1 });
    expect(cycleLook(DEFAULT_LOOK, 'hat', -1)).toEqual({ ...DEFAULT_LOOK, hat: LOOK_CHOICES.hat - 1 });
    expect(cycleLook({ ...DEFAULT_LOOK, beard: LOOK_CHOICES.beard - 1 }, 'beard', 1)).toEqual(DEFAULT_LOOK);
  });
});

describe('lookFromStorage', () => {
  const look = { body: 3, hair: 2, hat: 1, beard: 2 };

  it('저장된 외형을 그대로 읽는다', () => {
    expect(lookFromStorage(JSON.stringify(look), () => 0.5)).toEqual(look);
  });

  it('없거나 깨졌거나 범위 밖이면 무작위', () => {
    const fresh = randomLook(() => 0.5);
    expect(lookFromStorage(null, () => 0.5)).toEqual(fresh);
    expect(lookFromStorage('{', () => 0.5)).toEqual(fresh);
    expect(lookFromStorage(JSON.stringify({ ...look, hat: 99 }), () => 0.5)).toEqual(fresh);
  });
});

describe('lookKey·bodyColor', () => {
  it('외형이 다르면 열쇠도 다르다', () => {
    expect(lookKey(DEFAULT_LOOK)).not.toBe(lookKey(cycleLook(DEFAULT_LOOK, 'beard', 1)));
  });

  it('몸 색은 표의 색', () => {
    expect(bodyColor({ ...DEFAULT_LOOK, body: 1 })).toBe(LOOK_TABLE.body[1]?.color);
  });
});
