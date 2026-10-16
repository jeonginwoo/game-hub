// 로비 오른쪽 위 버튼 줄 — 꾸미기 버튼(캐릭터 외형), 사람 버튼(인원 + 접속자 목록), 설정 버튼(초대 코드·이름 변경·로비 나가기),
// 위쪽 가운데 연결 알림. DOM 연결만 — 무엇을 보일지는 hud.ts, 이름·주소 판정은 room.ts, 외형 선택지는 look.ts
// (결정 2026-10-16: 로비 정보는 오른쪽 위 버튼 줄로 · 캐릭터 꾸미기). 화면 글자는 모두 textContent 로 넣는다.
import type { Look } from '../../../server/src/protocol';
import { drawAvatar } from '../avatar/avatar-art';
import { el, saveName } from '../room/entry-screen';
import type { RosterRow } from './hud';
import { AVATAR_PX } from '../world/layers';
import { choiceOf, cycleLook, LOOK_PARTS, lookFromStorage } from '../avatar/look';
import { inviteUrl, renameFromInput } from '../room/room';

const LOOK_KEY = 'game-hub:look';

/** 저장된 외형 — 없거나 저장소를 못 쓰면 무작위(처음 온 사람). 그 무작위 외형도 바로 저장해 다음에 같게 */
export function loadLook(): Look {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(LOOK_KEY);
  } catch {
    // 저장소를 못 쓰면 매번 무작위 — 이번 접속 동안은 같다
  }
  const look = lookFromStorage(raw, Math.random);
  saveLook(look);
  return look;
}

function saveLook(look: Look): void {
  try {
    localStorage.setItem(LOOK_KEY, JSON.stringify(look));
  } catch {
    // 저장 못 해도 이번 접속은 그대로
  }
}

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
  readonly look: Look;
  readonly lobbyHref: string;
  readonly onRename: (name: string) => void;
  /** 꾸미기 창에서 부위 하나를 바꿀 때마다 — 저장은 이 창이 이미 했다 */
  readonly onLook: (look: Look) => void;
  readonly onLeave: () => void;
  /** 창이 열릴 때 — 로비가 누르고 있던 방향키를 놓게 (열린 동안 keyup 전까지 계속 걷지 않게) */
  readonly onOpen: () => void;
}

type Panel = 'look' | 'people' | 'settings';

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

// 셔츠 — 꾸미기 (결정 2026-10-16: 캐릭터 꾸미기)
const SHIRT_ICON: IconParts = [
  ['path', { d: 'M7 2.5 2 5l1.5 4.5L6 8.5V18h8V8.5l2.5 1L18 5l-5-2.5c-.4 1.4-1.6 2.3-3 2.3S7.4 3.9 7 2.5z', fill: 'currentColor' }],
];

// 왕관 — 접속자 목록의 방장 표시 (결정 2026-10-16: 서버가 정한 방장)
const CROWN_ICON: IconParts = [
  ['path', { d: 'M2.5 15.5 1.5 6l5 3.5L10 3l3.5 6.5 5-3.5-1 9.5z', fill: 'currentColor' }],
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
  let look = opts.look;
  let open: Panel | null = null;

  const root = el('div', 'hub-hud');
  const bar = el('div', 'hub-hud-bar');
  const lookBtn = iconButton('hub-look-btn', '꾸미기', icon(SHIRT_ICON));
  const peopleBtn = iconButton('hub-people-btn', '접속자', icon(PEOPLE_ICON));
  const count = el('span', 'hub-people-count', '–');
  peopleBtn.append(count);
  const settingsBtn = iconButton('hub-settings-btn', '설정', icon(GEAR_ICON));
  bar.append(lookBtn, peopleBtn, settingsBtn);

  // 접속자 목록
  const peoplePanel = el('div', 'hub-panel');
  peoplePanel.hidden = true;
  const list = el('ul', 'hub-people');
  peoplePanel.append(el('h2', 'hub-panel-title', '접속자'), list);

  // 꾸미기 창 — 정면 미리보기 + 부위마다 ◀ 선택지 ▶. 누르는 즉시 바뀌고 저장된다 (저장 버튼 없음)
  const lookPanel = el('div', 'hub-panel');
  lookPanel.hidden = true;
  const preview = el('canvas', 'hub-look-preview');
  preview.width = AVATAR_PX.w;
  preview.height = AVATAR_PX.h;
  const previewCtx = preview.getContext('2d');
  const choiceRows = LOOK_PARTS.map(([part, title]) => {
    const prev = el('button', 'hub-btn hub-small hub-look-step', '◀');
    prev.type = 'button';
    prev.setAttribute('aria-label', `${title} 이전`);
    const next = el('button', 'hub-btn hub-small hub-look-step', '▶');
    next.type = 'button';
    next.setAttribute('aria-label', `${title} 다음`);
    const swatch = el('span', 'hub-person-dot');
    const label = el('span', 'hub-look-label');
    const value = el('span', 'hub-look-value');
    value.append(swatch, label);
    const row = el('div', 'hub-row hub-look-row');
    row.append(el('span', 'hub-look-part', title), prev, value, next);
    prev.addEventListener('click', () => setLook(cycleLook(look, part, -1)));
    next.addEventListener('click', () => setLook(cycleLook(look, part, 1)));
    return { part, swatch, label, row };
  });
  lookPanel.append(el('h2', 'hub-panel-title', '꾸미기'), preview, ...choiceRows.map((r) => r.row));

  const drawLook = (): void => {
    if (previewCtx) drawAvatar(previewCtx, 'down', look);
    for (const r of choiceRows) {
      const c = choiceOf(look, r.part);
      r.label.textContent = c.label;
      r.swatch.hidden = c.color === undefined;
      r.swatch.style.background = c.color ?? ''; // look.ts 의 고정 색 표에서만 온다
    }
  };
  const setLook = (next: Look): void => {
    look = next;
    saveLook(next);
    drawLook();
    opts.onLook(next);
  };
  drawLook();

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

  root.append(bar, lookPanel, peoplePanel, settingsPanel);
  const notice = el('div', 'hub-notice');
  notice.hidden = true;
  document.body.append(root, notice);

  const show = (panel: Panel | null): void => {
    open = panel;
    if (panel !== null) opts.onOpen();
    lookPanel.hidden = panel !== 'look';
    peoplePanel.hidden = panel !== 'people';
    settingsPanel.hidden = panel !== 'settings';
    lookBtn.classList.toggle('hub-on', panel === 'look');
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
  lookBtn.addEventListener('click', () => show(open === 'look' ? null : 'look'));
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
        dot.style.background = r.color; // look.ts 의 고정 색 표에서만 온다
        li.append(dot, el('span', 'hub-person-name', r.name));
        if (r.owner) {
          const crown = el('span', 'hub-person-crown');
          crown.title = '방장';
          crown.append(icon(CROWN_ICON));
          li.append(crown);
        }
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
