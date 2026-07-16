# 크론잡 및 외부 연동

## 크론잡 (Netlify Scheduled Functions)
`netlify/functions/cron-*.js` — Netlify Scheduled Functions 사용. 스케줄은 UTC 기준.

모두 차트 크론(08:00) **뒤에** 돈다 — 곡이 저장돼야 필드를 채울 수 있기 때문. 크론마다 30초를 따로 받으므로 분리할수록 하루 처리량이 는다.

| KST 시간 | UTC 스케줄 | 함수 파일 | 작업 |
|----------|-----------|----------|------|
| 매일 08:00 | `0 23 * * *` | `cron-chart.js` | Bugs 차트 크롤링 → Song 저장 → Chart 갱신 |
| 매일 08:10 | `10 23 * * *` | `cron-youtube.js` | youtubeUrl 없는 곡에 YouTube 검색 → URL 저장 |
| 매일 08:20 | `20 23 * * *` | `cron-genre.js` | genre 없는 곡에 Bugs **앨범 페이지**에서 장르/스타일 |
| 매일 08:30 | `30 23 * * *` | `cron-lyrics.js` | lyrics 없는 곡에 Bugs 상세페이지에서 가사 크롤링 |

### ⚠️ 스케줄 함수는 30초 제한 (설정으로 못 늘림)
Netlify 기본값 — 동기 60초 / **스케줄 30초** / 백그라운드 15분. 실행 제한은 **설정 불가**. 타임아웃은 강제 종료라 `catch`가 안 돌아 **슬랙 알림 없이 조용히 죽는다**.

**그래서 크론이 도는 함수는 전부 `CRON_BUDGET_MS`(22초) 시간 예산을 보고 스스로 멈춘다.**
곡 수가 아니라 **경과 시간**으로 끊는 이유: 대상 사이트가 느린 날에도 안 터진다. 못 끝낸 곡은 다음 실행에서 이어지므로 손실이 없다.

**장르를 `cron-chart`에 안 붙인 이유**: 신곡 많은 날 앨범 요청이 30초를 넘기면 **곡 저장 자체가 실패**한다. 가사/유튜브와 같은 "저장 먼저, 필드는 나중에" 패턴으로 분리했다.

**대량 백필은 여전히 크론이 아니라 `scripts/`의 로컬 스크립트가 책임진다.** 크론은 하루치 신곡용이다.

### 🔴 미해결: 못 채우는 곡의 무한 재시도 (head-of-line)
`updateLyrics`는 `updateOne({lyrics})`로 **빈 문자열을 저장**하는데 쿼리가 `{lyrics: {$in: [null,'']}}`라 **저장해도 계속 매칭된다** → 영원히 재시도. 실측으로 6곡이 최대 **567일** 동안 매일 재시도당하는 중. `updateYoutubeUrls`도 동일(못 찾으면 아무것도 저장 안 함).

`[19금]` 곡은 **성인 인증이 필요해 가사를 원리적으로 못 받는다** — 재시도가 무의미하다.

지금은 6곡이라 안 드러나지만 **곡을 대량 적재하면 못 받는 곡이 크론 앞자리를 막아 뒤쪽에 영원히 도달 못 한다.** "시도했으나 실패" 마커 필드가 필요하다 — 상세는 `docs/WORK_LOG.md` 2026-07-17.

(`updateGenres`엔 이미 반영됨: 앨범ID를 못 뽑으면 `genre: []`로 닫아 재시도 대상에서 제외)

### 🔴 미해결: 제목 오염
벅스가 `[19금]`을 스크린리더용 숨김 텍스트로 넣는데 `helper.js`의 `.title.text()`가 그것까지 긁어온다 → `"[19금]\nBAND"`. **`.title a.text()`로 고쳐야 한다.** `getBugsChart`·`searchBugsMusic` 양쪽에 있고 DB 4곡이 이미 오염됐다. 고칠 때 **DB 제목을 먼저 정리해야** 키가 안 어긋난다 — 상세는 `docs/WORK_LOG.md` 2026-07-17.

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
