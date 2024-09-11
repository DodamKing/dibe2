// utils/slackNotifier.js
import axios from 'axios';
const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL

export async function sendSlackMessage(message) {
    try {
        await axios.post(slackWebhookUrl, { text: message })
        console.log('에러 발생, 슬랙 메시지 전송')
    } catch (error) {
        console.error('슬랙 메시지 전송 실패:', error);
    }
}