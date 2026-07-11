# API 엔드포인트

모든 API는 `/api` 하위. JWT 인증 필요 (Authorization: Bearer 헤더, publicPaths 제외 — 자세한 건 docs/AUTH_FLOW.md).

## Songs (`/api/songs`) - server/api/song.js
| Method | Path | 설명 |
|--------|------|------|
| GET | `/chart` | Bugs Top100 차트 데이터 |
| GET | `/songdata?title=&artist=` | 제목+아티스트로 곡 조회 |
| POST | `/songsdata` | body: {songs[]} → 복수 곡 조회 |
| GET | `/search?query=&type=&page=&limit=` | 곡 검색 (type: all/title/artist/lyrics) |
| GET | `/youtubeId/:songId` | songId → YouTube 비디오 ID |
| POST | `/by-ids` | body: {ids[]} → ID 배열로 일괄 조회 (lyrics 제외, 캐시 갱신용) |
| GET | `/lyrics/:songId` | songId → 가사 단일 조회 (lazy fetch용) |
| POST | `/` | 곡 추가 |
| PUT | `/:id` | 곡 수정 (관리자만) |
| DELETE | `/delete/:id` | 곡 삭제 |
| GET | `/search-bugs?query=` | Bugs Music 검색 |
| GET | `/search-youtube?query=` | YouTube 검색 (2~6분 영상) |

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
| POST | `/google` | 구글 소셜 로그인 |
| POST | `/kakao` | 카카오 소셜 로그인 |

## App (`/api/app`) - server/api/app.js (안드로이드 앱 배포/자동 업데이트)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/latest` | 최신 앱 버전. 응답: `{ version, notes, size }` (GitHub Releases API 조회). 로그인 필수 |
| GET | `/download` | APK 다운로드용 단기 서명 URL. 응답: `{ url, version, size, filename }`. 로그인 필수(게이팅) |

> APK는 private 저장소 `dibe2-app`의 GitHub Releases 자산으로 배포. `/download`는 private 자산을 octet-stream으로 요청해 GitHub이 주는 단기 서명 URL(약 5분)만 받아 반환(바이트 프록시 X → Netlify 6MB 제한 무관). Netlify env `GITHUB_TOKEN`(dibe2-app contents:read) 필요.

## 기타
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/send-slack-message` | Slack 메시지 전송 (프로덕션만) |
