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
| `TilesetFloor.png` | `Backgrounds/Tilesets/TilesetFloor.png` | 바닥은 모두 물체 (`lobby/src/data/object-art.ts`) — 그림 있는 칸 전부(458개, `floor-열-줄`) · 칸 하나를 되풀이하는 채움 14개 · 흙 마당 |
| `TilesetHouse.png` | `Backgrounds/Tilesets/TilesetHouse.png` | 문 (`lobby/src/world/tiles.ts`) · 건물 줄 지붕·정면 물체 · 혼자 서 있는 그림을 물체로 (건물 통째·석상·통·자루·상자·항아리·솥·가구·깃발·돌 아치 등 118종, 도리이 포함 — `lobby/src/data/object-art.ts`. 울타리·담·마루 판·벽에 거는 것·한 층 더 쌓는 조각은 뺌) |
| `TilesetNature.png` | `Backgrounds/Tilesets/TilesetNature.png` | 혼자 서 있는 그림 전부를 물체로 (나무·바위·풀·꽃 등 135종 — `lobby/src/data/object-art.ts`. 잎이 옆 그림과 겹치는 키 큰 주황 나무(시트 12,16)와 그 옆 줄기 조각만 뺌) |

시트 규격: 16×16 칸 — 로비 배경 캔버스에 32px(2×2 칸)로 2배 키운 크기로, 칸마다 한 조각씩 찍는다(캐릭터와 픽셀 밀도는 맞추지 않음, PROGRESS 결정 기록 2026-10-15). 캐릭터는 이 팩을 쓰지 않는다.
팩에는 캐릭터 90여 종·타일셋·UI·효과음이 더 있다 — 필요해지면 받은 원본에서 골라 이 표에 추가한다.
