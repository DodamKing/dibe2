const express = require('express')
const { connectDB } = require('../models')
const { sessionCheckMiddleware } = require('../middleware/auth')
const axios = require('axios')

const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
const userRoutes = require('./user')
const songRoutes = require('./song')
const playlistRoutes = require('./playlist')

const app = express()

app.use(async (req, res, next) => {
    await connectDB()
    next()
})

app.set('trust proxy', 1)

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(sessionCheckMiddleware)

app.use('/users', userRoutes)
app.use('/songs', songRoutes)
app.use('/playlists', playlistRoutes)

app.post('/send-slack-message', async (req, res) =>{
    const { message } = req.body

    if (process.env.NODE_ENV === 'development') {
        console.error('개발이라 슬랙 메시지 보내지 않음: ', message)
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

app.use((err, req, res, next) => {
    console.error(err)
    res.status(500).json({ error: '서버 내부 오류 발생' })
})

module.exports  = app

