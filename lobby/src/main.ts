// 로비 진입점 — 직교 카메라 위에 ZEP 식 층(배경 한 장·물체·캐릭터)을 그린다 (결정 2026-10-13: 직교 + 2D 스프라이트,
// 2026-10-14: ZEP 식 층). 에셋 전까지 그림은 임시 색. 월드 좌표: x = 타일 x, y = -타일 y (화면 위쪽이 맵 윗줄).
import * as THREE from 'three';
import { doorIndexAt, entryUrl, gameAtDoor, returnUrl, spawnFromSearch, withoutDoorParam } from './entry';
import { DOOR_GAMES, GAMES } from './games';
import { AVATAR_PX, drawZ, TILE_PX } from './layers';
import { LOBBY_OBJECTS } from './lobby-objects';
import { LOBBY_ROWS } from './lobby-map';
import { parseMap, type Pos, type Tile } from './map';
import { step, type Dir } from './movement';
import { checkObjects, objectRect, objectZ } from './objects';
import { clampAxis } from './view';

const VIEW_TILES_Y = 11; // 화면 세로에 보이는 타일 수
const STEP_MS = 160; // 한 칸 걷는 시간

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

// 배경 한 장 — 지금은 문자 맵을 칸마다 색칠한 임시 그림. 나중에 맵 크기 × 32px 그림 한 장으로 바꾼다
const TILE_COLOR: Readonly<Record<Tile, string>> = { wall: '#3b4252', floor: '#8fa36b', door: '#d08770' };
const FLOOR_ALT = '#86995f'; // 바닥 체크무늬 — 이동량을 눈으로 읽게

function placeholderBackground(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = map.width * TILE_PX;
  c.height = map.height * TILE_PX;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  for (let y = 0; y < map.height; y++) {
    for (let x = 0; x < map.width; x++) {
      const tile = map.tileAt({ x, y });
      g.fillStyle = tile === 'floor' && (x + y) % 2 === 1 ? FLOOR_ALT : TILE_COLOR[tile];
      g.fillRect(x * TILE_PX, y * TILE_PX, TILE_PX, TILE_PX);
    }
  }
  return c;
}

const background = new THREE.Mesh(
  new THREE.PlaneGeometry(map.width, map.height),
  new THREE.MeshBasicMaterial({ map: pixelTexture(placeholderBackground()) }),
);
placeRect(background, -0.5, map.height - 0.5, map.width, map.height, drawZ('background'));
scene.add(background);

// 물체 — 바닥·정렬·상단 층. 앞화면 층은 그릴 그림이 생기면 배경처럼 맵 크기 한 장으로 얹는다
checkObjects(map, LOBBY_OBJECTS);
for (const o of LOBBY_OBJECTS) {
  const r = objectRect(o);
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(o.w, o.h), new THREE.MeshBasicMaterial({ color: o.color }));
  placeRect(mesh, r.left, r.bottom, o.w, o.h, objectZ(o));
  scene.add(mesh);
}

// --- 캐릭터 -------------------------------------------------------------------
// 48×64 프레임(1.5×2칸), 발이 칸 아래 가운데. 지금은 방향마다 몸·머리·방향 점을 그린 임시 프레임

const AVATAR_W = AVATAR_PX.w / TILE_PX; // 칸
const AVATAR_H = AVATAR_PX.h / TILE_PX; // 칸

function placeholderAvatar(facing: Dir): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = AVATAR_PX.w;
  c.height = AVATAR_PX.h;
  const g = c.getContext('2d');
  if (!g) throw new Error('2d 캔버스를 만들 수 없다');
  g.fillStyle = '#5e81ac'; // 몸
  g.fillRect(12, 34, 24, 26);
  g.fillStyle = '#e5c3a0'; // 머리
  g.beginPath();
  g.arc(24, 22, 14, 0, Math.PI * 2);
  g.fill();
  // 바라보는 쪽 표시 — 뒷모습(up)은 머리 전체를 머리카락 색으로
  g.fillStyle = '#3b2a20';
  const eye: Readonly<Record<Dir, readonly [number, number] | undefined>> = {
    down: [24, 26], left: [15, 22], right: [33, 22], up: undefined,
  };
  const p = eye[facing];
  if (p) {
    g.fillRect(p[0] - 3, p[1] - 3, 6, 6);
  } else {
    g.beginPath();
    g.arc(24, 22, 14, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

const AVATAR_TEX: Readonly<Record<Dir, THREE.CanvasTexture>> = {
  up: pixelTexture(placeholderAvatar('up')),
  down: pixelTexture(placeholderAvatar('down')),
  left: pixelTexture(placeholderAvatar('left')),
  right: pixelTexture(placeholderAvatar('right')),
};
const playerMat = new THREE.MeshBasicMaterial({ map: AVATAR_TEX.down, alphaTest: 0.5 });
const player = new THREE.Mesh(new THREE.PlaneGeometry(AVATAR_W, AVATAR_H), playerMat);
scene.add(player);

// 게임에서 돌아왔으면(hub_door) 들어갔던 문 앞에 선다. 주소창에서는 지워 새로고침하면 시작점에서 시작하게
const spawn = spawnFromSearch(map, location.search);
history.replaceState(history.state, '', withoutDoorParam(location.href));

let pos: Pos = spawn.pos; // 논리 위치 — 걷는 중이면 도착할 칸
let from: Pos = spawn.pos; // 걷기 시작한 칸
let t = 1; // from → pos 보간 진행도 (1 이면 정지)
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
  const target = entryUrl(game.url, back, location.href);
  leaving = true;
  // 현재 기록도 복귀 URL 로 바꿔 둔다 — 브라우저 뒤로 가기로 와도 문 앞에 서게
  history.replaceState(history.state, '', back);
  location.assign(target);
}

// 뒤로 가기로 bfcache 에서 되살아나면 문 위에 멈춘 상태 그대로다 — 문 앞으로 다시 세운다
window.addEventListener('pageshow', (e) => {
  if (!e.persisted || !leaving) return;
  const back = spawnFromSearch(map, location.search);
  history.replaceState(history.state, '', withoutDoorParam(location.href));
  pos = from = back.pos;
  facing = back.facing;
  t = 1;
  held.length = 0;
  leaving = false;
});

// --- 입력 ---------------------------------------------------------------------
// 여러 키를 누르고 있으면 가장 나중에 누른 방향을 따른다 (쯔꾸르와 같은 감각)

const KEY_DIR: Record<string, Dir> = {
  ArrowUp: 'up', KeyW: 'up',
  ArrowDown: 'down', KeyS: 'down',
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
};
const held: Dir[] = [];

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return; // Ctrl+S·Ctrl+D 같은 브라우저 단축키는 건드리지 않는다
  const dir = KEY_DIR[e.code];
  if (!dir) return;
  e.preventDefault();
  if (!held.includes(dir)) held.push(dir);
});
window.addEventListener('keyup', (e) => {
  const dir = KEY_DIR[e.code];
  if (!dir) return;
  const i = held.indexOf(dir);
  if (i >= 0) held.splice(i, 1);
});
window.addEventListener('blur', () => { held.length = 0; }); // 포커스를 잃으면 키가 눌린 채로 남지 않게

// --- 카메라 -------------------------------------------------------------------

function resize(): void {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setSize(w, h, false);
  const halfY = VIEW_TILES_Y / 2;
  const halfX = halfY * (w / h);
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
    t += dt / STEP_MS;
    if (t >= 1) {
      carry = (t - 1) * STEP_MS;
      t = 1;
      enterIfDoor(pos);
    }
  }
  if (t >= 1 && !leaving) {
    const dir = held[held.length - 1];
    if (dir) {
      const r = step(map, pos, dir);
      facing = r.facing;
      if (r.moved) {
        from = pos;
        pos = r.pos;
        t = Math.min(carry / STEP_MS, 1);
      }
    }
  }

  const x = from.x + (pos.x - from.x) * t;
  const y = from.y + (pos.y - from.y) * t;
  const foot = y + 0.5; // 칸 y 에 선 캐릭터의 발 선
  placeRect(player, x - AVATAR_W / 2, foot, AVATAR_W, AVATAR_H, drawZ('sorted', foot));
  playerMat.map = AVATAR_TEX[facing];

  const viewX = camera.right - camera.left;
  camera.position.x = clampAxis(x, map.width, viewX);
  camera.position.y = -clampAxis(y, map.height, VIEW_TILES_Y);

  renderer.render(scene, camera);
});
