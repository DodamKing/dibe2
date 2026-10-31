<template>
    <!-- 배치만 바꿨다(2026-10-31) — 재생·탐색·드래그 동작 코드와 바인딩은 그대로.
         진행바: 플레이어 맨 위 가장자리, 화면 끝까지(유튜브뮤직식) — 모바일과 같은 자리라 화면 크기가 바뀌어도
         위치가 같고, 길어서 긴 곡도 정확히 찍힌다. 데스크탑은 마우스를 올리면 두꺼워지고 손잡이가 보인다(모바일은 표시만)
         데스크탑: 왼쪽 곡 정보 / 가운데 컨트롤 / 오른쪽 시간·볼륨·재생목록
         모바일: 곡 정보·하트·이전·재생·다음·재생목록 (셔플·반복은 재생목록 패널 위쪽) -->
    <div class="fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-white border-opacity-5">
        <div class="sm:hidden h-0.5 bg-white bg-opacity-10">
            <div class="h-full bg-purple-400 transition-all duration-100 ease-out" :style="{ width: `${progress}%` }"></div>
        </div>

        <!-- Progress Bar (데스크탑) — 핸들러는 예전 그대로. 누르기 쉽게 보이는 선(4px)보다 잡는 영역(12px)을 넓게 -->
        <div class="hidden sm:flex absolute left-0 right-0 -top-1.5 h-3 items-center group z-10"
            @mousedown="startSeek" @mousemove="updateSeek" @mouseup="endSeek" @mouseleave="endSeek"
            @touchstart="startSeek" @touchmove="updateSeek" @touchend="endSeek">
            <div class="absolute left-0 right-0 bg-white bg-opacity-10 h-1 group-hover:h-1.5 transition-all"></div>
            <div class="absolute left-0 bg-purple-400 h-1 group-hover:h-1.5 transition-all duration-100 ease-out"
                :style="{ width: `${progress}%` }"></div>
            <div class="absolute w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                :style="{ left: `calc(${progress}% - 6px)` }"></div>
            <div v-if="isDragging"
                class="absolute bottom-full mb-1 transform -translate-x-1/2 bg-white text-gray-900 px-1.5 py-0.5 rounded text-xs tabular-nums pointer-events-none"
                :style="{ left: `${dragProgress}%` }">
                {{ formatTime(dragTime) }}
            </div>
            <input type="range" min="0" :max="duration" :value="currentTime" aria-label="재생 위치"
                class="appearance-none w-full h-3 bg-transparent outline-none focus:outline-none active:outline-none absolute inset-0 z-10 opacity-0 cursor-pointer"
                @input="onSeekChange">
        </div>

        <div class="relative flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-2 sm:py-3">

            <!-- Track Info -->
            <div class="flex items-center gap-3 min-w-0 flex-1 sm:flex-none sm:w-[25%]">
                <template v-if="currentTrack">
                    <div class="relative w-11 h-11 sm:w-14 sm:h-14 shrink-0" @click="toggleTrackInfo">
                        <img :src="currentTrack.coverUrl" :alt="currentTrack.title"
                            class="w-full h-full object-cover rounded-md">
                        <div v-if="isLoading"
                            class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-md">
                            <div class="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-white"></div>
                        </div>
                    </div>
                    <div class="min-w-0 flex-1 sm:flex-initial">
                        <p class="font-medium truncate text-white text-sm">{{ currentTrack.title }}</p>
                        <p class="text-xs text-gray-400 truncate">{{ currentTrack.artist }}</p>
                    </div>
                    <!-- 좋아요 — 제목 옆(스포티파이식) -->
                    <button v-if="currentTrack._id" type="button"
                        class="shrink-0 w-10 h-10 flex items-center justify-center rounded-full focus:outline-none"
                        :class="isLiked ? 'text-purple-400' : 'text-gray-400 hover:text-white'"
                        :aria-label="isLiked ? '좋아요 취소' : '좋아요'" :aria-pressed="isLiked ? 'true' : 'false'"
                        @click.stop="toggleLike">
                        <i :class="[isLiked ? 'fas' : 'far', 'fa-heart']"></i>
                    </button>
                </template>
                <span v-else class="text-gray-400 text-sm truncate">재생할 곡을 선택해주세요</span>
            </div>

            <!-- 가운데: 컨트롤 -->
            <div class="flex items-center justify-center sm:flex-1 min-w-0">
                <div class="flex items-center gap-1 sm:gap-3">
                    <button class="ctrl desktop-only" aria-label="셔플" :title="shuffleOn ? '셔플 끄기' : '셔플 켜기'"
                        :class="shuffleOn ? 'text-purple-400' : 'text-gray-400 hover:text-white'" @click="toggleShuffle">
                        <i class="fas fa-shuffle"></i>
                    </button>
                    <button class="ctrl text-gray-200 hover:text-white" aria-label="이전 곡"
                        :disabled="!hasPreviousTrack" @click="playPrevious">
                        <i class="fas fa-step-backward text-lg" :class="{ 'opacity-40': !hasPreviousTrack }"></i>
                    </button>
                    <button
                        class="bg-white text-gray-900 rounded-full w-10 h-10 flex items-center justify-center hover:scale-105 transition-transform focus:outline-none focus:ring-2 focus:ring-white focus:ring-opacity-50"
                        aria-label="재생/일시정지" :disabled="isLoading" @click="togglePlay">
                        <i :class="['fas', isPlaying ? 'fa-pause' : 'fa-play', isPlaying ? '' : 'ml-0.5']"></i>
                    </button>
                    <button class="ctrl text-gray-200 hover:text-white" aria-label="다음 곡"
                        :disabled="!hasNextTrack" @click="playNext">
                        <i class="fas fa-step-forward text-lg" :class="{ 'opacity-40': !hasNextTrack }"></i>
                    </button>
                    <button class="ctrl desktop-only relative" aria-label="반복 재생" :title="getRepeatTitle"
                        :class="repeatMode !== 'off' ? 'text-purple-400' : 'text-gray-400 hover:text-white'" @click="toggleRepeat">
                        <i class="fas fa-repeat"></i>
                        <span v-if="repeatMode === 'one'" class="absolute top-1 right-1 text-[10px] font-bold leading-none">1</span>
                    </button>
                </div>
            </div>

            <!-- 오른쪽: 시간·볼륨·재생목록 -->
            <div class="flex items-center justify-end gap-2 sm:w-[25%]">
                <span v-if="currentTrack" class="hidden sm:inline text-xs text-gray-400 tabular-nums whitespace-nowrap mr-1">
                    {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
                </span>
                <div class="hidden md:flex items-center gap-2">
                    <button class="ctrl text-gray-400 hover:text-white" aria-label="음소거" @click="toggleMute">
                        <i :class="['fas', volume === 0 ? 'fa-volume-mute' : volume < 50 ? 'fa-volume-down' : 'fa-volume-up']"></i>
                    </button>
                    <div class="relative w-24 h-3 flex items-center group">
                        <div class="absolute left-0 right-0 bg-white bg-opacity-20 rounded-full h-1"></div>
                        <div class="absolute left-0 bg-white group-hover:bg-purple-400 rounded-full h-1" :style="{ width: `${volume}%` }"></div>
                        <input type="range" min="0" max="100" step="1" :value="volume" aria-label="음량"
                            class="w-full appearance-none bg-transparent h-3 focus:outline-none absolute inset-0 opacity-0"
                            @input="onVolumeChange">
                    </div>
                </div>
                <button class="ctrl text-gray-300 hover:text-white" aria-label="재생 목록" @click="$emit('toggle-queue')">
                    <i class="fas fa-list"></i>
                </button>
            </div>

            <!-- Mobile Track Info Overlay (긴 제목 확인용) -->
            <div v-if="showTrackInfo && currentTrack"
                class="absolute bottom-full left-2 mb-2 bg-surface-2 text-white p-2 rounded-lg shadow-lg sm:hidden"
                style="width: 220px;">
                <p class="text-sm font-medium break-words">{{ currentTrack.title }}</p>
                <p class="text-xs text-gray-300 mt-1 break-words">{{ currentTrack.artist }}</p>
            </div>
        </div>
    </div>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex'

export default {
    computed: {
        ...mapState('player', ['currentTrack', 'isPlaying', 'currentTime', 'duration', 'volume', 'shuffleOn', 'repeatMode', 'isLoading', 'isYouTubeReady']),
        ...mapGetters('player', ['hasPreviousTrack', 'hasNextTrack']),
        isLiked() {
            return this.$store.getters['likes/isLiked'](this.currentTrack && this.currentTrack._id)
        },
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

        toggleLike() {
            this.$store.dispatch('likes/toggle', this.currentTrack._id)
        },

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

        toggleTrackInfo() {
            this.showTrackInfo = !this.showTrackInfo;
            if (this.showTrackInfo) {
                setTimeout(() => {
                    this.showTrackInfo = false;
                }, 5000); // 5초 후 자동으로 닫힘
            }
        },
    },

    data() {
        return {
            previousVolume: null,
            isDragging: false,
            dragProgress: 0,
            dragTime: 0,
            timeUpdateInterval: null,
            showTrackInfo: false,
        }
    },

    mounted() {
        this.startTimeUpdate()
    },

    beforeDestroy() {
        this.stopTimeUpdate()
    },

    watch: {
        // 현재 곡의 좋아요 여부를 모르면 물어본다(재생목록에 막 넣은 곡 등)
        'currentTrack._id': {
            immediate: true,
            handler(id) {
                if (id) this.$store.dispatch('likes/ensure', [id])
            },
        },
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
        },
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

.ctrl {
    display: flex;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
}
/* 모바일에선 셔플·이전·반복을 숨긴다(공간) */
@media (max-width: 639px) {
    .ctrl.desktop-only { display: none; }
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

.overflow-ellipsis {
    text-overflow: ellipsis;
    overflow: hidden;
}
</style>