<template>
    <div class="relative" ref="userMenuContainer">
        <button @click="toggleUserMenu" aria-label="사용자 메뉴"
            class="flex items-center space-x-2 text-white hover:text-gray-200">
            <img :src="avatarUrl" alt="User Avatar" class="w-8 h-8 rounded-full">
            <span class="hidden sm:inline">{{ userName }}</span>
            <i class="fas fa-chevron-down"></i>
        </button>
        <div v-if="showUserMenu"
            class="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50">
            <a @click.stop.prevent href="#"
                class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <i class="fas fa-user w-4 text-center text-sky-500"></i>프로필
            </a>
            <a @click.stop.prevent href="#"
                class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <i class="fas fa-cog w-4 text-center text-violet-500"></i>설정
            </a>
            <a @click.stop.prevent="goDownload" href="#"
                class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <i class="fas fa-mobile-alt w-4 text-center text-pink-500"></i>앱 다운로드
            </a>
            <a v-if="isAdmin" @click.stop.prevent="goAdmin" href="#"
                class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <i class="fas fa-user-shield w-4 text-center text-amber-500"></i>관리자
            </a>
            <a @click.stop.prevent="logout" href="#"
                class="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100">
                <i class="fas fa-sign-out-alt w-4 text-center text-rose-500"></i>로그아웃
            </a>
        </div>
    </div>
</template>

<script>
export default {
    data() {
        return { showUserMenu: false }
    },
    computed: {
        userName() {
            return this.$store.state.auth.user?.username || this.$store.state.auth.user?.name
        },
        avatarUrl() {
            const picture = this.$store.state.auth.user?.picture
            return picture ? `${picture}?timestamp=${new Date().getTime()}` : 'https://via.placeholder.com/32'
        },
        isAdmin() {
            return this.$store.state.auth.user?.isAdmin
        }
    },
    methods: {
        toggleUserMenu() { this.showUserMenu = !this.showUserMenu },
        closeUserMenu(event) {
            if (this.$refs.userMenuContainer && !this.$refs.userMenuContainer.contains(event.target)) {
                this.showUserMenu = false
            }
        },
        async logout() {
            try {
                await this.$store.dispatch('auth/logout')
                window.location.reload()
            } catch (err) {
                console.error('로그아웃 중 오류 발생:', err)
            }
        },
        goAdmin() { this.$router.push('/admin') },
        goDownload() {
            this.showUserMenu = false
            this.$router.push('/download')
        }
    },
    mounted() { document.addEventListener('click', this.closeUserMenu) },
    beforeDestroy() { document.removeEventListener('click', this.closeUserMenu) }
}
</script>
