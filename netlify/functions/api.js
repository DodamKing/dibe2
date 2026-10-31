require('dotenv').config()

const serverless = require('serverless-http')
const express = require('express')
const { connectToMongoDB } = require('../../server/models')
const corsMiddleware = require('../../server/middleware/cors')
const { jwtCheckMiddleware, adminMiddleware } = require('../../server/middleware/auth')
const { sendErrorToDiscord, sendDiscordMessage } = require('../../server/utils/helper')

const userRoutes = require('../../server/api/user')
const songRoutes = require('../../server/api/song')
const playlistRoutes = require('../../server/api/playlist')
const videoPlaylistRoutes = require('../../server/api/videoPlaylist')
const adminRoutes = require('../../server/api/admin')
const youtubeRoutes = require('../../server/api/youtube')
const appRoutes = require('../../server/api/app')
const themeRoutes = require('../../server/api/theme')

const app = express()

app.set('trust proxy', 1)

// 경로 정규화 - netlify dev와 production에서 경로가 다를 수 있음
app.use((req, res, next) => {
    if (req.url.startsWith('/.netlify/functions/api')) {
        req.url = req.url.replace('/.netlify/functions/api', '') || '/'
    } else if (req.url.startsWith('/api')) {
        req.url = req.url.replace('/api', '') || '/'
    }
    next()
})

// 미들웨어
app.use(corsMiddleware)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

// DB 연결 미들웨어
app.use(async (req, res, next) => {
    try {
        await connectToMongoDB()
        next()
    } catch (err) {
        console.error('DB 연결 실패:', err)
        res.status(500).json({ error: 'Database connection error' })
    }
})

// JWT 인증 체크
app.use(jwtCheckMiddleware)

// 라우터
app.use('/users', userRoutes)
app.use('/songs', songRoutes)
app.use('/playlists', playlistRoutes)
app.use('/video-playlists', videoPlaylistRoutes)
app.use('/admin', adminMiddleware, adminRoutes)
app.use('/youtube', youtubeRoutes)
app.use('/app', appRoutes)
app.use('/themes', themeRoutes)

// 클라이언트 에러 → 디스코드
app.post('/send-error-message', async (req, res) => {
    const { message } = req.body

    if (process.env.NODE_ENV === 'development') {
        console.error('개발 환경, 디스코드 메시지 생략: ', message)
        return res.json({ success: true })
    }

    await sendDiscordMessage(`🖥️ 클라이언트 에러\n${message}`)
    res.json({ success: true })
})

// 에러 핸들러
// 응답 전에 알림을 await — 응답이 나가면 함수가 얼어붙어 알림이 사라진다
app.use(async (err, req, res, _next) => {
    console.error(err)

    if (process.env.NODE_ENV !== 'development') {
        await sendErrorToDiscord(err, req, {
            path: req.path,
            method: req.method,
            body: JSON.stringify(req.body),
            params: JSON.stringify(req.params),
            query: JSON.stringify(req.query)
        })
    }

    res.status(err.status || 500).json({ message: err.message || '서버 내부 오류 발생' })
})

module.exports.handler = serverless(app)
