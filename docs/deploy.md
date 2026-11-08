# 배포 (Oracle Cloud 무료 VM)

> 결정 2026-11-08 (PROGRESS 결정 기록). 주소 **https://nolja-lobby.duckdns.org**

## 구성

```
브라우저 ──https──▶ Caddy (80/443, Let's Encrypt 인증서 자동) ──▶ node server/src/main.ts (8080: 로비 빌드 + /ws)

main 에 push (lobby/·server/·package*.json·scripts/deploy-vm.sh 가 바뀐 것만)
  → GitHub Actions `deploy` → SSH(배포 전용 키) → VM 의 scripts/deploy-vm.sh
  → git merge --ff-only origin/main → npm ci → npm run build → systemctl restart game-hub
```

| 항목 | 값 |
|---|---|
| VM | Oracle Cloud Always Free `VM.Standard.E2.1.Micro`(1 GB RAM + 스왑 2 GB), Ubuntu 24.04, 홈 리전 Japan Central(Osaka) — 한국 리전은 가입 목록에 없었다 |
| 도메인 | DuckDNS `nolja-lobby.duckdns.org` → VM 공인 IP |
| 앞단 | Caddy(Ubuntu 패키지) — `/etc/caddy/Caddyfile` 에 `reverse_proxy localhost:8080` |
| 서버 | systemd `game-hub.service` — `User=ubuntu`, `WorkingDirectory=/home/ubuntu/game-hub`, `Environment=PORT=8080`, `ExecStart=/usr/bin/node server/src/main.ts`, `Restart=always` |
| 체크아웃 | VM 의 `/home/ubuntu/game-hub` (공개 저장소 https clone) — 배포 전용, 손으로 고치지 않는다 |
| Node | NodeSource `setup_22.x` 로 설치(`/usr/bin/node`) — `package.json` 이 `>=22.18.0`(`.ts` 바로 실행) 을 요구하는데 Ubuntu 24.04 기본 apt 의 Node 는 18 |
| 방화벽 | Oracle Security List 에 TCP 80·443 + VM `iptables` 에 80·443 ACCEPT 를 REJECT 줄 **위에**(`netfilter-persistent save`) |

**재시작하면 방 편집이 초기화된다** — 방 상태가 서버 메모리에만 있다. 그래서 기록 문서만 바뀐 push 는 배포하지 않는다(워크플로 `paths`).

**배포는 원자적이지 않다** — 체크아웃·`node_modules`·`lobby/dist` 를 그 자리에서 바꾼다. `npm ci`·build 가 실패하면 재시작은 안 하지만 사이트가 깨진 채로 남을 수 있다. 고친 커밋을 다시 push 하거나, VM 에서 `git reset --hard <이전 커밋>` 뒤 손으로 배포.

## 자동 배포 처음 세팅 (한 번)

> 이 세팅을 담은 커밋을 `main` 에 push 하면 그 push 로 `deploy` 가 한 번 돈다 — 키·스크립트가 아직 VM 에 없어 **실패하는 것이 정상**. 아래를 마치고 7번으로 다시 돌린다.

1. **VM 체크아웃에 배포 스크립트 받기** (`main` 에 합쳐 push 한 뒤) — 워크플로가 부르는 `scripts/deploy-vm.sh` 가 VM 에 있어야 한다.
   ```bash
   cd ~/game-hub && git pull
   ```
2. **배포 전용 키 만들기** (어디서든 — 개인 키는 GitHub Secrets 에만 둔다)
   ```bash
   ssh-keygen -t ed25519 -N "" -C github-deploy -f deploy_key
   ```
3. **VM 에 공개 키를 "배포 스크립트만" 으로 등록** — `restrict` 는 포워딩·터미널을 모두 막고, `command=` 는 어떤 명령을 보내도 이 스크립트만 돌린다. 키가 새어도 VM 셸은 못 연다.
   ```bash
   echo 'restrict,command="bash /home/ubuntu/game-hub/scripts/deploy-vm.sh" <deploy_key.pub 한 줄>' >> ~/.ssh/authorized_keys
   ```
4. **호스트 키 한 줄** (VM 에서) — Actions 가 엉뚱한 서버에 붙지 않게 한다.
   ```bash
   echo "nolja-lobby.duckdns.org $(cut -d' ' -f1,2 /etc/ssh/ssh_host_ed25519_key.pub)"
   ```
5. **GitHub Secrets** (저장소 Settings → Secrets and variables → Actions)
   - `DEPLOY_SSH_KEY` — `deploy_key`(개인 키) 파일 내용 통째
   - `DEPLOY_KNOWN_HOSTS` — 4번 출력 한 줄
6. 로컬의 `deploy_key`·`deploy_key.pub` 지우기.
7. **시험** — GitHub Actions 탭 → `deploy` → **Run workflow**. 로그 끝에 `deployed <전> -> <후>`.

## 손으로 배포 (VM 에서)

```bash
bash ~/game-hub/scripts/deploy-vm.sh
```

## 문제 해결

| 증상 | 볼 곳 |
|---|---|
| Actions 가 `Permission denied (publickey)` | 3번 `authorized_keys` 줄 · `DEPLOY_SSH_KEY` 가 개인 키 전체(첫·끝 줄 포함)인지 |
| Actions 가 `Host key verification failed` | `DEPLOY_KNOWN_HOSTS` — VM 을 새로 만들면 호스트 키가 바뀐다 |
| `Not possible to fast-forward` | VM 체크아웃에 손으로 고친 것이 있다 — `git status` 로 보고 되돌린다 |
| `sudo: a password is required` | ubuntu 사용자의 비밀번호 없는 sudo(Oracle Ubuntu 이미지 기본) 가 꺼졌다 — `sudo visudo -f /etc/sudoers.d/game-hub` 에 `ubuntu ALL=(root) NOPASSWD: /usr/bin/systemctl restart game-hub, /usr/bin/journalctl -u game-hub *` |
| Actions 로그 끝이 `did not answer on :8080` | 새 코드로 서버가 안 뜬다 — 로그에 찍힌 journal 을 보고 고친 커밋을 push |
| 사이트가 안 열림 | `systemctl status game-hub` · `sudo journalctl -u caddy -n 50` · 공인 IP 가 바뀌었으면 DuckDNS 갱신 |
| 바깥에서 접속 자체가 안 됨 | Oracle Security List 80/443 · VM `iptables` 에서 80/443 ACCEPT 가 REJECT 줄보다 **위**인지 (`sudo iptables -L INPUT -n --line-numbers`) |
