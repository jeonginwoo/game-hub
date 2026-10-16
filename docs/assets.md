# 로비 에셋 출처·라이선스

> 로비(`lobby/public/assets/`)에 들어온 외부 에셋은 모두 여기에 적는다. 라이선스를 확인하지 않은 파일은 넣지 않는다.
> 게임(`games/<이름>/`)의 에셋은 각 게임이 관리한다 — 여기 대상 아님.

## Ninja Adventure — Asset Pack

- **제작:** Pixel-boy · AAA
- **출처:** https://pixel-boy.itch.io/ninja-adventure-asset-pack (2026-10-13 받음, `Ninja Adventure - Asset Pack.zip`)
- **라이선스:** CC0 1.0 Universal — 팩 안의 `LICENSE.txt` 와 itch.io 페이지 양쪽에서 확인. 상업적 이용·수정·재배포 자유, 표기 의무 없음(제작자는 표기를 바람 — 이 문서가 그 표기)
- **위치:** `lobby/public/assets/ninja-adventure/` (원본 `LICENSE.txt` 동봉)

| 파일 | 원본 경로 | 쓰는 곳 |
|------|-----------|---------|
| `TilesetFloor.png` | `Backgrounds/Tilesets/TilesetFloor.png` | 바닥 풀 (`lobby/src/world/tiles.ts`) · 흙 마당 물체 (`lobby/src/data/object-art.ts`) |
| `TilesetHouse.png` | `Backgrounds/Tilesets/TilesetHouse.png` | 건물 정면·지붕·문 · 도리이 물체 |
| `TilesetNature.png` | `Backgrounds/Tilesets/TilesetNature.png` | 벽 덤불 · 나무 물체 |

시트 규격: 16×16 칸 — 로비 배경 캔버스에 32px(2×2 칸)로 2배 키운 크기로, 칸마다 한 조각씩 찍는다(캐릭터와 픽셀 밀도는 맞추지 않음, PROGRESS 결정 기록 2026-10-15). 캐릭터는 이 팩을 쓰지 않는다.
팩에는 캐릭터 90여 종·타일셋·UI·효과음이 더 있다 — 필요해지면 받은 원본에서 골라 이 표에 추가한다.
