// 편집 중 가운데 편집 창(위에 탭 셋 — 오브젝트: 층 탭 + 왼쪽 목록 · 오른쪽 썸네일(바닥 층은 재질 붓 — 테마 · 바닥/길, 물체 층은 묶음 · 물체), 게임, 타일 규칙: 붓)과
// 아래쪽 가운데 줄(창 열기 · 지우개 + 층 · 손 · 열림/닫힘 · 저장·취소) — DOM 연결만, 목록은 object-names.ts 의 kindsByGroup, 이름·배율은 place.ts.
// (결정 2026-10-16: 물체 배치 편집 · 2026-10-17: 타일 편집 · 2026-10-21: 저장식 편집 · 편집 개편 B 놓기 창 · C 도구 상자
//  · 2026-10-23: 편집 창 재구성 · 2026-10-24: 지우개·손은 아래 줄 · 2026-11-10: 바닥 탭은 재질 붓 · 편집 개편 D2: 열림/닫힘 토글). 화면 글자는 textContent 로 넣는다.
import { OBJECT_SHAPES, type ObjectKind, type ObjectState, type TileChar } from '../../../server/src/room-map';
import { kindsByGroup, OBJECT_INFO } from '../data/object-names';
import { el } from '../room/entry-screen';
import { CELL_PX } from '../world/layers';
import type { ObjectLayer } from '../world/objects';
import { brushPartName, GROUND_BRUSH_THEMES, groundChar, type GroundBrush } from './ground-brush';
import {
  BAR_TOOLS, BRUSHES, DOOR_STATES, ERASE_LAYERS, tabOf, thumbScale, toolLabel, WINDOW_TOOLS, type EditTool, type PickTool, type WindowTool,
} from './place';

export interface EditTools {
  /** 편집 모드를 켜고 끌 때 — 켜면 오브젝트 탭으로 창부터, 끄면 창·아래 줄이 닫히고 도구는 놓기로 */
  show(on: boolean): void;
  tool(): EditTool;
  /** 놓기에서 고른 물체 — 아직 안 골랐으면 null */
  kind(): ObjectKind | null;
  /** 칠하기 붓 — 맵 글자 */
  brush(): TileChar;
  /** 바닥 재질 붓 — 테마 · 바닥/길 */
  ground(): GroundBrush;
  /** 지우개가 지우는 층 — 고른 층만 */
  eraseLayer(): ObjectLayer;
  /** 문 상태 토글 — 이 상태의 꼬리표 물체만 보이고, 문 칸에 놓는 물체는 이 꼬리표를 단다 */
  doorState(): ObjectState;
  /** 편집 창이 열려 있는지 — 열려 있으면 맵 미리보기를 숨긴다 */
  windowOpen(): boolean;
  /** 편집 창을 마지막 창 탭으로 연다 (Esc 한 단계) */
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

/** 오브젝트 탭의 층 탭 — 바닥은 재질 붓, 물체는 물체 묶음 */
type PlaceLayer = 'floor' | 'object';

const PLACE_LAYERS: readonly { readonly layer: PlaceLayer; readonly name: string }[] = [
  { layer: 'floor', name: '바닥' },
  { layer: 'object', name: '물체' },
];

// 오브젝트 말고 다른 탭의 안내 한 줄
const TAB_HINT: Readonly<Record<Exclude<WindowTool, 'place'>, string>> = {
  select: '맵의 문을 눌러 게임 고르기',
  paint: '칠할 칸',
};

const THUMB_BOX_PX = 56; // 썸네일 한 칸 — 큰 건물은 줄이고 작은 풀은 정수배로 키운다
const GROUND_THUMB_PX = 64; // 재질 썸네일 — 타일 2×2 (32px 네 장) 그대로

/** 단추 하나 — 누르면 포커스를 놓는다(남으면 스페이스가 다시 누른다) */
function button(cls: string, text: string, onClick: () => void): HTMLButtonElement {
  const b = el('button', cls, text);
  b.type = 'button';
  b.addEventListener('click', () => {
    b.blur();
    onClick();
  });
  return b;
}

/**
 * onChange — 도구·고른 것·창 열림이 바뀌었다 (알림 글·미리보기를 다시). commit — 「저장」·「취소」를 눌렀다.
 * drawThumb — 물체 하나를 제 크기(칸 × CELL_PX)로 그린 캔버스, drawGroundThumb — 재질 글자 하나로 깐 타일 2×2 캔버스.
 * 시트가 아직 안 왔으면 둘 다 null
 */
export function createEditTools(
  onChange: () => void,
  commit: EditCommit,
  drawThumb: (kind: ObjectKind) => HTMLCanvasElement | null,
  drawGroundThumb: (ch: string) => HTMLCanvasElement | null,
): EditTools {
  let tool: EditTool = 'place';
  let kind: ObjectKind | null = null;
  let brush: TileChar = '.';
  let ground: GroundBrush = { theme: 'g', path: false };
  let objectTool: 'place' | 'ground' = 'place'; // 오브젝트 탭에서 마지막에 고른 도구 — 창 열기 버튼 글과 다시 열 층
  let groundTheme = ground.theme; // 바닥 층에서 보고 있는 테마 — 고르기 전엔 붓이 그대로
  let eraseLayer: ObjectLayer = 'sorted'; // 바닥을 실수로 통째 지우지 않게 물체부터
  let doorState: ObjectState = 'shut'; // 편집을 켤 때마다 닫힘부터 — 배정 전 문이 대부분이라 닫힌 모습부터 꾸민다
  let open = false;
  let tab: WindowTool = 'place'; // 창에 보이는 탭 — 고르기 전에는 도구가 그대로, 지우개·손 중에도 마지막 창 도구
  let layer: PlaceLayer = 'object';
  const groups = kindsByGroup();
  let groupIndex = 0; // 물체 층에서 보고 있는 묶음 — 층을 오가도 보던 묶음으로
  const thumbs = new Map<ObjectKind, HTMLCanvasElement>(); // 탭을 오갈 때 다시 그리지 않게
  const groundThumbs = new Map<string, HTMLCanvasElement>();

  // 아래쪽 가운데 줄 — 창 열기(마지막 창 도구를 글로) · 지우개(고르면 층 둘) · 손 · 저장·취소.
  // 편집은 초안만 고치고, 저장해야 모두에게 간다
  const bar = el('div', 'hub-edit-tools');
  bar.hidden = true;
  const windowButton = button('hub-btn hub-small hub-edit-current', '', () => openWindow());
  const barTools = el('div', 'hub-edit-group');
  const barButtons = BAR_TOOLS.map((t) => {
    const b = button('hub-btn hub-small', t.name, () => pick(t.tool));
    barTools.append(b);
    return b;
  });
  const layerRow = el('div', 'hub-edit-group');
  const layerButtons = ERASE_LAYERS.map((r) => {
    const b = button('hub-btn hub-small', r.name, () => {
      eraseLayer = r.layer;
      pick('erase');
    });
    layerRow.append(b);
    return b;
  });
  // 문 상태 토글 — 도구와 상관없이 늘 보인다. 바꾸면 보이는 물체가 바뀐다(월드를 다시 만드는 것은 onChange 쪽)
  const stateRow = el('div', 'hub-edit-group');
  const stateButtons = DOOR_STATES.map((r) => {
    const b = button('hub-btn hub-small', r.name, () => {
      doorState = r.state;
      render();
      onChange();
    });
    stateRow.append(b);
    return b;
  });
  const commitRow = el('div', 'hub-edit-group');
  const saveButton = button('hub-btn hub-small hub-primary', '저장', () => commit.onSave());
  const cancelButton = button('hub-btn hub-small', '취소', () => commit.onCancel());
  commitRow.append(saveButton, cancelButton);
  bar.append(windowButton, barTools, layerRow, stateRow, commitRow);
  saveButton.disabled = true;

  // 편집 창 — 어두운 바탕이 맵을 덮어 창이 떠 있는 동안 맵은 눌리지 않는다. 아래 줄은 바탕 위에 남는다
  const backdrop = el('div', 'hub-edit-backdrop');
  backdrop.hidden = true;
  const panel = el('div', 'hub-panel hub-edit-window');
  const toolTabs = el('div', 'hub-edit-tabs');
  const tabButtons = WINDOW_TOOLS.map((t) => {
    const b = button('hub-btn hub-small', t.name, () => {
      // 게임은 고를 것이 없어 바로 그 도구로 — 맵의 문을 누른다
      if (t.tool === 'select') pick('select');
      else {
        tab = t.tool;
        render();
      }
    });
    toolTabs.append(b);
    return b;
  });

  // 오브젝트 탭 — 층 탭 + 왼쪽 목록 · 오른쪽 썸네일 격자(각각 넘치면 스크롤) + 호버 이름 줄.
  // 바닥 층은 왼쪽 테마 · 오른쪽 바닥/길, 물체 층은 왼쪽 묶음 · 오른쪽 물체
  const placeBody = el('div', 'hub-edit-place');
  const placeLayerTabs = el('div', 'hub-edit-layers');
  const placeLayerButtons = PLACE_LAYERS.map((l) => {
    const b = button('hub-btn hub-small', l.name, () => {
      layer = l.layer;
      render();
      grid.scrollTop = 0;
    });
    placeLayerTabs.append(b);
    return b;
  });
  const lists = el('div', 'hub-edit-lists');
  const groupList = el('div', 'hub-object-groups');
  const grid = el('div', 'hub-object-thumbs');
  lists.append(groupList, grid);
  const caption = el('div', 'hub-object-caption');
  placeBody.append(placeLayerTabs, lists, caption);
  const groupButtons = groups.map((g, i) => {
    const b = button('hub-btn hub-small', g.name, () => {
      groupIndex = i;
      render();
      grid.scrollTop = 0; // 새 묶음은 처음부터
    });
    groupList.append(b);
    return b;
  });
  const themeButtons = GROUND_BRUSH_THEMES.map((t) => {
    const b = button('hub-btn hub-small', t.name, () => {
      groundTheme = t.theme;
      render();
    });
    groupList.append(b);
    return b;
  });
  // 썸네일 밖으로 나가면 고른 것 이름으로 돌아온다
  grid.addEventListener('mouseleave', () => showPicked());

  // 다른 탭 — 안내 한 줄 + 고를 것(타일 규칙은 붓 넷, 게임은 그 도구 하나)
  const choiceBody = el('div', 'hub-edit-choice');
  const hint = el('p', 'hub-edit-hint');
  const choices = el('div', 'hub-edit-choices');
  choiceBody.append(hint, choices);

  panel.append(toolTabs, placeBody, choiceBody);
  backdrop.append(panel);
  document.body.append(backdrop, bar);
  // 바탕을 누르면 창만 닫는다 — 놓기인데 고른 물체가 없으면 놓을 것이 없으니 그대로
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop && (tool !== 'place' || kind !== null)) closeWindow();
  });

  function showCaption(text: string | null): void {
    caption.textContent = text ?? ' '; // 빈 줄도 높이를 지켜 창이 출렁이지 않게
  }

  /** 지금 층에서 고른 것의 이름 — 바닥 층은 재질 붓(붓을 쓰는 중일 때), 물체 층은 고른 물체 */
  function showPicked(): void {
    if (layer === 'floor') showCaption(objectTool === 'ground' ? brushPartName(ground) : null);
    else showCaption(kind === null ? null : OBJECT_INFO[kind].name);
  }

  /** 재질 썸네일 캔버스 — 시트가 안 왔으면 빈 자리 */
  function groundThumb(ch: string): HTMLElement {
    let c = groundThumbs.get(ch);
    if (!c) {
      const drawn = drawGroundThumb(ch);
      if (!drawn) return el('span', 'hub-thumb-empty');
      drawn.style.width = drawn.style.height = `${GROUND_THUMB_PX}px`;
      groundThumbs.set(ch, drawn);
      c = drawn;
    }
    return c;
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
    if (layer === 'floor') {
      grid.replaceChildren(...[false, true].map((path) => {
        const choice: GroundBrush = { theme: groundTheme, path };
        const on = objectTool === 'ground' && ground.theme === choice.theme && ground.path === path;
        const b = button(on ? 'hub-thumb hub-on' : 'hub-thumb', '', () => {
          ground = choice;
          pick('ground');
        });
        b.setAttribute('aria-label', brushPartName(choice));
        b.append(groundThumb(groundChar(choice)));
        b.addEventListener('mouseenter', () => showCaption(brushPartName(choice)));
        return b;
      }));
      return;
    }
    const kinds = groups[groupIndex]?.kinds ?? [];
    grid.replaceChildren(...kinds.map((k) => {
      const b = button(k === kind ? 'hub-thumb hub-on' : 'hub-thumb', '', () => {
        kind = k;
        pick('place');
      });
      b.setAttribute('aria-label', OBJECT_INFO[k].name);
      b.append(thumb(k));
      b.addEventListener('mouseenter', () => showCaption(OBJECT_INFO[k].name));
      return b;
    }));
  }

  function renderChoices(t: Exclude<WindowTool, 'place'>): void {
    hint.textContent = TAB_HINT[t];
    const rows = t === 'paint'
      ? BRUSHES.map((r) => ({ name: r.name, on: tool === 'paint' && r.ch === brush, act: () => { brush = r.ch; } }))
      : [{ name: WINDOW_TOOLS.find((x) => x.tool === t)?.name ?? t, on: tool === t, act: () => undefined }];
    choices.replaceChildren(...rows.map((r) => button(r.on ? 'hub-btn hub-small hub-on' : 'hub-btn hub-small', r.name, () => {
      r.act();
      pick(t);
    })));
  }

  function render(): void {
    const last: PickTool = tab === 'place' ? objectTool : tab;
    windowButton.textContent = toolLabel(last, { kind, brush, ground });
    windowButton.classList.toggle('hub-on', tabOf(tool) !== null);
    barButtons.forEach((b, i) => b.classList.toggle('hub-on', BAR_TOOLS[i]?.tool === tool));
    layerButtons.forEach((b, i) => b.classList.toggle('hub-on', ERASE_LAYERS[i]?.layer === eraseLayer));
    layerRow.hidden = tool !== 'erase';
    stateButtons.forEach((b, i) => b.classList.toggle('hub-on', DOOR_STATES[i]?.state === doorState));
    backdrop.hidden = bar.hidden || !open;
    if (backdrop.hidden) return;
    tabButtons.forEach((b, i) => b.classList.toggle('hub-on', WINDOW_TOOLS[i]?.tool === tab));
    placeBody.hidden = tab !== 'place';
    choiceBody.hidden = tab === 'place';
    if (tab === 'place') {
      placeLayerButtons.forEach((b, i) => b.classList.toggle('hub-on', PLACE_LAYERS[i]?.layer === layer));
      groupButtons.forEach((b, i) => {
        b.hidden = layer !== 'object';
        b.classList.toggle('hub-on', i === groupIndex);
      });
      themeButtons.forEach((b, i) => {
        b.hidden = layer !== 'floor';
        b.classList.toggle('hub-on', GROUND_BRUSH_THEMES[i]?.theme === groundTheme);
      });
      renderGrid();
      showPicked();
    } else renderChoices(tab);
  }

  /** 도구를 고르고 창을 닫는다 — 고른 것(물체·붓·층)은 부르는 쪽이 먼저 바꿔 둔다 */
  function pick(next: EditTool): void {
    tool = next;
    const t = tabOf(next);
    if (t !== null) tab = t;
    if (next === 'place' || next === 'ground') objectTool = next;
    open = false;
    render();
    onChange();
  }

  function openWindow(): void {
    // 마지막에 고른 것의 층·묶음(테마)으로 — 다시 열면 보던 자리
    const k = kind;
    if (tab === 'place' && objectTool === 'ground') {
      layer = 'floor';
      groundTheme = ground.theme;
    } else if (tab === 'place' && k !== null) {
      const i = groups.findIndex((g) => g.group === OBJECT_INFO[k].group);
      if (i >= 0) {
        layer = 'object';
        groupIndex = i;
      }
    }
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
      objectTool = 'place';
      tab = 'place';
      doorState = 'shut';
      open = on;
      render();
    },
    tool: () => tool,
    kind: () => kind,
    brush: () => brush,
    ground: () => ground,
    eraseLayer: () => eraseLayer,
    doorState: () => doorState,
    windowOpen: () => open,
    openWindow,
    setDirty(dirty) {
      saveButton.disabled = !dirty;
    },
    refreshThumbs() {
      if (!backdrop.hidden && tab === 'place') renderGrid(); // 바닥 층이면 재질 썸네일도 다시 굽는다
    },
  };
}
