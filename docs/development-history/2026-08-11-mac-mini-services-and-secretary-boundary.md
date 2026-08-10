# 2026-08-11 — Mac Mini 자동 시작 및 secretary 외부 경계

## 구현

- Dashboard PM2용 `com.emdoc.progect-dashboard-pm2` LaunchAgent를 추가했다.
- 기존 assetstyle Next.js LaunchAgent `com.choo.macro-dashboard`가 실제 loaded/running 상태임을 확인했다.
- `secretary_agent`에 `/health` 호환 alias를 추가하고 Dashboard registry health URL을 `/api/health`로 정식화했다.
- Docker Compose API 포트를 `127.0.0.1:8000:8000`으로 제한했다.
- Tailscale Serve의 secretary 부분 경로를 제거하고 Dashboard 443, assetstyle 8443만 남겼다.
- 자동 시작 설치와 검증 절차를 `docs/MAC_MINI_OPERATIONS.md`와 `scripts/install_mac_services.sh`에 기록했다.

## 검증

- secretary `uv run pytest tests/test_health.py`: 2 passed
- `/health`, `/api/health`: HTTP 200
- Dashboard `/api/projects`: secretary health `healthy`
- Docker Compose API publish: `127.0.0.1:8000->8000/tcp`
- Tailscale Serve: 443 → 3001, 8443 → 3000; secretary route 없음
- PM2 online, Next.js launchd running

## 배포 판단

- `auto_paper_system`: 정적 배포 후보. `/api/*` 호출을 별도 backend로 분리해야 한다.
- `assetstyle_stock_dashboard`: SSR/API route 때문에 정적 배포 부적합. Node 런타임 배포 또는 Mac Mini 운영.
- `secretary_agent`: DB/Redis/worker/OAuth 의존성 때문에 정적 배포 불가.
