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
│   └── TestErrorComponent.vue
│
├── layouts/
│   ├── auth.vue         # 로그인/회원가입용 레이아웃
│   └── main.vue         # 메인 레이아웃 (플레이어, 헤더 포함) ★ 핵심
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
│   └── playlist/_id.vue # 플레이리스트 상세
│
├── plugins/
│   └── error-handler.js
│
├── server/              # Express 백엔드 (Nuxt serverMiddleware)
│   ├── api/
│   │   ├── index.js     # Express app 생성, 라우터 마운트
│   │   ├── song.js      # /api/songs/*
│   │   ├── playlist.js  # /api/playlists/*
│   │   ├── admin.js     # /api/admin/*
│   │   └── user.js      # /api/users/* (로그인/OAuth/JWT 발급)
│   ├── middleware/
│   │   ├── auth.js      # JWT 인증 (jwtCheckMiddleware, adminMiddleware, generateToken)
│   │   ├── cors.js
│   │   ├── cron.js      # 크론잡 (차트/유튜브URL/가사 업데이트)
│   │   ├── dailyVisitor.js
│   │   └── dbConnection.js
│   ├── models/
│   │   ├── Chart.js     # 차트 (items: [{rank,title,artist,...}])
│   │   ├── Playlist.js  # 플레이리스트 (user ref, songs[])
│   │   ├── Song.js      # 곡 (title,artist,album,youtubeUrl,lyrics)
│   │   └── User.js      # 유저 (email,provider,expiryDate,isAdmin)
│   ├── services/
│   │   ├── index.js     # 서비스 export hub
│   │   ├── songService.js    # 차트/곡/유튜브/검색 로직
│   │   ├── playlistService.js
│   │   ├── adminService.js   # 통계, 접근 기간 설정
│   │   └── userService.js
│   └── utils/
│       ├── helper.js              # Bugs 크롤링, 가사, Slack 알림
│       ├── advancedInvidiousManager.js  # Invidious 오디오 스트리밍
│       └── y2mate.js
│
├── store/               # Vuex 스토어
│   ├── index.js
│   ├── auth.js          # 로그인/로그아웃
│   ├── player.js        # 재생 상태 (큐, 현재곡, 볼륨, 셔플, 반복) ★ 핵심
│   ├── playlist.js      # 내 플레이리스트 CRUD
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
- 클라이언트 재생: Song._id → youtubeId 추출 → YouTube IFrame API
