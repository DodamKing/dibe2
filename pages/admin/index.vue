<template>
    <div class="min-h-screen bg-gray-100 flex flex-col">
        <!-- 헤더 -->
        <header class="bg-white shadow-sm z-20">
            <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                <div class="flex items-center">
                    <button @click="toggleSidebar"
                        class="mr-2 p-2 rounded-md text-gray-600 hover:text-gray-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 md:hidden">
                        <i class="fas fa-bars"></i>
                    </button>
                    <h1 class="text-xl sm:text-2xl font-semibold text-gray-900">관리자 패널</h1>
                </div>
                <button
                    @click="exitAdmin"
                    class="p-2 rounded-md text-gray-500 hover:text-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                    <i class="fas fa-sign-out-alt"></i>
                </button>
            </div>
        </header>

        <div class="flex-1 flex overflow-hidden">
            <!-- 사이드바 배경 오버레이 -->
            <div v-if="sidebarOpen" @click="closeSidebar"
                class="fixed inset-0 bg-gray-600 bg-opacity-75 z-20 md:hidden"></div>

            <!-- 사이드바 네비게이션 -->
            <nav :class="['bg-gray-800 w-64 absolute inset-y-0 left-0 transform transition-transform duration-300 ease-in-out z-30',
                { 'translate-x-0': sidebarOpen, '-translate-x-full': !sidebarOpen },
                'md:relative md:translate-x-0']">
                <div class="px-4 py-5 flex flex-col h-full">
                    <ul class="flex-1 space-y-2">
                        <li v-for="item in menuItems" :key="item.id">
                            <a href="#" @click.prevent="selectMenuItem(item.id)"
                                :class="['block px-4 py-2 rounded-md text-base font-medium',
                                    currentView === item.id ? 'bg-gray-900 text-white' : 'text-gray-300 hover:bg-gray-700 hover:text-white']">
                                {{ item.label }}
                            </a>
                        </li>
                    </ul>
                </div>
            </nav>

            <!-- 메인 콘텐츠 -->
            <main class="flex-1 overflow-y-auto bg-gray-100 p-4 sm:p-6">
                <component :is="currentComponent"></component>
            </main>
        </div>
    </div>
</template>

<script>
import { ref, computed } from 'vue'
import Dashboard from '~/components/admin/AdminDashboard.vue'
import MusicManagement from '~/components/admin/MusicManagement.vue'
import UserManagement from '~/components/admin/UserManagement.vue'

export default {
    head() {
        return {
            title: 'DIBE2 | 관리자'
        }
    },
    components: {
        Dashboard,
        MusicManagement,
        UserManagement,
    },
    setup() {
        const currentView = ref('dashboard')
        const sidebarOpen = ref(false)

        const menuItems = [
            { id: 'dashboard', label: '대시보드' },
            { id: 'music', label: '음원 관리' },
            { id: 'users', label: '사용자 관리' },
        ]

        const currentComponent = computed(() => {
            const components = {
                dashboard: Dashboard,
                music: MusicManagement,
                users: UserManagement,
            }
            return components[currentView.value] || Dashboard
        })

        const toggleSidebar = () => {
            sidebarOpen.value = !sidebarOpen.value
        }

        const closeSidebar = () => {
            sidebarOpen.value = false
        }

        const selectMenuItem = (id) => {
            currentView.value = id
            if (window.innerWidth < 768) {
                closeSidebar()
            }
        }

        return {
            currentView,
            menuItems,
            currentComponent,
            sidebarOpen,
            toggleSidebar,
            closeSidebar,
            selectMenuItem,
        }
    },

    methods: {
        exitAdmin () {
            this.$router.push('/')
        }
    }
}
</script>