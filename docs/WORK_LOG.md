# 작업 기록

> 완료된 작업은 **최신순(위에서부터 최근)**으로 정렬. 새 항목은 맨 위에 추가.

## 예정 작업
- **비디오 검색 결과 무한 스크롤**: 현재 `/api/youtube/search`가 `limit=20` 고정. `youtube-search-api`의 `NextPage(token)` 메서드로 서버 pagination 지원 + 클라이언트는 IntersectionObserver로 그리드 끝 감지 시 다음 페이지 append. 작업량 ~1-2시간

## 완료된 작업

### 2026-05-24 - 비디오 페이지를 YT.Player 기반으로 + 차단 감지 안내 UI (invidious 우회 시도 → 포기)
- **시도**: 비디오 페이지의 단순 iframe → YT.Player로 전환하여 `onError(101/150)`로 임베드 차단 감지, `isBlocked=true` 시 invidious(yewtu.be) iframe으로 자동 fallback
- **검증 결과**: invidious 우회 실패. 두 가지 본질적 장벽
  - yewtu.be (그리고 대부분 invidious 인스턴스)가 anti-bot 페이지 + `X-Frame-Options: SAMEORIGIN` 적용 → 우리 도메인 iframe에서 띄울 수 없음
  - TJ/한국 라이선스 영상은 invidious 인스턴스(유럽/북미 IP)가 stream 추출 자체 불가
  - 다른 인스턴스/Piped도 같은 anti-bot 추세 + IP 제한 동일
- **결정**: invidious 우회 코드 제거. 차단 감지 시 영상 자리에 큰 안내 카드 + "YouTube에서 보기" 버튼만 표시
- **유지**: YT.Player 기반 임베드 + onError 차단 감지 흐름은 유지 (단순 iframe 대비 명확한 안내 가능)
- **검토했으나 안 한 대안**: 자체 서버에서 yt-dlp stream 추출 = 한국 IP 호스팅 + 별도 서버 + YouTube 봇 차단 위험으로 trade-off 안 맞음
- 비디오 페이지 player id는 `video-page-player` (음원 `youtube-player`, 어드민 `admin-preview-player`와 격리)

### 2026-05-24 - youtube-nocookie 도메인 적용 (사용자 계정 컨텍스트 분리)
- 음원/어드민 미리듣기/비디오 페이지 모두 `youtube-nocookie.com`으로 변경
  - `utils/youtubePlayer.js`, `components/admin/MusicManagement.vue`: `new YT.Player(...)` 옵션에 `host: 'https://www.youtube-nocookie.com'` 추가 (YT IFrame API 공식 옵션)
  - `pages/video/index.vue`: iframe src를 `youtube.com/embed/` → `youtube-nocookie.com/embed/`
- 효과: 사용자의 youtube 계정 쿠키 안 보냄 → 시청기록/추천 알고리즘 영향 없음, 광고도 비개인화. 재생/컨트롤/이벤트 동작은 동일
- 차단 영상 정책은 동일 (우회는 아님)

### 2026-05-24 - 어드민 미리듣기와 메인 player 인스턴스 격리 (좀비 진짜 원인) + 비디오 영상 크기 fix
- **증상**: 메인에서 음원 재생 → /admin → 음원 추가에서 유튜브 검색/미리듣기 → 메인 복귀 후 음원 재생 안 됨
- **원인**: `components/admin/MusicManagement.vue`가 `utils/youtubePlayer.js` 싱글톤을 import하고 자체 `<div id="youtube-player">`(id 중복)에 mount 시 `YouTubePlayer.init` 호출 → 모듈 스코프의 player 인스턴스/콜백을 어드민 것으로 덮어씀 → 메인 player 잃어버림. 좀비 fix(body div + health check)는 DOM 관점에선 정상이라 잡지 못함
- **해결**: 어드민 미리듣기를 별도 YT.Player 인스턴스로 격리
  - div id: `youtube-player` → `admin-preview-player`
  - utils 모듈 import 제거, 자체 `new YT.Player(...)` 생성 (`initAdminPlayer` 메서드)
  - `beforeDestroy`에서 player.destroy() + setInterval cleanup 추가 (기존엔 setInterval clear도 누락된 상태)
  - 모든 `YouTubePlayer.xxx` 호출 → `this.player?.xxx`로 일괄 변경
- **비디오 페이지 영상 크기 fix**: 데스크탑에서 16:9 영상이 화면 높이 넘치던 문제
  - `aspect-ratio: 16/9` + `max-height: calc(100vh - 16rem)` + sm 이상에선 width를 max-height에 비례 cap하는 CSS로 뷰포트 안에 들어오게. 비율 유지

### 2026-05-24 - 비디오 모드 UX 개선 + 좀비 fix 보강
- **좀비 fix 보강**: `store/player.js` `initializeAudioSystem`에 `#youtube-player` DOM health check 추가
  - 1차 fix(div를 body에 두기)는 "div가 사라지지 않는다"는 낙관 전제였는데, 어떤 이유(hot-reload 잔재 등)로 사라지면 여전히 좀비
  - 매번 mount 사이클에서 `document.body.contains(playerEl)` 확인 → 죽었으면 div 복구 + YT.Player 재init. 큐는 기존 상태 보존
- **비디오 모드 별도 헤더**: `components/VideoHeader.vue` 신설 (← 뒤로가기 + DIBE2 비디오 + UserMenu)
  - 기존엔 `layouts/video.vue`가 `AppHeader`를 그대로 써서 비디오 페이지에 음원 검색 input이 노출되던 어색함 해소
  - 모드 분리 명확 + 복귀 경로(← 또는 로고 클릭) 명시
- **`components/UserMenu.vue` 추출**: 유저 아바타 + 드롭다운 메뉴를 AppHeader/VideoHeader 양쪽에서 재사용
- **`components/AppHeader.vue` 슬림화**: 유저 메뉴 관련 data/computed/methods 제거하여 UserMenu에 위임

### 2026-05-24 - 비디오 검색 페이지 추가 + youtube-player 좀비 이슈 해결 + dev 환경 정비
- **비디오 페이지** (`/video`): 유튜브 검색 → 결과 그리드 → 클릭 시 페이지 내 `<iframe>` 임베드 재생. 음원과 인스턴스 분리, 음원 페이지로 돌아오기 전까지는 둘이 충돌 없음
  - `server/api/youtube.js` 신설 + `GET /api/youtube/search` (services.songService.searchYoutubeForVideo, 길이 필터 없음)
  - `layouts/video.vue` 신설 (AppHeader만, 하단 MusicPlayer 없음). mounted에서 `player/pause` 디스패치하여 음원 일시정지 (큐 상태는 그대로 보존)
  - `pages/video/index.vue`: 모바일 1열 → sm 2열 → lg 3열 그리드, aspect-video iframe
  - `components/AppHeader.vue`: 검색 input과 유저 아바타 사이에 비디오 아이콘 추가 (모바일 포함 항상 표시)
- **youtube-player 좀비 이슈 근본 해결**: `#youtube-player` div를 `layouts/main.vue`가 아닌 `document.body`에 마운트
  - 기존: 메인 → /admin 같은 다른 레이아웃 전환 시 main.vue unmount → DOM 사라짐 → `YT.Player` 인스턴스 좀비화 → 새로고침 필요
  - 해결: `plugins/youtube-init.client.js` 신설, body에 한 번만 마운트 → 어떤 레이아웃 전환에도 DOM 유지
  - `layouts/main.vue`에서 `<div id="youtube-player">` 제거
- **dev 환경 정비** (Netlify 이관 후 잔재 정리)
  - `package.json` dev: `nodemon --watch server --exec "nuxt"` → `"nuxt"`. Express serverMiddleware 시절 잔재로, Netlify Functions 이관 후엔 netlify dev가 functions 핫리로드를 자체 처리하므로 nodemon 불필요. 또한 nodemon이 nuxt 시작을 한 단계 더 감싸 첫 빌드 시간이 netlify-cli targetPort wait timeout(~30초)을 초과하던 문제 동시 해결
  - `netlify.toml`에 `targetPortReadyTimeout = 60` 추가 (안전판)
- **모바일 대응 원칙 문서화**: `CLAUDE.md` 작업 규칙 + `docs/FRONTEND.md`에 가이드 추가

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
