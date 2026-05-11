# 작업 기록

> 완료된 작업은 **최신순(위에서부터 최근)**으로 정렬. 새 항목은 맨 위에 추가.

## 완료된 작업

### 2026-05-11 - localStorage 캐시 stale 해소 (큐/차트 동기화)
- **문제**: 큐의 곡 데이터(특히 가사)가 localStorage에 통째로 캐시되어, DB가 cron으로 갱신되어도 옛 데이터가 계속 표시됨
- **해결 (B 하이브리드 패턴)**: 캐시 즉시 표시 → 백그라운드 fresh fetch → 갱신
- 서버: `POST /api/songs/by-ids`, `GET /api/songs/lyrics/:songId` 신규 (server/services/songService.js, server/api/song.js)
- 클라이언트:
  - 곡 캐시 시 `stripForCache` 헬퍼로 최소 필드만 저장 (`_id, title, artist, coverUrl`). lyrics 제외
  - `refreshQueueData` 액션: `initializeAudioSystem`에서 백그라운드 디스패치 → 큐/currentTrack/originalQueue fresh로 교체
  - `fetchCurrentTrackLyrics` 액션 + `SET_CURRENT_TRACK_LYRICS` mutation: 가사 lazy fetch
  - Playlist.vue: currentTrack watch(immediate)에서 가사 fetch 트리거
  - layouts/main.vue: 차트도 `dibe2_chart_cache` 키로 동일 패턴 적용
- 부수 효과: 모든 필드 stale 자동 해소, localStorage 용량 감소, 홈 첫 로딩 체감 속도 ↑
- 호환성: 기존 localStorage에 lyrics 포함된 데이터 남아도 첫 refresh로 자연 갱신

### 2026-05-11 - JWT 토큰 만료 24시간 → 30일 연장
- `generateToken` 기본 expiresIn `24h` → `30d` (server/middleware/auth.js)
- 매일 재로그인 불편 해소. 구독 만료(expiryDate)는 별도 체크되므로 영향 없음
- docs/AUTH_FLOW.md 동기화

### 2026-04-01 - 크론 중복 로그 정리 + 레거시 코드 제거
- songService.js 중복 완료 로그 제거 (크론 함수에서만 완료 로그 출력)
  - "차트 업데이트 성공", "음원 데이터 저장 완료", "YouTube URL 업데이트 완료", "가사 업데이트 완료" 제거
  - "차트 변경점 없음"은 유지 (의미 있는 정보)
- Netlify 서버리스 전환 후 미사용 레거시 파일 삭제
  - server/middleware/cron.js (node-cron, 서버리스에서 불필요)
  - server/middleware/dailyVisitor.js (미사용)
  - server/middleware/dbConnection.js (models/index.js가 대체)
  - server/api/index.js (구 Express 진입점, netlify/functions/api.js가 대체)

### 2026-03-30 - 검색 팝업 ESC 닫기 + 음원 추가 메시지 수정
- 검색 결과 모달 ESC 키로 닫기 추가 (layouts/main.vue handleKeyDown)
  - Vuex search 스토어의 showSearchResults/closeSearchResults 매핑
  - 로컬 data의 미사용 showSearchResults 제거
- 음원 추가 toast 메시지 [object Object] 버그 수정 (SearchResultsModal.vue)
  - addMultipleToPlaylist 반환 객체를 올바르게 처리
  - 상태별 메시지: 성공(중복 제외 안내), 전체 중복, 큐 가득 참, 큐 공간 부족

### 2026-03-30 - 버그 수정 및 기능 개선
- 인증 미들웨어 이름 불일치 수정 (sessionCheckMiddleware → jwtCheckMiddleware)
- 방문자 통계 미들웨어 등록 + ES module→CommonJS 변환 + 집계 쿼리 버그 수정
- 관리자 시스템 통계 카드 삭제 (serverless에서 무의미)
- 크론잡 스케줄 한국시간 대응 (UTC 변환)
- 검색 결과 모달에 검색 입력 필드 추가 (재검색 UX 개선)
- JWT 토큰 관리 정비: 401일 때만 토큰 삭제, axios 인터셉터 추가, 순환 에러 방지
- /send-slack-message publicPaths 추가, OAuth 쿠키 maxAge 60초→5분

### 2026-03-30 - JWT 인증 전환
- 세션 기반(express-session + connect-mongo) → JWT 토큰 기반으로 전환 완료
- 서버: auth.js JWT 미들웨어, user.js JWT 발급, OAuth state JWT
- 클라이언트: localStorage 토큰 저장, axios Bearer 헤더, OAuth 리다이렉트 토큰 수신
- express-session/connect-mongo 패키지 제거, session.js 삭제
- 로컬 로그인 테스트 통과

### 2026-03-30 - AWS→Netlify 이관 작업
- Phase 1~4 완료 (정리, SPA 전환, Functions, 배포 설정)
- Google 로그인 동작 확인
- 주요 디버깅: basePath, session.save(), auth-init 플러그인
- Netlify Dashboard 환경변수 설정 완료
- OAuth 콘솔 콜백 URL 업데이트 완료 (dibe2.dimad.kr)

### 2026-03-29 - docs/ 문서 체계 구축
- CLAUDE.md (프로젝트 진입점) 생성
- docs/ 폴더 생성 및 6개 문서 작성

## 예정된 작업 (우선순위순)

### 1. 모바일 백그라운드 재생
- 현재: YouTube IFrame API로 재생 → 모바일에서 화면 꺼지면 재생 중단
- 목표: 화면 꺼져도 음악 계속 재생
- 방향: WebView 래핑은 IFrame 한계 동일 → 네이티브 오디오 플레이어 필요 (Flutter `just_audio` + `audio_service` 등). 곡/플레이리스트/검색은 현 API 그대로 재사용
- 자세한 계획: docs/MOBILE_APP_PLAN.md

### 2. 셔플 originalQueue stale 정리
- 현재: `store/player.js` toggleShuffle에서 셔플 ON 시점에 `originalQueue`를 저장하지만, 셔플 OFF 시에도 `originalQueue`를 비우지 않아 localStorage에 옛 데이터가 남음
- 미묘한 버그: 셔플 ON 상태에서 큐를 다른 곡들로 교체한 뒤 셔플 OFF로 돌리면, `originalQueue`가 옛 큐를 가리키고 있어서 그 옛 큐로 복원됨
- 해결 방향: 셔플 OFF 시 `originalQueue` 비우기 + localStorage 키 삭제 / 또는 셔플 OFF인 동안 큐 변경되면 originalQueue도 같이 갱신
- 작업량: 5~15분

### 3. Invidious 잔존 문서 정리
- 실제 코드에서는 Invidious 프록시 사용 안 함 (YouTube IFrame API로 클라이언트가 직접 재생). 관련 서버 코드(advancedInvidiousManager.js, `/stream/:songId` 라우트)는 이미 없음
- 그런데 다음 문서에 Invidious 언급이 stale로 남아있음:
  - `CLAUDE.md` — "오디오 스트리밍은 Invidious 프록시 사용" (주의사항)
  - `docs/ARCHITECTURE.md`
  - `docs/MIGRATION_PLAN.md` — 이건 과거 마이그레이션 계획 스냅샷이라 그대로 둘지 검토
  - `README.md`
- 작업: 각 파일 점검 후 stale 부분 제거 또는 "YouTube IFrame 직접 재생"으로 갱신
- 작업량: 10분

### (추가 작업은 여기에 계속 기록)
