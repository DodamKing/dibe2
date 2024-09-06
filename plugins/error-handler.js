import Vue from 'vue'
import axios from 'axios'

export default ({ app }, inject) => {
    const sendSlackMessage = async (message) => {
        const slackWebhookUrl = process.env.SLACK_WEBHOOK_URL
        if (!slackWebhookUrl) {
            console.error('Slack Webhook URL이 설정되지 않았습니다.')
            return
        }
        try {
            await axios.post(slackWebhookUrl, { text: message })
        } catch (err) {
            console.error('Slack 메시지 보내기 오류:', err)
        }
    }

    // Vue 전역 에러 핸들러 (클라이언트 측 Vue 컴포넌트 에러 캐치)
    Vue.config.errorHandler = (err, vm, info) => {
        sendSlackMessage(`Vue 에러: ${err.message}\nInfo: ${info}`)
        console.error('Vue 에러:', err)
    }

    // 비동기 에러 핸들러 (서버 사이드 렌더링 중 발생하는 에러 캐치)
    app.nuxt.error = (error) => {
        console.error('Nuxt 에러:', error)
        sendSlackMessage(`Nuxt 에러: ${error.message}`)
        // 기본 Nuxt 에러 페이지로 리다이렉트
        app.context.error(error)
    }

    // Promise rejection 핸들러 (클라이언트 측 비동기 에러 캐치)
    if (process.client) {
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
            sendSlackMessage(`Unhandled Promise Rejection: ${event.reason}`)
        })
    }

    // 서버 측 unhandled rejection 핸들러
    if (process.server) {
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
            sendSlackMessage(`Unhandled Rejection: ${reason}`)
        })
    }

}