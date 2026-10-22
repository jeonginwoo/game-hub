// 편집 중 아래쪽 가운데의 도구 줄(놓기·문·칠하기 + 칠하기 붓 + 저장·취소)과 가운데 놓기 창(묶음 탭 + 썸네일 격자) — DOM 연결만,
// 목록은 object-names.ts 의 kindsByGroup, 썸네일 배율은 place.ts 의 thumbScale.
// (결정 2026-10-16: 물체 배치 편집 · 2026-10-17: 타일 편집 · 2026-10-21: 저장식 편집 · 편집 개편 B 놓기 창). 화면 글자는 textContent 로 넣는다.
import { OBJECT_SHAPES, type ObjectKind, type TileChar } from '../../../server/src/room-map';
import { kindsByGroup, OBJECT_INFO } from '../data/object-names';
import { el } from '../room/entry-screen';
import { CELL_PX } from '../world/layers';
import { thumbScale, type EditTool } from './place';

export interface EditTools {
  /** 편집 모드를 켜고 끌 때 — 켜면 놓기 창부터, 끄면 창·도구 줄이 닫히고 도구는 놓기로 */
  show(on: boolean): void;
  tool(): EditTool;
  /** 놓기에서 고른 물체 — 아직 안 골랐으면 null */
  kind(): ObjectKind | null;
  /** 칠하기 붓 — 맵 글자 */
  brush(): TileChar;
  /** 놓기 창이 열려 있는지 — 열려 있으면 맵 미리보기를 숨긴다 */
  windowOpen(): boolean;
  /** 도구를 놓기로 하고 놓기 창을 연다 (Esc 한 단계) */
  openWindow(): void;
  /** 초안에 저장 안 한 바뀐 것이 있는지 — 없으면 「저장」을 끈다 */
  setDirty(dirty: boolean): void;
  /** 시트 그림이 왔다 — 그리지 못한 썸네일을 다시 */
  refreshThumbs(): void;
}

export interface EditCommit {
  readonly onSave: () => void;
  readonly onCancel: () => void;
}

const TOOLS: readonly { readonly tool: EditTool; readonly name: string }[] = [
  { tool: 'place', name: '놓기' },
  { tool: 'door', name: '문' },
  { tool: 'paint', name: '칠하기' },
];

const BRUSHES: readonly { readonly ch: TileChar; readonly name: string }[] = [
  { ch: '.', name: '바닥' },
  { ch: '#', name: '벽' },
  { ch: 'D', name: '문' },
  { ch: 'S', name: '시작점' },
];

const THUMB_BOX_PX = 56; // 썸네일 한 칸 — 큰 건물은 줄이고 작은 풀은 정수배로 키운다

/**
 * onChange — 도구·고른 물체·창 열림이 바뀌었다 (알림 글·미리보기를 다시). commit — 「저장」·「취소」를 눌렀다.
 * drawThumb — 물체 하나를 제 크기(칸 × CELL_PX)로 그린 캔버스, 시트가 아직 안 왔으면 null
 */
export function createEditTools(
  onChange: () => void,
  commit: EditCommit,
  drawThumb: (kind: ObjectKind) => HTMLCanvasElement | null,
): EditTools {
  let tool: EditTool = 'place';
  let kind: ObjectKind | null = null;
  let brush: TileChar = '.';
  let open = false;
  const groups = kindsByGroup();
  let group = 0;
  const thumbs = new Map<ObjectKind, HTMLCanvasElement>(); // 탭을 오갈 때 다시 그리지 않게

  const bar = el('div', 'hub-edit-tools');
  bar.hidden = true;
  const toolButtons = TOOLS.map((t) => {
    const b = el('button', 'hub-btn hub-small', t.name);
    b.type = 'button';
    b.addEventListener('click', () => {
      b.blur(); // 포커스가 남으면 스페이스가 다시 누른다
      if (t.tool === 'place') openWindow(); // 「놓기」는 언제나 창을 연다 — 다른 물체로 바꾸는 길
      else setTool(t.tool);
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

  // 오른쪽 끝에 저장·취소 — 편집은 초안만 고치고, 저장해야 모두에게 간다
  const commitRow = el('div', 'hub-edit-commit');
  bar.append(commitRow);
  const saveButton = el('button', 'hub-btn hub-small hub-primary', '저장');
  const cancelButton = el('button', 'hub-btn hub-small', '취소');
  for (const [b, act] of [[saveButton, commit.onSave], [cancelButton, commit.onCancel]] as const) {
    b.type = 'button';
    b.addEventListener('click', () => {
      b.blur();
      act();
    });
    commitRow.append(b);
  }
  saveButton.disabled = true;

  // 놓기 창 — 어두운 바탕이 맵을 덮어 창이 떠 있는 동안 맵은 눌리지 않는다. 도구 줄은 바탕 위에 남는다
  const backdrop = el('div', 'hub-place-backdrop');
  backdrop.hidden = true;
  const panel = el('div', 'hub-panel hub-place-window');
  const tabs = el('div', 'hub-object-groups');
  const grid = el('div', 'hub-object-thumbs');
  const caption = el('div', 'hub-object-caption');
  panel.append(el('h2', 'hub-panel-title', '놓을 물체'), tabs, grid, caption);
  backdrop.append(panel);
  document.body.append(backdrop, bar);
  // 바탕을 누르면 창만 닫는다 — 고른 물체가 없으면 놓을 것이 없으니 그대로
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && kind !== null) closeWindow();
  });
  // 썸네일 밖으로 나가면 고른 물체 이름으로 돌아온다
  grid.addEventListener('mouseleave', () => showCaption(kind));

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

  function showCaption(k: ObjectKind | null): void {
    caption.textContent = k === null ? ' ' : OBJECT_INFO[k].name; // 빈 줄도 높이를 지켜 창이 출렁이지 않게
  }

  /** 썸네일 캔버스 — 시트가 안 왔으면 빈 자리 */
  function thumb(k: ObjectKind): HTMLElement {
    let c = thumbs.get(k);
    if (!c) {
      const drawn = drawThumb(k);
      if (!drawn) return el('span', 'hub-thumb-empty');
      const shape = OBJECT_SHAPES[k];
      const w = shape.w * CELL_PX;
      const h = shape.h * CELL_PX;
      const scale = thumbScale(w, h, THUMB_BOX_PX);
      drawn.style.width = `${w * scale}px`;
      drawn.style.height = `${h * scale}px`;
      thumbs.set(k, drawn);
      c = drawn;
    }
    return c;
  }

  function renderGrid(): void {
    const kinds = groups[group]?.kinds ?? [];
    grid.replaceChildren(...kinds.map((k) => {
      const b = el('button', k === kind ? 'hub-thumb hub-on' : 'hub-thumb');
      b.type = 'button';
      b.setAttribute('aria-label', OBJECT_INFO[k].name);
      b.append(thumb(k));
      b.addEventListener('mouseenter', () => showCaption(k));
      b.addEventListener('click', () => {
        b.blur();
        kind = k;
        tool = 'place';
        closeWindow();
      });
      return b;
    }));
  }

  function render(): void {
    toolButtons.forEach((b, i) => b.classList.toggle('hub-on', TOOLS[i]?.tool === tool));
    tabButtons.forEach((b, i) => b.classList.toggle('hub-on', i === group));
    brushButtons.forEach((b, i) => b.classList.toggle('hub-on', BRUSHES[i]?.ch === brush));
    brushRow.hidden = tool !== 'paint';
    backdrop.hidden = bar.hidden || !open;
    if (!backdrop.hidden) {
      renderGrid();
      showCaption(kind);
    }
  }

  function setTool(next: EditTool): void {
    if (next === tool && !open) return;
    tool = next;
    open = false;
    render();
    onChange();
  }

  function openWindow(): void {
    tool = 'place';
    open = true;
    render();
    onChange();
  }

  function closeWindow(): void {
    open = false;
    render();
    onChange();
  }

  render();
  return {
    show(on) {
      bar.hidden = !on;
      tool = 'place';
      open = on;
      render();
    },
    tool: () => tool,
    kind: () => kind,
    brush: () => brush,
    windowOpen: () => open,
    openWindow,
    setDirty(dirty) {
      saveButton.disabled = !dirty;
    },
    refreshThumbs() {
      if (!backdrop.hidden) renderGrid();
    },
  };
}
