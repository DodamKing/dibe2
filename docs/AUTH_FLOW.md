# 인증/권한 구조

## 인증 방식
- **JWT 토큰 기반**: jsonwebtoken (Authorization: Bearer 헤더)
- **소셜 로그인**: Google, Kakao
- 일반 회원가입은 현재 막혀 있음 (register 기능 비활성)
- 일반 로그인(아이디/비밀번호) UI도 `pages/login.vue`에서 제거됨 — 구글/카카오만 노출. 단, 서버 `/api/users/login`, `/api/users/register` 엔드포인트 자체는 그대로 살아있음(프론트에서만 막은 상태)

## JWT 토큰 구조
```
Payload: {
  userId: ObjectId,
  email: String,
  username: String,     // 일반 로그인
  name: String,         // OAuth 로그인
  picture: String,      // OAuth 로그인
  provider: String,     // OAuth (google/kakao)
  isAdmin: Boolean,
  expiryDate: Date
}
Secret: process.env.JWT_SECRET
만료: 30일 (웹·옛 앱) / 앱(v1.1.0+)은 아래 "토큰 2방식"
```

## 토큰 2방식 — 30일 토큰 / 접근+리프레시 (2026-10-28)

**배경**: 토큰 안의 `expiryDate`·`isAdmin`은 **발급 시점 값**이라, 관리자가 기간을 바꿔도 그 토큰이 사는
30일 동안 반영되지 않았다 — 연장해도 앱 "다시 확인"이 계속 403(재로그인해야 풀림), 줄이거나 끊어도 최대 30일 계속 사용.

| 클라이언트 | 로그인 응답 | 비고 |
|---|---|---|
| 웹, 앱 v1.0.19 이하 | `token`(30일, `typ` 없음) | 기존 그대로. **안 바꾸면 옛 앱이 1시간마다 로그아웃된다** |
| 앱 v1.1.0+ (본문 `refresh: true`) | `token`(접근, `typ:'access'`, **1시간**) + `refreshToken`(`typ:'refresh'`, **90일**) | 네이티브 `POST /users/google|kakao`만 해당 |

- **`POST /users/refresh`** `{refreshToken}` → `{token, refreshToken, user}`. 권한(`isAdmin`·`expiryDate`)을 **DB에서 새로** 읽는다
  = 관리자가 바꾼 기간이 반영되는 지점(최대 1시간 지연). 리프레시 토큰도 매번 새로 준다(슬라이딩 90일)
  - 리프레시 토큰은 **프로필만** 든다(name·picture는 DB에 없고 소셜 로그인 때만 받으므로). 권한은 안 든다
  - 만료된 사용자도 재발급은 해준다(새 토큰으로 요청하면 403 → 앱 만료 게이트)
  - 🗑️ **본문에 옛 30일 토큰도 받는다** — 앱 업데이트 직후 로그아웃 없이 넘어오는 1회성 교환.
    옛 토큰이 다 만료되면(마지막 옛 앱 로그인 + 30일) **이 분기와 아래 "만료 재확인"을 같이 지워도 된다**
- 리프레시 토큰을 `Authorization` 헤더로 보내면 401 (접근 토큰으로 인정 안 함)
- `ACCESS_TOKEN_TTL` env는 로컬 검증용(예: `2m`). 운영 env엔 넣지 않는다
> 🔴 **유저 id 접근은 `req.user.userId` — `req.user._id`가 아니다.** 페이로드 키가 `userId`라
> `_id`로 읽으면 조용히 `undefined`가 흘러간다(예외가 안 남). Mongoose 문서 습관 때문에 틀리기 쉬움.
> 로그인 5경로(`server/api/user.js`의 일반/구글웹/카카오웹/구글앱/카카오앱) 전부 `userId: user._id`로 발급하고,
> 기존 라우터도 전부 `req.user.userId`를 쓴다(`playlist.js:9`, `videoPlaylist.js:9`, `user.js:77`).
> **실제 사고 사례**: `_id`로 읽었다가 ① upsert가 user 없는 고아 문서를 200 OK로 생성하고
> ② `find({user: undefined})`가 그 고아들을 매칭해 **사용자 간 좋아요 유출**이 발생했다
> (배포 전 발견, 상세는 `WORK_LOG.md` 2026-07-15).

## 서버 인증 미들웨어 (server/middleware/auth.js)

### 주요 exports
- `generateToken(payload, expiresIn)` — JWT 발급 (기본 30일)
- `generateStateToken()` — OAuth CSRF용 단기 JWT (5분)
- `verifyStateToken(token)` — OAuth state 검증
- `jwtCheckMiddleware` — 전역 인증 미들웨어
- `adminMiddleware` — 관리자 권한 체크

### jwtCheckMiddleware (모든 /api 요청에 적용)
1. 토큰 없음 → publicPaths만 허용, 나머지 401
2. 토큰 있음 → jwt.verify() → `req.user`에 디코딩된 페이로드 세팅
3. 토큰 있음 + publicPaths 접근 → `/` 리다이렉트
4. 관리자 아님 → expiryDate 체크 → **토큰상 만료면 DB를 한 번 더 본다**(만료 재확인) → DB도 만료면 403 (requireSubscription: true)
   - 정상 사용자는 DB 조회 0회(실측 로컬→Atlas 1회 ≈ 41ms라 매 요청 조회는 안 함)
   - 웹·옛 앱(30일 토큰)이 연장 후 재로그인 없이 풀리는 유일한 경로
5. `/users/logout`은 만료여도 허용

### publicPaths (토큰 없이 접근 가능)
- `/users/login`, `/users/register`
- `/users/google`, `/users/google/callback`
- `/users/kakao`, `/users/kakao/callback`
- `/users/refresh` (리프레시 토큰은 본문으로)
- `/send-slack-message`

### adminMiddleware
- `req.user.isAdmin === true` 확인

## 구독(사용기간) 모델
- `User.expiryDate`: 만료 일시
- 첫 가입: 24시간 무료
- 관리자가 `/api/admin/users/:userId/access`로 기간 연장
- `days: 'unlimited'` → 1000년 추가
- 관리자(isAdmin)는 만료 체크 안 함

## 클라이언트 인증

### 토큰 저장
- `localStorage.setItem('dibe2_token', token)`
- `$axios.setToken(token, 'Bearer')` — 모든 요청에 Authorization 헤더 자동 추가

### 로그인 플로우
1. 일반 로그인: POST /api/users/login → 응답 body에 `token` 포함 → localStorage 저장 (현재 UI에서는 진입 경로 없음, 엔드포인트만 존재)
2. OAuth 로그인: 서버에서 쿠키(`dibe2_oauth_token`, maxAge 5분)로 토큰 전달 → 리다이렉트 → `plugins/auth-init.js`에서 쿠키 수신 → localStorage 저장 (현재 실제 로그인 경로는 이것뿐)

### 앱 초기화 (plugins/auth-init.js)
1. 쿠키에 `dibe2_oauth_token` 있으면 → localStorage 저장 + 쿠키 삭제
2. localStorage에 토큰 있으면 → axios 헤더 세팅 → GET /api/users/me 호출 → store 복원
3. 401 응답 시에만 → localStorage 정리 (네트워크 에러 등은 토큰 유지)

### Axios 401 인터셉터 (plugins/axios-interceptor.js)
- 모든 API 응답에서 401 감지 시 → 토큰 삭제 + /login 리다이렉트
- 네트워크 에러, 타임아웃 등에서는 토큰 삭제하지 않음

### 클라이언트 라우터 미들웨어 (middleware/auth.js)
- Nuxt router middleware로 전 페이지에 적용
- 서버 미들웨어와 별도로 클라이언트에서도 라우팅 가드
- OAuth 리다이렉트 후 URL 정리: `?state`, `?code` 등 쿼리 파라미터 감지 시 클린 리다이렉트

## OAuth State (CSRF 방지)
- 세션 대신 짧은 만료(5분) JWT로 state 생성
- 콜백에서 `verifyStateToken(state)`로 검증
