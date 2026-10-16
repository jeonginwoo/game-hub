// 로비 진입점 — 직교 카메라 위에 ZEP 식 층(배경 한 장·물체·캐릭터)을 그린다 (결정 2026-10-13: 직교 + 2D 스프라이트,
// 2026-10-14: ZEP 식 층). 배경·물체는 Ninja Adventure 타일(docs/assets.md), 캐릭터는 아직 임시 그림. 월드 좌표: x = 타일 x, y = -타일 y (화면 위쪽이 맵 윗줄).
import * as THREE from 'three';
import type { Spot } from '../../server/src/protocol';
import { bubbleText, chatLine, say, type Bubble } from './chat';
import { showChatBox, type ChatBox } from './chat-box';
import { doorIndexAt, entryUrl, gameAtDoor, returnUrl, spawnFromSearch, withoutDoorParam } from './entry';
import { loadName, showEntryScreen, showRoomBadge, type Entered } from './entry-screen';
import { DOOR_GAMES, GAMES } from './games';
import { AVATAR_PX, drawZ, TILE_PX } from './layers';
import { LOBBY_OBJECTS } from './lobby-objects';
import { LOBBY_ROWS } from './lobby-map';
import { parseMap, type Pos } from './map';
import { facingOf, reversesWalk, stepHeld, type Dir } from './movement';
import { connect, statusText, type Connection, type NetStatus } from './net';
import { checkObjects, objectRect, objectZ, withSolidObjects, type MapObject } from './objects';
import { advance, applyMsg, colorFor, NO_OTHERS, remotePos, type Others } from './others';
import { roomFromSearch, screenFor, withRoom } from './room';
import { CELL_PX, tileLook, type Cell, type Sheet } from './tiles';
import { clampAxis } from './view';

// 화면 배율 — 그림 1px 을 화면 몇 CSS px 로 (한 칸 = TILE_PX × VIEW_ZOOM). 창 크기와 상관없이 고정이라 창이 크면 더 넓게 보인다.
// 1.5 면 한 칸 48px — 16px 타일(Ninja Adventure)은 원본 1px 이 화면 3px 로 고르다. 32px 기준 그림(임시 캐릭터)은 1.5배라 고르지 않다
const VIEW_ZOOM = 1.5;
const STEP_MS = 160; // 한 칸 걷는 시간 (대각선은 거리만큼 √2 배)

const canvas = document.querySelector<HTMLCanvasElement>('#app');
if (!canvas) throw new Error('#app 캔버스가 없다');

const map = parseMap(LOBBY_ROWS);

const renderer = new THREE.WebGLRenderer({ canvas, antialias: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x10131b);

const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
camera.position.z = 10;

// --- 층 (layers.ts) -----------------------------------------------------------
// 깊이는 z 로 준다 — 그림이 모두 불투명이거나 alphaTest 라 깊이 버퍼가 앞뒤를 가린다

/** 픽셀 캔버스를 도트가 번지지 않는 텍스처로 */
function pixelTexture(c: HTMLCanvasElement): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** 크기 w×h(칸)인 사각형을 타일 좌표 가장자리(left, bottom)에 맞춰 놓는다 */
function placeRect(mesh: THREE.Mesh, left: number, bottom: number, w: number, h: number, z: number): void {
  mesh.position.set(left + w / 2, -(bottom - h / 2), z);
}

// 배경 한 장 — 문자 맵의 칸마다 Ninja Adventure 시트(tiles.ts 가 고른 16px 칸)를 32px 로 키워 찍은 맵 크기 캔버스.
// 물체도 같은 시트에서 잘라 쓴다. 캐릭터와 픽셀 밀도는 맞추지 않는다. 시트 세 장이 다 오기 전에는 비어 있다
const TILE_SHEET_DIR = `${import.meta.env.BASE_URL}assets/ninja-adventure/`;
const TILE_SHEET_FILE: Readonly<Record<Sheet, string>> = {
  floor: 'TilesetFloor.png',
  house: 'TilesetHouse.png',
  nature: 'TilesetNature.png',
};

/** 게임이 배정된 문인지 — 열린 문과 닫힌 문을 다르게 그린다 */
function isOpenDoor(p: Pos): boolean {
  const door = doorIndexAt(map, p);
  return door !== undefined && gameAtDoor(door, GAMES, DOOR_GAMES) !== undefined;
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error(`타일 시트를 불러오지 못했다: ${url}`)));
    img.src = url;
  });
}

function paintBackground(c: HTMLCanvasElement, sheets: Readonly<Record<Sheet, HTMLImageElement>>): void {
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  g.imageSmoothingEnabled = false;
  const draw = (cell: Cell, x: number, y: number): void => {
    g.drawImage(sheets[cell.sheet], cell.col * CELL_PX, cell.row * CELL_PX, CELL_PX, CELL_PX, x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
  };
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const look = tileLook(map, { x, y }, isOpenDoor);
      draw(look.base, x, y);
      if (look.over) draw(look.over, x, y);
    }
  }
}

/** 물체 그림 — 시트에서 sprite 칸부터 w×h 칸을 잘라 32px 칸으로 키워 찍는다 */
function paintObject(c: HTMLCanvasElement, o: MapObject, sheets: Readonly<Record<Sheet, HTMLImageElement>>): void {
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  g.imageSmoothingEnabled = false;
  const s = o.sprite;
  g.drawImage(sheets[s.sheet], s.col * CELL_PX, s.row * CELL_PX, o.w * CELL_PX, o.h * CELL_PX, 0, 0, c.width, c.height);
}

/** 맵 크기·물체 크기의 빈 캔버스 텍스처 — 시트가 오면 칠하고 needsUpdate */
function blankTexture(wTiles: number, hTiles: number): { readonly canvas: HTMLCanvasElement; readonly tex: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = wTiles * TILE_PX;
  canvas.height = hTiles * TILE_PX;
  return { canvas, tex: pixelTexture(canvas) };
}

const backgroundArt = blankTexture(map.width, map.height);
const objectArt = LOBBY_OBJECTS.map((o) => ({ o, ...blankTexture(o.w, o.h) }));

const SHEET_NAMES = Object.keys(TILE_SHEET_FILE) as Sheet[];
Promise.all(SHEET_NAMES.map((k) => loadImage(TILE_SHEET_DIR + TILE_SHEET_FILE[k])))
  .then((imgs) => {
    const sheets = Object.fromEntries(SHEET_NAMES.map((k, i) => [k, imgs[i]])) as Record<Sheet, HTMLImageElement>;
    paintBackground(backgroundArt.canvas, sheets);
    backgroundArt.tex.needsUpdate = true;
    for (const a of objectArt) {
      paintObject(a.canvas, a.o, sheets);
      a.tex.needsUpdate = true;
    }
  })
  .catch((e: unknown) => console.error(e));

const background = new THREE.Mesh(
  new THREE.PlaneGeometry(map.width, map.height),
  new THREE.MeshBasicMaterial({ map: backgroundArt.tex }),
);
placeRect(background, -0.5, map.height - 0.5, map.width, map.height, drawZ('background'));
scene.add(background);

// 물체 — 바닥·정렬·상단 층. 앞화면 층은 그릴 그림이 생기면 배경처럼 맵 크기 한 장으로 얹는다
checkObjects(map, LOBBY_OBJECTS);
const walkMap = withSolidObjects(map, LOBBY_OBJECTS); // 걷기 판정 — 맵의 벽 + 물체의 solid 칸
for (const { o, tex } of objectArt) {
  const r = objectRect(o);
  // alphaTest: 투명 픽셀은 버린다 — 물체 그림의 빈 곳이 뒤를 가리지 않게 (정렬 없이)
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshBasicMaterial({ map: tex, alphaTest: 0.5 }));
  placeRect(mesh, r.left, r.bottom, o.w, o.h, objectZ(o));
  scene.add(mesh);
}

// --- 캐릭터 -------------------------------------------------------------------
// 48×64 프레임(1.5×2칸), 발이 칸 아래 가운데. 지금은 방향마다 몸·머리·방향 점을 그린 임시 프레임

const AVATAR_W = AVATAR_PX.w / TILE_PX; // 칸
const AVATAR_H = AVATAR_PX.h / TILE_PX; // 칸

// 방에 들어가기 전(welcome 전) 내 몸 색. 들어간 뒤에는 남들 화면과 같게 colorFor(내 id)
const MY_BODY = '#5e81ac';

const HEAD = [10, 8, 28, 28] as const; // 머리 네모 x, y, w, h (프레임 픽셀)

function placeholderAvatar(facing: Dir, body: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = AVATAR_PX.w;
  c.height = AVATAR_PX.h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  g.fillStyle = body; // 몸
  g.fillRect(12, 34, 24, 26);
  g.fillStyle = '#e5c3a0'; // 머리 — 28×28 네모
  g.fillRect(HEAD[0], HEAD[1], HEAD[2], HEAD[3]);
  // 바라보는 쪽 표시 — 뒷모습(up)은 머리 전체를 머리카락 색으로
  g.fillStyle = '#3b2a20';
  // 눈 위치(가운데) — 정면은 두 눈, 옆모습은 보이는 쪽 한 눈
  const eyes: Readonly<Record<Dir, readonly (readonly [number, number])[] | undefined>> = {
    down: [[18, 24], [30, 24]], left: [[15, 22]], right: [[33, 22]], up: undefined,
  };
  const ps = eyes[facing];
  if (ps) {
    for (const p of ps) g.fillRect(p[0] - 2, p[1] - 3, 4, 6);
  } else {
    g.fillRect(HEAD[0], HEAD[1], HEAD[2], HEAD[3]);
  }
  return c;
}

// 몸 색마다 방향 4장 — 같은 색끼리 텍스처를 나눠 쓴다
const avatarTexCache = new Map<string, Readonly<Record<Dir, THREE.CanvasTexture>>>();

function avatarTextures(body: string): Readonly<Record<Dir, THREE.CanvasTexture>> {
  let tex = avatarTexCache.get(body);
  if (!tex) {
    tex = {
      up: pixelTexture(placeholderAvatar('up', body)),
      down: pixelTexture(placeholderAvatar('down', body)),
      left: pixelTexture(placeholderAvatar('left', body)),
      right: pixelTexture(placeholderAvatar('right', body)),
    };
    avatarTexCache.set(body, tex);
  }
  return tex;
}

const avatarGeo = new THREE.PlaneGeometry(AVATAR_W, AVATAR_H);
const MY_TEX = avatarTextures(MY_BODY);
const playerMat = new THREE.MeshBasicMaterial({ map: MY_TEX.down, alphaTest: 0.5 });
const player = new THREE.Mesh(avatarGeo, playerMat);
scene.add(player);

/** 타일 좌표 (x, y) 에 선 캐릭터를 놓는다 — 발 선으로 정렬 층 깊이를 정한다 */
function placeAvatar(mesh: THREE.Mesh, x: number, y: number): void {
  const foot = y + 0.5; // 칸 y 에 선 캐릭터의 발 선
  placeRect(mesh, x - AVATAR_W / 2, foot, AVATAR_W, AVATAR_H, drawZ('sorted', foot));
}

// 머리 위 — 말풍선(채팅 몇 초) + 이름표. 화면 글자라 DOM(textContent)으로 띄우고 매 프레임 머리 위로 옮긴다.
// 그림처럼 확대되어 번지지 않게
const tagPoint = new THREE.Vector3();

interface Head {
  readonly root: HTMLDivElement;
  readonly bubble: HTMLDivElement;
  readonly tag: HTMLDivElement;
}

function makeHead(name: string): Head {
  const root = document.createElement('div');
  root.className = 'hub-head';
  root.style.visibility = 'hidden'; // 첫 placeHead 전에 왼쪽 위에 한 프레임 보이지 않게
  const bubble = document.createElement('div');
  bubble.className = 'hub-bubble';
  bubble.hidden = true;
  const tag = document.createElement('div');
  tag.className = 'hub-tag';
  tag.textContent = name;
  root.append(bubble, tag);
  document.body.append(root);
  return { root, bubble, tag };
}

/** 이름표 글을 바꾼다 — 같은 글이면 DOM 을 건드리지 않는다 (syncViews 가 메시지마다 부른다) */
function setTag(head: Head, name: string): void {
  if (head.tag.textContent !== name) head.tag.textContent = name;
}

/** 말풍선 글을 바꾼다 — null 이면 내린다. 같은 글이면 DOM 을 건드리지 않는다 */
function setBubble(head: Head, text: string | null): void {
  if (text === null) {
    head.bubble.hidden = true;
    return;
  }
  if (head.bubble.textContent !== text) head.bubble.textContent = text;
  head.bubble.hidden = false;
}

function placeHead(head: Head, x: number, y: number): void {
  const headTop = -(y + 0.5 - AVATAR_H); // 월드 y — 발 선에서 캐릭터 키만큼 위
  tagPoint.set(x, headTop, 0).project(camera);
  const sx = ((tagPoint.x + 1) / 2) * window.innerWidth;
  const sy = ((1 - tagPoint.y) / 2) * window.innerHeight;
  head.root.style.transform = `translate(${sx}px, ${sy}px) translate(-50%, -100%)`;
  head.root.style.visibility = 'visible';
}

// 게임에서 돌아왔으면(hub_door) 들어갔던 문 앞에 선다. 주소창에서는 지워 새로고침하면 시작점에서 시작하게
const spawn = spawnFromSearch(map, location.search);
history.replaceState(history.state, '', withoutDoorParam(location.href));

let pos: Pos = spawn.pos; // 논리 위치 — 걷는 중이면 도착할 칸
let from: Pos = spawn.pos; // 걷기 시작한 칸
let t = 1; // from → pos 보간 진행도 (1 이면 정지)
let tapped: Dir | null = null; // 서 있을 때 누른 방향 — 다음 프레임 전에 떼어 버리는 짧은 탭도 한 칸 가게

/** 지금 걷는 한 칸(from → pos)에 걸리는 시간 — 대각선은 √2 배라 속도가 일정하다 */
function walkMs(): number {
  return STEP_MS * Math.hypot(pos.x - from.x, pos.y - from.y);
}
let facing: Dir = spawn.facing;
let leaving = false; // 게임으로 이동 중 — 페이지가 바뀔 때까지 입력·재입장을 막는다

// --- 게임 입장 (docs/game-entry-contract.md) ----------------------------------

/** 도착한 칸이 게임이 배정된 문이면 그 게임으로 페이지를 옮긴다 */
function enterIfDoor(p: Pos): void {
  const door = doorIndexAt(map, p);
  if (door === undefined) return;
  const game = gameAtDoor(door, GAMES, DOOR_GAMES);
  if (!game) return;
  const back = returnUrl(location.href, door); // URL 을 다 만든 뒤에 leaving — 여기서 던지면 입력이 굳지 않게
  const target = entryUrl(game.url, back, location.href, entered ?? undefined);
  leaving = true;
  // 현재 기록도 복귀 URL 로 바꿔 둔다 — 브라우저 뒤로 가기로 와도 문 앞에 서게
  history.replaceState(history.state, '', back);
  location.assign(target);
}

// 뒤로 가기로 bfcache 에서 되살아나면 문 위에 멈춘 상태 그대로다 — 문 앞으로 다시 세운다.
// 떠날 때 끊은 멀티도 다시 붙는다 (hello 가 문 앞 자리를 싣도록 자리를 먼저 고친 뒤)
window.addEventListener('pageshow', (e) => {
  if (!e.persisted) return;
  if (leaving) resetAfterReturn();
  if (entered && conn === null) startNet(entered);
});

function resetAfterReturn(): void {
  const back = spawnFromSearch(map, location.search);
  history.replaceState(history.state, '', withoutDoorParam(location.href));
  pos = from = back.pos;
  facing = back.facing;
  t = 1;
  held.length = 0;
  tapped = null;
  leaving = false;
}

// --- 멀티 (net.ts · others.ts) ------------------------------------------------
// 같은 방의 다른 사람을 그린다. 내 자리는 바뀔 때만 보낸다 (위치는 클라이언트 권위 — 결정 2026-10-09)

interface RemoteView {
  readonly mesh: THREE.Mesh;
  readonly mat: THREE.MeshBasicMaterial;
  readonly tex: Readonly<Record<Dir, THREE.CanvasTexture>>;
  readonly head: Head;
}

let others: Others = NO_OTHERS;
let netStatus: NetStatus = 'connecting';
let conn: Connection | null = null;
let lastSent = ''; // 마지막으로 보낸 자리 — 같은 자리를 또 보내지 않게
let setStatus: (text: string) => void = () => {};
let chatBox: ChatBox | null = null;
let bubbles: ReadonlyMap<string, Bubble> = new Map();
const views = new Map<string, RemoteView>();

function spotKey(s: Spot): string {
  return `${s.x},${s.y},${s.dir}`;
}

function here(): Spot {
  return { x: pos.x, y: pos.y, dir: facing };
}

/** 내 자리가 마지막으로 보낸 것과 다르면 보낸다 — 걷기 시작(도착할 칸)·방향 바뀜·문 앞 복귀 모두 여기로 */
function sendIfMoved(): void {
  const at = here();
  const key = spotKey(at);
  if (key === lastSent || netStatus !== 'open') return;
  lastSent = key;
  conn?.send({ t: 'move', at });
}

function refreshStatus(): void {
  setStatus(statusText(netStatus, others.players.size + 1));
}

/** others 명단에 맞춰 메시·이름표를 만들고 지우고, 바뀐 이름을 이름표에 옮긴다 */
function syncViews(): void {
  for (const [id, v] of views) {
    if (others.players.has(id)) continue;
    scene.remove(v.mesh);
    v.mat.dispose();
    v.head.root.remove();
    views.delete(id);
  }
  for (const [id, r] of others.players) {
    const view = views.get(id);
    if (view) {
      setTag(view.head, r.name);
      continue;
    }
    const tex = avatarTextures(colorFor(id));
    const mat = new THREE.MeshBasicMaterial({ map: tex[r.at.dir], alphaTest: 0.5 });
    const mesh = new THREE.Mesh(avatarGeo, mat);
    scene.add(mesh);
    views.set(id, { mesh, mat, tex, head: makeHead(r.name) });
  }
}

function startNet(e: Entered): void {
  conn?.close();
  others = NO_OTHERS;
  syncViews();
  conn = connect(
    location.href,
    e.room,
    () => {
      const at = here();
      lastSent = spotKey(at);
      // 이름은 지금 것 — 끊긴 사이 바꾼 이름도 다시 붙을 때 실린다
      return { t: 'hello', name: entered?.name ?? e.name, at };
    },
    (msg) => {
      if (msg.t === 'chat') {
        // 채팅은 명단을 바꾸지 않는다 — 채팅창 한 줄과 말풍선만
        const line = chatLine(msg, others, entered?.name ?? e.name);
        if (line) {
          chatBox?.add(line);
          bubbles = say(bubbles, msg.id, msg.text, performance.now());
        }
        return;
      }
      others = applyMsg(others, msg);
      syncViews();
      refreshStatus();
    },
    (s) => {
      netStatus = s;
      if (s === 'closed') {
        // 끊긴 뒤에는 다른 사람 자리를 알 수 없다 — 멈춘 유령을 남기지 않는다
        others = NO_OTHERS;
        syncViews();
      }
      refreshStatus();
    },
  );
}

// 페이지를 떠날 때(게임 입장·뒤로 가기) 바로 끊어 다른 사람 화면에서 곧장 사라지게.
// bfcache 로 되살아나면 pageshow 에서 다시 붙는다 (conn === null 이 「다시 붙어야 함」 표시)
window.addEventListener('pagehide', () => {
  conn?.close();
  conn = null;
  netStatus = 'closed';
  others = NO_OTHERS;
  syncViews();
});

// --- 방·이름 (room.ts) --------------------------------------------------------
// 방 코드와 이름이 정해지기 전에는 로비가 뒤에 그려지기만 하고 움직이지 않는다

let entered: Entered | null = null;
let myHead: Head | null = null;

function enterLobby(e: Entered): void {
  entered = e;
  // 주소창에 방 코드를 남겨 둔다 — 새로고침·게임 복귀 URL(returnUrl 이 location.href 를 쓴다)이 같은 방으로 오게
  history.replaceState(history.state, '', withRoom(location.href, e.room));
  setStatus = showRoomBadge(e, location.href, rename);
  myHead = makeHead(e.name);
  chatBox = showChatBox((text) => conn?.send({ t: 'chat', text }));
  startNet(e);
}

/** 배지에서 이름을 바꿨다 — 이 뒤의 채팅 줄·게임 입장(hub_name)·다시 붙을 때의 hello 가 새 이름을 쓴다 */
function rename(name: string): void {
  if (!entered) return;
  entered = { ...entered, name };
  if (myHead) setTag(myHead, name);
  conn?.send({ t: 'rename', name }); // 끊겨 있으면 보내지 않는다 — 다시 붙을 때 hello 가 싣는다
}

const urlRoom = roomFromSearch(location.search);
const savedName = loadName();
const screen = screenFor(urlRoom, savedName);
if (screen === 'lobby' && urlRoom !== null && savedName !== null) {
  enterLobby({ room: urlRoom, name: savedName });
} else if (screen !== 'lobby') {
  void showEntryScreen(screen, urlRoom, savedName).then(enterLobby);
}

// --- 입력 ---------------------------------------------------------------------
// 여러 키를 누르고 있으면 가장 나중에 누른 방향을 따른다 (쯔꾸르와 같은 감각)

/** 글자를 치는 중이면 방향키·WASD 를 가로채지 않는다 */
function isTyping(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
    || (target instanceof HTMLElement && target.isContentEditable);
}

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const held: Dir[] = [];

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl+S·Ctrl+D 같은 브라우저 단축키는 건드리지 않는다
  if (entered === null || isTyping(e.target)) return;
  if (e.key === 'Enter' && !leaving) {
    e.preventDefault();
    chatBox?.focus();
    return;
  }
  const dir = KEY_DIR[e.code];
  if (!dir) return;
  e.preventDefault();
  if (!held.includes(dir)) held.push(dir);
  if (e.repeat || leaving) return;
  // 누르는 즉시 돌아본다 (걷는 중이어도) — 여러 키가 눌려 있으면 좌우가 먼저
  facing = facingOf(held) ?? dir;
  if (t >= 1) {
    tapped = dir;
  } else if (reversesWalk(from, pos, dir)) {
    // 걷는 중 정반대 키 — 그 자리에서 돌아 출발한 칸으로 되돌아간다
    [from, pos] = [pos, from];
    t = 1 - t;
  }
});
window.addEventListener('keyup', (e) => {
  const dir = KEY_DIR[e.code];
  if (!dir) return;
  const i = held.indexOf(dir);
  if (i >= 0) held.splice(i, 1);
});
window.addEventListener('blur', () => { held.length = 0; tapped = null; }); // 포커스를 잃으면 키가 눌린 채로 남지 않게
// 맵을 누르면 입력 칸에서 빠져나온다 — 채팅 칸에 포커스가 남아 방향키가 먹지 않는 일이 없게
canvas.addEventListener('pointerdown', () => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
});

// --- 카메라 -------------------------------------------------------------------

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  const tileScreenPx = TILE_PX * VIEW_ZOOM;
  const halfY = h / tileScreenPx / 2;
  const halfX = w / tileScreenPx / 2;
  camera.left = -halfX;
  camera.right = halfX;
  camera.top = halfY;
  camera.bottom = -halfY;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

// --- 루프 ---------------------------------------------------------------------

let last = performance.now();
renderer.setAnimationLoop((now) => {
  const dt = Math.min(now - last, 100); // 탭 전환 뒤 한 번에 여러 칸 건너뛰지 않게
  last = now;

  // 한 칸을 끝내고 남은 시간은 다음 칸으로 넘긴다 — 버리면 프레임률에 따라 걷는 속도가 달라진다
  let carry = 0;
  if (t < 1) {
    t += dt / walkMs();
    if (t >= 1) {
      carry = (t - 1) * walkMs();
      t = 1;
      enterIfDoor(pos);
    }
  }
  if (t >= 1 && !leaving) {
    const r = stepHeld(walkMap, pos, held.length > 0 ? held : tapped ? [tapped] : []);
    tapped = null;
    if (r) {
      facing = r.facing;
      if (r.moved) {
        from = pos;
        pos = r.pos;
        t = Math.min(carry / walkMs(), 1);
      }
    }
  }

  if (entered && !leaving) sendIfMoved();

  const x = from.x + (pos.x - from.x) * t;
  const y = from.y + (pos.y - from.y) * t;
  placeAvatar(player, x, y);
  playerMat.map = (others.me === null ? MY_TEX : avatarTextures(colorFor(others.me)))[facing];

  others = advance(others, dt, STEP_MS);
  for (const [id, r] of others.players) {
    const v = views.get(id);
    if (!v) continue;
    const p = remotePos(r);
    placeAvatar(v.mesh, p.x, p.y);
    v.mat.map = v.tex[r.at.dir];
  }

  const viewX = camera.right - camera.left;
  camera.position.x = clampAxis(x, map.width, viewX);
  camera.position.y = -clampAxis(y, map.height, camera.top - camera.bottom);

  renderer.render(scene, camera);

  // 머리 위 글은 렌더 뒤에 — 카메라 행렬이 이번 프레임 위치로 갱신된 다음 화면 좌표로 옮긴다
  if (myHead) {
    setBubble(myHead, others.me === null ? null : bubbleText(bubbles, others.me, now));
    placeHead(myHead, x, y);
  }
  for (const [id, r] of others.players) {
    const v = views.get(id);
    if (!v) continue;
    const p = remotePos(r);
    setBubble(v.head, bubbleText(bubbles, id, now));
    placeHead(v.head, p.x, p.y);
  }
});
