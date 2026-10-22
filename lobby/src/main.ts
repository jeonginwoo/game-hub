// 로비 진입점 — 직교 카메라 위에 ZEP 식 층(배경 한 장·물체·캐릭터)을 그린다 (결정 2026-10-13: 직교 + 2D 스프라이트,
// 2026-10-14: ZEP 식 층). 배경·물체는 Ninja Adventure 타일(docs/assets.md), 캐릭터는 아직 임시 그림. 월드 좌표: x = 칸 x, y = -칸 y (화면 위쪽이 맵 윗줄).
// 칸은 타일(그림 32px)의 1/2 — 걷기·충돌만 잘게, 그림 크기는 그대로 (결정 2026-10-16: 칸 2배 밀도).
import * as THREE from 'three';
import type { Look, Spot } from '../../server/src/protocol';
import { assignDoor, buildRoom, OBJECT_SHAPES, paintTile, placeObject, removeObject, type ObjectKind, type Room, type RoomData } from '../../server/src/room-map';
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
import { nearestFloor, sameRoomData, TILE_CELLS, withShutDoors, type Pos, type TileMap } from './world/map';
import { facingOf, reversesWalk, stepHeld, type Dir } from './world/movement';
import { connect, type Connection, type NetStatus } from './net/net';
import { objectRect, objectZ, withSolidObjects, type MapObject } from './world/objects';
import { advance, applyMsg, NO_OTHERS, remotePos, type Others } from './net/others';
import { homeUrl, roomFromSearch, screenFor, withRoom } from './room/room';
import { fillCell, SHEET_PX, type Sheet } from './world/tiles';
import { clampAxis, driftCenter, screenToCell } from './world/view';
import { canEdit, doorChoices, doorMarks } from './edit/edit';
import { createDoorPicker } from './edit/door-picker';
import { draftDirty, rebaseDraft } from './edit/draft';
import { createEditTools } from './edit/edit-tools';
import { canPlace, escStep, placeAt, topObjectAt } from './edit/place';
import { cellsBetween, paintCheck } from './edit/paint';

// 화면 배율 — 그림 1px 을 화면 몇 CSS px 로 (한 칸 = CELL_PX × VIEW_ZOOM). 창 크기와 상관없이 고정이라 창이 크면 더 넓게 보인다.
// 1.5 면 한 칸 24px·그림 타일 48px — 16px 타일(Ninja Adventure)은 원본 1px 이 화면 3px 로 고르다. 32px 기준 그림(임시 캐릭터)은 1.5배라 고르지 않다
const VIEW_ZOOM = 1.5;
// 첫 화면 뒤 배경만 더 크게 — 1.5 면 큰 창이 광장(48×34칸)보다 넓어 카메라가 흐를 자리가 없다. 3 이면 원본 1px 이 화면 6px 로 고르다
const BACKDROP_ZOOM = 3;
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
function placeRect(mesh: THREE.Object3D, left: number, bottom: number, w: number, h: number, z: number): void {
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

/**
 * 배경 한 장 — 바닥 층 물체를 방 데이터 순서대로(나중 것이 위) 찍는다. 문자 맵은 문까지 그리지 않아 그 밖은 투명 — 장면 바탕색이 보인다
 * (결정 2026-10-19: 문자 맵은 투명, 바닥은 물체 · 2026-10-21: 문도 투명). 바닥 물체를 메시 하나씩 두지 않고 한 장에 굽는다 — 채움으로 넓게 깔아도 메시가 늘지 않게
 */
function paintBackground(c: HTMLCanvasElement, floorObjects: readonly MapObject[], sheets: Sheets): void {
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  g.imageSmoothingEnabled = false;
  g.clearRect(0, 0, c.width, c.height);
  const tilePx = CELL_PX * TILE_CELLS;
  for (const o of floorObjects) {
    const left = o.x;
    const top = o.y - o.h + 1;
    if (o.fill) {
      // 채움 — 타일 하나씩, 자리마다 무늬를 고른다
      for (let ty = 0; ty < o.h / TILE_CELLS; ty++) {
        for (let tx = 0; tx < o.w / TILE_CELLS; tx++) {
          const x = left + tx * TILE_CELLS;
          const y = top + ty * TILE_CELLS;
          const cell = fillCell(o.fill, Math.floor(x / TILE_CELLS), Math.floor(y / TILE_CELLS));
          if (cell) g.drawImage(sheets[cell.sheet], cell.col * SHEET_PX, cell.row * SHEET_PX, SHEET_PX, SHEET_PX, x * CELL_PX, y * CELL_PX, tilePx, tilePx);
        }
      }
      continue;
    }
    const s = o.sprite;
    const cellSrc = SHEET_PX / TILE_CELLS;
    g.drawImage(sheets[s.sheet], s.col * SHEET_PX, s.row * SHEET_PX, o.w * cellSrc, o.h * cellSrc, left * CELL_PX, top * CELL_PX, o.w * CELL_PX, o.h * CELL_PX);
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
  /** 그리는 물체 — 치우기가 누른 칸의 맨 앞 물체를 고른다 */
  readonly objects: readonly MapObject[];
  readonly meshes: readonly THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>[];
  /** 편집 중에만 보이는 문 테두리 — 배정된 문·빈 문 다른 색 */
  readonly marks: THREE.Group;
  /** 칠하기 도구일 때만 보이는 칸 격자 + 벽·시작점 칠 — 문자 맵은 그림이 없어 평소엔 보이지 않는다 */
  readonly cellMarks: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  /** 시트가 오면(이미 와 있으면 바로) 배경·물체 캔버스를 칠한다 */
  readonly paint: (sheets: Sheets) => void;
}

/** 검사를 마친 방으로 월드를 만들어 장면에 넣는다 — buildRoom 이 던지면 아무것도 넣지 않는다 */
function buildWorld(data: RoomData): World {
  const room = buildRoom(data);
  const map = room.map;
  const objects: readonly MapObject[] = room.objects.map((o) => ({ ...o, ...OBJECT_ART[o.kind] }));

  // 배경 한 장 — 바닥 층 물체를 Ninja Adventure 시트에서 잘라 찍은 맵 크기 캔버스. 그림은 32px 로 키운 크기 그대로.
  // 캐릭터와 픽셀 밀도는 맞추지 않는다. 시트 세 장이 다 오기 전에는 비어 있다. 아무것도 없는 칸은 투명
  const floorObjects = objects.filter((o) => o.layer === 'floor');
  const backgroundArt = blankTexture(map.width, map.height);
  const background = new THREE.Mesh(
    new THREE.PlaneGeometry(map.width, map.height),
    new THREE.MeshBasicMaterial({ map: backgroundArt.tex, alphaTest: 0.5 }),
  );
  placeRect(background, -0.5, map.height - 0.5, map.width, map.height, drawZ('background'));

  // 물체 — 정렬·상단 층 (바닥 층은 배경에 구웠다). 앞화면 층은 그릴 그림이 생기면 배경처럼 맵 크기 한 장으로 얹는다
  const objectArt = objects.filter((o) => o.layer !== 'floor').map((o) => {
    const art = blankTexture(o.w, o.h);
    const r = objectRect(o);
    // alphaTest: 투명 픽셀은 버린다 — 물체 그림의 빈 곳이 뒤를 가리지 않게 (정렬 없이)
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshBasicMaterial({ map: art.tex, alphaTest: 0.5 }));
    placeRect(mesh, r.left, r.bottom, o.w, o.h, objectZ(o));
    return { o, ...art, mesh };
  });

  const cellMarks = buildCellMarks(map);
  cellMarks.visible = false; // 보이기는 updateEditView 가
  const meshes = [background, ...objectArt.map((a) => a.mesh), cellMarks];
  for (const m of meshes) scene.add(m);
  const marks = buildDoorMarks(room);
  marks.visible = false; // 보이기는 updateEditView 가 — 편집 중이고 문 도구일 때만
  scene.add(marks);

  const paint = (sheets: Sheets): void => {
    paintBackground(backgroundArt.canvas, floorObjects, sheets);
    backgroundArt.tex.needsUpdate = true;
    for (const a of objectArt) {
      paintObject(a.canvas, a.o, sheets);
      a.tex.needsUpdate = true;
    }
  };
  if (loadedSheets) paint(loadedSheets);
  // 닫힌 문(게임 없음)은 벽, 열린 문은 바닥 + 입장 (결정 2026-10-21: 문도 투명)
  const isOpenDoor = (door: number): boolean => gameAtDoor(door, GAMES, room.doorGames) !== undefined;
  const walkMap = withSolidObjects(withShutDoors(map, isOpenDoor), objects);
  return { data, room, walkMap, objects, meshes, marks, cellMarks, paint };
}

const CELL_MARK = 'rgba(236, 239, 244, 0.12)'; // 그 밖의 칸 — 투명한 문자 맵의 칸이 보이게
const WALL_MARK = 'rgba(191, 97, 106, 0.45)'; // 벽 '#'
const START_MARK = 'rgba(94, 129, 172, 0.6)'; // 시작점 'S'
const DOOR_MARK = 'rgba(235, 203, 139, 0.55)'; // 문 'D' — 문도 그림이 없어 칠하기에서만 보인다
const GRID_LINE = 'rgba(236, 239, 244, 0.35)'; // 칸 테두리

/** 칸마다 반투명 바탕(벽·시작점은 제 색) + 칸 테두리 격자를 그린 맵 크기 한 장 — 편집 표시 층 */
function buildCellMarks(map: TileMap): THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> {
  const art = blankTexture(map.width, map.height);
  const g = art.canvas.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const start = map.starts.some((p) => p.x === x && p.y === y);
      const tile = map.tileAt({ x, y });
      g.fillStyle = start ? START_MARK : tile === 'wall' ? WALL_MARK : tile === 'door' ? DOOR_MARK : CELL_MARK;
      g.fillRect(x * CELL_PX, y * CELL_PX, CELL_PX, CELL_PX);
    }
  }
  // 칸마다 위·왼쪽 1px 선 + 맵 오른쪽·아래 끝 선 — 이웃 칸과 겹쳐 두꺼워지지 않게
  g.fillStyle = GRID_LINE;
  const w = map.width * CELL_PX;
  const h = map.height * CELL_PX;
  for (let x = 0; x <= map.width; x++) g.fillRect(Math.min(x * CELL_PX, w - 1), 0, 1, h);
  for (let y = 0; y <= map.height; y++) g.fillRect(0, Math.min(y * CELL_PX, h - 1), w, 1);
  art.tex.needsUpdate = true;
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(map.width, map.height), new THREE.MeshBasicMaterial({ map: art.tex, transparent: true }));
  placeRect(mesh, -0.5, map.height - 0.5, map.width, map.height, drawZ('edit'));
  return mesh;
}

const OPEN_DOOR_COLOR = 0xa3be8c; // 게임이 배정된 문
const EMPTY_DOOR_COLOR = 0xebcb8b; // 빈 문

/** 문마다 반투명 칠 + 테두리 선 — 편집 표시 층(맨 앞) */
function buildDoorMarks(room: Room): THREE.Group {
  const group = new THREE.Group();
  for (const m of doorMarks(room, GAMES)) {
    const color = m.open ? OPEN_DOOR_COLOR : EMPTY_DOOR_COLOR;
    const fill = new THREE.Mesh(new THREE.PlaneGeometry(m.w, m.h), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.5 }));
    const hw = m.w / 2;
    const hh = m.h / 2;
    const edge = new THREE.LineLoop(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-hw, -hh, 0), new THREE.Vector3(hw, -hh, 0), new THREE.Vector3(hw, hh, 0), new THREE.Vector3(-hw, hh, 0),
      ]),
      new THREE.LineBasicMaterial({ color }),
    );
    for (const o of [fill, edge]) {
      placeRect(o, m.x - 0.5, m.y + m.h - 0.5, m.w, m.h, drawZ('edit'));
      group.add(o);
    }
  }
  return group;
}

function disposeWorld(w: World): void {
  for (const m of w.meshes) {
    scene.remove(m);
    m.geometry.dispose();
    m.material.map?.dispose();
    m.material.dispose();
  }
  scene.remove(w.marks);
  w.marks.traverse((o) => {
    if (!(o instanceof THREE.Mesh || o instanceof THREE.LineLoop)) return;
    o.geometry.dispose();
    const mats: THREE.Material[] = Array.isArray(o.material) ? o.material : [o.material];
    for (const mat of mats) mat.dispose();
  });
}

let loadedSheets: Sheets | null = null;
// 방장의 편집 모드 — 걷지 않고 맵의 문을 눌러 게임을 고른다 (결정 2026-10-16: 문 배정은 편집 모드에서 문을 눌러서)
let editing = false;
// 편집 초안 — 편집을 켤 때의 방에서 시작해 도구가 고치고, 「저장」 때 save 로 한 번에 보낸다. 편집 중이 아니면 null
// (결정 2026-10-21: 저장식 편집)
let draft: RoomData | null = null;
let editBase: RoomData = DEFAULT_ROOM; // 편집을 켤 때의 방 — 취소하면 이 방으로. 편집 중 room 이 오면 그 방으로 바꾼다
let draftShown = true; // 월드가 지금 초안을 그렸는지 — 칠하기 끌기가 칸마다 월드를 다시 만들지 않게 루프가 한 프레임에 한 번

// 서버 없이·welcome 전에도 그릴 수 있게 기본 방으로 시작한다. 로비에 들어가면 고른·기억해 둔 맵, welcome 이 오면 그 방으로 바꾼다
let world: World = buildWorld(DEFAULT_ROOM);

const SHEET_NAMES = Object.keys(TILE_SHEET_FILE) as Sheet[];
Promise.all(SHEET_NAMES.map((k) => loadImage(TILE_SHEET_DIR + TILE_SHEET_FILE[k])))
  .then((imgs) => {
    loadedSheets = Object.fromEntries(SHEET_NAMES.map((k, i) => [k, imgs[i]])) as Record<Sheet, HTMLImageElement>;
    world.paint(loadedSheets);
    editTools.refreshThumbs(); // 시트 전에 연 놓기 창은 빈 자리였다
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
player.visible = false; // 첫 화면 뒤 배경엔 내 캐릭터가 없다 — 로비에 들어가면 보인다

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

/** 월드 점 → 화면 점(CSS px, 왼쪽 위 기준) — 지금 카메라 행렬로 */
function toScreen(wx: number, wy: number): { readonly sx: number; readonly sy: number } {
  tagPoint.set(wx, wy, 0).project(camera);
  return { sx: ((tagPoint.x + 1) / 2) * window.innerWidth, sy: ((1 - tagPoint.y) / 2) * window.innerHeight };
}

function placeHead(head: Head, x: number, y: number): void {
  const headTop = -(y + 0.5 - AVATAR_H); // 월드 y — 발 선에서 캐릭터 키만큼 위
  const { sx, sy } = toScreen(x, headTop);
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
    notice: noticeText(netStatus, editing ? { tool: editTools.tool(), window: editTools.windowOpen(), dirty: isDirty() } : null),
    owner: canEdit(others),
    editing,
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
 * search 가 null 이면 자리 그대로 — room 메시지는 문 배정만 바꿔 지금 칸이 그대로 유효하다.
 * 바뀐 자리는 루프의 sendIfMoved 가 move 로 보낸다. 지금 그린 방과 같으면 아무것도 하지 않는다.
 * 검사를 통과하지 못한 방은 콘솔에 남기고 지금 방 그대로 — 모두가 같은 맵이어야 하지만, 깨진 방으로는 걸을 수도 없다.
 * 지금 그려진 것이 이 방이면 true
 */
function switchRoom(data: RoomData, search: string | null): boolean {
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
  updateEditView(); // 문 테두리 보이기·미리보기의 놓을 수 있는지가 새 방 기준으로
  if (search === null) {
    if (!editing) unstick(); // 편집 중엔 캐릭터가 숨어 있다 — 편집을 끌 때 본다
    return true;
  }
  const s = spawnFromSearch(world.room.map, search);
  pos = from = s.pos;
  facing = s.facing;
  t = 1;
  tapped = null;
  return true;
}

/**
 * 내 칸이 지금 걷기 판정에서 막혔으면 가장 가까운 바닥 칸(없으면 시작점)으로 — 바뀐 자리는 루프의 sendIfMoved 가 move 로.
 * 위치는 클라이언트 권위라 저장된 방을 받은 쪽이 제 자리만 고친다 (결정 2026-10-21: 저장식 편집 — 막힌 칸에 선 사람만)
 */
function unstick(): void {
  if (world.walkMap.tileAt(pos) !== 'wall') return;
  pos = from = nearestFloor(world.walkMap, pos) ?? spawnFromSearch(world.room.map, '').pos;
  t = 1;
  tapped = null;
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
      // 방장이 저장함 — 배경·물체·걷기 판정을 다시 만들고, 막힌 칸에 섰으면 옮긴다 (결정 2026-10-21: 저장식 편집)
      if (msg.t === 'room') {
        if (editing) {
          // 고친 초안은 그대로, 바뀐 것 없는 초안은 받은 방으로 — 취소하면 이 방으로
          draft = rebaseDraft(draft ?? msg.room, editBase, msg.room);
          editBase = msg.room;
          draftShown = false;
          editTools.setDirty(isDirty());
        } else {
          void switchRoom(msg.room, null);
        }
        doorPicker.close(); // 열린 목록의 「지금 것」 표시가 옛 배정이다
      }
      others = applyMsg(others, msg);
      syncViews();
      if (editing && !canEdit(others)) setEditing(false); // 방장이 넘어갔다 — 서버도 더는 내 door 를 받지 않는다
      refreshStatus();
    },
    (s) => {
      netStatus = s;
      if (s === 'closed') {
        // 끊긴 뒤에는 다른 사람 자리를 알 수 없다 — 멈춘 유령을 남기지 않는다
        others = NO_OTHERS;
        syncViews();
        setEditing(false); // 끊기면 고른 것을 보낼 수 없다
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

// --- 편집 모드 (edit.ts · place.ts) ----------------------------------------------
// 방장만. 켜면 걷기를 멈추고 가운데에 놓기 창(묶음 탭 + 썸네일), 아래쪽 가운데에 도구 줄(놓기·문·칠하기 + 저장·취소).
// 놓기: 창에서 고르면 창이 닫히고, 고른 물체의 반투명 미리보기가 포인터를 따라가며(놓을 수 없으면 밑에 빨간 칠) 누를 때마다 놓기.
// 오른쪽 클릭은 포인터 아래 맨 앞 물체 치우기. Esc 는 창을 다시, 창에서 Esc 면 편집 끝. 문: 맵의 문을 누르면 옆에 게임 목록 → 고르면 배정.
// 칠하기: 맵 전체에 칸 격자, 포인터 칸에 흰 테두리(칠할 수 없으면 빨간 칠), 누르거나 누른 채 끌면 지나간 칸마다 칠하기.
// 편집 중엔 캐릭터·머리 위 글·채팅창을 숨겨 맵만 보인다.
// 도구는 초안만 고친다(판정은 서버와 같은 room-map.ts 함수) — 「저장」 때 save 로 한 번에 보내고, 「취소」·연결 끊김·방장 넘어감이면 버린다.
// 바뀐 것이 있으면 Esc·편집 버튼으로는 끝나지 않는다
// (결정 2026-10-16: 물체 배치 편집 · 2026-10-17: 타일 편집 · 2026-10-21: 저장식 편집 · 편집 개편 B 놓기 창)

const doorPicker = createDoorPicker();
const editTools = createEditTools(() => {
  doorPicker.close();
  updateEditView();
  refreshStatus();
}, { onSave: saveEdit, onCancel: () => setEditing(false) }, (kind) => {
  if (!loadedSheets) return null;
  const shape = OBJECT_SHAPES[kind];
  const art = blankTexture(shape.w, shape.h);
  art.tex.dispose(); // 캔버스만 쓴다 — DOM 썸네일
  paintObject(art.canvas, { id: '', x: 0, y: 0, ...shape, ...OBJECT_ART[kind] }, loadedSheets);
  return art.canvas;
});

const RED_MARK_COLOR = 0xbf616a; // 놓을 수 없는 자리 · 칠할 수 없는 칸 — 그림에 색을 곱하면 초록 잎이 어두워지기만 해서 칠을 깐다

// 1×1 판을 물체 크기로 늘려 쓴다 — 미리보기는 고른 종류가 바뀔 때만 그림을 다시 칠한다
const previewMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.65, alphaTest: 0.1 });
const preview = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), previewMat);
const redMark = new THREE.Mesh(
  new THREE.PlaneGeometry(1, 1),
  new THREE.MeshBasicMaterial({ color: RED_MARK_COLOR, transparent: true, opacity: 0.45 }),
);
// 칠하기 붓이 닿을 칸 — 한 칸짜리 테두리
const cellFrame = new THREE.LineLoop(
  new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.5, -0.5, 0), new THREE.Vector3(0.5, -0.5, 0), new THREE.Vector3(0.5, 0.5, 0), new THREE.Vector3(-0.5, 0.5, 0),
  ]),
  new THREE.LineBasicMaterial({ color: 0xffffff }),
);
preview.renderOrder = cellFrame.renderOrder = 1; // 같은 편집 층 — 빨간 칠 위에 그림
preview.visible = redMark.visible = cellFrame.visible = false;
scene.add(preview, redMark, cellFrame);
/** 칠하기로 누른 채 끄는 중 — 마지막 칸(다음 칸까지 cellsBetween 으로 잇는다) */
let stroke: { last: Pos } | null = null;
let previewKind: ObjectKind | null = null; // 미리보기에 칠해 둔 종류 — 시트가 오기 전이면 null 로 남아 다시 칠한다
/** 편집 중 포인터가 든 칸 — 맵 밖으로 나가면 null */
let hoverCell: Pos | null = null;

function setEditing(on: boolean): void {
  const next = on && canEdit(others);
  if (!next) {
    doorPicker.close();
    hoverCell = null; // 다시 켤 때 옛 칸에 미리보기가 뜨지 않게
    stroke = null;
  }
  if (next === editing) return;
  editing = next;
  if (next) {
    editBase = draft = world.data;
    draftShown = true;
  } else {
    if (draft !== null) {
      // 저장하지 않고 끝 — 초안을 버리고 편집 전 방(편집 중 room 이 왔으면 그 방)으로
      draft = null;
      void switchRoom(editBase, null);
    }
    unstick(); // 편집 중 받은 방·저장한 방에서 내 칸이 막혔을 수 있다
  }
  editTools.setDirty(false);
  // 맵에만 집중하게 — 캐릭터는 루프가, 머리 위 글·채팅창은 CSS(.hub-editing)가 숨긴다
  document.body.classList.toggle('hub-editing', next);
  if (next && document.activeElement instanceof HTMLElement) document.activeElement.blur(); // 채팅 입력 칸에서 빠져나온다
  editTools.show(next);
  updateEditView();
  held.length = 0; // 켜는 순간 누르고 있던 방향키로 계속 걷지 않게
  tapped = null;
  refreshStatus();
}

/** 초안에 저장 안 한 바뀐 것이 있는지 */
function isDirty(): boolean {
  return draftDirty(draft, editBase);
}

/** 도구가 판정할 방 — 편집 중이면 초안(월드는 한 프레임 늦게 따라온다) */
function editData(): RoomData {
  return draft ?? world.data;
}

/** 초안 고치기 — change 가 던지면(놓을 수 없는 자리·이미 그 글자 등) 그대로. 월드는 루프의 flushDraft 가 다시 만든다 */
function editDraft(change: (data: RoomData) => RoomData): void {
  if (!draft) return;
  try {
    draft = change(draft);
  } catch {
    return;
  }
  draftShown = false;
  editTools.setDirty(isDirty());
  refreshStatus();
}

/** 초안이 월드보다 앞서 있으면 월드를 초안으로 — 프레임마다 한 번 */
function flushDraft(): void {
  if (!draft || draftShown) return;
  draftShown = true;
  void switchRoom(draft, null);
}

/** 「저장」 — 바뀐 것이 있으면 save. 화면은 저장한 초안 그대로 두고 편집을 끈다 — 같은 방이 room 으로 돌아오면 다시 그리지 않는다 */
function saveEdit(): void {
  if (!draft) return;
  if (isDirty()) conn?.send({ t: 'save', room: draft });
  flushDraft();
  editBase = draft;
  draft = null;
  setEditing(false);
}

/** 고른 종류의 그림을 미리보기 텍스처에 — 종류가 같고 이미 칠했으면 그대로 */
function paintPreview(kind: ObjectKind): void {
  if (kind === previewKind || !loadedSheets) return;
  const shape = OBJECT_SHAPES[kind];
  const art = blankTexture(shape.w, shape.h);
  paintObject(art.canvas, { id: '', x: 0, y: 0, ...shape, ...OBJECT_ART[kind] }, loadedSheets);
  previewMat.map?.dispose();
  previewMat.map = art.tex;
  previewMat.needsUpdate = true;
  previewKind = kind;
}

/** 크기 w×h 의 1×1 판(테두리)을 칸 가장자리(left, bottom)에 */
function placeScaled(mesh: THREE.Object3D, left: number, bottom: number, w: number, h: number): void {
  mesh.scale.set(w, h, 1);
  placeRect(mesh, left, bottom, w, h, drawZ('edit'));
}

/** 도구·포인터 칸·방이 바뀌면 — 문 테두리(문 도구일 때만), 놓기 미리보기, 칠할 칸 테두리. 놓기 창이 떠 있으면 맵 표시는 없다 */
function updateEditView(): void {
  const tool = editTools.tool();
  world.marks.visible = editing && tool === 'door';
  world.cellMarks.visible = editing && tool === 'paint';
  preview.visible = redMark.visible = cellFrame.visible = false;
  if (!editing || !hoverCell || editTools.windowOpen()) return;
  const kind = editTools.kind();
  if (tool === 'place' && kind) {
    paintPreview(kind);
    const at = placeAt(kind, hoverCell);
    const shape = OBJECT_SHAPES[kind];
    placeScaled(preview, at.x - 0.5, at.y + 0.5, shape.w, shape.h);
    preview.visible = true;
    if (!canPlace(editData(), kind, at)) {
      placeScaled(redMark, at.x - 0.5, at.y + 0.5, shape.w, shape.h);
      redMark.visible = true;
    }
  } else if (tool === 'paint') {
    placeScaled(cellFrame, hoverCell.x - 0.5, hoverCell.y + 0.5, 1, 1);
    cellFrame.visible = true;
    if (paintCheck(editData(), hoverCell, editTools.brush()) === 'no') {
      placeScaled(redMark, hoverCell.x - 0.5, hoverCell.y + 0.5, 1, 1);
      redMark.visible = true;
    }
  }
}

/** 칠하기 끌기가 cell 에 닿았다 — 마지막 칸부터 이어 지나간 칸마다 초안을 칠한다(이미 그 글자·칠할 수 없는 칸은 그대로) */
function paintTo(cell: Pos): void {
  if (!stroke) return;
  const ch = editTools.brush();
  for (const c of cellsBetween(stroke.last, cell)) editDraft((d) => paintTile(d, c, ch));
  stroke.last = cell;
}

/** 화면 점(CSS px) → 칸 */
function cellAt(sx: number, sy: number): Pos {
  return screenToCell(sx, sy, {
    w: window.innerWidth,
    h: window.innerHeight,
    cellPx: cellScreenPx(),
    center: { x: camera.position.x, y: -camera.position.y },
  });
}

/** 편집 중 포인터가 움직였다 — 다른 칸에 들어갔을 때만 다시 (놓을 수 있는지 검사가 방 전체를 본다) */
function hoverAt(cell: Pos | null): void {
  if (cell === hoverCell || (cell && hoverCell && cell.x === hoverCell.x && cell.y === hoverCell.y)) return;
  hoverCell = cell;
  updateEditView();
}

/** 편집 중 맵을 눌렀다 — 도구대로 */
function editAt(cell: Pos): void {
  if (editTools.windowOpen()) return; // 창 바탕이 맵을 덮지만 혹시 새어 들어와도
  const tool = editTools.tool();
  if (tool === 'door') {
    pickDoorAt(cell);
    return;
  }
  if (tool === 'place') {
    const kind = editTools.kind();
    if (!kind) return;
    const at = placeAt(kind, cell);
    editDraft((d) => placeObject(d, kind, at)); // 빨간 자리면 던져 그대로
    return;
  }
  if (tool === 'paint') {
    stroke = { last: cell };
    paintTo(cell);
  }
}

/** 놓는 중 오른쪽 클릭 — 포인터 아래 맨 앞 물체를 치운다 */
function removeAt(cell: Pos): void {
  if (editTools.windowOpen() || editTools.tool() !== 'place') return;
  const o = topObjectAt(world.objects, cell);
  if (o) editDraft((d) => removeObject(d, o.id));
}

/** 문 도구로 맵을 눌렀다 — 문이면 그 문 오른쪽 위에 게임 목록, 아니면 목록을 닫는다 */
function pickDoorAt(cell: Pos): void {
  const map = world.room.map;
  const door = map.doorAt(cell);
  const rect = door === undefined ? undefined : map.doors[door];
  if (door === undefined || !rect) {
    doorPicker.close();
    return;
  }
  const anchor = toScreen(rect.x + rect.w - 0.5, -(rect.y - 0.5));
  doorPicker.open(anchor.sx, anchor.sy, doorChoices(door, GAMES, world.room.doorGames), (game) => {
    // 문의 아무 칸이나 — assignDoor 가 문 하나로 묶는다
    editDraft((d) => assignDoor(d, cell, game));
  });
}

// --- 방·이름 (room.ts) --------------------------------------------------------
// 방 코드와 이름이 정해지기 전에는 로비가 뒤에 그려지기만 하고 움직이지 않는다

let entered: Entered | null = null;
let myHead: Head | null = null;

function enterLobby(e: Entered): void {
  entered = e;
  // 첫 화면 뒤 배경이 끝났다 — 내 캐릭터가 나타나고 카메라는 로비 배율로 캐릭터를 따라간다
  resize();
  // 방을 만들며 고른 맵, 아니면 이 탭이 기억해 둔 이 방의 맵으로 먼저 그린다 — welcome 이 다른 방을 보내면 그때 다시
  roomMap = e.map ?? loadRoomMap(e.room) ?? undefined;
  void switchRoom(templateFor(roomMap).room, arrivalSearch ?? ''); // 템플릿은 테스트가 검사를 통과시킨다
  // 주소창에 방 코드를 남겨 둔다 — 새로고침·게임 복귀 URL(returnUrl 이 location.href 를 쓴다)이 같은 방으로 오게
  history.replaceState(history.state, '', withRoom(location.href, e.room));
  hud = showHud({ room: e.room, name: e.name, look: myLook, lobbyHref: location.href, onRename: rename, onLook: changeLook,
    onLeave: leaveLobby,
    // 바뀐 것이 있으면 끄지 않는다 — 알림이 저장·취소를 가리킨다
    onEdit: () => {
      if (!editing) setEditing(true);
      else if (!isDirty()) setEditing(false);
    },
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
  // 맵을 고르면 뒤 배경도 그 맵 — 숨은 내 자리도 그 맵 시작점으로 옮겨 둔다. 같은 맵으로 들어가면
  // enterLobby 의 switchRoom 이 아무것도 하지 않아, 앞 맵의 자리가 그대로 남기 때문이다
  const preview = (id: string): void => void switchRoom(templateFor(id).room, '');
  void showEntryScreen(screen, urlRoom, savedName, preview).then(enterLobby);
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
  // 버튼 줄 창을 닫은 Esc 는 넘긴다(defaultPrevented). 목록이 열려 있으면 목록만, 아니면 편집 모드를 끝낸다
  if (e.key === 'Escape' && editing && !e.defaultPrevented) {
    // 한 단계씩 — 게임 목록 → 놓기 창 → 편집 끝. 바뀐 것이 있으면 끝내지 않는다 — 알림이 저장·취소를 가리킨다
    const step = escStep({ doorList: doorPicker.isOpen(), window: editTools.windowOpen(), dirty: isDirty() });
    if (step === 'close-door-list') doorPicker.close();
    else if (step === 'open-window') editTools.openWindow();
    else if (step === 'end') setEditing(false);
    return;
  }
  if (e.key === 'Enter' && !leaving && !editing) { // 편집 중엔 채팅창이 숨어 있다
    e.preventDefault();
    chatBox?.focus();
    return;
  }
  const dir = KEY_DIR[e.code];
  if (!dir || editing) return; // 편집 중에는 걷지 않는다
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
canvas.addEventListener('pointerdown', (e) => {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  if (!editing) return;
  if (e.button === 0) editAt(cellAt(e.clientX, e.clientY));
  else if (e.button === 2) removeAt(cellAt(e.clientX, e.clientY));
});
// 편집 중 오른쪽 클릭은 치우기 — 브라우저 메뉴를 띄우지 않는다
canvas.addEventListener('contextmenu', (e) => {
  if (editing) e.preventDefault();
});
canvas.addEventListener('pointermove', (e) => {
  if (!editing) return;
  const cell = cellAt(e.clientX, e.clientY);
  hoverAt(cell);
  if (stroke && editTools.tool() === 'paint') paintTo(cell);
});
canvas.addEventListener('pointerleave', () => {
  hoverAt(null);
  stroke = null; // 도구 줄·창 위로 끌고 나가면 끌기 끝 — 돌아와도 그 사이 칸을 잇지 않는다
});
for (const ev of ['pointerup', 'pointercancel', 'blur'] as const) window.addEventListener(ev, () => { stroke = null; });

// --- 카메라 -------------------------------------------------------------------

/** 한 칸이 화면 몇 CSS px — 로비에 들어가기 전(첫 화면 뒤 배경)과 뒤가 다르다 */
function cellScreenPx(): number {
  return CELL_PX * (entered ? VIEW_ZOOM : BACKDROP_ZOOM);
}

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  const halfY = h / cellScreenPx() / 2; // 월드 1 = 한 칸
  const halfX = w / cellScreenPx() / 2;
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
  flushDraft();

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
  if (t >= 1 && !leaving && !editing) {
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
  player.visible = entered !== null && !editing; // 첫 화면 뒤 배경·편집 중엔 캐릭터 없이

  others = advance(others, dt, STEP_MS);
  for (const [id, r] of others.players) {
    const v = views.get(id);
    if (!v) continue;
    const p = remotePos(r);
    placeAvatar(v.mesh, p.x, p.y);
    v.mat.map = v.tex[r.at.dir];
    v.mesh.visible = !editing;
  }

  const viewX = camera.right - camera.left;
  const viewY = camera.top - camera.bottom;
  const center = entered
    ? { x: clampAxis(x, world.room.map.width, viewX), y: clampAxis(y, world.room.map.height, viewY) }
    : driftCenter(now, { w: world.room.map.width, h: world.room.map.height }, { w: viewX, h: viewY });
  camera.position.x = center.x;
  camera.position.y = -center.y;

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
