# Progect_dashboard 개발 계획서 V2

> 작성: Codex (개발 주체)
> 날짜: 2026-07-22
> 상태: 사용자 검토 대기

---

## 방향 재설정: "프로세스 목록"에서 "미션 컨트롤"로

### 현재 것의 한계

지금 대시보드는 보안/안정화 기반은 탄탄하지만, 본질적으로 "Start/Stop 버튼이 달린 프로젝트 목록"이야.
실제 사용 맥락에 비춰보면 부족해:

- 응급실 당직 중 폰에서 Tailscale로 접속 → 모바일 UX가 거의 없음 (media query 1개)
- "infinite_buying_V4가 살아있는가"만 보면 되는데 → 프로세스 상태만 있지 실제 건강 상태는 없음
- 크래시 나면 → 대시보드에 접속해서야 알 수 있음 (알림 없음)
- 로그 확인하려면 → SSH로 Mac Mini에 접속해야 함
- Mac Mini 자체가 건강한지 → 알 수 없음

### 참고한 프로젝트들의 접근법

| 프로젝트 | 핵심 아이디어 | 우리가 가져올 것 |
|----------|--------------|-----------------|
| Uptime Kuma | 상태 모니터링 + 알림 (Telegram/Slack) | 크래시/복구 알림, uptime 통계 |
| Portainer | 컨테이너 로그를 UI에서 실시간 스트리밍 | 로그 뷰어 (SSH 없이) |
| Homer/Dashy | 서비스 바로가기 + 상태 배지 | 퀵링크, 카테고리별 그룹핑 |
| PM2 Plus | CPU/메모리 메트릭 + 프로세스 재시작 | 시스템 리소스 모니터링 |
| Grafana | 시계열 차트, 대시보드 위젯 | 미니 차트 (uptime history) |

### 네 상황에 맞는 핵심 원칙

1. **모바일 퍼스트**: 폰에서 3초 안에 "全部 정상" 또는 "뭐가 문제"를 파악
2. **알림 우선**: 대시보드를 열지 않아도 크래시를 알림
3. **SSH 제로**: 로그, 상태, 재시작을 모두 대시보드에서
4. **점진적 확장**: 한 번에 다 만들지 않고, 쓸 때마다 하나씩 추가

---

## 개발 로드맵

### Sprint 1: Git 정리 + 모바일 기본 (1~2일)

**왜 먼저**: 커밋 없이 다음 작업하면 이력 추적 불가. 모바일은 매일 쓰는 화면.

- [ ] Phase A~E 변경사항 커밋 & push
- [ ] 모바일 반응형 레이아웃 (카드 1열, 터치 버튼 44px 이상)
- [ ] PWA manifest + meta tag (홈 화면 추가 시 앱처럼)
- [ ] 다크 테마 유지 (이미 되어 있음), 폰트 크기 조정

**완료 기준**: iPhone Safari에서 Tailscale 접속 시 카드가 1열로 보이고, 버튼이 엄지로 누를 수 있음.

---

### Sprint 2: 시스템 헬스 + Uptime (2~3일)

**왜**: "Mac Mini 자체가 살아있는가"가 가장 기본. 프로세스가 살아있어도 디스크가 꽉 차면 의미 없음.

- [ ] `GET /api/system` — CPU%, 메모리%, 디스크%, uptime (Node `os` 모듈)
- [ ] 대시보드 상단에 시스템 요약 바 (CPU/RAM/Disk 게이지)
- [ ] 프로젝트별 uptime 추적 (시작 시각, 마지막 크래시 시각, 총 가동 시간)
- [ ] `projects.json`에 `last_started`, `total_uptime_sec` 누적

**완료 기준**: 대시보드 열면 Mac Mini 건강 상태가 한눈에 보임.

---

### Sprint 3: 로그 뷰어 (2~3일)

**왜**: 크래시 원인 파악에 SSH가 필요하면 안 됨. 당직 중에 폰에서 "왜 죽었지?"를 바로 확인.

- [ ] `GET /api/projects/:name/logs?lines=50` — 최근 N줄
- [ ] `GET /api/projects/:name/logs/stream` — SSE 실시간 스트림
- [ ] ProjectCard에 "Logs" 버튼 → 하단 드로어 또는 모달
- [ ] 로그 하이라이트 (ERROR/WARN 색상)
- [ ] 모바일에서 전체 화면 로그 뷰

**완료 기준**: 폰에서 프로젝트 카드 → Logs → 최근 에러 확인까지 2탭.

---

### Sprint 4: 알림 (Telegram) (2일)

**왜**: 대시보드를 열지 않아도 크래시를 알아야 함. 응급실에서는 폰을 계속 보고 있을 수 없음.

- [ ] `.env`에 `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` 추가
- [ ] 크래시 시 Telegram 메시지: "⚠️ infinite_buying_V4 crashed (exit code 1) at 03:42"
- [ ] 복구 시: "✅ infinite_buying_V4 recovered after 2 retries"
- [ ] always_on 프로젝트 5회 실패 시: "🚨 infinite_buying_V4 gave up after 5 crashes"
- [ ] 알림 설정 UI (프로젝트별 on/off, 조용한 시간대)

**완료 기준**: 새벽에 봇이 죽으면 텔레그램 알림이 옴.

---

### Sprint 5: secretary_agent 정상화 (1~2일)

**왜**: 6개 프로젝트 중 핵심 에이전트가 DB 문제로 멈춰있음.

- [ ] Docker Compose 기반 실행으로 전환 (`docker compose up -d`)
- [ ] `run_command`를 `docker compose up -d` / `docker compose down`으로 변경
- [ ] 대시보드에서 Docker 컨테이너 상태 조회 (`docker compose ps --format json`)
- [ ] 또는: native 실행 시 `DATABASE_URL`에 `127.0.0.1` 사용 가이드 + health check graceful degradation

**완료 기준**: secretary_agent가 대시보드에서 Start/Stop 가능하고, DB 없이도 크래시 루프 없음.

---

### Sprint 6: 퀵링크 + 프로젝트 상세 (2일)

**왜**: "프로세스 관리"를 넘어 "내 프로젝트들의 허브"로.

- [ ] 프로젝트별 GitHub 링크, 로컬 경로, 최근 커밋 표시
- [ ] static-html 프로젝트에 직접 링크 버튼 (auto_ER_schedule → GitHub Pages)
- [ ] 프로젝트 상세 페이지 (라우트: `/project/:name`)
  - 기본 정보, 실행 명령어, 환경 변수 (마스킹), 로그, uptime 차트
- [ ] "New Project" 등록 폼 (GitHub URL → clone → registry 추가)

**완료 기준**: 대시보드에서 각 프로젝트의 모든 정보와 액션에 접근 가능.

---

## 기술 스택 (변경 없음)

- Backend: Express 5 (server.js)
- Frontend: React 19 + Vite 8
- Test: node --test (내장)
- Deploy: PM2 (`ecosystem.config.cjs`)
- Auth: Basic Auth (Tailscale + 로컬)
- Log: rotating-file-stream
- 알림: node-telegram-bot-api 또는 단순 fetch (추가 의존성 최소화)

---

## 하지 않을 것 (이번 범위 밖)

- 원격에서 서브 앱 UI 직접 열기 (reverse proxy 필요, 별도 프로젝트)
- 멀티 유저/권한 관리 (개인 서버이므로 불필요)
- DB 기반 영속성 (JSON 파일 기반으로 충분)
- Docker 전체 컨테이너화 (Mac Mini native 실행이 현재 방식)

---

## 진행 방식

내가(Codex) 각 Sprint를 직접 구현하고, 완료 후 여기서 결과 보고.
네가 확인하고 "다음"이라고 하면 다음 Sprint로 진행.
중간에 방향 바꾸고 싶으면 언제든 말해.

**시작 제안**: Sprint 1 (Git 정리 + 모바일)부터 바로 시작할까?
아니면 우선순위를 다르게 잡고 싶어?
