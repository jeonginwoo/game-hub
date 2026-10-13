// 로비 진입점 — 직교 카메라 위에 타일맵과 내 캐릭터를 그린다 (결정 2026-10-13: 직교 + 2D 스프라이트).
// 타일은 Ninja Adventure 스프라이트 시트 (CC0, docs/assets.md), 캐릭터는 아직 색 사각형. 월드 좌표: x = 타일 x, y = -타일 y (화면 위쪽이 맵 윗줄).
import * as THREE from 'three';
import { doorIndexAt, entryUrl, gameAtDoor, returnUrl, spawnFromSearch, withoutDoorParam } from './entry';
import { DOOR_GAMES, GAMES } from './games';
import { LOBBY_ROWS } from './lobby-map';
import { parseMap, type Pos } from './map';
import { step, type Dir } from './movement';
import { cellUv, tileLook, type Cell, type Sheet } from './tiles';
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

// --- 스프라이트 시트 -----------------------------------------------------------

const ASSET_DIR = `${import.meta.env.BASE_URL}assets/ninja-adventure/`;
// 크기는 원본 PNG 그대로 — UV 를 텍스처 로드 전에 계산하려고 적어 둔다
const SHEETS: Record<Sheet, { file: string; w: number; h: number }> = {
  floor: { file: 'TilesetFloor.png', w: 352, h: 417 },
  house: { file: 'TilesetHouse.png', w: 528, h: 368 },
  nature: { file: 'TilesetNature.png', w: 384, h: 336 },
};

const loader = new THREE.TextureLoader();
/** 픽셀아트 텍스처 — 확대해도 번지지 않게 최근접 샘플링, 밉맵 없음 */
function pixelTexture(file: string): THREE.Texture {
  const tex = loader.load(ASSET_DIR + file);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// alphaTest: 투명 픽셀은 버린다 — 덤불의 배경이 아래층을 가리지 않게 (정렬 없이)
const sheetMat = Object.fromEntries(
  (Object.keys(SHEETS) as Sheet[]).map((k) => [
    k,
    new THREE.MeshBasicMaterial({ map: pixelTexture(SHEETS[k].file), alphaTest: 0.5 }),
  ]),
) as Record<Sheet, THREE.MeshBasicMaterial>;

/** 시트의 한 칸을 그리는 1×1 평면 */
function cellMesh(cell: Cell): THREE.Mesh {
  const { w, h } = SHEETS[cell.sheet];
  const { u0, u1, vTop, vBottom } = cellUv(cell.col, cell.row, w, h);
  const geo = new THREE.PlaneGeometry(1, 1);
  // PlaneGeometry 정점 순서: 왼위 · 오른위 · 왼아래 · 오른아래
  geo.setAttribute('uv', new THREE.Float32BufferAttribute([u0, vTop, u1, vTop, u0, vBottom, u1, vBottom], 2));
  return new THREE.Mesh(geo, sheetMat[cell.sheet]);
}

// --- 타일맵 -------------------------------------------------------------------

/** 게임이 배정된 문인지 — 열린 문과 닫힌 문을 다르게 그린다 */
function isOpenDoor(p: Pos): boolean {
  const door = doorIndexAt(map, p);
  return door !== undefined && gameAtDoor(door, GAMES, DOOR_GAMES) !== undefined;
}

for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const look = tileLook(map, { x, y }, isOpenDoor);
    const base = cellMesh(look.base);
    base.position.set(x, -y, 0);
    scene.add(base);
    if (look.over) {
      const over = cellMesh(look.over);
      over.position.set(x, -y, 0.5);
      scene.add(over);
    }
  }
}

// --- 캐릭터 -------------------------------------------------------------------

const player = new THREE.Group();
const body = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.7), new THREE.MeshBasicMaterial({ color: 0x5e81ac }));
// 바라보는 방향 표시 — 기본은 오른쪽(+x)을 가리키고 facing 에 맞춰 돌린다
const nose = new THREE.Mesh(
  new THREE.CircleGeometry(0.16, 3),
  new THREE.MeshBasicMaterial({ color: 0xeceff4 }),
);
nose.position.x = 0.22;
const noseHolder = new THREE.Group();
noseHolder.add(nose);
player.add(body, noseHolder);
player.position.z = 1;
scene.add(player);

const FACING_ANGLE: Record<Dir, number> = { right: 0, up: Math.PI / 2, left: Math.PI, down: -Math.PI / 2 };

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
  player.position.set(x, -y, 1);
  noseHolder.rotation.z = FACING_ANGLE[facing];

  const viewX = camera.right - camera.left;
  camera.position.x = clampAxis(x, map.width, viewX);
  camera.position.y = -clampAxis(y, map.height, VIEW_TILES_Y);

  renderer.render(scene, camera);
});
