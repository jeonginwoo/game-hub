# 로비 에셋 출처·라이선스

> 로비(`lobby/public/assets/`)에 들어온 외부 에셋은 모두 여기에 적는다. 라이선스를 확인하지 않은 파일은 넣지 않는다.
> 게임(`games/<이름>/`)의 에셋은 각 게임이 관리한다 — 여기 대상 아님.
> 공개 저장소에 들어가므로 **재배포가 허용된 것만** 넣는다 (무료여도 「재배포 금지」 팩은 안 됨).

## Mage City Arcanos — 타일

- **제작:** Hyptosis (www.lorestrome.com)
- **출처:** https://opengameart.org/content/mage-city-arcanos (2026-10-13 받음, `magecity.png` 166.9 KB)
- **라이선스:** CC0 — OpenGameArt 라이선스 표기. 같은 페이지 댓글에서 「작가 홈페이지에는 비상업·표기 요구가 있다」는 지적에 작가가 직접 「홈페이지가 오래됐을 뿐, 여기 올린 두 세트는 퍼블릭 도메인 — 표기 안 해도 됨」이라고 답함(2012-07-06). 표기는 의무가 아니지만 작가가 바라므로 이 문서에 남긴다
- **위치:** `lobby/public/assets/mage-city/magecity.png` (256×1450, 32×32 칸 8열)
- **쓰는 칸** (`lobby/src/tiles.ts`, (열, 행)): 판석 (1,0) · 풀 난 판석 (1,1) · 잎 덤불 (0,0) · 회색 벽돌 정면 (5,27) · 지붕 판자 (1,24) · 열린 입구 (6,40) · 닫힌 나무판 (2,37)
- 시트에는 분수·나무·벤치·석상·통·울타리·창문 등이 더 있다 — 맵 꾸미기 때 골라 쓴다

## 캐릭터

외부 에셋 없음 — `lobby/src/chibi.ts` 가 코드로 직접 그린다.

## 거쳐 간 에셋 (지금은 쓰지 않음)

- Ninja Adventure (pixel-boy · AAA, CC0) — 16px 타일. 2026-10-13 캐릭터를 32px 로 정하면서 Mage City 로 교체
- LPC 캐릭터 레이어 (OGA-BY / CC-BY-SA) — `experiment/lpc-avatar` 브랜치에만 있음
