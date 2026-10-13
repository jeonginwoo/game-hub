// 게임 등록 표 — 로비가 아는 게임은 여기 한 곳에만 적는다 (docs/game-entry-contract.md 「게임 등록」).
// 게임 담당자에게 받는 것은 id·title·url 세 가지뿐, 어느 문에 붙일지는 로비가 정한다.

export interface GameEntry {
  /** 영문 소문자·숫자·`-`. 저장소 안이면 `games/<id>/` 폴더 이름과 같게 */
  readonly id: string;
  /** 문 앞에 보일 이름 */
  readonly title: string;
  /** 게임 시작 URL — 상대 경로(로비와 같은 호스트) 또는 절대 URL */
  readonly url: string;
}

// 아직 붙은 게임이 없다
export const GAMES: readonly GameEntry[] = [];

/** 문 번호(맵의 'D' 를 위→아래, 왼→오른 순으로 센 0부터의 번호) → 게임 id. 배정 없는 문은 그냥 바닥이다 */
export const DOOR_GAMES: Readonly<Record<number, string>> = {};
