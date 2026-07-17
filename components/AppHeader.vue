<template>
    <div>
        <div class="header-wrapper">
            <header class="bg-gradient-to-r from-purple-800 to-blue-700 shadow-lg p-4">
                <div class="container mx-auto">
                    <div class="flex justify-between items-center">
                        <h1 class="text-2xl font-bold text-white">DIBE2</h1>
                        <div class="flex items-center space-x-4">
                            <button @click="toggleSearch" class="text-white sm:hidden" aria-label="검색">
                                <i class="fas fa-search"></i>
                            </button>
                            <div class="hidden sm:block relative w-64">
                                <input v-model="localSearchQuery" @keyup.enter="executeSearch" type="text"
                                    placeholder="노래, 앨범, 아티스트 검색"
                                    class="w-full bg-white bg-opacity-20 text-white placeholder-gray-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-white focus:bg-opacity-30 pl-4 pr-12">
                                <i @click="executeSearch"
                                    class="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 cursor-pointer"></i>
                            </div>
                            <NuxtLink to="/video" aria-label="유튜브 영상 검색" title="유튜브 영상 검색"
                                class="text-white hover:text-gray-200 flex items-center">
                                <i class="fas fa-video text-lg"></i>
                            </NuxtLink>
                            <UserMenu />
                        </div>
                    </div>
                </div>
            </header>
        </div>
        <transition name="fade">
            <!--
                헤더의 돋보기에서 열리는 검색창.
                - `items-start`: 화면 정중앙에 띄우면 어디서 나온 팝업인지 연결이 안 된다.
                  헤더 바로 아래(pt-20)에 붙여서 돋보기에서 내려온 것처럼 보이게 한다.
                - 색: 앱이 다크 테마인데 여기만 `bg-white` + `bg-gray-100` 이라 심하게 튀었다.
                  데스크탑 검색창(헤더 안 반투명)·SearchResultsModal(bg-gray-800)과 톤을 맞춘다.
            -->
            <div v-if="showSearch"
                class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-start justify-center p-4 pt-20"
                @click="closeSearchOnOutsideClick">
                <div class="bg-gray-800 w-full max-w-md rounded-lg shadow-lg" @click.stop>
                    <div class="p-3 flex items-center gap-1">
                        <input ref="mobileSearchInput" v-model="localSearchQuery" @keyup.enter="executeSearch"
                            type="text" placeholder="노래, 앨범, 아티스트 검색" autofocus
                            class="flex-grow min-w-0 bg-gray-700 text-white placeholder-gray-400 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <button @click="executeSearch" aria-label="검색"
                            class="p-2 min-w-[44px] min-h-[44px] text-gray-300 hover:text-white flex-shrink-0">
                            <i class="fas fa-search"></i>
                        </button>
                        <button @click="toggleSearch" aria-label="검색 닫기"
                            class="p-2 min-w-[44px] min-h-[44px] text-gray-300 hover:text-white flex-shrink-0">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
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
    },
    methods: {
        ...mapActions('search', ['performSearch', 'closeSearchResults', 'toggleSearch', 'updateSearchQuery']),
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