// 실제 소켓으로 /ws 를 연다 — 경로·방 코드 거르기·hello 순서·중계·끊김 처리를 함께 본다.
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { WebSocket } from 'ws';
import type { ServerMsg } from '../src/protocol.ts';
import { Rooms } from '../src/roster.ts';
import { attachLobby } from '../src/ws.ts';

let server: Server | null = null;
const sockets: WebSocket[] = [];

afterEach(async () => {
  for (const ws of sockets.splice(0)) ws.terminate();
  await new Promise<void>((done) => (server ? server.close(() => done()) : done()));
  server = null;
});

async function start(rooms = new Rooms()): Promise<number> {
  const s = createServer();
  server = s;
  attachLobby(s, rooms);
  await new Promise<void>((done) => s.listen(0, done));
  const addr: AddressInfo | string | null = s.address();
  if (addr === null || typeof addr === 'string') throw new Error(`포트를 알 수 없는 주소: ${String(addr)}`);
  return addr.port;
}

/** 열린 소켓과, 받은 메시지를 차례로 꺼내는 next() */
async function connect(port: number, path = '/ws?room=abc234'): Promise<{ ws: WebSocket; next: () => Promise<ServerMsg> }> {
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

  it('방이 다르면 서로 보이지 않고, 빈 방은 사라진다', async () => {
    const rooms = new Rooms();
    const port = await start(rooms);
    const a = await connect(port, '/ws?room=aaaaaa');
    a.ws.send(JSON.stringify({ t: 'hello', name: 'A', at: { x: 1, y: 1, dir: 'down' } }));
    await a.next();
    const b = await connect(port, '/ws?room=bbbbbb');
    b.ws.send(JSON.stringify({ t: 'hello', name: 'B', at: { x: 2, y: 2, dir: 'down' } }));
    expect(await b.next()).toMatchObject({ t: 'welcome', players: [{ name: 'B' }] });
    expect(rooms.count).toBe(2);
    const closed = new Promise<void>((done) => b.ws.once('close', () => done()));
    b.ws.close();
    await closed;
    // 서버의 close 처리를 기다린다 — A 쪽에 아무것도 오지 않으므로 기다릴 메시지가 없다
    await expect.poll(() => rooms.count).toBe(1);
  });

  it('방 코드가 없거나 틀리면 접속을 거절한다', async () => {
    const port = await start();
    await expect(connect(port, '/ws')).rejects.toThrow(/400/);
    await expect(connect(port, '/ws?room=ABC234')).rejects.toThrow(/400/);
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
