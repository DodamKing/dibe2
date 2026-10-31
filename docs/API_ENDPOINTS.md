# API 엔드포인트

모든 API는 `/api` 하위. JWT 인증 필요 (Authorization: Bearer 헤더, publicPaths 제외 — 자세한 건 docs/AUTH_FLOW.md).

## Songs (`/api/songs`) - server/api/song.js
| Method | Path | 설명 |
|--------|------|------|
| GET | `/chart` | Bugs Top100 차트 데이터 |
| GET | `/chart/pop` | 해외(팝) Top100. 응답 모양은 `/chart`와 같음(`{chart}`), 수집 전이면 `chart: null`. 별도 컬렉션 `popcharts` |
| GET | `/songdata?title=&artist=` | 제목+아티스트로 곡 조회 |
| POST | `/songsdata` | body: {songs[]} → 복수 곡 조회 |
| GET | `/search?query=&type=&page=&limit=` | 곡 검색 (type: all/title/artist/lyrics). **all=공백 토큰 AND**(각 토큰이 title∪artist 어디든 매칭) → "아이유 좋은날"처럼 가수+제목 조합도 잡힘. 단일 토큰은 종전과 동일 |
| GET | `/youtubeId/:songId` | songId → YouTube 비디오 ID |
| POST | `/by-ids` | body: {ids[]} → ID 배열로 일괄 조회 (lyrics 제외, 캐시 갱신용). 응답에 `liked`/`likeCount`/`playCount` 포함 |
| GET | `/lyrics/:songId` | songId → `{lyrics, adult}`. **비어 있으면 즉석에서 채운다(lazy fill)** — 상세는 아래 |
| POST | `/` | 곡 추가 |
| PUT | `/:id` | 곡 수정 (관리자만) |
| DELETE | `/delete/:id` | 곡 삭제 |
| GET | `/search-bugs?query=` | Bugs Music 검색 |
| GET | `/search-youtube?query=` | YouTube 검색. **길이로 안 거른다**(2026-08-16) — 관리자가 눈으로 보고 고르는 화면이라 후보를 좁히지 않는다. 예전 2~6분 상한 탓에 6분 넘는 곡은 손으로도 못 찾았다. 자동 판정(크론·lazy fill)만 곡 길이 ±5초 → `docs/CRON_EXTERNAL.md` |

- **`/lyrics/:songId` 는 조회가 아니라 "조회 + 즉석 채우기"다.** 가사가 비어 있으면 벅스 트랙 페이지를 그 자리에서 긁어 저장하고 반환한다(실측 671ms). **같은 페이지에 있는 곡 길이(`duration`)도 같이 저장한다 — 요청이 안 늘어난다.** 크론(08:10)만으로는 백로그를 다 채우는 데 수개월이 걸리는데, lazy fill 은 **사용자가 실제로 튼 곡부터** 채우므로 그 대기가 사실상 사라진다. `youtubeUrl` 의 `getYoutubeId` 와 같은 패턴이고, 크론과 lazy fill 이 둘 다 "가사 없는 곡"만 고르므로 중복이 없다
  - 응답의 `adult` 는 **"가사 없음"과 "19금이라 제공 안 됨"을 UI가 구분**하기 위한 것. 19금 곡과 이미 "없음"으로 닫힌 곡(`lyricsCheckedAt`)은 **긁지 않고 즉시 반환**한다(실측 43~52ms) — 안 그러면 가사를 못 받는 곡을 누를 때마다 벅스를 때리는 증폭기가 된다
  - 프론트는 `lyrics === undefined`(아직 응답 전 = 로딩)와 `''`(받아왔는데 없음)를 구분한다. `store/player.js`의 `fetchCurrentTrackLyrics`는 **응답이 늦게 와서 다음 곡에 붙는 걸 막는 가드**가 있다(lazy fill 이 1초 가까이 걸릴 수 있음)

### 좋아요 / 재생수
| Method | Path | 설명 |
|--------|------|------|
| GET | `/liked?page=&limit=` | 내가 좋아요한 곡(최신순). → `{songs[], total, page, limit, hasMore}` (limit 최대 100) |
| POST | `/:id/like` | 좋아요 등록(멱등) → `{liked:true, likeCount, changed}` |
| DELETE | `/:id/like` | 좋아요 해제(멱등) → `{liked:false, likeCount, changed}` |
| POST | `/:id/play` | 재생 1회 기록. body: `{source}` (chart/playlist/search/recent/video) → `{playCount, counted}` |

- 🔴 **유저 id는 `req.user.userId`** (JWT 페이로드 키가 `_id`가 아님 — `server/api/user.js` 5개 로그인 경로 전부 `userId`). `_id`로 읽으면 undefined가 흘러 **고아 문서 생성 + 사용자 간 좋아요 유출**이 발생한다. `statsService.requireUserId()`가 이제 즉시 throw로 막지만, 새 라우트를 붙일 땐 `userId`를 넘길 것
- **라우트 순서 주의**: `/liked`는 `/:id` 계열보다 먼저 선언돼 있어야 param으로 먹히지 않는다.
- `changed:false` = 이미 그 상태라 카운터 변화 없음(멱등). 앱은 `likeCount`만 신뢰하면 된다.
- **재생 카운트 시점 = 30초 또는 50% 재생 도달 시 1회**(스킵은 안 셈). 서버는 같은 유저·같은 곡 20초 내 재발사를 중복으로 보고 무시하며 이때 `counted:false`.
- 잘못된 id 형식은 400(500으로 새면 디스코드 에러 알림이 울림).

## Playlists (`/api/playlists`) - server/api/playlist.js
| Method | Path | 설명 |
|--------|------|------|
| POST | `/` | 플레이리스트 생성 |
| GET | `/` | 내 플레이리스트 목록 |
| GET | `/:id` | 플레이리스트 상세 |
| DELETE | `/:playlistId` | 플레이리스트 삭제 |
| POST | `/:id/songs` | 플레이리스트에 곡 추가 |
| DELETE | `/:id/songs` | 플레이리스트에서 곡 제거 |
| PUT | `/:id/name` | 플레이리스트 이름 변경 |

## Video Playlists (`/api/video-playlists`) - server/api/videoPlaylist.js
음원 `Playlist`와 동일 패턴이나 DB에 저장된 문서가 없는 YouTube 검색 결과(영상)를 다룸 — `songId` ref 대신 `videoId`(YouTube 비디오 ID)로 중복 판별.
| Method | Path | 설명 |
|--------|------|------|
| POST | `/` | 비디오 플레이리스트 생성 |
| GET | `/` | 내 비디오 플레이리스트 목록 |
| GET | `/:id` | 비디오 플레이리스트 상세 |
| DELETE | `/:playlistId` | 비디오 플레이리스트 삭제 |
| POST | `/:id/videos` | 플레이리스트에 영상 추가 |
| DELETE | `/:id/videos` | 플레이리스트에서 영상 제거 |
| PUT | `/:id/name` | 플레이리스트 이름 변경 |

## Admin (`/api/admin`) - server/api/admin.js (adminMiddleware 필수)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/user-stats` | 사용자 통계 (총 유저, 신규 유저 등) |
| GET | `/visitor-stats` | 방문자 통계 (7일) |
| GET | `/system-stats` | 시스템 상태 (CPU/메모리/디스크/uptime) |
| PUT | `/users/:userId/access` | 사용자 접근 기간 설정 {days} |

## YouTube (`/api/youtube`) - server/api/youtube.js
| Method | Path | 설명 |
|--------|------|------|
| GET | `/search?query=&limit=` | 유튜브 영상 검색 (비디오 페이지 전용, 길이 필터 없음). 응답: `{ items: [{id, title, duration, thumbnail, channelTitle}] }` |

## Users (`/api/users`) - server/api/user.js
| Method | Path | 설명 |
|--------|------|------|
| POST | `/login` | 로그인 |
| POST | `/logout` | 로그아웃 |
| POST | `/register` | 회원가입 |
| POST | `/google` | 구글 소셜 로그인. 본문 `refresh: true`면 접근(1h)+리프레시(90d) 토큰 쌍 |
| POST | `/kakao` | 카카오 소셜 로그인. 〃 |
| POST | `/refresh` | `{refreshToken}` → `{token, refreshToken, user}`. 권한을 DB에서 새로 읽음. 옛 30일 토큰도 1회 교환. 상세 `AUTH_FLOW.md` |

## App (`/api/app`) - server/api/app.js (안드로이드 앱 배포/자동 업데이트)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/latest` | 최신 앱 버전. 응답: `{ version, notes, size }` (GitHub Releases API 조회). 로그인 필수 |
| GET | `/download` | APK 다운로드용 단기 서명 URL. 응답: `{ url, version, size, filename }`. 로그인 필수(게이팅) |

> APK는 private 저장소 `dibe2-app`의 GitHub Releases 자산으로 배포. `/download`는 private 자산을 octet-stream으로 요청해 GitHub이 주는 단기 서명 URL(약 5분)만 받아 반환(바이트 프록시 X → Netlify 6MB 제한 무관). Netlify env `GITHUB_TOKEN`(dibe2-app contents:read) 필요.

## Themes (`/api/themes`) - server/api/theme.js (테마 플레이리스트, 모바일 앱용)
설계·알고리즘은 `docs/THEME_PLAYLIST.md`. 로그인 필수(전역 JWT).

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 활성 테마 목록(order 순). 응답: `{ themes: [{ key, name, songCount, updatedAt, cover }] }`. `cover` = core 점수 1위 국내곡 썸네일(앱 카드 그림, 없으면 null) |
| GET | `/:key?seed=` | 테마 곡 50개. 응답: `{ theme: {key, name}, seed, updatedAt, songs: [{ videoId, title, artist, duration, thumbnail, tier }] }`. 없는·비활성 테마는 404 |

- **결과는 유튜브 영상**이라 `Song`과 무관하다(`songId` 없음). 재생은 `videoId` 그대로, 썸네일은 서버가 `i.ytimg.com/vi/{id}/hqdefault.jpg`로 만들어 준다
- **`seed`**: 같은 seed면 같은 50곡·같은 순서. 안 보내면 서버가 랜덤으로 정해 응답에 넣는다 → 앱이 "새로고침"은 seed 없이, "아까 그 목록 다시 그리기"는 받은 seed로 요청
- 구성: 대표곡 15(항상) + 핵심 20(가중 랜덤) + 탐색 15(`tier: 'explore'`, 1개 리스트에만 나온 곡). 해외곡 최대 5
- API는 DB만 읽는다(유튜브 요청 없음). 풀 갱신은 `scripts/refresh-themes.js`
- `duration`은 초 단위 숫자(비디오 플레이리스트의 `"3:45"` 문자열과 다르다)

## 기타
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/send-error-message` | 클라이언트 에러를 디스코드로 전송 (프로덕션만) |
