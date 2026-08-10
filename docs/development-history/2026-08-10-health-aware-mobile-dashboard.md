# Health-aware Mobile Dashboard

## 목표

휴대폰에서 Tailscale로 대시보드에 접속하고, 각 프로젝트의 서버 종류·운영 위치·실제 health 상태를 확인한다.

## 변경 내용

- `server.js`
  - Tailscale IPv4 자동 탐지
  - Tailscale Serve JSON route 탐지
  - `/api/system` 접근 정보 추가
  - `/api/projects` health probe와 서버 유형 정보 추가
  - remote 서비스 start/stop 차단
  - fixed port 지원
- `projects.json`
  - 원격 infinite_buying_V4를 Naver Cloud FastAPI로 정정
  - secretary_agent, assetstyle_stock_dashboard, Stock-checklist의 런타임·health·포트 메타데이터 추가
- `SystemBar.jsx`, `ProjectCard.jsx`, `index.css`
  - Tailscale 접속 패널
  - 서버 종류·운영 호스트·health chip
  - 모바일 단일 열 레이아웃
- `test/registry.test.js`, `test/watchdog.test.js`
  - remote 프로젝트를 로컬 loopback 실행 규칙에서 제외

## 검증

- `node --check server.js`: 통과
- `npm run build`: 통과
- 대상 레지스트리·watchdog·등록 테스트: 18/18 통과
- Tailscale HTTPS `/`: 인증 후 200
- Tailscale HTTPS `/api/system`: 인증 후 200, `100.67.149.56`과 dashboard Serve route 확인
- Tailscale HTTPS `/api/projects`: 인증 후 200, 원격 infinite_buying_V4 health `healthy` 확인

## 제한

- Codex 샌드박스에서는 로컬 포트 listen 테스트가 `EPERM`으로 실패한다.
- secretary_agent와 Stock-checklist는 개별 실행 환경을 복구해야 health가 healthy가 된다.
