# API 엔드포인트

모든 API는 `/api` 하위. 세션 인증 필요 (publicPaths 제외).

## Songs (`/api/songs`) - server/api/song.js
| Method | Path | 설명 |
|--------|------|------|
| GET | `/chart` | Bugs Top100 차트 데이터 |
| GET | `/stream/:songId` | 오디오 스트리밍 (Invidious) |
| GET | `/songdata?title=&artist=` | 제목+아티스트로 곡 조회 |
| POST | `/songsdata` | body: {songs[]} → 복수 곡 조회 |
| GET | `/search?query=&type=&page=&limit=` | 곡 검색 (type: all/title/artist/lyrics) |
| GET | `/youtubeId/:songId` | songId → YouTube 비디오 ID |
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

## Admin (`/api/admin`) - server/api/admin.js (adminMiddleware 필수)
| Method | Path | 설명 |
|--------|------|------|
| GET | `/user-stats` | 사용자 통계 (총 유저, 신규 유저 등) |
| GET | `/visitor-stats` | 방문자 통계 (7일) |
| GET | `/system-stats` | 시스템 상태 (CPU/메모리/디스크/uptime) |
| PUT | `/users/:userId/access` | 사용자 접근 기간 설정 {days} |

## Users (`/api/users`) - server/api/user.js
| Method | Path | 설명 |
|--------|------|------|
| POST | `/login` | 로그인 |
| POST | `/logout` | 로그아웃 |
| POST | `/register` | 회원가입 |
| POST | `/google` | 구글 소셜 로그인 |
| POST | `/kakao` | 카카오 소셜 로그인 |

## 기타
| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/send-slack-message` | Slack 메시지 전송 (프로덕션만) |
