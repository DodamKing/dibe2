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
