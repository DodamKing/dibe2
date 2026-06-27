# 프론트엔드 구조

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
| `/login` | `pages/login.vue` | auth | 로그인 (구글/카카오) |
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
| `videoQueue` | `store/videoQueue.js` | 비디오 재생 큐, 현재 영상 (player.js 축소판 — 셔플/반복/볼륨 없음, localStorage 캐싱은 동일 패턴) |
| `videoPlaylist` | `store/videoPlaylist.js` | 내 비디오 플레이리스트 CRUD (`store/playlist.js`와 동일 패턴, `/api/video-playlists`) |
| `search` | `store/search.js` | 검색 상태 |

### player 스토어 주요 동작
- `localStorage`에 유저별 큐/현재곡/볼륨/셔플/반복 저장 (`user_{id}_key`)
  - 곡 데이터는 표시 최소 필드만 저장 (`_id, title, artist, coverUrl`) — `stripForCache` 헬퍼
  - lyrics는 캐시 안 함 (가사 표시 시점에 `/api/songs/lyrics/:id`로 lazy fetch)
- `initializeAudioSystem` 시작 시 캐시 큐 즉시 표시 후, `refreshQueueData` 백그라운드 디스패치 → `/api/songs/by-ids`로 fresh 데이터 받아 큐/currentTrack/originalQueue 갱신
- 차트는 `layouts/main.vue` `fetchPopularChart`에서 `dibe2_chart_cache` 키로 동일한 캐시-즉시-표시 + 백그라운드-refresh 패턴 사용
- YouTube IFrame API로 재생 (`utils/youtubePlayer.js`)
- 큐 제한: 1000곡
- 반복 모드: off → all → one

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
- `VideoAddModal.vue`: 영상 1개를 대상으로 "재생목록에 추가" / "플레이리스트에 추가"(펼치면 보유 플레이리스트 목록) 중 선택하는 단일 모달. 검색 카드의 "추가" 버튼과 "지금 재생 중" 슬림바의 "추가" 버튼이 모두 이 모달을 공유(대상 영상만 `addModalVideo`로 교체) — 음원 `layouts/main.vue`의 "Add to Playlist Modal"(현재 재생목록에 추가 / 내 플레이리스트에 추가 펼침 목록)과 동일 패턴
- `CreateVideoPlaylistModal.vue`: 새 비디오 플레이리스트 생성 모달

### 비디오 탭 구조 (유튜브 뮤직 미니플레이어 패턴)
- 최상위 탭은 검색/보관함 2개뿐. "지금 재생 중"은 탭이 아니라 ① sticky 미니플레이어(항상 떠 있음) ② 그걸 탭하면 펼쳐지는 풀스크린 오버레이, 이렇게 별도 레이어로 분리되어 있음 — 검색/보관함 탭 콘텐츠 안에는 영상이 전혀 끼어들지 않음
- 미니플레이어: 음원 `MusicPlayer.vue`와 동일하게 화면 **하단 고정**(`fixed bottom-0`, 탭 sticky 블록과는 별개) — 썸네일+제목(탭하면 오버레이 확장), ◀▶, 재생/일시정지(동그란 버튼, 음원과 동일 스타일), 음량(데스크탑만 `hidden sm:flex`), "추가" 버튼. 탭 콘텐츠 쪽은 `currentVideo` 있을 때 하단 패딩(`pb-24 sm:pb-28`)을 둬서 가려지지 않게 함
- 풀스크린 오버레이(`showNowPlaying`): 큰 영상 프레임 + 정보행(◀▶/재생·일시정지/음량/추가/유튜브링크) + 그 아래 재생목록(`VideoQueueList`)까지 한 화면에 다 들어있음. 재생목록은 더 이상 최상위 탭이 아니라 이 오버레이에 종속된 섹션
- 미니플레이어/오버레이 모두 `v-show`로만 토글 — `#video-page-player`는 항상 DOM에 남아있어서 탭을 전환하거나 오버레이를 닫아도 재생이 끊기지 않고 백그라운드에서 계속됨
- 검색 결과 카드: 썸네일 클릭 = 명시적 재생(클릭 즉시 오버레이도 열림). 카드마다 별도로 항상 보이는 "추가" 버튼 → `VideoAddModal` 오픈. 선택모드/다건선택 없음 — 카드 단위로만 추가(음원의 체크박스+모달 패턴과 달리, 영상 카드는 이미 시각적으로 분리돼 있어 단건 추가만으로 충분하다고 판단)
- **자동재생 방지**: `localStorage`에서 큐/현재영상이 복원될 때는 `autoplay:0`(cue만, 재생 안 함). 검색 결과 클릭/재생목록 항목 클릭/"전체재생" 등 명시적 액션만 autoplay — `pages/video/index.vue`의 `justRestored` 플래그(mount 시 true → `initializeQueue`가 동기적으로 currentVideo를 복원하면서 트리거되는 `currentVideo` watcher가 이 값을 읽어 autoplay 여부 결정 → 다음 tick에 false로 리셋)로 구분. 영상 종료(`onStateChange` ENDED) 시 큐의 다음 영상으로 자동 진행하는 건 재생목록의 정상 동작이라 별개(자동재생 방지 대상 아님). 셔플/반복은 1차 스코프 제외
- 음량/재생·일시정지는 Vuex 경유 없이 페이지 로컬 YT.Player 인스턴스에 `setVolume`/`mute`/`unMute`/`playVideo`/`pauseVideo` 직접 호출(비디오는 음원처럼 공유 싱글톤이 아니라 페이지 로컬 인스턴스라서). `isPlaying`은 `onStateChange`의 PLAYING/PAUSED로 추적
- 큐/현재영상은 `localStorage`에 캐싱 (`user_{userId}_video_queue`, `user_{userId}_video_current`). 음량도 `user_{userId}_video_volume`로 저장 — 새로고침해도 모두 복구(단, 자동재생은 안 됨)
- **재생 위치 기억**: 마지막으로 보던 영상 1개의 위치만 `user_{userId}_video_position`에 `{id, time}`로 저장(여러 영상 기록 누적 안 함, 단순한 버전). 재생 중 5초 간격 + 일시정지 시 + 페이지 이탈 시 저장, 같은 영상으로 돌아오면 `seekTo`로 복원(5초 이하면 복원 안 함)
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
