# 프론트엔드 구조

## 폰트
- 전역 폰트: **Pretendard** (jsDelivr CDN, `nuxt.config.js` head.link) — `tailwind.config.js`의 `theme.extend.fontFamily.sans`에 등록, Tailwind preflight가 `html`에 자동 적용하는 구조라 별도 클래스 지정 없이 앱 전체에 적용됨
- font-awesome(아이콘 폰트)과는 별개, 서로 영향 없음

## 레이아웃
- `layouts/main.vue` ★ 핵심 레이아웃
  - AppHeader, MusicPlayer(하단), Playlist(큐 사이드바) 포함
  - provide/inject 패턴으로 자식에게 메서드/데이터 전달
  - 차트 fetch, 플레이리스트 CRUD, 곡 추가 모달 등 관리
- `layouts/auth.vue`: 로그인/회원가입 전용
- `layouts/video.vue`: 비디오 페이지 전용 (VideoHeader만 — 미니플레이어/오버레이는 레이아웃이 아니라 `pages/video/index.vue` 자체가 렌더링). mounted에서 `player/pause` 디스패치하여 음원 일시정지. 모바일 44px 터치영역 미디어쿼리 포함(`layouts/main.vue`와 별도 적용 필요)

## 페이지
| 경로 | 파일 | 레이아웃 | 설명 |
|------|------|----------|------|
| `/` | `pages/index.vue` | main | 차트 Top100 + 내 플레이리스트 |
| `/login` | `pages/login.vue` | auth | 로그인 (구글/카카오 소셜 로그인만 — 아이디/비밀번호 폼 없음). 좌측 브랜드 패널 + 우측 로그인 패널 2단 레이아웃(모바일은 세로 스택). 소셜 버튼(`SocialLoginButton.vue`)은 각 사 공식 버튼 가이드(색상/라벨/radius) 준수, 카카오 말풍선 심볼은 근사치 SVG(공식 에셋 아님) |
| `/register` | `pages/register.vue` | auth | 회원가입 (현재 막혀있음) |
| `/subscription-notice` | `pages/subscription-notice.vue` | - | 구독 만료 안내 |
| `/playlist/:id` | `pages/playlist/_id.vue` | main | 플레이리스트 상세 |
| `/admin` | `pages/admin/index.vue` | main | 관리자 대시보드 |
| `/video` | `pages/video/index.vue` | video | 유튜브 검색 + 영상 재생 (음원과 독립). 내부 탭으로 "검색"/"보관함" 전환 (라우트 이동 없음). "지금 재생 중"은 탭과 분리된 별도 오버레이 |

## Vuex 스토어
| 모듈 | 파일 | 역할 |
|------|------|------|
| `auth` | `store/auth.js` | 로그인 상태, user 객체 |
| `player` | `store/player.js` | 재생 큐, 현재곡, 재생 상태, 볼륨, 셔플, 반복 |
| `playlist` | `store/playlist.js` | 내 플레이리스트 CRUD |
| `videoQueue` | `store/videoQueue.js` | 비디오 재생 큐, 현재 영상, 셔플/반복(player.js와 동일 패턴). 볼륨은 페이지 로컬 YT.Player가 직접 관리(스토어에 없음). localStorage 캐싱은 player.js와 동일 패턴 |
| `videoPlaylist` | `store/videoPlaylist.js` | 내 비디오 플레이리스트 CRUD (`store/playlist.js`와 동일 패턴, `/api/video-playlists`) |
| `search` | `store/search.js` | 검색 상태 |

### player 스토어 주요 동작
- `localStorage`에 유저별 큐/현재곡/볼륨/셔플/반복 저장 (`user_{id}_key`)
  - 곡 데이터는 표시 최소 필드만 저장 (`_id, title, artist, coverUrl`) — `stripForCache` 헬퍼
  - lyrics는 캐시 안 함 (가사 표시 시점에 `/api/songs/lyrics/:id`로 lazy fetch)
- `initializeAudioSystem` 시작 시 캐시 큐 즉시 표시 후, `refreshQueueData` 백그라운드 디스패치 → `/api/songs/by-ids`로 fresh 데이터 받아 큐/currentTrack/originalQueue 갱신
  - `/by-ids` 응답엔 2026-07-15부터 `liked`/`likeCount`/`playCount`가 **추가로** 실려 온다(앱 하트 UI용). 기존 4필드는 그대로라 웹은 무영향이고, `stripForCache`가 표시 최소 필드만 남기므로 **localStorage엔 안 들어간다**(메모리 큐엔 실려 있음) — 웹에서 하트를 쓸 거면 이미 받아둔 값이라 추가 요청 불필요
- 차트는 `layouts/main.vue` `fetchPopularChart`에서 `dibe2_chart_cache` 키로 동일한 캐시-즉시-표시 + 백그라운드-refresh 패턴 사용
- YouTube IFrame API로 재생 (`utils/youtubePlayer.js`)
- 큐 제한: 1000곡
- 반복 모드: off → all → one
- **재생 위치 기억** (`user_{id}_position`에 `{trackId, time}`, 비디오 `user_{id}_video_position`과 동일 패턴, 마지막 곡 1개만): `updateTrackProgress`의 1초 polling 중 재생 중일 때 + `pause` 시 저장. 단, 음원 싱글톤 플레이어(`utils/youtubePlayer.js`)는 새로고침 직후엔 곡을 아예 로드 안 하고 실제 `play()` 호출 시에야 `loadVideoById`로 로드되므로, 비디오처럼 재생 전에 진행바로 미리 보여줄 수는 없음 — 대신 `initializeQueue`에서 복원한 값을 `state.resumePosition`(`currentTime`과 별개)에 잠깐 들고 있다가 소비
  - **seek 타이밍 주의**: `play()` 액션의 `loadVideoById` 호출 직후 바로 `seekTo`를 하면 새 영상이 아직 버퍼링 전이라 씹히는 경우가 있음 — 그래서 `resumePosition` 소비(`youtubePlayer.seek()` + `null`로 비움)는 `play()`가 아니라 `initYoutubePlayer`의 `onStateChange`가 실제 `PLAYING`을 보고하는 시점에서 처리

## 주요 컴포넌트
- `MusicPlayer.vue`: 하단 고정 플레이어 (재생/정지/이전/다음/볼륨/프로그레스바)
- `Playlist.vue`: 재생 큐 목록 (드래그 정렬 가능 - vuedraggable)
- `AppHeader.vue`: 음원 모드 상단 헤더 (로고, 음원 검색, 비디오 진입 아이콘, UserMenu)
- `VideoHeader.vue`: 비디오 모드 전용 헤더 (← 뒤로가기, DIBE2 비디오 로고, UserMenu) — 단순 헤더, 큐 진입점 없음
- `UserMenu.vue`: 유저 아바타 + 드롭다운 (프로필/설정/관리자/로그아웃). AppHeader/VideoHeader 공통
- `SearchResultsModal.vue`: 검색 결과 모달
- `MyPlaylistSection.vue`: 메인 페이지 내 플레이리스트 섹션
- `VideoQueueList.vue`: "지금 재생 중" 오버레이 안에 들어가는 재생목록(큐) 콘텐츠 (`Playlist.vue` 축소판 — 모달도 탭도 아닌 인라인, 가사/셔플/반복 없음, 드래그 정렬 + 다중삭제 + 클릭 점프재생)
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
- **"추가" 버튼 위치**: 음원 `Playlist.vue`(재생 큐 목록)에도 "추가" 버튼이 없는 것과 동일하게, 재생 중인 영상을 빠르게 플레이리스트에 추가하는 길은 검색 카드의 "추가"가 기본. 다만 비디오는 "지금 재생 중" 패널의 재생목록 헤더 옆에 `+`를 하나 남겨둠(제목 줄 옆은 UX상 안 좋아서 위치만 재생목록 헤더로 이동)
- "영상을 보고 싶을 때만 본다"는 의도로 영상 프레임 자체도 하단에 상시 고정하지 않고 이 패널 안에만 둠(음원의 "재생목록=`Playlist.vue` 토글"과 같은 토글 패턴이지만, 비디오는 영상 프레임도 같이 들어있다는 점만 다름)
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
- 터치 영역 최소 44×44px (`layouts/main.vue`와 `layouts/video.vue` 양쪽에 각각 미디어쿼리로 적용 — 레이아웃별 전역 `<style>`이라 서로 안 묻어가니, 새 레이아웃 추가 시 빠뜨리지 말 것)
- 핵심 기능 아이콘은 모바일에서도 노출되도록 (`sm:hidden`으로 모바일에서 통째로 숨기는 패턴 주의)
- 모달/오버레이는 모바일에서 충분한 크기로 (풀폭/풀스크린 고려)
- 텍스트 라벨은 데스크탑 전용(`hidden sm:inline`)으로 두고 모바일은 아이콘만도 가능
- 검증 시 dev tools mobile viewport 시뮬레이션 필수
