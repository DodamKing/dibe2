<template>
    <header class="bg-gradient-to-r from-purple-800 to-blue-700 shadow-lg p-4">
        <div class="container mx-auto flex justify-between items-center">
            <h1 class="text-2xl font-bold text-white">DIBE2</h1>
            <div class="flex items-center">
                <div class="relative mr-4">
                    <input v-model="searchQuery" type="text" placeholder="노래, 앨범, 아티스트 검색"
                        class="bg-white bg-opacity-20 text-white placeholder-gray-300 rounded-full py-2 px-4 focus:outline-none focus:ring-2 focus:ring-white focus:bg-opacity-30">
                    <i class="fas fa-search absolute right-3 top-3 text-gray-300"></i>
                </div>
                <div class="relative">
                    <button @click="toggleUserMenu" class="flex items-center space-x-2 text-white hover:text-gray-200">
                        <img src="https://via.placeholder.com/32" alt="User Avatar" class="w-8 h-8 rounded-full">
                        <span>{{ userName }}</span>
                        <i class="fas fa-chevron-down"></i>
                    </button>
                    <div v-if="showUserMenu" class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-10">
                        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">프로필</a>
                        <a href="#" class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">설정</a>
                        <a @click="logout" href="#"
                            class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">로그아웃</a>
                    </div>
                </div>
            </div>
        </div>
    </header>
</template>

<script>
export default {
    data() {
        return {
            searchQuery: '',
            showUserMenu: false
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