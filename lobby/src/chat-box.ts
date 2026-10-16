// 로비 왼쪽 아래 채팅창 — DOM 연결만. 무엇을 보일지·글자 다듬기는 chat.ts (결정 2026-10-16: 채팅창 + 말풍선).
// 화면 글자는 모두 textContent 로 넣는다. Enter 로 열고, Enter 로 보내고 닫는다 — 닫혀 있어야 방향키가 걷기로 간다.
import { CHAT_MAX } from '../../server/src/protocol';
import { chatFromInput, LINE_FADE_MS, LINE_SHOW_MS, LOG_MAX, type ChatLine } from './chat';

export interface ChatBox {
  add(line: ChatLine): void;
  /** 입력 칸으로 — 로비에서 Enter 를 누르면 */
  focus(): void;
}

/** 채팅창을 띄운다. 보낼 글은 다듬어서 send 로 — 빈 글은 보내지 않는다 */
export function showChatBox(send: (text: string) => void): ChatBox {
  const box = document.createElement('div');
  box.className = 'hub-chat';
  const log = document.createElement('div');
  log.className = 'hub-chat-log';
  const input = document.createElement('input');
  input.className = 'hub-input hub-chat-input';
  input.placeholder = 'Enter 로 채팅';
  input.maxLength = CHAT_MAX;
  input.autocomplete = 'off';
  box.append(log, input);

  // 입력 칸이 열려 있을 때만 지난 줄까지 다 보이고 스크롤된다. 닫혀 있으면 새 줄만 잠깐 보였다 사라진다
  input.addEventListener('focus', () => box.classList.add('hub-chat-open'));
  input.addEventListener('blur', () => {
    box.classList.remove('hub-chat-open');
    log.scrollTop = log.scrollHeight; // 닫힌 창은 스크롤이 없으니 늘 맨 아래 줄을 보이게
  });
  let fresh = 0; // 아직 사라지지 않은 줄 수 — 0 이면 닫힌 창에서 기록 칸 자체를 숨긴다
  const quiet = (): void => {
    log.classList.toggle('hub-chat-quiet', fresh === 0);
  };
  quiet();

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      input.blur();
      return;
    }
    // 한글 조합 중의 Enter 는 글자를 확정하는 키 — 여기서 받으면 마지막 글자가 빠진다 (entry-screen.ts 와 같은 이유)
    if (e.key !== 'Enter' || e.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    const text = chatFromInput(input.value);
    if (text !== null) send(text);
    input.value = '';
    input.blur();
  });

  document.body.append(box);
  return {
    add(line) {
      // 맨 아래를 보고 있었을 때만 따라 내려간다 — 위로 올려 읽는 중이면 그대로
      const atBottom = log.scrollHeight - log.scrollTop - log.clientHeight < 4;
      const row = document.createElement('div');
      row.className = line.mine ? 'hub-chat-line hub-chat-mine' : 'hub-chat-line';
      const name = document.createElement('span');
      name.className = 'hub-chat-name';
      name.textContent = line.name;
      row.append(name, document.createTextNode(line.text));
      log.append(row);
      while (log.childElementCount > LOG_MAX) log.firstElementChild?.remove();
      if (atBottom || !box.classList.contains('hub-chat-open')) log.scrollTop = log.scrollHeight;
      fresh++;
      quiet();
      // LINE_SHOW_MS 뒤 흐려지기 시작하고, LINE_FADE_MS 뒤 닫힌 창에서 빠진다 (열린 창에서는 계속 보임 — CSS)
      setTimeout(() => row.classList.add('hub-chat-fading'), LINE_SHOW_MS);
      setTimeout(() => {
        row.classList.add('hub-chat-old');
        fresh--;
        quiet();
      }, LINE_SHOW_MS + LINE_FADE_MS);
    },
    focus() {
      input.focus();
    },
  };
}
