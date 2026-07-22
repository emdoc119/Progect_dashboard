# Progect_dashboard 저토큰 실행 계획서

## 목적

이 문서는 Antigravity가 복귀한 뒤 재분석을 반복하지 않고 `Progect_dashboard`의 보안·운영 안정화 작업을 수행하도록 만든 실행 명세다.

먼저 읽을 문서는 다음 세 개뿐이다.

1. `ANTIGRAVITY_IMPLEMENTATION_BRIEF.md` — 프로젝트 범위와 안전 규칙
2. `ANTIGRAVITY_FOLLOWUP_REVIEW.md` — 최신 점검 결과와 우선순위
3. 이 문서 — 확정된 구현 순서와 세부 설계

이 문서의 지시가 이전 문서와 충돌하면, 보안 및 운영 구조에 관해서는 이 문서를 우선한다.

## 작업 방식 — 토큰 절약 규칙

- 작업 시작 시 `git status --short`, 아래에 지정한 파일만 읽는다. 전체 저장소 재탐색, Git log, 대형 로그 파일 읽기는 하지 않는다.
- 한 단계가 끝날 때만 `npm run lint`, `npm run build`, 해당 테스트를 실행한다.
- 실제 서브 프로젝트를 시작하지 않는다. 특히 `infinite_buying_V4`는 현재 의존성 오류가 있으므로 테스트 중 auto-start하면 안 된다.
- `secretary_agent`의 실제 `.env`, DB, 토큰은 읽거나 수정하지 않는다.
- 변경은 작은 단계로 적용하고, 단계별로 변경 파일과 검증 결과만 짧게 기록한다.
- 별도 브라우저 탐색, 새 기능(New Project), GitHub push/commit은 이번 범위가 아니다.

## 현재 구현 기준선

이미 반영된 사항:

- Basic Auth와 환경 변수 기반 외부 bind 검증
- `.env` 및 로그 Git ignore
- Vite 개발 proxy와 React 상대 API 호출
- ProcessManager 상태, 수동 Stop 억제, 60초 안정 시간, 최대 5회 backoff
- `rotating-file-stream` 기반 log rotation
- UI polling, 마지막 오류와 재시도 횟수 표시

아직 해결되지 않은 핵심 문제:

1. 운영 대시보드는 여전히 Vite dev server(8081)에 의존한다. Express(3001)는 API만 제공하고 `dist`를 제공하지 않는다.
2. `secretary_agent`가 `--host 0.0.0.0`으로 실행돼 동적 포트가 Tailscale에 직접 노출될 수 있다. UI 차단만으로는 보안이 되지 않는다.
3. API의 `lastError`는 서버에서 마스킹하지 않는다.
4. ProcessManager/인증/로그의 자동 테스트가 없다.

---

# 구현 단계

## Phase A — 운영 단일 origin (먼저 완료)

### 목표

운영에서는 `http://<dashboard-host>:3001` 하나만 사용한다. UI, Basic Auth, API가 Express 하나로 제공된다. Vite는 로컬 개발 전용이다.

### 수정 대상

- `server.js`
- `package.json`
- `README.md`
- 필요 시 `vite.config.js`

### 구현 결정

1. Express middleware 순서를 다음처럼 확정한다.
   - 환경 검증
   - JSON parser
   - Basic Auth
   - `/api/*` routes
   - `/apps` static route (현재 로컬 static 용도만 유지)
   - `dist` static route
   - SPA fallback (`dist/index.html`), 단 API와 `/apps` 오류를 HTML로 덮어쓰지 않는다.
2. production `start` script는 Vite를 실행하지 않고 `node server.js`만 실행한다.
3. `dev` script는 기존처럼 Vite proxy + API server를 함께 실행한다. Vite host는 loopback 기본값을 유지한다.
4. `build`는 그대로 Vite build다. README에는 production 시작 전 `npm run build`가 필요하다고 정확히 쓴다.
5. `dist`가 없는 production 요청은 500 또는 사람이 이해할 수 있는 설치 안내를 주고, 자동으로 Vite를 실행하지 않는다.
6. 개발 proxy 요청도 Basic Auth가 필요한 경우 인증 header가 backend에 전달되는지 확인한다. 확신이 없으면 개발 시 API auth를 환경 변수로 명시하고 curl로 검증한다.

### 완료 기준

- `npm run build` 후 `node server.js`만으로 `/`에서 React HTML이 응답한다.
- `DASHBOARD_ALLOW_LAN=true` + 인증 변수 설정 시 `/`와 `/api/projects`는 인증 전 401, 인증 후 200이다.
- Vite 8081을 실행하지 않아도 production UI가 동작한다.

### 안전한 검증 방법

- 테스트 중 `DASHBOARD_AUTOSTART=false`를 지원하도록 추가한다. 이 값이면 `always_on` 프로젝트를 기동하지 않는다.
- 테스트 서버는 loopback의 임시 포트를 쓰고, 검증 뒤 종료한다.
- 실제 Start API는 호출하지 않는다.

## Phase B — 하위 앱 네트워크 노출 차단

### 목표

Dashboard가 실행하는 앱은 기본적으로 해당 Mac에서만 접근 가능하다. 외부 앱 프록시는 이번 단계에서 만들지 않는다.

### 수정 대상

- `projects.json`
- `server.js`
- `src/components/ProjectCard.jsx`
- `README.md`

### 구현 결정

1. registry의 각 동적 프로젝트에 `exposure: "loopback"`을 추가한다.
2. `run_command`에 `{host}` placeholder를 사용하고, 서버는 `exposure === "loopback"`일 때 `{host}`를 반드시 `127.0.0.1`로 치환한다. 임의 host 입력은 허용하지 않는다.
3. 현재 명령을 아래 방향으로 정리한다.
   - FastAPI: `--host {host}`
   - Streamlit: `--server.address {host}`
   - Next.js: 지원되는 hostname 옵션에 `{host}` 사용
4. 서버가 registry load 시 `exposure` 값과 `{host}` 사용 규칙을 검증한다. 유효하지 않은 프로젝트는 실행하지 않고 이해 가능한 오류를 반환한다.
5. 원격 브라우저에서 앱을 열지 않는 현재 UX는 유지한다. API URL은 계속 `localhost`를 반환할 수 있지만, UI는 원격에서 URL을 변환하거나 열지 않는다.
6. 원격 앱 화면 제공은 별도 승인 과제로 남긴다. 구현한다면 인증을 상속하는 reverse proxy와 Streamlit WebSocket 테스트가 필수다.

### 완료 기준

- `projects.json`의 FastAPI 명령에 `0.0.0.0`이 남지 않는다.
- 동적 앱은 모두 명시적으로 loopback bind를 요청한다.
- Tailscale 원격 UI에서 프로젝트 제어는 가능하지만 하위 앱 포트를 여는 동작은 없다.

## Phase C — 오류 처리와 ProcessManager 경계 보강

### 목표

민감한 오류가 API로 나가지 않고, 재시작/정지/서버 종료의 경계 사례가 예측 가능하다.

### 수정 대상

- `server.js` 또는 추출한 순수 helper 모듈

### 구현 결정

1. `sanitizeError(message)`를 서버 측에 만들고, `lastError`에 저장하기 전에 호출한다.
   - URL userinfo: `scheme://user:password@host`의 user/password 마스킹
   - `password`, `token`, `secret`, `api_key`, `key` 등 `=`, `:` 뒤 값 마스킹
   - 환경 변수 전체나 긴 연결 URL은 안전한 짧은 오류 설명으로 대체
2. UI의 `maskError`는 2차 방어로 유지하되, 보안의 주된 책임은 서버에 둔다.
3. child `error`가 발생한 경우에도 log stream을 한 번만 종료하는 `closeLogStream` helper를 사용한다. `error`와 `close`가 모두 와도 중복 종료되지 않아야 한다.
4. restart `setTimeout` handle을 상태에 보관한다. 수동 Stop, 수동 Start, SIGINT/SIGTERM에서 반드시 취소한다.
5. `starting` 상태에서 Start 요청은 새 child를 만들지 않고 기존 상태를 반환한다.
6. 60초 안정 timer 뒤에만 retryCount를 0으로 초기화한다. 그 전 crash는 계속 누적돼 6번째 crash 후 `crashed`가 되어야 한다.
7. `/api/projects/:name/start`는 없는 이름 404, registry/경로 오류는 400 또는 500을 일관된 JSON 형식으로 반환한다.

### 완료 기준

- 예제 DB URL/토큰을 포함한 오류를 입력해도 API 응답과 UI 표시값에 비밀 값이 없다.
- 수동 Stop 후 예약된 restart가 실행되지 않는다.
- 6번째 연속 crash 이후 상태는 `crashed`이고 새 spawn이 일어나지 않는다.

## Phase D — 테스트 기반 확보

### 목표

실제 금융/에이전트 앱을 실행하지 않고 핵심 동작을 재현 가능하게 검증한다.

### 구현 결정

1. Node 내장 test runner를 우선 사용한다. 불필요하게 대형 테스트 프레임워크를 추가하지 않는다.
2. `package.json`에 `test` script를 추가한다: 예: `node --test`.
3. 테스트하기 어려운 순수 로직은 작은 모듈로 추출한다. 서버 import만으로 listen/auto-start가 일어나지 않게 `createApp`/`startServer` 또는 동등 구조를 사용한다.
4. 최소 테스트 목록:
   - external bind + 인증 변수 누락 검증
   - Basic Auth 미인증 401 / 인증 200
   - `sanitizeError`의 URL·token·password 마스킹
   - loopback exposure registry 검증
   - manual Stop이 restart timer를 취소하는 동작
   - 6회 연속 crash 후 `crashed`
   - deployed static 프로젝트가 `deployed`를 유지
5. rotation 라이브러리는 자체 기능을 재구현하지 않는다. configuration 값과 stream close helper를 단위 검증하고, 실제 대용량 파일 테스트는 필요 최소한으로만 한다.

### 완료 기준

- `npm test`, `npm run lint`, `npm run build`가 모두 성공한다.
- 테스트는 `DASHBOARD_AUTOSTART=false` 또는 dependency injection으로 서브 프로젝트를 시작하지 않는다.

## Phase E — registry 및 운영 문서 마감

### 수정 대상

- `projects.json`
- `README.md`
- 필요 시 `.env.example`

### 구현 결정

1. registry schema를 load 시 검증한다: name, type, local_path, run_command, always_on, exposure, static access_url/entry_point 규칙.
2. `auto_paper_system`은 실제 URL 또는 로컬 static 제공 방식을 확정하기 전에는 현재처럼 명확한 400과 UI 메시지를 제공한다. 존재하지 않는 링크를 생성하지 않는다.
3. README에 아래를 명시한다.
   - development: `npm run dev`
   - production: `npm run build` 후 `npm run start`
   - Tailscale: `DASHBOARD_ALLOW_LAN=true`와 강한 인증 변수 필수
   - 하위 앱은 loopback 전용이며 원격 UI로 직접 열 수 없음
   - 로그 rotation 정책
   - secretary_agent native DB host (`127.0.0.1`)와 Compose DB host (`db`)의 차이
4. README의 “3001 backend에서 dashboard 사용 가능” 표현은 Phase A가 구현된 뒤에만 남긴다.

---

## Antigravity 실행 프롬프트

아래 문구를 그대로 전달한다.

> `/Users/choo/.gemini/antigravity/scratch/Progect_dashboard`에서 `ANTIGRAVITY_IMPLEMENTATION_BRIEF.md`, `ANTIGRAVITY_FOLLOWUP_REVIEW.md`, `ANTIGRAVITY_EXECUTION_PLAN.md`를 순서대로 읽어줘. 마지막 문서의 Phase A만 먼저 구현해줘. 지정 파일 외에는 조사하지 말고, 실제 서브 프로젝트는 실행하지 마. `DASHBOARD_AUTOSTART=false`를 이용해 안전하게 검증하고, 완료 후 변경 파일·실행한 검증 명령·결과·남은 위험만 간결히 보고해줘. 다음 phase는 내 승인 전에는 시작하지 마.

Phase A 완료 후에는 같은 문구에서 `Phase B만`, 그다음 `Phase C만`처럼 한 단계씩 요청한다. 이렇게 하면 한 번의 실행에서 필요한 코드 문맥과 토큰 사용량을 작게 유지할 수 있다.
