// 편집 중 아래쪽 가운데의 도구 줄(문·놓기·치우기·칠하기 + 칠하기 붓)과 놓기 때 왼쪽에 뜨는 물체 목록 — DOM 연결만, 목록은 object-names.ts 의 kindsByGroup.
// (결정 2026-10-16: 물체 배치 편집 · 2026-10-17: 타일 편집). 화면 글자는 textContent 로 넣는다.
import type { ObjectKind, TileChar } from '../../../server/src/room-map';
import { kindsByGroup, OBJECT_INFO } from '../data/object-names';
import { el } from '../room/entry-screen';
import type { EditTool } from './place';

export interface EditTools {
  /** 편집 모드를 켜고 끌 때 — 끄면 도구는 문으로 돌아가고 목록도 닫힌다 */
  show(on: boolean): void;
  tool(): EditTool;
  /** 놓기에서 고른 물체 — 아직 안 골랐으면 null */
  kind(): ObjectKind | null;
  /** 칠하기 붓 — 맵 글자 */
  brush(): TileChar;
  /** 문이 아닌 도구면 문으로 돌린다(Esc 한 단계) — 돌렸으면 true */
  back(): boolean;
}

const TOOLS: readonly { readonly tool: EditTool; readonly name: string }[] = [
  { tool: 'door', name: '문' },
  { tool: 'place', name: '놓기' },
  { tool: 'remove', name: '치우기' },
  { tool: 'paint', name: '칠하기' },
];

const BRUSHES: readonly { readonly ch: TileChar; readonly name: string }[] = [
  { ch: '.', name: '바닥' },
  { ch: '#', name: '벽' },
  { ch: 'D', name: '문' },
  { ch: 'S', name: '시작점' },
];

/** onChange — 도구나 고른 물체가 바뀌었다 (알림 글·미리보기를 다시) */
export function createEditTools(onChange: () => void): EditTools {
  let tool: EditTool = 'door';
  let kind: ObjectKind | null = null;
  let brush: TileChar = '.';
  const groups = kindsByGroup();
  let group = 0;

  const bar = el('div', 'hub-edit-tools');
  bar.hidden = true;
  const toolButtons = TOOLS.map((t) => {
    const b = el('button', 'hub-btn hub-small', t.name);
    b.type = 'button';
    b.addEventListener('click', () => {
      b.blur(); // 포커스가 남으면 스페이스가 다시 누른다
      setTool(t.tool);
    });
    bar.append(b);
    return b;
  });
  // 칠하기일 때만 도구 줄 오른쪽에 붓 넷
  const brushRow = el('div', 'hub-edit-brushes');
  bar.append(brushRow);
  const brushButtons = BRUSHES.map((r) => {
    const b = el('button', 'hub-btn hub-small', r.name);
    b.type = 'button';
    b.addEventListener('click', () => {
      b.blur();
      brush = r.ch;
      render();
      onChange();
    });
    brushRow.append(b);
    return b;
  });

  const panel = el('div', 'hub-panel hub-object-panel');
  panel.hidden = true;
  const tabs = el('div', 'hub-object-groups');
  const list = el('div', 'hub-object-kinds');
  panel.append(el('h2', 'hub-panel-title', '놓을 물체'), tabs, list);
  document.body.append(bar, panel);

  const tabButtons = groups.map((g, i) => {
    const b = el('button', 'hub-btn hub-small', g.name);
    b.type = 'button';
    b.addEventListener('click', () => {
      b.blur();
      group = i;
      render();
    });
    tabs.append(b);
    return b;
  });

  function render(): void {
    toolButtons.forEach((b, i) => b.classList.toggle('hub-on', TOOLS[i]?.tool === tool));
    tabButtons.forEach((b, i) => b.classList.toggle('hub-on', i === group));
    brushButtons.forEach((b, i) => b.classList.toggle('hub-on', BRUSHES[i]?.ch === brush));
    brushRow.hidden = tool !== 'paint';
    panel.hidden = bar.hidden || tool !== 'place';
    const kinds = groups[group]?.kinds ?? [];
    list.replaceChildren(...kinds.map((k) => {
      const b = el('button', k === kind ? 'hub-btn hub-small hub-on' : 'hub-btn hub-small', OBJECT_INFO[k].name);
      b.type = 'button';
      b.addEventListener('click', () => {
        b.blur();
        kind = k;
        render();
        onChange();
      });
      return b;
    }));
  }

  function setTool(next: EditTool): void {
    if (next === tool) return;
    tool = next;
    render();
    onChange();
  }

  render();
  return {
    show(on) {
      bar.hidden = !on;
      if (!on) tool = 'door';
      render();
    },
    tool: () => tool,
    kind: () => kind,
    brush: () => brush,
    back() {
      if (tool === 'door') return false;
      setTool('door');
      return true;
    },
  };
}
