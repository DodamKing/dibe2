# 작업 기록

> 완료된 작업은 **최신순(위에서부터 최근)**으로 정렬. 새 항목은 맨 위에 추가.

## 예정 작업
- **비디오 검색 결과 무한 스크롤**: 현재 `/api/youtube/search`가 `limit=20` 고정. `youtube-search-api`의 `NextPage(token)` 메서드로 서버 pagination 지원 + 클라이언트는 IntersectionObserver로 그리드 끝 감지 시 다음 페이지 append. 작업량 ~1-2시간

## 완료된 작업

### 2026-07-17 (2) - 제목 오염 파서 수정 + 19금 플래그, 적재 계획 결정사항 확정

> **재개 지점.** 아래 "남은 일"이 최신 계획이다(직전 항목의 "남은 일"보다 이걸 따를 것).

**장르/스타일 보강 완료 — 12,635 / 12,635 (100%)**
- `enrich-songs.js --skip-lyrics` 83.1분 / 요청 3,526회 / **실패 0 · 차단 0** / 곡당 요청 **0.57회**(앨범 캐시 2,694회 적중, 누적 7,873개)
- 장르 못 찾은 곡 **16곡뿐**(0.13%) · 앨범ID 없음 0
- `--skip-lyrics` 인 이유: 가사를 포함하면 곡당 요청이 0.7 → 1.7회(2.4배)인데 **가사는 lazy fill 이 맡기로** 했고, 앞 6,415곡도 같은 방식으로 받아서 형태를 맞춰야 했다

**완료(실측 검증됨)**
- **문제 2 수정 — 제목 오염**: `.title` → `.title a`. 프로덕션 `helper.js`(`getBugsChart`/`searchBugsMusic`)와 스크립트 `lib/bugs.js`+`crawl-bugs-charts.js` 양쪽에 `parseTitleCell()` 공용 파서로 정리
  - **검증**: 19금 곡이 실제로 있는 페이지(`nid`/`20240101`, 58위 "3D" 정국)로 실측 → **19금 1곡 제목 정리 + adult=true, 나머지 99곡 회귀 0, 두 파서 결과 불일치 0**
- **19금 배지 실측**(추측 금지 — 마크업 확인함):
  ```html
  <button onclick="bugs.ui.alertAdultNotice();" class="badge o19"><span class="blind">[19금]</span></button>
  <a adultcheckval="4" onclick="...bugs.ui.showLoginLayer();" title="3D">3D</a>
  ```
  - 셀렉터는 **`.o19`** 로 좁힐 것. `.title button` 은 19금 아닌 행에도 있음(1페이지에 5개)
  - `showLoginLayer()`/`adultcheckval` → **19금 가사는 로그인 없이는 원리적으로 못 받는다**는 코드상 확증
- 🔴 **대괄호가 진짜 제목인 곡이 있다 — 문자열로 배지를 지우면 훼손된다**
  - `[드포즈 극장] 바그다드 카페`(드포즈 듀오, 2건)는 배지가 아니라 **진짜 제목**. `album` 필드에도 똑같이 들어있음
  - **구분자는 개행**이다. 실측: `[19금]\n` 243/243, `[권리없는 곡]\n` 62/62 **전부 개행이 뒤따름** / `[드포즈 극장] ` 0/2(공백)
  - 배지 종류는 3가지가 아니라 2가지: `[19금]` 243행, `[권리없는 곡]` 62행
  - → 수집본 정리 시 `^\[[^\]]+\]\n` (개행 필수)만 제거할 것. `^\[.*?\]` 로 하면 드포즈 곡이 깨진다

**결정사항 (사용자 승인)**
- **19금 로그인 크롤링 — 안 한다.** 실익은 91곡(DB 4 + 수집분 87)뿐인데 실명 계정 정지 리스크 + ToS 명시적 위반. robots.txt를 넘은 것(공개 페이지 열람)과 인증 우회는 성격이 다름
  - 대신 **"가사 없음"이 아니라 "19금이라 가사 제공 안 됨"으로 UI에 명시**한다 → `adult` 플래그가 크롤링 스킵용 + UI 표시용 겸용
- **`adult` 플래그는 지금 캡처한다.** 제목을 고치는 순간 19금 신호가 파서에서 사라지고, 나중에 알려면 902페이지 재크롤링이 필요했음. 수집본에 `[19금]` 문자열이 남아있는 지금이 마지막 기회(배지 셀렉터 vs 문자열 판정 **100/100 일치** 확인 → 이관 안전)
- **가사도 lazy fill 한다** (유튜브와 같은 패턴). 원 계획은 "크론이 하루 80곡씩, 다 차는 데 수개월"이었으나, lazy fill을 붙이면 **사용자가 실제로 본 곡부터** 채워져 그 대기가 사실상 사라짐
  - ⚠️ 선행조건: 문제 1(마커)을 안 고치고 lazy fill을 붙이면, 가사를 원래 못 받는 곡(19금 등)을 **누를 때마다** 벅스를 때리는 증폭기가 된다
- **장르/스타일은 lazy fill 불가** — 추천/필터가 곡을 **누르기 전에** 장르로 후보를 고르므로, DB에 없으면 후보에 안 뜨고 → 아무도 안 누르고 → 영원히 안 채워지는 자기참조 데드락. 그래서 기존 결정("장르 있는 곡만 적재")이 유지되어야 함
- 🔴 **크론에 정렬이 없다 → 적재하면 신곡이 백로그 뒤에 줄 선다.** 지금 크론은 전부 `.limit(120)`만 있고 sort가 없어 사실상 `_id` 순(오래된 삽입분부터). 7,373곡을 넣으면 그 뭉치가 앞을 막아 **오늘 차트 신곡이 몇 달 뒤에나 처리**된다. 가사는 lazy fill이 있어 그나마 낫지만 **장르는 lazy가 불가능해서 신곡이 추천에서 통째로 빠진다**
  - **해결: `cron-chart`가 08:00에 차트 100곡에 `lastChartedAt` 찍고 `chartHits` `$inc`** → 후속 크론은 `sort({ lastChartedAt: -1 })` 하나로 "지금 사람들이 듣는 곡" 우선
  - `createdAt`(신규 저장분) 기준보다 나은 이유: 예전에 저장됐지만 장르를 못 받은 곡이 오늘 차트에 다시 뜨면 그것도 즉시 잡힌다
  - 덤: `chartHits`가 적재 시점 스냅샷에 머물지 않고 **매일 갱신되는 살아있는 인기 신호**가 됨
- **장르 보강은 `--skip-lyrics`로 돌린다.** 가사를 포함하면 곡당 요청 0.7 → 1.7회(2.4배). 가사는 lazy fill이 맡으므로 미리 받을 이유가 없고, 앞 6,415곡도 이미 skip-lyrics로 받아서 형태를 맞춰야 함

**DB 제목 정리 완료** (`scripts/fix-dirty-titles.js` — dry-run 기본, `--apply` 로 실행)
- 결과: **수정 3곡(19금, adult=true) + 삭제 1곡(중복) → 남은 오염 0건** (스크립트가 자체 검증)
- 🔴 **중복이 이미 박혀 있었다 — 문제 3의 경고가 이론이 아니었음**
  - 제니 `ExtraL (feat. Doechii)` 가 **두 문서**로 존재: 싱글 `ExtraL`(2/22, track/6289877) + 정규앨범 `Ruby`(3/12, track/6292522). **벅스 트랙 ID가 다른 별개 트랙**인데 우리 키는 `{title, artist}` 라 하나여야 했다
  - 3/12에 벅스가 `[권리없는 곡]` 배지를 붙이자 제목이 달라져 `saveSongData` 의 중복 판별을 통과해버림. **배지가 없었으면 스킵됐을 곡**
  - → 오염본 삭제 = 원래 동작 복원. 참조(Like/PlayEvent/Playlist) 양쪽 0건이라 무손실
- ⚠️ **`{title, artist}` 키의 근본 한계가 드러남**: 같은 곡의 앨범별 버전(싱글/정규/리패키지)을 구분하지 못한다. 지금 당장은 문제 아님(적재분은 `aggregate-songs.js` 가 이미 유니크하게 합쳐놨음). 나중에 곡이 늘면 재검토
- 부수 효과: **567일째 재시도당하던 6곡 중 3곡이 여기서 빠졌다**(19금이라 원래 못 받는 곡 → `adult=true`)

**남은 일 (순서대로 — 이게 최신)**
1. ~~문제 2 수정: `.title` → `.title a`~~ ✅ 완료
2. ~~문제 3: DB 제목 정리 → 수집본 정리 → 재집계~~ ✅ **완료** (아래 "작업 2 상세")
3. ~~문제 1 수정 + 가사 lazy fill + 크론 정렬~~ ✅ **완료** (아래 "작업 3 상세")
4. `aggregate-songs.js`로 7,373곡 선별(2회 이상 + 1회 중 30위 이내)
5. **DB 적재 스크립트 신설** — `songs-enriched.jsonl` + `songs-youtube.jsonl`을 `title+artist`로 조인
   - `Song` 스키마: `chartHits` 추가, `timestamps: true`, 인덱스 `{ lastChartedAt: -1 }`
   - **적재분 `lastChartedAt`을 한 값으로 고정**할 것. `insertMany`가 곡마다 미세하게 다른 시각을 박으면 2차 정렬(`chartHits`)이 안 먹고 삽입 순서가 이겨버린다
6. 유튜브는 급하지 않음 — lazy fill이 재생 시점에 채움

**스키마 변경 총정리** — ✅ **전부 추가 완료** (`server/models/Song.js`)
| 필드 | 용도 |
|---|---|
| `adult` | 19금 — 크롤링 스킵 + UI 표시 |
| `lyricsCheckedAt` / `youtubeCheckedAt` | 영구 실패 마커(무한 재시도 차단) |
| `lastChartedAt` | 크론 우선순위 정렬 키 (+ 인덱스 `{lastChartedAt: -1}`) |
| `chartHits` | 인기 신호(추천 콜드스타트) |
| `timestamps: true` | 없어서 `createdAt` 자체가 없었음 |

**작업 2 상세 (수집본 정리 → 재집계)** — `scripts/clean-collected-titles.js` (dry-run 기본, `--apply`)

| 파일 | 정리 | 결과 |
|---|---|---|
| `bugs-chart-rows.jsonl` | 제목 305건(19금 243 → `adult:true`) | 89,922행 유지(행 단위라 중복 제거 안 함 — **재집계가 합산**) |
| `songs-enriched.jsonl` | 제목 121건 + **중복 3건 제거** | 12,635 → **12,632곡** |
| `songs-youtube.jsonl` | 제목 1건 | 1,096곡 유지 |
| `songs.jsonl` | 정리 안 함 — **재집계로 새로 생성** | 12,632곡 |

- 원본은 전부 `.bak` 백업(`data/`는 gitignore라 되돌릴 방법이 이것뿐)
- **재집계가 오히려 데이터를 정확하게 만들었다**: 유니크 13,352 → **13,349**(3곡 병합). `오르트구름`(윤하)은 배지본이 따로 세어져 `chartHits` 31이었는데 **33으로 합산**됨(31행 + 배지본 2행)
  - 병합 3건 모두 **같은 곡이 다른 앨범으로 수집된 것**(ExtraL과 같은 패턴): 오르트구름(정규/리패키지), 님 그리워(모음집/디스코), North Face(싱글/UP!)
  - 곡 단위 파일에선 **깨끗한 본을 남겼다** — 3건 다 깨끗한 본이 더 인기 있고 더 최근이며, DB의 ExtraL 처리와 같은 정책
- ✅ **교차검증**: `songs.jsonl` 19금 **87곡** + DB `adult:true` **3곡** = **90곡** = `chart-rows` 실측 유니크 19금 90곡. 신규분/기존분이 빠짐없이 갈렸다
- `aggregate-songs.js` 에 `adult` 전파 추가 — **한 번이라도 배지가 붙었으면 19금**으로 본다(벅스가 나중에 배지를 붙인 경우 옛 행엔 배지가 없어서, 행 하나만 보면 놓친다)
- ⚠️ **적재 시 `chartHits`/`adult`는 `songs.jsonl`(재집계본)에서 가져올 것.** `songs-enriched.jsonl` 의 집계 필드는 정리 전 값이라 stale하다(오르트구름 31 vs 33). enriched 에선 **`genre`/`style`만** 쓴다

**작업 3 상세 (마커 + lazy fill + 크론 정렬) — 운영 DB 실제 곡으로 검증 후 원상복구**

| 검증 | 결과 |
|---|---|
| 가사 lazy fill | `녹아내려요`(DAY6) 가사를 지우고 `getLyrics` 호출 → **558자 즉석 복구(671ms)**, DB 저장 + 마커까지 확인 |
| 19금 스킵 | `Dirty Work`(aespa) → `{lyrics:'', adult:true}`, **52ms**(크롤링했다면 200ms+) |
| 마커 스킵 | 마커 찍힌 곡 → **43ms**, 크론 대상 쿼리에서도 빠짐 |
| markCharted | `chartHits` 0→1, `lastChartedAt` 찍힘 |
| 크론 정렬 | 최근 차트 곡이 1순위, `explain` 으로 **IXSCAN**(인덱스 사용) 확인 |
| 원상복구 | 3건 전부 복구, 오염 제목 0건 |

- `updateLyrics`: `null`(네트워크 실패) → `continue`(마커 X, 재시도됨) / `''`(원래 없음) → 마커 찍고 닫음 / 정상 → 가사+마커
- `updateYoutubeUrls`: 2~6분 조건에 맞는 영상이 없으면 `youtubeCheckedAt` 으로 닫음. 검색 자체가 터지면 `catch` 로 가서 마커가 안 찍힘(재시도됨)
- 세 크론(`updateLyrics`/`updateYoutubeUrls`/`updateGenres`) 전부 `sort({lastChartedAt: -1})`
- `markCharted()`: bulkWrite 한 방(100곡 순차 update는 30초 예산이 아깝다). `saveSongData` **다음에** 불러야 신곡도 포함
- `GET /api/songs/lyrics/:songId` 반환이 `{lyrics}` → **`{lyrics, adult}`** 로 바뀜
- 프론트: `store/player.js` 에 **늦게 온 응답을 다음 곡에 붙이지 않는 가드** 추가(lazy fill 이 1초 가까이 걸려 레이스가 실제로 가능해짐). `Playlist.vue` 는 `lyricsText` computed 로 4가지 구분 — 19금 / 가사 / `undefined`(로딩) / `''`(없음)
- 문서 갱신: `DATA_MODELS.md`(스키마·함정), `API_ENDPOINTS.md`(lazy fill 계약), `CRON_EXTERNAL.md`(정렬·마커·`parseTitleCell`·lazy fill 표)


### 2026-07-17 - 크론 타임아웃 방어 + 장르 크론 신설, 적재 전 발견한 문제 3건

> ⚠️ **이 항목의 "남은 일"은 stale.** 재개 지점과 최신 계획은 **맨 위 `2026-07-17 (2)` 항목**을 볼 것.
> (여기 있는 문제 1·3 분석 자체는 유효하다 — 순서를 지켜야 한다는 결론도 그대로)
> 크롤링 데이터는 `data/`에 다 있고 DB는 아직 **한 글자도 안 건드렸다.**

**완료(검증됨)**
- **크론 3개에 시간 예산 22초 적용** + `updateGenres()` 신설 + `cron-genre.js`(08:20) 신설
  - **곡 수가 아니라 경과 시간으로 끊는다.** 벅스/유튜브가 느린 날에도 30초 타임아웃에 안 걸리고, 못 끝낸 곡은 다음 날 이어진다. 곡 수로 잡으면 느린 날 터진다
  - 장르를 `cron-chart`에 안 붙이고 크론을 분리한 이유: 신곡 많은 날 앨범 요청이 30초를 넘기면 **곡 저장 자체가 실패**한다. "저장 먼저, 필드는 나중에"라는 기존 패턴(가사/유튜브)을 따름. 크론마다 30초를 따로 받으므로 분리할수록 하루 처리량도 는다
  - 크론 시간 통일: 08:00 차트 → 08:10 유튜브 → 08:20 장르 → 08:30 가사(02:00에서 이동. 02:00은 근거 없는 값이었음)
  - `helper.js`에 `albumIdFromCoverUrl`/`getAlbumGenre` 이식(스크립트 전용이던 파서를 프로덕션으로)
  - **검증**: 운영 DB 실제 곡(`Supernatural`)의 genre/style을 지우고 `updateGenres()` 실행 → `[J-POP]`/`[댄스 팝]` 정확히 복구(522ms) → 원상복구
- **유튜브 `#` 버그 수정**(스크립트 + 프로덕션 `songService`): `youtube-search-api`가 `encodeURI`를 쓰는데 `encodeURI`는 `#`을 인코딩하지 않아 **그 뒤가 URL 프래그먼트로 잘려 검색어가 통째로 빈다**(`#첫사랑` → 검색어 ``). 제목에 `#` 있는 곡은 크론으로도 lazy fill로도 **영원히** URL을 못 받았다. 수집분 중 17곡 해당
- **유튜브 쿼리 폴백**: 0건일 때만 괄호 부기를 걷어내고 1회 재시도. 실측 `Learn To Love Jxxn(진)` 0건 → `(진)` 제거 시 10건. **잘 되는 쿼리는 안 건드리므로 회귀 불가**, 추가 요청은 실패 곡(0.8%)에만. 실전에서 500곡 중 3곡을 실제로 건짐

**🔴 발견했지만 아직 안 고친 문제 3건 (적재 전에 반드시 처리)**

1. **크론 무한 재시도 — 이미 567일째 진행 중**
   - `updateLyrics`는 `song.updateOne({lyrics})`로 **빈 문자열을 저장**하는데 쿼리가 `{lyrics: {$in: [null,'']}}`라 **저장해도 계속 매칭**된다 → 영원히 못 빠져나감. 실측: 6곡이 최대 **567일** 동안 매일 재시도당하는 중
   - `updateYoutubeUrls`도 동일 구조(못 찾으면 아무것도 저장 안 함 → 쿼리에 계속 남음)
   - **지금은 6곡이라 안 보이지만 12,635곡을 넣으면 치명적**: 크론이 22초에 80곡을 도는데 **못 받는 곡 80개가 앞을 막으면 매일 그것만 하고 끝난다**(head-of-line). 뒤쪽 진짜 곡엔 영원히 도달 못 함
   - `[19금]` 곡은 **성인 인증이 필요해 가사를 원리적으로 못 받는다** — 재시도가 무의미
   - **필요**: "찾아봤는데 없더라"를 기록할 필드(`lyricsCheckedAt`/`youtubeCheckedAt` 등). `updateGenres`엔 이미 넣어둠(앨범ID 못 뽑으면 `genre: []`로 닫음)

2. ~~**제목 오염 — 프로덕션 크롤러 버그**~~ ✅ **2026-07-17 (2)에서 수정됨**
   - 벅스가 `[19금]`을 **스크린리더용 숨김 텍스트**로 넣는데 `.title.text()`가 그것까지 긁어온다:
     ```html
     <button class="badge o19"><span class="blind">[19금]</span></button>
     <a title="BAND">BAND</a>
     ```
     `.title.text()` → `"[19금]\nBAND"` ✗ / **`.title a.text()` → `"BAND"` ✓**
   - `helper.js`의 `getBugsChart`·`searchBugsMusic` **양쪽에 있음**. DB 4곡 + 수집분 124곡 오염(`[19금]` 87곡, `[권리없는 곡]` 등)
   - 영향: UI 노출, **유튜브 검색어 오염**(`"[19금]\nBAND 창모 official audio"`), title 키 오염

3. **🔴 제목을 고치면 키가 어긋나 중복이 박힌다 — 순서가 중요**
   - `saveSongData`·우리 집계 모두 `{title, artist}`로 중복 판별하는데, 제목을 정리하면 **기존 DB 곡과 다른 키가 된다**:
     ```
     DB     : "[19금]\nDirty Work (Feat. Flo Milli)|||aespa"
     정리 후 : "Dirty Work (Feat. Flo Milli)|||aespa"   ← 같은 곡인데 다른 키
     ```
   - **반드시 이 순서**: ① 크롤러 수정 → ② **DB의 오염된 4곡 제목 먼저 정리** → ③ 수집본 정리 → ④ 재집계 → ⑤ 적재

**결정사항**
- **DB에는 완성품만이 아니라 "장르 있는 곡"을 넣는다.** youtubeUrl은 비우고 **lazy fill이 재생 시점에 채우게** 한다(집 IP 유튜브 요청 0). 크론이 안 터지게 고쳤으므로 안전해짐
  - ⚠️ 단, 위 문제 1(무한 재시도)을 안 고치면 이 결정이 크론을 무력화시킨다
- **곡 수: 2회 이상 6,415곡 + 1회 등장 중 30위 이내 958곡 = 약 7,373곡**
  - 1회 등장 6,220곡의 최고순위 분포: 1~3위 25 / 4~10위 120 / 11~20위 345 / 21~30위 468 / 31~50위 1,078 / 51~70위 1,387 / **71~100위 2,797(절반)**
  - 71~100위는 차트 끝자락에 한 달 걸쳤다 사라진 곡이라 제외. 1회여도 30위 안이면 실체가 있음(1위 찍은 곡이 25곡)
- **가사는 미리 안 채운다.** 크론이 하루 80곡씩 채우게 두면 집 IP 요청 0. 대신 다 차는 데 수개월. 추천은 장르·`chartHits`를 쓰므로 가사와 무관
- **재생시간(트랙 페이지) 포기.** 요청의 3분의 2를 쓰는 대가 대비 이득이 작다고 판단. 6분 초과 곡 매칭이 틀리는 건 눈으로 확인하기로

**진행 상황 (`data/`, gitignore, DB 무영향)**
| 파일 | 상태 |
|---|---|
| `bugs-chart-rows.jsonl` | 89,922행 — 차트 수집 **완료**(902페이지, 재수집 불필요) |
| `songs.jsonl` | **12,632곡** — 재집계본(제목 정리 반영, `adult` 포함). 인기순(`chartHits`) 정렬 |
| `songs-enriched.jsonl` | **12,632곡 완료(100%)** — 2026-07-17 (2) 세션에서 마무리. 장르 못 찾은 곡 16 |
| `songs-youtube.jsonl` | **1,096곡** videoId (성공률 100%) |

**남은 일 (순서대로)**
1. 문제 2 수정: `helper.js` `.title` → `.title a`
2. 문제 3 순서 지켜서: DB 4곡 제목 정리 → 수집본 정리 → 재집계
3. 문제 1 수정: 가사/유튜브 크론에 "시도했으나 실패" 마커 추가
4. `aggregate-songs.js`로 7,373곡 선별(2회 이상 + 1회 중 30위 이내)
5. **DB 적재 스크립트 신설** — `songs-enriched.jsonl` + `songs-youtube.jsonl`을 `title+artist`로 조인, `chartHits`도 함께 저장(추천 콜드스타트 신호). `Song` 스키마에 `chartHits` 필드 추가 필요
6. 유튜브는 급하지 않음 — lazy fill이 재생 시점에 채움. 첫 재생 1.1초를 아끼고 싶을 때만 인기순으로 조금씩

**요청 실적(오늘)**: 벅스 약 5,100회 / 유튜브 약 1,100회 — **양쪽 다 차단·에러 0건**

### 2026-07-16 - 벅스 대량 크롤링 파이프라인 구축 (차트 수집 완료, 장르 보강 진행 중)

- 목표: 국내 곡 대량 확보. **DB에는 완성된 곡만 넣고**, 중간 상태는 전부 로컬 JSONL에 둔다
- **설계 결정(사용자와 합의)**: 중간 저장소를 DB가 아니라 **파일**로. 크롤링이 며칠에 걸쳐 실패/재개해도 DB를 한 번도 안 건드리고, 선택 로직을 바꾸고 싶으면 파일만 다시 만들면 됨. DB 적재는 **마지막에 완성품 한 번**(`insertMany`는 몇 초라 나눌 이유가 없음)
- **파이프라인**(`scripts/`, 전부 로컬 전용 · `data/`는 gitignore):
  ```
  crawl-bugs-charts.js  차트 → bugs-chart-rows.jsonl   (원시 행, DB 안 씀)   ✅ 완료
  aggregate-songs.js    집계 → songs.jsonl              (DB 읽기만)          ✅ 완료
  enrich-songs.js       장르/가사 → songs-enriched.jsonl                     🔄 1,200/12,635
  (미작성)              유튜브 → songs-youtube.jsonl                          ⬜
  (미작성)              두 파일 조인 → DB insert                              ⬜
  ```
- **실적**: 차트 902페이지(**실패 0**) → 원시 89,922행(27MB) → 유니크 13,352곡 → **신규 12,635곡**. 장르 보강 1,200곡(**실패 0**, 장르 못 찾은 곡 1)

- **발견 5개** (다시 알아내려면 비싼 것들):
  - 🔴 **`chartdate`로 과거 차트를 받을 수 있으나 2019-10 이전은 전부 폴백**이다. 2019-01/2015/2012/2008이 **전부 같은 1위("인사/멜로망스")**를 반환 — 가장 오래된 차트로 떨어지는 것. **그 이전을 긁어봐야 같은 데이터만 중복**되므로 가용 범위는 **2019-10 ~ 현재(약 6.75년)**
  - **차트 중복률 85%가 곧 인기도 신호**다. 89,922행 → 13,352곡. "몇 번 등장했나"(`chartHits`)로 정렬하면 랜덤이 아니라 **스테디셀러**가 위로 옴(마크툽 238회, DAY6 예뻤어 238회, 태연 사계 208회). 중복을 버리지 말고 셀 것
  - **장르 차트는 쿼리가 아니라 경로**다: `/chart/track/day/{code}`. 국내 11개 — `nb`(발라드) `ndp` `nid` `nrh` `nrs` `nkelec` `nkrock` `nkjazz` `nindie` `ntrot` `nfa`
  - **월단위로 충분**하다. 11장르 × 81개월 = 902페이지(22분)로 12,635곡. 주단위(3,900페이지)까지 갈 필요 없었음
  - **가사 전용 엔드포인트는 없다.** `lyricsDtl`/`lyricsDtlReal` 둘 다 **404**, `track/lyricsDtl`은 200이지만 가사 없음. 앨범 페이지에도 가사 없음(`xmp` 0개). **트랙 상세 페이지(248ms)가 유일한 경로**이고 이미 충분히 빠름

- **⚠️ 벅스 `robots.txt`는 화이트리스트 6개(Googlebot 등) 외 크롤러를 전면 금지**(`User-agent:* → Disallow:/`)한다. 응답에 `X-Robots-Tag: noai, noimageai`도 붙는다. 기존 크론(하루 ~100곡)에서 크게 확대되는 작업이고 **가사는 벅스가 라이선스 받은 저작물**이라는 점을 알고 진행한 결정
  - 완화책: **지터 0.5~2초**(고정 간격은 그 자체로 봇 신호), 진짜 브라우저 UA, **쿠키 유지**, Referer, 세션 분할, 재크롤링 0
  - **다만 위장은 안 된다**: 이미지/CSS/JS를 안 받고 HTML만 순서대로 훑는 형태라 어떤 속도로도 사람처럼 보이지 않음. 지터/UA는 **예의이지 은폐가 아님**
  - **"천천히 하면 안전"은 틀린 논리**다. 밤새 음악 튼 사람 ≈ 9시간에 150요청, 크롤링 ≈ 9시간에 21,600요청(**144배**). 지속시간이 아니라 **총량**이 문제. 분할해도 **시간당 속도는 동일**(약 2,300회/시간)하므로, 분할은 하루 총량만 나눌 뿐

- 🔴 **서킷 브레이커 필수**: 차단당한 뒤에도 계속 두들기면 얻는 것 없이 상대 서버만 때린다. `enrich-songs.js`는 **429/403 감지 시 즉시 중단**, 연속 5회 실패 시 중단. 자면서 돌려도 스스로 멈춘다. (⚠️ 이 경로는 실전 검증 불가 — 확인하려면 일부러 차단당해야 함)

- **실측 수치**(다음 세션 계획용):
  - 요청당 **약 1,400ms**(지터 0.5~2초 포함) → **30분 ≈ 1,200회**
  - 앨범 캐시 덕에 **곡당 요청 0.80회**이고 계속 하락 중(기존 1091곡은 728앨범 = 0.667로 수렴 예상)
  - 남은 장르 보강: 11,435곡 ≈ **7,400요청 ≈ 2.9시간**

- **남은 것**: ① 장르 보강 11,435곡 ② 유튜브 선택 로직 결정 후 `songs-youtube.jsonl` 생성 ③ 조인 → DB 적재 ④ 가사는 **보류**(요청의 58%를 차지해 총량이 2.4배가 됨. 재생엔 불필요)

### 2026-07-16 - youtubeUrl 없는 곡 재생 안전망(lazy fill 배선 + 무한로딩 수정), 장르/스타일 추가

- 배경: 벅스 대량 크롤링(1만 곡)을 검토하면서 **"URL 없는 곡이 재생 가능한 것처럼 나가면 조용히 죽는다"**는 우려에서 출발. 파보니 크롤링과 무관하게 **매일 아침 실제로 일어나는 문제**였음

- **🔴 무한 로딩 버그(실재)**: `getYoutubeId`가 `song.youtubeUrl.match()`를 그냥 호출 → URL 없는 곡에서 `undefined.match()` **TypeError → 500**. 그런데 `store/player.js`가 **`await`를 `try` 블록 바깥**에서 하고 있어서 `catch`/`finally`가 안 돌았음 → **`SET_IS_LOADING(true)`가 영원히 안 풀림**. 에러 메시지도 없이 스피너만 도는 상태
  - 수정: `getYoutubeId`는 `null` 반환, `player.js`는 `await`를 `try` 안으로 + `!youtubeId`면 명시적으로 끊음(`return`해도 `finally`가 돌아 로딩 해제)
  - `loadVideo(null)`은 **예외를 안 던지고 조용히 넘어감** → 그 뒤 `SET_IS_PLAYING(true)`가 찍혀 "재생 중인데 소리 없음"이 됨. 그래서 서버 `null` 반환만으론 부족하고 **클라이언트에서 끊어야** 함

- **lazy fill 배선(미완성이던 설계 마무리)**: `songService.updateYoutubeUrl(_id)`(단수)는 **정의만 있고 호출부가 한 번도 커밋된 적 없는 고아 함수**였음. 관리자 UI가 `/search-youtube` + 수동 선택(`updateSong`)으로 다른 길을 가면서 남겨진 것으로 보임
  - `getYoutubeId`에서 URL이 없으면 이걸 태우고, 그래도 없으면 `null`
  - **차트 크론 08:00(곡 저장) → 유튜브 크론 08:10(URL 채움)** 사이 10분 갭이 이걸로 사라짐(1.1초 지연 후 재생)
  - **중복 작업 안 생김**: 크론과 lazy fill 둘 다 "URL 없는 곡"만 고르므로 **먼저 채운 쪽이 상대의 대상에서 그 곡을 뺌**
  - **API 레벨 방어라 앱(dibe2-app) 무수정으로 보호됨** — 서버가 진짜 videoId를 주므로 클라이언트가 알 필요 없음. 단 "유튜브에 정말 없는 곡"의 **멈춤/스킵 결정은 큐를 아는 클라이언트 몫**(서버는 큐를 모름)

- **검증(운영 DB, 실측)**: 기존 곡의 URL을 `$unset` → `getYoutubeId` 호출 → **1104ms 만에 검색·저장·유효 11자리 id 반환** 확인 → `finally`로 원본 복원(일치 확인). 정상 경로는 276ms로 기존과 동일
  - ⚠️ **lazy fill이 원본과 다른 영상을 고를 수 있음**(`yss4rIrHl6o` → `6XsX9YSPMkA`). 검색 결과 순서가 시간에 따라 변하기 때문. 지금 흐름(URL 없는 곡에만 동작)에선 무해하나 "URL 다시 따기" 기능을 만들면 곡은 같아도 영상이 바뀔 수 있음

- **`Song`에 `genre`/`style` 추가 + 기존 1091곡 백필**(`scripts/backfill-genre.js`): 전량 성공, 실패 0
  - **벅스는 장르를 트랙이 아니라 앨범에 붙임.** 트랙 페이지엔 장르가 없음
  - **`coverUrl`에 앨범 ID가 그대로 들어있음**(`.../album/images/50/206680/20668087.jpg` → `20668087`) → 트랙 페이지를 안 거치고 앨범 페이지 1회 요청으로 끝남. 같은 앨범 곡은 캐시 → 1091곡에 요청 **728회**
  - `genre`는 큰 분류(12종 내외, UI 필터용), `style`은 세부 태그(추천 신호용). **겹치지 않음** — 예: `팝 락` 스타일 141곡 vs `락/메탈` 장르 64곡, OST는 genre가 같아도 style이 `TV 드라마`/`카툰/코믹스`로 갈림
  - ⚠️ **앨범 페이지의 장르 값은 차트 장르 코드와 다름**(`J-POP`, `캐롤` 등은 차트 메뉴에 없음). UI 필터 목록은 **차트 코드가 아니라 DB 실제 값**으로 뽑을 것

- **함정 2개**:
  - 🔴🔴 **스크립트에서 `mongoose.connect(process.env.MONGODB_URI)`를 직접 부르면 `test` DB에 붙는다.** `.env`의 URI에 **DB 이름 경로가 없고**, 실제 DB 지정은 `server/models/index.js`의 **`dbName: 'dibe2'` 옵션**이 하고 있기 때문. 이걸 모르고 직접 connect해서 조사하다가 **"곡 100개, 가사 0개"인 유령 `test` DB(2024-09 시드, 이후 방치)를 운영 DB로 착각**했고, 하마터면 멀쩡한 `.env`를 "고칠" 뻔했음
    - **스크립트는 반드시 `require('../server/models').connectToMongoDB()`를 쓸 것**(크론 함수들과 동일 패턴). 직접 connect하면 조용히 엉뚱한 DB를 채움
    - 같은 클러스터에 `dibe`(1398곡, 구버전 스키마), `test`(100곡, 방치), `dibe2`(운영) 공존. **운영은 `dibe2`**
  - **Netlify 스케줄 함수는 실행 제한 30초이고 설정으로 못 늘림**(동기 60초 / 백그라운드 15분과 별개). `updateLyrics`/`updateYoutubeUrls`는 대상 **전량을 한 호출에서 for 루프**로 돌기 때문에, 30초에 유튜브는 **약 15곡**(곡당 1초 고정 딜레이), 가사는 **60~100곡**이 한계
    - 지금은 미보유 0/가사 미보유 6이라 안 드러나지만, **대량 백로그가 생기면 크론은 절대 못 삼킴**(1만 곡이면 유튜브 600일+). 타임아웃은 강제 종료라 `catch`가 안 돌아 **슬랙 알림도 없이 조용히 죽음**
    - → 대량 백필은 **크론이 아니라 로컬 스크립트가 책임져야 함**

### 2026-07-15 - 좋아요 / 재생수 API + 추천용 재생이력 스키마 신설
- 배경: 앱(dibe2-app) 피드백에서 나온 실작업. 좋아요·재생수를 세고, **나중에 추천 기능을 붙일 수 있게 데이터를 미리 쌓아두는 것**이 목표
- **설계 결정(사용자 확인)**: ① 대상은 **음원(Song)만** — 유튜브 영상 트랙은 `songId` 없이 `videoId`만 있어 Song 문서에 매핑 불가라 2차로 미룸 ② 재생 카운트는 **30초/50% 도달 시**(스킵 제외) ③ **카운터 + 재생이력 로그** 둘 다 (카운터만으론 추천 로직을 못 만듦)
- **모델**:
  - `Song`에 `likeCount`/`playCount` 추가(집계 캐시) + 인기순 인덱스
  - `Like` 신설 — `{user, song}` 유니크 인덱스로 중복 좋아요를 DB에서 차단
  - `PlayEvent` 신설 — `{user, song, source, playedAt}`, TTL 180일. 추천에 필요한 최근성·개인취향·유입경로 신호 확보용
  - 상세 근거는 `docs/DATA_MODELS.md`
- **서비스 `server/services/statsService.js` 신설**: `like`/`unlike`(멱등)/`getLikedSongs`/`recordPlay`/`attachLikedFlags`
  - 좋아요는 **upsert의 `upsertedCount`로 신규 여부를 판별**해 카운터를 원자적으로 증감 → 동시 요청에도 카운터가 실제 Like 수와 안 어긋남
  - 감소는 `{likeCount: {$gt: 0}}` 조건부 갱신. 스키마 `min:0`은 문서 검증이라 `$inc`를 못 막기 때문
  - `recordPlay`는 같은 유저·같은 곡 **20초 내 재발사를 중복으로 보고 무시**(앱 재시도/중복 발사 방어). 곡 길이상 정상적인 한곡반복은 억제되지 않음
- **라우트(`server/api/song.js`)**: `GET /liked`, `POST|DELETE /:id/like`, `POST /:id/play`. `POST /by-ids` 응답에 `liked`/`likeCount`/`playCount` 부착(목록 하트 상태를 Like 쿼리 1회로 해결)
- **함정 4개**:
  - 🔴🔴 **JWT 페이로드 키는 `_id`가 아니라 `userId`** — 이걸 놓쳐 새 라우트 4개가 전부 고장나 있었고, 그중 하나는 **사용자 간 데이터 유출**이었음. 기존 라우터(`playlist.js:9`, `videoPlaylist.js:9`, `user.js:77`)는 전부 `req.user.userId`를 쓰는데 새 코드만 `req.user._id`(=항상 undefined)를 읽었음. 로그인 5경로 전부 `userId: user._id`로 토큰을 만듦(`user.js:54,103,150,187,217`)
    - **실측한 피해**: ① `POST /:id/like` → **200 OK인데 user 없는 고아 Like 문서 생성**(upsert는 기본적으로 required 검증을 안 돌리고 Mongoose가 undefined 키를 버림) ② `GET /liked` → `find({user: undefined})`는 `find({})`가 되는 게 **아니라 null/미존재 매칭**이라 정확히 그 고아들을 걸어옴 → **모든 좋아요가 고아가 되고 모든 사용자가 서로의 좋아요를 봄** ③ `POST /:id/play` → 500(PlayEvent는 `create`라 검증이 돌아서 터짐)
    - **왜 첫 테스트가 놓쳤나**: 테스트가 토큰을 **직접 `{_id: ...}`로 만들어서** 실제 로그인 페이로드가 아니라 *내 가정*을 검증했음. → 테스트를 **실제 페이로드 형태(`userId`)로 교정**하고, 남의 `/liked`·`by-ids`가 새지 않는지 **유출 케이스를 추가**
    - **재발 방지**: `statsService.requireUserId()` — userId가 비면 조용히 새는 대신 즉시 throw
    - ⚠️ **다른 서비스에서 statsService를 부를 때도 `req.user.userId`를 넘길 것**
  - `/liked`는 `/:id` 계열보다 **먼저** 선언해야 param으로 안 먹힘
  - `getSongsByIds`가 하이드레이트 문서를 반환해 `{...song}` 스프레드가 깨졌음 → `.lean()` 추가로 해결. 잘못된 id 형식은 CastError→500→**슬랙 에러 알림**까지 울려서 400으로 끊음
  - 🔴 **`.lean()` + 기존 문서 = 카운터 필드 실종(하마터면 그대로 배포될 뻔)**: Mongoose default는 **저장/하이드레이트 때만** 채워지는데 `.lean()`은 하이드레이트를 건너뛴다. 도입 이전 곡 **1091곡 전부** `likeCount`/`playCount` 필드가 없어서 by-ids 응답에서 두 필드가 `undefined` → **JSON에서 통째로 사라짐**. 처음 테스트가 *새로 만든* 곡을 써서 못 잡았고, 운영 DB의 실제 곡으로 확인해서 발견
    - **해결: 마이그레이션 없이 응답 시점 정규화**(`statsService.withCounts`, `?? 0`). `$inc`가 없는 필드를 알아서 만들어 주므로 백필 불필요, 운영 DB 무수정. 크론 등이 Mongoose 밖에서 곡을 넣어도 안전
    - 회귀 테스트 추가: `$unset`으로 "도입 이전 문서"를 재현해 검증
- **검증**: 서비스 31 + HTTP 라우트 23 + 웹호환 6 = **60 케이스 전부 통과**(멱등성·동시성 가드·음수 방지·중복 발사·401/404/400·기존문서 정규화·**유출 방지**). 운영 DB를 건드리지 않으려고 임시 Song/User를 만들어 테스트하고 삭제(잔여 0 확인). 신규 린트 에러 0
- **웹앱 영향 — 실측 확인함**: `/by-ids` 소비처는 `store/player.js:288`(`refreshQueueData`) 한 곳. **운영 DB의 실제 곡 5개로 변경 전/후 응답을 필드 단위 비교** → 기존 4필드(`_id`/`title`/`artist`/`coverUrl`) **전부 유지·값 동일**, `liked`/`likeCount`/`playCount`만 **추가**. `refreshQueueData`의 `freshMap.get(item._id) || item` 치환 로직도 그대로 재현해 정상 동작 확인. **웹 무영향**
  - `.lean()` 전환도 웹엔 무영향 — 어차피 `res.json()`으로 직렬화돼 나가므로 와이어 포맷이 동일
- **남은 것(앱 쪽)**: 하트 UI, 30초/50% 트리거에서 `POST /:id/play` 호출, "좋아요한 곡" 보관함 진입점

### 2026-07-11 - 앱 배포/자동 업데이트용 백엔드 + 다운로드 페이지 (`/api/app`)
- 배경: dibe2-app(안드로이드)을 Play 스토어 밖에서 **직접 APK 배포 + 로그인 사용자만 다운로드**. APK는 private 저장소 `dibe2-app`의 GitHub Releases 자산으로 두고, dibe2가 게이팅 게이트웨이 역할
- **`server/api/app.js` 신설** (`netlify/functions/api.js`에 `/app` 마운트, 전역 `jwtCheckMiddleware`로 로그인 게이팅):
  - `GET /api/app/latest` → GitHub Releases API로 최신 릴리스 조회 → `{ version, notes, size }`
  - `GET /api/app/download` → private 자산을 `Accept: application/octet-stream`으로 요청하면 GitHub이 단기 서명 URL(objects.githubusercontent.com, ~5분)로 302를 줌. 리다이렉트를 따라가지 않고 `Location`만 받아 `{ url, version, size, filename }`으로 반환 → 바이트를 Function이 프록시하지 않아 Netlify 6MB 응답 제한과 무관
  - 필요 env: `GITHUB_TOKEN`(dibe2-app `contents:read` fine-grained). 미설정 시 500
- **`pages/download.vue`**: 로그인 사용자용 다운로드 페이지(최신버전·변경사항·크기 + APK 다운로드 버튼, 단기 URL로 이동). 전역 `auth` 미들웨어라 비로그인 자동 차단
- **`components/UserMenu.vue`**: 드롭다운에 "앱 다운로드" 진입점 추가 + 전 항목 아이콘/색 통일(프로필·설정·다운로드·관리자·로그아웃)
- 외부 스토리지(R2/S3) 대신 GitHub Releases 채택: 게이팅·대용량·무비용을 이미 충족, 추가 서비스 0. 상세 설계·단계는 `dibe2-app/docs/RELEASE.md`
- 앱 쪽(버전 비교·다운로드·설치 인텐트) 구현은 `dibe2-app/docs/WORK_LOG.md`(2026-07-11) 참고

### 2026-07-07 - 모바일 앱 방향 확정 (Flutter, Android 전용, A안 우선) + dibe2-app 프로젝트 초기 셋업
- 배경: `docs/MOBILE_APP_PLAN.md`(2026-03-31)에서 논의했던 모바일 앱 계획을 재검토하고 실행 착수
- **프레임워크 최종 결정: Flutter** — Capacitor도 비교 검토. `audio_service`+`just_audio` 조합이 백그라운드 재생+미디어 세션 컨트롤에 특화된 성숙한 표준 패키지라 채택. Capacitor는 이 문제에 대한 표준 솔루션이 없어 결국 자체 네이티브 플러그인을 새로 짜야 함
- **대상 플랫폼: Android만** — 개발 환경이 Windows라 iOS 빌드(macOS 필요) 불가
- **진행 방식: A안(WebView 하이브리드) 우선 → B안(네이티브 UI) 점진 전환** — 이미 구현된 웹 UI 자산(로그인, 비디오 탭, 재생목록, 셔플/반복 등)이 두터워 전체 재구현 비용이 큼. A안으로 백그라운드 재생 목표부터 빠르게 달성하고, 실사용하며 불편한 화면만 점진적으로 네이티브 교체하는 전략
- **프로젝트 분리**: `d:\projects\dibe2-app`에 별도 Flutter 프로젝트 생성, 독립 git 저장소로 관리(빌드/배포 복잡성 방지 목적). API는 기존 dibe2 Netlify Functions를 HTTP로 그대로 호출(백엔드 코드 중복 없음)
- 오늘 완료: Flutter 프로젝트 생성 + git 초기화 + 초기 커밋 + `dibe2-app`의 `CLAUDE.md`/`docs/PLAN.md`/`docs/WORK_LOG.md` 정리. WebView 로딩/JS Bridge/오디오 엔진은 아직 미구현 — 진행 상황은 `dibe2-app` 저장소의 `docs/WORK_LOG.md` 참고

### 2026-07-02 - 로그인 페이지 리디자인 (소셜 로그인 전용) + 전역 Pretendard 폰트 적용
- 배경: 아이디/비밀번호 로그인은 테스트용이었고 이제 안 쓸 것 → 구글/카카오 소셜 로그인만 남기고, 기존 템플릿 느낌 나던 UI를 현대적으로 재설계
- **`pages/login.vue`**: 이메일/비밀번호 폼 완전 제거. 좌측 브랜드 패널(로고+그라데이션 블러 장식) + 우측 로그인 패널 2단 레이아웃, 모바일은 세로 스택으로 반응형 처리
- **`components/SocialLoginButton.vue`**: 기존 flat 컬러 풀와이드 버튼 → 각 사 공식 버튼 가이드 반영
  - 구글: Light 테마 스펙 그대로(`#FFFFFF` 배경/`#747775` 테두리/`#1F1F1F` 텍스트, 표준 멀티컬러 G 로고 SVG), 라벨 "Google 로그인"
  - 카카오: `#FEE500` 배경/`black/85` 텍스트/정확히 12px radius(Tailwind `rounded-xl`), 라벨 "카카오 로그인". 말풍선 심볼은 공식 에셋이 아닌 근사치 SVG(정확도 필요해지면 `developers.kakao.com/tool/resource/login`에서 공식 에셋으로 교체 권장)
  - 버튼 텍스트는 `font-bold`로 조정(피드백: 더 굵은 게 낫다)
- **전역 폰트 Pretendard 적용**: `nuxt.config.js`에 jsDelivr CDN 링크 추가, `tailwind.config.js`의 `fontFamily.sans`를 Pretendard 우선으로 교체(Tailwind preflight가 `html`에 자동 적용). 기존엔 별도 폰트 지정이 전혀 없어 브라우저 기본 sans였음
- 서버 `/api/users/login`, `/api/users/register` 엔드포인트는 그대로 유지(프론트에서만 제거, 백엔드 차단은 별도 논의 필요)

### 2026-06-28 - VideoAddModal "플레이리스트에 추가"에 로딩 스피너 추가
- 배경: "재생목록에 추가"는 로컬(Vuex+localStorage)이라 네트워크 호출이 없지만, "플레이리스트에 추가"는 실제 `/api/video-playlists/:id/videos` POST라 배포 환경(Netlify Functions 콜드스타트 + MongoDB Atlas 왕복)에서 dev보다 체감 딜레이가 있을 수 있다는 지적 → 처리 중 피드백 없음
- `addingPlaylistId` data 추가 — 어느 플레이리스트 버튼이 처리 중인지 추적해 그 버튼에만 스피너(`fa-spinner fa-spin`) 표시, 두 "추가" 버튼 전부 비활성화로 중복클릭 방지. 모달 닫힐 때(`show` watcher)도 같이 리셋
- 음원 `layouts/main.vue`의 `isAdding` 풀스크린 로딩 오버레이(스피너+가짜 진행바)와 같은 종류 문제지만, 비디오는 영상 1개만 추가하는 가벼운 동작이라 버튼 인라인 스피너로 단순화(가짜 진행바 없음)

### 2026-06-28 - 비디오 탭에 Media Session API 연동 (모바일 잠금화면 컨트롤)
- 요청: 영상 재생 중 다른 앱 쓰거나 화면 끄고도 감상하고 싶다는 요청 → 진짜 백그라운드 영상재생은 유튜브 iframe이 크로스오리진이라 우리 JS로 강제 불가(브라우저/OS 정책 영역, iOS는 화면 꺼지면 거의 항상 멈춤). 오디오 스트림 추출 같은 ToS 위반 우회는 시도 안 함(invidious 우회 안 한 것과 같은 기준) → 절충안으로 Media Session API만 연동(주 타겟: Android Chrome)
- `pages/video/index.vue`에 `setupMediaSession`(재생/일시정지/이전/다음/탐색 액션 핸들러, `mounted`에서 1회 등록) / `updateMediaSession`(제목·채널명·썸네일 메타데이터, `currentVideo` watcher에서 갱신) / `clearMediaSession`(`beforeDestroy`에서 정리) 추가. `playbackState`는 `onStateChange`의 PLAYING/PAUSED에서 같이 갱신
- 효과: 잠금화면/알림에 컨트롤 노출 + 일부 기기에서 백그라운드 유지에 도움. 완전한 백그라운드 재생 보장은 아님 — 기대치를 명확히 하고 진행

### 2026-06-28 - 음원 플레이어에도 재생 위치 기억 추가
- 배경: 비디오 쪽 "재생 위치 기억" 작업하면서 음원도 이미 그 기능이 있는 줄 알았는데 확인해보니 없었음(`store/player.js`엔 곡/큐/볼륨/셔플/반복만 저장, 위치는 전혀 저장 안 함) → 같이 추가
- **구조적 차이**: 비디오는 페이지 로컬 `YT.Player`가 새로고침 시에도 즉시 영상을 cue하기 때문에 `onReady`에서 바로 `seekTo`로 복원하고 진행바에도 바로 보였지만, 음원은 공유 싱글톤(`utils/youtubePlayer.js`)이 새로고침 직후엔 곡을 전혀 로드 안 하고 실제 `play()`를 호출해야 `loadVideoById`로 로드됨 — 그래서 음원은 "재생 버튼을 누르는 순간 기억해둔 위치로 점프"하는 형태로만 구현, 재생 전 진행바 미리보기는 없음
- **`store/player.js`**: `resumePosition` state 신규(`currentTime`과 분리 — 재생 중 값이 계속 바뀌는 `currentTime`을 재사용하면 다른 곡으로 바꾼 뒤 그 값으로 잘못 seek하는 버그가 생겨서 별도 필드로 분리). `initializeQueue`에서 `user_{id}_position`(`{trackId, time}`, 5초 이하는 무시) 복원
- 저장은 `updateTrackProgress`(1초 polling, 재생 중일 때만) + `pause` 액션에서 — 비디오의 5초 간격보다 더 촘촘하지만 기존 1초 polling에 얹은 거라 추가 인터벌 없음
- **버그: 처음 적용했을 때 안 먹음** — `play()` 액션 안에서 `loadVideoById` 호출 직후 곧바로 `seekTo`를 호출했는데, YouTube IFrame API가 새 영상을 막 로드한 시점엔 버퍼링 전이라 그 seekTo가 씹히는 경우가 있었음(비디오 쪽 자동재생 버그와는 다른 종류의 timing 이슈). **수정**: seek 타이밍을 `play()`(호출 직후, 신뢰 불가)에서 `initYoutubePlayer`의 `onStateChange`가 실제 `PLAYING` 상태를 보고하는 시점(영상이 진짜로 재생되기 시작해 seek이 항상 먹는 시점)으로 이동. `resumePosition`이 한 번 소비되면 `null`로 비워지므로 이후 PLAYING 이벤트에서는 재실행 안 됨

### 2026-06-28 - 비디오 탭: 재생 컨트롤은 하단 고정 바로, 영상+재생목록은 토글 패널로 분리 + 셔플/반복 추가
- 피드백 진행 과정: ① 미니플레이어 "+"(추가)는 필요 없고 셔플/반복이 더 맞음 ② 모바일 제목 잘림 → 마퀴 스크롤 시도했다가 폐기 → 음원처럼 제목 자체를 숨기고 썸네일 탭=툴팁으로 확인하는 방식으로 정착 ③ "영상과 음원 미니플레이어를 합친 개념"이라 영상은 보고 싶을 때만 보는 게 맞다고 판단 → 풀스크린 오버레이(영상+컨트롤+재생목록 한 덩어리, 화살표로 닫기) 구조를 버리고, 재생 컨트롤은 하단 고정 바에 항상 두고 영상+재생목록만 별도 토글 패널로 분리
- **하단 고정 바**(항상 떠 있음): 썸네일(탭하면 음원 `MusicPlayer.vue`의 `toggleTrackInfo()`와 동일하게 제목 툴팁이 5초간 떴다 사라짐, 데스크탑은 `hidden sm:block`으로 제목 truncate 텍스트도 같이 노출), 반복, ◀▶, 재생/일시정지, 셔플, 음량(데스크탑만), "재생목록" 토글 버튼. 재생 컨트롤은 전부 여기 하나로 모음
- **"지금 재생 중" 패널**(`showNowPlaying`): 영상 프레임 + 제목/채널명 + 재생목록(`VideoQueueList`)만 담당, 재생 컨트롤 중복 없음. 닫기는 우측 상단 화살표가 아니라 하단 바의 "재생목록" 버튼을 다시 누르는 토글(`showNowPlaying = !showNowPlaying`)
- **z-index 재배치**: 패널이 화면 전체를 덮어도 하단 바의 토글 버튼을 계속 누를 수 있어야 해서 하단 바를 패널보다 위로(`z-40` vs 패널 `z-30`) 둠 — 안 그러면 패널 열린 상태에서 닫을 방법이 없어짐
- **`store/videoQueue.js`에 셔플/반복 추가** — 음원 `store/player.js`와 동일 패턴(셔플은 현재 영상 제외 나머지 섞기 + `originalQueue` 보관/복원, 반복은 off→all→one 순환), `localStorage` 키도 동일 네이밍(`video_shuffle`, `video_repeat_mode`, `video_original_queue`)
- repeat `'one'`의 실제 재시작(`seekTo(0)`+`playVideo()`)은 스토어가 아니라 `pages/video/index.vue`의 `playNext()` 메서드에서 처리 — 비디오는 음원과 달리 공유 싱글톤이 아니라 페이지 로컬 `YT.Player` 인스턴스라서 스토어에서 직접 플레이어를 제어할 수 없음. 스토어의 `playNext` 액션은 일반 다음곡 + repeat `'all'` wraparound만 담당
- 이어서 추가 피드백 반영: "지금 재생 중" 패널의 "추가"/"유튜브에서 보기"를 더 다듬음
  - **유튜브 링크 제외**: 정상재생 중엔 노출 안 함(차단 감지 안내 카드에만 남김)
  - **"추가" 버튼 위치 이동**: 제목 줄 옆에 있던 위치가 UX상 안 좋다는 피드백 → 음원 `Playlist.vue`(재생 큐 목록)에도 "추가" 버튼이 없는 것과 동일선상에서, 재생목록 섹션 헤더("재생목록 (N)") 옆으로 이동
  - **하단 고정 바에 진행바 추가**: 음원 `MusicPlayer.vue`의 진행바 패턴을 그대로 포팅 — `currentTime`/`duration`을 페이지 로컬 `YT.Player`의 `getCurrentTime()`/`getDuration()`으로 1초 polling(`isPlaying` watcher로 재생 중에만), 드래그/클릭 탐색은 `player.seekTo(time, true)` 직접 호출. 영상 전환 시 `currentTime`/`duration`을 0으로 리셋해 이전 영상 진행률이 잠깐 보이는 문제 방지
- **버그 발견·수정: 자동재생 방지가 "재생 위치 기억"과 만나면 무력화됨** — `initVideoPlayer`의 `onReady`에서 `lastPosition`을 복원하려고 `seekTo()`를 호출하는데, YouTube IFrame API는 **cue만 된(autoplay:0) 영상**에 `seekTo`를 호출하면 paused 상태와 달리 재생이 시작되는 특성이 있음. 그래서 새로고침 복원 시 자동재생을 막아놨어도(`autoplay:0`), 기억된 위치가 5초를 넘으면 그 seekTo 때문에 재생이 시작돼버렸음. 수정: `!autoplay`일 때 seekTo 직후 `pauseVideo()`로 즉시 되돌림 — 위치는 정확히 복원되면서 실제로는 멈춰있는 상태 유지
- **진행바가 재생 전엔 0:00으로 보이던 문제 수정**: 음원은 `MusicPlayer.vue`가 mount 시 재생 여부와 무관하게 폴링을 시작해서 멈춰 있어도 진행바에 복원된 위치가 바로 보이는데, 비디오는 `isPlaying` watcher로만 폴링을 시작해서 실제로 재생해야만 값이 채워졌음. `onReady`에서 위치 복원 직후 `currentTime`/`duration`을 즉시 한 번 읽고 `startTimeUpdate()`를 호출하도록 수정 — 음원과 동일하게 재생 전에도 진행바에 바로 표시됨

### 2026-06-28 - 비디오 탭을 유튜브 뮤직 미니플레이어 패턴으로 재구성 + 자동재생 방지
- 피드백: 검색 탭에 (v-show로 숨겨놨다 해도) 기존 재생 영상 영역이 구조적으로 끼어있는 게 싫음 — 검색 탭은 검색+재생+추가만 있으면 됨. 영상 재생 자체는 유튜브 뮤직처럼 하고 싶다(미니플레이어 + 확장형 Now Playing)
- **탭 3개→2개**: 검색/재생목록/보관함 → 검색/보관함. 재생목록(큐)은 최상위 탭에서 빠지고 "지금 재생 중" 오버레이 안으로 들어감
- **"지금 재생 중"을 탭 콘텐츠에서 완전히 분리**: `pages/video/index.vue`에 ① sticky 미니플레이어(검색/보관함 탭과 무관하게 항상 떠 있음, 썸네일 탭하면 확장) ② `showNowPlaying`으로 토글되는 풀스크린 오버레이(큰 영상 프레임 + 컨트롤 + `VideoQueueList`) 두 레이어로 재구성. 둘 다 `v-show`라 탭을 전환하거나 오버레이를 닫아도 `#video-page-player`가 DOM에서 사라지지 않아 재생이 끊기지 않음
- **자동재생 방지**: 새로고침/재방문 시 `localStorage`에서 큐·현재영상이 복원되면 `autoplay:0`으로 cue만 하고 재생은 안 함. 검색 결과 클릭/재생목록 클릭/"전체재생" 등 명시적 액션만 재생 시작 — `initVideoPlayer(videoId, autoplay)`에 `justRestored` 플래그(mount 시 true, `initializeQueue`의 동기 커밋이 트리거하는 `currentVideo` watcher가 이 시점 값을 읽고 다음 tick에 false로 리셋)로 구분. 영상 종료 후 큐의 다음 영상 자동 진행은 재생목록의 정상 동작이라 그대로 둠(자동재생 방지 대상이 아님)
- 같이 발견한 버그: `mounted()`에서 watcher와 별개로 `initVideoPlayer`를 또 호출하던 중복 호출 경로 제거, `initVideoPlayer`에 `if (this.player) return` 가드 추가해 멱등성 확보
- 추가(이어서): 미니플레이어/오버레이에 재생/일시정지 토글 버튼 추가(음원 `MusicPlayer.vue`와 동일한 동그란 버튼 스타일), `layouts/video.vue`에 빠져있던 모바일 44px 터치영역 규칙 보강, 오버레이 컨트롤 줄이 좁은 화면에서 넘치지 않게 `flex-wrap` 처리. `VideoAddModal.vue`는 대상 영상이 이미 재생목록(큐)에 있으면 "재생목록에 추가" 항목을 안내문구로 대체(중복 추가 유도 방지) — `videoQueue.queue`를 참조해 매번 동적으로 판단
- 추가(이어서 2): 같은 로직을 "플레이리스트에 추가" 목록에도 적용 — 이미 들어있는 플레이리스트는 "추가됨" 표시로 비활성화(`playlist.videos`를 직접 대조). 서버가 중복을 조용히 걸러내고도 `success:true`만 보고 "추가되었습니다" 토스트를 띄우던 부정확한 케이스도 `addedVideos` 개수로 분기해서 수정
- 미니플레이어를 sticky 상단(탭 블록 안)에서 **하단 고정**으로 이동 — 유튜브 뮤직, 그리고 우리 음원 쪽 `MusicPlayer.vue`도 전부 하단 고정이라 통일. 탭 콘텐츠 영역엔 `currentVideo` 있을 때만 하단 패딩(`pb-24 sm:pb-28`) 추가해 가려지지 않게 처리
- **재생 위치 기억** 추가 — 마지막으로 보던 영상 1개의 `getCurrentTime()`만 5초 간격(재생 중일 때) + 일시정지 시 + 페이지 이탈 시 `localStorage`(`user_{userId}_video_position`)에 저장. 같은 영상으로 돌아오면(`onReady` 또는 `loadVideoById` 직후) `seekTo`로 복원. 여러 영상 기록을 누적하지 않는 단순한 버전으로 의도적으로 제한

### 2026-06-28 - 비디오 탭 재생목록 UX 3차 개선 (선택모드 제거 + 추가 모달 통합 + 음량 저장)
- 2차 결과물 피드백: 카드 클릭이 즉시재생/선택토글로 모드에 따라 의미가 달라져 혼란, "+"가 큐(재생목록)에만 가고 플레이리스트(보관함) 추가는 선택모드를 거쳐야 해서 음원 쪽 방식(체크 → "추가" → 재생목록/플레이리스트 선택 모달)과 다르게 느껴짐, 지금 재생 중인 영상 자체를 추가하는 경로도 큐/플레이리스트로 따로 나뉘어 있었음
- **선택모드 완전 제거**: `pages/video/index.vue`에서 `selectionMode`/`selectedItems`/플로팅 액션바/체크오버레이 삭제. 카드는 항상 "썸네일 클릭=재생" + "추가 버튼=모달" 2가지 동작만
- **`VideoAddModal.vue` 신규**: 영상 1개를 대상으로 "재생목록에 추가" / "플레이리스트에 추가(펼치면 보유 목록)" 중 고르는 단일 모달 — 음원 `layouts/main.vue`의 Add-to-Playlist 모달과 동일 패턴. 검색 카드의 "추가" 버튼과 "지금 재생 중" 슬림바의 "추가" 버튼이 이 모달을 공유(대상만 교체). 기존 `VideoPlaylistPickerModal.vue`(다건 선택용 별도 모달)는 삭제
- **음량 `localStorage` 저장** 추가 (`user_{userId}_video_volume`) — 새로고침해도 유지. `getVolumeStorageKey()`로 `store/player.js`의 `getStorageKey` 패턴과 동일하게 키 생성
- 재생목록(큐) 탭 안에서의 클릭-재생/다중선택삭제는 기존 `VideoQueueList.vue` 그대로 — 검색 카드 쪽 선택모드 제거와는 무관한 별개 기능이라 유지

### 2026-06-28 - 비디오 탭 재생목록 UX 2차 개선 (탭 분리 + 슬림 컨트롤바 + 빠른추가)
- 1차(큐 모달 + 선택모드)를 써보고 나온 피드백 반영: 큐가 모달에 숨어 있어 불편, 비디오엔 음원 `MusicPlayer.vue` 같은 하단 고정 플레이어가 없어 스크롤하면 음량 조절 불가, 검색 결과 하나만 빠르게 추가하거나 재생 중인 영상 자체를 추가할 방법이 없었음
- **탭 2개→3개**: 검색/보관함 → 검색/재생목록/보관함. `VideoQueueModal.vue`(모달) 삭제, `components/VideoQueueList.vue`(인라인) 신규 — 재생목록이 검색/보관함과 동급인 1급 탭이 됨. 탭 라벨에 큐 개수 배지
- **"지금 재생 중" 슬림 컨트롤 바** 추가 (`pages/video/index.vue`): 탭/검색바와 같은 `sticky top-16` 블록 맨 아래에 포함시켜 별도 top 오프셋 계산 없이 스크롤해도 항상 고정 노출. 썸네일+제목, ◀▶, 음량(데스크탑만 `hidden sm:flex` — 음원 `MusicPlayer.vue` 67-78줄 마크업 재사용, 단 Vuex `setVolume` 액션 대신 페이지 로컬 YT.Player 인스턴스에 직접 `setVolume`/`mute`/`unMute` 호출), 큐/플레이리스트 추가 버튼
- **검색 카드에 항상-보이는 "+" 버튼**: 선택모드 토글 없이도 단일 영상을 즉시 큐에 추가 (`videoQueue/addToQueue`). 선택모드는 다건 처리 + 플레이리스트 추가용으로만 유지(선택모드 켜지면 +버튼은 체크 오버레이로 교체)
- **헤더 큐 아이콘 제거**: `VideoHeader.vue`/`layouts/video.vue`를 원래 단순한 형태로 복원 — 재생목록 탭이 그 역할을 대신해 헤더에 별도 진입점 불필요
- **버그 수정**: `addSelectedToQueue`/`quickAddToQueue`에서 Vuex 액션 디스패치 결과를 `await` 없이 읽던 버그 발견·수정 (Vuex `dispatch`는 액션이 `async`가 아니어도 항상 Promise를 반환하므로 `await` 없으면 `result.message`가 `undefined` — 큐 추가 자체는 되지만 성공/중복 토스트가 조용히 안 뜨던 문제)

### 2026-06-27 - 비디오 탭에 재생 큐 + 저장 플레이리스트 추가
- 음원의 "휘발성 큐(player.js)" / "DB 저장 플레이리스트(playlist.js+Playlist 모델)" 분리 패턴을 비디오에도 동일하게 적용 (YouTube Music/Spotify/멜론 등 보편적 트렌드와도 일치)
- 데이터 모델은 `Playlist`를 확장하지 않고 `VideoPlaylist` 신규 모델로 분리 — 비디오는 DB에 저장된 문서가 없는 YouTube 검색 결과(`videoId,title,thumbnail,channelTitle,duration`)라서 `songId(ref Song)` 같은 참조가 성립 안 함
- **백엔드**: `server/models/VideoPlaylist.js`, `server/services/videoPlaylistService.js`, `server/api/videoPlaylist.js` (`/api/video-playlists/*`) — `server/{models,services,api}/playlist*` 패턴 그대로 미러링, 중복판별 키만 `songId`→`videoId`
- **스토어**: `store/videoQueue.js`(신규, player.js 축소판 — 셔플/반복/볼륨 제외, localStorage 캐싱은 동일), `store/videoPlaylist.js`(신규, playlist.js 미러링)
- **UI**: `pages/video/index.vue`에 "검색"/"보관함" 탭 추가(라우트 이동 없이 전환), 검색 결과 선택모드(체크 오버레이 + 플로팅 액션바), `VideoQueueModal`(큐, Playlist.vue 축소판), `MyVideoPlaylistSection`/`VideoPlaylistDetailPanel`(보관함), `CreateVideoPlaylistModal`, `VideoPlaylistPickerModal`. `VideoHeader`에 큐 아이콘(개수 배지) 추가
- 검색 결과 클릭 동작은 그대로 즉시 단일 재생 유지 (큐 미사용) — 음원의 `playSong(song){ setCurrentTrack(song) }` 선례를 따름. 영상 종료 시 큐 자동 다음곡 재생(`onStateChange` ENDED → `playNext`)
- 1차 스코프는 순서재생 + 자동다음만, 셔플/반복은 제외 (필요 시 player.js 패턴 따라 확장 가능)

### 2026-05-24 - `npm run dev`를 `netlify dev`로 통일
- `package.json` scripts.dev를 `nuxt` → `netlify dev`로 변경
- 기존 `npm run dev`는 nuxt 단독 실행이라 `/api/*` 라우팅 안 먹는 함정 (Express serverMiddleware 시절 잔재). 이제 진입점 하나로 통일
- **함정**: `netlify dev`는 framework auto-detect로 dev 명령을 정함. `package.json` `dev` script가 `netlify dev`로 바뀌어 무한루프 회피하면서 `npm start`(`nuxt start`, prod) 폴백해 dist 없다고 터짐. 해결: `netlify.toml [dev]`에 `command = "nuxt"` 명시
- CLAUDE.md 개발 모드 섹션 문구도 갱신

### 2026-05-24 - 페이지별 브라우저 타이틀 동적 적용
- **비디오 페이지** (`pages/video/index.vue`): `head()` 추가 — 기본 'DIBE2 비디오', `selectedVideo` 있을 때 `{영상제목} - DIBE2 비디오`
- **메인 레이아웃** (`layouts/main.vue`): `head()` 추가 — `currentTrack` 있으면 `{곡제목} - {아티스트} | DIBE2`, 없으면 'DIBE2'. 일시정지 중에도 곡 정보 유지 (Spotify/Bugs 컨벤션)
- 기존엔 `nuxt.config.js` head.title `'DIBE2'`만 적용돼서 어디 가나 'DIBE2'로 표시됐음
- Nuxt head 머지 규칙: 페이지 head() > 레이아웃 head() > nuxt.config.js. 그래서 비디오 페이지는 페이지 head()가 그대로 적용되고, 메인 레이아웃 페이지(/, /playlist/:id, /admin)는 레이아웃 head()로 곡 정보 표시

### 2026-05-24 - 비디오 페이지를 YT.Player 기반으로 + 차단 감지 안내 UI (invidious 우회 시도 → 포기)
- **시도**: 비디오 페이지의 단순 iframe → YT.Player로 전환하여 `onError(101/150)`로 임베드 차단 감지, `isBlocked=true` 시 invidious(yewtu.be) iframe으로 자동 fallback
- **검증 결과**: invidious 우회 실패. 두 가지 본질적 장벽
  - yewtu.be (그리고 대부분 invidious 인스턴스)가 anti-bot 페이지 + `X-Frame-Options: SAMEORIGIN` 적용 → 우리 도메인 iframe에서 띄울 수 없음
  - TJ/한국 라이선스 영상은 invidious 인스턴스(유럽/북미 IP)가 stream 추출 자체 불가
  - 다른 인스턴스/Piped도 같은 anti-bot 추세 + IP 제한 동일
- **결정**: invidious 우회 코드 제거. 차단 감지 시 영상 자리에 큰 안내 카드 + "YouTube에서 보기" 버튼만 표시
- **유지**: YT.Player 기반 임베드 + onError 차단 감지 흐름은 유지 (단순 iframe 대비 명확한 안내 가능)
- **검토했으나 안 한 대안**: 자체 서버에서 yt-dlp stream 추출 = 한국 IP 호스팅 + 별도 서버 + YouTube 봇 차단 위험으로 trade-off 안 맞음
- 비디오 페이지 player id는 `video-page-player` (음원 `youtube-player`, 어드민 `admin-preview-player`와 격리)

### 2026-05-24 - youtube-nocookie 도메인 적용 (사용자 계정 컨텍스트 분리)
- 음원/어드민 미리듣기/비디오 페이지 모두 `youtube-nocookie.com`으로 변경
  - `utils/youtubePlayer.js`, `components/admin/MusicManagement.vue`: `new YT.Player(...)` 옵션에 `host: 'https://www.youtube-nocookie.com'` 추가 (YT IFrame API 공식 옵션)
  - `pages/video/index.vue`: iframe src를 `youtube.com/embed/` → `youtube-nocookie.com/embed/`
- 효과: 사용자의 youtube 계정 쿠키 안 보냄 → 시청기록/추천 알고리즘 영향 없음, 광고도 비개인화. 재생/컨트롤/이벤트 동작은 동일
- 차단 영상 정책은 동일 (우회는 아님)

### 2026-05-24 - 어드민 미리듣기와 메인 player 인스턴스 격리 (좀비 진짜 원인) + 비디오 영상 크기 fix
- **증상**: 메인에서 음원 재생 → /admin → 음원 추가에서 유튜브 검색/미리듣기 → 메인 복귀 후 음원 재생 안 됨
- **원인**: `components/admin/MusicManagement.vue`가 `utils/youtubePlayer.js` 싱글톤을 import하고 자체 `<div id="youtube-player">`(id 중복)에 mount 시 `YouTubePlayer.init` 호출 → 모듈 스코프의 player 인스턴스/콜백을 어드민 것으로 덮어씀 → 메인 player 잃어버림. 좀비 fix(body div + health check)는 DOM 관점에선 정상이라 잡지 못함
- **해결**: 어드민 미리듣기를 별도 YT.Player 인스턴스로 격리
  - div id: `youtube-player` → `admin-preview-player`
  - utils 모듈 import 제거, 자체 `new YT.Player(...)` 생성 (`initAdminPlayer` 메서드)
  - `beforeDestroy`에서 player.destroy() + setInterval cleanup 추가 (기존엔 setInterval clear도 누락된 상태)
  - 모든 `YouTubePlayer.xxx` 호출 → `this.player?.xxx`로 일괄 변경
- **비디오 페이지 영상 크기 fix**: 데스크탑에서 16:9 영상이 화면 높이 넘치던 문제
  - `aspect-ratio: 16/9` + `max-height: calc(100vh - 16rem)` + sm 이상에선 width를 max-height에 비례 cap하는 CSS로 뷰포트 안에 들어오게. 비율 유지

### 2026-05-24 - 비디오 모드 UX 개선 + 좀비 fix 보강
- **좀비 fix 보강**: `store/player.js` `initializeAudioSystem`에 `#youtube-player` DOM health check 추가
  - 1차 fix(div를 body에 두기)는 "div가 사라지지 않는다"는 낙관 전제였는데, 어떤 이유(hot-reload 잔재 등)로 사라지면 여전히 좀비
  - 매번 mount 사이클에서 `document.body.contains(playerEl)` 확인 → 죽었으면 div 복구 + YT.Player 재init. 큐는 기존 상태 보존
- **비디오 모드 별도 헤더**: `components/VideoHeader.vue` 신설 (← 뒤로가기 + DIBE2 비디오 + UserMenu)
  - 기존엔 `layouts/video.vue`가 `AppHeader`를 그대로 써서 비디오 페이지에 음원 검색 input이 노출되던 어색함 해소
  - 모드 분리 명확 + 복귀 경로(← 또는 로고 클릭) 명시
- **`components/UserMenu.vue` 추출**: 유저 아바타 + 드롭다운 메뉴를 AppHeader/VideoHeader 양쪽에서 재사용
- **`components/AppHeader.vue` 슬림화**: 유저 메뉴 관련 data/computed/methods 제거하여 UserMenu에 위임

### 2026-05-24 - 비디오 검색 페이지 추가 + youtube-player 좀비 이슈 해결 + dev 환경 정비
- **비디오 페이지** (`/video`): 유튜브 검색 → 결과 그리드 → 클릭 시 페이지 내 `<iframe>` 임베드 재생. 음원과 인스턴스 분리, 음원 페이지로 돌아오기 전까지는 둘이 충돌 없음
  - `server/api/youtube.js` 신설 + `GET /api/youtube/search` (services.songService.searchYoutubeForVideo, 길이 필터 없음)
  - `layouts/video.vue` 신설 (AppHeader만, 하단 MusicPlayer 없음). mounted에서 `player/pause` 디스패치하여 음원 일시정지 (큐 상태는 그대로 보존)
  - `pages/video/index.vue`: 모바일 1열 → sm 2열 → lg 3열 그리드, aspect-video iframe
  - `components/AppHeader.vue`: 검색 input과 유저 아바타 사이에 비디오 아이콘 추가 (모바일 포함 항상 표시)
- **youtube-player 좀비 이슈 근본 해결**: `#youtube-player` div를 `layouts/main.vue`가 아닌 `document.body`에 마운트
  - 기존: 메인 → /admin 같은 다른 레이아웃 전환 시 main.vue unmount → DOM 사라짐 → `YT.Player` 인스턴스 좀비화 → 새로고침 필요
  - 해결: `plugins/youtube-init.client.js` 신설, body에 한 번만 마운트 → 어떤 레이아웃 전환에도 DOM 유지
  - `layouts/main.vue`에서 `<div id="youtube-player">` 제거
- **dev 환경 정비** (Netlify 이관 후 잔재 정리)
  - `package.json` dev: `nodemon --watch server --exec "nuxt"` → `"nuxt"`. Express serverMiddleware 시절 잔재로, Netlify Functions 이관 후엔 netlify dev가 functions 핫리로드를 자체 처리하므로 nodemon 불필요. 또한 nodemon이 nuxt 시작을 한 단계 더 감싸 첫 빌드 시간이 netlify-cli targetPort wait timeout(~30초)을 초과하던 문제 동시 해결
  - `netlify.toml`에 `targetPortReadyTimeout = 60` 추가 (안전판)
- **모바일 대응 원칙 문서화**: `CLAUDE.md` 작업 규칙 + `docs/FRONTEND.md`에 가이드 추가

### 2026-05-11 - localStorage 캐시 stale 해소 (큐/차트 동기화)
- **문제**: 큐의 곡 데이터(특히 가사)가 localStorage에 통째로 캐시되어, DB가 cron으로 갱신되어도 옛 데이터가 계속 표시됨
- **해결 (B 하이브리드 패턴)**: 캐시 즉시 표시 → 백그라운드 fresh fetch → 갱신
- 서버: `POST /api/songs/by-ids`, `GET /api/songs/lyrics/:songId` 신규 (server/services/songService.js, server/api/song.js)
- 클라이언트:
  - 곡 캐시 시 `stripForCache` 헬퍼로 최소 필드만 저장 (`_id, title, artist, coverUrl`). lyrics 제외
  - `refreshQueueData` 액션: `initializeAudioSystem`에서 백그라운드 디스패치 → 큐/currentTrack/originalQueue fresh로 교체
  - `fetchCurrentTrackLyrics` 액션 + `SET_CURRENT_TRACK_LYRICS` mutation: 가사 lazy fetch
  - Playlist.vue: currentTrack watch(immediate)에서 가사 fetch 트리거
  - layouts/main.vue: 차트도 `dibe2_chart_cache` 키로 동일 패턴 적용
- 부수 효과: 모든 필드 stale 자동 해소, localStorage 용량 감소, 홈 첫 로딩 체감 속도 ↑
- 호환성: 기존 localStorage에 lyrics 포함된 데이터 남아도 첫 refresh로 자연 갱신

### 2026-05-11 - JWT 토큰 만료 24시간 → 30일 연장
- `generateToken` 기본 expiresIn `24h` → `30d` (server/middleware/auth.js)
- 매일 재로그인 불편 해소. 구독 만료(expiryDate)는 별도 체크되므로 영향 없음
- docs/AUTH_FLOW.md 동기화

### 2026-04-01 - 크론 중복 로그 정리 + 레거시 코드 제거
- songService.js 중복 완료 로그 제거 (크론 함수에서만 완료 로그 출력)
  - "차트 업데이트 성공", "음원 데이터 저장 완료", "YouTube URL 업데이트 완료", "가사 업데이트 완료" 제거
  - "차트 변경점 없음"은 유지 (의미 있는 정보)
- Netlify 서버리스 전환 후 미사용 레거시 파일 삭제
  - server/middleware/cron.js (node-cron, 서버리스에서 불필요)
  - server/middleware/dailyVisitor.js (미사용)
  - server/middleware/dbConnection.js (models/index.js가 대체)
  - server/api/index.js (구 Express 진입점, netlify/functions/api.js가 대체)

### 2026-03-30 - 검색 팝업 ESC 닫기 + 음원 추가 메시지 수정
- 검색 결과 모달 ESC 키로 닫기 추가 (layouts/main.vue handleKeyDown)
  - Vuex search 스토어의 showSearchResults/closeSearchResults 매핑
  - 로컬 data의 미사용 showSearchResults 제거
- 음원 추가 toast 메시지 [object Object] 버그 수정 (SearchResultsModal.vue)
  - addMultipleToPlaylist 반환 객체를 올바르게 처리
  - 상태별 메시지: 성공(중복 제외 안내), 전체 중복, 큐 가득 참, 큐 공간 부족

### 2026-03-30 - 버그 수정 및 기능 개선
- 인증 미들웨어 이름 불일치 수정 (sessionCheckMiddleware → jwtCheckMiddleware)
- 방문자 통계 미들웨어 등록 + ES module→CommonJS 변환 + 집계 쿼리 버그 수정
- 관리자 시스템 통계 카드 삭제 (serverless에서 무의미)
- 크론잡 스케줄 한국시간 대응 (UTC 변환)
- 검색 결과 모달에 검색 입력 필드 추가 (재검색 UX 개선)
- JWT 토큰 관리 정비: 401일 때만 토큰 삭제, axios 인터셉터 추가, 순환 에러 방지
- /send-slack-message publicPaths 추가, OAuth 쿠키 maxAge 60초→5분

### 2026-03-30 - JWT 인증 전환
- 세션 기반(express-session + connect-mongo) → JWT 토큰 기반으로 전환 완료
- 서버: auth.js JWT 미들웨어, user.js JWT 발급, OAuth state JWT
- 클라이언트: localStorage 토큰 저장, axios Bearer 헤더, OAuth 리다이렉트 토큰 수신
- express-session/connect-mongo 패키지 제거, session.js 삭제
- 로컬 로그인 테스트 통과

### 2026-03-30 - AWS→Netlify 이관 작업
- Phase 1~4 완료 (정리, SPA 전환, Functions, 배포 설정)
- Google 로그인 동작 확인
- 주요 디버깅: basePath, session.save(), auth-init 플러그인
- Netlify Dashboard 환경변수 설정 완료
- OAuth 콘솔 콜백 URL 업데이트 완료 (dibe2.dimad.kr)

### 2026-03-29 - docs/ 문서 체계 구축
- CLAUDE.md (프로젝트 진입점) 생성
- docs/ 폴더 생성 및 6개 문서 작성

## 예정된 작업 (우선순위순)

### 1. 모바일 백그라운드 재생
- 현재: YouTube IFrame API로 재생 → 모바일에서 화면 꺼지면 재생 중단
- 목표: 화면 꺼져도 음악 계속 재생
- 방향: WebView 래핑은 IFrame 한계 동일 → 네이티브 오디오 플레이어 필요 (Flutter `just_audio` + `audio_service` 등). 곡/플레이리스트/검색은 현 API 그대로 재사용
- 자세한 계획: docs/MOBILE_APP_PLAN.md

### 2. 셔플 originalQueue stale 정리
- 현재: `store/player.js` toggleShuffle에서 셔플 ON 시점에 `originalQueue`를 저장하지만, 셔플 OFF 시에도 `originalQueue`를 비우지 않아 localStorage에 옛 데이터가 남음
- 미묘한 버그: 셔플 ON 상태에서 큐를 다른 곡들로 교체한 뒤 셔플 OFF로 돌리면, `originalQueue`가 옛 큐를 가리키고 있어서 그 옛 큐로 복원됨
- 해결 방향: 셔플 OFF 시 `originalQueue` 비우기 + localStorage 키 삭제 / 또는 셔플 OFF인 동안 큐 변경되면 originalQueue도 같이 갱신
- 작업량: 5~15분

### 3. ~~Invidious 잔존 문서 정리~~ ✅ 완료 (2026-07-17 (2))
- 전수 조사 결과:
  - `CLAUDE.md` — 이미 정리돼 있었음(현재는 "youtube-nocookie.com 사용"). 예정 작업 항목 쪽이 stale이었던 것
  - `docs/ARCHITECTURE.md` — **존재하지 않는 파일 2개를 나열 중이었음**(`advancedInvidiousManager.js`, `y2mate.js`). 실제 `server/utils/`엔 `helper.js` 뿐 → 수정함
  - `docs/MIGRATION_PLAN.md`, `README.md` — **그대로 둔다.** 과거 마이그레이션 스냅샷 / 개발 일지라 당시 기록이 맞다
  - `docs/ARCHITECTURE.md` 의 "invidious 우회는 작동 안 함이 확인됨"은 정확한 역사 기록이라 유지
- 🔴 **조사 중 새로 발견 — `docs/MOBILE_APP_PLAN.md` 가 없는 구현을 전제로 하고 있었다**
  - "Invidious 프록시에서 오디오 스트림 URL 획득 (**기존 구현 활용**)"이라 적혀 있었으나 구현은 삭제됐고 **Invidious 우회 자체가 실패로 판명**(2026-05-24)
  - 이 문서는 **예정 작업 1(모바일 백그라운드 재생)의 근거 문서**이고 이미 별도 저장소(`dibe2-app`)까지 만든 상태 → 재개 시 없는 구현을 찾다 시작할 뻔했음
  - 경고 배너를 달아둠. **오디오 소스 결정이 A안의 미해결 전제**라는 걸 명시(yt-dlp 대안도 이미 접은 상태라 선택지가 없음)

### (추가 작업은 여기에 계속 기록)
