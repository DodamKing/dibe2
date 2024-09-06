import Vue from 'vue'
// import axios from 'axios'

export default ({ app }, inject) => {
    // const sendTelegramMessage = async (message) => {
    //     const botToken = ''
    //     const chatId = ''
    //     const telegramApiurl = `https://api.telegram.org/bot${botToken}/sendMessage`

    //     try {
    //         await axios.post(telegramApiurl, {
    //             chat_id: chatId,
    //             text: message
    //         })
    //     } catch (err) {
    //         console.error('텔레그램 메시지 보내기 오류:', err)
    //     }
    // }

    // Vue 전역 에러 핸들러 (클라이언트 측 Vue 컴포넌트 에러 캐치)
    Vue.config.errorHandler = (err, vm, info) => {
        console.error('Vue 에러:', err)
    }

    // 비동기 에러 핸들러 (서버 사이드 렌더링 중 발생하는 에러 캐치)
    app.nuxt.error = (error) => {
        console.error('Nuxt 에러:', error)
        // 기본 Nuxt 에러 페이지로 리다이렉트
        app.context.error(error)
    }

    // Promise rejection 핸들러 (클라이언트 측 비동기 에러 캐치)
    if (process.client) {
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
        })
    }

    // 서버 측 unhandled rejection 핸들러
    if (process.server) {
        process.on('unhandledRejection', (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        })
    }

}