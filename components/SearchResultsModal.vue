<template>
    <!--
        검색 결과(2026-11 새 디자인). 데스크탑: 가운데 어두운 창 / 모바일: 전체 화면.
        줄 클릭 = 검색 결과를 그 곡부터 재생(다른 목록과 같은 규칙), 체크해서 여러 곡을 대기열·플리에 담는다.
        z-index: MusicPlayer(z-50)보다 위여야 결과 마지막 줄을 안 덮는다. 담기 시트·알림(레이아웃)은 DOM 상 뒤라 같은 z 여도 위로 온다
    -->
    <transition name="fade">
        <div v-if="show" class="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-stretch sm:items-center justify-center sm:p-6" @click.self="$emit('close')">
            <!-- max-h + flex-col: 카드가 뷰포트를 넘지 않고 결과 영역만 늘어난다(예전 h-[calc(100vh-300px)] 매직넘버는 모바일에서 화면 밖으로 나갔다) -->
            <div class="bg-surface-1 w-full sm:max-w-3xl sm:max-h-[85vh] sm:rounded-2xl shadow-2xl overflow-hidden text-white flex flex-col" role="dialog" aria-label="검색 결과">
                <div class="flex items-center gap-2 px-3 sm:px-5 pt-3 sm:pt-5 pb-2 shrink-0">
                    <form class="flex-1 flex items-center gap-2 h-11 px-4 rounded-full bg-surface-2 text-gray-400 focus-within:ring-2 focus-within:ring-purple-400" @submit.prevent="executeSearch">
                        <Icon name="search" />
                        <input v-model="localQuery" type="search" aria-label="검색어" placeholder="노래, 앨범, 아티스트 검색"
                            class="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 focus:outline-none">
                    </form>
                    <button type="button" class="w-11 h-11 flex items-center justify-center rounded-full text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-5" aria-label="검색 닫기" @click="$emit('close')">
                        <Icon name="x" />
                    </button>
                </div>

                <div role="tablist" aria-label="검색 기준" class="flex gap-1.5 px-3 sm:px-5 py-2 shrink-0">
                    <button v-for="tab in tabs" :key="tab.key" type="button" role="tab" :aria-selected="activeTab === tab.key ? 'true' : 'false'"
                        class="h-9 px-4 rounded-full text-sm transition-colors"
                        :class="activeTab === tab.key ? 'bg-white text-gray-900 font-semibold' : 'bg-white bg-opacity-5 text-gray-300 hover:bg-opacity-10'"
                        @click="changeActiveTab(tab.key)">{{ tab.label }}</button>
                </div>

                <!-- 선택 도구줄 — 고르면 담기 버튼이 살아난다 -->
                <div class="flex items-center gap-2 px-3 sm:px-5 py-2 border-b border-white border-opacity-5 shrink-0">
                    <label class="flex items-center gap-2 min-h-[40px] pl-2 text-sm text-gray-200 cursor-pointer">
                        <input v-model="selectAll" type="checkbox" @change="toggleSelectAll">
                        전체 선택
                    </label>
                    <span v-if="selectedSongs.length" class="text-sm text-gray-400">{{ selectedSongs.length }}곡</span>
                    <div class="ml-auto flex gap-2">
                        <button type="button" :disabled="!selectedSongs.length"
                            class="flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full border border-gray-600 text-sm text-gray-200 hover:bg-white hover:bg-opacity-5 disabled:opacity-40"
                            @click="addSelectedToQueue">
                            <Icon name="list-music" :size="16" /><span class="hidden sm:inline">대기열에 추가</span><span class="sm:hidden">대기열</span>
                        </button>
                        <button type="button" :disabled="!selectedSongs.length"
                            class="flex items-center gap-1.5 h-9 px-3 sm:px-4 rounded-full bg-purple-500 hover:bg-purple-600 text-sm font-semibold disabled:opacity-40"
                            @click="openAddModal(selectedSongs)">
                            <Icon name="plus" :size="16" />담기
                        </button>
                    </div>
                </div>

                <div ref="scrollContainer" class="flex-1 min-h-0 overflow-y-auto overscroll-contain px-1 sm:px-3 py-2 custom-scrollbar" @scroll="handleScroll">
                    <SongRow v-for="(song, i) in searchResults" :key="song._id" :song="song" :song-id="String(song._id)"
                        selectable :selected="isSelected(song)" :show-album="activeTab === 'album'"
                        @toggle-select="toggleSongSelection" @play="playFrom(i)" @menu="menuSong = $event">
                        <template v-if="activeTab === 'lyrics'" #below>
                            <p class="text-[13px] text-gray-300 mt-1 lyrics-clamp" v-html="highlightLyrics(song.lyrics)"></p>
                        </template>
                    </SongRow>
                    <p v-if="!searchResults.length && !loading" class="text-center text-sm text-gray-400 py-10">
                        {{ error ? '검색하지 못했어요. 잠시 후 다시 시도해 주세요.' : '검색 결과가 없어요.' }}
                    </p>
                    <div v-if="loading" class="flex justify-center py-6 text-purple-400" role="status" aria-label="불러오는 중">
                        <Icon name="loader" :size="24" class="animate-spin" />
                    </div>
                </div>
            </div>

            <SongMenuSheet :song="menuSong" :song-id="menuSong ? String(menuSong._id) : null" @close="menuSong = null"
                @add-to-playlist="song => { menuSong = null; openAddModal([song]) }" />
        </div>
    </transition>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import SongRow from '~/components/SongRow.vue'
import SongMenuSheet from '~/components/SongMenuSheet.vue'

export default {
    components: { SongRow, SongMenuSheet },
    // 담기 시트는 레이아웃 것을 같이 쓴다(차트 "선택 곡 담기"와 같은 창)
    inject: { layoutMethods: { default: null } },
    props: {
        show: Boolean,
    },
    data() {
        return {
            tabs: [
                { key: 'title', label: '제목' },
                { key: 'artist', label: '가수' },
                { key: 'album', label: '앨범' },
                { key: 'lyrics', label: '가사' },
            ],
            selectedSongs: [],
            selectAll: false,
            localQuery: '',
            menuSong: null,
        }
    },
    computed: {
        ...mapState('search', ['searchQuery', 'searchResults', 'loading', 'error', 'hasMore', 'activeTab']),
    },
    watch: {
        show(newVal) {
            if (newVal) this.localQuery = this.searchQuery
            // 모달이 떠 있는 동안 배경을 잠근다. 안 잠그면 결과 목록을 넘기려다
            // 뒤의 차트가 같이 밀려서 "모달이 떠내려가는" 것처럼 보인다(모바일에서 특히 심함).
            this.lockBackground(newVal)
        },
        searchResults(list, old) {
            // 새 검색·탭 변경이면 선택을 비운다(더 불러오기로 뒤에 붙는 건 유지)
            if (!old || list.length < old.length || list[0] !== old[0]) {
                this.selectAll = false
                this.selectedSongs = []
            }
        },
    },
    // 모달이 열린 채로 컴포넌트가 사라지면 body 가 잠긴 채 남는다 — 반드시 푼다.
    beforeDestroy() {
        this.lockBackground(false)
    },
    methods: {
        ...mapActions({
            fetchResults: 'search/fetchResults',
            changeActiveTab: 'search/changeActiveTab',
            performSearch: 'search/performSearch',
            updateSearchQuery: 'search/updateSearchQuery',
        }),
        /** 배경(body) 스크롤 잠금. 모달이 열려 있는 동안만. */
        lockBackground(lock) {
            if (typeof document === 'undefined') return
            document.body.style.overflow = lock ? 'hidden' : ''
        },
        notice(message) {
            this.$store.commit('player/SET_NOTICE', message)
        },
        executeSearch() {
            if (this.localQuery.trim() !== '') {
                this.updateSearchQuery(this.localQuery)
                this.performSearch()
            }
        },
        handleScroll() {
            const container = this.$refs.scrollContainer
            if (container.scrollTop + container.clientHeight >= container.scrollHeight - 40) {
                if (!this.loading && this.hasMore) this.fetchResults()
            }
        },
        isSelected(song) {
            return this.selectedSongs.some(s => s._id === song._id)
        },
        toggleSongSelection(song) {
            const index = this.selectedSongs.findIndex(s => s._id === song._id)
            if (index > -1) this.selectedSongs.splice(index, 1)
            else this.selectedSongs.push(song)
            this.selectAll = this.selectedSongs.length === this.searchResults.length
        },
        toggleSelectAll() {
            this.selectedSongs = this.selectAll ? [...this.searchResults] : []
        },
        // 줄 클릭 = 지금까지 받은 검색 결과를 그 곡부터
        playFrom(index) {
            this.$store.dispatch('player/playList', {
                source: { type: 'search', id: `${this.activeTab}:${this.searchQuery}`, name: `"${this.searchQuery}" 검색 결과` },
                songs: this.searchResults,
                idKey: '_id',
                index,
            })
        },
        async addSelectedToQueue() {
            if (!this.selectedSongs.length) return
            try {
                // 검색 결과는 DB 곡(_id = 곡 id). 같은 곡이 이미 있어도 넣는다(업계 공통)
                const { added, full } = await this.$store.dispatch('player/addToQueue', { songs: this.selectedSongs, idKey: '_id' })
                this.notice(!added ? '재생 대기열이 가득 찼어요. (최대 1000곡)'
                    : full ? `대기열에 ${added}곡만 추가했어요. (최대 1000곡)` : `${added}곡을 대기열에 추가했어요.`)
                this.selectedSongs = []
                this.selectAll = false
            } catch (error) {
                console.error('Failed to add songs to queue:', error)
                this.notice('대기열에 추가하지 못했어요.')
            }
        },
        openAddModal(songs) {
            if (!this.layoutMethods || !songs.length) return
            this.layoutMethods.openAddModalFor(songs)
        },
        highlightLyrics(lyrics) {
            if (!lyrics) return ''
            const escapeHtml = s => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
            const queryRegex = new RegExp(this.searchQuery.replace(/[-\\^$*+?.()|[\]{}]/g, '\\$&'), 'gi')
            const match = lyrics.match(queryRegex)
            if (!match) return escapeHtml(lyrics.substring(0, 100)) + '...'

            const matchIndex = lyrics.toLowerCase().indexOf(match[0].toLowerCase())
            const start = Math.max(0, matchIndex - 100)
            const end = Math.min(lyrics.length, matchIndex + match[0].length + 100)
            // 가사는 외부(벅스)에서 긁어온 글이라 v-html 전에 이스케이프한다
            let snippet = escapeHtml(lyrics.substring(start, end))
            snippet = snippet.replace(queryRegex, m => `<mark class="bg-purple-400 bg-opacity-30 text-white rounded px-0.5">${m}</mark>`)
            if (start > 0) snippet = '... ' + snippet
            if (end < lyrics.length) snippet += ' ...'
            return snippet
        },
    },
}
</script>

<style scoped>
.custom-scrollbar {
    scrollbar-width: thin;
    scrollbar-color: rgba(155, 155, 155, 0.4) transparent;
}
.lyrics-clamp {
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
    white-space: normal;
}
.fade-enter-active, .fade-leave-active { transition: opacity 0.2s; }
.fade-enter, .fade-leave-to { opacity: 0; }
</style>
