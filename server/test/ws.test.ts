// 실제 소켓으로 /ws 를 연다 — 경로 거르기·hello 순서·중계·끊김 처리를 함께 본다.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { ServerMsg } from '../src/protocol.ts';
import { attachLobby } from '../src/ws.ts';

let server: Server | null = null;
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
  server = null;
});

async function start(): Promise<number> {
  const s = createServer();
  server = s;
  attachLobby(s);
  await new Promise<void>((done) => s.listen(0, done));
  const addr: AddressInfo | string | null = s.address();
  if (addr === null || typeof addr === 'string') throw new Error(`포트를 알 수 없는 주소: ${String(addr)}`);
  return addr.port;
}

/** 열린 소켓과, 받은 메시지를 차례로 꺼내는 next() */
async function connect(port: number, path = '/ws'): Promise<{ ws: WebSocket; next: () => Promise<ServerMsg> }> {
  const ws = new WebSocket(`ws://localhost:${port}${path}`);
  sockets.push(ws);
  const queue: ServerMsg[] = [];
  const waiting: ((m: ServerMsg) => void)[] = [];
  ws.on('message', (data) => {
    // 테스트 상대는 우리 서버뿐이라 형식 검사 없이 받는다
    const msg: ServerMsg = JSON.parse(data.toString());
    const w = waiting.shift();
    if (w) w(msg);
    else queue.push(msg);
  });
  await new Promise<void>((done, fail) => {
    ws.once('open', () => done());
    ws.once('error', fail);
  });
  const next = (): Promise<ServerMsg> => {
    const m = queue.shift();
    return m ? Promise.resolve(m) : new Promise((done) => waiting.push(done));
  };
  return { ws, next };
}

describe('attachLobby', () => {
  it('두 접속자가 서로의 입장·이동·퇴장을 받는다', async () => {
    const port = await start();
    const a = await connect(port);
    a.ws.send(JSON.stringify({ t: 'hello', name: 'A', at: { x: 1, y: 1, dir: 'down' } }));
    expect(await a.next()).toMatchObject({ t: 'welcome', players: [{ name: 'A' }] });

    const b = await connect(port);
    // hello 전의 move 는 버려진다
    b.ws.send(JSON.stringify({ t: 'move', at: { x: 9, y: 9, dir: 'up' } }));
    b.ws.send(JSON.stringify({ t: 'hello', name: 'B', at: { x: 2, y: 2, dir: 'left' } }));
    expect(await b.next()).toMatchObject({ t: 'welcome', players: [{ name: 'A' }, { name: 'B', x: 2, y: 2 }] });
    expect(await a.next()).toMatchObject({ t: 'join', player: { name: 'B', x: 2, y: 2 } });

    b.ws.send(JSON.stringify({ t: 'move', at: { x: 3, y: 2, dir: 'right' } }));
    expect(await a.next()).toMatchObject({ t: 'move', at: { x: 3, y: 2, dir: 'right' } });

    b.ws.close();
    expect(await a.next()).toMatchObject({ t: 'leave' });
  });

  it('상한을 넘는 메시지를 보낸 연결만 끊기고 서버는 산다', async () => {
    const port = await start();
    const a = await connect(port);
    a.ws.send(JSON.stringify({ t: 'hello', name: 'A', at: { x: 1, y: 1, dir: 'down' } }));
    await a.next();
    const big = await connect(port);
    const closed = new Promise<void>((done) => big.ws.once('close', () => done()));
    big.ws.send('x'.repeat(5 * 1024));
    await closed;
    // 서버가 살아 있으면 새 접속자가 명단을 받는다
    const c = await connect(port);
    c.ws.send(JSON.stringify({ t: 'hello', name: 'C', at: { x: 2, y: 2, dir: 'down' } }));
    expect(await c.next()).toMatchObject({ t: 'welcome', players: [{ name: 'A' }, { name: 'C' }] });
  });

  it('/ws 가 아닌 경로의 업그레이드는 다른 리스너(Vite HMR 등)에게 남긴다', async () => {
    const port = await start();
    const others: string[] = [];
    server?.on('upgrade', (req, socket) => {
      if (req.url !== '/ws') {
        others.push(req.url ?? '');
        socket.destroy();
      }
    });
    await expect(connect(port, '/other')).rejects.toThrow();
    expect(others).toEqual(['/other']);
  });
});
