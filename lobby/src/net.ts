// 로비 멀티 전송 — 같은 주소의 /ws?room=<코드> 에 붙는다 (결정 2026-10-14: 로비와 서버는 한 포트).
// 전송 방식을 바꿀 때 고치는 곳은 이 파일 하나다 (결정 2026-10-09). 받은 메시지는 모두 parseServerMsg 를 거친다.
import { parseServerMsg, ROOM_PARAM, type ClientMsg, type ServerMsg } from '../../server/src/protocol';

export type NetStatus = 'connecting' | 'open' | 'closed';

export interface Connection {
  send(msg: ClientMsg): void;
  close(): void;
}

/** 방 표시에 쓸 접속 상태 글자 — people 은 나를 포함한 인원 */
export function statusText(status: NetStatus, people: number): string {
  if (status === 'connecting') return '연결 중…';
  if (status === 'closed') return '연결 끊김 — 새로고침';
  return `${people}명`;
}

/** 로비 페이지 주소에서 멀티 서버 주소 — https 면 wss */
export function socketUrl(lobbyHref: string, room: string): string {
  const url = new URL('/ws', lobbyHref);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set(ROOM_PARAM, room);
  return url.href;
}

/**
 * 연결하고, 열리면 hello 를 보낸다. 끊기면 onStatus('closed') 뿐 — 다시 붙지 않는다(자동 재접속은 후보 일감).
 * hello 는 열리는 순간의 자리를 써야 해서 함수로 받는다
 */
export function connect(
  lobbyHref: string,
  room: string,
  hello: () => Extract<ClientMsg, { t: 'hello' }>,
  onMsg: (msg: ServerMsg) => void,
  onStatus: (s: NetStatus) => void,
): Connection {
  const ws = new WebSocket(socketUrl(lobbyHref, room));
  // close() 를 부른 뒤에도 옛 소켓의 이벤트(특히 'close')는 늦게 온다 — 그 사이 새 연결이 생겼으면
  // 새 연결의 상태를 「끊김」으로 덮어쓰고 명단을 지운다. 닫은 연결의 이벤트는 모두 버린다
  let active = true;
  onStatus('connecting');
  ws.addEventListener('open', () => {
    if (!active) return;
    ws.send(JSON.stringify(hello()));
    onStatus('open');
  });
  ws.addEventListener('message', (e) => {
    if (!active || typeof e.data !== 'string') return;
    const msg = parseServerMsg(e.data);
    if (msg) onMsg(msg);
  });
  ws.addEventListener('close', () => {
    if (active) onStatus('closed');
  });
  return {
    send(msg) {
      if (active && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
    },
    /** 이 뒤로 콜백은 하나도 불리지 않는다 — 상태 정리는 부른 쪽이 */
    close() {
      active = false;
      ws.close();
    },
  };
}
