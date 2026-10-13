import { describe, expect, it } from 'vitest';
import { AVATAR_OPTIONS, DEFAULT_AVATAR, avatarFromStored, parseAvatar } from '../src/avatar';

describe('parseAvatar', () => {
  it('올바른 값은 그대로', () => {
    const a = { ...DEFAULT_AVATAR, hair: 'bob', hairColor: 'blonde', bottom: 'skirt', topColor: 'red' };
    expect(parseAvatar(a)).toEqual(a);
  });

  it('모르는 값·빠진 값은 그 항목만 기본값', () => {
    const a = parseAvatar({ hair: 'mohawk', skin: 'tan', topColor: 42 });
    expect(a.hair).toBe(DEFAULT_AVATAR.hair);
    expect(a.topColor).toBe(DEFAULT_AVATAR.topColor);
    expect(a.skin).toBe('tan');
    expect(a.eyeColor).toBe(DEFAULT_AVATAR.eyeColor);
  });

  it('객체가 아니면 기본 캐릭터, 꾸미기 항목 외의 키는 버린다', () => {
    expect(parseAvatar(null)).toEqual(DEFAULT_AVATAR);
    expect(parseAvatar('x')).toEqual(DEFAULT_AVATAR);
    expect(Object.keys(parseAvatar({ ...DEFAULT_AVATAR, extra: 1 }))).not.toContain('extra');
  });

  it('기본 캐릭터의 값은 모두 선택지 안에 있다', () => {
    for (const [k, v] of Object.entries(DEFAULT_AVATAR)) {
      expect(AVATAR_OPTIONS[k as keyof typeof AVATAR_OPTIONS]).toContain(v);
    }
  });
});

describe('avatarFromStored', () => {
  it('저장된 것이 없거나 깨진 JSON 이면 기본 캐릭터', () => {
    expect(avatarFromStored(null)).toEqual(DEFAULT_AVATAR);
    expect(avatarFromStored('{not json')).toEqual(DEFAULT_AVATAR);
  });

  it('저장된 JSON 을 읽는다', () => {
    expect(avatarFromStored(JSON.stringify({ skin: 'brown' })).skin).toBe('brown');
  });
});
