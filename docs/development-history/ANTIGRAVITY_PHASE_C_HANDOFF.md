# Phase C 완료 인계서 — 오류 처리와 ProcessManager 경계 보강

## 상태

Phase C(오류 처리와 ProcessManager 경계 보강)는 2026-07-21에 완료 및 검증됐습니다. 다음 담당자(Codex 등)는 이 문서를 확인한 뒤 `ANTIGRAVITY_EXECUTION_PLAN.md`의 **Phase D(단위 테스트 및 시스템 통합 검증)** 작업을 지시/진행하시면 됩니다.

## 완료된 구현 (변경 파일)

### 1. `server.js` (오류 마스킹 및 타이머 제어 보강)
- **비밀값 마스킹(`maskSecretData`) 강화**: `postgresql://` 등 비-HTTP 스키마를 포함한 DB 연결 문자열 내부의 계정 정보와, 따옴표로 감싸진 토큰 값(`token="secret"`)까지 모두 `***`로 안전하게 마스킹하도록 정규식을 개선했습니다.
- **스트림 누수 방지(`closeLogStream`)**: 자식 프로세스의 `error` 이벤트와 `close` 이벤트가 경합할 때 로그 스트림(`logStream`)이 중복 종료되거나 누수되지 않도록 헬퍼 함수를 신설해 일원화했습니다.
- **예약된 재시작 타이머 취소 보장**: `Watchdog`에 의해 예약된 백오프 타이머(`restartTimer`)를 상태에 보관하고, **수동 정지(Stop)**, **수동 시작(Start)**, **서버 종료(SIGINT/TERM)** 시 명시적으로 `clearTimeout`을 호출하여 의도치 않은 좀비 프로세스 생성을 차단했습니다.

### 2. `test/process_manager.test.js` (신규 테스트)
- 서버 측 에러 마스킹이 정상적으로 작동하는지 확인하기 위해 유닛 테스트를 신설했습니다.
- DB URL 계정, 일반 `key=value`, 따옴표로 묶인 `token="value"` 등을 검증하는 케이스를 포함합니다.

## 검증 완료 내역

- `DASHBOARD_AUTOSTART=false` 환경에서 검증을 수행하여 실제 서브 프로젝트 기동을 차단했습니다.
- `npm run lint`: 경고 0, 오류 0건 통과
- `npm test`: 신설된 Phase C 마스킹 테스트 4건을 포함하여 총 7건의 테스트 케이스 100% 통과

## 남은 위험 (Risks) / 다음 Phase 고려사항

- 마스킹 로직 정규식은 표준적인 `key=value` 형태에 최적화되어 있으므로, 깊게 중첩된 대용량 JSON 포맷 에러 전체를 탐지하는 데는 한계가 있을 수 있습니다. (현재 수준으로도 화면 노출 방지에는 충분합니다.)
- **다음 단계는 Phase D (단위 테스트 및 시스템 통합 검증)입니다.**
- Phase D에서는 `node --test` 기반의 포괄적인 테스트 스위트를 마저 완성(Basic Auth 및 통합 엣지 케이스 등)해야 합니다.
