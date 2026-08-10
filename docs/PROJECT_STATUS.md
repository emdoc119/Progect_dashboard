# Progect Dashboard — 현재 상태

기준일: 2026-08-11
공식 로컬 경로: `/Users/choo/.gemini/antigravity/scratch/Progect_dashboard`
GitHub: `emdoc119/Progect_dashboard`

## 현재 운영 상태

- 대시보드: PM2 `progect_dashboard`, 포트 `3001`, `0.0.0.0` 바인딩
- Tailscale IP: `100.67.149.56`
- Tailscale HTTPS: `https://choo-mac-mini.tailcad4c1.ts.net/`
- Tailscale Serve: HTTPS 443 → `127.0.0.1:3001`
- 별도 Next.js 서비스: HTTPS 8443 → `127.0.0.1:3000`
- 외부 접근: Basic Auth 필요, tailnet 기기에서 휴대폰 접속 가능
- Dashboard PM2: `com.emdoc.progect-dashboard-pm2` launchd 사용자 에이전트가 로그인 시 `pm2 resurrect`
- Next.js: 기존 `com.choo.macro-dashboard` launchd 사용자 에이전트가 로그인 시 시작·KeepAlive
- secretary_agent API: Docker Compose `127.0.0.1:8000` loopback bind

## 프로젝트 상태 표시 기준

- `healthy`: 등록된 health URL이 HTTP 성공 응답
- `unhealthy`: health URL이 실패하거나 비정상 HTTP 응답
- `unknown`: health URL 미등록
- `remote`: 원격 서비스가 healthy이며 대시보드에서 직접 start/stop하지 않음
- `deployed`: 외부 정적 배포가 등록됨
- `stopped`: 로컬 프로세스가 현재 실행되지 않음

## 등록된 서비스 유형

| 프로젝트 | 유형 | 운영 위치 | 대시보드 역할 |
|---|---|---|---|
| infinite_buying_V4 | Naver Cloud · FastAPI | `101.79.21.231:8081` | 원격 health/링크 모니터링 |
| secretary_agent | Docker Compose · FastAPI/PostgreSQL/Redis | Mac Mini | 로컬 프로세스 제어·health |
| auto_paper_system | Static HTML | Mac Mini | `/apps/...` 정적 링크 |
| auto_ER_schedule | GitHub Pages · Static HTML | GitHub Pages | 외부 링크 |
| assetstyle_stock_dashboard | Node.js · Next.js | Mac Mini:3000 | health/외부 링크 |

## 구현된 기능

- `/api/system`에 Tailscale IP, Serve route, 대시보드 접근 URL과 바인딩 정보 표시
- `/api/projects`에 `serverType`, `runtimeHost`, `accessUrl`, `accessLinks`, `health` 정보 표시
- 프로젝트 카드와 상세 화면에서 접속 방식(`Tailscale`, `GitHub Pages`, `Naver Cloud`)을 라벨로 표시하고 클릭 가능하게 제공
- 원격 서비스 start/stop 차단 및 read-only 모니터링
- 등록된 health URL을 5초 캐시로 확인
- 프로젝트 카드에 서버 종류, 운영 호스트, health 상태와 외부 링크 표시
- 모바일 화면에서 카드·필터·접속 정보가 한 열로 표시

## 알려진 제한

- `secretary_agent`의 `/api/health`와 호환 `/health`가 정상 응답하며, Docker Compose API는 현재 healthy다.
- 외부 경로가 구성되지 않은 로컬 서비스는 카드에 `External address not configured`로 표시한다.
- secretary_agent 포트 8000은 외부 Tailscale/LAN 인터페이스에 직접 공개하지 않는다. 외부 UI가 필요하면 인증된 reverse proxy를 별도로 설계해야 한다.
- `/api/projects` health 검증은 등록된 URL만 확인한다. URL이 없는 정적 앱은 `unknown`이다.
- 전체 Node 테스트 중 포트 바인딩 테스트는 Codex 샌드박스의 `listen EPERM` 때문에 실행할 수 없다.

## 다음 우선순위

1. secretary_agent 외부 UI가 필요할 때 Dashboard Basic Auth 연계 reverse proxy 설계
2. Mac Mini 자동 로그인/launchd 복구 절차를 실제 재부팅으로 한 차례 검증
3. auto_paper_system을 GitHub Pages/Cloudflare Pages로 분리 배포할지 결정
4. assetstyle_stock_dashboard는 Next.js 런타임 배포(Vercel 등) 가능성을 별도 검토
