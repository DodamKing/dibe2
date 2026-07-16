# 크론잡 및 외부 연동

## 크론잡 (Netlify Scheduled Functions)
`netlify/functions/cron-*.js` — Netlify Scheduled Functions 사용. 스케줄은 UTC 기준.

| KST 시간 | UTC 스케줄 | 함수 파일 | 작업 |
|----------|-----------|----------|------|
| 매일 08:00 | `0 23 * * *` | `cron-chart.js` | Bugs 차트 크롤링 → Song 저장 → Chart 갱신 |
| 매일 08:10 | `10 23 * * *` | `cron-youtube.js` | youtubeUrl 없는 곡에 YouTube 검색 → URL 저장 |
| 매일 02:00 | `0 17 * * *` | `cron-lyrics.js` | lyrics 없는 곡에 Bugs 상세페이지에서 가사 크롤링 |

### ⚠️ 스케줄 함수는 30초 제한 (설정으로 못 늘림)
Netlify 기본값 — 동기 60초 / **스케줄 30초** / 백그라운드 15분. 실행 제한은 **설정 불가**.

`updateLyrics()`/`updateYoutubeUrls()`는 **대상 전량을 한 호출의 for 루프**로 돌기 때문에 30초에 처리 가능한 양이 정해져 있다:
- **유튜브 약 15곡** (곡당 검색 1초 내외 + `songService.js`의 **고정 1초 딜레이**)
- **가사 60~100곡** (딜레이 없음)

평소엔 차트 신곡이 하루 몇 곡뿐이라 문제가 없지만, **대량 백로그가 생기면 크론은 절대 못 삼킨다**(1만 곡이면 유튜브 600일+). 타임아웃은 강제 종료라 `catch`가 안 돌아 **슬랙 알림 없이 조용히 죽는다**. 못 채우는 곡이 15개쯤 쌓이면 매일 그것만 붙잡고 죽어 신곡에 영원히 도달 못 하는 head-of-line 문제도 생긴다(현재 미보유 0이라 미발생).

→ **대량 백필은 크론이 아니라 로컬 스크립트가 책임질 것.**

### youtubeUrl lazy fill
곡 저장(08:00)과 URL 채움(08:10) 사이 10분 갭에 눌린 곡은 `songService.getYoutubeId`가 **즉석에서 검색해 채운다**(`updateYoutubeUrl(_id)`, 실측 1.1초). 그래도 못 찾으면 `null`.

- 크론과 lazy fill 둘 다 "URL 없는 곡"만 고르므로 **먼저 채운 쪽이 상대의 대상에서 빠져** 중복 작업이 안 생긴다
- **API 레벨 방어**라 앱(dibe2-app)도 수정 없이 보호된다. 다만 "유튜브에 정말 없는 곡"에서 **멈출지 다음 곡으로 넘길지는 큐를 아는 클라이언트 몫**(서버는 큐를 모름)
- 실패율은 실측상 0에 수렴(1091곡 전부 URL 보유) — 재시도 스킵용 `youtubeCheckedAt` 같은 필드는 아직 불필요

## 외부 서비스

### Bugs Music (server/utils/helper.js)
- `getBugsChart()`: 일간 차트 Top100 크롤링 (cheerio)
- `searchBugsMusic(query)`: 검색 (최대 20개)
- `getLyrics(detailLink)`: 상세 페이지에서 가사 추출
- `getBugsDetailUrl(query)`: 검색 → 첫 결과의 상세 URL

### YouTube (server/services/songService.js)
- `youtube-search-api` 패키지로 검색
- 2분~6분 길이 영상만 필터링
- URL 형식: `https://www.youtube.com/watch?v={id}`
- 재생은 클라이언트의 YouTube IFrame API로 처리 (서버 프록시 없음)

### Slack (server/utils/helper.js)
- `sendErrorToSlack()`: 에러 발생 시 Slack webhook으로 알림
- 프로덕션에서만 전송

### Google OAuth
- Client ID/Secret: `.env`
- Google Sign-In 버튼 (GSI client)

### Kakao OAuth
- Client ID: `.env`
