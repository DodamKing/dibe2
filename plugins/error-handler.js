import Vue, { inject } from 'vue'

export default ({ app }, inject) => {
    // Vue 전역 에러 핸들러 (클라이언트 측 Vue 컴포넌트 에러 캐치)
    Vue.config.errorHandler = async (err, vm, info) => {
        console.error('Vue 에러:', err)
    }

    // 비동기 에러 핸들러 (서버 사이드 렌더링 중 발생하는 에러 캐치)
    app.nuxt.error = async (error) => {
        console.error('Nuxt 에러:', error)
        // 기본 Nuxt 에러 페이지로 리다이렉트
        app.context.error(error)
    }

    // Promise rejection 핸들러 (클라이언트 측 비동기 에러 캐치)
    if (process.client) {
        window.addEventListener('unhandledrejection', async (event) => {
            console.error('Unhandled Promise Rejection:', event.reason);
        })
    }

    // 서버 측 unhandled rejection 핸들러
    if (process.server) {
        process.on('unhandledRejection', async (reason, promise) => {
            console.error('Unhandled Rejection at:', promise, 'reason:', reason);
        })
    }

}