# Phase A 완료 인계서 — 운영 단일 origin

## 상태

Phase A(운영 단일 origin)는 2026-07-20에 완료 및 검증됐다. 다음 담당자는 이 문서를 읽은 뒤 `ANTIGRAVITY_EXECUTION_PLAN.md`의 **Phase B만** 진행한다. Phase A 코드를 다시 구조 변경하지 않는다. Phase A 수정은 아직 커밋되지 않았으므로 기존 작업 트리 변경을 보존한다.

## 완료된 구현

### 운영 UI 및 인증 경로

- `server.js`가 빌드 결과물 `dist/`를 Express로 제공한다.
- Basic Auth middleware는 API와 정적 UI 이전에 적용된다.
- Express 5와 호환되지 않는 `app.get('*')` fallback을 제거하고, API·`/apps`·정적 asset 요청을 침범하지 않는 SPA fallback middleware를 사용한다.
- `dist/`가 없을 때 `/`는 `npm run build`를 안내하는 503을 반환한다.

### 명령 및 환경 설정

- `npm run start`: production Express 서버만 실행한다.
- `npm run dev`: API 서버 + loopback Vite dev server를 실행한다.
- `DASHBOARD_AUTOSTART=false`: `always_on` 서브 프로젝트를 기동하지 않는 안전한 검증 모드다.
- `.env.example`과 README에 `DASHBOARD_AUTOSTART` 및 dev/production 시작 방법이 반영됐다.

## 검증 완료

- `npm run lint` 성공
- `npm run build` 성공
- `DASHBOARD_AUTOSTART=false`로 `server.js` import 성공
- 외부 bind + 인증 변수 누락 시 서버가 시작을 거부함
- 임시 loopback 서버에서 다음을 확인함
  - 미인증 `GET /` → 401
  - 인증된 `GET /` → 200 및 React root HTML
  - 인증된 `GET /api/projects` → 200

실제 관리 서브 프로젝트는 실행하지 않았다.

## 다음 작업: Phase B만 수행

목표는 하위 앱의 동적 포트를 외부(Tailscale 포함)에 노출하지 않는 것이다. 이번 Phase에서는 reverse proxy를 구현하지 않는다.

### 수정 대상

- `projects.json`
- `server.js`
- `src/components/ProjectCard.jsx`
- `README.md`
- Phase B에 필요한 최소 테스트 파일/명령

### 확정된 설계

1. 각 동적 프로젝트에 `exposure: "loopback"`을 추가한다.
2. 동적 프로젝트의 `run_command`는 host를 하드코드하지 않고 `{host}` placeholder를 사용한다.
3. server는 `exposure === "loopback"`일 때만 `{host}`를 `127.0.0.1`로 치환한다. 외부 host 값은 registry에서 허용하지 않는다.
4. 명령 형식은 다음을 사용한다.
   - `secretary_agent`: `uv run uvicorn src.main:app --port {port} --host {host}`
   - Streamlit 프로젝트: `--server.address {host}`를 추가
   - Next.js: 해당 CLI의 hostname option에 `{host}`를 사용
5. registry load 때 최소 schema 검증을 추가한다. 동적 프로젝트는 유효한 `exposure`과 `{host}`를 갖지 않으면 Start API가 실행을 거부해야 한다.
6. 원격 브라우저에서 ProjectCard의 하위 앱 열기는 계속 차단한다. URL hostname을 원격 hostname으로 치환하지 않는다.
7. `auto_paper_system`의 실제 제공 방식 결정과 reverse proxy는 Phase B 범위 밖이다. 존재하지 않는 링크를 만들지 않는다.

### Phase B 검증

- `rg -n '0.0.0.0|--server.address|{host}|exposure' projects.json`으로 FastAPI의 외부 bind가 제거됐음을 확인한다.
- server의 registry validation unit test를 추가하거나 최소한 `{host}`가 `127.0.0.1`로만 치환되는 순수 helper test를 추가한다.
- `npm run lint`, `npm run build`, `npm test`(추가했다면)를 실행한다.
- 실제 서브 프로젝트는 실행하지 않는다. 필요하면 `DASHBOARD_AUTOSTART=false`를 사용한다.

## 이미 존재하는 후속 작업

Phase B가 끝나면 `ANTIGRAVITY_EXECUTION_PLAN.md`의 Phase C → E를 한 단계씩 진행한다. 특히 Phase C의 서버 측 오류 마스킹은 일부 코드가 이미 들어가 있으므로, 중복 구현 대신 테스트·timer 정리·중복 log stream 종료 방지 관점에서 점검한다.
