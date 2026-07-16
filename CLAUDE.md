# DIBE2 - Claude Code 작업 가이드

## 프로젝트 개요
음악 스트리밍 웹앱 (Nuxt 2 정적 빌드 + Netlify Functions + MongoDB Atlas + YouTube 재생)

## 작업 시 참조 문서
작업 전 **필요한 문서만** 읽을 것. 전체를 읽지 말 것.

| 문서 | 언제 읽나 |
|------|-----------|
| `docs/ARCHITECTURE.md` | 파일 위치/구조 파악 필요 시 |
| `docs/API_ENDPOINTS.md` | API 수정/추가 시 |
| `docs/DATA_MODELS.md` | DB 스키마 관련 작업 시 |
| `docs/FRONTEND.md` | 페이지/컴포넌트 수정 시 |
| `docs/AUTH_FLOW.md` | 인증/권한 관련 작업 시 |
| `docs/CRON_EXTERNAL.md` | 크론잡/외부API 관련 작업 시 |
| `docs/MOBILE_APP_PLAN.md` | 모바일 앱(Flutter) 관련 작업 시 |

## 핵심 기술 스택
- **Frontend**: Nuxt 2 (Vue 2, `ssr:false` + `target:static`) + Vuex + TailwindCSS
- **Backend**: Express → `serverless-http`로 래핑해서 Netlify Functions로 실행 (`netlify/functions/api.js`). `server/` 폴더는 라우터/모델/서비스 재사용 소스
- **DB**: MongoDB Atlas (Mongoose ODM)
- **음악 재생**: YouTube IFrame API (클라이언트)
- **인증**: JWT (jsonwebtoken) — Authorization: Bearer 헤더
- **음원 데이터**: Bugs Music 크롤링 → MongoDB 저장
- **배포**: Netlify (Functions + Static)

## 개발 모드 실행
- **`npm run dev`** = `netlify dev` (포트 3000) — Functions 라우팅(`/api/*` → `/.netlify/functions/api/*`)까지 같이 잡아줌. 내부적으로 3333번 nuxt dev 프록시
- nuxt만 단독으로 띄우면 `/api/*` 라우팅이 안 먹음. 항상 `npm run dev` 사용

## 작업 규칙
- **토큰 절약**: 전체 코드를 읽지 말 것. CLAUDE.md → 필요한 docs/ 문서 → 수정 대상 파일만 읽기
- **작업 기록**: 완료/예정 작업은 `docs/WORK_LOG.md`에 기록
- **문서 최신화**: 코드 변경 시 관련 docs/ 문서도 함께 업데이트
- **모바일 대응**: 모바일도 주요 사용 환경. 데스크탑만 확인하지 말 것 → 상세는 `docs/FRONTEND.md`

## 커밋 규칙
- 커밋 메시지는 `docs/WORK_LOG.md`의 해당 작업 항목을 참고해서 내용을 뽑되, 메시지 자체는 간단하게 작성
  - 제목: 쉼표로 구분된 짧은 구문 조각 (예: "비디오 검색/재생 페이지 추가, youtube-player 좀비 격리, dev 환경 정비")
  - 본문(여러 단계/세부사항 있을 때만): 짧은 불릿 3~6개로 핵심만 압축. WORK_LOG 항목을 그대로 복붙하지 않음
  - 작은 변경은 본문 없이 제목 줄만

## 주의사항
- `.env`에 실제 시크릿 있음 (커밋 금지)
- 🔴 **DB 접속은 반드시 `server/models`의 `connectToMongoDB()`를 쓸 것.** `.env`의 `MONGODB_URI`엔 **DB 이름 경로가 없고**, 실제 DB 지정은 이 함수의 `dbName: 'dibe2'` 옵션이 한다. 스크립트에서 `mongoose.connect(process.env.MONGODB_URI)`를 직접 부르면 **조용히 `test` DB(2024년 방치된 유령 DB)에 붙는다.** 같은 클러스터에 `dibe`/`test`/`dibe2`가 공존하며 **운영은 `dibe2`**
- **Netlify 스케줄 함수는 30초 제한**(설정 불가). 크론은 대량 백로그를 못 삼키고 타임아웃 시 슬랙 알림 없이 조용히 죽음 → 대량 작업은 `scripts/`의 로컬 스크립트로. 상세는 `docs/CRON_EXTERNAL.md`
- **`Song.youtubeUrl`은 곡 저장보다 늦게 채워짐**(08:00 저장 → 08:10 채움). 항상 있다고 가정하지 말 것
- 크론잡은 프로덕션에서만 실행됨
- 오디오/비디오 재생은 youtube-nocookie.com 도메인 사용 (사용자 계정 컨텍스트 분리)
- JWT 토큰 기반 인증 (localStorage + Authorization 헤더)
- 배포 시 Netlify 환경변수에 `JWT_SECRET` 필요
