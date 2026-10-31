<template>
    <!-- 재생 대기열(2026-11, 예전 Playlist.vue 대체). 데스크탑: 오른쪽 서랍(뒤 페이지가 보인다) / 모바일: 전체 화면 시트.
         두 구역 — "다음에 재생"(직접 넣은 곡, 먼저 나옴) / "다음: ○○에서"(지금 듣는 목록). 구역 안에서만 순서 바꾸기 -->
    <transition :name="isMobile ? 'sheet' : 'drawer'">
        <aside v-if="show" aria-label="재생 대기열"
            class="queue-panel fixed bg-surface-1 flex flex-col inset-0 sm:inset-auto sm:top-0 sm:right-0 sm:bottom-20 sm:w-[400px] sm:border-l sm:border-white sm:border-opacity-5">
            <div class="sm:hidden pt-2 flex justify-center"><span class="w-10 h-1 rounded-full bg-white bg-opacity-20"></span></div>
            <div class="flex items-center justify-between pl-5 sm:pl-6 pr-1 sm:pr-3 h-14 sm:h-16 shrink-0">
                <h2 class="text-lg font-bold">재생 대기열</h2>
                <div class="flex items-center">
                    <!-- 모바일 미니 플레이어엔 셔플·반복이 없어 여기에도 둔다(데스크탑은 미니 플레이어에 있음).
                         .icon-btn 의 display 가 sm:hidden 을 이기므로 감싸서 숨긴다 -->
                    <div class="flex sm:hidden">
                        <button type="button" class="icon-btn" :class="shuffleOn ? 'text-purple-400' : 'text-gray-400'"
                            aria-label="셔플" :aria-pressed="shuffleOn ? 'true' : 'false'" @click="toggleShuffle">
                            <Icon name="shuffle" />
                        </button>
                        <button type="button" class="icon-btn" :class="repeatMode !== 'off' ? 'text-purple-400' : 'text-gray-400'"
                            aria-label="반복 재생" @click="toggleRepeat">
                            <Icon :name="repeatMode === 'one' ? 'repeat-1' : 'repeat'" />
                        </button>
                    </div>
                    <button type="button" class="icon-btn text-gray-300 hover:text-white" aria-label="닫기" @click="$emit('close')">
                        <Icon name="x" />
                    </button>
                </div>
            </div>

            <div ref="scroller" class="flex-1 overflow-y-auto overscroll-contain px-3 pb-8 custom-scrollbar">
                <template v-if="currentTrack">
                    <p class="section-label">지금 재생 중</p>
                    <div class="flex items-center gap-3 p-2 rounded-lg bg-purple-400 bg-opacity-10">
                        <CoverImg :src="currentTrack.coverUrl" :video="currentTrack.kind === 'video'" class="w-12 h-12 rounded-md" />
                        <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium truncate text-purple-300">{{ currentTrack.title }}</p>
                            <p class="flex items-center gap-1 text-xs text-gray-400 truncate">
                                <Icon v-if="currentTrack.kind === 'video'" name="youtube" :size="13" class="text-red-400" />
                                <span class="truncate">{{ currentTrack.artist }}</span>
                            </p>
                        </div>
                        <span v-if="isPlaying" class="eq mr-2" role="img" aria-label="재생 중"><i></i><i></i><i></i></span>
                    </div>
                </template>

                <template v-if="upNext.length">
                    <div class="section-head">
                        <p class="section-label">다음에 재생 · {{ upNext.length }}곡</p>
                        <button type="button" class="clear-btn" @click="clearUpNext">비우기</button>
                    </div>
                    <draggable :value="upNext" tag="ul" handle=".drag-handle" :animation="200" :force-fallback="true" :fallback-tolerance="5"
                        :delay-on-touch-only="true" :touch-start-threshold="2" ghost-class="ghost-item" @end="onMove('moveUpNext', $event)">
                        <li v-for="item in upNext" :key="item.qid" class="queue-row">
                            <button type="button" class="row-main" @click="playQueueItem(item.qid)">
                                <CoverImg :src="item.coverUrl" :video="item.kind === 'video'" lazy class="w-11 h-11 rounded-md" />
                                <span class="min-w-0 flex-1">
                                    <span class="block text-sm font-medium truncate">{{ item.title }}</span>
                                    <span class="flex items-center gap-1 text-xs text-gray-400 truncate">
                                        <Icon v-if="item.kind === 'video'" name="youtube" :size="13" class="text-red-400" />
                                        <span class="truncate">{{ item.artist }}</span>
                                    </span>
                                </span>
                            </button>
                            <button type="button" class="icon-btn text-gray-400 hover:text-white" :aria-label="`${item.title} 빼기`" @click="removeFromQueue([item.qid])">
                                <Icon name="minus" :size="18" />
                            </button>
                            <span class="drag-handle icon-btn text-gray-400" aria-hidden="true"><Icon name="grip-vertical" :size="18" /></span>
                        </li>
                    </draggable>
                </template>

                <template v-if="upcoming.length">
                    <div class="section-head">
                        <p class="section-label truncate">다음: <span class="text-white">{{ contextName || '재생 목록' }}</span>에서</p>
                        <button type="button" class="clear-btn" @click="clearUpcoming">비우기</button>
                    </div>
                    <draggable :value="visibleUpcoming" tag="ul" handle=".drag-handle" :animation="200" :force-fallback="true" :fallback-tolerance="5"
                        :delay-on-touch-only="true" :touch-start-threshold="2" ghost-class="ghost-item" @end="onMove('moveUpcoming', $event)">
                        <li v-for="item in visibleUpcoming" :key="item.qid" class="queue-row">
                            <button type="button" class="row-main" @click="playQueueItem(item.qid)">
                                <CoverImg :src="item.coverUrl" :video="item.kind === 'video'" lazy class="w-11 h-11 rounded-md" />
                                <span class="min-w-0 flex-1">
                                    <span class="block text-sm font-medium truncate">{{ item.title }}</span>
                                    <span class="flex items-center gap-1 text-xs text-gray-400 truncate">
                                        <Icon v-if="item.kind === 'video'" name="youtube" :size="13" class="text-red-400" />
                                        <span class="truncate">{{ item.artist }}</span>
                                    </span>
                                </span>
                            </button>
                            <button type="button" class="icon-btn text-gray-400 hover:text-white" :aria-label="`${item.title} 빼기`" @click="removeFromQueue([item.qid])">
                                <Icon name="minus" :size="18" />
                            </button>
                            <span class="drag-handle icon-btn text-gray-400" aria-hidden="true"><Icon name="grip-vertical" :size="18" /></span>
                        </li>
                    </draggable>
                    <button v-if="upcoming.length > visibleUpcoming.length" type="button"
                        class="w-full h-11 mt-2 rounded-lg text-sm text-gray-300 hover:bg-white hover:bg-opacity-5" @click="limit += PAGE">
                        {{ upcoming.length - visibleUpcoming.length }}곡 더 보기
                    </button>
                </template>

                <div v-if="!currentTrack && !upNext.length" class="flex flex-col items-center text-center gap-3 pt-20 text-gray-400">
                    <Icon name="list-music" :size="40" :stroke-width="1.25" />
                    <p class="text-sm">대기열이 비어 있어요.<br>차트나 플레이리스트에서 곡을 눌러 보세요.</p>
                </div>
            </div>
        </aside>
    </transition>
</template>

<script>
import { mapState, mapGetters, mapActions } from 'vuex'
import draggable from 'vuedraggable'

// 목록이 길면(좋아요 수백 곡 등) 처음엔 이만큼만 그린다
const PAGE = 100

export default {
    components: { draggable },
    props: {
        show: { type: Boolean, required: true },
    },
    data() {
        return { limit: PAGE, PAGE, isMobile: false }
    },
    computed: {
        ...mapState('player', ['currentTrack', 'upNext', 'shuffleOn', 'repeatMode', 'isPlaying']),
        ...mapGetters('player', ['upcoming', 'contextName']),
        visibleUpcoming() {
            return this.upcoming.slice(0, this.limit)
        },
    },
    watch: {
        show(open) {
            if (open) {
                this.limit = PAGE
                this.isMobile = window.innerWidth < 640
                this.$nextTick(() => { if (this.$refs.scroller) this.$refs.scroller.scrollTop = 0 })
            }
            // 모바일 전체 화면 시트일 때만 뒤 페이지 스크롤을 잠근다(데스크탑 서랍은 뒤 페이지를 계속 쓸 수 있다)
            document.body.style.overflow = open && window.innerWidth < 640 ? 'hidden' : ''
        },
    },
    beforeDestroy() {
        document.body.style.overflow = ''
    },
    methods: {
        ...mapActions('player', ['playQueueItem', 'removeFromQueue', 'clearUpNext', 'clearUpcoming', 'toggleShuffle', 'toggleRepeat']),
        onMove(action, e) {
            if (e.oldIndex === e.newIndex) return
            this.$store.dispatch(`player/${action}`, { from: e.oldIndex, to: e.newIndex })
            if ('vibrate' in navigator) navigator.vibrate(30)
        },
    },
}
</script>

<style scoped>
.queue-panel {
    box-shadow: -24px 0 48px rgba(0, 0, 0, 0.35);
}
.section-label {
    margin: 0;
    padding: 8px 8px 8px;
    font-size: 12px;
    font-weight: 500;
    color: rgb(168, 162, 179);
}
.section-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
    margin-top: 16px;
}
.clear-btn {
    flex-shrink: 0;
    font-size: 12px;
    color: rgb(168, 162, 179);
    padding: 10px 8px;
}
.clear-btn:hover { color: #fff; }
.queue-row {
    display: flex;
    align-items: center;
    border-radius: 8px;
    min-height: 60px;
}
.queue-row:hover { background: rgba(255, 255, 255, 0.04); }
.row-main {
    display: flex;
    align-items: center;
    gap: 12px;
    flex: 1;
    min-width: 0;
    padding: 6px 8px;
    text-align: left;
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
.drag-handle {
    cursor: grab;
    touch-action: none;
    user-select: none;
    -webkit-user-select: none;
    -webkit-touch-callout: none;
}
.ghost-item {
    opacity: 0.5;
    background: rgba(192, 132, 252, 0.12);
}
/* 재생 중 표시(막대 3개) */
.eq { display: inline-flex; align-items: flex-end; gap: 2px; height: 16px; color: rgb(192, 132, 252); }
.eq i { width: 3px; background: currentColor; border-radius: 2px; animation: eq 1s ease-in-out infinite; }
.eq i:nth-child(1) { height: 10px; }
.eq i:nth-child(2) { height: 16px; animation-delay: -0.3s; }
.eq i:nth-child(3) { height: 7px; animation-delay: -0.6s; }
@keyframes eq { 0%, 100% { transform: scaleY(0.4); } 50% { transform: scaleY(1); } }
.eq i { transform-origin: bottom; }
@media (prefers-reduced-motion: reduce) { .eq i { animation: none; } }

.custom-scrollbar { scrollbar-width: thin; scrollbar-color: rgba(155, 155, 155, 0.4) transparent; }

.drawer-enter-active, .drawer-leave-active { transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.drawer-enter, .drawer-leave-to { transform: translateX(100%); }
.sheet-enter-active, .sheet-leave-active { transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.sheet-enter, .sheet-leave-to { transform: translateY(100%); }
</style>
