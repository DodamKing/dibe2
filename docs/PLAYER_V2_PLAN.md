# 웹 2단계 — 큐 재설계 + 재생 화면 새로 만들기 + 테마 (설계안)

> 2026-10-31 작성 · 같은 날 코드 대조 검토(에이전트) 반영. 상태: **계획 합의 중** (코드 착수 전)
> 사용자 결정: 시안 먼저 / 아이콘은 사이트 전체 교체 / **테마까지 끝내고 배포** / 큐 한도는 업계 관행대로 / 키보드 단축키 안 함

## 진행 순서

| 단계 | 내용 | 끝나면 |
|---|---|---|
| **0. 시안** | 재생 화면 3조각(미니 플레이어·지금 재생 중·재생 대기열) + 테마 페이지 시안을 HTML 페이지로. 데스크탑·모바일 둘 다 | 사용자가 고른 뒤 1로 |
| **1. 큐 구조 (A)** | `store/player.js` 재작성 + 서버 `/songsdata` 배치화. 기존 화면은 최소한으로만 붙임 | 로컬 커밋 |
| **2. 재생 화면 (B)** | 시안대로 3조각 새로 만들기 + 아이콘 사이트 전체 교체 | 로컬 커밋 |
| **3. 테마 (C)** | 웹 테마 페이지 + 유튜브 곡을 음원 플레이어로 재생 | 로컬 커밋 |
| **4. 배포** | push → 배포 후 `node scripts/fix-song-refs.js` | |

각 단계는 모바일 폭까지 확인하고 넘어간다. 끝나면 `docs/FRONTEND.md` player 섹션·`API_ENDPOINTS.md`(songsdata) 갱신.

## A. 큐 구조

### 왜 다시 짜나
- 지금 큐는 배열 하나(`queue`)이고 곡 동일성 비교가 전부 `_id` → 같은 곡 두 번 못 넣음, `_id` 없는 유튜브 곡은 못 넣음
- 줄 클릭(`playNow`)이 "그 곡만 큐 맨 뒤에 넣고 재생"이라 **그 곡이 끝나면 멈춘다**

### 모델 (스포티파이·애플뮤직과 같은 2구역)

```
state.currentTrack : 지금 곡 (QueueItem)   ← 이름 유지. mediaSession·titleUpdate·MusicPlayer·layouts/main 이 기대고 있음
state.upNext       : [QueueItem]  ← "다음에 재생" — 직접 넣은 곡. 항상 먼저 나오고, 재생되면 빠진다
state.context      : {            ← "다음: ○○에서" — 지금 듣는 목록
    source: { type: 'chart'|'liked'|'playlist'|'theme'|'search'|'legacy', id, name },  // 테마는 id에 seed 포함
    items:  [QueueItem],          // 원래 순서
    order:  [index],              // 셔플이면 섞인 순서, 아니면 0..n-1
    pos:    현재 위치(order 기준)
}
state.history      : [QueueItem]  ← upNext에서 재생한 곡의 "이전" 용, 최근 50개
state.shuffleOn / repeatMode     ← 그대로
```

```
QueueItem = { qid, kind: 'song'|'video', _id?, videoId?, title, artist, coverUrl }
```
- **이름 유지**: `currentTrack`·`SET_CURRENT_TRACK`·song 항목의 `_id`·`coverUrl`은 바꾸지 않는다 → `store/plugins/*`는 무수정
- `qid` = 큐에 들어갈 때 붙이는 고유 키. **곡 비교는 전부 `qid`로**
- 🔴 **`_id`로 걸려 있던 곡 단위 동작을 `qid`로 옮긴다** — 그대로 두면 같은 곡이 연달아 나올 때 깨진다
  - 가사 watcher(`Playlist.vue`): `_id`가 같아 다시 안 부름 → "불러오는 중"에서 멈춤
  - 재생수(`tallyPlay`): 리셋 안 돼 두 번째 재생을 안 셈
  - 이어듣기 위치(`resumePosition`)
- 🔴 **`kind:'song'`만 song 경로를 탄다**: 가사 fetch · 재생수 POST · 하트(`likes/ensure`) · `/by-ids` 갱신 · `/youtubeId/` 조회. video는 전부 건너뛰고, 가사 자리엔 "유튜브 곡은 가사를 제공하지 않아요" 같은 고정 문구

### 동작
| 행동 | 지금 | 바뀐 뒤 |
|---|---|---|
| 목록에서 줄 클릭 (홈·차트·좋아요·테마) | 그 곡만 큐 뒤에 넣고 재생 | **그 목록 전체를 context로, 그 곡부터 재생**. upNext는 지켜짐. 홈은 10줄만 보이지만 context는 **차트 100곡 전체 + 누른 위치** |
| 플리 상세(`playlist/_id.vue`) | 줄 클릭 재생 **없음**(삭제 버튼만) | 줄 클릭 재생을 **새로 추가** |
| 전체 재생 / 셔플 재생 | 큐 통째 교체 | context 교체 (upNext 유지) |
| ⋯ 메뉴 | "재생목록에 추가"(맨 뒤) | **"다음에 재생"**(upNext 맨 앞) / **"대기열 맨 뒤에 추가"**(upNext 맨 뒤). 알림 문구도 각각("다음에 재생할게요" / "대기열에 추가했어요") |
| 검색에서 여러 곡 추가 | 큐 맨 뒤, 중복 거부 | upNext 맨 뒤. **중복 허용**(업계 공통) → `ALL_DUPLICATES`·`duplicates` 반환 계약 정리 |
| 다음 곡 (사용자가 누름) | 배열 다음 칸 (한 곡 반복이면 같은 곡) | upNext 첫 곡 → 없으면 context 다음 → 끝이면 반복 전체면 처음, 아니면 정지. **한 곡 반복이어도 넘어간다** |
| 곡이 끝나 자동으로 넘어감 | 〃 | 한 곡 반복이면 같은 곡, 아니면 위와 같음 (사용자 조작과 구분) |
| 이전 곡 | 배열 앞 칸 | **3초 넘게 들었으면 처음으로**. 아니면 지금 곡이 upNext 출신이면 history에서, context 곡이면 `pos-1` |
| 셔플 켜기/끄기 | 큐 전체를 섞음 | **context만** `order`를 다시 만든다. 지금 곡이 context 곡이면 그 곡이 새 order의 맨 앞 / upNext 곡이면 pos는 처음 앞으로 |
| 큐 끝난 뒤 재생 | 첫 곡 | `order[0]`부터 (셔플 중이면 새로 섞음) |
| 재생 에러 (임베드 차단 등) | 로그만 — "재생 중" 표시로 멈춤 | **알림 띄우고 다음 곡**. 연속 5회 실패면 정지 |
| 대기열 패널에서 삭제 | 배열에서 뺌 | upNext면 그냥 뺌 / context면 `items`·`order`를 다시 매기고 pos 보정. 지금 곡을 지우면 다음 곡으로 |
| 대기열 패널 드래그 | 전체 배열 | 구역 안에서만. context 드래그는 `order`를 바꾼다(셔플 끄면 원래 순서로 돌아감 — 스포티파이와 같음) |

### 한도 (업계 관행)
스포티파이·애플뮤직 모두 **목록 재생엔 별도 한도가 없다** — 목록 크기가 곧 한도. 직접 쌓는 대기열에만 상한을 둔다.
→ **context는 한도 없음, upNext만 1000곡** (지금 큐 전체에 걸린 1000곡 한도를 upNext로 옮긴다)

### 곡 찾기 — `/api/songs/songsdata` 고치기 (서버)
- 지금: 곡마다 **순차 `findOne`**(`server/api/song.js:62`) + 결과에 가사까지 실음. 줄 클릭을 "차트 100곡 context"로 바꾸면 100번 순차 조회가 끝나야 재생이 시작된다
- 고칠 것: 한 번의 `$or` 조회로 바꾸고, 가사 빼고, **요청 순서대로** 돌려주고, 못 찾은 곡은 `null` 자리 유지
- 클라이언트: **누른 곡은 먼저 1곡 조회로 바로 재생, context는 뒤에서 채운다**. `null`은 걸러내고 pos를 다시 맞춘다
- 좋아요 곡(`_id`)·플리 곡(`songId`)은 곡 id가 이미 있다 → 변환 없이 바로 QueueItem으로
- 기존 버그도 같이: `addToPlaylist`가 제목을 URL 인코딩 안 함(`&` 들어간 제목 깨짐)

### 재생 (`play()`)
- song → `/api/songs/youtubeId/:_id` (지금과 같음) / video → `videoId`를 바로 로드

### 저장·이전
- localStorage 키 `user_{id}_player_v2` = `{context(source·items·order), upNext, currentTrack(qid 포함), shuffleOn}`. `pos`는 곡이 바뀔 때마다 바뀌므로 **별도 키**로 가볍게 저장(목록이 커도 매번 전체를 안 씀). 볼륨·반복·위치 키는 그대로
- `refreshQueueData`는 서버 객체로 통째 교체하지 말고 **`{...item, title, artist, coverUrl}`만 합친다**(qid·kind 보존). 가사 보존 주의사항(FRONTEND.md 🔴)도 그대로
- **옛 키 변환** — v2 키가 없을 때만 1회:
  - 셔플이 켜져 있었으면 `queue`는 이미 섞인 순서 → **`original_queue`를 items로**, order는 거기서 계산
  - `null` 항목 걸러냄 (옛 `ADD_MULTIPLE_TO_QUEUE`가 null을 그대로 넣었음)
  - `current_track`이 큐에 없으면 context 맨 앞에 넣음
  - 이름 "이전 재생목록"의 context가 된다
  - 🔴 **옛 키는 이번 릴리스에선 지우지 않는다** — 배포를 롤백해도 사용자 큐가 남게. 다음 릴리스에서 정리

### 손대는 곳
`store/player.js`(재작성) · `server/api/song.js`·`songService`(songsdata) · `pages/index·chart·liked·playlist/_id.vue` · `SongMenuSheet.vue` · `SongRow.vue` · `SearchResultsModal.vue` · `layouts/main.vue` · `MusicPlayer.vue`(`currentTrack._id` watcher → 하트) · `Playlist.vue`
- 1단계의 `Playlist.vue`는 두 구역을 **읽기 전용으로 이어 붙여 보여주기만**(드래그 끔). 어차피 2단계에서 갈아엎는다

## B. 재생 화면 3조각

- **하단 미니 플레이어** — 시안 기준으로 새로. 볼륨 바 손잡이 포함
- **지금 재생 중 (큰 화면)** — 커버 누르면 열림. 커버 · 가사 · 다음 곡 미리보기
- **재생 대기열 패널** — "다음에 재생" / "다음: ○○에서" 두 구역, 구역마다 비우기, 구역 안 드래그
- 재생 로직은 A에서 끝내고 여기선 화면만
- **가사는 정적(벅스)으로** (2026-10-31 결정). 싱크 가사는 나중에 — 한다면 **앱 먼저**. 웹은 끼울 자리만:
  - 가사 영역을 컴포넌트 하나로 빼고 입력을 `{ text, lines }`로 받는다. `lines`(`[{ t, text }]`)가 없으면 지금처럼 정적 표시
  - **API는 지금 안 바꾼다**. 나중에 `/api/songs/lyrics/:id` 응답에 `synced` 필드를 **추가**하면 되고, 필드 추가는 앱·웹 옛 버전을 깨지 않는다

### 아이콘 — 사이트 전체 교체
- 지금: **Font Awesome 6.6 CDN** (`nuxt.config.js:21`, 꽉 찬 아이콘), 21개 파일·44종. JS 문자열·static·app.html 사용은 없음(검토로 확인)
- 바꿀 것: **가는 선 아이콘(Lucide 모양, ISC 라이선스)을 쓰는 것만 SVG로 넣은 `<Icon name>` 컴포넌트**. 패키지 의존성 없음
  - 챙길 것: 하트 빈/채움 동적 바인딩(`MusicPlayer`·`SongMenuSheet`·`SongRow`), 유튜브 로고 2곳(브랜드 SVG 따로), `fa-spin` 로딩 회전
- 관리자 화면(`components/admin/`) 포함 — 하나라도 남으면 CDN을 못 뺀다
- 다 바꾼 뒤 CDN 링크 제거. 안 쓰는 getter `shuffleIcon`도 삭제

## C. 테마

- 웹엔 테마 화면이 **없다**(API만 있음) → 새로 만든다
  - `pages/theme/index.vue` — 테마 9개 (`GET /api/themes`)
  - `pages/theme/_key.vue` — 50곡 (`GET /api/themes/:key`), 썸네일 `i.ytimg.com/vi/{videoId}/hqdefault.jpg`
  - 홈에 테마 진입 구역 추가
- 줄 클릭 = 그 테마를 context로 그 곡부터 재생, 곡들은 `kind:'video'`
- `mediaSession`의 앨범아트: 지금 `coverUrl.replace('/50/', …)`로 크기별 URL을 만든다 → ytimg URL·`coverUrl` 없는 경우 가드 (플러그인은 이 가드만 손댐)
- 재생 가능성 측정 완료(2,418곡 oEmbed 전부 허용, IFrame 표본 80개 전부 재생, 2026-10-31). 그래도 막히는 영상은 A의 "재생 에러 → 다음 곡"이 받는다

## 이번 범위 밖
- 테마 곡을 유튜브 플레이리스트에 저장 (앱엔 있음 — 원하면 C에 추가)
- 비디오 탭(`layouts/video.vue`)의 별도 큐 — 그대로 (비디오 탭에 들어가면 음원 정지하는 현 동작 유지)
- 키보드 단축키

## 위험·주의
- **배포 묶음이 커진다**: 지금 push 안 된 커밋 9개(1단계 화면 + 서버: 플리 소유자 확인·차트 songId·bcryptjs 등)가 2단계 끝날 때까지 묶인다. → 아래 "결정 필요" 참고
- 옛 localStorage 키는 이번 릴리스에서 지우지 않는다(롤백 대비)
- 배포 후 `fix-song-refs.js` 조회 → 필요 시 `--apply` (WORK_LOG "배포 대기" 참고)

## 결정 (2026-10-31)
- **미push 커밋까지 2단계 전부와 함께 한 번에 배포**. main에서 진행(브랜치 안 씀)
- 검증은 Claude가 전부 — 아래 "검증"

## 검증
- **단위 테스트**: 큐 계산(다음·이전·셔플·삭제·드래그·옛 큐 변환)을 화면·네트워크와 무관한 순수 함수 모듈(`utils/queue.js`)로 빼고 **`node --test`**(Node 22 내장, 의존성 0)로 돌린다. `npm test` 스크립트 추가. 스토어는 이 모듈을 불러 상태만 바꾼다
- **브라우저 검증**: Playwright(이 PC엔 전역 설치 — `GLOBAL_MODULES="$(npm root -g)"`)로 `npm run dev`(3000) 위에서 시나리오를 돌린다. 스크립트는 `scripts/e2e/`에 두고 다시 돌릴 수 있게
  - 데스크탑(1440)·태블릿(820)·모바일(390) 폭 스크린샷
  - 시나리오: 차트 줄 클릭 → 그 곡부터 이어서 재생 / 다음에 재생·맨 뒤 추가 / 셔플·반복 / 대기열 삭제·드래그 / 새로고침 후 복원 / 옛 localStorage 변환 / 테마 곡 재생·에러 시 넘김 / 가사·하트가 유튜브 곡에서 숨는지
  - 실제 소리는 못 듣는다 → YouTube 플레이어 상태(`PLAYING`)와 `currentTime` 증가로 판정
- `npm run build`(nuxt build) 통과
