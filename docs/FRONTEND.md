# 프론트엔드 구조

## 폰트
- 전역 폰트: **Pretendard** (jsDelivr CDN, `nuxt.config.js` head.link) — `tailwind.config.js`의 `theme.extend.fontFamily.sans`에 등록, Tailwind preflight가 `html`에 자동 적용하는 구조라 별도 클래스 지정 없이 앱 전체에 적용됨

## 아이콘
- **`components/Icon.vue`** — 가는 선 아이콘(Lucide 모양, ISC)을 쓰는 것만 SVG로 넣은 컴포넌트. `<Icon name="play" :size="20" filled />`. 색은 글자색(currentColor)
  - 2026-11에 Font Awesome 6 CDN을 **사이트 전체에서** 걷어냈다(관리자 화면 포함). 새 아이콘은 lucide.dev 의 path 를 `ICONS`에 추가
  - 🔴 `<Icon @click>`은 **안 먹는다**(Vue 2 컴포넌트엔 `.native` 필요) — 누르는 아이콘은 `<button>`으로 감쌀 것
- `components/CoverImg.vue` — 곡 커버. 유튜브 썸네일(`hqdefault`)은 위아래 검은 띠가 박혀 있어 `video` 를 주면 띠만큼 확대해 잘라낸다
- `components/BackButton.vue` — 뒤로가기(배경 없는 화살표, 올리면 옅은 원). 제목 바로 왼쪽. 돌아갈 곳이 없으면 `fallback`
- **체크박스는 `assets/css/global.css`** 에서 전역으로 꾸민다(어두운 테두리 → 체크하면 보라). 클래스 안 붙여도 된다
- 창(모달)은 같은 틀: 어두운 카드 `bg-surface-2`, 모바일은 아래 시트·데스크탑은 가운데, Esc·바깥 누르면 닫기 — `SongMenuSheet`·`CreatePlaylistModal`·레이아웃의 "담기" 시트

## 레이아웃
- `layouts/main.vue` ★ 핵심 레이아웃
  - AppHeader, MusicPlayer(하단 미니 플레이어), NowPlaying(지금 재생 중), QueuePanel(재생 대기열) 포함. 겹침: 데스크탑 미니 플레이어(50) > 대기열(46) > 지금 재생 중(45) / 모바일 지금 재생 중(55, 미니 플레이어까지 덮음) < 대기열(60). Esc 는 위에 뜬 것부터 닫는다
  - provide/inject 패턴으로 자식에게 메서드/데이터 전달
  - 차트 fetch, 플레이리스트 CRUD, 곡 추가 모달 등 관리
- `layouts/auth.vue`: 로그인/회원가입 전용
- `layouts/video.vue`: 비디오 페이지 전용 (VideoHeader만 — 미니플레이어/오버레이는 레이아웃이 아니라 `pages/video/index.vue` 자체가 렌더링). mounted에서 `player/pause` 디스패치하여 음원 일시정지. 모바일 44px 터치영역 미디어쿼리 포함(`layouts/main.vue`와 별도 적용 필요)

## 페이지
| 경로 | 파일 | 레이아웃 | 설명 |
|------|------|----------|------|
| `/` | `pages/index.vue` | main | 홈 — 내 플레이리스트(첫 칸 "좋아요한 곡" 고정, 커버 큰 정사각 카드) + Top 100 미리보기 10곡(국내/해외 전환, 전체 재생, 전체 보기). 플리 삭제는 홈에 없고 상세 페이지에서 |
| `/chart` | `pages/chart.vue` | main | Top 100 전체. `?type=pop`이면 해외. 선택 도구줄(전체 선택 → 선택 곡 담기 = 레이아웃의 플리 선택 모달), 전체 재생 |
| `/liked` | `pages/liked.vue` | main | 좋아요한 곡(`GET /api/songs/liked`, 100곡씩 더 보기). 하트를 취소해도 목록에서 바로 빼지 않는다(실수 되돌리기). 불러오기 실패는 "없음"이 아니라 "다시 시도"로 |
| `/login` | `pages/login.vue` | auth | 로그인 (구글/카카오 소셜 로그인만 — 아이디/비밀번호 폼 없음). 좌측 브랜드 패널 + 우측 로그인 패널 2단 레이아웃(모바일은 세로 스택). 소셜 버튼(`SocialLoginButton.vue`)은 각 사 공식 버튼 가이드(색상/라벨/radius) 준수, 카카오 말풍선 심볼은 근사치 SVG(공식 에셋 아님) |
| `/register` | `pages/register.vue` | auth | 회원가입 (현재 막혀있음) |
| `/subscription-notice` | `pages/subscription-notice.vue` | - | 구독 만료 안내 |
| `/playlist/:id` | `pages/playlist/_id.vue` | main | 플레이리스트 상세(좋아요·테마 상세와 같은 틀, `SongRow`). 줄 클릭 = 이 플리를 그 곡부터. 곡 빼기는 ⋯ 메뉴(`SongMenuSheet removable`), 이름은 눌러서 고침. 스토어의 `currentPlaylist` 는 지난번 플리일 수 있어 주소 id 와 같을 때만 그린다 |
| `/theme` | `pages/theme/index.vue` | main | 테마 9개 카드(`GET /api/themes`, `store/themes.js`가 한 번 받아 홈과 공유) |
| `/theme/:key` | `pages/theme/_key.vue` | main | 테마 50곡(`GET /api/themes/:key`). 곡은 유튜브 영상 — 대기열에 `kind:'video'`로 들어간다. ⋯ 메뉴는 다음에 재생·맨 뒤 추가만(좋아요·담기 없음) |
| `/admin` | `pages/admin/index.vue` | main | 관리자 대시보드 |
| `/video` | `pages/video/index.vue` | video | 유튜브 검색 + 영상 재생 (음원과 독립). 내부 탭으로 "검색"/"보관함" 전환 (라우트 이동 없음). "지금 재생 중"은 탭과 분리된 별도 오버레이 |

## Vuex 스토어
| 모듈 | 파일 | 역할 |
|------|------|------|
| `auth` | `store/auth.js` | 로그인 상태, user 객체 |
| `player` | `store/player.js` | 재생 대기열(2구역), 현재곡, 재생 상태, 볼륨, 셔플, 반복. 대기열 계산은 `utils/queue.js` |
| `themes` | `store/themes.js` | 테마 목록(세션 동안 한 번만 받음) |
| `playlist` | `store/playlist.js` | 내 플레이리스트 CRUD |
| `videoQueue` | `store/videoQueue.js` | 비디오 재생 큐, 현재 영상, 셔플/반복(player.js와 동일 패턴). 볼륨은 페이지 로컬 YT.Player가 직접 관리(스토어에 없음). localStorage 캐싱은 player.js와 동일 패턴 |
| `videoPlaylist` | `store/videoPlaylist.js` | 내 비디오 플레이리스트 CRUD (`store/playlist.js`와 동일 패턴, `/api/video-playlists`) |
| `search` | `store/search.js` | 검색 상태 |
| `likes` | `store/likes.js` | 좋아요 공유 상태(키 = Song._id). 차트·좋아요 목록·하단 플레이어가 같은 값을 본다. 누르면 먼저 바꿔 보여주고 실패하면 되돌림. 채우는 곳: 차트 응답의 `liked`(키는 **`songId`** — 차트 항목 `_id`는 곡이 아님), `/by-ids`(큐 새로고침), 현재 곡을 모르면 `ensure`. 로그아웃 시 RESET |

### player 스토어 주요 동작
- **재생 대기열 = 2구역**(2026-11, 스포티파이·애플뮤직 방식, 설계 `docs/PLAYER_V2_PLAN.md`)
  - `upNext` "다음에 재생" — 직접 넣은 곡(⋯ 메뉴·검색·선택 곡 추가). 항상 먼저 나오고 재생되면 빠진다. **한도 1000곡은 여기에만**
  - `context` "다음: ○○에서" — 지금 듣는 목록 `{source, items, order, pos}`. 줄 클릭·전체 재생·셔플 재생이 통째로 바꾼다(upNext 는 지킨다). 한도 없음
  - 계산은 전부 **`utils/queue.js` 순수 함수**(다음·이전·셔플·빼기·순서 바꾸기·옛 큐 변환), 테스트 `tests/queue.test.mjs`(`npm test`)
  - 항목 `{qid, kind:'song'|'video', _id?, videoId?, title, artist, coverUrl}` — **곡 비교는 `qid`**(같은 곡 중복·유튜브 곡 가능). 가사 받기·재생수(`playTally.trackId`)·이어듣기 위치도 qid 기준
  - `kind:'video'`(테마 곡)는 가사·재생수·하트·`/by-ids` 를 전부 건너뛴다
  - 곡 id 가 없는 차트 항목은 **재생 직전에** `/songdata` 로 찾는다(`resolveVideoId`) — 100곡을 미리 다 찾지 않는다
  - 다음: 곡이 끝나서(`{auto:true}`) 한 곡 반복이면 같은 곡, 사용자가 누른 다음·미디어 키는 넘어간다. 이전: 3초 넘게 들었으면 처음으로
  - 재생 실패(유튜브 주소 없음·임베드 차단 onError) → 알림 + 다음 곡, **5번 연속**이면 멈춤
- `localStorage` `user_{id}_player_v2` 한 키에 `{currentTrack, upNext, context, history, shuffleOn}`(표시 최소 필드만 — `stripItem`). 볼륨·반복·위치는 따로
  - **옛 형식(`queue`·`original_queue`·`current_track`·`shuffle`)은 v2 키가 없을 때 한 번 변환**해 "이전 재생목록" context 가 된다(셔플 중이었으면 `original_queue`가 원래 순서). 🗑️ 옛 키는 롤백 대비로 안 지웠다 — 다음 릴리스에서 정리
  - lyrics는 캐시 안 함 (곡이 바뀔 때 `setCurrentTrack`이 `/api/songs/lyrics/:id`로 fetch — `fetchCurrentTrackLyrics`)
    - **서버가 가사를 즉석에서 채울 수 있어(lazy fill) 최대 1초쯤 걸린다.** 그래서 요청 시점의 `qid`와 응답 시점의 `currentTrack.qid`를 비교해 **늦게 온 응답을 다음 곡에 붙이지 않는 가드**가 있다
    - 응답은 `{lyrics, adult}`. `LyricsView.vue`가 다섯 가지를 구분한다 — 유튜브 곡 / **19금**(벅스가 성인 인증을 요구해 원리적으로 못 받음) / 가사 / `undefined`(아직 응답 전 = 로딩) / `''`(받아왔는데 없는 곡). 싱크 가사를 끼울 자리(`lines`)가 있다
    - 🔴 **`refreshQueueData` 는 `currentTrack` 의 `lyrics`/`adult` 를 살린다.** `/by-ids` 응답엔 lyrics 가 없어서 그대로 덮으면 **방금 채운 가사가 지워진다**(2026-07-17 레이스). 지금은 표시 필드(title·artist·coverUrl)만 합친다 — qid·kind 도 지켜야 해서
- `initializeAudioSystem` 시작 시 캐시 대기열 즉시 표시 후, `refreshQueueData` 백그라운드 디스패치 → `/api/songs/by-ids`로 fresh 데이터 받아 갱신
  - `/by-ids` 응답엔 2026-07-15부터 `liked`/`likeCount`/`playCount`가 **추가로** 실려 온다(앱 하트 UI용). 기존 4필드는 그대로라 웹은 무영향이고, `stripForCache`가 표시 최소 필드만 남기므로 **localStorage엔 안 들어간다**(메모리 큐엔 실려 있음) — 웹에서 하트를 쓸 거면 이미 받아둔 값이라 추가 요청 불필요
- 차트는 `layouts/main.vue` `fetchPopularChart`에서 `dibe2_chart_cache` 키로 동일한 캐시-즉시-표시 + 백그라운드-refresh 패턴 사용
- YouTube IFrame API로 재생 (`utils/youtubePlayer.js`)
- **재생 수 기록**(`tallyPlay`, 2026-10-31~): 앱과 같은 기준 — 이 곡을 실제로 **30초 또는 절반** 들으면 `POST /api/songs/:id/play` 1회(`source: 'unknown'`, 웹은 출처를 추적하지 않음). 1초 폴링 횟수가 아니라 **경과 시간**으로 더한다(좀비 복구로 폴링이 겹쳐도 두 배로 안 세게). 곡이 끝나면(ENDED) 비워서 한 곡 반복도 매번 센다
- **화면 아래 알림**: `state.notice`(`SET_NOTICE`) → `layouts/main.vue`가 토스트로 띄우고 비운다. 재생 실패·좋아요 실패·"다음에 재생할게요" 등 (예전엔 없는 `SET_ERROR_MESSAGE`를 불러 실패 시 에러만 났다)
- **목록에서 곡 한 줄 누르기 = `playList({source, songs, idKey, index})`**: 그 목록 전체를 그 곡부터. 홈은 10줄만 보여도 차트 100곡이 목록. `idKey` 는 곡 id가 든 필드 — 차트·플리 `songId`, 좋아요·검색 `_id`
- 반복 모드: off → all → one
- **재생 위치 기억** (`user_{id}_position`에 `{trackId, time}`, 비디오 `user_{id}_video_position`과 동일 패턴, 마지막 곡 1개만): `updateTrackProgress`의 1초 polling 중 재생 중일 때 + `pause` 시 저장. 단, 음원 싱글톤 플레이어(`utils/youtubePlayer.js`)는 새로고침 직후엔 곡을 아예 로드 안 하고 실제 `play()` 호출 시에야 `loadVideoById`로 로드되므로, 비디오처럼 재생 전에 진행바로 미리 보여줄 수는 없음 — 대신 `initializeQueue`에서 복원한 값을 `state.resumePosition`(`currentTime`과 별개)에 잠깐 들고 있다가 소비
  - **seek 타이밍 주의**: `play()` 액션의 `loadVideoById` 호출 직후 바로 `seekTo`를 하면 새 영상이 아직 버퍼링 전이라 씹히는 경우가 있음 — 그래서 `resumePosition` 소비(`youtubePlayer.seek()` + `null`로 비움)는 `play()`가 아니라 `initYoutubePlayer`의 `onStateChange`가 실제 `PLAYING`을 보고하는 시점에서 처리

## 주요 컴포넌트
- `MusicPlayer.vue`: 하단 미니 플레이어. 왼쪽 커버(누르면 "지금 재생 중")·제목·하트 / 가운데 셔플·이전·재생·다음·반복 / 오른쪽 시간·볼륨(손잡이)·대기열. **진행바는 플레이어 맨 위 가장자리에 화면 끝까지**(유튜브뮤직식, 마우스를 올리면 두꺼워지고 손잡이). 모바일은 커버·제목·하트·이전·재생·다음만 — 셔플·반복·대기열은 "지금 재생 중"에. "지금 재생 중"이 열려 있으면(데스크탑) 곡 정보는 숨긴다
- `NowPlaying.vue`: 지금 재생 중 큰 화면. 데스크탑은 미니 플레이어를 남기고 위를 덮는다(큰 커버 + 가사/다음 곡 탭), 모바일은 전체 화면(자체 진행바·컨트롤, 아래 가사/재생 대기열 버튼)
- `QueuePanel.vue`: 재생 대기열. 데스크탑 오른쪽 서랍(400px, 뒤 페이지 그대로 쓸 수 있음) / 모바일 전체 화면 시트. "다음에 재생"·"다음: ○○에서" 두 구역, 구역마다 비우기·빼기·구역 안 드래그(vuedraggable). 남은 목록은 100곡씩 그린다
- `LyricsView.vue`: 가사 표시(정적). `lines`를 주면 싱크 가사로 그린다(아직 API 없음 — 하게 되면 앱 먼저)
- `SongRow.vue`: 곡 한 줄(차트·좋아요 목록 공용). 데스크탑은 하트와 ⋯ 이 **마우스를 올리면** 보이고 좋아요한 곡 하트는 항상 보임 — `@media (hover: hover)`로만 숨겨서 터치 태블릿에선 항상 보인다. ⋯ → `SongMenuSheet`(좋아요 / 다음에 재생 / 대기열 맨 뒤에 추가 / 내 플레이리스트에 담기) — 모바일은 아래 시트, 데스크탑은 가운데 작은 창
- **색**: `tailwind.config.js`의 `surface` 0(바탕)·1(헤더·플레이어)·2(카드). 순회색 대신 보라 기운을 살짝. 보라 강조(purple-500/400)는 재생 버튼·좋아요 하트에만 — 다 보라면 아무것도 안 튄다(2026-10-31 개편). 설정을 바꾸면 **dev를 다시 켜야** 새 색 클래스가 생긴다(안 그러면 배경이 하얗게 나옴)
- `AppHeader.vue`: 음원 모드 상단 헤더 (로고, 메뉴 홈·차트·테마·좋아요(md 이상), 음원 검색, "영상" 버튼, UserMenu). 모바일은 메뉴 없이 검색·영상·사용자
- **검증**: `npm test`(대기열 계산) + `scripts/e2e/player.mjs`(Playwright — `npm run dev` 위에서 실제 재생·대기열·옛 큐 변환·테마·화면 폭별 스크린샷. 로그인은 `scripts/e2e/make-token.js`, 운영 DB 쓰기 요청은 가로채 막는다)
- `VideoHeader.vue`: 비디오 모드 전용 헤더 (← 뒤로가기, DIBE2 비디오 로고, UserMenu) — 단순 헤더, 큐 진입점 없음
- `UserMenu.vue`: 유저 아바타 + 드롭다운 (프로필/설정/관리자/로그아웃). AppHeader/VideoHeader 공통
- `SearchResultsModal.vue`: 검색 결과(2026-11 새로 — 데스크탑 가운데 창·모바일 전체 화면). 줄은 `SongRow`(하트·⋯), **줄 클릭 = 검색 결과를 그 곡부터**(source `search`), 체크 → 대기열에 추가 / 담기(레이아웃의 담기 시트를 같이 씀). 가사 탭은 `SongRow`의 `below` 칸에 가사 일부(외부 글이라 이스케이프 후 강조). 모바일 검색 팝업은 헤더 자리를 덮는 위쪽 막대(`AppHeader.vue`)
- `VideoQueueList.vue`: "지금 재생 중" 오버레이 안에 들어가는 재생목록(큐) 콘텐츠 (예전 음원 `Playlist.vue` 축소판 — 음원은 2026-11에 `QueuePanel.vue`로 교체 — 모달도 탭도 아닌 인라인, 가사/셔플/반복 없음, 드래그 정렬 + 다중삭제 + 클릭 점프재생)
- `MyVideoPlaylistSection.vue`: `/video` 보관함 탭 - 저장된 비디오 플레이리스트 그리드 (카드 썸네일은 첫 영상 1장)
- `VideoPlaylistDetailPanel.vue`: 보관함 탭에서 플레이리스트 클릭 시 인라인 표시(라우트 아님). "전체재생"은 `videoQueue/setQueueAndPlay` 디스패치
- `VideoAddModal.vue`: 영상 1개를 대상으로 "재생목록에 추가" / "플레이리스트에 추가"(펼치면 보유 플레이리스트 목록) 중 선택하는 단일 모달. 검색 카드의 "추가" 버튼과 "지금 재생 중" 패널의 "추가" 버튼이 모두 이 모달을 공유(대상 영상만 `addModalVideo`로 교체) — 음원 `layouts/main.vue`의 "Add to Playlist Modal"(현재 재생목록에 추가 / 내 플레이리스트에 추가 펼침 목록)과 동일 패턴
  - **로딩 표시**: "재생목록에 추가"(`videoQueue/addToQueue`)는 순수 로컬(Vuex+localStorage)이라 네트워크 호출 없음 — 스피너 불필요. "플레이리스트에 추가"는 실제 네트워크 POST(`/api/video-playlists/:id/videos`)라 배포 환경에서 dev보다 체감 딜레이가 있을 수 있어서, `addingPlaylistId`로 처리 중인 버튼을 추적해 스피너 표시 + 모든 추가 버튼 비활성화(중복클릭 방지). 음원 `layouts/main.vue`의 `isAdding` 풀스크린 로딩 오버레이(스피너+가짜 진행바)와 같은 문제를 다루지만, 비디오는 한 번에 1개 영상만 추가하는 가벼운 동작이라 버튼 인라인 스피너로 단순화
- `CreateVideoPlaylistModal.vue`: 새 비디오 플레이리스트 생성 모달

### 비디오 탭 구조 (유튜브 뮤직 미니플레이어 패턴)
- 최상위 탭은 검색/보관함 2개뿐. "지금 재생 중"은 탭이 아니라 ① 항상 떠 있는 하단 고정 컨트롤 바 ② 그 바의 "재생목록" 버튼으로 켜고 끄는 패널, 이렇게 별도 레이어로 분리되어 있음 — 검색/보관함 탭 콘텐츠 안에는 영상이 전혀 끼어들지 않음
- **하단 고정 컨트롤 바**: 음원 `MusicPlayer.vue`와 동일하게 화면 **하단 고정**(`fixed bottom-0`, 탭 sticky 블록과는 별개) — 썸네일+제목, 반복, ◀▶, 재생/일시정지(동그란 버튼, 음원과 동일 스타일), 셔플, 음량(데스크탑만 `hidden sm:flex`), 재생목록 토글 버튼, 그 아래 진행바(시간표시+드래그 탐색). 재생 컨트롤은 전부 여기에만 있고 패널 쪽에는 중복으로 두지 않음. "추가" 버튼도 여기 없음(공간이 좁아 셔플/반복으로 대체, "지금 재생 중" 패널의 재생목록 헤더 쪽으로 이동). 탭 콘텐츠 쪽은 `currentVideo` 있을 때 하단 패딩(`pb-24 sm:pb-28`)을 둬서 가려지지 않게 함. 패널보다 z-index가 높아야(`z-40` vs 패널 `z-30`) 패널이 열려 있어도 이 바의 토글 버튼을 계속 누를 수 있음
- **진행바**: 음원 `MusicPlayer.vue`의 진행바와 동일 패턴(`formatTime`/`startSeek`/`updateSeek`/`endSeek`/`updateSeekPosition`/`onSeekChange`) — 마우스/터치 드래그 + `<input type="range">` 클릭 모두 지원. `currentTime`/`duration`은 페이지 로컬 `YT.Player`의 `getCurrentTime()`/`getDuration()`을 1초 간격으로 polling(`startTimeUpdate`/`stopTimeUpdate`). `onReady`에서 (위치 복원 직후) 즉시 한 번 값을 채우고 `startTimeUpdate()`를 호출 — 음원과 동일하게 **재생 전에도** 복원된 위치/길이가 바로 보임. 이후 `isPlaying` watcher가 재생/일시정지에 맞춰 polling을 잇거나 멈춤. 영상이 바뀌면 `currentVideo` watcher에서 `currentTime`/`duration`을 0으로 리셋해 이전 영상 진행률이 잠깐 보이는 걸 방지
- **썸네일 탭 = 제목 툴팁**: 음원 `MusicPlayer.vue`의 `toggleTrackInfo()`와 동일 패턴 — 썸네일/제목 영역을 탭하면 막대 위에 제목 툴팁이 떴다가 5초 후 자동으로 사라짐(`showTrackInfo`). 데스크탑은 막대에 제목이 truncate로 항상 보이고(`hidden sm:block`), 모바일은 숨겨져 있어서 이 툴팁이 제목을 확인하는 유일한 방법
- **"지금 재생 중" 패널**(`showNowPlaying`, 하단 바의 "재생목록" 버튼으로 토글): 큰 영상 프레임 + 제목/채널명 + 그 아래 재생목록(`VideoQueueList`, 헤더 옆에 "현재 영상 추가" `+` 버튼)만 담당. 재생 컨트롤(이전/재생/다음/셔플/반복/음량/진행바)은 의도적으로 빼서 하단 고정 바와 중복 안 되게 함. "유튜브에서 보기" 링크도 정상재생 중엔 노출 안 함(차단 감지 안내 카드에만 남아있음). 닫기는 우측 상단 화살표 같은 별도 버튼이 아니라 하단 바의 "재생목록" 버튼을 다시 누르는 단순 토글(`showNowPlaying = !showNowPlaying`) — 패널이 하단 바를 가리지 않게 z-index를 더 낮게 둬서 항상 그 버튼을 누를 수 있게 함
- **"추가" 버튼 위치**: 음원 대기열 패널(`QueuePanel.vue`)에도 "추가" 버튼이 없는 것과 동일하게, 재생 중인 영상을 빠르게 플레이리스트에 추가하는 길은 검색 카드의 "추가"가 기본. 다만 비디오는 "지금 재생 중" 패널의 재생목록 헤더 옆에 `+`를 하나 남겨둠(제목 줄 옆은 UX상 안 좋아서 위치만 재생목록 헤더로 이동)
- "영상을 보고 싶을 때만 본다"는 의도로 영상 프레임 자체도 하단에 상시 고정하지 않고 이 패널 안에만 둠(음원의 "재생 대기열=`QueuePanel.vue` 토글"과 같은 토글 패턴이지만, 비디오는 영상 프레임도 같이 들어있다는 점만 다름)
- 셔플/반복: `store/videoQueue.js`에 음원 `player.js`와 동일한 패턴으로 구현(셔플은 현재 영상 제외하고 나머지 섞기 + `originalQueue` 보관 후 복원, 반복은 off→all→one 순환). 단, repeat `'one'`일 때 영상을 처음부터 재시작하는 실제 동작(`seekTo(0)` + `playVideo()`)은 스토어가 아니라 `pages/video/index.vue`의 `playNext()` 메서드에서 처리 — 비디오는 음원과 달리 공유 싱글톤 플레이어가 아니라 페이지 로컬 `YT.Player` 인스턴스이기 때문. 스토어의 `videoQueue/playNext` 액션은 일반 다음곡 진행 + repeat `'all'` 시 첫 곡으로 wraparound만 담당
- 하단 바/패널 모두 `v-show`로만 토글 — `#video-page-player`는 항상 DOM에 남아있어서 탭을 전환하거나 패널을 닫아도 재생이 끊기지 않고 백그라운드에서 계속됨
- 검색 결과 카드: 썸네일 클릭 = 명시적 재생(클릭 즉시 "지금 재생 중" 패널도 열림). 카드마다 별도로 항상 보이는 "추가" 버튼 → `VideoAddModal` 오픈. 선택모드/다건선택 없음 — 카드 단위로만 추가(음원의 체크박스+모달 패턴과 달리, 영상 카드는 이미 시각적으로 분리돼 있어 단건 추가만으로 충분하다고 판단)
- **자동재생 방지**: `localStorage`에서 큐/현재영상이 복원될 때는 `autoplay:0`(cue만, 재생 안 함). 검색 결과 클릭/재생목록 항목 클릭/"전체재생" 등 명시적 액션만 autoplay — `pages/video/index.vue`의 `justRestored` 플래그(mount 시 true → `initializeQueue`가 동기적으로 currentVideo를 복원하면서 트리거되는 `currentVideo` watcher가 이 값을 읽어 autoplay 여부 결정 → 다음 tick에 false로 리셋)로 구분. 영상 종료(`onStateChange` ENDED) 시 큐의 다음 영상으로 자동 진행하는 건 재생목록의 정상 동작이라 별개(자동재생 방지 대상 아님)
- 음량/재생·일시정지는 Vuex 경유 없이 페이지 로컬 YT.Player 인스턴스에 `setVolume`/`mute`/`unMute`/`playVideo`/`pauseVideo` 직접 호출(비디오는 음원처럼 공유 싱글톤이 아니라 페이지 로컬 인스턴스라서). `isPlaying`은 `onStateChange`의 PLAYING/PAUSED로 추적
- **Media Session API** (`setupMediaSession`/`updateMediaSession`/`clearMediaSession`): 모바일(주로 Android Chrome)에서 잠금화면/알림에 제목·썸네일·재생/이전/다음/탐색 컨트롤 노출. `mounted`에서 액션 핸들러 1회 등록, `currentVideo` watcher에서 메타데이터 갱신, `onStateChange`에서 `playbackState` 갱신, `beforeDestroy`에서 정리. **주의**: 유튜브 iframe이 크로스오리진이라 우리 JS로 PiP를 강제하거나 백그라운드 재생 자체를 보장할 수 없음 — 브라우저/OS 정책 영역. iOS Safari는 화면이 꺼지면 거의 항상 일시정지됨(유튜브 ToS 위반 소지가 있는 오디오 스트림 추출 방식은 의도적으로 시도 안 함, invidious 우회 안 한 것과 같은 이유)
- 큐/현재영상은 `localStorage`에 캐싱 (`user_{userId}_video_queue`, `user_{userId}_video_current`). 셔플/반복/원본큐도 동일 패턴으로 저장(`user_{userId}_video_shuffle`, `user_{userId}_video_repeat_mode`, `user_{userId}_video_original_queue`). 음량은 `user_{userId}_video_volume` — 새로고침해도 모두 복구(단, 자동재생은 안 됨)
- **재생 위치 기억**: 마지막으로 보던 영상 1개의 위치만 `user_{userId}_video_position`에 `{id, time}`로 저장(여러 영상 기록 누적 안 함, 단순한 버전). 재생 중 5초 간격 + 일시정지 시 + 페이지 이탈 시 저장, 같은 영상으로 돌아오면 `seekTo`로 복원(5초 이하면 복원 안 함)
  - **주의(YouTube IFrame API 특성)**: cue만 된(`autoplay:0`) 영상에 `seekTo()`를 호출하면 paused 상태와 달리 재생이 시작돼버림 — 자동재생 방지가 위치 복원 때문에 무력화될 수 있음. `initVideoPlayer`의 `onReady`에서 `!autoplay`일 때 `seekTo` 직후 `pauseVideo()`를 호출해 되돌림
- `VideoAddModal.vue`는 대상 영상이 이미 재생목록(큐)/특정 플레이리스트에 있으면 해당 항목을 "이미 있음" 안내로 대체 — 큐는 `videoQueue.queue`, 플레이리스트는 각 `playlist.videos`를 직접 대조해서 매번 동적으로 판단

## 미들웨어 (클라이언트)
`middleware/auth.js`: 모든 라우트에 적용 (nuxt.config.js router.middleware)
- 비로그인 → 비공개 페이지 접근 시 `/login` 리다이렉트
- 로그인 → 공개 페이지 접근 시 `/` 리다이렉트
- 구독 만료 시 → `/subscription-notice` 리다이렉트
- 관리자 아닌데 `/admin` 접근 시 → `/` 리다이렉트

## 모바일 대응
모바일도 주요 사용 환경. 데스크탑만 확인하지 말고 모바일에서도 잘 동작하는지 같이 챙길 것.

> 🔴 **정적 스크린샷 한 장으로 판단하지 말 것.** 2026-07-17에 "검색 모바일 대응 잘 되어 있음"이라고
> 판단했다가 사용자 지적으로 뒤집혔다. **스크롤해보고, 눌러보고, 플로우를 끝까지 타봐야** 보이는 것들:
> 배경 스크롤 잠금, 모달이 뷰포트를 넘는지, 결과가 화면 밖에 뜨는지, hover 전용 UI, 중첩 스크롤.
> Playwright + `devices['iPhone 12']` 로 실제 터치 프로파일에서 플로우를 재현할 수 있다.

**실제로 밟았던 함정들** (2026-07-17):
- **`h-[calc(100vh-300px)]` 같은 매직넘버 금지.** 300px 근거도 없고, **모바일 `100vh` 는 주소창을 포함**해서 실제 보이는 영역보다 크다 → 카드가 화면 밖으로 나간다. `max-h-full` + `flex-col` + `flex-1 min-h-0` 으로 뷰포트에 맞출 것
- **모달을 열면 `body` 스크롤을 잠글 것.** 안 잠그면 결과를 넘기려다 **뒤 배경이 같이 밀려서** 모달이 떠내려가 보인다. 닫을 때·`beforeDestroy` 에서 반드시 풀 것
- **`z-50` 충돌**: `MusicPlayer` 가 `z-50` 이고 DOM 상 뒤에 있어서, 같은 `z-50` 모달은 **플레이어에 덮인다**. 모달은 `z-[60]`
- **`opacity-0 hover:opacity-100` 은 터치 기기에서 영영 안 보인다.** 탭하면 동작은 하지만 존재를 알 길이 없다 → `opacity-100 sm:opacity-0 sm:hover:opacity-100`
- **중첩 스크롤 금지**(모달 안에 `max-h-* overflow-y-auto` 박스). 손가락이 어느 쪽을 굴리는지 알 수 없어 스크롤이 갇힌다 → 모바일은 `max-h-none`, 길면 접기 토글로
- **버튼을 눌러 나온 결과가 화면 밖이면 "아무 일도 안 일어난 것"이다** → `scrollIntoView` 로 데려다줄 것
- **카드 그리드는 모바일에서 목록이 안 된다**: 커버(`h-48`)가 풀폭으로 늘어나 한 곡이 화면을 통째로 먹는다(실측: 20곡 = 8,542px ≈ 10화면). `flex sm:block` 한 벌로 **모바일은 리스트 행, 데스크탑은 카드**(→ 4,144px, 화면당 3.9곡)
- 터치 영역 최소 44×44px (`layouts/main.vue`와 `layouts/video.vue` 양쪽에 각각 미디어쿼리로 적용 — 레이아웃별 전역 `<style>`이라 서로 안 묻어가니, 새 레이아웃 추가 시 빠뜨리지 말 것)
- 핵심 기능 아이콘은 모바일에서도 노출되도록 (`sm:hidden`으로 모바일에서 통째로 숨기는 패턴 주의)
- 모달/오버레이는 모바일에서 충분한 크기로 (풀폭/풀스크린 고려)
- 텍스트 라벨은 데스크탑 전용(`hidden sm:inline`)으로 두고 모바일은 아이콘만도 가능
- 검증 시 dev tools mobile viewport 시뮬레이션 필수
