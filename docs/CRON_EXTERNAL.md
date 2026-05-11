# 크론잡 및 외부 연동

## 크론잡 (Netlify Scheduled Functions)
`netlify/functions/cron-*.js` — Netlify Scheduled Functions 사용. 스케줄은 UTC 기준.

| KST 시간 | UTC 스케줄 | 함수 파일 | 작업 |
|----------|-----------|----------|------|
| 매일 08:00 | `0 23 * * *` | `cron-chart.js` | Bugs 차트 크롤링 → Song 저장 → Chart 갱신 |
| 매일 08:10 | `10 23 * * *` | `cron-youtube.js` | youtubeUrl 없는 곡에 YouTube 검색 → URL 저장 |
| 매일 02:00 | `0 17 * * *` | `cron-lyrics.js` | lyrics 없는 곡에 Bugs 상세페이지에서 가사 크롤링 |

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
