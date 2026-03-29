# 프론트엔드 구조

## 레이아웃
- `layouts/main.vue` ★ 핵심 레이아웃
  - AppHeader, MusicPlayer(하단), Playlist(큐 사이드바) 포함
  - provide/inject 패턴으로 자식에게 메서드/데이터 전달
  - 차트 fetch, 플레이리스트 CRUD, 곡 추가 모달 등 관리
- `layouts/auth.vue`: 로그인/회원가입 전용

## 페이지
| 경로 | 파일 | 레이아웃 | 설명 |
|------|------|----------|------|
| `/` | `pages/index.vue` | main | 차트 Top100 + 내 플레이리스트 |
| `/login` | `pages/login.vue` | auth | 로그인 (구글/카카오) |
| `/register` | `pages/register.vue` | auth | 회원가입 (현재 막혀있음) |
| `/subscription-notice` | `pages/subscription-notice.vue` | - | 구독 만료 안내 |
| `/playlist/:id` | `pages/playlist/_id.vue` | main | 플레이리스트 상세 |
| `/admin` | `pages/admin/index.vue` | main | 관리자 대시보드 |

## Vuex 스토어
| 모듈 | 파일 | 역할 |
|------|------|------|
| `auth` | `store/auth.js` | 로그인 상태, user 객체 |
| `player` | `store/player.js` | 재생 큐, 현재곡, 재생 상태, 볼륨, 셔플, 반복 |
| `playlist` | `store/playlist.js` | 내 플레이리스트 CRUD |
| `search` | `store/search.js` | 검색 상태 |

### player 스토어 주요 동작
- `localStorage`에 유저별 큐/현재곡/볼륨/셔플/반복 저장 (`user_{id}_key`)
- YouTube IFrame API로 재생 (`utils/youtubePlayer.js`)
- 큐 제한: 1000곡
- 반복 모드: off → all → one

## 주요 컴포넌트
- `MusicPlayer.vue`: 하단 고정 플레이어 (재생/정지/이전/다음/볼륨/프로그레스바)
- `Playlist.vue`: 재생 큐 목록 (드래그 정렬 가능 - vuedraggable)
- `AppHeader.vue`: 상단 헤더 (검색, 로그아웃)
- `SearchResultsModal.vue`: 검색 결과 모달
- `MyPlaylistSection.vue`: 메인 페이지 내 플레이리스트 섹션

## 미들웨어 (클라이언트)
`middleware/auth.js`: 모든 라우트에 적용 (nuxt.config.js router.middleware)
- 비로그인 → 비공개 페이지 접근 시 `/login` 리다이렉트
- 로그인 → 공개 페이지 접근 시 `/` 리다이렉트
- 구독 만료 시 → `/subscription-notice` 리다이렉트
- 관리자 아닌데 `/admin` 접근 시 → `/` 리다이렉트
