// 게임 등록 표 — 로비가 아는 게임은 여기 한 곳에만 적는다 (docs/game-entry-contract.md 「게임 등록」).
// 게임 담당자에게 받는 것은 id·title·url 세 가지뿐, 어느 문에 붙일지는 로비가 정한다 (방 데이터의 문 배정 — server/src/room-map.ts).

export interface GameEntry {
  /** 영문 소문자·숫자·`-`. 저장소 안이면 `games/<id>/` 폴더 이름과 같게 */
  readonly id: string;
  /** 문 앞에 보일 이름 */
  readonly title: string;
  /** 게임 시작 URL — 상대 경로(로비와 같은 호스트) 또는 절대 URL */
  readonly url: string;
}

// url 은 개발 중 각 게임의 dev 서버 주소 — 배포 URL 은 호스팅(PROGRESS 열린 질문 5)이 정해지면 바꾼다
export const GAMES: readonly GameEntry[] = [
  // 독립 저장소 github.com/jeonginwoo/whiteboard-3d — `npm run dev` 가 5174 에 뜬다
  { id: 'whiteboard-3d', title: '3D 화이트보드', url: 'http://localhost:5174/' },
];

