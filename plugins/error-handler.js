import Vue from 'vue'
import axios from 'axios'

export default ({ app }, inject) => {
    let isSendingError = false

    // 어디서(운영 도메인인지 localhost 인지·어느 페이지) 났는지와 스택 첫 줄들을 붙인다 —
    // 메시지만으로는 운영/개발도, 원인 코드도 구분이 안 됐다(2026-10-31)
    const withContext = (message, err) => {
        const where = typeof location !== 'undefined' ? `${location.host}${location.pathname}` : 'unknown'
        const stack = err && err.stack ? '\n' + String(err.stack).split('\n').slice(0, 4).join('\n') : ''
        return `[${where}] ${message}${stack}`
    }

    const sendErrorMessage = async (message, err) => {
        if (isSendingError) return
        isSendingError = true
        try {
            await axios.post('/api/send-error-message', { message: withContext(message, err) })
        } catch (err) {
            console.error('에러 메시지 보내기 오류:', err)
        } finally {
            isSendingError = false
        }
    }

    // Vue 전역 에러 핸들러 (클라이언트 측 Vue 컴포넌트 에러 캐치)
    Vue.config.errorHandler = (err, vm, info) => {
        sendErrorMessage(`Vue 에러: ${err && err.message}\nInfo: ${info}`, err)
        console.error('Vue 에러:', err)
    }

    // 비동기 에러 핸들러 (서버 사이드 렌더링 중 발생하는 에러 캐치)
    app.nuxt.error = (error) => {
        console.error('Nuxt 에러:', error)
        sendErrorMessage(`Nuxt 에러: ${error && error.message}`, error)
        // 기본 Nuxt 에러 페이지로 리다이렉트
        app.context.error(error)
    }

    // Promise rejection 핸들러 (클라이언트 측 비동기 에러 캐치)
    if (process.client) {
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
            sendErrorMessage(`클라이언트 Unhandled Promise Rejection: ${event.reason}`, event.reason)
        })
    }
}
