// 캐릭터 외형 — 부위별 선택지 표(색·이름), 무작위 첫 외형, 선택지 넘기기, 저장값 해석. Three.js·DOM 과 무관한 순수 함수.
// 외형은 번호로만 오가고 색·그림은 여기서 정한다 (결정 2026-10-16: 캐릭터 꾸미기). 로비 안에서만 쓴다 — 입장 계약으로 넘기지 않는다
import { LOOK_CHOICES, parseLook, type Look, type LookPart } from '../../../server/src/protocol';

export interface Choice {
  readonly label: string;
  readonly color?: string; // 색 부위만 — 꾸미기 창의 견본과 그림에 쓴다
}

/** 부위별 선택지 — 길이는 LOOK_CHOICES 와 같아야 한다. 모자·수염의 0 은 「없음」 */
export const LOOK_TABLE: Readonly<Record<LookPart, readonly Choice[]>> = {
  body: [
    { label: '파랑', color: '#5e81ac' },
    { label: '빨강', color: '#bf616a' },
    { label: '초록', color: '#a3be8c' },
    { label: '보라', color: '#b48ead' },
    { label: '주황', color: '#d08770' },
    { label: '하늘', color: '#88c0d0' },
    { label: '노랑', color: '#ebcb8b' },
    { label: '회색', color: '#4c566a' },
  ],
  hair: [
    { label: '갈색', color: '#3b2a20' },
    { label: '검정', color: '#1b1b1f' },
    { label: '밤색', color: '#8a5a2b' },
    { label: '금색', color: '#d8b45a' },
    { label: '은색', color: '#b0b4bb' },
  ],
  hat: [{ label: '없음' }, { label: '캡' }, { label: '비니' }, { label: '밀짚모자' }],
  beard: [{ label: '없음' }, { label: '콧수염' }, { label: '턱수염' }],
};

/** 꾸미기 창의 줄 순서와 제목 */
export const LOOK_PARTS: readonly (readonly [LookPart, string])[] = [
  ['body', '몸 색'],
  ['hair', '머리 색'],
  ['hat', '모자'],
  ['beard', '수염'],
];

/** 0 이상 1 미만을 돌려주는 난수 — 테스트에서 고정값을 넣는다 */
export type Rand = () => number;

function pick(count: number, rand: Rand): number {
  return Math.min(count - 1, Math.floor(rand() * count));
}

/** 처음 온 사람의 외형 — 몸·머리 색만 무작위, 모자·수염은 없음 (모두 같은 기본값이면 서로 구별이 안 된다) */
export function randomLook(rand: Rand): Look {
  return { body: pick(LOOK_CHOICES.body, rand), hair: pick(LOOK_CHOICES.hair, rand), hat: 0, beard: 0 };
}

/** 부위 하나를 delta 칸 넘긴 새 외형 — 끝에서 처음으로 돈다 */
export function cycleLook(look: Look, part: LookPart, delta: number): Look {
  const n = LOOK_CHOICES[part];
  return { ...look, [part]: (((look[part] + delta) % n) + n) % n };
}

/** 저장된 문자열의 외형. 없거나 틀리면 무작위 (저장값이 옛 형식이거나 손으로 고친 경우) */
export function lookFromStorage(raw: string | null, rand: Rand): Look {
  if (raw === null) return randomLook(rand);
  try {
    return parseLook(JSON.parse(raw)) ?? randomLook(rand);
  } catch {
    return randomLook(rand);
  }
}

/** 같은 외형끼리 텍스처를 나눠 쓰는 열쇠 */
export function lookKey(look: Look): string {
  return `${look.body}.${look.hair}.${look.hat}.${look.beard}`;
}

export function choiceOf(look: Look, part: LookPart): Choice {
  return LOOK_TABLE[part][look[part]] ?? { label: '?' };
}

/** 몸 색 — 접속자 목록의 점도 이 색 */
export function bodyColor(look: Look): string {
  return choiceOf(look, 'body').color ?? '#5e81ac';
}

/** 머리카락·수염 색 */
export function hairColor(look: Look): string {
  return choiceOf(look, 'hair').color ?? '#3b2a20';
}
