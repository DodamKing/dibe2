<template>
    <div
class="song-row group flex items-center gap-3 px-2 sm:px-3 py-2 rounded-lg hover:bg-white hover:bg-opacity-5 transition-colors cursor-pointer"
        @click="$emit('play', song)">
        <input
v-if="selectable" type="checkbox" :checked="selected" :aria-label="`${song.title} 선택`"
            class="shrink-0" @click.stop @change="$emit('toggle-select', song)" />
        <span v-if="rank" class="w-6 sm:w-7 text-right text-sm sm:text-base font-semibold text-gray-400 shrink-0 tabular-nums">{{ rank }}</span>
        <img :src="cover" :alt="''" class="w-11 h-11 rounded-md object-cover shrink-0 bg-gray-700" loading="lazy" />
        <div class="min-w-0 flex-1">
            <p class="flex items-center gap-1 text-sm sm:text-[15px] font-medium leading-tight">
                <!-- 모바일은 하트 버튼이 없으니 좋아요한 곡을 제목 앞 작은 하트로 표시 -->
                <Icon name="heart" :size="10" filled class="text-purple-400 sm:hidden" v-if="liked" aria-label="좋아요한 곡" />
                <span class="truncate">{{ song.title }}</span>
            </p>
            <p class="text-xs sm:text-[13px] text-gray-400 truncate leading-tight mt-0.5">{{ song.artist }}</p>
            <!-- 줄 아래 덧붙일 내용(검색의 가사 일부 등) -->
            <slot name="below" />
        </div>
        <span v-if="showAlbum" class="hidden md:block w-56 text-[13px] text-gray-400 truncate shrink-0">{{ song.album }}</span>

        <!-- 데스크탑: 하트(마우스를 올리면 보이고, 좋아요한 곡은 항상 보임) -->
        <button
v-if="songId" type="button" class="heart-btn hidden sm:flex items-center justify-center w-10 h-10 shrink-0 rounded-full"
            :class="liked ? 'is-on text-purple-400' : 'text-gray-400 hover:text-white'"
            :aria-label="liked ? '좋아요 취소' : '좋아요'" :aria-pressed="liked ? 'true' : 'false'"
            @click.stop="toggleLike">
            <Icon name="heart" :filled="liked" />
        </button>
        <!-- 곡 메뉴(다음에 재생·대기열 추가·담기). 데스크탑은 하트처럼 마우스를 올리면 보인다 -->
        <button
type="button" class="menu-btn flex items-center justify-center w-11 h-11 sm:w-10 sm:h-10 shrink-0 rounded-full text-gray-400 hover:text-white"
            aria-label="곡 메뉴" @click.stop="$emit('menu', song)">
            <Icon name="ellipsis-vertical" />
        </button>
    </div>
</template>

<script>
export default {
    props: {
        song: { type: Object, required: true },
        // 차트 항목이면 `songId`, DB 곡이면 `_id` — 호출하는 쪽이 정해서 넘긴다(차트 항목의 _id 는 곡이 아님)
        songId: { type: String, default: null },
        rank: { type: [Number, String], default: null },
        selectable: { type: Boolean, default: false },
        selected: { type: Boolean, default: false },
        showAlbum: { type: Boolean, default: false },
    },
    computed: {
        liked() {
            return this.$store.getters['likes/isLiked'](this.songId)
        },
        cover() {
            const url = this.song.coverUrl || ''
            return url.replace('/50/', '/200/')
        },
    },
    methods: {
        toggleLike() {
            this.$store.dispatch('likes/toggle', this.songId)
        },
    },
}
</script>

<style scoped>
/* 마우스가 있는 기기에서만 "올리면 보이기". 터치 태블릿(hover 없음)에선 항상 보인다 —
   opacity-0 + hover 는 터치에서 영영 안 보이기 때문(docs/FRONTEND.md 모바일 함정) */
@media (hover: hover) {
    .heart-btn:not(.is-on) { opacity: 0; }
    .song-row:hover .heart-btn,
    .heart-btn:focus-visible { opacity: 1; }
}
@media (hover: hover) and (min-width: 640px) {
    .menu-btn { opacity: 0; }
    .song-row:hover .menu-btn,
    .menu-btn:focus-visible { opacity: 1; }
}
</style>
