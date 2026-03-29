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
