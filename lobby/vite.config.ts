// 개발 서버에 로비 멀티 /ws 를 붙인다 — `npm run dev` 하나로 화면과 멀티 서버가 함께 뜬다 (결정 2026-10-14).
// 로비와 server/ 는 이 설정 파일에서만 만난다. 로비 화면 코드(src/)는 server/ 의 런타임을 import 하지 않는다.
import { defineConfig, type Plugin } from 'vite';
import { attachLobby } from '../server/src/ws.ts';

function lobbyServer(): Plugin {
  return {
    name: 'game-hub-ws',
    configureServer(server) {
      // 미들웨어 모드면 httpServer 가 없다 — 그때는 멀티 없이 화면만
      if (server.httpServer) attachLobby(server.httpServer);
    },
    configurePreviewServer(server) {
      attachLobby(server.httpServer);
    },
  };
}

export default defineConfig({
  plugins: [lobbyServer()],
});
