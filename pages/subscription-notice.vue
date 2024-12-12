<template>
    <div class="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-blue-100 to-indigo-200 p-4">
        <div class="max-w-lg w-full bg-white rounded-3xl shadow-2xl overflow-hidden">
            <!-- 상단 경고 배너 -->
            <div class="bg-gradient-to-r from-red-500 to-pink-500 py-5 px-6 text-white text-center">
                <h2 class="text-xl md:text-2xl font-bold">접근 제한됨</h2>
            </div>

            <!-- 메인 컨텐츠 -->
            <div class="p-8 text-center">
                <!-- 서비스명 -->
                <h1 class="text-2xl font-extrabold text-gray-800 mb-4">DIBE2</h1>
                <h2 class="text-lg md:text-xl text-gray-700 mb-6">서비스 이용이 제한되었습니다</h2>

                <div class="space-y-6 mb-8">
                    <div class="bg-gray-50 rounded-lg p-5 border border-gray-200 shadow-sm">
                        <div class="text-left text-gray-600 text-sm md:text-base space-y-4">
                            <div class="flex items-center">
                                <svg class="w-6 h-6 text-red-500 mr-3" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>사용 기간이 만료되었거나 아직 승인되지 않은 계정입니다.</span>
                            </div>
                            <div class="flex items-center">
                                <svg class="w-6 h-6 text-blue-500 mr-3" fill="none" stroke="currentColor"
                                    viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
                                        d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                                </svg>
                                <span>서비스 이용을 위해서는 관리자의 승인이 필요합니다.</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 버튼 -->
                <button @click="logout" class="w-full px-8 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white text-sm md:text-base rounded-lg 
                          hover:shadow-lg transform transition-all duration-200 focus:outline-none 
                          focus:ring-2 focus:ring-red-500 focus:ring-offset-2">
                    로그아웃
                </button>
            </div>
        </div>
    </div>
</template>

<script>
export default {
    name: 'SubscriptionNotice',
    methods: {
        async logout() {
            try {
                await this.$store.dispatch('auth/logout')
                window.location.reload()
            } catch (error) {
                console.error('로그아웃 중 오류 발생:', error)
            }
        }
    }
}
</script>
