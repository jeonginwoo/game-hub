// 편집 도구 — 타일 칠하기 판정과 끌기 사이의 칸 잇기. Three.js·DOM 과 무관한 순수 함수.
// (결정 2026-10-17: 타일 편집 — 칠하기 판정은 서버와 같은 paintTile)
import { paintTile, type Pos, type RoomData, type TileChar } from '../../../server/src/room-map';

/** ok — 서버가 받는다 · same — 이미 그 글자(보낼 것 없음, 빨갛게 하지 않음) · no — 서버가 버린다 */
export type PaintCheck = 'ok' | 'same' | 'no';

/** 칸 at 을 ch 로 칠하면 — 서버와 같은 paintTile 을 돌려 보고 던지면 no (맵 밖·마지막 시작점·solid 가 막는 문/시작점) */
export function paintCheck(data: RoomData, at: Pos, ch: TileChar): PaintCheck {
  if (data.rows[at.y]?.[at.x] === ch) return 'same';
  try {
    paintTile(data, at, ch);
    return 'ok';
  } catch {
    return 'no';
  }
}

/**
 * a 에서 b 까지 직선을 따라 상하좌우로 이어진 칸들 — a·b 포함, |dx|+|dy|+1 칸. 빠르게 끌면 pointermove 사이에
 * 칸을 건너뛰므로 그 사이를 채운다. 대각선으로만 닿은 D 칸은 다른 문이 되므로 대각선 걸음은 쓰지 않는다
 */
export function cellsBetween(a: Pos, b: Pos): Pos[] {
  const dx = Math.abs(b.x - a.x);
  const dy = Math.abs(b.y - a.y);
  const sx = Math.sign(b.x - a.x);
  const sy = Math.sign(b.y - a.y);
  const cells: Pos[] = [{ x: a.x, y: a.y }];
  let ix = 0;
  let iy = 0;
  while (ix < dx || iy < dy) {
    // 다음 칸 경계까지 더 가까운 축으로 한 칸 — 폭이 0 인 축은 Infinity 라 고르지 않는다
    if ((ix + 0.5) / dx < (iy + 0.5) / dy) ix++;
    else iy++;
    cells.push({ x: a.x + ix * sx, y: a.y + iy * sy });
  }
  return cells;
}
