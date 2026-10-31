<template>
    <!-- 하단 미니 플레이어(2026-11 새 디자인, docs/PLAYER_V2_PLAN.md B).
         진행바: 맨 위 가장자리 꽉 찬 선(유튜브뮤직식). 데스크탑은 마우스를 올리면 두꺼워지고 손잡이가 보인다(모바일은 표시만)
         데스크탑: 왼쪽 커버(누르면 "지금 재생 중")·제목·하트 / 가운데 셔플·이전·재생·다음·반복 / 오른쪽 시간·볼륨·대기열
         모바일: 커버·제목(누르면 "지금 재생 중")·하트·이전·재생·다음 — 셔플·반복·대기열은 "지금 재생 중" 화면에 -->
    <div class="fixed bottom-0 left-0 right-0 bg-surface-1 border-t border-white border-opacity-5">
        <div class="sm:hidden h-0.5 bg-white bg-opacity-10">
            <div class="h-full bg-purple-400 transition-all duration-100 ease-out" :style="{ width: `${progress}%` }"></div>
        </div>

        <!-- 진행바(데스크탑) — 누르기 쉽게 보이는 선(4px)보다 잡는 영역(12px)을 넓게 -->
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
                class="appearance-none w-full h-3 bg-transparent outline-none absolute inset-0 z-10 opacity-0 cursor-pointer"
                @input="onSeekChange">
        </div>

        <div class="relative flex items-center gap-1 sm:gap-4 pl-3 pr-1 sm:px-6 h-[68px] sm:h-20">

            <!-- 곡 정보 -->
            <div class="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 lg:flex-none lg:w-[30%]">
                <template v-if="currentTrack">
                    <!-- 지금 재생 중 화면이 열려 있으면(데스크탑) 커버·제목이 위 큰 화면에 있으니 여기선 숨긴다 -->
                    <button type="button" class="flex items-center gap-3 min-w-0 text-left rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-400"
                        :class="{ 'sm:invisible': nowPlayingOpen }" aria-label="지금 재생 중 화면 열기" @click="$emit('open-now-playing')">
                        <span class="relative w-11 h-11 sm:w-14 sm:h-14 shrink-0 rounded-md overflow-hidden bg-surface-2 block">
                            <CoverImg :src="currentTrack.coverUrl" :video="isVideo" class="w-full h-full" />
                            <span v-if="isLoading" class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50">
                                <Icon name="loader" :size="20" class="animate-spin text-white" />
                            </span>
                            <span v-else class="hidden sm:flex absolute right-1 top-1 w-5 h-5 rounded bg-black bg-opacity-60 items-center justify-center text-white">
                                <Icon name="chevron-up" :size="12" :stroke-width="2.5" />
                            </span>
                        </span>
                        <span class="min-w-0 block">
                            <span class="block font-medium truncate text-white text-sm">{{ currentTrack.title }}</span>
                            <span class="flex items-center gap-1 text-xs text-gray-400 truncate">
                                <Icon v-if="isVideo" name="youtube" :size="13" class="text-red-400" />
                                <span class="truncate">{{ currentTrack.artist }}</span>
                            </span>
                        </span>
                    </button>
                    <!-- 좋아요 — 제목 옆(스포티파이식). 유튜브 곡(테마)은 곡 id가 없어 숨긴다 -->
                    <button v-if="currentTrack._id" type="button"
                        class="ctrl shrink-0" :class="[isLiked ? 'text-purple-400' : 'text-gray-400 hover:text-white', { 'sm:invisible': nowPlayingOpen }]"
                        :aria-label="isLiked ? '좋아요 취소' : '좋아요'" :aria-pressed="isLiked ? 'true' : 'false'"
                        @click.stop="toggleLike">
                        <Icon name="heart" :filled="isLiked" />
                    </button>
                </template>
                <span v-else class="text-gray-400 text-sm truncate">재생할 곡을 선택해주세요</span>
            </div>

            <!-- 가운데: 컨트롤 -->
            <div class="flex items-center justify-center lg:flex-1 shrink-0">
                <div class="flex items-center sm:gap-2">
                    <button class="ctrl desktop-only" aria-label="셔플" :title="shuffleOn ? '셔플 끄기' : '셔플 켜기'" :aria-pressed="shuffleOn ? 'true' : 'false'"
                        :class="shuffleOn ? 'text-purple-400' : 'text-gray-400 hover:text-white'" @click="toggleShuffle">
                        <Icon name="shuffle" />
                    </button>
                    <button class="ctrl text-white disabled:opacity-40" aria-label="이전 곡"
                        :disabled="!currentTrack" @click="playPrevious">
                        <Icon name="skip-back" :size="22" filled />
                    </button>
                    <button
                        class="w-10 h-10 sm:w-11 sm:h-11 sm:mx-1 rounded-full flex items-center justify-center sm:bg-white sm:text-gray-900 text-white hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition-transform focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
                        :aria-label="isPlaying ? '일시정지' : '재생'" :disabled="isLoading || !currentTrack" @click="togglePlay">
                        <Icon :name="isPlaying ? 'pause' : 'play'" :size="isPlaying ? 22 : 20" filled :stroke-width="isPlaying ? 0 : 1.75" />
                    </button>
                    <button class="ctrl text-white disabled:opacity-40" aria-label="다음 곡"
                        :disabled="!currentTrack || !hasNextTrack" @click="playNext">
                        <Icon name="skip-forward" :size="22" filled />
                    </button>
                    <button class="ctrl desktop-only" aria-label="반복 재생" :title="getRepeatTitle"
                        :class="repeatMode !== 'off' ? 'text-purple-400' : 'text-gray-400 hover:text-white'" @click="toggleRepeat">
                        <Icon :name="repeatMode === 'one' ? 'repeat-1' : 'repeat'" />
                    </button>
                </div>
            </div>

            <!-- 오른쪽: 시간·볼륨·대기열 (모바일엔 없음 — "지금 재생 중"에) -->
            <div class="hidden sm:flex items-center justify-end gap-2 shrink-0 lg:w-[30%]">
                <span v-if="currentTrack && duration > 0" class="hidden lg:inline text-xs text-gray-400 tabular-nums whitespace-nowrap mr-2">
                    {{ formatTime(currentTime) }} / {{ formatTime(duration) }}
                </span>
                <div class="hidden md:flex items-center gap-1">
                    <button class="ctrl text-gray-400 hover:text-white" :aria-label="volume === 0 ? '음소거 해제' : '음소거'" @click="toggleMute">
                        <Icon :name="volume === 0 ? 'volume-x' : volume < 50 ? 'volume-1' : 'volume-2'" />
                    </button>
                    <!-- 볼륨 바: 마우스를 올리면 손잡이가 보인다(진행바와 같은 방식) -->
                    <div class="relative w-24 h-4 flex items-center group">
                        <div class="absolute left-0 right-0 bg-white bg-opacity-20 rounded-full h-1"></div>
                        <div class="absolute left-0 bg-white group-hover:bg-purple-400 rounded-full h-1" :style="{ width: `${volume}%` }"></div>
                        <div class="absolute w-3 h-3 rounded-full bg-white shadow opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
                            :style="{ left: `calc(${volume}% - 6px)` }"></div>
                        <input type="range" min="0" max="100" step="1" :value="volume" aria-label="음량"
                            class="w-full appearance-none bg-transparent h-4 focus:outline-none absolute inset-0 opacity-0 cursor-pointer"
                            @input="onVolumeChange">
                    </div>
                </div>
                <button class="ctrl ml-1" :class="queueOpen ? 'text-purple-400 bg-purple-400 bg-opacity-10' : 'text-gray-300 hover:text-white'"
                    :aria-label="queueOpen ? '재생 대기열 닫기' : '재생 대기열'" :aria-pressed="queueOpen ? 'true' : 'false'" @click="$emit('toggle-queue')">
                    <Icon name="list-music" />
                </button>
            </div>
        </div>
    </div>
</template>

<script>
import { mapState, mapActions, mapGetters } from 'vuex'

export default {
    props: {
        queueOpen: { type: Boolean, default: false },
        nowPlayingOpen: { type: Boolean, default: false },
    },
    data() {
        return {
            previousVolume: null,
            isDragging: false,
            dragProgress: 0,
            dragTime: 0,
            timeUpdateInterval: null,
        }
    },
    computed: {
        ...mapState('player', ['currentTrack', 'isPlaying', 'currentTime', 'duration', 'volume', 'shuffleOn', 'repeatMode', 'isLoading', 'isYouTubeReady']),
        ...mapGetters('player', ['hasNextTrack']),
        isVideo() {
            return this.currentTrack && this.currentTrack.kind === 'video'
        },
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
    watch: {
        // 현재 곡의 좋아요 여부를 모르면 물어본다(대기열에 막 넣은 곡 등)
        'currentTrack._id': {
            immediate: true,
            handler(id) {
                if (id) this.$store.dispatch('likes/ensure', [id])
            },
        },
        isYouTubeReady(newValue) {
            if (newValue && this.isPlaying) this.startTimeUpdate()
        },
        isPlaying(newValue) {
            if (newValue) this.startTimeUpdate()
            else this.stopTimeUpdate()
        },
    },
    mounted() {
        this.startTimeUpdate()
    },
    beforeDestroy() {
        this.stopTimeUpdate()
    },
    methods: {
        // playNext 는 버튼 이벤트를 payload 로 받아도 "사용자 조작"으로 본다(store/player.js)
        ...mapActions('player', ['play', 'pause', 'playNext', 'playPrevious', 'seek', 'setVolume', 'toggleShuffle', 'toggleRepeat', 'updateTrackProgress']),

        toggleLike() {
            this.$store.dispatch('likes/toggle', this.currentTrack._id)
        },
        togglePlay() {
            if (!this.isLoading) {
                this.isPlaying ? this.pause() : this.play()
            }
        },
        formatTime(seconds) {
            if (isNaN(seconds) || seconds === null) return '0:00'
            const mins = Math.floor(seconds / 60)
            const secs = Math.floor(seconds % 60)
            return `${mins}:${secs.toString().padStart(2, '0')}`
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
            this.isDragging = true
            this.updateSeekPosition(event)
        },
        updateSeek(event) {
            if (this.isDragging) this.updateSeekPosition(event)
        },
        endSeek() {
            if (this.isDragging) {
                this.isDragging = false
                this.seek(this.dragTime)
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
            this.seek(Number(event.target.value))
        },
        startTimeUpdate() {
            if (this.isYouTubeReady) {
                this.stopTimeUpdate()
                this.timeUpdateInterval = setInterval(() => {
                    this.updateTrackProgress()
                }, 1000)
            }
        },
        stopTimeUpdate() {
            if (this.timeUpdateInterval) {
                clearInterval(this.timeUpdateInterval)
                this.timeUpdateInterval = null
            }
        },
    },
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
.ctrl {
    display: flex;
    width: 40px;
    height: 40px;
    align-items: center;
    justify-content: center;
    border-radius: 9999px;
}
/* 모바일에선 셔플·반복을 숨긴다(공간) — "지금 재생 중" 화면에 있다 */
@media (max-width: 639px) {
    .ctrl.desktop-only { display: none; }
}
</style>
