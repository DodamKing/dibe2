<template>
    <!-- 2026-11: 어두운 메뉴 + 가는 선 아이콘(시안). 사진이 없는 계정은 이름 첫 글자 -->
    <div class="relative" ref="userMenuContainer">
        <button @click="toggleUserMenu" aria-label="사용자 메뉴" :aria-expanded="showUserMenu ? 'true' : 'false'"
            class="flex items-center gap-2 h-11 sm:h-10 pl-1 pr-1 sm:pr-2.5 rounded-full text-white hover:bg-white hover:bg-opacity-5"
            :class="{ 'bg-white bg-opacity-10': showUserMenu }">
            <img v-if="picture" :src="picture" alt="" class="w-8 h-8 rounded-full object-cover">
            <span v-else class="w-8 h-8 rounded-full bg-purple-900 flex items-center justify-center text-sm font-bold">{{ initial }}</span>
            <span class="hidden sm:inline text-sm max-w-[8rem] truncate">{{ userName }}</span>
            <Icon :name="showUserMenu ? 'chevron-up' : 'chevron-down'" :size="16" class="hidden sm:block text-gray-400" />
        </button>
        <div v-if="showUserMenu" role="menu"
            class="absolute right-0 mt-2 w-56 p-1.5 rounded-xl bg-surface-2 border border-white border-opacity-10 shadow-2xl z-[70]">
            <a role="menuitem" @click.stop.prevent href="#" class="menu-item">
                <Icon name="user" :size="18" class="text-gray-400" />프로필
            </a>
            <a role="menuitem" @click.stop.prevent href="#" class="menu-item">
                <Icon name="settings" :size="18" class="text-gray-400" />설정
            </a>
            <a role="menuitem" @click.stop.prevent="goDownload" href="#" class="menu-item">
                <Icon name="smartphone" :size="18" class="text-gray-400" />앱 다운로드
            </a>
            <a v-if="isAdmin" role="menuitem" @click.stop.prevent="goAdmin" href="#" class="menu-item">
                <Icon name="shield" :size="18" class="text-gray-400" />관리자
            </a>
            <div class="h-px bg-white bg-opacity-10 my-1.5 mx-1"></div>
            <a role="menuitem" @click.stop.prevent="logout" href="#" class="menu-item danger">
                <Icon name="log-out" :size="18" />로그아웃
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
        // 예전엔 매번 ?timestamp= 를 붙였다 — 사진을 캐시 못 해서 렌더마다 다시 받았다
        picture() {
            return this.$store.state.auth.user?.picture || ''
        },
        initial() {
            return (this.userName || '?').trim().charAt(0).toUpperCase()
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
        goAdmin() {
            this.showUserMenu = false
            this.$router.push('/admin')
        },
        goDownload() {
            this.showUserMenu = false
            this.$router.push('/download')
        }
    },
    mounted() { document.addEventListener('click', this.closeUserMenu) },
    beforeDestroy() { document.removeEventListener('click', this.closeUserMenu) }
}
</script>

<style scoped>
.menu-item {
    display: flex;
    align-items: center;
    gap: 12px;
    height: 44px;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 14px;
    color: #fff;
}
.menu-item:hover { background: rgba(255, 255, 255, 0.06); }
.menu-item.danger { color: rgb(252, 165, 165); }
</style>
