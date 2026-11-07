<template>
    <div class="min-h-screen bg-gray-100 flex flex-col">
        <!-- 헤더 -->
        <header class="bg-white shadow-sm z-20">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 md:py-4 flex justify-between items-center">
                <h1 class="text-xl sm:text-2xl font-semibold text-gray-900">관리자 패널</h1>
                <button
                    @click="exitAdmin"
                    aria-label="관리자 나가기"
                    class="w-11 h-11 flex items-center justify-center rounded-md text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                    <Icon name="log-out" />
                </button>
            </div>
            <!--
                모바일은 사이드바 대신 탭 3개. 메뉴가 3개뿐인데 햄버거를 열고 → 고르고 → 닫히는 3단계였다(2026-11-07)
            -->
            <nav class="md:hidden flex border-t border-gray-100" aria-label="관리자 메뉴">
                <button v-for="item in menuItems" :key="item.id" type="button" @click="selectMenuItem(item.id)"
                    :aria-current="currentView === item.id ? 'page' : null"
                    :class="['flex-1 h-11 text-sm font-medium border-b-2',
                        currentView === item.id ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500']">
                    {{ item.label }}
                </button>
            </nav>
        </header>

        <div class="flex-1 flex overflow-hidden">
            <!-- 데스크탑 사이드바 -->
            <nav class="hidden md:block bg-gray-800 w-64 shrink-0" aria-label="관리자 메뉴">
                <div class="px-4 py-5 flex flex-col h-full">
                    <ul class="flex-1 space-y-2">
                        <li v-for="item in menuItems" :key="item.id">
                            <a href="#" @click.prevent="selectMenuItem(item.id)"
                                :aria-current="currentView === item.id ? 'page' : null"
                                :class="['block px-4 py-2 rounded-md text-base font-medium',
                                    currentView === item.id ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white']">
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
