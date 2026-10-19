// 첫 화면(이름·로비 만들기·코드로 참여) — DOM 연결만. 무엇을 보일지·코드 판정은 room.ts.
// (결정 2026-10-14: 로그인 없이 방 + 닉네임 + 초대 링크). 화면 글자는 모두 textContent 로 넣는다.
import { ROOM_TEMPLATES } from '../../../server/src/room-templates';
import { cycleIndex, mapKey, nameFromInput, newRoomCode, roomFromInput, type Screen } from './room';

const NAME_KEY = 'game-hub:name';

/** 저장된 이름. 저장소를 못 쓰면(사생활 모드 등) null — 그때는 매번 묻는다 */
export function loadName(): string | null {
  try {
    const raw = localStorage.getItem(NAME_KEY);
    return raw === null ? null : nameFromInput(raw);
  } catch {
    return null;
  }
}

/** 이름 저장 — 첫 화면과 설정 창의 이름 변경이 쓴다. 저장 못 해도 던지지 않는다 */
export function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // 저장 못 해도 이번 접속은 그대로 — 다음에 다시 묻는다
  }
}

/** 이 방에서 기억해 둔 맵 템플릿 id — 없거나 저장소를 못 쓰면 null */
export function loadRoomMap(room: string): string | null {
  try {
    return sessionStorage.getItem(mapKey(room));
  } catch {
    return null;
  }
}

/** 방을 만들 때 고른 맵·welcome 으로 받은 맵을 기억한다. 저장 못 해도 던지지 않는다 */
export function saveRoomMap(room: string, map: string): void {
  try {
    sessionStorage.setItem(mapKey(room), map);
  } catch {
    // 저장 못 하면 방이 비어 다시 생길 때 기본 맵 — 이번 접속은 그대로
  }
}

export interface Entered {
  readonly room: string;
  readonly name: string;
  /** 「로비 만들기」에서 고른 맵 템플릿 id — 참여·초대 링크로 오면 없다 */
  readonly map?: string;
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  e.textContent = text;
  return e;
}

/**
 * 시작 화면(start) 또는 이름 화면(name)을 띄우고, 들어가면 닫고 방·이름을 돌려준다.
 * name 화면은 초대 링크로 온 경우라 room 이 정해져 있다.
 * onMap 은 「로비 만들기」의 맵 ◀ ▶ 로 고른 템플릿 id 를 받는다 — 뒤 배경 미리보기
 */
export function showEntryScreen(
  screen: Exclude<Screen, 'lobby'>,
  room: string | null,
  savedName: string | null,
  onMap?: (id: string) => void,
): Promise<Entered> {
  return new Promise((resolve) => {
    const overlay = el('div', 'hub-overlay');
    const card = el('form', 'hub-card');
    card.noValidate = true;
    overlay.append(card);

    card.append(el('h1', 'hub-title', 'game-hub'));
    if (screen === 'name' && room !== null) card.append(el('p', 'hub-sub', `초대받은 로비 ${room}`));

    const nameInput = el('input', 'hub-input');
    nameInput.placeholder = '닉네임';
    nameInput.maxLength = 32; // 다듬기 전 입력 상한 — 실제 이름은 nameFromInput 이 16자로 자른다
    nameInput.setAttribute('autocomplete', 'nickname'); // HTML 표준 값이지만 TS 의 AutoFill 타입에 없다
    nameInput.value = savedName ?? '';
    card.append(nameInput);

    const codeInput = el('input', 'hub-input');
    codeInput.placeholder = '방 코드 또는 초대 링크';
    codeInput.autocomplete = 'off';

    const createBtn = el('button', 'hub-btn hub-primary', screen === 'name' ? '입장' : '로비 만들기');
    createBtn.type = 'button';
    const joinBtn = el('button', 'hub-btn', '참여');
    joinBtn.type = 'button';
    const error = el('p', 'hub-error');

    // 맵 고르기 — 「로비 만들기」로 새 방을 열 때만. 참여하는 방의 맵은 서버가 정한다
    let mapIndex = 0;
    const mapLabel = el('span', 'hub-map-name');
    const showMap = (): void => {
      mapLabel.textContent = ROOM_TEMPLATES[mapIndex]?.name ?? '';
    };
    const mapRow = el('div', 'hub-row hub-map-row');
    const mapStep = (text: string, label: string, delta: number): HTMLButtonElement => {
      const b = el('button', 'hub-btn hub-small hub-look-step', text);
      b.type = 'button';
      b.setAttribute('aria-label', label);
      b.addEventListener('click', () => {
        mapIndex = cycleIndex(mapIndex, delta, ROOM_TEMPLATES.length);
        showMap();
        const id = ROOM_TEMPLATES[mapIndex]?.id;
        if (id !== undefined) onMap?.(id);
      });
      return b;
    };
    mapRow.append(el('span', 'hub-look-part', '맵'), mapStep('◀', '이전 맵', -1), mapLabel, mapStep('▶', '다음 맵', 1));
    showMap();

    if (screen === 'start') {
      card.append(mapRow, createBtn, el('div', 'hub-or', '또는'));
      const row = el('div', 'hub-row');
      row.append(codeInput, joinBtn);
      card.append(row);
    } else {
      card.append(createBtn);
    }
    card.append(error);

    const enter = (code: string | null, map?: string): void => {
      const name = nameFromInput(nameInput.value);
      if (name === null) {
        error.textContent = '닉네임을 입력해 주세요';
        nameInput.focus();
        return;
      }
      if (code === null) {
        error.textContent = '방 코드를 읽을 수 없어요 — 6자 코드나 초대 링크를 넣어 주세요';
        codeInput.focus();
        return;
      }
      saveName(name);
      if (map !== undefined) saveRoomMap(code, map);
      overlay.remove();
      resolve(map === undefined ? { room: code, name } : { room: code, name, map });
    };

    createBtn.addEventListener('click', () => {
      if (room !== null) enter(room); // 초대받은 방 — 맵은 그 방의 것
      else enter(newRoomCode(), ROOM_TEMPLATES[mapIndex]?.id);
    });
    joinBtn.addEventListener('click', () => enter(roomFromInput(codeInput.value)));
    // Enter — 코드 칸에 뭔가 있으면 참여, 아니면 만들기(이름 화면이면 입장).
    // 입력 칸이 둘이고 submit 버튼이 없는 폼은 Enter 로 제출되지 않으므로 키를 직접 받는다
    card.addEventListener('keydown', (e) => {
      // 한글 조합 중의 Enter 는 글자를 확정하는 키 — 여기서 받으면 마지막 글자가 빠진 채 들어간다.
      // Safari 는 그 Enter 에 isComposing 을 false 로 주고 keyCode 229 만 남긴다
      if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
      if (!(e.target instanceof HTMLInputElement)) return;
      e.preventDefault();
      if (screen === 'start' && codeInput.value.trim() !== '') joinBtn.click();
      else createBtn.click();
    });
    card.addEventListener('submit', (e) => e.preventDefault());

    document.body.append(overlay);
    nameInput.focus();
  });
}
