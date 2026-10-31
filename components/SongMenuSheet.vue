<template>
    <transition name="fade">
        <div v-if="song" class="fixed inset-0 z-[60] bg-black bg-opacity-60 flex items-end sm:items-center sm:justify-center" @click.self="$emit('close')">
            <div class="w-full sm:max-w-sm bg-surface-2 rounded-t-2xl sm:rounded-2xl pt-3 pb-6 sm:pb-3 px-2" role="dialog" :aria-label="`${song.title} 메뉴`">
                <div class="sm:hidden w-9 h-1 rounded-full bg-gray-600 mx-auto mb-3"></div>
                <div class="px-3 pb-3">
                    <p class="font-semibold truncate">{{ song.title }}</p>
                    <p class="text-sm text-gray-400 truncate">{{ song.artist }}</p>
                </div>
                <button v-if="songId" type="button" class="menu-item" @click="like">
                    <Icon name="heart" :filled="liked" class="text-purple-400 w-5" />
                    {{ liked ? '좋아요 취소' : '좋아요' }}
                </button>
                <button type="button" class="menu-item" @click="addToQueue(true)">
                    <Icon name="list-music" class="w-5 text-gray-300" />다음에 재생
                </button>
                <button type="button" class="menu-item" @click="addToQueue(false)">
                    <Icon name="list-music" class="w-5 text-gray-300" />대기열 맨 뒤에 추가
                </button>
                <button v-if="kind === 'song'" type="button" class="menu-item" @click="$emit('add-to-playlist', song)">
                    <Icon name="plus" class="w-5 text-gray-300" />내 플레이리스트에 담기
                </button>
                <!-- 플레이리스트 상세에서만 -->
                <button v-if="removable" type="button" class="menu-item text-red-300" @click="$emit('remove', song); $emit('close')">
                    <Icon name="trash" class="w-5" />이 플레이리스트에서 빼기
                </button>
            </div>
        </div>
    </transition>
</template>

<script>
// 곡 메뉴(⋯). 모바일은 아래에서 올라오는 시트, 데스크탑은 가운데 작은 창.
export default {
    props: {
        song: { type: Object, default: null },
        songId: { type: String, default: null },
        // 'video' = 테마(유튜브 곡) — 좋아요·내 플레이리스트 담기는 곡 id가 없어 숨긴다
        kind: { type: String, default: 'song' },
        removable: { type: Boolean, default: false },
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
    mounted() {
        document.addEventListener('keydown', this.onKey)
    },
    beforeDestroy() {
        document.body.style.overflow = ''
        document.removeEventListener('keydown', this.onKey)
    },
    methods: {
        onKey(e) {
            if (e.key === 'Escape' && this.song) this.$emit('close')
        },
        like() {
            this.$store.dispatch('likes/toggle', this.songId)
            this.$emit('close')
        },
        // front=true "다음에 재생"(맨 앞) / false "대기열 맨 뒤에 추가".
        // 곡 id 는 songId prop 이 정답이다 — 차트 항목의 _id 는 곡이 아니다
        async addToQueue(front) {
            const song = { ...this.song, _id: this.songId || undefined }
            const { added } = await this.$store.dispatch('player/addToQueue', { songs: [song], idKey: '_id', kind: this.kind, front })
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
