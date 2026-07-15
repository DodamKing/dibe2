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
  likeCount: Number (default: 0),   // 집계 캐시 — 원본은 Like 컬렉션
  playCount: Number (default: 0)    // 집계 캐시 — 원본은 PlayEvent 컬렉션
}
```
- `likeCount`/`playCount`는 **비정규화된 집계 캐시**다. 목록 응답마다 count 쿼리를 돌지 않으려고 둔 것이고, 진짜 원본은 `Like`/`PlayEvent`. 값이 틀어지면 원본에서 재계산할 수 있다
- 인덱스: `likeCount: -1`, `playCount: -1` (인기순 정렬)

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
