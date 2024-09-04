<template>
    <div>
        <div class="header-wrapper">
            <header class="bg-gradient-to-r from-purple-800 to-blue-700 shadow-lg p-4">
                <div class="container mx-auto">
                    <div class="flex justify-between items-center">
                        <h1 class="text-2xl font-bold text-white">DIBE2</h1>
                        <div class="flex items-center space-x-4">
                            <button @click="toggleSearch" class="text-white sm:hidden">
                                <i class="fas fa-search"></i>
                            </button>
                            <div class="hidden sm:block relative w-64">
                                <input v-model="localSearchQuery" @keyup.enter="executeSearch" type="text"
                                    placeholder="노래, 앨범, 아티스트 검색"
                                    class="w-full bg-white bg-opacity-20 text-white placeholder-gray-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-white focus:bg-opacity-30 pl-4 pr-12">
                                <i @click="executeSearch"
                                    class="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300 cursor-pointer"></i>
                            </div>
                            <div class="relative" ref="userMenuContainer">
                                <button @click="toggleUserMenu"
                                    class="flex items-center space-x-2 text-white hover:text-gray-200">
                                    <img src="https://via.placeholder.com/32" alt="User Avatar"
                                        class="w-8 h-8 rounded-full">
                                    <span class="hidden sm:inline">{{ userName }}</span>
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            <div v-if="showUserMenu"
                class="user-menu absolute right-4 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">프로필</a>
                <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">설정</a>
                <a @click="logout" href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">로그아웃</a>
            </div>
        </div>
        <transition name="fade">
            <div v-if="showSearch"
                class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
                @click="closeSearchOnOutsideClick">
                <div class="bg-white w-full max-w-md rounded-lg shadow-lg" @click.stop>
                    <div class="p-4 flex items-center">
                        <input ref="mobileSearchInput" v-model="localSearchQuery" @keyup.enter="executeSearch"
                            type="text" placeholder="노래, 앨범, 아티스트 검색" autofocus
                            class="flex-grow bg-gray-100 text-gray-800 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500">
                        <button @click="executeSearch" class="ml-2 text-gray-600">
                            <i class="fas fa-search"></i>
                        </button>
                        <button @click="toggleSearch" class="ml-2 text-gray-600">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            </div>
        </transition>

        <SearchResultsModal :show="showSearchResults" :searchQuery="searchQuery" :results="searchResults"
            @close="closeSearchResults" />
    </div>
</template>

<script>
import { mapState, mapActions } from 'vuex'
import SearchResultsModal from './SearchResultsModal.vue';

export default {
    components: {
        SearchResultsModal
    },
    data() {
        return {
            showUserMenu: false,
            localSearchQuery: '',
        }
    },
    computed: {
        ...mapState('search', ['searchQuery', 'searchResults', 'showSearch', 'showSearchResults']),
        userName() {
            return this.$store.state.auth.user?.username
        }
    },
    methods: {
        ...mapActions('search', ['performSearch', 'closeSearchResults', 'toggleSearch', 'updateSearchQuery']),
        toggleUserMenu() {
            this.showUserMenu = !this.showUserMenu
        },
        closeUserMenu(event) {
            if (!this.$refs.userMenuContainer.contains(event.target)) {
                this.showUserMenu = false
            }
        },
        async logout() {
            try {
                await this.$store.dispatch('auth/logout')
                this.$router.push('/login')
            } catch (error) {
                console.error('로그아웃 중 오류 발생:', error)
            }
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
        },
    },
    watch: {
        showSearch(newVal) {
            if (newVal) {
                this.focusSearchInput()
            }
        }
    },
    mounted() {
        window.addEventListener('popstate', this.toggleSearch)
        document.addEventListener('click', this.closeUserMenu)
    },
    beforeDestroy() {
        window.removeEventListener('popstate', this.toggleSearch)
        document.removeEventListener('click', this.closeUserMenu)
    },

}
</script>

<style scoped>
.header-wrapper {
    position: relative;
}

.user-menu {
    position: absolute;
    top: 100%;
    right: 1rem;
    z-index: 50;
}

@media (max-width: 640px) {
    .container {
        padding-left: 1rem;
        padding-right: 1rem;
    }

    .user-menu {
        right: 1rem;
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