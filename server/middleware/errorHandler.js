const axios = require('axios')
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

async function sendSlackMessage(message) {
    try {
        await axios.post(slackWebhookUrl, { text: message })
    } catch (err) {
        console.error('Slack 메시지 전송 실패:', err)
    }
}

module.exports = async function (req, res, next) {
    try {
        await next()
    } catch (err) {
        console.error('서버 에러:', err)

        const errorDetails = {
            message: err.message,
            name: err.name,
            path: req.path,
            method: req.method,
            timestamp: new Date().toISOString()
        }

        if (process.env.NODE_ENV === 'development') errorDetails.stack = err.stack

        await sendSlackMessage(`처리되지 않은 서버 에러:\n${JSON.stringify(errorDetails, null, 2)}`)

        res.status(500).json({ message: '서버 내부 오류가 발생했습니다. 잠시 후 다시 시도해주세요.'})
    }
}