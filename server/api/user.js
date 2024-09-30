const express = require('express')
const bcrypt = require('bcrypt')
const db = require('../models')
const { isNotAuthenticated } = require('../middleware/auth')
const axios = require('axios')
const UserService = require('../services/userService')

const router = express.Router()

router.get('/test', (req, res, next) => {
    res.json({ message: 'test' })
})

router.post('/register', isNotAuthenticated, async (req, res) => {
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

router.post('/login', isNotAuthenticated, async (req, res) => {
    try {
        const { email, password } = req.body
        const user = await db.User.findOne({ email })

        if (!user) return res.json({ message: '사용자를 찾을 수 없습니다.', code: 2 })

        const isMatch = await bcrypt.compare(password, user.password)
        if (!isMatch) return res.json({ message: '비밀번호가 일치하지 않습니다.', code: 3 })

        const sessionUser = {
            userId: user._id,
            username: user.username,
            email: user.email
        }

        req.session.user = sessionUser
        res.json({ message: '로그인 성공', user: { userId: user._id, username: user.username, email: user.email }, code: 1 })
    } catch (err) {
        console.error('로그인 에러', err)
        res.status(500).json({ message: '서버 오류가 발생했습니다.', code: 4 })
    }
})

router.post('/logout', async (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) return res.status(500).json({ message: '세션 처리 중 오류 발생' })
                res.clearCookie('dibe2_session_cookie')
            res.json({ message: '로그아웃 되었습니다.' })
        })
    } catch (error) {
        console.error('로그아웃 에러:', error)
        res.status(500).json({ message: '로그아웃 처리 중 오류 발생'})
    }
})

router.get('/me', (req, res) => {
    const user = req.session.user
    if (!user) return res.status(401).json({ user: null })
    res.json({ user })
})

router.get('/google', async (req, res) => {
    const state = UserService.generateState()
    req.session.oauthState = state
    const authUrl = UserService.getGoogleAuthUrl(state)
    res.redirect(authUrl)
})

router.get('/google/callback', async (req, res) => {
    const { code, state } = req.query
    const provider = 'google'

    if (state !== req.session.oauthState) {
        console.error('Invalid state parameter')
        return res.status(400).redirect('/login?error=invalid_state')
    }

    try {
        const tokens = await UserService.getGoogleTokens(code)
        const userInfo = await UserService.getGoogleUserInfo(tokens.access_token)
        const user = await UserService.findOrCreateUser(provider, userInfo.id)

        req.session.user = {
            userId: user._id,
            provider,
            providerId: userInfo.id,
            email: userInfo.email,
            name: userInfo.name,
            picture: userInfo.picture,
            accessToken: tokens.access_token
        }

        res.redirect('/')

    } catch (error) {
        console.error('Google login error:', error)
        res.redirect('/login?error=google_login_failed')
    }
});

router.get('/kakao', (req, res) => {
    const state = UserService.generateState()
    req.session.oauthState = state
    const authUrl = UserService.getKakaoAuthUrl(state)
    res.redirect(authUrl)
})

router.get('/kakao/callback', async (req, res) => {
    const { code, state } = req.query
    const provider = 'kakao'

    if (state !== req.session.oauthState) {
        console.error('Invalid state parameter')
        return res.status(400).redirect('/login?error=invalid_state')
    }

    try {
        const tokens = await UserService.getKakaoTokens(code)
        const userInfo = await UserService.getKakaoUserInfo(tokens.access_token)
        const user = await UserService.findOrCreateUser(provider, userInfo.id)

        req.session.user = {
            userId: user._id,
            provider,
            providerId: userInfo.id,
            email: userInfo.kakao_account.email,
            name: userInfo.properties.nickname,
            picture: userInfo.properties.profile_image,
            accessToken: tokens.access_token
        }

        res.redirect('/')
    } catch (error) {
        console.error('Kakao login error:', error)
        res.redirect('/login?error=kakao_login_failed')
    }
})

module.exports = router