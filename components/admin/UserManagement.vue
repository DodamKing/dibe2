<template>
    <div>
        <h2 class="hidden md:block text-2xl font-semibold text-gray-900 mb-4">사용자 관리</h2>
        <div class="bg-white shadow rounded-lg p-4 sm:p-6">
            <div class="flex flex-col sm:flex-row justify-between mb-4">
                <!-- 모바일에서 버튼 글자가 "검/색" 세로로 쪼개지던 것 — 칸은 min-w-0 로 줄고 버튼은 줄바꿈 금지 -->
                <div class="flex gap-2 mb-2 sm:mb-0">
                    <input v-model="searchTerm" type="text" placeholder="사용자 검색"
                        class="border px-3 h-11 rounded min-w-0 flex-1 sm:flex-none sm:w-56" @keyup.enter="search">
                    <button @click="search" class="h-11 px-4 shrink-0 whitespace-nowrap bg-blue-500 text-white rounded hover:bg-blue-600">
                        검색
                    </button>
                </div>
                <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto mt-2 sm:mt-0">
                    <span class="mr-2 text-sm text-gray-600">페이지 {{ currentPage }} / {{ totalPages }}</span>
                    <div class="flex gap-1">
                        <button @click="changePage(-1)" :disabled="currentPage === 1" aria-label="이전 페이지"
                            class="w-11 h-11 sm:w-9 sm:h-9 bg-gray-200 rounded disabled:opacity-40">&lt;</button>
                        <button @click="changePage(1)" :disabled="currentPage === totalPages" aria-label="다음 페이지"
                            class="w-11 h-11 sm:w-9 sm:h-9 bg-gray-200 rounded disabled:opacity-40">&gt;</button>
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
                            <th class="text-left p-2">사용 기간</th>
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
                                    class="px-2 py-1 rounded-full text-xs font-medium">
                                    {{ user.isAdmin ? '관리자' : '일반 사용자' }}
                                </span>
                            </td>
                            <td class="p-2">
                                <span v-if="!user.expiryDate" class="text-red-600 text-sm">
                                    미설정
                                </span>
                                <span v-else :class="getExpiryStatusClass(user.expiryDate)"
                                    class="px-2 py-1 rounded-full text-xs font-medium">
                                    {{ formatExpiryDate(user.expiryDate) }}
                                </span>
                            </td>
                            <td class="p-2">
                                <span @click="showToggleAdminToast(user)"
                                    :class="user.isAdmin ? 'bg-yellow-100 text-yellow-800 hover:bg-yellow-200' : 'bg-blue-100 text-blue-800 hover:bg-blue-200'"
                                    class="px-2 py-1 rounded-full text-xs font-medium cursor-pointer mr-2">
                                    {{ user.isAdmin ? '관리자 해제' : '관리자 지정' }}
                                </span>
                                <span @click="showAccessPeriodModal(user)"
                                    class="bg-green-100 text-green-800 hover:bg-green-200 px-2 py-1 rounded-full text-xs font-medium cursor-pointer mr-2">
                                    사용 기간 설정
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            <!-- 모바일 뷰 -->
            <div class="sm:hidden">
                <!-- 한 사람 = 2줄. 주로 "누가 있나" 훑고 가끔 사용 기간을 바꾼다 → 기간 배지 자체가 버튼(오른쪽).
                     관리자 지정은 거의 안 쓰므로 작은 글자 링크로만. 예전엔 이름표 줄 5개(한 화면 3~4명),
                     그다음엔 큰 버튼 2개라 목록이 안 보였다(2026-11-07 사용자 지적) -->
                <div v-for="user in users" :key="user._id" class="border-t py-2.5 flex items-center gap-3">
                    <div class="min-w-0 flex-1">
                        <p class="text-sm font-medium text-gray-900 truncate">{{ user.email || '이메일 없음' }}</p>
                        <p class="flex items-center gap-1.5 text-xs text-gray-500 truncate">
                            <span class="truncate">{{ user.username || '이름 없음' }} · {{ user.provider || '로컬' }}</span>
                            <span v-if="user.isAdmin" class="shrink-0 bg-green-100 text-green-800 px-1.5 rounded-full font-medium">관리자</span>
                            <button type="button" class="shrink-0 underline text-gray-400 py-1" @click="showToggleAdminToast(user)">
                                {{ user.isAdmin ? '해제' : '관리자로' }}
                            </button>
                        </p>
                    </div>
                    <button type="button" @click="showAccessPeriodModal(user)" :aria-label="`${user.email} 사용 기간 설정`"
                        class="shrink-0 min-h-[40px] px-2.5 rounded-full text-xs font-medium whitespace-nowrap"
                        :class="user.expiryDate ? getExpiryStatusClass(user.expiryDate) : 'bg-red-50 text-red-600'">
                        {{ user.expiryDate ? formatExpiryDate(user.expiryDate) : '기간 미설정' }} ›
                    </button>
                </div>
            </div>
        </div>

        <!-- 사용 기간 설정 모달 -->
        <div v-if="showModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div class="bg-white p-6 rounded-lg shadow-xl max-w-md w-full">
                <h3 class="text-lg font-semibold mb-4">사용 기간 설정</h3>
                <div class="mb-4">
                    <p class="text-sm text-gray-600 mb-2">
                        {{ selectedUser?.username || '선택된 사용자' }}의 사용 기간을 설정합니다.
                    </p>
                    <select v-model="selectedPeriod" class="w-full border p-2 rounded mb-2">
                        <option value="1">1일</option>
                        <option value="7">7일</option>
                        <option value="30">30일</option>
                        <option value="90">90일</option>
                        <option value="180">180일</option>
                        <option value="365">1년</option>
                        <option value="unlimited">무제한</option>
                    </select>
                </div>
                <div class="flex justify-end gap-2">
                    <button @click="closeModal" class="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded">
                        취소
                    </button>
                    <button @click="setAccessPeriod" class="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
                        설정
                    </button>
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
            limit: 10,
            showModal: false,
            selectedUser: null,
            selectedPeriod: '30'
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
        formatExpiryDate(expiryDate) {
            const expiryTimestamp = new Date(expiryDate).getTime()
            const nowTimestamp = Date.now()

            // 100년 이상 남은 경우 무제한으로 표시 (100년 * 365.25일 * 24시간 * 60분 * 60초 * 1000밀리초)
            if ((expiryTimestamp - nowTimestamp) > (100 * 365.25 * 24 * 60 * 60 * 1000)) {
                return '무제한'
            }

            // 남은 일수 계산
            const diffTime = expiryTimestamp - nowTimestamp
            const diffHours = Math.ceil(diffTime / (1000 * 60 * 60))
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (diffTime < 0) {
                return '만료됨'
            } else if (diffHours <= 24) {  // 24시간 이하인 경우
                if (diffHours <= 0) {
                    return '1시간 이내 만료'
                } else {
                    return `${diffHours}시간 남음`
                }
            } else {
                return `${diffDays}일 남음`
            }
        },
        getExpiryStatusClass(expiryDate) {
            const expiry = new Date(expiryDate)
            const now = new Date()

            // 무제한인 경우
            if (expiry.getFullYear() - now.getFullYear() >= 100) {
                return 'bg-purple-100 text-purple-800'
            }

            const diffTime = expiry - now
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

            if (diffDays < 0) {
                return 'bg-red-100 text-red-800'
            } else if (diffDays <= 7) {
                return 'bg-yellow-100 text-yellow-800'
            } else {
                return 'bg-green-100 text-green-800'
            }
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
        showAccessPeriodModal(user) {
            this.selectedUser = user
            if (user.expiryDate) {
                const expiry = new Date(user.expiryDate)
                const now = new Date()
                if (expiry.getFullYear() - now.getFullYear() >= 100) {
                    this.selectedPeriod = 'unlimited'
                } else {
                    const diffDays = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24))
                    const periods = [1, 7, 30, 90, 180, 365]
                    this.selectedPeriod = periods.reduce((prev, curr) => {
                        return Math.abs(curr - diffDays) < Math.abs(prev - diffDays) ? curr : prev
                    }, 30).toString()
                }
            } else {
                this.selectedPeriod = '30'
            }
            this.showModal = true
        },
        closeModal() {
            this.showModal = false
            this.selectedUser = null
            this.selectedPeriod = '30'
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
        async setAccessPeriod() {
            try {
                const response = await this.$axios.$put(`/api/admin/users/${this.selectedUser._id}/access`, {
                    days: this.selectedPeriod === 'unlimited' ? 'unlimited' : parseInt(this.selectedPeriod)
                })

                // API 호출 성공 후 사용자 목록 새로고침
                await this.fetchUsers()
                this.$toast.success(response.message)
                this.closeModal()
            } catch (error) {
                console.error('Failed to set access period:', error)
                // 서버의 에러 응답 처리
                if (error.response?.data?.message) {
                    // 서버에서 정의한 에러 메시지 사용
                    this.$toast.error(error.response.data.message)
                } else {
                    // 네트워크 오류 등 예상치 못한 에러
                    this.$toast.error('서버와 통신 중 오류가 발생했습니다.')
                }
            }
        },
    }
}
</script>
                