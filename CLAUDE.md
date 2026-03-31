# DIBE2 - Claude Code 작업 가이드

## 프로젝트 개요
음악 스트리밍 웹앱 (Nuxt 2 + Express + MongoDB Atlas + YouTube 재생)

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
- **Frontend**: Nuxt 2 (Vue 2) + Vuex + TailwindCSS
- **Backend**: Express (Nuxt serverMiddleware)
- **DB**: MongoDB Atlas (Mongoose ODM)
- **음악 재생**: YouTube IFrame API (클라이언트)
- **인증**: JWT (jsonwebtoken) — Authorization: Bearer 헤더
- **음원 데이터**: Bugs Music 크롤링 → MongoDB 저장
- **배포**: Netlify (Functions + Static)

## 작업 규칙
- **토큰 절약**: 전체 코드를 읽지 말 것. CLAUDE.md → 필요한 docs/ 문서 → 수정 대상 파일만 읽기
- **작업 기록**: 완료/예정 작업은 `docs/WORK_LOG.md`에 기록
- **문서 최신화**: 코드 변경 시 관련 docs/ 문서도 함께 업데이트

## 주의사항
- `.env`에 실제 시크릿 있음 (커밋 금지)
- 크론잡은 프로덕션에서만 실행됨
- 오디오 스트리밍은 Invidious 프록시 사용
- JWT 토큰 기반 인증 (localStorage + Authorization 헤더)
- 배포 시 Netlify 환경변수에 `JWT_SECRET` 필요
