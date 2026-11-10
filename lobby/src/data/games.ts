// 게임 등록 표 — 로비가 아는 게임은 여기 한 곳에만 적는다 (docs/game-entry-contract.md 「게임 등록」).
// 게임 담당자에게 받는 것은 id·title·url (+ 고르면 description), 어느 문에 붙일지는 로비가 정한다 (방 데이터의 문 배정 — server/src/room-map.ts).

export interface GameEntry {
  /** 영문 소문자·숫자·`-`. 저장소 안이면 `games/<id>/` 폴더 이름과 같게 */
  readonly id: string;
  /** 문 앞에 보일 이름 */
  readonly title: string;
  /** 게임 시작 URL — 상대 경로(로비와 같은 호스트) 또는 절대 URL */
  readonly url: string;
  /** 문 위 이름 밑에 보일 한두 줄 설명 — 없으면 이름만 */
  readonly description?: string;
}

/** 개발(`npm run dev`)이면 게임의 dev 서버, 배포 빌드면 배포 주소 (docs/deploy.md) */
function devOr(dev: string, deployed: string): string {
  return import.meta.env.DEV ? dev : deployed;
}

export const GAMES: readonly GameEntry[] = [
  // 독립 저장소 github.com/jeonginwoo/whiteboard-3d — `npm run dev` 가 5174 에 뜬다
  { id: 'whiteboard-3d', title: '3D 화이트보드', url: 'http://localhost:5174/', description: '여럿이 함께 그리는 3D 화이트보드' },
  // 독립 저장소 github.com/Eunji1217/3js — GitHub Pages 배포본 (계약 v3: 복귀·이름·방 코드 모두 씀)
  { id: 'room-sim', title: 'Room Sim', url: 'https://eunji1217.github.io/3js/', description: '집·마당·들판을 오가며 사냥·채집·요리하는 생활 시뮬레이션' },
  // 독립 저장소 github.com/HYERINI/rinfish — Vercel 배포본 (계약 v3: 복귀·이름·방 코드 모두 씀)
  { id: 'rinfish', title: '낚시섬', url: 'https://rinfish.vercel.app/', description: '섬에서 함께 즐기는 낚시 게임' },
];

