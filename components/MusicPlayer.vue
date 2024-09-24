<template>
    <div class="fixed bottom-0 left-0 right-0 bg-gradient-to-r from-purple-800 to-blue-700 shadow-lg">
        <div class="container mx-auto px-4 py-2">
            <div class="flex flex-row items-center justify-between h-14 sm:h-12">
                <!-- Track Info -->
                <div class="flex items-center w-1/3 sm:w-1/4 h-full">
                    <div v-if="currentTrack" class="flex items-center w-full h-full">
                        <div class="relative w-10 h-10 sm:w-12 sm:h-12 mr-2 sm:mr-3 flex-shrink-0">
                            <img :src="currentTrack.coverUrl" :alt="currentTrack.title"
                                class="w-full h-full object-cover rounded-lg">
                            <div v-if="isLoading"
                                class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg">
                                <div
                                    class="animate-spin rounded-full h-4 w-4 sm:h-6 sm:w-6 border-t-2 border-b-2 border-white">
                                </div>
                            </div>
                        </div>
                        <div class="mr-2 sm:mr-3 truncate hidden sm:block">
                            <p class="font-medium truncate text-white text-sm sm:text-base">{{ currentTrack.title }}</p>
                            <p class="text-xs sm:text-sm text-gray-200 truncate">{{ currentTrack.artist }}</p>
                        </div>
                    </div>
                    <div v-else class="flex items-center w-full h-full text-white text-sm sm:text-base">
                        재생할 곡을 선택해주세요
                    </div>
                </div>

                <!-- Playback Controls -->
                <div class="flex items-center justify-center space-x-2 sm:space-x-4 w-1/3 sm:w-1/2">
                    <button class="text-gray-200 hover:text-white focus:outline-none" aria-label="반복 재생"
                        @click="toggleRepeat" :title="getRepeatTitle">
                        <i :class="['fas', repeatModeIcon, { 'text-red': repeatMode !== 'off' }]"></i>
                    </button>
                    <button class="text-gray-200 hover:text-white focus:outline-none" aria-label="이전 곡"
                        @click="playPrevious" :disabled="!hasPreviousTrack">
                        <i class="fas fa-step-backward text-lg sm:text-xl"
                            :class="{ 'opacity-50': !hasPreviousTrack }"></i>
                    </button>
                    <button
                        class="bg-white text-purple-800 rounded-full w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                        aria-label="재생/일시정지" @click="togglePlay" :disabled="isLoading">
                        <i
                            :class="['fas', isPlaying ? 'fa-pause' : 'fa-play', 'text-base sm:text-lg', isPlaying ? '' : 'ml-0.5']"></i>
                    </button>
                    <button class="text-gray-200 hover:text-white focus:outline-none" aria-label="다음 곡"
                        @click="playNext" :disabled="!hasNextTrack">
                        <i class="fas fa-step-forward text-lg sm:text-xl" :class="{ 'opacity-50': !hasNextTrack }"></i>
                    </button>
                    <button class="text-gray-200 hover:text-white focus:outline-none" aria-label="셔플"
                        @click="toggleShuffle" :title="shuffleOn ? '셔플 끄기' : '셔플 켜기'">
                        <i :class="['fas', 'fa-shuffle', { 'text-red': shuffleOn }]"></i>
                    </button>
                </div>

                <!-- Additional Controls -->
                <div class="flex items-center justify-end space-x-2 sm:space-x-4 w-1/3 sm:w-1/4">
                    <div class="hidden sm:flex items-center space-x-1">
                        <button class="text-gray-200 hover:text-white focus:outline-none" @click="toggleMute">
                            <i
                                :class="['fas', volume === 0 ? 'fa-volume-mute' : volume < 50 ? 'fa-volume-down' : 'fa-volume-up', 'text-lg']"></i>
                        </button>
                        <div class="relative w-20 h-1">
                            <div class="absolute inset-y-0 left-0 bg-gray-600 bg-opacity-50 rounded-full w-full h-1">
                            </div>
                            <div class="absolute inset-y-0 left-0 bg-white rounded-full h-1"
                                :style="{ width: `${volume}%` }"></div>
                            <input type="range" min="0" max="100" step="1" :value="volume" @input="onVolumeChange"
                                class="w-full appearance-none bg-transparent h-1 rounded-full focus:outline-none absolute inset-0 opacity-0">
                        </div>
                    </div>
                    <button class="text-gray-200 hover:text-white focus:outline-none" aria-label="재생 목록"
                        @click="$emit('toggle-queue')">
                        <i class="fas fa-list text-lg"></i>
                    </button>
                </div>
            </div>
            <div class="mt-1 flex items-center space-x-2 text-xs text-gray-200">
                <span class="w-8 text-right">{{ formatTime(currentTime) }}</span>
                <div class="flex-1 relative group" @mousedown="startSeek" @mousemove="updateSeek" @mouseup="endSeek"
                    @mouseleave="endSeek" @touchstart="startSeek" @touchmove="updateSeek" @touchend="endSeek">
                    <div
                        class="absolute inset-y-0 left-0 bg-gray-600 bg-opacity-50 rounded-full w-full h-1 group-hover:h-2 transition-all duration-200">
                    </div>
                    <div class="absolute inset-y-0 left-0 bg-white rounded-full transition-all duration-100 ease-out h-1 group-hover:h-2"
                        :style="{ width: `${progress}%` }"></div>
                    <div v-if="isDragging"
                        class="absolute top-0 transform -translate-y-full bg-white text-purple-800 px-1 py-0.5 rounded text-xs"
                        :style="{ left: `${dragProgress}%` }">
                        {{ formatTime(dragTime) }}
                    </div>
                    <input type="range" min="0" :max="duration" :value="currentTime" @input="onSeekChange"
                        class="appearance-none w-full h-1 group-hover:h-2 bg-transparent rounded-full outline-none focus:outline-none active:outline-none absolute inset-0 z-10 opacity-0 cursor-pointer">
                </div>
                <span class="w-8">{{ formatTime(duration) }}</span>
            </div>
        </div>
        <div v-if="isLoading" class="absolute bottom-0 left-0 w-full h-0.5 bg-white animate-pulse"></div>
        <!-- <div id="youtube-player" class="hidden"></div> -->
    </div>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex'

export default {
    computed: {
        ...mapState('player', ['currentTrack', 'isPlaying', 'currentTime', 'duration', 'volume', 'shuffleOn', 'repeatMode', 'isLoading', 'isYouTubeReady']),
        ...mapGetters('player', ['hasPreviousTrack', 'hasNextTrack', 'repeatModeIcon']),
        progress() {
            return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0
        },
        getRepeatTitle() {
            switch (this.repeatMode) {
                case 'off': return '반복 없음'
                case 'all': return '전체 반복'
                case 'one': return '한 곡 반복'
                default: return '반복 모드'
            }
        }
    },
    methods: {
        ...mapActions('player', ['play', 'pause', 'playNext', 'playPrevious', 'seek', 'setVolume', 'toggleShuffle', 'toggleRepeat', 'initYoutubePlayer', 'updateTrackProgress']),

        togglePlay() {
            if (!this.isLoading) {
                this.isPlaying ? this.pause() : this.play()
            }
        },

        formatTime(seconds) {
            if (isNaN(seconds) || seconds === null) return '00:00'
            const mins = Math.floor(seconds / 60)
            const secs = Math.floor(seconds % 60)
            return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
        },

        onVolumeChange(event) {
            this.setVolume(Number(event.target.value))
        },

        toggleMute() {
            if (this.volume > 0) {
                this.previousVolume = this.volume
                this.setVolume(0)
            } else {
                this.setVolume(this.previousVolume || 50)
            }
        },

        startSeek(event) {
            this.isDragging = true;
            this.updateSeekPosition(event);
        },

        updateSeek(event) {
            if (this.isDragging) {
                this.updateSeekPosition(event);
            }
        },

        endSeek() {
            if (this.isDragging) {
                this.isDragging = false;
                this.seek(this.dragTime);
            }
        },

        updateSeekPosition(event) {
            const rect = event.target.getBoundingClientRect()
            const clientX = event.touches ? event.touches[0].clientX : event.clientX
            const x = clientX - rect.left
            this.dragProgress = (x / rect.width) * 100
            this.dragTime = (this.dragProgress / 100) * this.duration
        },

        onSeekChange(event) {
            this.seek(Number(event.target.value));
        },

        initYoutubePlayer() {
            this.$store.dispatch('player/initYoutubePlayer');
        },

        startTimeUpdate() {
            if (this.isYouTubeReady) {
                this.stopTimeUpdate();
                this.timeUpdateInterval = setInterval(() => {
                    this.updateTrackProgress()
                }, 1000)
            }
        },

        stopTimeUpdate() {
            if (this.timeUpdateInterval) {
                clearInterval(this.timeUpdateInterval);
                this.timeUpdateInterval = null;
            }
        },
    },

    data() {
        return {
            previousVolume: null,
            isDragging: false,
            dragProgress: 0,
            dragTime: 0,
            timeUpdateInterval: null
        }
    },

    mounted() {
        this.initYoutubePlayer();
        this.startTimeUpdate()
    },

    beforeDestroy() {
        this.stopTimeUpdate()
    },

    watch: {
        // currentTrack() {
        //     this.$store.commit('player/SET_CURRENT_TIME', 0)
        //     this.$store.commit('player/SET_DURATION', 0)
        // },
        isYouTubeReady(newValue) {
            if (newValue && this.isPlaying) {
                this.startTimeUpdate();
            }
        },
        isPlaying(newValue) {
            if (newValue) {
                this.startTimeUpdate()
            } else {
                this.stopTimeUpdate()
            }
        }
    }
}
</script>

<style scoped>
input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
}

input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 0;
    height: 0;
}

input[type="range"]::-moz-range-thumb {
    width: 0;
    height: 0;
    border: 0;
}

input[type="range"]:focus {
    outline: none;
}

input[type="range"]::-ms-track {
    width: 100%;
    cursor: pointer;
    background: transparent;
    border-color: transparent;
    color: transparent;
}

.animate-spin {
    animation: spin 1s linear infinite;
}

@keyframes spin {
    from {
        transform: rotate(0deg);
    }

    to {
        transform: rotate(360deg);
    }
}

.animate-pulse {
    animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

@keyframes pulse {

    0%,
    100% {
        opacity: 1;
    }

    50% {
        opacity: .5;
    }
}

.group:hover input[type="range"] {
    height: 0.5rem;
}

@media (max-width: 640px) {
    .container {
        padding-left: 0.5rem;
        padding-right: 0.5rem;
    }
}

.text-red {
    color: red;
}
</style>