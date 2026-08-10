# 운영 결정 기록

## 2026-08-10 — Tailscale 중심 모바일 접속

- 결정: 대시보드 외부 접속의 기본 경로를 Tailscale HTTPS Serve로 사용한다.
- 이유: 공개 인터넷에 포트를 직접 노출하지 않고 tailnet 기기에서 휴대폰으로 접근할 수 있다.
- 현재 구성: `https://choo-mac-mini.tailcad4c1.ts.net/` → `127.0.0.1:3001`
- 보안: Express Basic Auth를 유지한다.

## 2026-08-10 — 서비스 유형과 health 분리

- 결정: 프로젝트 카드에 실행 상태와 health 상태를 별도 표시한다.
- 이유: 프로세스가 존재해도 API나 웹 화면이 정상이라는 보장이 없기 때문이다.
- 원격 서비스는 대시보드에서 start/stop하지 않고 health와 외부 링크만 제공한다.

## 2026-08-10 — 모바일 우선 상태판

- 결정: 대시보드 첫 화면에서 Tailscale IP, HTTPS URL, 서버 종류, 운영 호스트와 health를 확인할 수 있게 한다.
- 이유: 모바일에서 각 프로젝트의 포트와 터미널을 기억하지 않고 상태와 링크를 바로 확인하기 위해서다.

## 2026-08-11 — Mac Mini 자동 시작과 secretary 외부 노출 제한

- 결정: Dashboard PM2와 assetstyle Next.js는 macOS 사용자 `launchd`로 자동 시작한다.
- 결정: `secretary_agent` Docker API 포트는 `127.0.0.1:8000`에만 bind한다.
- 이유: Tailscale은 Mac Mini를 깨우거나 전원을 대신할 수 없으며, 인증 없는 FastAPI 포트를 직접 노출하면 Dashboard Basic Auth를 우회한다.
- 대안: secretary를 외부에서 사용해야 할 때는 Dashboard 인증을 통과하는 reverse proxy와 앱 수준 인증을 별도로 추가한다.

## 2026-08-11 — 정적 배포 후보 구분

- `auto_paper_system`은 HTML/JS가 정적 파일이고 서버 API 의존성이 있어, 프론트와 API를 분리한다는 전제에서 GitHub Pages/Cloudflare Pages 후보로 본다.
- `assetstyle_stock_dashboard`는 Next.js SSR/API route와 증권·외부 데이터 호출이 있어 정적 export 대상이 아니다. Node 런타임 배포 또는 Mac Mini+Tailscale을 유지한다.
- `secretary_agent`는 PostgreSQL, Redis, worker, OAuth callback이 필요해 정적 배포 대상이 아니다.
