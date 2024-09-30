const createError = require('http-errors')
const express = require('express')
const { sessionCheckMiddleware, isAdmin } = require('../middleware/auth')
const axios = require('axios')
const { sendErrorToSlack } = require('../utils/helper')

const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
const userRoutes = require('./user')
const songRoutes = require('./song')
const playlistRoutes = require('./playlist')
const adminRoutes = require('./admin')

const app = express()

app.set('trust proxy', 1)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(sessionCheckMiddleware)

app.use('/users', userRoutes)
app.use('/songs', songRoutes)
app.use('/playlists', playlistRoutes)
app.use('/admin',  adminRoutes)
// app.use('/admin', isAdmin, adminRoutes)

app.post('/send-slack-message', async (req, res) =>{
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

module.exports  = app

