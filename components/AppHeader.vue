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
                                <input v-model="searchQuery" type="text" placeholder="노래, 앨범, 아티스트 검색"
                                    class="w-full bg-white bg-opacity-20 text-white placeholder-gray-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-white focus:bg-opacity-30 pl-4 pr-12">
                                <i class="fas fa-search absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-300"></i>
                            </div>
                            <div class="relative">
                                <button @click="toggleUserMenu" class="flex items-center space-x-2 text-white hover:text-gray-200">
                                    <img src="https://via.placeholder.com/32" alt="User Avatar" class="w-8 h-8 rounded-full">
                                    <span class="hidden sm:inline">{{ userName }}</span>
                                    <i class="fas fa-chevron-down"></i>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>
            <div v-if="showUserMenu" class="user-menu absolute right-4 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
                <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">프로필</a>
                <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">설정</a>
                <a @click="logout" href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">로그아웃</a>
            </div>
        </div>
        <div v-if="showSearch" class="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div class="bg-white w-full max-w-md rounded-lg shadow-lg">
                <div class="p-4 flex items-center">
                    <input v-model="searchQuery" type="text" placeholder="노래, 앨범, 아티스트 검색"
                        class="flex-grow bg-gray-100 text-gray-800 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-purple-500">
                    <button @click="toggleSearch" class="ml-4 text-gray-600">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return {
            searchQuery: '',
            showUserMenu: false,
            showSearch: false
        }
    },
    computed: {
        userName() {
            return this.$store.state.auth.user?.username
        }
    },
    methods: {
        toggleUserMenu() {
            this.showUserMenu = !this.showUserMenu
        },
        toggleSearch() {
            this.showSearch = !this.showSearch
        },
        async logout() {
            try {
                await this.$store.dispatch('auth/logout')
                this.$router.push('/login')
            } catch (error) {
                console.error('로그아웃 중 오류 발생:', error)
            }
        }
    }
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
</style>