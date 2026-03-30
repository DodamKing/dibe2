const express = require('express')
const bcrypt = require('bcrypt')
const db = require('../models')
const { adminMiddleware, generateToken, generateStateToken, verifyStateToken } = require('../middleware/auth')
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
