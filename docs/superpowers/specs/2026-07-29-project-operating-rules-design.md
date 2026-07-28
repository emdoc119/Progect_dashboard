# Project Operating Rules Design

## Purpose

여러 로컬·원격 프로젝트와 복수 AI 에이전트를 일관된 방식으로 운영하기 위한 공통 규칙을 정의한다. 사용자가 읽는 기준 문서는 `docs/PROJECT_OPERATING_RULES.md`이며, 모든 Codex 프로젝트에 적용되는 실행 지침은 `/Users/choo/.codex/AGENTS.md`에 둔다.

## Chosen Structure

중앙 문서 하나에 모든 프로젝트 이력을 모으지 않는다. 전역 파일에는 공통 정책만 두고, 현재 상태·기술 결정·개발 이력은 각 Git 저장소가 소유한다.

```text
~/.codex/AGENTS.md                 공통 실행 정책
project/AGENTS.md                  프로젝트별 지침
project/docs/PROJECT_STATUS.md     현재 상태
project/docs/DECISIONS.md          중요한 결정
project/docs/development-history/  완료 이력
```

## Model Routing

GPT-5.6 Sol을 메인 오케스트레이터로 사용한다. Qwen 3.8 Max Preview는 구현과 테스트, Gemini 3.6 Flash는 탐색과 요약, Flash Lite는 제공되는 경우 초경량 기계적 작업에 사용한다. 최종 검증과 고위험 판단은 메인이 담당하며 작업 난이도에 따라 reasoning effort를 조절한다.

## Git Safety

중요 작업은 `codex/작업명` 형식의 브랜치에서 검증 후 관련 파일만 커밋·push한다. `main` 또는 `master` 직접 push와 병합은 사용자 확인을 받는다. 비밀정보, 운영 로그와 관련 없는 기존 변경은 커밋하지 않는다.

## Documentation Flow

에이전트는 전체 history 대신 현재 상태 문서를 먼저 읽는다. 중요한 결정과 이정표만 별도 기록하고, 작업 완료 시 실제 코드·운영 상태와 문서를 일치시킨다. 이를 통해 토큰을 절약하면서도 다음 에이전트가 정확한 상태에서 작업을 이어받게 한다.

## Success Criteria

- 전역 정책이 프로젝트와 무관하게 적용된다.
- 사용자가 하나의 읽기 쉬운 문서에서 전체 운영 원칙을 확인할 수 있다.
- 프로젝트별 현재 상태와 과거 이력이 분리된다.
- 중요한 변경은 안전한 Git 체크포인트로 남는다.
- 모델 선택이 비용만이 아니라 위험도와 품질을 함께 반영한다.
