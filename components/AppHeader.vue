<template>
    <div>
        <div class="header-wrapper">
            <!-- 2026-11: 메뉴(홈·차트·테마·좋아요) 추가 — 테마 페이지가 생겨 홈에서만 들어가면 찾기 어렵다.
                 모바일은 자리가 없어 메뉴 없이 검색·영상·사용자만(테마는 홈의 테마 구역으로) -->
            <header class="bg-surface-1 border-b border-white border-opacity-5 px-4 sm:px-8">
                <div class="max-w-[1600px] mx-auto h-14 sm:h-16 flex items-center gap-4 lg:gap-8">
                    <NuxtLink to="/" class="text-xl sm:text-2xl font-bold text-white tracking-tight">DIBE2</NuxtLink>
                    <nav aria-label="주 메뉴" class="hidden md:flex items-center gap-1">
                        <NuxtLink v-for="m in menus" :key="m.to" :to="m.to"
                            class="h-9 px-3.5 rounded-full flex items-center text-sm transition-colors"
                            :class="isActive(m) ? 'bg-white bg-opacity-10 text-white font-medium' : 'text-gray-400 hover:text-white'">
                            {{ m.label }}
                        </NuxtLink>
                    </nav>
                    <div class="ml-auto flex items-center gap-1 sm:gap-3">
                        <button @click="toggleSearch" class="sm:hidden w-11 h-11 flex items-center justify-center text-white" aria-label="검색">
                            <Icon name="search" />
                        </button>
                        <!-- 데스크탑 검색창 + 자동완성·최근 검색어 드롭다운(2026-11-08) -->
                        <div class="relative hidden sm:block w-56 lg:w-80">
                            <div class="flex items-center gap-2 h-10 px-3 rounded-full bg-surface-2 text-gray-400 focus-within:ring-2 focus-within:ring-purple-400">
                                <button type="button" class="shrink-0 hover:text-white" aria-label="검색" @click="executeSearch">
                                    <Icon name="search" />
                                </button>
                                <input ref="desktopInput" v-model="localSearchQuery" type="search" aria-label="검색어" autocomplete="off"
                                    placeholder="노래, 앨범, 아티스트 검색"
                                    class="flex-1 min-w-0 bg-transparent text-white text-sm placeholder-gray-400 focus:outline-none"
                                    @focus="suggestOpen = true" @blur="suggestOpen = false" @keydown="onSearchKey($event, 'desktopSuggest')">
                            </div>
                            <SearchSuggest ref="desktopSuggest" :query="localSearchQuery" :open="suggestOpen"
                                class="min-w-[20rem] lg:min-w-[24rem]" @search="runSearch" @pick-song="pickSong" @pick-artist="pickArtist" />
                        </div>
                        <NuxtLink to="/video" aria-label="유튜브 영상 검색" title="유튜브 영상 검색"
                            class="flex items-center justify-center gap-2 text-white w-11 h-11 sm:w-auto sm:h-10 sm:px-4 sm:rounded-full sm:border sm:border-white sm:border-opacity-10 sm:hover:bg-white sm:hover:bg-opacity-5">
                            <Icon name="video" />
                            <span class="hidden sm:inline text-sm">영상</span>
                        </NuxtLink>
                        <UserMenu />
                    </div>
                </div>
            </header>
        </div>
        <transition name="fade">
            <!--
                모바일: 헤더의 돋보기에서 열리는 검색창(2026-11). 헤더 자리를 그대로 덮는 위쪽 막대 —
                돋보기에서 바로 내려온 것처럼 보이고, 아래는 어둡게 깔려 누르면 닫힌다.
                입력칸은 데스크탑 헤더·검색 결과 창과 같은 알약 모양
            -->
            <div v-if="showSearch" class="fixed inset-0 z-50 bg-black bg-opacity-60" @click="closeSearchOnOutsideClick">
                <form class="bg-surface-1 border-b border-white border-opacity-5 h-14 px-2 flex items-center gap-1" role="search" @click.stop @submit.prevent="executeSearch">
                    <button type="button" class="w-11 h-11 flex items-center justify-center text-gray-300 shrink-0" aria-label="검색 닫기" @click="toggleSearch">
                        <Icon name="arrow-left" :size="22" />
                    </button>
                    <div class="flex-1 min-w-0 flex items-center gap-2 h-10 px-3 rounded-full bg-surface-2 text-gray-400 focus-within:ring-2 focus-within:ring-purple-400">
                        <Icon name="search" :size="18" />
                        <input ref="mobileSearchInput" v-model="localSearchQuery" type="search" aria-label="검색어" enterkeyhint="search" autocomplete="off"
                            placeholder="노래, 앨범, 아티스트 검색" class="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 focus:outline-none"
                            @keydown="onSearchKey($event, 'mobileSuggest')">
                    </div>
                    <button type="submit" class="h-10 px-3 text-sm font-semibold text-purple-300 shrink-0">검색</button>
                </form>
                <!-- 모바일: 막대 바로 아래 최근 검색어·자동완성 -->
                <div class="px-2 pt-2" @click.stop>
                    <SearchSuggest ref="mobileSuggest" inline :query="localSearchQuery" :open="showSearch"
                        @search="runSearch" @pick-song="pickSong" @pick-artist="pickArtist" />
                </div>
            </div>
        </transition>

        <SearchResultsModal :show="showSearchResults" @close="closeSearchResults" />
    </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import SearchResultsModal from './SearchResultsModal.vue';
import SearchSuggest from './SearchSuggest.vue';
import UserMenu from './UserMenu.vue';
import { addRecent } from '~/utils/recentSearches'

export default {
    components: {
        SearchResultsModal,
        SearchSuggest,
        UserMenu
    },
    data() {
        return {
            localSearchQuery: '',
            suggestOpen: false,
        }
    },
    computed: {
        ...mapState('search', ['searchQuery', 'searchResults', 'showSearch', 'showSearchResults']),
        menus() {
            return [
                { to: '/', label: '홈', exact: true },
                { to: '/chart', label: '차트' },
                { to: '/theme', label: '테마' },
                { to: '/liked', label: '좋아요' },
            ]
        },
    },
    methods: {
        ...mapActions('search', ['performSearch', 'closeSearchResults', 'toggleSearch', 'updateSearchQuery', 'searchAll', 'searchArtist']),
        isActive(m) {
            return m.exact ? this.$route.path === m.to : this.$route.path.startsWith(m.to)
        },
        executeSearch() {
            this.runSearch(this.localSearchQuery)
        },
        // 검색 실행(엔터·최근 검색어·"전체 결과 보기") — 결과 창은 '전체' 탭으로 연다
        runSearch(q) {
            const query = String(q || '').trim()
            if (!query) return
            this.localSearchQuery = query
            this.closeInputs()
            this.searchAll(query)
        },
        pickArtist(name) {
            this.closeInputs()
            this.searchArtist(name)
        },
        // 자동완성의 곡 = 그 곡 하나 바로 재생(검색 결과 줄 클릭과 같음). 검색어는 최근 검색어에 남긴다
        pickSong(song) {
            addRecent('music', this.localSearchQuery)
            this.closeInputs()
            this.$store.dispatch('player/playList', {
                source: { type: 'search', id: String(song._id), name: `"${this.localSearchQuery.trim()}" 검색` },
                songs: [song],
                idKey: '_id',
                index: 0,
            })
        },
        closeInputs() {
            this.suggestOpen = false
            if (this.$refs.desktopInput) this.$refs.desktopInput.blur()
            if (this.showSearch) this.toggleSearch() // 모바일 검색 막대 닫기
        },
        // ↑↓ Enter 는 제안 목록에 먼저 묻고, 안 쓰면 Enter = 검색. Esc = 닫기
        onSearchKey(e, ref) {
            const panel = this.$refs[ref]
            if (panel && panel.onKey(e)) { e.preventDefault(); return }
            if (e.key === 'Enter') { e.preventDefault(); this.executeSearch() }
            else if (e.key === 'Escape') this.closeInputs()
        },
        closeSearchOnOutsideClick(event) {
            if (event.target === event.currentTarget) {
                this.toggleSearch()
            }
        },
        focusSearchInput() {
            this.$nextTick(() => {
                if (this.$refs.mobileSearchInput) {
                    this.$refs.mobileSearchInput.focus()
                }
            })
        }
    },
    watch: {
        // 결과 창·가수 칩에서 검색어가 바뀌면 헤더 입력칸도 따라간다(예전 검색어가 남아 있었다)
        searchQuery(q) {
            this.localSearchQuery = q
        },
        showSearch(newVal) {
            if (newVal) {
                this.focusSearchInput()
            }
        }
    }
}
</script>

<style scoped>
.header-wrapper {
    position: relative;
}

/* layouts/main.vue 의 전역 .container { overflow-x: hidden } 이
   CSS spec상 overflow-y를 auto로 승격시켜 헤더 안 UserMenu 드롭다운을 잘랐음.
   헤더 자체는 horizontal 넘칠 일이 없으니 visible 로 덮어씀. */
header > .container {
    overflow-x: visible;
    overflow-y: visible;
}

@media (max-width: 640px) {
    .container {
        padding-left: 1rem;
        padding-right: 1rem;
    }
}

.fade-enter-active,
.fade-leave-active {
    transition: opacity 0.3s;
}

.fade-enter,
.fade-leave-to {
    opacity: 0;
}
</style>