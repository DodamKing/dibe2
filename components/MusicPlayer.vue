<template>
    <div class="fixed bottom-0 left-0 right-0 bg-gray-900 shadow-lg">
        <div class="container mx-auto px-4 py-2">
            <div class="flex items-center justify-between">
                <div class="flex items-center flex-1">
                    <img :src="currentTrack.albumCover" :alt="currentTrack.title"
                        class="w-14 h-14 object-cover rounded-lg mr-3">
                    <div class="mr-3">
                        <p class="font-medium truncate">{{ currentTrack.title }}</p>
                        <p class="text-sm text-gray-400 truncate">{{ currentTrack.artist }}</p>
                    </div>
                </div>
                <div class="flex items-center space-x-4">
                    <button class="text-gray-400 hover:text-white focus:outline-none" aria-label="이전 곡"
                        @click="previousTrack">
                        <i class="fas fa-step-backward text-xl"></i>
                    </button>
                    <button
                        class="bg-blue-500 text-white rounded-full w-12 h-12 flex items-center justify-center hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
                        aria-label="재생/일시정지" @click="togglePlay">
                        <i :class="['fas', isPlaying ? 'fa-pause' : 'fa-play', 'text-xl']"></i>
                    </button>
                    <button class="text-gray-400 hover:text-white focus:outline-none" aria-label="다음 곡"
                        @click="nextTrack">
                        <i class="fas fa-step-forward text-xl"></i>
                    </button>
                    <button class="text-gray-400 hover:text-white focus:outline-none" aria-label="재생 목록"
                        @click="$emit('toggle-queue')">
                        <i class="fas fa-list text-xl"></i>
                    </button>
                </div>
            </div>
            <div class="mt-2 flex items-center space-x-2 text-sm text-gray-400">
                <span>{{ formatTime(currentTime) }}</span>
                <div class="flex-1 bg-gray-700 rounded-full h-1">
                    <div class="bg-blue-500 h-1 rounded-full" :style="{ width: `${progress}%` }"></div>
                </div>
                <span>{{ formatTime(duration) }}</span>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    props: {
        currentTrack: {
            type: Object,
            required: true
        }
    },
    data() {
        return {
            isPlaying: false,
            currentTime: 0,
            duration: 200, // 예시 값, 실제로는 오디오 파일에서 가져와야 함
        }
    },
    computed: {
        progress() {
            return (this.currentTime / this.duration) * 100
        }
    },
    methods: {
        previousTrack() {
            console.log('Previous track')
        },
        togglePlay() {
            this.isPlaying = !this.isPlaying
            console.log(this.isPlaying ? 'Play' : 'Pause')
        },
        nextTrack() {
            console.log('Next track')
        },
        formatTime(seconds) {
            const mins = Math.floor(seconds / 60)
            const secs = Math.floor(seconds % 60)
            return `${mins}:${secs.toString().padStart(2, '0')}`
        }
    }
}
</script>