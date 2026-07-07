# 작업 기록

> 완료된 작업은 **최신순(위에서부터 최근)**으로 정렬. 새 항목은 맨 위에 추가.

## 예정 작업
- **비디오 검색 결과 무한 스크롤**: 현재 `/api/youtube/search`가 `limit=20` 고정. `youtube-search-api`의 `NextPage(token)` 메서드로 서버 pagination 지원 + 클라이언트는 IntersectionObserver로 그리드 끝 감지 시 다음 페이지 append. 작업량 ~1-2시간

## 완료된 작업

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

### 3. Invidious 잔존 문서 정리
- 실제 코드에서는 Invidious 프록시 사용 안 함 (YouTube IFrame API로 클라이언트가 직접 재생). 관련 서버 코드(advancedInvidiousManager.js, `/stream/:songId` 라우트)는 이미 없음
- 그런데 다음 문서에 Invidious 언급이 stale로 남아있음:
  - `CLAUDE.md` — "오디오 스트리밍은 Invidious 프록시 사용" (주의사항)
  - `docs/ARCHITECTURE.md`
  - `docs/MIGRATION_PLAN.md` — 이건 과거 마이그레이션 계획 스냅샷이라 그대로 둘지 검토
  - `README.md`
- 작업: 각 파일 점검 후 stale 부분 제거 또는 "YouTube IFrame 직접 재생"으로 갱신
- 작업량: 10분

### (추가 작업은 여기에 계속 기록)
