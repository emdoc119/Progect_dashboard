# Mac Mini 운영·접속 정책

기준일: 2026-08-11

## 자동 시작

- `com.emdoc.progect-dashboard-pm2`: PM2 저장 목록을 macOS 사용자 로그인 시 `pm2 resurrect`한다.
- `com.choo.macro-dashboard`: 기존 Next.js `start:tailnet` launchd 에이전트가 macOS 사용자 로그인 시 시작하고, 프로세스가 종료되면 launchd가 재시작한다.
- 설치 스크립트: `/Users/choo/.gemini/antigravity/scratch/Progect_dashboard/scripts/install_mac_services.sh`
- 이 구성은 Mac Mini 전원 켜짐과 사용자 로그인 이후에 적용된다. Mac Mini가 꺼져 있으면 Tailscale도 서비스도 접속할 수 없다.

## 접속 정책

| 서비스 | 기본 경로 | 외부 경로 | 정책 |
|---|---|---|---|
| Dashboard | `127.0.0.1:3001` | Tailscale HTTPS 443 | Basic Auth 필수 |
| assetstyle_stock_dashboard | `127.0.0.1:3000` | Tailscale HTTPS 8443 | Tailnet 전용 |
| secretary_agent | `127.0.0.1:8000` | 기본 외부 경로 없음 | Docker 포트를 loopback에만 bind |

`secretary_agent`의 Docker API 포트는 `127.0.0.1:8000:8000`으로 제한한다. Tailscale IP에 직접 공개하지 않으며, 외부 접속이 필요하면 Dashboard Basic Auth를 통과하는 별도 reverse proxy와 애플리케이션 인증을 추가한 뒤에만 경로를 개방한다.

## Health 계약

- 정식 API health: `/api/health`
- 기존 컨테이너/모니터 호환 alias: `/health`
- 두 경로 모두 DB·Redis 상태를 포함한 JSON을 반환한다.

## 정적 배포 후보

- `auto_paper_system`: 현재 Dashboard가 정적 HTML을 제공한다. GitHub Pages/Cloudflare Pages로 이동하기 쉬운 후보이며, 외부 API 키가 클라이언트에 없다는 점을 먼저 확인한다.
- `assetstyle_stock_dashboard`: Next.js 서버 렌더링·API route·외부 데이터 호출이 있어 단순 정적 배포 후보가 아니다. Vercel/Cloudflare 등 Node 런타임 배포 또는 현재 Mac Mini+Tailscale을 사용한다.
- `secretary_agent`: DB, Redis, Telegram worker, OAuth callback이 필요하므로 정적 배포가 불가능하다. Docker가 가능한 VPS/클라우드 또는 Mac Mini 운영 대상이다.
