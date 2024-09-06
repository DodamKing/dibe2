<template>
    <div>
        <h1>Error Test Page</h1>
        <button @click="triggerAsyncError">Trigger Async Error</button>
        <TestErrorComponent />
    </div>
</template>

<script>
import TestErrorComponent from '@/components/TestErrorComponent.vue'

export default {
    components: {
        TestErrorComponent
    },
    methods: {
        triggerAsyncError() {
            // 비동기 에러 발생
            this.$nextTick(() => {
                throw new Error('This is an async error')
            })
        }
    },
    asyncData() {
        // 서버 사이드 렌더링 에러 시뮬레이션 (주석 해제하여 테스트)
        // if (process.server) {
        //   throw new Error('Server-side error in asyncData')
        // }
        return {}
    }
}
</script>