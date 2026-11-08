<template>
    <div class="min-h-screen bg-gray-100 flex flex-col">
        <!-- 헤더 — 위에 고정. 스크롤하면 탭이 사라져 다른 탭을 누르려면 맨 위로 올라가야 했다(2026-11-08) -->
        <!-- 어두운 헤더 = 데스크탑 사이드바(gray-800)와 같은 색으로 한 덩어리. 사이트 로고 + "관리자" 배지(2026-11-08) -->
        <header class="sticky top-0 bg-gray-900 z-30">
            <div class="px-4 sm:px-6 h-14 md:h-[76px] flex justify-between items-center">
                <h1 class="flex items-center gap-2">
                    <span class="text-xl sm:text-2xl font-bold text-white tracking-tight">DIBE2</span>
                    <span class="px-2 py-0.5 rounded-md bg-white bg-opacity-10 text-xs sm:text-sm font-medium text-gray-200">관리자</span>
                </h1>
                <button
                    type="button"
                    @click="exitAdmin"
                    class="h-10 px-3 flex items-center gap-1.5 rounded-md text-sm text-gray-300 hover:text-white hover:bg-white hover:bg-opacity-10 focus:outline-none focus:ring-2 focus:ring-gray-500">
                    <Icon name="log-out" :size="18" />사이트로
                </button>
            </div>
            <!--
                모바일은 사이드바 대신 탭 3개. 메뉴가 3개뿐인데 햄버거를 열고 → 고르고 → 닫히는 3단계였다(2026-11-07)
            -->
            <nav class="md:hidden flex bg-white shadow-sm" aria-label="관리자 메뉴">
                <button v-for="item in menuItems" :key="item.id" type="button" @click="selectMenuItem(item.id)"
                    :aria-current="currentView === item.id ? 'page' : null"
                    :class="['flex-1 h-11 text-sm font-medium border-b-2',
                        currentView === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500']">
                    {{ item.label }}
                </button>
            </nav>
        </header>

        <!-- overflow-hidden 이면 그 안의 sticky(사이드바 메뉴)가 안 붙는다 → 가로만 자르는 clip -->
        <div class="flex-1 flex overflow-x-clip">
            <!-- 데스크탑 사이드바 — 메뉴도 헤더 아래에 붙어 따라온다 -->
            <nav class="hidden md:block bg-gray-900 w-64 shrink-0" aria-label="관리자 메뉴">
                <div class="sticky top-[76px] px-4 py-5 flex flex-col">
                    <ul class="flex-1 space-y-2">
                        <li v-for="item in menuItems" :key="item.id">
                            <a href="#" @click.prevent="selectMenuItem(item.id)"
                                :aria-current="currentView === item.id ? 'page' : null"
                                :class="['block px-4 py-2 rounded-md text-base font-medium',
                                    currentView === item.id ? 'bg-white bg-opacity-10 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white']">
                                {{ item.label }}
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            <!-- 메인 콘텐츠 -->
            <main class="flex-1 min-w-0 overflow-y-auto bg-gray-100 p-4 sm:p-6">
                <component :is="currentComponent"></component>
            </main>
        </div>
    </div>
</template>

<script>
import Dashboard from '~/components/admin/AdminDashboard.vue'
import MusicManagement from '~/components/admin/MusicManagement.vue'
import UserManagement from '~/components/admin/UserManagement.vue'

const VIEWS = { dashboard: Dashboard, music: MusicManagement, users: UserManagement }

export default {
    components: {
        Dashboard,
        MusicManagement,
        UserManagement,
    },
    data() {
        return {
            menuItems: [
                { id: 'dashboard', label: '대시보드' },
                { id: 'music', label: '음원 관리' },
                { id: 'users', label: '사용자 관리' },
            ],
        }
    },
    head() {
        return {
            title: 'DIBE2 | 관리자'
        }
    },
    computed: {
        // 지금 탭은 주소(?tab=music)에 둔다 — 새로고침해도 대시보드로 튕기지 않게
        currentView() {
            const tab = this.$route.query.tab
            return VIEWS[tab] ? tab : 'dashboard'
        },
        currentComponent() {
            return VIEWS[this.currentView]
        },
    },
    methods: {
        selectMenuItem(id) {
            if (id === this.currentView) return
            this.$router.replace({ query: id === 'dashboard' ? {} : { tab: id } })
        },
        exitAdmin() {
            this.$router.push('/')
        },
    },
}
</script>
