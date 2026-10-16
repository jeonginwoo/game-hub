import { describe, expect, it } from 'vitest';
import { socketUrl } from '../src/net';

describe('socketUrl', () => {
  it('같은 호스트의 /ws 에 방 코드', () => {
    expect(socketUrl('http://localhost:5173/?room=abc234&hub_door=1', 'abc234')).toBe('ws://localhost:5173/ws?room=abc234');
  });

  it('https 면 wss, 로비가 하위 경로에 있어도 /ws 는 호스트 바로 아래', () => {
    expect(socketUrl('https://hub.example.com/lobby/?room=x', 'abc234')).toBe('wss://hub.example.com/ws?room=abc234');
  });
});
