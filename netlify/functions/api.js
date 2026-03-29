require('dotenv').config()

const serverless = require('serverless-http')
const express = require('express')
const { connectToMongoDB } = require('../../server/models')
const corsMiddleware = require('../../server/middleware/cors')
const { jwtCheckMiddleware, adminMiddleware } = require('../../server/middleware/auth')
const { sendErrorToSlack } = require('../../server/utils/helper')
const axios = require('axios')

const userRoutes = require('../../server/api/user')
const songRoutes = require('../../server/api/song')
const playlistRoutes = require('../../server/api/playlist')
const adminRoutes = require('../../server/api/admin')

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
app.use('/admin', adminMiddleware, adminRoutes)

// Slack 메시지
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

app.post('/send-slack-message', async (req, res) => {
    const { message } = req.body

    if (process.env.NODE_ENV === 'development') {
        console.error('개발 환경, 슬랙 메시지 생략: ', message)
        return res.json({ success: true })
    }

    try {
        await axios.post(slackWebhookUrl, { text: message })
        res.json({ success: true })
    } catch (err) {
        console.error('Slack 메시지 전송 오류:', err)
        res.status(500).json({ success: false })
    }
})

// 에러 핸들러
app.use((err, req, res, _next) => {
    console.error(err)

    if (process.env.NODE_ENV !== 'development') {
        sendErrorToSlack(err, req, {
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
