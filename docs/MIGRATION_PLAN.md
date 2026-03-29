# AWS → Netlify 이관 계획

## 요약
현재 AWS(PM2 + Nuxt SSR)에서 Netlify(정적 호스팅 + Serverless Functions)로 이관.

## 핵심 판단

### 오디오 스트리밍 - 문제 없음
- `/api/songs/stream/:songId` 엔드포인트가 있지만 **실제 클라이언트는 YouTube IFrame API 사용**
- `store/player.js`의 `play()` → `/api/songs/youtubeId/:songId` → `youtubePlayer.loadVideo(youtubeId)`
- stream 엔드포인트는 레거시/미사용 → **삭제 대상**

### SSR → SPA 전환 가능
- `nuxtServerInit`만 SSR 의존 (세션 하이드레이션)
- 모든 페이지 데이터가 `mounted()`에서 로드 (asyncData/fetch 미사용)
- **해결**: `nuxtServerInit` 제거 → 클라이언트에서 `/api/users/me` 호출로 대체

### 세션 유지 가능
- express-session + MongoStore → `serverless-http`로 감싸면 그대로 동작
- JWT 전환 불필요 (변경 최소화)

---

## Phase 1: 정리 및 준비

### 1-1. 불필요한 의존성 제거
- `puppeteer`, `puppeteer-extra`, `puppeteer-extra-plugin-stealth` (미사용)
- `ffmpeg-static`, `fluent-ffmpeg` (미사용)
- `node-cron` (serverless 불가 → Netlify Scheduled Functions로 대체)
- `ecosystem.config.js` 삭제 (PM2 설정)

### 1-2. 레거시 코드 제거
- `/api/songs/stream/:songId` 엔드포인트 삭제 (server/api/song.js)
- `server/utils/advancedInvidiousManager.js` 삭제 (stream용)
- `server/utils/y2mate.js` 삭제 (미사용)
- `MusicPlayer_v2.vue` 삭제 (미사용)

### 1-3. 수정할 파일
| 파일 | 변경 내용 |
|------|-----------|
| `package.json` | 불필요 패키지 제거, `serverless-http` 추가 |
| `server/api/song.js` | stream 라우트/import 제거 |

---

## Phase 2: 프론트엔드 SPA 전환

### 2-1. nuxt.config.js 변경
```js
// 추가
ssr: false,
target: 'static',

// serverMiddleware 전체 제거 (Netlify Functions로 이동)
// serverMiddleware: [...] → 삭제
```

### 2-2. nuxtServerInit → 클라이언트 초기화
- `store/index.js`: `nuxtServerInit` 제거
- `plugins/`에 `auth-init.js` 플러그인 생성 (client-only)
  - 앱 시작 시 `/api/users/me` 호출 → store에 user 설정
- `nuxt.config.js`에 플러그인 등록

### 2-3. 클라이언트 미들웨어 수정
- `middleware/auth.js`: 초기 로딩 상태 처리 추가 (auth 체크 전 로딩)

---

## Phase 3: API를 Netlify Functions로 이관

### 3-1. 구조
```
netlify/
  functions/
    api.js          ← serverless-http로 Express 앱 래핑 (모든 /api/* 처리)
    cron-chart.js   ← 스케줄 함수: 차트 업데이트 (매일 08:00)
    cron-youtube.js ← 스케줄 함수: YouTube URL 업데이트 (매일 08:10)
    cron-lyrics.js  ← 스케줄 함수: 가사 업데이트 (매일 02:00)
```

### 3-2. api.js (메인 함수)
- `serverless-http`로 기존 Express 앱 감싸기
- 기존 코드 최대한 재사용 (라우터, 서비스, 미들웨어)
- DB 연결: maxPoolSize 1로 줄이고, 커넥션 캐싱

### 3-3. DB 연결 최적화 (server/models/index.js)
```js
// 변경: serverless 최적화
maxPoolSize: 1,        // 10 → 1
serverSelectionTimeoutMS: 5000,
socketTimeoutMS: 10000, // 45000 → 10000
```
- SIGINT 핸들러 제거 (serverless에서 무의미)

### 3-4. 세션 설정 수정 (server/middleware/session.js)
```js
cookie: {
    secure: true,      // false → true (Netlify HTTPS)
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
}
```

### 3-5. CORS 수정 (server/middleware/cors.js)
- Netlify 도메인 추가 (또는 환경변수로)
- `dibe2.dimad.site` → 새 도메인

### 3-6. 크론잡 → Netlify Scheduled Functions
각 크론잡을 독립 함수로 분리:
- `cron-chart.js`: Bugs 차트 크롤링 → Song/Chart 저장
- `cron-youtube.js`: YouTube URL 업데이트
- `cron-lyrics.js`: 가사 크롤링

```js
// 예시: cron-chart.js
import { schedule } from "@netlify/functions"
export const handler = schedule("0 8 * * *", async () => { ... })
```

---

## Phase 4: 배포 설정

### 4-1. netlify.toml 생성
```toml
[build]
  command = "nuxt generate"
  publish = "dist"
  functions = "netlify/functions"

[[redirects]]
  from = "/api/*"
  to = "/.netlify/functions/api/:splat"
  status = 200

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
```

### 4-2. 환경변수 (Netlify Dashboard에서 설정)
- `MONGODB_URI`
- `SESSION_SECRET`
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`
- `KAKAO_CLIENT_ID`
- `SLACK_WEBHOOK_URL`

### 4-3. OAuth 콜백 URL 업데이트
- Google Console: redirect URI를 Netlify 도메인으로 변경
- Kakao Developer: 동일

---

## Phase 5: 검증

### 체크리스트
- [ ] `nuxt generate` 빌드 성공
- [ ] 로그인/로그아웃 정상 (세션 쿠키)
- [ ] Google/Kakao 소셜 로그인
- [ ] 차트 표시
- [ ] 곡 검색
- [ ] 플레이리스트 CRUD
- [ ] 음악 재생 (YouTube IFrame)
- [ ] 관리자 페이지
- [ ] 크론잡 실행 확인
- [ ] 구독 만료 리다이렉트

---

## 작업 순서 요약
1. 불필요한 패키지/코드 정리
2. SPA 전환 (nuxt.config + auth 플러그인)
3. Netlify Functions 구조 생성 (api.js + cron 3개)
4. DB/세션/CORS 설정 수정
5. netlify.toml + 환경변수
6. OAuth 콜백 URL 변경
7. 배포 및 검증
