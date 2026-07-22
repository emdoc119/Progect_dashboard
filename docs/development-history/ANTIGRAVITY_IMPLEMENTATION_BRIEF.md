# Progect_dashboard 구현 지시서

## 역할과 작업 원칙

당신은 `/Users/choo/.gemini/antigravity/scratch/Progect_dashboard`의 유지보수 담당 엔지니어다. 이 저장소는 여러 로컬 서브 프로젝트를 하나의 웹 대시보드에서 상태 확인·시작·중지·장애 복구하는 프로세스 관리 애플리케이션이다.

작업 전 현재 Git 상태와 기존 변경 사항을 확인하고, 사용자 소유의 변경은 되돌리거나 덮어쓰지 말 것. 모든 변경은 이 저장소에서 수행하고, 각 단계 후에는 관련 테스트 또는 수동 검증 결과를 보고할 것. 비밀값은 출력·커밋·로그에 절대 포함하지 말 것.

## 확정된 프로젝트 정보

| 항목 | 값 |
| --- | --- |
| 대시보드 로컬 경로 | `/Users/choo/.gemini/antigravity/scratch/Progect_dashboard` |
| 대시보드 GitHub | `emdoc119/Progect_dashboard` |
| Git remote | `https://github.com/emdoc119/Progect_dashboard.git` |
| 관리 레지스트리 | `projects.json` |
| 백엔드 | `server.js` (Express) |
| 프론트엔드 | React + Vite (`src/`) |

`Progect_dashboard`라는 저장소/폴더의 철자는 의도된 고유명사이므로 임의로 `Project_dashboard`로 변경하지 말 것. 단, 코드와 문서에 남은 이전 서비스명 `epic-hopper`는 이 저장소의 새 이름으로 정리한다.

## 관리 대상 프로젝트

| 이름 | 로컬 경로 | GitHub |
| --- | --- | --- |
| infinite_buying_V4 | `~/.gemini/antigravity/scratch/infinite_buying_v4` | `emdoc119/infinite_buying_V4` |
| secretary_agent | `~/.gemini/antigravity/scratch/secretary_agent/personal-agent-os` | `emdoc119/secretary_agent` |
| auto_paper_system | `~/.gemini/antigravity/scratch/auto_paper_system` | `emdoc119/auto_paper_system` |
| auto_ER_schedule | `~/.gemini/antigravity/scratch/auto_ER_schedule_repo` | `emdoc119/auto_ER_schedule` |
| assetstyle_stock_dashboard | `~/.gemini/antigravity/scratch/assetstyle_stock_dashboard` | `emdoc119/assetstyle_stock_dashboard` |
| Stock-checklist | `~/.gemini/antigravity/scratch/stock_checklist` | `emdoc119/Stock-checklist` |

## 현재 확인된 상태와 핵심 문제

1. `server.js`는 `cors()`로 모든 origin을 허용하고, Basic Auth는 주석 처리돼 있다. 과거 하드코드 계정 문자열도 코드에 남아 있다.
2. 프론트엔드는 API를 `http://localhost:3001`로 고정 호출한다. Tailscale 등 원격 기기에서 접속하면 해당 원격 기기의 localhost를 참조하므로 동작하지 않는다.
3. `always_on` 앱은 수동 Stop 후에도 `close` 이벤트에서 Watchdog가 재시작할 수 있다. 실패 시에도 5초마다 제한 없이 재시작한다.
4. 대시보드 로그는 `logs_<name>.txt`에 무한 append된다.
5. `secretary_agent`는 대시보드가 호스트에서 `uv run uvicorn ...`으로 실행할 때 DB 호스트 해석 실패(`socket.gaierror`)로 기동하지 못했다. Compose 내부 전용 호스트명 `db`가 `.env`의 `DATABASE_URL`에 사용됐을 가능성이 높다.
6. `infinite_buying_V4`는 Streamlit/Protobuf 호환성 오류로 실행 실패한 로그가 있다. `always_on: true`이므로 무한 재시작을 반드시 막아야 한다.
7. `projects.json`의 `run_command`는 매 시작 때 `pip install` 또는 `npm install`을 수행한다. 시작 시간이 느리고 장애 범위가 커진다.

## 구현 우선순위

### 1단계 — 외부 접근 보안과 단일 origin 정비 (가장 먼저)

목표: Tailscale 접속을 포함한 대시보드 접근을 안전하고 일관되게 만든다.

- `.env.example`을 추가하고 아래 값을 문서화한다. 실제 `.env`는 gitignore 대상이어야 한다.
  - `DASHBOARD_HOST` (기본값 `127.0.0.1`)
  - `DASHBOARD_PORT` (기본값 `3001`)
  - `DASHBOARD_AUTH_USERNAME`
  - `DASHBOARD_AUTH_PASSWORD`
  - `DASHBOARD_ALLOW_LAN` 또는 동등한 명시적 외부 노출 플래그
- `express-basic-auth`를 활성화하되, 하드코드 자격 증명을 완전히 제거한다. 비밀번호 비교는 timing-safe 방식으로 처리한다.
- 로컬 loopback 전용 기본값에서는 인증을 선택적으로 허용할 수 있지만, `0.0.0.0` 또는 Tailscale 접근을 허용하는 모드에서는 인증 환경 변수가 없으면 서버가 시작되지 않도록 한다.
- 전역 `cors()`를 제거한다. 개발 환경은 Vite proxy를 사용하고, 배포 환경은 Express가 `dist`를 정적으로 제공하는 단일 origin 구조를 우선 적용한다.
- React API 요청을 절대 주소가 아닌 `/api/projects` 등 상대 경로로 변경한다.
- 원격 접속에서 하위 앱을 여는 URL도 단순 `localhost`가 되지 않도록 설계한다. 첫 구현에서는 앱의 직접 외부 노출 대신, 대시보드에서 상태 확인과 제어만 제공하고 앱 URL의 외부 공개는 명시적 설정으로 제한해도 된다.
- 인증 제외 경로를 만들 경우에는 health check처럼 최소 범위로만 제한하고, Start/Stop/레지스트리 API는 반드시 인증 대상에 둔다.

완료 조건:

- 미인증 요청은 401을 반환한다.
- 올바른 인증으로 프로젝트 조회와 Start/Stop이 동작한다.
- 원격 브라우저가 자신의 localhost를 호출하지 않는다.
- 비밀값이 소스, Git diff, 브라우저 번들, 로그에 나타나지 않는다.

### 2단계 — ProcessManager와 로그 안정화

목표: 장애를 관측 가능하게 만들고 무한 재시작과 로그 폭증을 방지한다.

- 실행 상태를 단순 PID/port 이상으로 관리한다: `starting`, `running`, `stopping`, `stopped`, `crashed`, `backoff` 및 마지막 종료 코드/오류/시각을 기록한다.
- 수동 Stop은 해당 실행 세션의 auto-restart를 명시적으로 억제해야 한다.
- `always_on`의 비정상 종료에만 재시작을 적용한다. 지수 backoff, 최대 재시도 횟수, 안정 실행 시간 후 재시도 카운터 초기화를 구현한다.
- 최대 횟수를 넘으면 `crashed`로 남기고 UI/API에 원인과 다음 조치를 보여 준다. 서버 자신의 HTTP API를 다시 호출하는 방식 대신 내부 함수로 재시작해도 좋다.
- 로그 rotation을 구현한다. 의존성 추가가 불필요하다면 파일 크기 기반으로 예: 10MB마다 rotation, 5개 보관을 구현한다. 기존 로그를 안전하게 이어받고 스트림/파일 descriptor를 정상 종료한다.
- 프로젝트 실행 명령은 설치와 기동을 분리한다. `npm ci`/`uv sync`/venv 준비를 별도 setup 문서 또는 명시적 준비 API로 제공하고, Start는 이미 준비된 런타임을 실행하는 명령이어야 한다.
- 포트 탐색의 범위를 명확히 하고, child process group 정리·서버 종료 시 정리·spawn 실패 처리를 검증한다.

완료 조건:

- `always_on` 앱을 UI에서 Stop하면 다시 시작하지 않는다.
- 연속 크래시는 제한된 횟수만 재시도하고 UI에서 `crashed` 상태가 보인다.
- 로그 크기 제한과 보관 개수가 동작한다.
- 대시보드 종료 시 관리 중인 프로세스를 의도대로 정리한다.

### 3단계 — secretary_agent 실행 모드와 DB 장애 처리

목표: 대시보드에서 `secretary_agent`를 예측 가능하게 기동하고, DB 문제로 전체 시스템이 재시작 루프에 빠지지 않게 한다.

- `secretary_agent` 저장소의 `.env` 값은 읽거나 출력하지 말고, 형식만 점검한다.
- 실행 모드를 명확히 분리한다.
  - **Compose 모드**: `docker compose`의 API, PostgreSQL, Redis를 같은 네트워크에서 실행한다. `DATABASE_URL`의 호스트는 `db`를 사용한다.
  - **네이티브 Mac 모드**: 대시보드가 `uv run uvicorn`을 실행할 경우, `DATABASE_URL`은 `127.0.0.1` 또는 `localhost`의 로컬 PostgreSQL을 사용한다.
- 각 모드의 안전한 `.env.example`과 시작 절차를 `secretary_agent` 문서 또는 대시보드 운영 문서에 제공한다. `REDIS_URL`, Telegram 등 API 시작에 필수인 설정도 명시한다.
- 앱 시작 전 DB URL의 구성 오류를 사람이 이해할 수 있는 메시지로 판별한다. DNS/포트/인증 실패를 구분하여 대시보드의 `lastError`에 노출하되, URL 사용자명·비밀번호·토큰은 마스킹한다.
- 가능하다면 API의 health endpoint는 DB 연결 불가 시 `degraded` 상태로 응답하도록 한다. DB를 필수로 하는 API 기능은 명확히 503 처리한다. 이 변경은 `secretary_agent`의 테스트가 통과하는 범위에서만 수행한다.
- SQLite fallback은 스키마·마이그레이션·동시성 요구 사항을 확인한 뒤에만 선택한다. 이미 `aiosqlite`가 있어도 PostgreSQL 전용 기능이 있으면 임의 전환하지 말 것.

완료 조건:

- Compose 모드와 네이티브 모드 중 적어도 하나가 문서만으로 재현 가능하다.
- 잘못된 DB 설정은 재시작 폭주 대신 명확한 `crashed/degraded` 상태와 안전한 오류 메시지를 남긴다.
- 올바른 설정에서 `/api/health`가 정상 응답한다.

### 4단계 — registry와 UI 개선

- `projects.json`은 스키마 검증을 추가한다. 이름, 타입, local path, run command, always_on 값이 유효하지 않으면 서버 시작 시 구체적 오류를 제공한다.
- UI는 1회 로딩 후 낡은 상태를 유지하지 않도록 주기적 polling 또는 명시적 새로고침을 제공한다.
- 카드에는 실제 실행 상태, 포트, 마지막 실패 시각, 마지막 오류 요약, 재시도 횟수를 표시한다.
- static HTML 프로젝트는 실제 제공 방식(local static, GitHub Pages, 외부 URL)을 명시적으로 구분한다. 존재하지 않는 `/apps/...` URL을 만들지 않는다.
- `README.md`를 일반 Vite 템플릿 설명에서 운영 문서로 교체한다: 설치, `.env`, 개발/운영 시작, Tailscale 보안, 로그, 서브 프로젝트 준비, 장애 대응을 포함한다.
- `package.json`의 프로젝트 이름을 `progect_dashboard` 또는 npm 규칙에 맞는 동등한 새 이름으로 수정한다.

### 5단계 — 선택 기능: New Project 등록

이 단계는 1~4단계가 완료되고 사용자 승인 후에만 진행한다.

- Repo URL 형식을 검증하고 허용 GitHub 소유자/조직(`emdoc119`)만 받는다.
- clone 경로는 scratch 디렉터리 안으로 제한하고 path traversal, 기존 디렉터리 충돌, `.git` 오염을 방지한다.
- 임의 shell `run_command`를 UI 입력으로 받지 않는다. 검증된 프로젝트 타입별 템플릿을 선택하게 한다.
- clone → 의존성 검사 → registry schema 검증 → `projects.json` 원자적 갱신 순서로 처리한다.
- 어느 단계든 실패하면 불완전 등록을 남기지 않고, 사용자에게 다음 조치를 제공한다.

## 검증 및 인수 기준

1. `npm run build`와 lint를 실행한다. 새 단위 테스트가 있으면 실행한다.
2. 인증 없는 API 요청, 인증된 API 요청, 프로젝트 Start/Stop, `always_on` 수동 Stop, 충돌 재시작 제한, 로그 rotation을 각각 검증한다.
3. `secretary_agent`는 실제 비밀값을 출력하지 않고 health check 및 실패 메시지를 검증한다.
4. Git diff를 점검해 `.env`, 로그, 토큰, DB URL의 자격 증명이 포함되지 않았음을 확인한다.
5. 최종 보고에는 변경 파일 목록, 검증 결과, 남은 위험, 사용자가 직접 설정해야 할 환경 변수만 간단히 포함한다.

## 명시적 제한

- 사용자 승인 없이 서브 프로젝트의 Git 원격 주소, 브랜치, 커밋 이력, 데이터베이스, `.env`를 변경하지 말 것.
- `git reset --hard`, 강제 삭제, 비밀값 출력, 자동 외부 배포를 하지 말 것.
- 외부망 공개가 필요한 경우 Tailscale을 우선하며, 인증 없는 공인 인터넷 노출을 만들지 말 것.
