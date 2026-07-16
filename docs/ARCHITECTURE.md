# 프로젝트 구조

```
dibe2/
├── components/          # Vue 컴포넌트
│   ├── admin/           # 관리자 전용 컴포넌트
│   │   ├── AdminDashboard.vue
│   │   ├── MusicManagement.vue
│   │   └── UserManagement.vue
│   ├── AppHeader.vue
│   ├── CreatePlaylistModal.vue
│   ├── MusicPlayer.vue       # 메인 음악 플레이어 (하단 고정)
│   ├── MusicPlayer_v2.vue    # v2 (미사용?)
│   ├── MyPlaylistSection.vue
│   ├── Playlist.vue          # 재생 큐 사이드바
│   ├── SearchResultsModal.vue
│   ├── SocialLoginButton.vue
│   ├── TestErrorComponent.vue
│   ├── VideoHeader.vue          # 비디오 모드 전용 헤더 (← 뒤로가기, 음원모드 전환, UserMenu만 — 큐 진입점은 하단 미니플레이어/Now Playing 오버레이가 담당)
│   ├── VideoQueueList.vue       # "지금 재생 중" 오버레이 안의 재생목록(큐) 콘텐츠 (Playlist.vue 축소판, 모달도 탭도 아닌 인라인)
│   ├── MyVideoPlaylistSection.vue   # 보관함 탭 - 저장된 비디오 플레이리스트 그리드
│   ├── CreateVideoPlaylistModal.vue
│   ├── VideoPlaylistDetailPanel.vue # 보관함 탭 - 플레이리스트 상세(인라인, 라우트 아님)
│   └── VideoAddModal.vue        # 영상 1개를 재생목록/플레이리스트에 추가 (검색카드+지금재생중 슬림바 공유)
│
├── layouts/
│   ├── auth.vue         # 로그인/회원가입용 레이아웃
│   ├── main.vue         # 메인 레이아웃 (플레이어, 헤더 포함) ★ 핵심
│   └── video.vue        # 비디오 레이아웃 (VideoHeader + Nuxt만 — 모달 없음)
│
├── middleware/
│   └── auth.js          # 클라이언트 라우터 미들웨어 (페이지 접근 제어)
│
├── pages/
│   ├── index.vue        # 메인 (차트 Top100 + 내 플레이리스트)
│   ├── login.vue
│   ├── register.vue
│   ├── subscription-notice.vue  # 구독 만료 안내
│   ├── test-error.vue
│   ├── admin/index.vue  # 관리자 대시보드
│   ├── playlist/_id.vue # 플레이리스트 상세
│   └── video/index.vue  # 유튜브 검색 + 영상 재생 (음원과 독립)
│
├── plugins/
│   ├── error-handler.js
│   ├── axios-interceptor.js
│   ├── auth-init.js
│   └── youtube-init.client.js  # body에 #youtube-player div 마운트 (좀비 방지)
│
├── server/              # Express 라우터/서비스 (Netlify Functions에서 require로 재사용)
│   ├── api/
│   │   ├── song.js      # /api/songs/*
│   │   ├── playlist.js  # /api/playlists/*
│   │   ├── videoPlaylist.js  # /api/video-playlists/*
│   │   ├── admin.js     # /api/admin/*
│   │   ├── user.js      # /api/users/* (로그인/OAuth/JWT 발급)
│   │   └── youtube.js   # /api/youtube/* (비디오 페이지 전용 검색)
│   ├── middleware/
│   │   ├── auth.js      # JWT 인증 (jwtCheckMiddleware, adminMiddleware, generateToken)
│   │   ├── cors.js
│   │   ├── cron.js      # 크론잡 (차트/유튜브URL/가사 업데이트)
│   │   ├── dailyVisitor.js
│   │   └── dbConnection.js
│   ├── models/
│   │   ├── Chart.js     # 차트 (items: [{rank,title,artist,...}])
│   │   ├── Playlist.js  # 플레이리스트 (user ref, songs[])
│   │   ├── VideoPlaylist.js  # 비디오 플레이리스트 (user ref, videos[] — songId ref 없음, 전부 비정규화)
│   │   ├── Song.js      # 곡 (title,artist,album,youtubeUrl,lyrics,genre,style,likeCount,playCount)
│   │   ├── Like.js      # 좋아요 (user+song 유니크). Song.likeCount의 원본
│   │   ├── PlayEvent.js # 재생 이력 (user,song,source,playedAt) TTL 180일. 추천용 신호 + Song.playCount의 원본
│   │   └── User.js      # 유저 (email,provider,expiryDate,isAdmin)
│   ├── services/
│   │   ├── index.js     # 서비스 export hub
│   │   ├── songService.js    # 차트/곡/유튜브/검색 로직
│   │   ├── statsService.js   # 좋아요/재생수 (like·unlike·getLikedSongs·recordPlay·attachLikedFlags)
│   │   ├── playlistService.js
│   │   ├── videoPlaylistService.js
│   │   ├── adminService.js   # 통계, 접근 기간 설정
│   │   └── userService.js
│   └── utils/
│       ├── helper.js              # Bugs 크롤링, 가사, Slack 알림
│       ├── advancedInvidiousManager.js  # Invidious 오디오 스트리밍
│       └── y2mate.js
│
├── scripts/             # 로컬 실행 일회성/백필 스크립트 (배포 안 됨)
│   └── backfill-genre.js  # 벅스 앨범 페이지에서 장르/스타일 백필 (--dry-run, --limit)
│                          # ⚠️ DB 접속은 반드시 server/models의 connectToMongoDB() 사용
│
├── store/               # Vuex 스토어
│   ├── index.js
│   ├── auth.js          # 로그인/로그아웃
│   ├── player.js        # 재생 상태 (큐, 현재곡, 볼륨, 셔플, 반복) ★ 핵심
│   ├── playlist.js      # 내 플레이리스트 CRUD
│   ├── videoQueue.js    # 비디오 재생 큐 (player.js 축소판 — 셔플/반복/볼륨 없음)
│   ├── videoPlaylist.js # 내 비디오 플레이리스트 CRUD
│   ├── search.js
│   └── plugins/
│       ├── mediaSession.js
│       └── titleUpdate.js
│
├── utils/               # 클라이언트 유틸
│   ├── audioPlayer.js
│   └── youtubePlayer.js # YouTube IFrame API 래퍼
│
├── nuxt.config.js       # Nuxt 설정 (serverMiddleware 순서 중요)
├── ecosystem.config.js  # PM2 배포 설정
└── tailwind.config.js
```

## serverMiddleware 실행 순서 (nuxt.config.js)
1. `cors`
2. `dbConnection` (MongoDB 연결)
3. `cron` (크론잡 등록, pass-through)
4. `/api` → `server/api/index.js` (Express 앱)
5. `dailyVisitor` (방문자 통계)

## Netlify Functions 미들웨어 순서 (netlify/functions/api.js)
1. CORS
2. JSON 파싱
3. MongoDB 연결
4. `jwtCheckMiddleware` (JWT 인증)
5. `visitorMiddleware` (방문자 통계)
6. 라우터

## 데이터 흐름
- Bugs Music → 크롤링 → Chart/Song 모델에 저장
- YouTube Search API → Song.youtubeUrl에 저장
- 클라이언트 음원 재생: Song._id → youtubeId 추출 → YouTube IFrame API (`utils/youtubePlayer.js`, host: youtube-nocookie.com)
- 비디오 페이지: `/api/youtube/search` → 페이지 내 자체 YT.Player 인스턴스로 임베드. `onError(101/150)` 잡으면 차단 영상으로 판별 → 영상 자리에 "YouTube에서 보기" 안내 카드 표시 (invidious 우회는 anti-bot/X-Frame-Options/지역 IP 제한으로 작동 안 함이 확인됨)
- 비디오 재생: `/video` 탭은 검색/보관함 2개 — 둘 다 "지금 재생 중" 영상과 완전히 분리됨(탭 전환해도 영상 영역이 탭 콘텐츠에 끼어들지 않음). 검색 결과 카드 클릭은 명시적 재생만 (큐 미사용, `videoQueue/setCurrentVideo`). 선택모드는 없음 — 카드마다 항시 노출되는 "추가" 버튼이 `VideoAddModal`을 열어 "재생목록에 추가"/"플레이리스트에 추가" 중 선택(음원 `layouts/main.vue`의 Add-to-Playlist 모달과 동일 패턴)
- "지금 재생 중" 미니플레이어가 음원 `MusicPlayer.vue`와 동일하게 화면 **하단에 고정**(`fixed bottom-0`, 탭/검색바의 sticky 블록과는 별개) — 썸네일 클릭 시 풀스크린 "지금 재생 중" 오버레이로 확장(유튜브 뮤직의 미니플레이어→Now Playing 패턴 차용). 오버레이 안에 큰 영상 프레임 + ◀▶/재생·일시정지/음량/추가 + 재생목록(`VideoQueueList`)이 모두 들어있음 — 재생목록은 최상위 탭이 아니라 이 오버레이에 종속
- 오버레이/미니바 모두 `v-show` 기반이라 `#video-page-player`는 항상 DOM에 유지됨 — 닫혀 있어도 재생은 끊기지 않고 백그라운드에서 계속됨(검색/보관함 탭을 보는 동안에도)
- **자동재생 방지**: 새로고침 등으로 큐/현재영상이 `localStorage`에서 복원될 때는 `autoplay:0`으로 영상을 cue만 하고 재생하지 않음 (`initVideoPlayer(videoId, autoplay)`의 `justRestored` 플래그로 판별). 검색 결과 클릭, 재생목록 항목 클릭, "전체재생" 등 명시적 액션은 항상 autoplay. 영상 종료 시(`onStateChange` ENDED) 큐의 다음 영상으로는 자동 진행(재생목록의 당연한 동작으로 간주, 자동재생 방지 대상 아님). 셔플/반복은 미지원(1차 스코프 제외)
- 헤더에는 별도 큐 진입점 없음(미니플레이어/오버레이가 그 역할)

## YouTube IFrame 인스턴스 관리
- `#youtube-player` div는 `plugins/youtube-init.client.js`에서 `document.body`에 한 번만 마운트
- 레이아웃 전환(main↔video↔admin 등) 시에도 DOM이 살아있어야 `YT.Player` 모듈 스코프 싱글톤(`utils/youtubePlayer.js`)의 바인딩이 좀비화되지 않음
- 비디오 페이지는 위 인스턴스를 안 쓰고 페이지 로컬 `YT.Player` 인스턴스(`#video-page-player`, `pages/video/index.vue` 자체 관리)를 따로 생성 — 충돌 없음
