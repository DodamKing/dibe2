const express = require('express')
// require('dotenv').config()
require('../models')
const { sessionCheckMiddleware } = require('../middleware/auth')
const axios = require('axios')
const cors = require('cors')

const app = express()

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.use(sessionCheckMiddleware)
app.use(cors({
    credentials: true
}))

const userRoutes = require('./user')
const songRoutes = require('./song')
const playlistRoutes = require('./playlist')

app.use('/users', userRoutes)
app.use('/songs', songRoutes)
app.use('/playlists', playlistRoutes)

app.post('/send-slack-message', async (req, res) =>{
    const { message } = req.body

    if (process.env.NODE_ENV === 'development') {
        console.error('개발이라 슬랙 메시지 보내지 않음: ', message)
        return res.json({ success: true })
    }

    const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

    try {
        await axios.post(slackWebhookUrl, { text: message })
        res.json({ success: true })
    } catch (err) {
        console.error('Slack 메시지 전송 오류:', err)
        res.status(500).json({ success: false })
    }
})

module.exports  = app

