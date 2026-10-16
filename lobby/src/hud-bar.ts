// 로비 오른쪽 위 버튼 줄 — 사람 버튼(인원 + 접속자 목록)과 설정 버튼(초대 코드·이름 변경·로비 나가기), 위쪽 가운데 연결 알림.
// DOM 연결만 — 무엇을 보일지는 hud.ts, 이름·주소 판정은 room.ts (결정 2026-10-16: 로비 정보는 오른쪽 위 버튼 둘로).
// 화면 글자는 모두 textContent 로 넣는다.
import { el, saveName } from './entry-screen';
import type { RosterRow } from './hud';
import { inviteUrl, renameFromInput } from './room';

export interface HudView {
  readonly count: number | null;
  readonly rows: readonly RosterRow[];
  readonly notice: string | null;
}

export interface Hud {
  update(view: HudView): void;
  /** 목록·설정 창이 열려 있으면 true — 그동안 로비는 걷기·채팅 키를 받지 않는다 */
  isOpen(): boolean;
}

export interface HudOptions {
  readonly room: string;
  readonly name: string;
  readonly lobbyHref: string;
  readonly onRename: (name: string) => void;
  readonly onLeave: () => void;
  /** 창이 열릴 때 — 로비가 누르고 있던 방향키를 놓게 (열린 동안 keyup 전까지 계속 걷지 않게) */
  readonly onOpen: () => void;
}

type Panel = 'people' | 'settings';

const SVG_NS = 'http://www.w3.org/2000/svg';

/** SVG 도형 목록 — [태그, 속성] */
type IconParts = readonly (readonly [string, Readonly<Record<string, string>>])[];

/** 20×20 아이콘 — 운영체제마다 모양이 다른 이모지 대신 코드로 그린다. 색은 글자색(currentColor) */
function icon(parts: IconParts): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  for (const [tag, attrs] of parts) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
    svg.append(node);
  }
  return svg;
}

const PEOPLE_ICON: IconParts = [
  ['circle', { cx: '10', cy: '6.5', r: '3.5', fill: 'currentColor' }],
  ['path', { d: 'M3 18c0-4 3.1-6.5 7-6.5s7 2.5 7 6.5z', fill: 'currentColor' }],
];

// 톱니 — 굵은 원 테두리를 점선으로 끊어 이를 만들고, 안쪽 고리를 하나 더 그린다
const GEAR_ICON: IconParts = [
  ['circle', { cx: '10', cy: '10', r: '7', fill: 'none', stroke: 'currentColor', 'stroke-width': '3', 'stroke-dasharray': '2.75 2.75' }],
  ['circle', { cx: '10', cy: '10', r: '4.5', fill: 'none', stroke: 'currentColor', 'stroke-width': '2.5' }],
];

function iconButton(className: string, label: string, svg: SVGSVGElement): HTMLButtonElement {
  const b = el('button', `hub-icon-btn ${className}`);
  b.type = 'button';
  b.title = label;
  b.setAttribute('aria-label', label);
  b.append(svg);
  return b;
}

/** 초대 링크를 클립보드로 — http 로 연 사설 IP 등 보안 문맥이 아니면 clipboard 가 없어 직접 복사하게 보여 준다 */
function copyLink(button: HTMLButtonElement, link: string): void {
  const label = button.textContent ?? '';
  const prompt = (): void => {
    window.prompt('이 링크를 복사해 보내세요', link);
  };
  if (!navigator.clipboard) {
    prompt();
    return;
  }
  navigator.clipboard.writeText(link).then(() => {
    button.textContent = '복사됨';
    setTimeout(() => (button.textContent = label), 1500);
  }, prompt);
}

export function showHud(opts: HudOptions): Hud {
  let current = opts.name;
  let open: Panel | null = null;

  const root = el('div', 'hub-hud');
  const bar = el('div', 'hub-hud-bar');
  const peopleBtn = iconButton('hub-people-btn', '접속자', icon(PEOPLE_ICON));
  const count = el('span', 'hub-people-count', '–');
  peopleBtn.append(count);
  const settingsBtn = iconButton('hub-settings-btn', '설정', icon(GEAR_ICON));
  bar.append(peopleBtn, settingsBtn);

  // 접속자 목록
  const peoplePanel = el('div', 'hub-panel');
  peoplePanel.hidden = true;
  const list = el('ul', 'hub-people');
  peoplePanel.append(el('h2', 'hub-panel-title', '접속자'), list);

  // 설정 창
  const settingsPanel = el('div', 'hub-panel');
  settingsPanel.hidden = true;
  const code = el('div', 'hub-code', opts.room);
  const copy = el('button', 'hub-btn hub-small', '초대 링크 복사');
  copy.type = 'button';
  const codeRow = el('div', 'hub-row hub-center');
  codeRow.append(code, copy);

  const nameInput = el('input', 'hub-input');
  nameInput.maxLength = 32; // 첫 화면 이름 칸과 같은 입력 상한 — 실제 이름은 16자로 다듬는다
  nameInput.setAttribute('autocomplete', 'nickname');
  const renameBtn = el('button', 'hub-btn hub-small', '바꾸기');
  renameBtn.type = 'button';
  const nameRow = el('div', 'hub-row');
  nameRow.append(nameInput, renameBtn);
  const nameHint = el('p', 'hub-hint');

  const leaveBtn = el('button', 'hub-btn hub-danger', '로비 나가기');
  leaveBtn.type = 'button';

  settingsPanel.append(
    el('h2', 'hub-panel-title', '초대 코드'),
    codeRow,
    el('h2', 'hub-panel-title', '이름'),
    nameRow,
    nameHint,
    leaveBtn,
  );

  root.append(bar, peoplePanel, settingsPanel);
  const notice = el('div', 'hub-notice');
  notice.hidden = true;
  document.body.append(root, notice);

  const show = (panel: Panel | null): void => {
    open = panel;
    if (panel !== null) opts.onOpen();
    peoplePanel.hidden = panel !== 'people';
    settingsPanel.hidden = panel !== 'settings';
    peopleBtn.classList.toggle('hub-on', panel === 'people');
    settingsBtn.classList.toggle('hub-on', panel === 'settings');
    if (panel === 'settings') {
      nameInput.value = current;
      nameHint.textContent = '';
    }
    // 닫으면 포커스를 놓는다 — 버튼·입력 칸에 남으면 스페이스·방향키가 로비로 가지 않는다
    if (panel === null && document.activeElement instanceof HTMLElement && root.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  };
  peopleBtn.addEventListener('click', () => show(open === 'people' ? null : 'people'));
  settingsBtn.addEventListener('click', () => show(open === 'settings' ? null : 'settings'));
  // 창 밖을 누르면 닫는다 (맵·채팅창 포함)
  document.addEventListener('pointerdown', (e) => {
    if (open !== null && e.target instanceof Node && !root.contains(e.target)) show(null);
  });
  document.addEventListener('keydown', (e) => {
    if (open !== null && e.key === 'Escape') show(null);
  });

  copy.addEventListener('click', () => copyLink(copy, inviteUrl(opts.lobbyHref, opts.room)));

  const rename = (): void => {
    const raw = nameInput.value;
    const name = renameFromInput(raw, current);
    if (name === null) {
      nameHint.textContent = raw.trim() === '' ? '닉네임을 입력해 주세요' : '';
      nameInput.value = current;
      return;
    }
    current = name;
    nameInput.value = name;
    saveName(name);
    opts.onRename(name);
    nameHint.textContent = '바꿨어요';
  };
  renameBtn.addEventListener('click', rename);
  nameInput.addEventListener('keydown', (e) => {
    // 한글 조합을 확정하는 Enter 는 넘긴다 (첫 화면과 같은 이유 — Safari 는 keyCode 229 만)
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    rename();
  });
  leaveBtn.addEventListener('click', opts.onLeave);

  return {
    update(view) {
      count.textContent = view.count === null ? '–' : `${view.count}`;
      notice.hidden = view.notice === null;
      notice.textContent = view.notice ?? '';
      const items = view.rows.map((r) => {
        const li = el('li', r.mine ? 'hub-person hub-person-mine' : 'hub-person');
        const dot = el('span', 'hub-person-dot');
        dot.style.background = r.color; // others.ts 의 고정 색 표에서만 온다
        li.append(dot, el('span', 'hub-person-name', r.name));
        if (r.mine) li.append(el('span', 'hub-person-me', '(나)'));
        return li;
      });
      list.replaceChildren(...items);
    },
    isOpen() {
      return open !== null;
    },
  };
}
