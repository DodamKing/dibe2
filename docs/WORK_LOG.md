# 작업 기록

## 완료된 작업

### 2026-03-29 - docs/ 문서 체계 구축
- CLAUDE.md (프로젝트 진입점) 생성
- docs/ 폴더 생성 및 6개 문서 작성

### 2026-03-30 - AWS→Netlify 이관 작업
- Phase 1~4 완료 (정리, SPA 전환, Functions, 배포 설정)
- Google 로그인 동작 확인
- 주요 디버깅: basePath, session.save(), auth-init 플러그인

## 배포 전 남은 작업
- [ ] Netlify Dashboard 환경변수 설정
- [ ] OAuth 콘솔 콜백 URL 업데이트 (배포 도메인)
- [x] 방문자 통계(dailyVisitor) 미들웨어 등록 및 집계 쿼리 버그 수정
- [x] 관리자 시스템 통계 카드 삭제 (serverless에서 os.cpus 등 무의미)

### 2026-03-30 - JWT 인증 전환
- 세션 기반(express-session + connect-mongo) → JWT 토큰 기반으로 전환 완료
- 서버: auth.js JWT 미들웨어, user.js JWT 발급, OAuth state JWT
- 클라이언트: localStorage 토큰 저장, axios Bearer 헤더, OAuth 리다이렉트 토큰 수신
- express-session/connect-mongo 패키지 제거, session.js 삭제
- 로컬 로그인 테스트 통과

## 예정된 작업 (우선순위순)

### 2. 모바일 백그라운드 재생
- 현재: YouTube IFrame API로 재생 → 모바일에서 화면 꺼지면 재생 중단
- 목표: 화면 꺼져도 음악 계속 재생
- 조사 필요: Web Audio API, Media Session API, PWA + service worker 등
- YouTube IFrame의 제약사항 확인 필요 (YouTube ToS 이슈 가능)

### 3. 노래 검색 UX 개선
- 구체적 개선점 추후 논의 필요
- 가능한 방향: 자동완성, 검색 필터, 최근 검색어, 검색 결과 UI 등

### (추가 작업은 여기에 계속 기록)
