# Progect_dashboard 진행 상태 분석 및 업그레이드 계획서

> 작성일: 2026-07-22
> 작성: Codex (GPT-5.6) — Antigravity 인계용
> 대상 저장소: emdoc119/Progect_dashboard
> 로컬 경로: ~/.gemini/antigravity/scratch/Progect_dashboard

---

## 1. 현재 상태 요약

### 완료된 마일스톤 (Phase A ~ E)

| Phase | 내용 | 상태 |
|-------|------|------|
| A | 단일 Origin 구축 (Express 3001에서 UI+API+Auth) | ✅ 완료 |
| B | 하위 앱 loopback 강제 ({host} placeholder, exposure 검증) | ✅ 완료 |
| C | 오류 마스킹, 로그스트림 누수 차단, 백오프 타이머 안전 취소 | ✅ 완료 |
| D | node --test 기반 39개 통합 테스트 | ✅ 완료 |
| E | 레지스트리 스키마 검증, README/문서 정비 | ✅ 완료 |

### 검증 결과 (로컬 Mac 기준)

- `npm test`: 39/39 통과
- `npm run lint`: 경고 0, 오류 0
- `npm run build`: 정상
- Basic Auth + SPA 서빙 + API 인증 플로우 확인됨

### Git 상태 (미커밋)

현재 저장소에 Phase A~E 변경사항이 **아직 커밋되지 않은 상태**다.

```
 M .gitignore, README.md, package.json, package-lock.json
 M projects.json, server.js, vite.config.js
 M src/App.jsx, src/components/Dashboard.jsx, src/components/ProjectCard.jsx, src/index.css
?? .env.example, docs/, ecosystem.config.cjs, portal-site/
?? src/components/StatusBadge.jsx, test/
```

---

## 2. 아키텍처 현황

```
Progect_dashboard/
├── server.js              # Express 백엔드 (ProcessManager, Watchdog, Auth, Log Rotation)
├── projects.json          # 6개 서브 프로젝트 레지스트리
├── src/                   # React 프론트엔드 (Vite)
│   ├── App.jsx            # 3초 폴링 → /api/projects
│   └── components/
│       ├── Dashboard.jsx  # 카테고리 필터, 검색, 통계
│       ├── ProjectCard.jsx # Start/Stop, 상태 배지, 에러 표시
│       └── StatusBadge.jsx # 상태별 애니메이션 배지
├── test/                  # 7개 테스트 파일 (node --test)
├── dist/                  # 빌드 결과물 (production 서빙)
├── portal-site/           # GitHub Pages용 Tailscale 포털
├── ecosystem.config.cjs   # PM2 설정
└── .env.example           # 환경변수 가이드
```

### 핵심 동작

- **ProcessManager**: `child_process.spawn` + 동적 포트 (4000~), `tcp-port-used`로 충돌 회피
- **Watchdog**: always_on 프로젝트 크래시 시 지수 백오프 (5s→60s cap), 최대 5회, 60초 안정 시 리셋
- **Log Rotation**: `rotating-file-stream` (10MB/일/5파일)
- **Auth**: `express-basic-auth` + `crypto.timingSafeEqual`, 외부 bind 시 필수
- **보안**: 동적 앱은 127.0.0.1 바인딩 강제, 에러 마스킹, 원격 서브앱 접근 차단

---

## 3. 미해결 과제 (원본 브리핑 기준)

| # | 과제 | 현재 상태 | 우선순위 |
|---|------|-----------|----------|
| 1 | secretary_agent DB 연결 오류 | always_on: false, stopped | 🔴 높음 |
| 2 | 로그 로테이션 | ✅ 완료 (rotating-file-stream) | — |
| 3 | 인증 보안 | ✅ 완료 (Basic Auth + timing-safe) | — |
| 4 | 신규 프로젝트 동적 등록 (git clone) | 미구현 | 🟡 중간 |

---

## 4. 업그레이드 계획 (Phase F ~ J)

### Phase F — Git 정리 및 배포 준비 [즉시]

**목표**: 현재 미커밋 상태를 정리하고 GitHub에 동기화한다.

**작업**:
1. `.gitignore` 최종 확인 (logs_*.txt, .env, node_modules, dist 제외 확인됨)
2. 의미 있는 단위로 커밋 분리:
   - `feat: single-origin production server with Basic Auth (Phase A)`
   - `feat: loopback enforcement and exposure validation (Phase B)`
   - `fix: error masking, log stream lifecycle, backoff safety (Phase C)`
   - `test: 39 integration tests with node --test (Phase D)`
   - `docs: registry validation, README overhaul, env guide (Phase E)`
3. `git push origin main`
4. portal-site GitHub Pages 배포 확인 (`npm run deploy-portal`)

**완료 기준**: GitHub 저장소에 모든 Phase가 반영되고, CI 없이도 `npm test && npm run build`가 통과하는 상태.

---

### Phase G — secretary_agent Graceful Degradation [1순위]

**목표**: DB 없이도 서버가 기동되고, 대시보드에서 "DB 연결 대기 중" 상태를 표시한다.

**배경**: `socket.gaierror: nodename nor servname provided` — Docker 서비스명(`db`)이 native에서 해석 불가.

**작업**:
1. `secretary_agent/personal-agent-os/.env`에 `DATABASE_URL=postgresql://user:pass@127.0.0.1:5432/agent_db` 가이드 추가
2. `src/main.py` 또는 `src/session.py`에 DB 연결 실패 시 graceful fallback:
   - FastAPI lifespan에서 DB ping 실패 → `db_status: "disconnected"` 상태로 서버 유지
   - `/health` 엔드포인트에 `{"status": "degraded", "db": "disconnected"}` 응답
3. 대시보드 `projects.json`에 `health_check_url` 필드 추가 (Optional)
4. `always_on: true`로 복원 후 Watchdog이 DB 복구 시 자동 정상 전환 확인

**완료 기준**: PostgreSQL 미기동 상태에서도 secretary_agent가 크래시 없이 기동되고, 대시보드에 degraded 상태가 표시됨.

---

### Phase H — 실시간 상태 업데이트 (SSE) [2순위]

**목표**: 3초 폴링을 Server-Sent Events로 대체하여 즉각적 상태 반영.

**작업**:
1. `server.js`에 `GET /api/events` SSE 엔드포인트 추가
   - 프로젝트 상태 변경 시 `event: status_change` 발행
   - 30초마다 heartbeat (`event: ping`)
2. `App.jsx`에서 `EventSource('/api/events')` 사용
   - 연결 실패 시 3초 폴링으로 자동 폴백
3. 기존 `GET /api/projects`는 초기 로드용으로 유지

**완료 기준**: Start/Stop 클릭 후 1초 이내에 UI 상태가 갱신됨. 네트워크 끊김 시 폴링 폴백 동작.

---

### Phase I — 신규 프로젝트 동적 등록 [3순위]

**목표**: 대시보드 UI에서 GitHub URL 입력 → git clone → projects.json 등록까지 자동화.

**작업**:
1. `server.js`에 `POST /api/projects/register` 추가
   - Body: `{ "github_repo": "emdoc119/new_project", "type": "python-streamlit", ... }`
   - `simple-git`으로 `~/.gemini/antigravity/scratch/<name>`에 clone
   - `projects.json`에 append + 스키마 검증
2. 프론트엔드 "New Project" 모달:
   - GitHub URL, 프로젝트 타입, always_on 여부 입력
   - 등록 성공/실패 피드백
3. `DELETE /api/projects/:name` (등록 해제, 로컬 파일은 삭제하지 않음)
4. 보안: 등록 API도 Basic Auth 보호 하에 동작

**완료 기준**: UI에서 새 프로젝트 등록 후 대시보드에 즉시 표시되고, Start 버튼으로 실행 가능.

---

### Phase J — 로그 뷰어 및 운영 개선 [4순위]

**목표**: 대시보드에서 각 프로젝트 로그를 실시간 확인.

**작업**:
1. `GET /api/projects/:name/logs?lines=100` — 최근 N줄 반환
2. `GET /api/projects/:name/logs/stream` — SSE로 실시간 로그 스트리밍
3. ProjectCard 확장: "Logs" 버튼 → 모달 또는 하단 패널에 로그 표시
4. 로그 검색/필터 (간단한 텍스트 grep)

**완료 기준**: 대시보드에서 프로젝트 로그를 실시간으로 볼 수 있고, 크래시 원인 파악이 SSH 없이 가능.

---

## 5. 우선순위 및 권장 순서

```
Phase F (Git 정리) ← 즉시, 10분
    ↓
Phase G (secretary_agent) ← 가장 시급한 운영 이슈
    ↓
Phase H (SSE 실시간) ← UX 체감 개선
    ↓
Phase I (동적 등록) ← 확장성
    ↓
Phase J (로그 뷰어) ← 운영 편의
```

---

## 6. Antigravity 실행 가이드

### Phase F 실행 프롬프트

> `/Users/choo/.gemini/antigravity/scratch/Progect_dashboard`에서 `docs/development-history/STATUS_AND_UPGRADE_PLAN.md`를 읽어줘. Phase F(Git 정리 및 배포 준비)를 실행해줘. 미커밋 변경사항을 Phase별로 의미 있는 커밋으로 분리하고, `git push origin main`까지 완료해줘. 완료 후 커밋 해시 목록만 보고해줘.

### Phase G 실행 프롬프트

> `STATUS_AND_UPGRADE_PLAN.md`의 Phase G(secretary_agent Graceful Degradation)를 실행해줘. secretary_agent 로컬 경로(`~/.gemini/antigravity/scratch/secretary_agent/personal-agent-os`)에서 작업하고, DB 없이도 기동되도록 수정해줘. 실제 PostgreSQL은 설치하지 마. 완료 후 변경 파일과 검증 결과만 보고해줘.

### Phase H 실행 프롬프트

> `STATUS_AND_UPGRADE_PLAN.md`의 Phase H(SSE 실시간 상태 업데이트)를 실행해줘. server.js에 SSE 엔드포인트를 추가하고, App.jsx를 EventSource 기반으로 전환해줘. 폴링 폴백도 유지해줘. 완료 후 `npm test && npm run build` 결과를 보고해줘.

---

## 7. 기술 부채 및 참고사항

- `portal-site/`의 Tailscale IP(`100.67.149.56`)가 하드코딩됨 → 환경변수화 고려
- `apps/` 디렉토리에 7개 서브 프로젝트 심볼릭/복사본 존재 — 용도 확인 필요
- `simple-git` 의존성은 이미 설치됨 (Phase I에서 활용 가능)
- Express 5 사용 중 — `app.get('*')` 대신 미들웨어 폴백 패턴 적용됨
- `ecosystem.config.cjs` (PM2)는 production 배포 시 활용 가능

---

*이 문서는 Antigravity가 "이전처럼 확인하고 진행해"라는 지시만으로 다음 Phase를 이어서 실행할 수 있도록 작성되었다.*
