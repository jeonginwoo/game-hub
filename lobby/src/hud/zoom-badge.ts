// 배율 알림 — 확대·축소할 때 오른쪽 아래에 잠깐 「n% − + 초기화」를 띄운다. 포인터가 올라가 있는 동안은 내리지 않는다.
// 퍼센트는 기본 배율이 100% (zoomPercent)
import { el } from '../room/entry-screen';
import { DEFAULT_ZOOM, ZOOM_LEVELS } from '../world/view';

const SHOW_MS = 1500; // 마지막으로 바뀐 뒤(또는 포인터가 떠난 뒤) 이만큼 보이고 내린다

/** 화면에 보일 배율 — 기본 배율 = 100%, 정수로 반올림 */
export function zoomPercent(zoom: number): number {
  return Math.round((zoom / DEFAULT_ZOOM) * 100);
}

export interface ZoomBadge {
  /** 이 배율로 글·버튼 상태를 바꾸고 잠깐 띄운다 */
  show(zoom: number): void;
}

export function createZoomBadge(on: { step(steps: number): void; reset(): void }): ZoomBadge {
  const root = el('div', 'hub-zoom');
  root.hidden = true;
  const label = el('span', 'hub-zoom-pct');
  const out = el('button', 'hub-btn hub-small', '−');
  const inn = el('button', 'hub-btn hub-small', '+');
  const reset = el('button', 'hub-btn hub-small', '초기화');
  out.title = '축소';
  inn.title = '확대';
  out.addEventListener('click', () => on.step(-1));
  inn.addEventListener('click', () => on.step(1));
  reset.addEventListener('click', () => on.reset());
  root.append(label, out, inn, reset);
  document.body.append(root);

  let timer: ReturnType<typeof setTimeout> | undefined;
  let hovered = false;
  const hideLater = (): void => {
    clearTimeout(timer);
    if (!hovered) timer = setTimeout(() => { root.hidden = true; }, SHOW_MS);
  };
  root.addEventListener('pointerenter', () => {
    hovered = true;
    clearTimeout(timer);
  });
  root.addEventListener('pointerleave', () => {
    hovered = false;
    hideLater();
  });

  return {
    show(zoom) {
      label.textContent = `${zoomPercent(zoom)}%`;
      out.disabled = zoom <= (ZOOM_LEVELS[0] ?? zoom);
      inn.disabled = zoom >= (ZOOM_LEVELS.at(-1) ?? zoom);
      reset.disabled = zoom === DEFAULT_ZOOM;
      root.hidden = false;
      hideLater();
    },
  };
}
