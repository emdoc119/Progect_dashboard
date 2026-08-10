# 2026-08-10 — 레지스트리 정리 및 외부 접속 링크 표시

## 변경 요약

- 운영 대상이 아닌 `Stock-checklist`를 `projects.json` 관리 목록에서 제거했다.
- 프로젝트 API에 `accessLinks`를 추가해 접속 URL과 접속 방식을 함께 제공한다.
- 카드와 상세 화면에서 `Tailscale`, `GitHub Pages`, `Naver Cloud`를 클릭 가능한 라벨로 표시한다.
- 외부 경로가 아직 구성되지 않은 서비스는 링크를 가장하지 않고 `External address not configured`로 표시한다.
- 서버 형태(`serverType`)와 실행 호스트(`runtimeHost`)를 카드와 상세 화면에서 명시한다.

## 운영 영향

- 현재 등록 서비스 수는 5개다.
- 대시보드와 `auto_paper_system`은 대시보드의 Tailscale Serve 경로를 사용한다.
- `assetstyle_stock_dashboard`는 Tailscale 8443 경로를 사용한다.
- `secretary_agent`는 별도 reverse proxy와 애플리케이션 인증 검토가 끝날 때까지 외부 링크를 제공하지 않는다.

## 검증 기준

- `projects.json` JSON 파싱 및 레지스트리 스키마 검증 통과
- `/api/projects` 각 항목에 `serverType`, `runtimeHost`, `accessLinks` 포함
- Vite production build 통과
- 기존 인증·레지스트리 테스트 통과
