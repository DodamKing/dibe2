# 인증/권한 구조

## 인증 방식
- **JWT 토큰 기반**: jsonwebtoken (Authorization: Bearer 헤더)
- **소셜 로그인**: Google, Kakao
- 일반 회원가입은 현재 막혀 있음 (register 기능 비활성)

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
만료: 24시간
```

## 서버 인증 미들웨어 (server/middleware/auth.js)

### 주요 exports
- `generateToken(payload, expiresIn)` — JWT 발급 (기본 24시간)
- `generateStateToken()` — OAuth CSRF용 단기 JWT (5분)
- `verifyStateToken(token)` — OAuth state 검증
- `jwtCheckMiddleware` — 전역 인증 미들웨어
- `adminMiddleware` — 관리자 권한 체크

### jwtCheckMiddleware (모든 /api 요청에 적용)
1. 토큰 없음 → publicPaths만 허용, 나머지 401
2. 토큰 있음 → jwt.verify() → `req.user`에 디코딩된 페이로드 세팅
3. 토큰 있음 + publicPaths 접근 → `/` 리다이렉트
4. 관리자 아님 → expiryDate 체크 → 만료 시 403 (requireSubscription: true)
5. `/users/logout`은 만료여도 허용

### publicPaths (토큰 없이 접근 가능)
- `/users/login`, `/users/register`
- `/users/google`, `/users/google/callback`
- `/users/kakao`, `/users/kakao/callback`

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
1. 일반 로그인: POST /api/users/login → 응답 body에 `token` 포함 → localStorage 저장
2. OAuth 로그인: 서버에서 `/?token=xxx`로 리다이렉트 → `plugins/auth-init.js`에서 URL 파라미터 수신 → localStorage 저장

### 앱 초기화 (plugins/auth-init.js)
1. URL에 `?token=` 파라미터 있으면 → localStorage 저장 + URL 정리
2. localStorage에 토큰 있으면 → axios 헤더 세팅 → GET /api/users/me 호출 → store 복원
3. 토큰 만료/무효 시 → localStorage 정리

### 클라이언트 라우터 미들웨어 (middleware/auth.js)
- Nuxt router middleware로 전 페이지에 적용
- 서버 미들웨어와 별도로 클라이언트에서도 라우팅 가드

## OAuth State (CSRF 방지)
- 세션 대신 짧은 만료(5분) JWT로 state 생성
- 콜백에서 `verifyStateToken(state)`로 검증
