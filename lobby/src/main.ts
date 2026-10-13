// 로비 진입점 — 직교 카메라 위에 타일맵과 내 캐릭터를 그린다 (결정 2026-10-13: 직교 + 2D 스프라이트).
// 에셋 전까지 타일·캐릭터는 색 사각형. 월드 좌표: x = 타일 x, y = -타일 y (화면 위쪽이 맵 윗줄).
import * as THREE from 'three';
import { LOBBY_ROWS } from './lobby-map';
import { parseMap, type Pos, type Tile } from './map';
import { step, type Dir } from './movement';
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

// --- 타일맵 -------------------------------------------------------------------

const tileGeo = new THREE.PlaneGeometry(1, 1);
const tileMat: Record<Tile | 'floorAlt', THREE.MeshBasicMaterial> = {
  wall: new THREE.MeshBasicMaterial({ color: 0x3b4252 }),
  floor: new THREE.MeshBasicMaterial({ color: 0x8fa36b }),
  floorAlt: new THREE.MeshBasicMaterial({ color: 0x86995f }), // 바닥 체크무늬 — 이동량을 눈으로 읽게
  door: new THREE.MeshBasicMaterial({ color: 0xd08770 }),
};

for (let y = 0; y < map.height; y++) {
  for (let x = 0; x < map.width; x++) {
    const tile = map.tileAt({ x, y });
    const mat = tile === 'floor' && (x + y) % 2 === 1 ? tileMat.floorAlt : tileMat[tile];
    const mesh = new THREE.Mesh(tileGeo, mat);
    mesh.position.set(x, -y, 0);
    scene.add(mesh);
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

let pos: Pos = map.start; // 논리 위치 — 걷는 중이면 도착할 칸
let from: Pos = map.start; // 걷기 시작한 칸
let t = 1; // from → pos 보간 진행도 (1 이면 정지)
let facing: Dir = 'down';

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
    }
  }
  if (t >= 1) {
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
