<template>
    <div>
        <h2 class="text-2xl font-semibold text-gray-900 mb-4">사용자 관리</h2>
        <div class="bg-white shadow rounded-lg p-4 sm:p-6">
            <div class="flex flex-col sm:flex-row justify-between mb-4">
                <div class="flex mb-2 sm:mb-0">
                    <input 
                        v-model="searchTerm" 
                        type="text" 
                        placeholder="사용자 검색" 
                        class="border p-2 rounded mr-2 w-full sm:w-auto"
                    >
                    <button @click="search" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        검색
                    </button>
                </div>
                <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0">
                    <span class="mr-2">페이지 {{ currentPage }} / {{ totalPages }}</span>
                    <div>
                        <button @click="changePage(-1)" :disabled="currentPage === 1" class="px-2 py-1 bg-gray-200 rounded mr-1">&lt;</button>
                        <button @click="changePage(1)" :disabled="currentPage === totalPages" class="px-2 py-1 bg-gray-200 rounded">&gt;</button>
                    </div>
                </div>
            </div>
            
            <!-- 데스크탑 뷰 -->
            <div class="hidden sm:block">
                <table class="w-full">
                    <thead>
                        <tr>
                            <th class="text-left p-2">이메일</th>
                            <th class="text-left p-2">이름</th>
                            <th class="text-left p-2">가입 방법</th>
                            <th class="text-left p-2">관리자</th>
                            <th class="text-left p-2">액션</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr v-for="user in users" :key="user._id" class="border-t">
                            <td class="p-2">{{ user.email || '이메일 없음' }}</td>
                            <td class="p-2">{{ user.username || '이름 없음' }}</td>
                            <td class="p-2">{{ user.provider || '로컬' }}</td>
                            <td class="p-2">
                                <span 
                                    :class="user.isAdmin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                                    class="px-2 py-1 rounded-full text-xs font-medium"
                                >
                                    {{ user.isAdmin ? '관리자' : '일반 사용자' }}
                                </span>
                            </td>
                            <td class="p-2">
                                <span 
                                    @click="showToggleAdminToast(user)"
                                    :class="user.isAdmin ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'"
                                    class="px-2 py-1 rounded-full text-xs font-medium cursor-pointer mr-2"
                                >
                                    {{ user.isAdmin ? '관리자 해제' : '관리자 지정' }}
                                </span>
                                <span 
                                    @click="showDeactivateToast(user)"
                                    class="bg-red-100 text-red-800 hover:bg-red-200 px-2 py-1 rounded-full text-xs font-medium cursor-pointer"
                                >
                                    계정 비활성화
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 모바일 뷰 -->
            <div class="sm:hidden">
                <div v-for="user in users" :key="user._id" class="border-t py-4">
                    <div class="mb-2">
                        <strong>이메일:</strong> {{ user.email || '이메일 없음' }}
                    </div>
                    <div class="mb-2">
                        <strong>이름:</strong> {{ user.username || '이름 없음' }}
                    </div>
                    <div class="mb-2">
                        <strong>가입 방법:</strong> {{ user.provider || '로컬' }}
                    </div>
                    <div class="mb-2">
                        <strong>관리자:</strong>
                        <span 
                            :class="user.isAdmin ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'"
                            class="px-2 py-1 rounded-full text-xs font-medium ml-2"
                        >
                            {{ user.isAdmin ? '관리자' : '일반 사용자' }}
                        </span>
                    </div>
                    <div class="flex flex-wrap gap-2 mt-2">
                        <span 
                            @click="showToggleAdminToast(user)"
                            :class="user.isAdmin ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'"
                            class="px-2 py-1 rounded-full text-xs font-medium cursor-pointer"
                        >
                            {{ user.isAdmin ? '관리자 해제' : '관리자 지정' }}
                        </span>
                        <span 
                            @click="showDeactivateToast(user)"
                            class="bg-red-100 text-red-800 hover:bg-red-200 px-2 py-1 rounded-full text-xs font-medium cursor-pointer"
                        >
                            계정 비활성화
                        </span>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'UserManagement',
    data() {
        return {
            users: [],
            currentPage: 1,
            totalPages: 1,
            searchTerm: '',
            limit: 10
        }
    },
    fetch() {
        return this.fetchUsers()
    },
    methods: {
        async fetchUsers() {
            try {
                const response = await this.$axios.$get('/api/users', {
                    params: {
                        page: this.currentPage,
                        limit: this.limit,
                        search: this.searchTerm
                    }
                })
                this.users = response.users
                this.totalPages = response.totalPages
            } catch (error) {
                console.error('Failed to fetch users:', error)
                this.$toast.error('사용자 목록을 불러오는데 실패했습니다.')
            }
        },
        changePage(delta) {
            this.currentPage += delta
            this.fetchUsers()
        },
        search() {
            this.currentPage = 1
            this.fetchUsers()
        },
        showToggleAdminToast(user) {
            this.$toast.show(`${user.username || '이 사용자'}의 관리자 권한을 변경하시겠습니까?`, {
                duration: 5000,
                action: {
                    text: '확인',
                    onClick: (e, toastObject) => {
                        this.toggleAdminStatus(user)
                        toastObject.goAway(0)
                    }
                }
            })
        },
        async toggleAdminStatus(user) {
            try {
                await this.$axios.$patch(`/api/users/${user._id}/toggle-admin`)
                user.isAdmin = !user.isAdmin
                this.$toast.success(`${user.username || '사용자'}의 관리자 상태가 변경되었습니다.`)
            } catch (error) {
                console.error('Failed to toggle admin status:', error)
                this.$toast.error('관리자 상태 변경에 실패했습니다.')
            }
        },
        showDeactivateToast(user) {
            this.$toast.show(`${user.username || '이 사용자'}의 계정을 비활성화하시겠습니까?`, {
                duration: 5000,
                action: {
                    text: '확인',
                    onClick: (e, toastObject) => {
                        this.deactivateUser(user)
                        toastObject.goAway(0)
                    }
                }
            })
        },
        deactivateUser() {
            // 실제 비활성화 로직은 아직 구현되지 않았으므로, 임시 메시지를 표시합니다.
            this.$toast.info('계정 비활성화 기능은 현재 구현 중입니다.', { duration: 3000 })
        }
    }
}
</script>