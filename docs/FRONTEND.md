# 프론트엔드 구조

## 레이아웃
- `layouts/main.vue` ★ 핵심 레이아웃
  - AppHeader, MusicPlayer(하단), Playlist(큐 사이드바) 포함
  - provide/inject 패턴으로 자식에게 메서드/데이터 전달
  - 차트 fetch, 플레이리스트 CRUD, 곡 추가 모달 등 관리
- `layouts/auth.vue`: 로그인/회원가입 전용
- `layouts/video.vue`: 비디오 페이지 전용 (AppHeader만, 하단 MusicPlayer 없음). mounted에서 `player/pause` 디스패치하여 음원 일시정지

## 페이지
| 경로 | 파일 | 레이아웃 | 설명 |
|------|------|----------|------|
| `/` | `pages/index.vue` | main | 차트 Top100 + 내 플레이리스트 |
| `/login` | `pages/login.vue` | auth | 로그인 (구글/카카오) |
| `/register` | `pages/register.vue` | auth | 회원가입 (현재 막혀있음) |
| `/subscription-notice` | `pages/subscription-notice.vue` | - | 구독 만료 안내 |
| `/playlist/:id` | `pages/playlist/_id.vue` | main | 플레이리스트 상세 |
| `/admin` | `pages/admin/index.vue` | main | 관리자 대시보드 |
| `/video` | `pages/video/index.vue` | video | 유튜브 검색 + 영상 재생 (음원과 독립) |

## Vuex 스토어
| 모듈 | 파일 | 역할 |
|------|------|------|
| `auth` | `store/auth.js` | 로그인 상태, user 객체 |
| `player` | `store/player.js` | 재생 큐, 현재곡, 재생 상태, 볼륨, 셔플, 반복 |
| `playlist` | `store/playlist.js` | 내 플레이리스트 CRUD |
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
- `VideoHeader.vue`: 비디오 모드 전용 헤더 (← 뒤로가기, DIBE2 비디오 로고, UserMenu)
- `UserMenu.vue`: 유저 아바타 + 드롭다운 (프로필/설정/관리자/로그아웃). AppHeader/VideoHeader 공통
- `SearchResultsModal.vue`: 검색 결과 모달
- `MyPlaylistSection.vue`: 메인 페이지 내 플레이리스트 섹션

## 미들웨어 (클라이언트)
`middleware/auth.js`: 모든 라우트에 적용 (nuxt.config.js router.middleware)
- 비로그인 → 비공개 페이지 접근 시 `/login` 리다이렉트
- 로그인 → 공개 페이지 접근 시 `/` 리다이렉트
- 구독 만료 시 → `/subscription-notice` 리다이렉트
- 관리자 아닌데 `/admin` 접근 시 → `/` 리다이렉트

## 모바일 대응
모바일도 주요 사용 환경. 데스크탑만 확인하지 말고 모바일에서도 잘 동작하는지 같이 챙길 것.
- 터치 영역 최소 44×44px (이미 `layouts/main.vue` 미디어쿼리에서 button/a에 적용 중)
- 핵심 기능 아이콘은 모바일에서도 노출되도록 (`sm:hidden`으로 모바일에서 통째로 숨기는 패턴 주의)
- 모달/오버레이는 모바일에서 충분한 크기로 (풀폭/풀스크린 고려)
- 텍스트 라벨은 데스크탑 전용(`hidden sm:inline`)으로 두고 모바일은 아이콘만도 가능
- 검증 시 dev tools mobile viewport 시뮬레이션 필수
