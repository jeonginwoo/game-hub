// 로비 진입점 — 직교 카메라 위에 ZEP 식 층(배경 한 장·물체·캐릭터)을 그린다 (결정 2026-10-13: 직교 + 2D 스프라이트,
// 2026-10-14: ZEP 식 층). 배경·물체는 Ninja Adventure 타일(docs/assets.md), 캐릭터는 아직 임시 그림. 월드 좌표: x = 칸 x, y = -칸 y (화면 위쪽이 맵 윗줄).
// 칸은 타일(그림 32px)의 1/2 — 걷기·충돌만 잘게, 그림 크기는 그대로 (결정 2026-10-16: 칸 2배 밀도).
import * as THREE from 'three';
import type { Look, Spot } from '../../server/src/protocol';
import { buildRoom, type Room, type RoomData } from '../../server/src/room-map';
import { DEFAULT_ROOM, templateFor } from '../../server/src/room-templates';
import { avatarCanvas } from './avatar/avatar-art';
import { bubbleText, chatLine, say, type Bubble } from './chat/chat';
import { showChatBox, type ChatBox } from './chat/chat-box';
import { doorIndexAt, entryUrl, gameAtDoor, returnUrl, spawnFromSearch, withoutDoorParam } from './launch/entry';
import { loadName, loadRoomMap, saveRoomMap, showEntryScreen, type Entered } from './room/entry-screen';
import { GAMES } from './data/games';
import { noticeText, peopleCount, rosterRows } from './hud/hud';
import { loadLook, showHud, type Hud } from './hud/hud-bar';
import { AVATAR_PX, CELL_PX, drawZ } from './world/layers';
import { OBJECT_ART } from './data/object-art';
import { lookKey } from './avatar/look';
import { sameRoomData, TILE_CELLS, type Pos, type TileMap } from './world/map';
import { facingOf, reversesWalk, stepHeld, type Dir } from './world/movement';
import { connect, type Connection, type NetStatus } from './net/net';
import { objectRect, objectZ, withSolidObjects, type MapObject } from './world/objects';
import { advance, applyMsg, NO_OTHERS, remotePos, type Others } from './net/others';
import { homeUrl, roomFromSearch, screenFor, withRoom } from './room/room';
import { SHEET_PX, tileLook, type Cell, type Sheet } from './world/tiles';
import { clampAxis } from './world/view';

// 화면 배율 — 그림 1px 을 화면 몇 CSS px 로 (한 칸 = CELL_PX × VIEW_ZOOM). 창 크기와 상관없이 고정이라 창이 크면 더 넓게 보인다.
// 1.5 면 한 칸 24px·그림 타일 48px — 16px 타일(Ninja Adventure)은 원본 1px 이 화면 3px 로 고르다. 32px 기준 그림(임시 캐릭터)은 1.5배라 고르지 않다
const VIEW_ZOOM = 1.5;
const STEP_MS = 80; // 한 칸 걷는 시간 (대각선은 거리만큼 √2 배) — 칸이 타일의 1/2 라 걷는 속도는 타일 하나에 160ms 그대로

const canvas = document.querySelector<HTMLCanvasElement>('#app');
if (!canvas) throw new Error('#app 캔버스가 없다');

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

/** 크기 w×h(칸)인 사각형을 칸 좌표 가장자리(left, bottom)에 맞춰 놓는다 */
function placeRect(mesh: THREE.Mesh, left: number, bottom: number, w: number, h: number, z: number): void {
  mesh.position.set(left + w / 2, -(bottom - h / 2), z);
}

const TILE_SHEET_DIR = `${import.meta.env.BASE_URL}assets/ninja-adventure/`;
const TILE_SHEET_FILE: Readonly<Record<Sheet, string>> = {
  floor: 'TilesetFloor.png',
  house: 'TilesetHouse.png',
  nature: 'TilesetNature.png',
};

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener('load', () => resolve(img));
    img.addEventListener('error', () => reject(new Error(`타일 시트를 불러오지 못했다: ${url}`)));
    img.src = url;
  });
}

type Sheets = Readonly<Record<Sheet, HTMLImageElement>>;

function paintBackground(c: HTMLCanvasElement, room: Room, sheets: Sheets): void {
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  g.imageSmoothingEnabled = false;
  const map = room.map;
  // 열린 문(게임 배정)과 닫힌 문을 다르게 그린다
  const isOpenDoor = (door: number): boolean => gameAtDoor(door, GAMES, room.doorGames) !== undefined;
  const src = SHEET_PX / TILE_CELLS; // 칸 하나가 시트에서 차지하는 px — 그림 크기는 그대로, 칸마다 한 조각
  const draw = (cell: Cell, part: Pos, x: number, y: number): void => {
    g.drawImage(sheets[cell.sheet], cell.col * SHEET_PX + part.x * src, cell.row * SHEET_PX + part.y * src, src, src,
      x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
  };
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const look = tileLook(map, { x, y }, isOpenDoor);
      draw(look.base, look.part, x, y);
      if (look.over) draw(look.over, look.part, x, y);
    }
  }
}

/** 물체 그림 — 시트에서 sprite 칸부터 w×h 칸 넓이(시트 한 칸 = 타일 하나)를 잘라 타일 32px 로 키워 찍는다 */
function paintObject(c: HTMLCanvasElement, o: MapObject, sheets: Sheets): void {
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  g.imageSmoothingEnabled = false;
  const s = o.sprite;
  const cellSrc = SHEET_PX / TILE_CELLS; // 칸 하나가 시트에서 차지하는 px
  g.drawImage(sheets[s.sheet], s.col * SHEET_PX, s.row * SHEET_PX, o.w * cellSrc, o.h * cellSrc, 0, 0, c.width, c.height);
}

/** 맵 크기·물체 크기의 빈 캔버스 텍스처 — 시트가 오면 칠하고 needsUpdate */
function blankTexture(wCells: number, hCells: number): { readonly canvas: HTMLCanvasElement; readonly tex: THREE.CanvasTexture } {
  const canvas = document.createElement('canvas');
  canvas.width = wCells * CELL_PX;
  canvas.height = hCells * CELL_PX;
  return { canvas, tex: pixelTexture(canvas) };
}

// --- 월드 (방 데이터 → 배경·물체·걷기 판정) ---------------------------------------
// 방이 바뀌면(welcome 의 방이 지금 그린 방과 다르면) 통째로 버리고 다시 만든다 (결정 2026-10-16: 맵 템플릿 + 맵 선택)

interface World {
  readonly data: RoomData;
  readonly room: Room;
  /** 걷기 판정 — 맵의 벽 + 물체의 solid 칸 */
  readonly walkMap: TileMap;
  readonly meshes: readonly THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
  /** 시트가 오면(이미 와 있으면 바로) 배경·물체 캔버스를 칠한다 */
  readonly paint: (sheets: Sheets) => void;
}

/** 검사를 마친 방으로 월드를 만들어 장면에 넣는다 — buildRoom 이 던지면 아무것도 넣지 않는다 */
function buildWorld(data: RoomData): World {
  const room = buildRoom(data);
  const map = room.map;
  const objects: readonly MapObject[] = room.objects.map((o) => ({ ...o, ...OBJECT_ART[o.kind] }));

  // 배경 한 장 — 문자 맵의 칸마다 Ninja Adventure 시트(tiles.ts 가 고른 16px 칸)의 한 조각을 찍은 맵 크기 캔버스. 그림은 32px 로 키운 크기 그대로.
  // 물체도 같은 시트에서 잘라 쓴다. 캐릭터와 픽셀 밀도는 맞추지 않는다. 시트 세 장이 다 오기 전에는 비어 있다
  const backgroundArt = blankTexture(map.width, map.height);
  const background = new THREE.Mesh(new THREE.PlaneGeometry(map.width, map.height), new THREE.MeshBasicMaterial({ map: backgroundArt.tex }));
  placeRect(background, -0.5, map.height - 0.5, map.width, map.height, drawZ('background'));

  // 물체 — 바닥·정렬·상단 층. 앞화면 층은 그릴 그림이 생기면 배경처럼 맵 크기 한 장으로 얹는다
  const objectArt = objects.map((o) => {
    const art = blankTexture(o.w, o.h);
    const r = objectRect(o);
    // alphaTest: 투명 픽셀은 버린다 — 물체 그림의 빈 곳이 뒤를 가리지 않게 (정렬 없이)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshBasicMaterial({ map: art.tex, alphaTest: 0.5 }));
    placeRect(mesh, r.left, r.bottom, o.w, o.h, objectZ(o));
    return { o, ...art, mesh };
  });

  const meshes = [background, ...objectArt.map((a) => a.mesh)];
  for (const m of meshes) scene.add(m);

  const paint = (sheets: Sheets): void => {
    paintBackground(backgroundArt.canvas, room, sheets);
    backgroundArt.tex.needsUpdate = true;
    for (const a of objectArt) {
      paintObject(a.canvas, a.o, sheets);
      a.tex.needsUpdate = true;
    }
  };
  if (loadedSheets) paint(loadedSheets);
  return { data, room, walkMap: withSolidObjects(map, objects), meshes, paint };
}

function disposeWorld(w: World): void {
  for (const m of w.meshes) {
    scene.remove(m);
    m.geometry.dispose();
    m.material.map?.dispose();
    m.material.dispose();
  }
}

let loadedSheets: Sheets | null = null;

// 서버 없이·welcome 전에도 그릴 수 있게 기본 방으로 시작한다. 로비에 들어가면 고른·기억해 둔 맵, welcome 이 오면 그 방으로 바꾼다
let world: World = buildWorld(DEFAULT_ROOM);

const SHEET_NAMES = Object.keys(TILE_SHEET_FILE) as Sheet[];
Promise.all(SHEET_NAMES.map((k) => loadImage(TILE_SHEET_DIR + TILE_SHEET_FILE[k])))
  .then((imgs) => {
    loadedSheets = Object.fromEntries(SHEET_NAMES.map((k, i) => [k, imgs[i]])) as Record<Sheet, HTMLImageElement>;
    world.paint(loadedSheets);
  })
  .catch((e: unknown) => console.error(e));

// --- 캐릭터 -------------------------------------------------------------------
// 48×64 프레임(3×4칸), 발이 칸 아래 가운데. 그림은 avatar-art.ts 의 임시 코드 그림 — 외형마다 방향 4장

const AVATAR_W = AVATAR_PX.w / CELL_PX; // 칸
const AVATAR_H = AVATAR_PX.h / CELL_PX; // 칸

// 내 외형 — 저장값, 처음이면 무작위 (결정 2026-10-16: 캐릭터 꾸미기). 꾸미기 창에서 바뀐다
let myLook: Look = loadLook();

// 외형마다 방향 4장 — 같은 외형끼리 텍스처를 나눠 쓴다
const avatarTexCache = new Map<string, Readonly<Record<Dir, THREE.CanvasTexture>>>();

function avatarTextures(look: Look): Readonly<Record<Dir, THREE.CanvasTexture>> {
  const key = lookKey(look);
  let tex = avatarTexCache.get(key);
  if (!tex) {
    tex = {
      up: pixelTexture(avatarCanvas('up', look)),
      down: pixelTexture(avatarCanvas('down', look)),
      left: pixelTexture(avatarCanvas('left', look)),
      right: pixelTexture(avatarCanvas('right', look)),
    };
    avatarTexCache.set(key, tex);
  }
  return tex;
}

const avatarGeo = new THREE.PlaneGeometry(AVATAR_W, AVATAR_H);
const playerMat = new THREE.MeshBasicMaterial({ map: avatarTextures(myLook).down, alphaTest: 0.5 });
const player = new THREE.Mesh(avatarGeo, playerMat);
scene.add(player);

/** 칸 좌표 (x, y) 에 선 캐릭터를 놓는다 — 발 선으로 정렬 층 깊이를 정한다 */
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

// 게임에서 돌아왔으면(hub_door) 들어갔던 문 앞에 선다. 주소창에서는 지워 새로고침하면 시작점에서 시작하게.
// 처음 쿼리는 첫 welcome 까지 들고 있는다 — 받은 방으로 월드를 다시 만들면 그 맵에서 다시 문 앞을 찾는다
let arrivalSearch: string | null = location.search;
const spawn = spawnFromSearch(world.room.map, location.search);
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

/** 도착한 칸이 게임이 배정된 문 타일 안이면 그 게임으로 페이지를 옮긴다 */
function enterIfDoor(p: Pos): void {
  const door = doorIndexAt(world.room.map, p);
  if (door === undefined) return;
  const game = gameAtDoor(door, GAMES, world.room.doorGames);
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
  const back = spawnFromSearch(world.room.map, location.search);
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
  readonly lookKey: string; // tex 를 만든 외형 — look 메시지로 바뀌면 tex 를 바꾼다
  readonly head: Head;
}

let others: Others = NO_OTHERS;
let netStatus: NetStatus = 'connecting';
let conn: Connection | null = null;
let lastSent = ''; // 마지막으로 보낸 자리 — 같은 자리를 또 보내지 않게
// 이 방의 맵 템플릿 id — hello 에 실어 방이 없을 때 이 맵으로 만들게 한다. 고른 맵 → 기억해 둔 맵 → welcome 이 알려 준 맵
let roomMap: string | undefined;
let hud: Hud | null = null;
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

/** 버튼 줄(인원·접속자 목록·연결 알림)을 지금 상태로 */
function refreshStatus(): void {
  if (!hud || !entered) return;
  hud.update({
    count: peopleCount(netStatus, others),
    rows: rosterRows(others, entered.name, myLook),
    notice: noticeText(netStatus),
  });
}

/** others 명단에 맞춰 메시·이름표를 만들고 지우고, 바뀐 이름·외형을 옮긴다 */
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
      const key = lookKey(r.look);
      if (key !== view.lookKey) views.set(id, { ...view, tex: avatarTextures(r.look), lookKey: key });
      continue;
    }
    const tex = avatarTextures(r.look);
    const mat = new THREE.MeshBasicMaterial({ map: tex[r.at.dir], alphaTest: 0.5 });
    const mesh = new THREE.Mesh(avatarGeo, mat);
    scene.add(mesh);
    views.set(id, { mesh, mat, tex, lookKey: lookKey(r.look), head: makeHead(r.name) });
  }
}

/**
 * 월드를 이 방으로 바꾸고 그 맵에서 다시 등장한다 — search 에 hub_door 가 있으면 그 문 앞, 아니면 시작점.
 * 바뀐 자리는 루프의 sendIfMoved 가 move 로 보낸다. 지금 그린 방과 같으면 아무것도 하지 않는다.
 * 검사를 통과하지 못한 방은 콘솔에 남기고 지금 방 그대로 — 모두가 같은 맵이어야 하지만, 깨진 방으로는 걸을 수도 없다.
 * 지금 그려진 것이 이 방이면 true
 */
function switchRoom(data: RoomData, search: string): boolean {
  if (sameRoomData(data, world.data)) return true;
  let next: World;
  try {
    next = buildWorld(data);
  } catch (err) {
    console.error('방 데이터가 검사를 통과하지 못했다 — 지금 방 그대로', err);
    return false;
  }
  disposeWorld(world);
  world = next;
  const s = spawnFromSearch(world.room.map, search);
  pos = from = s.pos;
  facing = s.facing;
  t = 1;
  tapped = null;
  return true;
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
      return { t: 'hello', name: entered?.name ?? e.name, at, look: myLook, map: roomMap };
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
      if (msg.t === 'welcome') {
        // 그릴 수 있었던 방이면 그 맵을 기억한다 — 방이 비어 사라진 뒤 다시 만드는 hello 가 같은 맵을 싣게
        if (switchRoom(msg.room, arrivalSearch ?? '')) {
          roomMap = msg.map;
          saveRoomMap(e.room, msg.map);
        }
        arrivalSearch = null;
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
  // 방을 만들며 고른 맵, 아니면 이 탭이 기억해 둔 이 방의 맵으로 먼저 그린다 — welcome 이 다른 방을 보내면 그때 다시
  roomMap = e.map ?? loadRoomMap(e.room) ?? undefined;
  void switchRoom(templateFor(roomMap).room, arrivalSearch ?? ''); // 템플릿은 테스트가 검사를 통과시킨다
  // 주소창에 방 코드를 남겨 둔다 — 새로고침·게임 복귀 URL(returnUrl 이 location.href 를 쓴다)이 같은 방으로 오게
  history.replaceState(history.state, '', withRoom(location.href, e.room));
  hud = showHud({ room: e.room, name: e.name, look: myLook, lobbyHref: location.href, onRename: rename, onLook: changeLook,
    onLeave: leaveLobby,
    onOpen: () => {
      held.length = 0;
      tapped = null;
    },
  });
  refreshStatus();
  myHead = makeHead(e.name);
  chatBox = showChatBox((text) => conn?.send({ t: 'chat', text }));
  startNet(e);
}

/** 설정 창에서 이름을 바꿨다 — 이 뒤의 채팅 줄·게임 입장(hub_name)·다시 붙을 때의 hello 가 새 이름을 쓴다 */
function rename(name: string): void {
  if (!entered) return;
  entered = { ...entered, name };
  if (myHead) setTag(myHead, name);
  conn?.send({ t: 'rename', name }); // 끊겨 있으면 보내지 않는다 — 다시 붙을 때 hello 가 싣는다
  refreshStatus();
}

/** 꾸미기 창에서 외형을 바꿨다 — 내 캐릭터는 다음 프레임부터, 남에게는 look, 다시 붙을 때는 hello 가 싣는다 */
function changeLook(look: Look): void {
  myLook = look;
  conn?.send({ t: 'look', look });
  refreshStatus();
}

/** 설정 창 「로비 나가기」 — 첫 화면으로. 연결은 pagehide 가 끊는다. 저장된 이름은 남겨 다음 첫 화면에 채운다 */
function leaveLobby(): void {
  leaving = true;
  location.assign(homeUrl(location.href));
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
  // 접속자·설정 창이 열려 있으면 그 창이 키를 받는다(Esc 로 닫기) — 걷기·채팅으로 새지 않게
  if (entered === null || isTyping(e.target) || hud?.isOpen()) return;
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
  const cellScreenPx = CELL_PX * VIEW_ZOOM; // 월드 1 = 한 칸
  const halfY = h / cellScreenPx / 2;
  const halfX = w / cellScreenPx / 2;
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
    const r = stepHeld(world.walkMap, pos, held.length > 0 ? held : tapped ? [tapped] : []);
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
  playerMat.map = avatarTextures(myLook)[facing];

  others = advance(others, dt, STEP_MS);
  for (const [id, r] of others.players) {
    const v = views.get(id);
    if (!v) continue;
    const p = remotePos(r);
    placeAvatar(v.mesh, p.x, p.y);
    v.mat.map = v.tex[r.at.dir];
  }

  const viewX = camera.right - camera.left;
  camera.position.x = clampAxis(x, world.room.map.width, viewX);
  camera.position.y = -clampAxis(y, world.room.map.height, camera.top - camera.bottom);

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
