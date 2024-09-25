const express = require('express')
const bcrypt = require('bcrypt')
const db = require('../models')
const { isNotAuthenticated } = require('../middleware/auth')

const router = express.Router()

router.get('/test', (req, res) => {
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

router.post('/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) return res.status(500).json({ message: '로그아웃 처리 중 오류 발상' })
        res.json({ message: '로그아웃 되었습니다.' })
    })
})

router.get('/me', (req, res) => {
    const user = req.session.user
    if (!user) return res.status(401).json({ user: null })
    res.json({ user })
})

router.get('/google', async (req, res) => {
    // const redirectUri = encodeURIComponent('http://localhost:3000/api/auth/google/callback')
    // const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${process.env.GOOGLE_CLIENT_ID}&redirect_uri=${redirectUri}&response_type=code&scope=email%20profile`
    // res.redirect(googleAuthUrl);
    const message = '구글 로그인 기능은 아직 구현되지 않았습니다.'
    res.json({ success: false, message })
})

// app.get('/google/callback', async (req, res) => {
//     const code = req.query.code
//     try {
//         // 액세스 토큰 요청
//         const tokenResponse = await axios.post('https://oauth2.googleapis.com/token', {
//             code,
//             client_id: process.env.GOOGLE_CLIENT_ID,
//             client_secret: process.env.GOOGLE_CLIENT_SECRET,
//             redirect_uri: 'http://localhost:3000/api/auth/google/callback',
//             grant_type: 'authorization_code'
//         })

//         const accessToken = tokenResponse.data.access_token

//         // 사용자 정보 요청
//         const userInfoResponse = await axios.get('https://www.googleapis.com/oauth2/v2/userinfo', {
//             headers: { Authorization: `Bearer ${accessToken}` }
//         })

//         const userInfo = userInfoResponse.data

//         // 여기서 userInfo를 사용하여 사용자를 데이터베이스에 저장하거나 조회합니다
//         // const user = await User.findOrCreate({ googleId: userInfo.id, email: userInfo.email });

//         // 세션에 사용자 정보 저장
//         req.session.user = userInfo
//         res.redirect('/') // 로그인 성공 후 리다이렉트할 페이지
//     } catch (error) {
//         console.error('Google login error:', error)
//         res.redirect('/login?error=google_login_failed')
//     }
// });

router.get('/kakao', async (req, res) => {
    const message = '카카오 로그인 기능은 아직 구현되지 않았습니다.'
    res.json({ success: false, message })
})

module.exports = router