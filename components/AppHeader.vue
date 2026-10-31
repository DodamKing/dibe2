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
                        <div class="hidden sm:flex items-center gap-2 w-56 lg:w-80 h-10 px-3 rounded-full bg-surface-2 text-gray-400 focus-within:ring-2 focus-within:ring-purple-400">
                            <button type="button" class="shrink-0 hover:text-white" aria-label="검색" @click="executeSearch">
                                <Icon name="search" />
                            </button>
                            <input v-model="localSearchQuery" @keyup.enter="executeSearch" type="search" aria-label="검색어"
                                placeholder="노래, 앨범, 아티스트 검색"
                                class="flex-1 min-w-0 bg-transparent text-white text-sm placeholder-gray-400 focus:outline-none">
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
                        <input ref="mobileSearchInput" v-model="localSearchQuery" type="search" aria-label="검색어" enterkeyhint="search"
                            placeholder="노래, 앨범, 아티스트 검색" class="flex-1 min-w-0 bg-transparent text-white placeholder-gray-400 focus:outline-none">
                    </div>
                    <button type="submit" class="h-10 px-3 text-sm font-semibold text-purple-300 shrink-0">검색</button>
                </form>
            </div>
        </transition>

        <SearchResultsModal :show="showSearchResults" @close="closeSearchResults" />
    </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import SearchResultsModal from './SearchResultsModal.vue';
import UserMenu from './UserMenu.vue';

export default {
    components: {
        SearchResultsModal,
        UserMenu
    },
    data() {
        return {
            localSearchQuery: '',
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
        ...mapActions('search', ['performSearch', 'closeSearchResults', 'toggleSearch', 'updateSearchQuery']),
        isActive(m) {
            return m.exact ? this.$route.path === m.to : this.$route.path.startsWith(m.to)
        },
        executeSearch() {
            if (this.localSearchQuery.trim() !== '') {
                this.updateSearchQuery(this.localSearchQuery)
                this.performSearch()
                if (this.showSearch) this.toggleSearch()  // 검색 실행 후 모바일 검색창 닫기
            }
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