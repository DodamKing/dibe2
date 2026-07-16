# 데이터 모델 (MongoDB/Mongoose)

## User - server/models/User.js
```
{
  username: String,
  email: String (unique),
  password: String (bcrypt hashed),
  provider: 'google' | 'kakao',
  providerId: String,
  isAdmin: Boolean (default: false),
  expiryDate: Date (default: +24h),
  createdAt, updatedAt (timestamps)
}
```
- `canAccess()`: expiryDate 기준 접근 가능 여부
- `comparePassword()`: bcrypt 비교
- 첫 가입 시 24시간 무료 사용

## Song - server/models/Song.js
```
{
  title: String,
  artist: String,
  album: String,
  coverUrl: String,
  detailLink: String (Bugs Music 상세 페이지),
  lyrics: String,
  youtubeUrl: String,
  adult: Boolean (default: false),  // 벅스 19금 배지 — 가사를 원리적으로 못 받는 곡
  lyricsCheckedAt: Date,            // "찾아봤는데 없더라" 마커 (영구 실패만)
  youtubeCheckedAt: Date,           // 〃
  lastChartedAt: Date,              // 마지막 차트 등장 — 크론 우선순위 정렬 키
  chartHits: Number (default: 0),   // 차트 등장 횟수 — 인기 신호(추천 콜드스타트)
  genre: [String],                  // 벅스 앨범 페이지의 "장르" (큰 분류, UI 필터용)
  style: [String],                  // 벅스 앨범 페이지의 "스타일" (세부 태그, 추천 신호용)
  likeCount: Number (default: 0),   // 집계 캐시 — 원본은 Like 컬렉션
  playCount: Number (default: 0),   // 집계 캐시 — 원본은 PlayEvent 컬렉션
  createdAt, updatedAt (timestamps)
}
```
- 인덱스: `genre: 1`, `likeCount: -1`, `playCount: -1`, `lastChartedAt: -1`(크론 정렬용)
- **`youtubeUrl`은 곡 저장보다 늦게 채워진다** (차트 크론 08:00 저장 → 유튜브 크론 08:10 채움). 그 사이엔 URL이 없는 곡이 존재하므로 **`youtubeUrl`이 항상 있다고 가정하지 말 것**. `getYoutubeId`가 없으면 즉석에서 채우고(lazy fill), 그래도 없으면 `null`을 반환한다 — 상세는 `docs/CRON_EXTERNAL.md`
- **`lyrics`도 마찬가지로 늦게 채워지고, lazy fill 이 있다**(가사 크론 08:30 / `songService.getLyrics`가 재생 시점에 즉석 채움). 실측 671ms
- 🔴 **`lyricsCheckedAt`/`youtubeCheckedAt`은 "찾아봤는데 없더라"를 닫는 마커다.** 이게 없으면 못 받는 곡을 **매일 다시 긁는다**(실측: 6곡이 **567일째** 재시도 중이었음). 백로그가 커지면 치명적 — 크론은 22초에 80곡을 도는데 **못 받는 곡 80개가 앞을 막으면 매일 그것만 하고 끝난다**(head-of-line)
  - **영구 실패에만 찍을 것.** `helper.getLyrics`는 네트워크 실패면 `null`, 가사가 원래 없으면 `''`를 반환한다. `''`일 때만 찍어야 네트워크 실패가 자연히 재시도된다
  - `genre: []`로 닫는 `updateGenres`와 같은 패턴
- **`adult`(19금)는 가사를 원리적으로 못 받는 곡**이다. 벅스가 성인 인증(로그인)을 요구한다(`bugs.ui.showLoginLayer()` / `adultcheckval`). 크론·lazy fill 양쪽에서 **시도 자체를 스킵**하고, UI엔 "가사 없음"이 아니라 **"19금이라 제공 안 됨"으로 구분해서** 표시한다
- **`lastChartedAt`은 크론의 처리 순서를 정한다.** 없으면 자연순(≈`_id`, 오래된 삽입분부터)이라 **대량 적재분이 앞을 막아 오늘 차트 신곡이 몇 달 뒤에나 처리된다**. 가사는 lazy fill 이 있어 그나마 낫지만 **장르는 lazy 가 불가능**(추천이 곡을 누르기 전에 장르로 후보를 고른다 → 없으면 후보에 안 뜨고 → 아무도 안 눌러 영원히 안 채워지는 데드락)해서 신곡이 추천에서 통째로 빠진다. 차트 크론(08:00)이 `markCharted()`로 매일 찍는다
- `genre`/`style`은 **벅스가 트랙이 아니라 앨범에 붙이는 정보**라 앨범 페이지에서 가져온다. 앨범 ID는 `coverUrl` 경로에 그대로 있다(`.../album/images/50/206680/20668087.jpg` → `20668087`)
- 둘은 **서로 다른 축**이다. `genre`는 12종 내외로 거칠고(`댄스/팝` 404곡), `style`은 잘게 쪼개진다(`팝 락` 141곡 — `락/메탈` 장르 64곡보다 많다). OST는 `genre`가 같아도 `style`이 `TV 드라마`/`카툰/코믹스`로 갈린다
- ⚠️ 앨범 페이지의 장르 값은 **차트 장르 코드와 일치하지 않는다**(`J-POP`, `캐롤` 등은 차트 메뉴에 없는 값). UI 필터 목록은 차트 코드가 아니라 **DB에 실제로 쌓인 값**으로 뽑을 것
- `default: undefined`라 백필 전 문서엔 필드가 **물리적으로 없다**(`likeCount`와 같은 함정). 다만 `$inc` 같은 자동 생성 경로가 없어 **백필로 실제로 채워야 한다** — `scripts/backfill-genre.js`로 기존 1091곡 완료(2026-07-16)
- `likeCount`/`playCount`는 **비정규화된 집계 캐시**다. 목록 응답마다 count 쿼리를 돌지 않으려고 둔 것이고, 진짜 원본은 `Like`/`PlayEvent`. 값이 틀어지면 원본에서 재계산할 수 있다
- 인덱스: `likeCount: -1`, `playCount: -1` (인기순 정렬)
- ⚠️ **도입(2026-07-15) 이전 곡 문서엔 두 필드가 물리적으로 없다**(당시 1091곡 전부). Mongoose default는 저장/하이드레이트 때만 채워지므로 **`.lean()` 조회에선 `undefined`가 그대로 나간다**. 백필 대신 `statsService.withCounts`가 응답 시점에 0으로 정규화한다 — `$inc`가 없는 필드를 생성해 주기 때문에 마이그레이션이 필요 없다. **`.lean()`으로 이 필드를 새로 읽는 코드를 추가할 땐 반드시 정규화를 거칠 것**

## Like - server/models/Like.js
```
{
  user: ObjectId (ref: User, required),
  song: ObjectId (ref: Song, required),
  createdAt, updatedAt (timestamps)
}
```
- 인덱스: `{user, song}` **unique**, `{user, createdAt:-1}`(내 좋아요 최신순), `{song}`
- 유니크 인덱스가 중복 좋아요를 DB에서 막는다 → 서비스는 upsert의 `upsertedCount`로 "이번에 새로 생겼는지"를 판별해 `Song.likeCount`를 원자적으로 증감. 동시 요청이 와도 카운터가 실제 Like 수와 어긋나지 않음
- `likeCount` 감소는 `{_id, likeCount: {$gt: 0}}` 조건부 갱신 — 스키마의 `min:0`은 문서 검증이라 `$inc`를 막지 못하기 때문

## PlayEvent - server/models/PlayEvent.js
```
{
  user: ObjectId (ref: User, required),
  song: ObjectId (ref: Song, required),
  source: 'chart'|'playlist'|'search'|'recent'|'video'|'unknown' (default: unknown),
  playedAt: Date (default: now)
}
```
- **추천 기능을 위해 미리 쌓아두는 이력 로그.** 최근성·개인 취향·유입 경로 같은 신호는 카운터만으론 복원이 불가능해서 이벤트로 남긴다
- 인덱스: `{user, playedAt:-1}`(개인 청취 이력), `{song, playedAt:-1}`(기간별 트렌딩), `{user, song, playedAt:-1}`(중복 가드), `{playedAt}` **TTL 180일**
- TTL로 180일 뒤 자동 삭제 — 추천은 최근성이 핵심이라 오래된 이력은 가치가 낮고, 누적 재생수는 `Song.playCount`에 남아 있어 손실이 없다
- 기록 시점은 앱이 **30초/50% 재생 도달** 시 1회. 스킵한 곡이 취향 신호를 오염시키지 않게 하려는 것(스포티파이/유튜브와 같은 방식)

## Playlist - server/models/Playlist.js
```
{
  name: String,
  user: ObjectId (ref: User),
  songs: [{
    songId: ObjectId (ref: Song),
    title: String,
    artist: String,
    coverUrl: String
  }],
  createdAt, updatedAt (timestamps)
}
```
- songs 배열에 곡 정보 비정규화 저장 (빠른 조회용)

## VideoPlaylist - server/models/VideoPlaylist.js
```
{
  name: String,
  user: ObjectId (ref: User),
  videos: [{
    videoId: String,   // YouTube 비디오 ID (참조할 DB 문서 없음 — 전부 비정규화)
    title: String,
    thumbnail: String,
    channelTitle: String,
    duration: String
  }],
  createdAt, updatedAt (timestamps)
}
```
- `Playlist`와 동일 패턴이지만 `songId(ref Song)` 같은 DB 참조가 없음 — 비디오는 YouTube 검색 결과(`/api/youtube/search`)일 뿐 DB 저장 문서가 아니라서 전부 비정규화 필드만 저장
- 중복 판별/제거는 `videoId` 기준

## Chart - server/models/Chart.js
```
{
  lastUpdated: Date,
  items: [{
    rank: Number,
    title: String,
    artist: String,
    album: String,
    coverUrl: String,
    detailLink: String,
    lyrics: String,
    updateAt: Date
  }]
}
```
- 단일 document로 관리 (findOne)
- `findOneAndUpdate` pre-hook으로 lastUpdated 자동 갱신
