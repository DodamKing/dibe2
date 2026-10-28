const jwt = require('jsonwebtoken')
const db = require('../models')

const JWT_SECRET = process.env.JWT_SECRET || 'dibe2_jwt_secret'

// 앱(리프레시 지원)용 접근 토큰 수명. 관리자가 기간을 줄이거나 끊으면 이 시간 안에 반영된다.
// ACCESS_TOKEN_TTL env는 로컬 검증용(예: '1m') — 운영 env엔 넣지 않는다.
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '1h'
// 리프레시 때마다 새로 발급(슬라이딩)하므로, 이 기간 안에 한 번이라도 앱을 열면 로그인이 유지된다.
const REFRESH_TOKEN_TTL = '90d'

function generateToken(payload, expiresIn = '30d') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn })
}

// 디코딩된 페이로드에서 JWT 예약 필드·권한을 걷어낸 프로필(재서명용 — exp가 남아 있으면 jwt.sign이 거부한다).
function profileOf(payload) {
    const { iat, exp, typ, isAdmin, expiryDate, ...profile } = payload
    return profile
}

// 리프레시 지원 클라이언트(앱)용 토큰 쌍. 로그인 본문에 refresh:true가 올 때만 발급한다
// (웹·옛 앱은 기존 30일 토큰 그대로 — 바꾸면 옛 앱이 1시간마다 로그아웃된다).
// - access: 기존 페이로드 + typ:'access', 짧은 수명
// - refresh: 프로필만 + typ:'refresh'. 권한(isAdmin·expiryDate)은 리프레시 때 DB에서 새로 읽는다
//   (name·picture는 DB에 없고 소셜 로그인 때만 받으므로 refresh 토큰이 들고 다닌다)
function generateTokenPair(profile, user) {
    const token = jwt.sign(
        { ...profile, typ: 'access', isAdmin: user.isAdmin, expiryDate: user.expiryDate },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_TTL }
    )
    const refreshToken = jwt.sign({ ...profile, typ: 'refresh' }, JWT_SECRET, { expiresIn: REFRESH_TOKEN_TTL })
    return { token, refreshToken }
}

function generateStateToken() {
    return jwt.sign({ type: 'oauth_state' }, JWT_SECRET, { expiresIn: '5m' })
}

function verifyStateToken(token) {
    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        return decoded.type === 'oauth_state'
    } catch {
        return false
    }
}

function extractToken(req) {
    const authHeader = req.headers.authorization
    if (authHeader && authHeader.startsWith('Bearer ')) {
        return authHeader.slice(7)
    }
    return null
}

function isExpiredAt(date) {
    const t = date ? new Date(date).getTime() : null
    return !t || t < Date.now()
}

const jwtCheckMiddleware = async (req, res, next) => {
    const publicPaths = ['/users/login', '/users/register', '/users/google', '/users/google/callback', '/users/kakao', '/users/kakao/callback', '/users/refresh', '/send-slack-message']

    const token = extractToken(req)

    // 토큰이 없는 경우
    if (!token) {
        if (publicPaths.includes(req.path)) {
            return next()
        }
        return res.status(401).json({ message: '사용자 인증이 필요합니다.' })
    }

    // 토큰 검증
    try {
        const decoded = jwt.verify(token, JWT_SECRET)
        // 리프레시 토큰은 /users/refresh 본문으로만 쓴다. 헤더로 오면 접근 토큰으로 인정하지 않는다.
        if (decoded.typ === 'refresh') {
            return res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
        }
        req.user = decoded
    } catch (err) {
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
    }

    // 로그인된 사용자가 공개 경로 접근 시
    if (publicPaths.includes(req.path)) {
        return res.redirect('/')
    }

    // 관리자가 아닌 경우 구독 기간 체크
    if (!req.user.isAdmin && isExpiredAt(req.user.expiryDate) && req.path !== '/users/logout') {
        // 토큰 속 만료일은 **발급 시점의 값**이라 관리자가 연장해도 안 바뀐다. 만료로 보일 때만
        // DB를 한 번 더 본다(정상 사용자는 DB 조회 없음). 이게 없으면 연장해도 "다시 확인"이
        // 계속 403이고 재로그인해야만 풀렸다(2026-10-28). 웹·옛 앱(30일 토큰)엔 유일한 구제책이다.
        try {
            const user = await db.User.findById(req.user.userId).select('isAdmin expiryDate').lean()
            if (user && (user.isAdmin || !isExpiredAt(user.expiryDate))) {
                req.user.isAdmin = user.isAdmin
                req.user.expiryDate = user.expiryDate
                return next()
            }
        } catch (err) {
            console.error('만료 재확인 실패:', err)
            return res.status(500).json({ message: '서버 오류가 발생했습니다.' })
        }
        return res.status(403).json({
            message: '사용 기간이 만료되었습니다.',
            requireSubscription: true
        })
    }

    next()
}

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.isAdmin) next()
    else res.status(403).json({ message: '관리자 권한이 필요합니다.' })
}

module.exports = {
    generateToken,
    generateTokenPair,
    profileOf,
    generateStateToken,
    verifyStateToken,
    jwtCheckMiddleware,
    adminMiddleware,
    JWT_SECRET
}
