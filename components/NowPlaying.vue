<template>
    <!-- "지금 재생 중" 큰 화면(2026-11). 미니 플레이어의 커버를 누르면 열린다.
         데스크탑: 화면을 덮고 하단 미니 플레이어(컨트롤)는 그대로 남는다 — 왼쪽 큰 커버, 오른쪽 가사/다음 곡 탭
         모바일: 미니 플레이어까지 덮는 전체 화면 — 자체 진행바·컨트롤, 아래 "가사"/"재생 대기열" -->
    <transition name="np">
        <div v-if="show && currentTrack" class="now-playing fixed inset-0 sm:bottom-20 flex flex-col text-white" role="dialog" aria-label="지금 재생 중">
            <!-- 위 막대 -->
            <div class="flex items-center justify-between h-14 sm:h-[72px] px-1 sm:px-6 shrink-0">
                <button type="button" class="icon-btn" aria-label="지금 재생 중 닫기" @click="$emit('close')">
                    <Icon name="chevron-down" :size="26" />
                </button>
                <p class="min-w-0 text-center text-xs sm:text-[13px] text-gray-400 leading-tight">
                    <span class="sm:hidden block">재생 중인 목록</span>
                    <span class="hidden sm:inline">재생 중인 목록 · </span>
                    <span class="text-white font-medium text-[13px] truncate">{{ sourceLabel }}</span>
                </p>
                <span class="w-11"></span>
            </div>

            <!-- ── 데스크탑 ── -->
            <!-- 커버+가사 덩어리를 최대 1200px 로 묶어 가운데에(넓은 화면에서 오른쪽이 휑하게 남던 것) -->
            <div class="hidden sm:flex flex-1 min-h-0 w-full max-w-[1200px] mx-auto gap-10 lg:gap-16 px-8 lg:px-12 pt-4 pb-8">
                <div class="flex flex-col gap-6 shrink-0" :style="{ width: coverSize }">
                    <CoverImg :src="bigCover" :video="isVideo" class="cover rounded-xl" :style="{ width: coverSize, height: coverSize }" />
                    <div class="flex items-center gap-3">
                        <div class="min-w-0 flex-1">
                            <h1 class="text-2xl lg:text-3xl font-bold tracking-tight truncate">{{ currentTrack.title }}</h1>
                            <p class="flex items-center gap-1.5 mt-1 text-base lg:text-lg text-gray-400 truncate">
                                <Icon v-if="isVideo" name="youtube" :size="18" class="text-red-400" />
                                <span class="truncate">{{ currentTrack.artist }}</span>
                            </p>
                        </div>
                        <button v-if="currentTrack._id" type="button" class="icon-btn" :class="isLiked ? 'text-purple-400' : 'text-gray-400 hover:text-white'"
                            :aria-label="isLiked ? '좋아요 취소' : '좋아요'" :aria-pressed="isLiked ? 'true' : 'false'" @click="toggleLike">
                            <Icon name="heart" :size="26" :filled="isLiked" />
                        </button>
                    </div>
                </div>

                <div class="flex-1 min-w-0 flex flex-col">
                    <div role="tablist" class="flex gap-2 mb-6 shrink-0">
                        <button v-for="t in tabs" :key="t.key" type="button" role="tab" :aria-selected="tab === t.key ? 'true' : 'false'"
                            class="h-10 px-4 rounded-full text-sm font-medium transition-colors"
                            :class="tab === t.key ? 'bg-white text-gray-900' : 'bg-white bg-opacity-10 text-white hover:bg-opacity-20'"
                            @click="tab = t.key">{{ t.label }}</button>
                    </div>
                    <div class="flex-1 min-h-0 overflow-y-auto pr-4 custom-scrollbar">
                        <LyricsView v-if="tab === 'lyrics'" :track="currentTrack" :current-time="currentTime"
                            class="text-xl lg:text-2xl leading-relaxed font-medium pb-16" />
                        <ul v-else class="flex flex-col pb-8">
                            <li v-for="item in nextItems" :key="item.qid">
                                <button type="button" class="w-full flex items-center gap-3 p-2 rounded-lg text-left hover:bg-white hover:bg-opacity-5" @click="playQueueItem(item.qid)">
                                    <CoverImg :src="item.coverUrl" :video="item.kind === 'video'" lazy class="w-11 h-11 rounded-md" />
                                    <span class="min-w-0">
                                        <span class="block text-sm font-medium truncate">{{ item.title }}</span>
                                        <span class="block text-xs text-gray-400 truncate">{{ item.artist }}</span>
                                    </span>
                                </button>
                            </li>
                            <li v-if="!nextItems.length" class="text-gray-400 text-sm py-4">다음 곡이 없어요.</li>
                        </ul>
                    </div>
                    <p v-if="nextItems.length" class="mt-3 text-[13px] text-gray-400 truncate shrink-0">
                        다음 곡 · <span class="text-white">{{ nextItems[0].title }}</span> — {{ nextItems[0].artist }}
                    </p>
                </div>
            </div>

            <!-- ── 모바일 ── -->
            <div class="sm:hidden flex-1 min-h-0 flex flex-col">
                <div v-if="mobileLyrics" class="flex-1 min-h-0 overflow-y-auto px-6 pt-2 pb-6">
                    <LyricsView :track="currentTrack" :current-time="currentTime" class="text-lg leading-relaxed font-medium" />
                </div>
                <div v-else class="flex-1 min-h-0 flex items-center justify-center px-6 pt-2">
                    <CoverImg :src="bigCover" :video="isVideo" class="cover w-full max-w-[420px] aspect-square rounded-xl" />
                </div>

                <div class="px-6 pt-5 flex items-center gap-2 shrink-0">
                    <div class="min-w-0 flex-1">
                        <h1 class="text-[22px] font-bold truncate">{{ currentTrack.title }}</h1>
                        <p class="flex items-center gap-1.5 mt-0.5 text-[15px] text-gray-400 truncate">
                            <Icon v-if="isVideo" name="youtube" :size="16" class="text-red-400" />
                            <span class="truncate">{{ currentTrack.artist }}</span>
                        </p>
                    </div>
                    <button v-if="currentTrack._id" type="button" class="icon-btn" :class="isLiked ? 'text-purple-400' : 'text-gray-400'"
                        :aria-label="isLiked ? '좋아요 취소' : '좋아요'" :aria-pressed="isLiked ? 'true' : 'false'" @click="toggleLike">
                        <Icon name="heart" :size="24" :filled="isLiked" />
                    </button>
                </div>

                <!-- 진행바 — 끌 수 있다 -->
                <div class="px-6 pt-4 shrink-0">
                    <div class="relative h-5 flex items-center">
                        <div class="absolute left-0 right-0 h-1 rounded-full bg-white bg-opacity-15"></div>
                        <div class="absolute left-0 h-1 rounded-full bg-white" :style="{ width: `${progress}%` }"></div>
                        <div class="absolute w-3.5 h-3.5 rounded-full bg-white pointer-events-none" :style="{ left: `calc(${progress}% - 7px)` }"></div>
                        <input type="range" min="0" :max="duration || 0" step="1" :value="currentTime" aria-label="재생 위치"
                            class="seek absolute inset-0 w-full h-5 opacity-0 cursor-pointer" @change="onSeek">
                    </div>
                    <div class="flex justify-between text-xs text-gray-400 tabular-nums mt-1">
                        <span>{{ formatTime(currentTime) }}</span><span>{{ formatTime(duration) }}</span>
                    </div>
                </div>

                <div class="px-4 pt-2 flex items-center justify-between shrink-0">
                    <button type="button" class="icon-btn w-12 h-12" :class="shuffleOn ? 'text-purple-400' : 'text-gray-400'"
                        aria-label="셔플" :aria-pressed="shuffleOn ? 'true' : 'false'" @click="toggleShuffle">
                        <Icon name="shuffle" :size="22" />
                    </button>
                    <button type="button" class="icon-btn w-12 h-12" aria-label="이전 곡" @click="playPrevious">
                        <Icon name="skip-back" :size="30" filled />
                    </button>
                    <button type="button" class="w-[68px] h-[68px] rounded-full bg-white text-gray-900 flex items-center justify-center disabled:opacity-40"
                        :aria-label="isPlaying ? '일시정지' : '재생'" :disabled="isLoading" @click="togglePlay">
                        <Icon v-if="isLoading" name="loader" :size="28" class="animate-spin" />
                        <Icon v-else :name="isPlaying ? 'pause' : 'play'" :size="28" filled :stroke-width="isPlaying ? 0 : 1.75" />
                    </button>
                    <button type="button" class="icon-btn w-12 h-12 disabled:opacity-40" aria-label="다음 곡" :disabled="!hasNextTrack" @click="playNext">
                        <Icon name="skip-forward" :size="30" filled />
                    </button>
                    <button type="button" class="icon-btn w-12 h-12" :class="repeatMode !== 'off' ? 'text-purple-400' : 'text-gray-400'"
                        aria-label="반복 재생" @click="toggleRepeat">
                        <Icon :name="repeatMode === 'one' ? 'repeat-1' : 'repeat'" :size="22" />
                    </button>
                </div>

                <div class="px-4 pt-4 pb-5 flex gap-2 shrink-0" style="padding-bottom: max(20px, env(safe-area-inset-bottom));">
                    <button type="button" class="flex-1 h-12 rounded-xl flex items-center justify-center gap-2 text-sm"
                        :class="mobileLyrics ? 'bg-white text-gray-900' : 'bg-white bg-opacity-10'" :aria-pressed="mobileLyrics ? 'true' : 'false'"
                        @click="mobileLyrics = !mobileLyrics">
                        <Icon name="text" :size="18" />가사
                    </button>
                    <button type="button" class="flex-1 h-12 rounded-xl bg-white bg-opacity-10 flex items-center justify-center gap-2 text-sm" @click="$emit('open-queue')">
                        <Icon name="list-music" :size="18" />재생 대기열
                    </button>
                </div>
            </div>
        </div>
    </transition>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'

export default {
    props: {
        show: { type: Boolean, required: true },
    },
    data() {
        return {
            tab: 'lyrics',
            tabs: [{ key: 'lyrics', label: '가사' }, { key: 'next', label: '다음 곡' }],
            mobileLyrics: false,
            viewport: { w: 1280, h: 800 },
        }
    },
    computed: {
        ...mapState('player', ['currentTrack', 'upNext', 'isPlaying', 'isLoading', 'currentTime', 'duration', 'shuffleOn', 'repeatMode']),
        ...mapGetters('player', ['upcoming', 'contextName', 'hasNextTrack']),
        isVideo() {
            return this.currentTrack && this.currentTrack.kind === 'video'
        },
        isLiked() {
            return this.$store.getters['likes/isLiked'](this.currentTrack && this.currentTrack._id)
        },
        sourceLabel() {
            return this.contextName || '재생 대기열'
        },
        // 벅스 커버는 주소의 크기 부분(/50/)만 바꾸면 큰 그림이 나온다. 유튜브 썸네일은 그대로
        bigCover() {
            const url = this.currentTrack && this.currentTrack.coverUrl
            if (!url) return ''
            return url.includes('/50/') ? url.replace('/50/', '/700/') : url
        },
        // 화면 높이에 맞춰 커버 크기를 정한다(위 막대·제목·미니 플레이어 자리를 빼고)
        coverSize() {
            const byHeight = this.viewport.h - 80 - 72 - 140
            const byWidth = this.viewport.w * 0.4
            return `${Math.max(220, Math.min(520, byHeight, byWidth))}px`
        },
        nextItems() {
            return [...this.upNext, ...this.upcoming].slice(0, 30)
        },
        progress() {
            return this.duration > 0 ? (this.currentTime / this.duration) * 100 : 0
        },
    },
    watch: {
        show(open) {
            document.body.style.overflow = open ? 'hidden' : ''
            if (open) this.measure()
        },
    },
    mounted() {
        this.measure()
        window.addEventListener('resize', this.measure)
    },
    beforeDestroy() {
        window.removeEventListener('resize', this.measure)
        document.body.style.overflow = ''
    },
    methods: {
        ...mapActions('player', ['play', 'pause', 'playNext', 'playPrevious', 'seek', 'toggleShuffle', 'toggleRepeat', 'playQueueItem']),
        measure() {
            this.viewport = { w: window.innerWidth, h: window.innerHeight }
        },
        toggleLike() {
            this.$store.dispatch('likes/toggle', this.currentTrack._id)
        },
        togglePlay() {
            this.isPlaying ? this.pause() : this.play()
        },
        onSeek(e) {
            this.seek(Number(e.target.value))
        },
        formatTime(seconds) {
            if (!seconds || isNaN(seconds)) return '0:00'
            const m = Math.floor(seconds / 60)
            const s = Math.floor(seconds % 60)
            return `${m}:${s.toString().padStart(2, '0')}`
        },
    },
}
</script>

<style scoped>
.now-playing {
    background: #15111c;
}
.cover {
    box-shadow: 0 32px 64px rgba(0, 0, 0, 0.5);
}
.icon-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    flex-shrink: 0;
    border-radius: 9999px;
}
.custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(155, 155, 155, 0.4) transparent; }
.np-enter-active, .np-leave-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.3s; }
.np-enter, .np-leave-to { transform: translateY(24px); opacity: 0; }
</style>
