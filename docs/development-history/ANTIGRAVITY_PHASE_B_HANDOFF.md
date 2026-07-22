# Phase B 완료 인계서 — 하위 앱 네트워크 노출 차단

## 상태

Phase B(하위 앱 네트워크 노출 차단)는 2026-07-21에 완료 및 검증됐습니다. 다음 담당자(Codex 등)는 이 문서를 확인한 뒤 `ANTIGRAVITY_EXECUTION_PLAN.md`의 **Phase C** 작업을 지시/진행하시면 됩니다. 

## 완료된 구현 (변경 파일)

### 1. `projects.json` (Registry 업데이트)
- 모든 동적 프로젝트(FastAPI, Streamlit, Next.js)에 `"exposure": "loopback"` 속성을 추가했습니다.
- `run_command` 내에 하드코딩되어 있던 `0.0.0.0` 또는 `127.0.0.1` IP를 제거하고, 모두 `{host}` 플레이스홀더로 교체했습니다.

### 2. `server.js` (보안 바인딩 강제화)
- `startProject()` 함수 내부 로직을 수정하여, 동적 앱의 `exposure` 값이 `loopback`이 아니거나 `run_command`에 `{host}`가 없으면 400 에러를 반환하며 실행을 단호히 거부합니다.
- 검증 통과 시 `{host}`를 오직 `127.0.0.1`로만 안전하게 치환하여 하위 프로세스를 spawn합니다.

### 3. `test/registry.test.js` & `package.json` (테스트 자동화)
- `package.json`에 `"test": "node --test"` 스크립트를 추가했습니다.
- Node.js 내장 test runner를 활용해 Phase B의 요구사항(`exposure` 검증, `{host}` 포함 여부, 하드코드 IP 미포함)을 검사하는 단위 테스트를 신설했습니다.

## 검증 완료 내역

- `DASHBOARD_AUTOSTART=false` 환경에서 검증을 수행하여 실제 서브 프로젝트 기동을 차단했습니다.
- **포트 바인딩 제거 확인**: `projects.json` 대상 정규식 검사로 `0.0.0.0` 바인딩이 전부 제거되었음을 확인했습니다.
- `npm run lint`: 경고 0, 오류 0건 통과
- `npm run build`: 성공
- `npm test`: Phase B Registry 테스트 스위트 100% 통과

## 남은 위험 (Risks) / 다음 Phase 고려사항

- 원격 기기(Tailscale 등)에서 대시보드 접근 시, 하위 앱(`infinite_buying_V4` 등)의 화면을 직접 브라우저로 띄워볼 수는 없습니다. (역방향 프록시 없이 127.0.0.1로 묶였기 때문)
- Phase B에서는 요구사항에 따라 Reverse Proxy를 도입하지 않고 강력한 **차단**에만 집중했습니다. 외부 접근이 향후 필수가 된다면 별도 안건으로 프록시 구축이 필요합니다.
- 다음 단계인 **Phase C (오류 처리와 ProcessManager 경계 보강)**를 진행할 준비가 되었습니다.
