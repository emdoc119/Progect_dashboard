# Progect_dashboard 후속 점검 및 구현 지시서

## 읽는 순서

1. `ANTIGRAVITY_IMPLEMENTATION_BRIEF.md` — 최초 구현 범위와 완료 기준
2. `README.md` — 현재 운영 방법
3. 이 문서 — 현재 구현 검토에서 확인된 보완 작업

이 문서는 2026-07-20의 코드 점검 결과다. 기존 사용자 변경과 서브 프로젝트의 데이터·`.env`는 변경하거나 출력하지 말 것. 변경 전 Git status를 확인하고, 비밀값을 diff·로그·보고서에 포함하지 말 것.

## 2차 재점검 결과 (2026-07-20, 최신 지시)

이 절이 이전의 미완료 목록보다 우선한다. 아래 항목은 코드로 반영됐고 정적 검증을 통과했다.

- `.env`, `.env.*`(단 `.env.example` 예외), `logs_*.txt` 및 회전 로그는 `.gitignore`로 보호된다. 실제 `.env`가 ignore됨을 확인했다.
- 외부 interface bind 시 Basic Auth 환경 변수가 없으면 서버가 종료된다.
- `rotating-file-stream`으로 10MB/일 단위 rotation과 최대 5개 보관이 설정됐다.
- manual Stop 재시작 억제, 60초 안정 시간 뒤 retryCount 초기화, 오류·마지막 충돌 시각 UI 표시가 반영됐다.
- `npm run lint`와 `npm run build`가 모두 경고/오류 없이 통과했다.

그러나 아래 작업은 아직 완료가 아니며, 원격 운영 전 반드시 처리해야 한다.

### 최신 P0-1. 실제 운영 단일 origin 구현

- 현재 `npm run start`는 Express(3001)와 Vite dev server(8081)를 동시에 실행한다. Express는 아직 `dist`를 제공하지 않으므로 README의 “3001에서 dashboard 사용 가능” 설명은 사실이 아니다.
- 운영용 script를 분리한다. 예: build 후 Express가 `dist`를 정적으로 제공하고 SPA fallback을 처리하는 `start`/`serve` script, Vite proxy를 사용하는 `dev` script.
- Tailscale/운영 환경에서 Vite dev server를 열지 않는다. Express의 Basic Auth가 UI HTML·정적 asset·API 전체를 보호하는지 확인한다.
- 미인증 요청 401, 인증된 HTML·API 요청 200을 자동 또는 재현 가능한 수동 절차로 검증한다.

### 최신 P0-2. 하위 앱 포트 외부 노출 제거

현재 UI는 원격 연결에서 앱 열기를 막지만, 이는 UI 차원의 제한일 뿐이다. `projects.json`의 `secretary_agent`는 `--host 0.0.0.0`으로 실행되므로 동적 포트에 Tailscale에서 직접 접근해 Dashboard 인증을 우회할 수 있다.

- 모든 로컬 관리 앱의 bind address를 명시적으로 loopback으로 제한한다.
  - FastAPI: `--host 127.0.0.1`
  - Streamlit: `--server.address 127.0.0.1`
  - Next.js: 해당 버전이 지원하는 loopback hostname 옵션을 사용한다.
- registry에 `bind_host` 또는 `exposure` 같은 명시적 필드를 추가하고 schema 검증한다. 원격 노출이 정말 필요한 앱만 사용자 승인과 별도 인증 proxy를 거치게 한다.
- 원격에서 하위 앱 화면을 지원하려면, Dashboard Basic Auth를 상속하는 reverse proxy를 별도 구현하고 Streamlit WebSocket도 검증한다. 이를 이번 범위에서 하지 않는다면 원격 직접 열기는 계속 차단한다.

### 최신 P0-3. 서버 측 오류 마스킹

- 현재 UI의 정규식 마스킹만으로는 충분하지 않다. `/api/projects` 응답의 `lastError`가 자격 증명을 포함하면 브라우저/네트워크에 이미 노출된다.
- 오류를 저장하기 전 서버에서 URL userinfo, password, token, key, secret 등 민감 값을 마스킹한다. UI는 방어적 2차 마스킹만 유지한다.
- 오류 마스킹 단위 테스트를 추가한다.

### 최신 P1-1. 테스트와 ProcessManager 경계 사례

- 현재 `test` script와 자동 테스트가 없다. registry parsing, 외부 bind 검증, 인증, manual Stop, 6회 연속 crash, 60초 안정 실행 후 retry reset, 오류 마스킹을 대상으로 테스트를 추가한다.
- child `error`만 발생하고 `close`가 오지 않는 경우에도 log stream을 닫고 상태를 확정한다.
- 앱이 `starting` 상태일 때 Start 요청, backoff 중 수동 Start, 서버 shutdown 중 예약된 재시작 timer가 남는 경우를 안전하게 처리한다.

### 최신 P1-2. registry 및 정적 프로젝트 완성

- `projects.json` schema 검증을 추가한다.
- `auto_paper_system`은 access URL과 entry point가 모두 없어 현재 Start하면 의도적으로 400을 반환한다. 실제 제공 방식(local static, GitHub Pages, 관리 제외)을 결정하고 registry를 완성한다.
- static 프로젝트의 `deployed` 상태는 API와 UI에서 계속 일관되게 유지되는지 테스트한다.

### 최신 P1-3. 문서 정합성

- README에 dev/production 명령을 분리해 정확히 쓴다. 현재 “3001 Backend에서 dashboard 사용 가능” 문구는 Express static serving 구현 전에는 제거한다.
- 로그 rotation의 실제 파일명·보관 정책, 원격 하위 앱 접근 제한, secretary_agent의 native/Compose DB 설정을 운영 절차로 명시한다.

## 검증된 현재 상태

- `npm run lint`: 성공, 미사용 변수 경고 9건 존재
- `npm run build`: 성공
- Basic Auth, 상대 API 경로, Vite 개발 proxy, 재시작 backoff, 시작 명령에서 의존성 설치 제거는 부분 반영됨
- 별도의 implementation-plan walkthrough 파일은 없으며, 본 문서와 기존 구현 지시서가 소통 기준 문서임

## P0 — 반드시 먼저 수정

### P0-1. 비밀값 및 런타임 파일 보호

- 루트 `.gitignore`에 다음을 추가한다.
  - `.env`
  - `.env.*` (단, `.env.example`은 예외)
  - `logs_*.txt`
  - `logs_*.old.txt`
- 실제 루트 `.env`가 Git 추적 대상이 아닌지 확인한다. 값은 절대 출력하지 않는다.
- `.env.example`의 `admin` 같은 예측 가능한 기본 사용자명은 비어 있는 placeholder로 바꾸고, 실제 강한 자격 증명이 필수임을 README에 쓴다.

### P0-2. Tailscale/외부 접속의 인증 우회 차단

현재 Basic Auth는 Express API에만 적용되고, Vite dev server와 하위 앱의 동적 포트는 보호되지 않는다. UI에서 `localhost`를 현재 hostname으로 치환하는 구현은 하위 앱을 인증 없이 외부에 노출할 수 있으므로 보안 해결책이 아니다.

- bind 주소가 `127.0.0.1`, `::1`, `localhost` 이외이면, `DASHBOARD_ALLOW_LAN` 값과 무관하게 인증 환경 변수가 없을 때 서버 시작을 거부한다.
- 운영 모드는 Express가 `dist`를 직접 제공하는 단일 origin으로 만든다. Basic Auth는 HTML·정적 파일·API 전체에 적용돼야 한다.
- Vite는 개발 전용으로 둔다. Tailscale/운영 환경에서 Vite 개발 서버를 공개하지 않는다.
- 관리되는 하위 앱은 기본적으로 loopback (`127.0.0.1`)에만 bind한다.
- 원격에서 하위 앱 화면을 제공해야 한다면 인증을 상속하는 reverse proxy 경로를 구현한다. Streamlit WebSocket도 지원해야 한다.
- 이번 범위에서 proxy가 어렵다면, 원격에서는 상태 확인·시작·중지만 제공하고 하위 앱 직접 열기는 로컬 전용으로 제한한다.

### P0-3. Watchdog의 무한 재시작 차단

현재 구현은 기동 5초 후 retryCount를 0으로 초기화한다. 6초마다 죽는 앱은 무한 재시작될 수 있다.

- retryCount는 충분한 안정 실행 시간(권장 60초) 또는 실제 health check 성공 후에만 초기화한다.
- 수동 Stop은 재시작을 억제한다.
- crashed/backoff 상태에서 사용자가 수동 Start했을 때만 재시도 횟수를 명시적으로 초기화한다.
- child process의 `close`/`error` 처리에서 로그 stream도 정상 종료해 파일 descriptor 누수를 막는다.
- 존재하지 않는 프로젝트 Start 요청은 500이 아닌 404를 반환한다.

## P1 — P0 완료 후 진행

### P1-1. 실제 동작하는 로그 rotation

현재 rotation은 프로세스 시작 시 한 번만 검사하므로 장기 실행 중 로그 파일은 무한히 커진다.

- 쓰기 중에도 크기를 검사해 rotation 한다.
- 예: 파일당 10MB, 최근 5개 보관처럼 보관 정책을 구현과 README에 동일하게 명시한다.
- rotation과 프로세스 종료 때 stream 정리를 테스트한다.

### P1-2. UI와 registry 상태 정확성

- App의 polling 결과가 ProjectCard 내부 state에 반영되지 않는다. props 변경 동기화 또는 상위 state 관리로 `running`, `backoff`, `crashed`, `stopped`를 정확히 표시한다.
- API가 static HTML 프로젝트의 registry 상태(`deployed`)를 `stopped`로 덮어쓰지 않게 한다.
- `auto_paper_system`은 빈 entry point이고 registry의 실제 프로젝트 경로도 `apps/`와 다르다. 존재하지 않는 `/apps/...` 링크를 만들지 말고 제공 방식을 명확히 한다.
- 카드에 마지막 오류(비밀값 마스킹), 마지막 실패 시각, retryCount를 표시한다.

### P1-3. secretary_agent 운영 모드 문서화

- Compose 모드에서는 `db`, `redis` 같은 Docker 서비스명을 사용한다.
- 대시보드가 Mac 호스트에서 직접 `uv run uvicorn`을 실행하는 네이티브 모드에서는 DB host를 `127.0.0.1` 또는 `localhost`로 사용한다.
- 실제 `.env`를 읽거나 출력하지 말고, 안전한 `.env.example`, 시작 절차, 오류 진단 가이드를 제공한다.
- DB DNS 실패, 연결 거부, 인증 실패를 구분해 안전한 오류 메시지로 대시보드에 표시한다.

## 필수 검증

1. `npm run lint` 경고를 모두 제거하고 `npm run lint`, `npm run build`를 실행한다.
2. 미인증 API 요청 401, 인증 성공 요청 200을 검증한다.
3. 외부 bind + 자격 증명 누락이면 서버가 시작되지 않음을 검증한다.
4. always_on 앱의 수동 Stop 후 재시작하지 않음을 검증한다.
5. 반복 충돌이 최대 재시도 뒤 `crashed`로 남음을 검증한다.
6. 최종 보고에는 수정 파일, 검증 결과, 남은 위험만 간결하게 적는다.
