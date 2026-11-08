<template>
    <!--
        검색창 아래 패널(2026-11-08) — 입력 전: 최근 검색어 / 입력 중: 가수·곡 자동완성(+ "전체 결과 보기").
        헤더(데스크탑 드롭다운)·모바일 검색 막대·검색 결과 창·영상 탭(최근 검색어만)이 같이 쓴다. docs/SEARCH.md
        키보드는 부모 입력칸이 onKey(e)로 넘긴다(↑↓ 고르기, Enter 실행, Esc 닫기)
    -->
    <div v-if="open && items.length" :class="inline ? '' : 'absolute left-0 right-0 top-full mt-2 z-[70]'"
        class="bg-surface-2 text-white rounded-xl shadow-2xl border border-white border-opacity-5 overflow-hidden"
        role="listbox" aria-label="검색 제안" @mousedown.prevent>
        <div class="max-h-[60vh] overflow-y-auto overscroll-contain py-1.5">
            <!-- 최근 검색어 -->
            <template v-if="mode === 'recent'">
                <div class="flex items-center justify-between px-4 pt-1.5 pb-1">
                    <span class="text-xs font-semibold text-gray-400">최근 검색어</span>
                    <button type="button" class="h-8 px-2 text-xs text-gray-400 hover:text-white" @click="clearAll">전체 삭제</button>
                </div>
                <div v-for="(it, i) in items" :key="'r' + it.q" role="option" :aria-selected="i === active ? 'true' : 'false'"
                    class="flex items-center gap-3 pl-4 pr-1 h-11 cursor-pointer" :class="i === active ? 'bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-5'"
                    @click="choose(it)" @mousemove="active = i">
                    <Icon name="clock" :size="16" class="text-gray-500 shrink-0" />
                    <span class="flex-1 min-w-0 truncate text-sm">{{ it.q }}</span>
                    <button type="button" class="w-10 h-10 flex items-center justify-center rounded-full text-gray-500 hover:text-white shrink-0"
                        :aria-label="`${it.q} 지우기`" @click.stop="remove(it.q)">
                        <Icon name="x" :size="16" />
                    </button>
                </div>
            </template>

            <!-- 자동완성 -->
            <template v-else>
                <p v-if="fuzzy" class="px-4 pt-1.5 pb-1 text-xs text-amber-300">정확히 맞는 곡이 없어 비슷한 결과예요</p>
                <div v-for="(it, i) in items" :key="it.key" role="option" :aria-selected="i === active ? 'true' : 'false'"
                    class="flex items-center gap-3 px-4 min-h-[48px] py-1.5 cursor-pointer" :class="i === active ? 'bg-white bg-opacity-10' : 'hover:bg-white hover:bg-opacity-5'"
                    @click="choose(it)" @mousemove="active = i">
                    <template v-if="it.type === 'artist'">
                        <img :src="it.coverUrl || '/default-album-cover.jpg'" alt="" class="w-9 h-9 rounded-full object-cover bg-gray-700 shrink-0">
                        <div class="min-w-0 flex-1">
                            <p class="text-sm truncate"><HighlightText :text="it.name" :query="query" /></p>
                            <p class="text-xs text-gray-400">가수 · {{ it.count }}곡</p>
                        </div>
                    </template>
                    <template v-else-if="it.type === 'song'">
                        <img :src="it.coverUrl || '/default-album-cover.jpg'" alt="" class="w-9 h-9 rounded-md object-cover bg-gray-700 shrink-0">
                        <div class="min-w-0 flex-1">
                            <p class="text-sm truncate"><HighlightText :text="it.title" :query="query" /></p>
                            <p class="text-xs text-gray-400 truncate"><HighlightText :text="it.artist" :query="query" /></p>
                        </div>
                        <Icon name="play" :size="14" filled class="text-gray-500 shrink-0" />
                    </template>
                    <template v-else>
                        <Icon name="search" :size="18" class="text-purple-300 shrink-0" />
                        <span class="flex-1 min-w-0 truncate text-sm text-purple-200">"{{ query.trim() }}" 전체 결과 보기</span>
                    </template>
                </div>
            </template>
        </div>
    </div>
</template>

<script>
import HighlightText from '~/components/HighlightText.vue'
import { getRecent, removeRecent, clearRecent } from '~/utils/recentSearches'

export default {
    components: { HighlightText },
    props: {
        query: { type: String, default: '' },
        open: Boolean,
        kind: { type: String, default: 'music' }, // 최근 검색어 저장 키 — music / video
        suggest: { type: Boolean, default: true }, // false = 최근 검색어만(영상 탭)
        inline: Boolean, // true = 아래로 깔리는 패널(모바일 검색 막대), false = 입력칸 아래 떠 있는 드롭다운
    },
    data() {
        return { recent: [], artists: [], songs: [], fuzzy: false, active: -1, seq: 0, timer: null }
    },
    computed: {
        mode() {
            return this.query.trim() && this.suggest ? 'suggest' : this.query.trim() ? 'none' : 'recent'
        },
        items() {
            if (this.mode === 'recent') return this.recent.map((q) => ({ type: 'recent', q, key: 'r' + q }))
            if (this.mode !== 'suggest') return []
            const list = [
                ...this.artists.map((a) => ({ type: 'artist', key: 'a' + a.name, ...a })),
                ...this.songs.map((s) => ({ type: 'song', key: 's' + s._id, ...s })),
            ]
            return list.length ? [...list, { type: 'all', key: 'all' }] : []
        },
    },
    watch: {
        open(v) {
            if (v) { this.recent = getRecent(this.kind); this.active = -1 }
        },
        query() {
            this.active = -1
            clearTimeout(this.timer)
            if (this.mode !== 'suggest') { this.artists = []; this.songs = []; return }
            this.timer = setTimeout(this.fetch, 180) // 타이핑 중엔 안 부른다
        },
    },
    mounted() {
        this.recent = getRecent(this.kind)
    },
    beforeDestroy() {
        clearTimeout(this.timer)
    },
    methods: {
        async fetch() {
            const q = this.query.trim()
            const seq = ++this.seq
            try {
                const r = await this.$axios.$get('/api/songs/suggest', { params: { q } })
                if (seq !== this.seq || q !== this.query.trim()) return // 늦게 온 옛 응답은 버린다
                this.artists = r.artists || []
                this.songs = r.songs || []
                this.fuzzy = !!r.fuzzy
            } catch (e) {
                if (seq === this.seq) { this.artists = []; this.songs = [] }
            }
        },
        choose(it) {
            if (it.type === 'recent') this.$emit('search', it.q)
            else if (it.type === 'artist') this.$emit('pick-artist', it.name)
            else if (it.type === 'song') this.$emit('pick-song', it)
            else this.$emit('search', this.query.trim())
        },
        remove(q) {
            this.recent = removeRecent(this.kind, q)
        },
        clearAll() {
            this.recent = clearRecent(this.kind)
        },
        /** 부모 입력칸의 keydown. 처리했으면 true(부모는 기본 동작을 막는다) */
        onKey(e) {
            const n = this.items.length
            if (e.key === 'ArrowDown' && n) { this.active = (this.active + 1) % n; return true }
            if (e.key === 'ArrowUp' && n) { this.active = this.active <= 0 ? n - 1 : this.active - 1; return true }
            if (e.key === 'Enter' && this.active >= 0 && this.items[this.active]) { this.choose(this.items[this.active]); return true }
            return false
        },
    },
}
</script>
