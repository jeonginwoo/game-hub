// 방 데이터 — 문자 맵 + 물체 배치 + 문 배정, 그리고 그 해석·검사. 순수 모듈, node·DOM 을 import 하지 않는다 (로비 src/ 도 쓴다).
// 모두가 같은 맵으로 충돌을 판정해야 하므로 로비·서버가 같은 검사를 쓴다 (결정 2026-10-16: 방이 상태를 갖는다).
// 그림(시트 칸·층)은 로비 몫 — 방 데이터에는 물체 종류·자리와 게임 id 만 둔다 (결정 2026-10-16: 문 = 붙은 D 묶음 + 배정은 칸).
// 좌표는 칸 단위(16px), x 는 오른쪽, y 는 아래쪽(줄 번호)으로 증가한다.
import { OBJECT_SHAPES, type ObjectKind, type ObjectShape } from './object-shapes.ts';

export type Tile = 'wall' | 'floor' | 'door';

export interface Pos {
  readonly x: number;
  readonly y: number;
}

/** 문 하나 — 상하좌우로 붙은 'D' 칸 묶음. 자리는 묶음을 감싸는 사각형 */
export interface Door {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface TileMap {
  /** 칸 단위 크기 */
  readonly width: number;
  readonly height: number;
  /** 시작점 칸들 — 하나 이상, 등장할 때 그중 하나를 고른다 */
  readonly starts: readonly Pos[];
  /** 문들 — 번호는 맵을 위→아래, 왼→오른으로 훑어 처음 만난 순서 */
  readonly doors: readonly Door[];
  /** 맵 밖은 벽으로 본다 — 호출부가 경계 검사를 따로 하지 않아도 된다 */
  tileAt(p: Pos): Tile;
  /** 칸이 속한 문 번호, 문 칸이 아니면 undefined */
  doorAt(p: Pos): number | undefined;
}

// 'S'(시작점)는 바닥 위에 놓인 표식이라 타일로는 바닥
const LEGEND: Readonly<Record<string, Tile>> = { '#': 'wall', '.': 'floor', D: 'door', S: 'floor' };

const NEIGHBORS: readonly Pos[] = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** 문자 맵 — # 벽 · . 바닥 · D 문(붙은 D 칸 묶음이 문 하나) · S 시작점(하나 이상). 줄 길이는 모두 같아야 한다 */
export function parseMap(rows: readonly string[]): TileMap {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error('맵이 비어 있다');

  const tiles: Tile[] = [];
  const starts: Pos[] = [];

  rows.forEach((row, y) => {
    if (row.length !== width) throw new Error(`${y}번 줄 길이 ${row.length} — 첫 줄 길이 ${width} 와 다르다`);
    [...row].forEach((ch, x) => {
      const tile = LEGEND[ch];
      if (!tile) throw new Error(`(${x}, ${y}) 의 모르는 문자 '${ch}'`);
      tiles.push(tile);
      if (ch === 'S') starts.push({ x, y });
    });
  });
  if (starts.length === 0) throw new Error("시작점 'S' 가 하나 이상 있어야 한다");

  const inside = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < width && y < height;
  const tileAt = ({ x, y }: Pos): Tile => (inside(x, y) ? tiles[y * width + x] ?? 'wall' : 'wall');

  // 붙은 문 칸을 묶는다 — 훑는 순서대로 번호
  const doorIds: (number | undefined)[] = new Array<number | undefined>(width * height);
  const doors: Door[] = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (tileAt({ x, y }) !== 'door' || doorIds[y * width + x] !== undefined) continue;
      const id = doors.length;
      let [minX, minY, maxX, maxY] = [x, y, x, y];
      const stack: Pos[] = [{ x, y }];
      doorIds[y * width + x] = id;
      for (let p = stack.pop(); p; p = stack.pop()) {
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
        for (const d of NEIGHBORS) {
          const n = { x: p.x + d.x, y: p.y + d.y };
          if (tileAt(n) !== 'door' || doorIds[n.y * width + n.x] !== undefined) continue;
          doorIds[n.y * width + n.x] = id;
          stack.push(n);
        }
      }
      doors.push({ x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 });
    }
  }

  return {
    width,
    height,
    starts,
    doors,
    tileAt,
    doorAt: ({ x, y }) => (inside(x, y) ? doorIds[y * width + x] : undefined),
  };
}

// --- 물체 -----------------------------------------------------------------------

// 종류별 크기·막는 칸 표는 object-shapes.ts — 종류가 많아 따로 둔다
export { OBJECT_SHAPES, type ObjectKind, type ObjectShape };

/** 방 데이터 속 물체 하나 — 종류와 왼쪽 아래 칸만 */
export interface RoomObject {
  readonly id: string;
  readonly kind: ObjectKind;
  /** 왼쪽 아래 칸 — 물체는 여기서 오른쪽(w)·위쪽(h)으로 뻗는다. 발은 이 칸의 아래 선 */
  readonly x: number;
  readonly y: number;
}

/** 자리와 모양이 정해진 물체 — 검사·충돌은 이것만 본다 */
export interface PlacedShape extends ObjectShape {
  readonly id: string;
  readonly x: number;
  readonly y: number;
}

/** 칸 좌표의 가장자리 — 칸 중심이 정수라 칸 x 의 왼쪽 선은 x - 0.5 */
export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export function objectRect(o: PlacedShape): Rect {
  const bottom = o.y + 0.5;
  const left = o.x - 0.5;
  return { left, top: bottom - o.h, right: left + o.w, bottom };
}

/** 물체가 막는 칸들 */
export function solidCells(o: PlacedShape): Pos[] {
  return (o.solid ?? []).map((c) => ({ x: o.x + c.x, y: o.y - c.y }));
}

/**
 * 물체 목록 검사 — id 중복, 크기 0 이하, 맵 밖으로 나간 물체, 물체를 벗어나거나 문·시작점을 막는 solid,
 * 다른 물체의 solid 와 겹치는 solid 를 거부한다. 그림끼리 겹치거나 solid 가 맵의 '#' 위에 놓이는 것은 괜찮다
 */
export function checkObjects(map: TileMap, objects: readonly PlacedShape[]): void {
  const seen = new Set<string>();
  const solidOwner = new Map<string, string>();
  for (const o of objects) {
    if (seen.has(o.id)) throw new Error(`물체 id '${o.id}' 가 겹친다`);
    seen.add(o.id);
    if (o.w <= 0 || o.h <= 0) throw new Error(`물체 '${o.id}' 크기 ${o.w}×${o.h} — 0 보다 커야 한다`);
    const r = objectRect(o);
    if (r.left < -0.5 || r.top < -0.5 || r.right > map.width - 0.5 || r.bottom > map.height - 0.5) {
      throw new Error(`물체 '${o.id}' 가 맵 밖으로 나간다 — (${o.x}, ${o.y}) ${o.w}×${o.h}`);
    }
    for (const c of o.solid ?? []) {
      if (c.x < 0 || c.y < 0 || c.x >= o.w || c.y >= o.h) {
        throw new Error(`물체 '${o.id}' 의 solid 칸 (${c.x}, ${c.y}) — 물체 ${o.w}×${o.h} 안이어야 한다`);
      }
    }
    for (const p of solidCells(o)) {
      const isStart = map.starts.some((s) => s.x === p.x && s.y === p.y);
      if (map.tileAt(p) === 'door' || isStart) throw new Error(`물체 '${o.id}' 가 (${p.x}, ${p.y}) 의 문·시작점을 막는다`);
      const key = `${p.x},${p.y}`;
      const other = solidOwner.get(key);
      if (other !== undefined) throw new Error(`물체 '${o.id}' 의 solid 가 (${p.x}, ${p.y}) 에서 '${other}' 와 겹친다`);
      solidOwner.set(key, o.id);
    }
  }
}

// --- 방 -------------------------------------------------------------------------

/** 문에 게임 배정 — (x, y) 는 그 문의 아무 칸. 문 번호로 두면 맵을 고칠 때 번호가 밀린다 */
export interface DoorGame {
  readonly x: number;
  readonly y: number;
  /** 게임 id — URL 은 로비가 등록 표에서 찾는다. 방 데이터로 임의 URL 을 심지 못하게 */
  readonly game: string;
}

/** 방 하나의 데이터 — 서버가 들고 모두에게 같은 것을 보낸다 */
export interface RoomData {
  readonly rows: readonly string[];
  readonly objects: readonly RoomObject[];
  readonly doors: readonly DoorGame[];
}

/** 해석·검사를 마친 방 */
export interface Room {
  readonly map: TileMap;
  readonly objects: readonly (RoomObject & PlacedShape)[];
  /** 문 번호 → 게임 id. 배정 없는 문은 그냥 바닥이다 */
  readonly doorGames: Readonly<Record<number, string>>;
}

// 게임 id 형식 — docs/game-entry-contract.md 「게임 등록」
const GAME_ID_RE = /^[a-z0-9-]+$/;

export function isGameId(v: unknown): v is string {
  return typeof v === 'string' && GAME_ID_RE.test(v);
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isInt(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v);
}

export function isObjectKind(v: unknown): v is ObjectKind {
  return typeof v === 'string' && Object.hasOwn(OBJECT_SHAPES, v);
}

function parseRoomObject(v: unknown): RoomObject | null {
  if (!isRecord(v) || typeof v.id !== 'string' || !isObjectKind(v.kind) || !isInt(v.x) || !isInt(v.y)) return null;
  return { id: v.id, kind: v.kind, x: v.x, y: v.y };
}

function parseDoorGame(v: unknown): DoorGame | null {
  if (!isRecord(v) || !isInt(v.x) || !isInt(v.y) || typeof v.game !== 'string') return null;
  return { x: v.x, y: v.y, game: v.game };
}

/**
 * 받은 JSON 이 방 데이터 모양인지만 본다 — 하나라도 틀리면 null, 모르는 필드는 버린다.
 * 맵·물체·문 배정이 맞는지(겹침·문 칸 등)는 buildRoom 몫
 */
export function parseRoomData(v: unknown): RoomData | null {
  if (!isRecord(v) || !Array.isArray(v.rows) || !Array.isArray(v.objects) || !Array.isArray(v.doors)) return null;
  const rows: string[] = [];
  for (const r of v.rows) {
    if (typeof r !== 'string') return null;
    rows.push(r);
  }
  const objects: RoomObject[] = [];
  for (const o of v.objects) {
    const object = parseRoomObject(o);
    if (!object) return null;
    objects.push(object);
  }
  const doors: DoorGame[] = [];
  for (const d of v.doors) {
    const door = parseDoorGame(d);
    if (!door) return null;
    doors.push(door);
  }
  return { rows, objects, doors };
}

/** 방 데이터를 해석하고 검사한다 — 맵·물체·문 배정 중 하나라도 틀리면 throw */
export function buildRoom(data: RoomData): Room {
  const map = parseMap(data.rows);
  const objects = data.objects.map((o) => ({ ...OBJECT_SHAPES[o.kind], ...o }));
  checkObjects(map, objects);

  const doorGames: Record<number, string> = {};
  for (const d of data.doors) {
    const door = map.doorAt(d);
    if (door === undefined) throw new Error(`문 배정 (${d.x}, ${d.y}) 이 문 칸이 아니다`);
    if (doorGames[door] !== undefined) throw new Error(`문 ${door} 에 게임이 두 번 배정됐다 — (${d.x}, ${d.y})`);
    if (!isGameId(d.game)) throw new Error(`게임 id '${d.game}' — 영문 소문자·숫자·- 만`);
    doorGames[door] = d.game;
  }
  return { map, objects, doorGames };
}

/**
 * 칸 at 이 속한 문의 게임을 game 으로 바꾼 새 방 데이터 — null 이면 배정을 지운다. 그 문의 옛 배정은 어느 칸으로 적혔든 지운다.
 * 결과는 buildRoom 으로 검사한다 — at 이 문 칸이 아니거나 게임 id 형식이 틀리면 throw (결정 2026-10-16: 방장이 문마다 게임 고르기)
 */
export function assignDoor(data: RoomData, at: Pos, game: string | null): RoomData {
  const map = parseMap(data.rows);
  const door = map.doorAt(at);
  if (door === undefined) throw new Error(`(${at.x}, ${at.y}) 은 문 칸이 아니다`);
  const doors = data.doors.filter((d) => map.doorAt(d) !== door);
  const next: RoomData = { ...data, doors: game === null ? doors : [...doors, { x: at.x, y: at.y, game }] };
  buildRoom(next);
  return next;
}

/** 방 하나의 물체 수 상한 — 「물체 전시」 템플릿(종류마다 하나)이 들어가고도 넉넉하게. 방 데이터가 끝없이 커지지 않게 */
export const MAX_OBJECTS = 1000;

/** 놓은 물체의 id — p1, p2 … 중 아직 안 쓰인 가장 작은 번호. 템플릿의 id(종류 이름·tree-1 등)와 겹치지 않는다 */
function freeObjectId(objects: readonly RoomObject[]): string {
  const used = new Set(objects.map((o) => o.id));
  let n = 1;
  while (used.has(`p${n}`)) n++;
  return `p${n}`;
}

/**
 * 물체 하나를 놓은 새 방 데이터 — at 은 왼쪽 아래 칸, id 는 새로 붙인다. 결과는 buildRoom 으로 검사한다 —
 * 맵 밖·문/시작점을 막는 solid·다른 물체의 solid 와 겹치는 solid 이거나 MAX_OBJECTS 개가 이미 있으면 throw (결정 2026-10-16: 물체 배치 편집)
 */
export function placeObject(data: RoomData, kind: ObjectKind, at: Pos): RoomData {
  if (data.objects.length >= MAX_OBJECTS) throw new Error(`물체가 이미 ${MAX_OBJECTS} 개 — 더 놓을 수 없다`);
  const next: RoomData = { ...data, objects: [...data.objects, { id: freeObjectId(data.objects), kind, x: at.x, y: at.y }] };
  buildRoom(next);
  return next;
}

/** 칠할 수 있는 맵 글자 — parseMap 의 LEGEND 와 같은 넷 */
export type TileChar = '#' | '.' | 'D' | 'S';

export function isTileChar(v: unknown): v is TileChar {
  return typeof v === 'string' && Object.hasOwn(LEGEND, v);
}

/** 칠하기 전 문(at 이 속한 묶음)의 칸 중 칠한 뒤에도 문인 첫 칸 — 훑는 순서는 위→아래, 왼→오른. 문이 통째로 지워졌으면 undefined */
function remainingDoorCell(before: TileMap, after: TileMap, at: Pos): Pos | undefined {
  const id = before.doorAt(at);
  const d = id === undefined ? undefined : before.doors[id];
  if (!d) return undefined;
  for (let y = d.y; y < d.y + d.h; y++) {
    for (let x = d.x; x < d.x + d.w; x++) {
      if (before.doorAt({ x, y }) === id && after.doorAt({ x, y }) !== undefined) return { x, y };
    }
  }
  return undefined;
}

/**
 * 칸 at 의 맵 글자를 ch 로 바꾼 새 방 데이터. 문 배정은 따라간다 — 적힌 칸이 지워지면 그 문의 남은 칸으로 옮기고,
 * 문이 통째로 지워지면 버리고, 문이 붙어 하나가 되며 겹치면 먼저 적힌 것만 남긴다. 문 하나를 지우는 칠하기가 배정 때문에 막히지 않게. 결과는 buildRoom 으로 검사한다 — 맵 밖·이미 그 글자·마지막 시작점을 지움·
 * 물체의 solid 가 새 문/시작점을 막으면 throw (결정 2026-10-17: 타일 편집)
 */
export function paintTile(data: RoomData, at: Pos, ch: TileChar): RoomData {
  const row = data.rows[at.y];
  if (row === undefined || at.x < 0 || at.x >= row.length) throw new Error(`(${at.x}, ${at.y}) 은 맵 밖이다`);
  if (row[at.x] === ch) throw new Error(`(${at.x}, ${at.y}) 은 이미 '${ch}'`);
  const rows = data.rows.map((r, y) => (y === at.y ? r.slice(0, at.x) + ch + r.slice(at.x + 1) : r));
  const before = parseMap(data.rows);
  const map = parseMap(rows);
  const assigned = new Set<number>();
  const doors: DoorGame[] = [];
  for (const d of data.doors) {
    // 배정이 적힌 칸이 지워져도 그 문의 다른 칸이 남아 있으면 배정은 그 칸으로 옮긴다
    const cell = map.doorAt(d) !== undefined ? d : remainingDoorCell(before, map, d);
    const door = cell && map.doorAt(cell);
    if (cell === undefined || door === undefined || assigned.has(door)) continue;
    assigned.add(door);
    doors.push({ x: cell.x, y: cell.y, game: d.game });
  }
  const next: RoomData = { ...data, rows, doors };
  buildRoom(next);
  return next;
}

/** id 물체를 치운 새 방 데이터 — 없는 id 면 throw. 치워서 검사에 걸리는 방은 없으므로 buildRoom 은 다시 돌리지 않는다 */
export function removeObject(data: RoomData, id: string): RoomData {
  if (!data.objects.some((o) => o.id === id)) throw new Error(`물체 '${id}' 가 없다`);
  return { ...data, objects: data.objects.filter((o) => o.id !== id) };
}
