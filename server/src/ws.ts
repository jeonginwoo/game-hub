// HTTP 서버에 로비 멀티 /ws 를 붙인다. 개발(lobby/vite.config.ts 플러그인)과 배포(main.ts)가 같은 함수를 쓴다.
// 첫 메시지는 반드시 hello — 그 전의 메시지는 버린다.
import type { IncomingMessage } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import { parseClientMsg, type ServerMsg } from './protocol.ts';
import { Roster } from './roster.ts';

export const WS_PATH = '/ws';
const HEARTBEAT_MS = 30_000; // 응답 없는 연결(창 닫힘·망 끊김)을 이 간격으로 정리
const MAX_PAYLOAD = 4 * 1024; // 바이트 — 로비 메시지는 위치·이름뿐

/** 업그레이드 이벤트를 내는 HTTP 서버 — node:http 서버와 Vite 개발·미리보기 서버가 모두 해당 */
export interface UpgradeSource {
  on(event: 'upgrade', listener: (req: IncomingMessage, socket: Duplex, head: Buffer) => void): unknown;
}

export function attachLobby(server: UpgradeSource, roster = new Roster()): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true, maxPayload: MAX_PAYLOAD });
  const alive = new WeakMap<WebSocket, boolean>();

  server.on('upgrade', (req, socket, head) => {
    // 다른 업그레이드(Vite HMR 등)는 건드리지 않는다
    if (new URL(req.url ?? '/', 'http://x').pathname !== WS_PATH) return;
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit('connection', ws, req));
  });

  wss.on('connection', (ws: WebSocket) => {
    let id: string | null = null;
    alive.set(ws, true);
    ws.on('pong', () => alive.set(ws, true));
    // 상한 초과·깨진 프레임은 'error' 로 온다 — 리스너가 없으면 프로세스(개발 중엔 Vite)가 죽는다.
    // ws 가 이어서 연결을 닫으므로 퇴장은 'close' 가 처리한다
    ws.on('error', () => {});

    const peer = {
      send(msg: ServerMsg): void {
        if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
      },
    };

    ws.on('message', (data) => {
      const msg = parseClientMsg(data.toString());
      if (!msg) return;
      if (id === null) {
        if (msg.t === 'hello') id = roster.join(peer, msg);
        return;
      }
      roster.handle(id, msg);
    });

    ws.on('close', () => {
      if (id !== null) roster.leave(id);
    });
  });

  const beat = setInterval(() => {
    for (const ws of wss.clients) {
      if (!alive.get(ws)) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_MS);
  beat.unref();
  wss.on('close', () => clearInterval(beat));

  return wss;
}
