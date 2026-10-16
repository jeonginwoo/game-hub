// 편집 모드에서 문을 눌렀을 때 문 옆에 뜨는 게임 목록 — DOM 연결만, 목록 행은 edit.ts 의 doorChoices.
// (결정 2026-10-16: 문 배정은 편집 모드에서 문을 눌러서). 화면 글자는 textContent 로 넣는다.
import { el } from '../room/entry-screen';
import type { DoorChoice } from './edit';

export interface DoorPicker {
  /** 화면 점(CSS px) 옆에 목록을 연다 — 이미 열려 있으면 내용과 자리를 바꾼다 */
  open(sx: number, sy: number, choices: readonly DoorChoice[], onPick: (game: string | null) => void): void;
  close(): void;
  isOpen(): boolean;
}

const EDGE_PX = 8; // 목록을 화면 가장자리에서 띄우는 여백

export function createDoorPicker(): DoorPicker {
  const root = el('div', 'hub-panel hub-door-picker');
  root.hidden = true;
  const list = el('div', 'hub-door-choices');
  root.append(el('h2', 'hub-panel-title', '이 문의 게임'), list);
  document.body.append(root);

  const close = (): void => {
    root.hidden = true;
    list.replaceChildren();
  };

  return {
    open(sx, sy, choices, onPick) {
      const buttons = choices.map((c) => {
        const b = el('button', c.current ? 'hub-btn hub-small hub-on' : 'hub-btn hub-small', c.title);
        b.type = 'button';
        if (c.current) b.setAttribute('aria-current', 'true');
        b.addEventListener('click', () => {
          close();
          if (!c.current) onPick(c.game); // 지금 것을 다시 고르면 보낼 것이 없다 (서버도 버린다)
        });
        return b;
      });
      list.replaceChildren(...buttons);
      root.hidden = false;
      // 크기를 안 다음 화면 안으로 — 오른쪽·아래로 넘치면 안쪽으로 민다
      const r = root.getBoundingClientRect();
      const left = Math.max(EDGE_PX, Math.min(sx, window.innerWidth - r.width - EDGE_PX));
      const top = Math.max(EDGE_PX, Math.min(sy, window.innerHeight - r.height - EDGE_PX));
      root.style.left = `${left}px`;
      root.style.top = `${top}px`;
    },
    close,
    isOpen() {
      return !root.hidden;
    },
  };
}
