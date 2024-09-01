<template>
    <div class="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-800 to-blue-700 shadow-lg">
        <div class="container mx-auto px-4 py-2">
            <div class="flex items-center justify-between">
                <div v-if="currentTrack" class="flex items-center flex-1">
                    <img :src="currentTrack.coverUrl" :alt="currentTrack.title"
                        class="w-14 h-14 object-cover rounded-lg mr-3">
                    <div class="mr-3">
                        <p class="font-medium truncate text-white">{{ currentTrack.title }}</p>
                        <p class="text-sm text-gray-200 truncate">{{ currentTrack.artist }}</p>
                    </div>
                </div>
                <div v-else class="flex items-center flex-1">
                    재생할 곡을 선택해주세요
                </div>
                <div class="flex items-center space-x-4">
                    <button class="text-gray-200 hover:text-white focus:outline-none" aria-label="이전 곡"
                        @click="playPrevious" :disabled="!hasPreviousTrack">
                        <i class="fas fa-step-backward text-xl" :class="{ 'opacity-50': !hasPreviousTrack }"></i>
                    </button>
                    <button
                        class="bg-white text-purple-800 rounded-full w-12 h-12 flex items-center justify-center hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                        aria-label="재생/일시정지" @click="togglePlay">
                        <i :class="['fas', isPlaying ? 'fa-pause' : 'fa-play', 'text-xl', isPlaying ? '' : 'ml-1']"></i>
                    </button>
                    <button class="text-gray-200 hover:text-white focus:outline-none" aria-label="다음 곡" 
                        @click="playNext" :disabled="!hasNextTrack">
                        <i class="fas fa-step-forward text-xl" :class="{ 'opacity-50': !hasNextTrack }"></i>
                    </button>
                    <button class="text-gray-200 hover:text-white focus:outline-none" aria-label="재생 목록"
                        @click="$emit('toggle-queue')">
                        <i class="fas fa-list text-xl"></i>
                    </button>
                </div>
            </div>
            <!-- <div class="mt-2 flex items-center space-x-2 text-sm text-gray-200">
                <span>{{ formatTime(currentTime) }}</span>
                <div class="flex-1 bg-gray-600 bg-opacity-50 rounded-full h-1">
                    <div class="bg-white h-1 rounded-full" :style="{ width: `${progress}%` }"></div>
                </div>
                <span>{{ formatTime(duration) }}</span>
            </div> -->
            <div class="mt-2 flex items-center space-x-2 text-sm text-gray-200">
                <span>{{ formatTime(currentTime) }}</span>
                <input type="range" min="0" :max="duration" :value="currentTime" @input="onSeek" 
                    class="flex-1 appearance-none bg-gray-600 bg-opacity-50 h-1 rounded-full">
                <span>{{ formatTime(duration) }}</span>
            </div>
            <!-- <div class="mt-2 flex items-center space-x-2 text-sm text-gray-200">
                <i class="fas fa-volume-down"></i>
                <input type="range" min="0" max="1" step="0.01" :value="volume" @input="onVolumeChange" 
                    class="w-24 appearance-none bg-gray-600 bg-opacity-50 h-1 rounded-full">
                <i class="fas fa-volume-up"></i>
            </div> -->
        </div>
    </div>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex'

export default {
    computed: {
        ...mapState('player', ['currentTrack', 'isPlaying', 'queue', 'currentTime', 'duration', 'volume']),
        ...mapGetters('player', ['hasPreviousTrack', 'hasNextTrack']),
        progress() {
            return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0
        }
    },
    methods: {
        ...mapActions('player', ['setCurrentTrack', 'play', 'pause', 'playNext', 'playPrevious', 'seek', 'setVolume']),

        togglePlay() {
            if (this.isPlaying) {
                this.pause()
            } else {
                this.play()
            }
        },

        formatTime(seconds) {
            const mins = Math.floor(seconds / 60)
            const secs = Math.floor(seconds % 60)
            return `${mins}:${secs.toString().padStart(2, '0')}`
        },

        onSeek(event) {
            this.seek(Number(event.target.value))
        },

        onVolumeChange(event) {
            this.setVolume(Number(event.target.value))
        }
    },

    mounted() {
        this.$store.dispatch('player/initAudioPlayer')
    }
}
</script>

<style scoped>
input[type="range"] {
    -webkit-appearance: none;
    background: transparent;
}

input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    margin-top: -6px;
}

input[type="range"]::-moz-range-thumb {
    height: 16px;
    width: 16px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
}
</style>