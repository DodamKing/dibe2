<template>
    <transition name="fade">
        <div v-if="song" class="fixed inset-0 z-[60] bg-black bg-opacity-60 flex items-end" @click.self="$emit('close')">
            <div class="w-full bg-surface-2 rounded-t-2xl pt-3 pb-6 px-2" role="dialog" :aria-label="`${song.title} 메뉴`">
                <div class="w-9 h-1 rounded-full bg-gray-600 mx-auto mb-3"></div>
                <div class="px-3 pb-3">
                    <p class="font-semibold truncate">{{ song.title }}</p>
                    <p class="text-sm text-gray-400 truncate">{{ song.artist }}</p>
                </div>
                <button v-if="songId" type="button" class="menu-item" @click="like">
                    <i :class="[liked ? 'fas' : 'far', 'fa-heart', 'text-purple-400 w-5']"></i>
                    {{ liked ? '좋아요 취소' : '좋아요' }}
                </button>
                <button type="button" class="menu-item" @click="addToQueue(true)">
                    <i class="fas fa-list w-5 text-gray-300"></i>다음에 재생
                </button>
                <button type="button" class="menu-item" @click="addToQueue(false)">
                    <i class="fas fa-list w-5 text-gray-300"></i>대기열 맨 뒤에 추가
                </button>
                <button type="button" class="menu-item" @click="$emit('add-to-playlist', song)">
                    <i class="fas fa-plus w-5 text-gray-300"></i>내 플레이리스트에 담기
                </button>
            </div>
        </div>
    </transition>
</template>

<script>
// 모바일 곡 메뉴(⋯). 데스크탑은 줄에 하트가 보이므로 이 시트를 쓰지 않는다.
export default {
    props: {
        song: { type: Object, default: null },
        songId: { type: String, default: null },
    },
    computed: {
        liked() {
            return this.$store.getters['likes/isLiked'](this.songId)
        },
    },
    watch: {
        // 열려 있는 동안 뒤 배경 스크롤 잠금(docs/FRONTEND.md 모바일 함정)
        song(v) {
            document.body.style.overflow = v ? 'hidden' : ''
        },
    },
    beforeDestroy() {
        document.body.style.overflow = ''
    },
    methods: {
        like() {
            this.$store.dispatch('likes/toggle', this.songId)
            this.$emit('close')
        },
        // front=true "다음에 재생"(맨 앞) / false "대기열 맨 뒤에 추가".
        // 곡 id 는 songId prop 이 정답이다 — 차트 항목의 _id 는 곡이 아니다
        async addToQueue(front) {
            const song = { ...this.song, _id: this.songId || undefined }
            const { added } = await this.$store.dispatch('player/addToQueue', { songs: [song], idKey: '_id', front })
            this.$store.commit('player/SET_NOTICE', !added ? '재생 대기열이 가득 찼어요.' : front ? '다음에 재생할게요.' : '대기열에 추가했어요.')
            this.$emit('close')
        },
    },
}
</script>

<style scoped>
.menu-item {
    @apply w-full flex items-center gap-3 px-3 text-left rounded-lg;
    font-size: 15px;
    min-height: 52px;
}
.menu-item:active { background-color: rgba(255, 255, 255, 0.06); }
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter, .fade-leave-to { opacity: 0; }
</style>
