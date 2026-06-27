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
  youtubeUrl: String
}
```

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
