const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET || 'dibe2_jwt_secret'

function generateToken(payload, expiresIn = '24h') {
    return jwt.sign(payload, JWT_SECRET, { expiresIn })
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

const jwtCheckMiddleware = (req, res, next) => {
    const publicPaths = ['/users/login', '/users/register', '/users/google', '/users/google/callback', '/users/kakao', '/users/kakao/callback', '/send-slack-message']

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
        req.user = decoded
    } catch (err) {
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
    }

    // 로그인된 사용자가 공개 경로 접근 시
    if (publicPaths.includes(req.path)) {
        return res.redirect('/')
    }

    // 관리자가 아닌 경우 구독 기간 체크
    if (!req.user.isAdmin) {
        const expiryTimestamp = req.user.expiryDate ? new Date(req.user.expiryDate).getTime() : null
        const isExpired = !expiryTimestamp || expiryTimestamp < Date.now()

        if (isExpired && req.path !== '/users/logout') {
            return res.status(403).json({
                message: '사용 기간이 만료되었습니다.',
                requireSubscription: true
            })
        }
    }

    next()
}

const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.isAdmin) next()
    else res.status(403).json({ message: '관리자 권한이 필요합니다.' })
}

module.exports = {
    generateToken,
    generateStateToken,
    verifyStateToken,
    jwtCheckMiddleware,
    adminMiddleware,
    JWT_SECRET
}
