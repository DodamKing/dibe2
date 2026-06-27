<template>
    <div class="min-h-screen bg-gradient-to-br from-gray-900 to-black text-white flex flex-col">
        <VideoHeader />
        <Nuxt />
    </div>
</template>

<script>
import { mapActions } from 'vuex'
import VideoHeader from '~/components/VideoHeader.vue'

export default {
    components: { VideoHeader },
    methods: {
        ...mapActions('player', ['pause'])
    },
    mounted() {
        // 비디오 페이지 진입 시 음원 일시정지. youtubePlayer.pause()는 init 안 됐어도 무해 가드 있음
        this.pause()
    }
}
</script>

<style>
/* layouts/main.vue와 동일한 모바일 터치 영역 보정 (이 레이아웃은 main.vue와 별도라 거기 정의된 규칙이 적용 안 됨) */
@media (max-width: 640px) {
    button,
    a {
        min-height: 44px;
        min-width: 44px;
    }
}
</style>
