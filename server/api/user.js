const express = require('express')
const bcrypt = require('bcrypt')
const db = require('../models')
const jwt = require('jsonwebtoken')
const { adminMiddleware, generateToken, generateTokenPair, profileOf, generateStateToken, verifyStateToken, JWT_SECRET } = require('../middleware/auth')
const UserService = require('../services/userService')

const router = express.Router()

router.get('/test', (req, res, next) => {
    res.json({ message: 'test' })
})

router.get('/', adminMiddleware, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1
        const limit = parseInt(req.query.limit) || 10
        const search = req.query.search || ''
        const result = await UserService.findUser({ search, page, limit })

        res.json(result)
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message })
    }
})

router.post('/register', async (req, res) => {
    try {
        const { username, email, password } = req.body

        const existingUser = await db.User.findOne({ email })
        if (existingUser) return res.status(500).json({ message: '이미 사용 중인 이메일입니다.' })

        const newUser = new db.User({ username, email, password })

        await newUser.save()

        res.status(201).json({ message: '회원가입이 완료되었습니다.' })
    } catch (err) {
        console.error('회원가입 에러:', err)
        res.status(500).json({ message: '서버 오류가 발생했습니다.' })
    }
})

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await db.User.findOne({ email })

        if (!user) return res.json({ message: '사용자를 찾을 수 없습니다.', code: 2 })

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) return res.json({ message: '비밀번호가 일치하지 않습니다.', code: 3 })

        const tokenPayload = {
            userId: user._id,
            username: user.username,
            email: user.email,
            isAdmin: process.env.NODE_ENV === 'development' ? true : user.isAdmin,
            expiryDate: user.expiryDate
        }

        const token = generateToken(tokenPayload)

        res.json({ message: '로그인 성공', user: tokenPayload, token, code: 1 })
    } catch (err) {
        console.error('로그인 에러', err)
        res.status(500).json({ message: '서버 오류가 발생했습니다.', code: 4 })
    }
})

router.post('/logout', async (req, res) => {
    res.json({ message: '로그아웃 되었습니다.' })
})

router.get('/me', async (req, res) => {
    if (!req.user) return res.status(401).json({ user: null })
    const currentUser = await db.User.findById(req.user.userId)
    if (!currentUser) return res.status(401).json({ user: null })
    const userWithExpiry = { ...req.user, expiryDate: currentUser.expiryDate }
    res.json({ user: userWithExpiry })
})

// 네이티브 앱 로그인 응답. 본문에 refresh:true(앱 v1.0.20+)면 짧은 접근 토큰 + 리프레시 토큰,
// 아니면(옛 앱) 기존 30일 토큰. 옛 앱은 refreshToken 필드를 모르고 token만 저장한다.
function nativeLoginResponse(req, tokenPayload, user) {
    if (req.body.refresh === true) {
        const { token, refreshToken } = generateTokenPair(profileOf(tokenPayload), user)
        return { message: '로그인 성공', user: tokenPayload, token, refreshToken, code: 1 }
    }
    return { message: '로그인 성공', user: tokenPayload, token: generateToken(tokenPayload), code: 1 }
}

// 접근 토큰 재발급. 권한(isAdmin·expiryDate)을 **DB에서 새로** 읽어 넣는다 — 관리자가 바꾼 기간이
// 반영되는 지점. 만료된 사용자도 재발급은 해준다(새 토큰으로 요청하면 403 → 앱이 만료 게이트).
// 본문 refreshToken에는 옛 30일 토큰도 받는다: 앱을 업데이트한 직후 로그아웃 없이 넘어오게 하는
// 1회성 교환이다. 옛 토큰이 모두 만료되면(마지막 옛 앱 로그인 + 30일) 이 분기는 지워도 된다.
router.post('/refresh', async (req, res) => {
    const { refreshToken } = req.body
    if (!refreshToken) return res.status(401).json({ message: 'refreshToken이 필요합니다.' })

    let decoded
    try {
        decoded = jwt.verify(refreshToken, JWT_SECRET)
    } catch {
        return res.status(401).json({ message: '로그인이 만료되었습니다.' })
    }
    if (decoded.typ !== 'refresh' && decoded.typ !== undefined) {
        return res.status(401).json({ message: '유효하지 않은 토큰입니다.' })
    }

    try {
        const user = await db.User.findById(decoded.userId).select('isAdmin expiryDate').lean()
        if (!user) return res.status(401).json({ message: '사용자를 찾을 수 없습니다.' })

        const profile = profileOf(decoded)
        const pair = generateTokenPair(profile, user)
        res.json({ ...pair, user: { ...profile, isAdmin: user.isAdmin, expiryDate: user.expiryDate } })
    } catch (error) {
        console.error('토큰 재발급 에러:', error.message)
        res.status(500).json({ message: '서버 오류가 발생했습니다.' })
    }
})

router.get('/google', async (req, res) => {
    const state = generateStateToken()
    const authUrl = UserService.getGoogleAuthUrl(state)
    res.redirect(authUrl)
})

router.get('/google/callback', async (req, res) => {
    const { code, state } = req.query
    const provider = 'google'

    if (!verifyStateToken(state)) {
        console.error('Invalid state parameter')
        return res.status(400).redirect('/login?error=invalid_state')
    }

    try {
        const tokens = await UserService.getGoogleTokens(code)
        const userInfo = await UserService.getGoogleUserInfo(tokens.access_token)
        const user = await UserService.findOrCreateUser(provider, userInfo.id, userInfo.email)

        const tokenPayload = {
            userId: user._id,
            provider,
            providerId: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            isAdmin: user.isAdmin,
            expiryDate: user.expiryDate
        }

        const token = generateToken(tokenPayload)
        res.cookie('dibe2_oauth_token', token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 300 * 1000,
            path: '/'
        })
        res.redirect('/')

    } catch (error) {
        console.error('Google login error:', error)
        res.redirect('/login?error=google_login_failed')
    }
});

router.get('/kakao', (req, res) => {
    const state = generateStateToken()
    const authUrl = UserService.getKakaoAuthUrl(state)
    res.redirect(authUrl)
})

router.get('/kakao/callback', async (req, res) => {
    const { code, state } = req.query
    const provider = 'kakao'

    if (!verifyStateToken(state)) {
        console.error('Invalid state parameter')
        return res.status(400).redirect('/login?error=invalid_state')
    }

    try {
        const tokens = await UserService.getKakaoTokens(code)
        const userInfo = await UserService.getKakaoUserInfo(tokens.access_token)
        const user = await UserService.findOrCreateUser(provider, userInfo.id, userInfo.kakao_account.email)

        const tokenPayload = {
            userId: user._id,
            provider,
            providerId: userInfo.id,
            email: userInfo.kakao_account.email,
            name: userInfo.properties.nickname,
            picture: userInfo.properties.profile_image,
            isAdmin: user.isAdmin,
            expiryDate: user.expiryDate
        }

        const token = generateToken(tokenPayload)
        res.cookie('dibe2_oauth_token', token, {
            httpOnly: false,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'lax',
            maxAge: 300 * 1000,
            path: '/'
        })
        res.redirect('/')
    } catch (error) {
        console.error('Kakao login error:', error)
        res.redirect('/login?error=kakao_login_failed')
    }
})

// 네이티브 앱(구글 SDK)에서 받은 access token으로 로그인 → JWT 발급
// 웹은 리다이렉트(GET /google + /google/callback) 방식, 앱은 이 POST를 사용한다.
router.post('/google', async (req, res) => {
    const provider = 'google'
    try {
        const { accessToken } = req.body
        if (!accessToken) return res.json({ message: 'accessToken이 필요합니다.', code: 4 })

        const userInfo = await UserService.getGoogleUserInfo(accessToken)
        const user = await UserService.findOrCreateUser(provider, userInfo.id, userInfo.email)

        const tokenPayload = {
            userId: user._id,
            provider,
            providerId: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            isAdmin: user.isAdmin,
            expiryDate: user.expiryDate
        }

        res.json(nativeLoginResponse(req, tokenPayload, user))
    } catch (error) {
        console.error('구글 네이티브 로그인 에러:', error?.response?.data || error.message)
        res.json({ message: '구글 로그인에 실패했습니다.', code: 4 })
    }
})

// 네이티브 앱(카카오 SDK)에서 받은 access token으로 로그인 → JWT 발급
router.post('/kakao', async (req, res) => {
    const provider = 'kakao'
    try {
        const { accessToken } = req.body
        if (!accessToken) return res.json({ message: 'accessToken이 필요합니다.', code: 4 })

        const userInfo = await UserService.getKakaoUserInfo(accessToken)
        const email = userInfo.kakao_account?.email
        const user = await UserService.findOrCreateUser(provider, userInfo.id, email)

        const tokenPayload = {
            userId: user._id,
            provider,
            providerId: userInfo.id,
            email,
            name: userInfo.properties?.nickname,
            picture: userInfo.properties?.profile_image,
            isAdmin: user.isAdmin,
            expiryDate: user.expiryDate
        }

        res.json(nativeLoginResponse(req, tokenPayload, user))
    } catch (error) {
        console.error('카카오 네이티브 로그인 에러:', error?.response?.data || error.message)
        res.json({ message: '카카오 로그인에 실패했습니다.', code: 4 })
    }
})

router.patch('/:userId/toggle-admin', adminMiddleware, async (req, res) => {
    try {
        const userId = req.params.userId
        const result = await UserService.toggleAdmin(userId)
        if (!result.success) return res.json({ message: result.message })

        res.json({ message: 'Admin status updated successfully' })
    } catch (error) {
        res.status(500).json({ message: 'Server error', error: error.message })
    }
})

module.exports = router
