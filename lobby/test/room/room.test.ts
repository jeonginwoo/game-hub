import { describe, expect, it } from 'vitest';
import { isRoomCode } from '../../../server/src/protocol';
import { DEFAULT_ROOM, ROOM_TEMPLATES } from '../../../server/src/room-templates';
import { cycleIndex, homeUrl, inviteUrl, mapKey, nameFromInput, newRoomCode, renameFromInput, roomFromInput, roomFromSearch, screenFor, withRoom } from '../../src/room/room';

describe('cycleIndex', () => {
  it('앞뒤로 돌고 끝에서 처음으로 넘어간다', () => {
    expect(cycleIndex(0, 1, 3)).toBe(1);
    expect(cycleIndex(2, 1, 3)).toBe(0);
    expect(cycleIndex(0, -1, 3)).toBe(2);
  });
});

describe('맵 고르기의 첫 값', () => {
  // 첫 화면 뒤 배경은 DEFAULT_ROOM 으로 시작하고, ◀ ▶ 를 누르기 전 맵 이름표는 ROOM_TEMPLATES[0] — 둘이 어긋나면 안 된다
  it('맨 앞 템플릿이 처음 그리는 기본 방이다', () => {
    expect(ROOM_TEMPLATES[0]?.room).toBe(DEFAULT_ROOM);
  });
});

describe('mapKey', () => {
  it('방마다 다른 키', () => {
    expect(mapKey('abcdef')).not.toBe(mapKey('ghjkmn'));
  });
});

describe('screenFor', () => {
  it('방 코드가 없으면 시작 화면', () => {
    expect(screenFor(null, null)).toBe('start');
    expect(screenFor(null, '철수')).toBe('start');
  });

  it('초대 링크로 왔는데 이름이 없으면 이름만 묻는다', () => {
    expect(screenFor('abc234', null)).toBe('name');
  });

  it('방 코드와 저장된 이름이 있으면 바로 로비 — 게임에서 돌아올 때', () => {
    expect(screenFor('abc234', '철수')).toBe('lobby');
  });
});

describe('newRoomCode', () => {
  it('서버가 받는 형식의 코드를 만든다', () => {
    for (let i = 0; i < 50; i++) expect(isRoomCode(newRoomCode())).toBe(true);
  });

  it('random 의 양 끝값에서도 알파벳 안', () => {
    expect(isRoomCode(newRoomCode(() => 0))).toBe(true);
    expect(isRoomCode(newRoomCode(() => 0.999999))).toBe(true);
  });
});

describe('roomFromSearch', () => {
  it('room 쿼리의 코드를 읽는다', () => {
    expect(roomFromSearch('?room=abc234&hub_door=1')).toBe('abc234');
  });

  it('손으로 친 대문자도 받는다 — 코드 칸과 같게', () => {
    expect(roomFromSearch('?room=ABC234')).toBe('abc234');
  });

  it('없거나 형식이 틀리면 null', () => {
    expect(roomFromSearch('')).toBeNull();
    expect(roomFromSearch('?room=abc')).toBeNull();
    expect(roomFromSearch('?room=abc23o')).toBeNull();
  });
});

describe('roomFromInput', () => {
  it('코드를 그대로 받는다', () => {
    expect(roomFromInput('abc234')).toBe('abc234');
  });

  it('대문자·공백·하이픈을 정리한다', () => {
    expect(roomFromInput('  ABC-234 ')).toBe('abc234');
    expect(roomFromInput('abc 234')).toBe('abc234');
  });

  it('초대 링크를 통째로 붙여 넣어도 된다', () => {
    expect(roomFromInput('http://localhost:5173/?room=abc234')).toBe('abc234');
  });

  it('코드로 읽을 수 없으면 null', () => {
    expect(roomFromInput('')).toBeNull();
    expect(roomFromInput('abc23o')).toBeNull();
    expect(roomFromInput('http://localhost:5173/')).toBeNull();
    expect(roomFromInput('https://')).toBeNull();
  });
});

describe('withRoom', () => {
  it('다른 쿼리는 두고 방 코드를 넣는다', () => {
    expect(withRoom('http://h/?hub_door=1', 'abc234')).toBe('http://h/?hub_door=1&room=abc234');
  });
});

describe('inviteUrl', () => {
  it('내 복귀 정보·해시는 빼고 방 코드만', () => {
    expect(inviteUrl('http://h/lobby/?hub_door=1&room=old#x', 'abc234')).toBe('http://h/lobby/?room=abc234');
  });
});

describe('homeUrl', () => {
  it('로비 주소에서 쿼리·해시를 뺀 첫 화면', () => {
    expect(homeUrl('http://localhost:5173/?room=abc234&hub_door=1#x')).toBe('http://localhost:5173/');
    expect(homeUrl('https://hub.example.com/lobby/?room=abc234')).toBe('https://hub.example.com/lobby/');
  });
});

describe('nameFromInput', () => {
  it('서버 규칙대로 다듬는다', () => {
    expect(nameFromInput('  철수 ')).toBe('철수');
    expect(nameFromInput('가'.repeat(20))).toBe('가'.repeat(16));
  });

  it('비면 null', () => {
    expect(nameFromInput('   ')).toBeNull();
  });
});

describe('renameFromInput', () => {
  it('서버 규칙대로 다듬은 새 이름', () => {
    expect(renameFromInput(' 영희 ', '철수')).toBe('영희');
  });

  it('비었거나 지금 이름과 같으면 null — 바꿀 것이 없다', () => {
    expect(renameFromInput('  ', '철수')).toBeNull();
    expect(renameFromInput(' 철수 ', '철수')).toBeNull();
  });
});
